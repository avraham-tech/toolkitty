import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { clockText, isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput } from '../core'
import { publish, retractAll } from '../signals'
import { emptyState, ICONS, listRow, sectionTitle } from '../ui'
import type { Chip, Level } from '../ui'

const T = {
  title: { en: 'Cost meter', he: 'מד עלות', es: 'Medidor de costo', fr: 'Compteur de coût', ru: 'Счётчик стоимости', zh: '费用计量', ja: 'コストメーター', pt: 'Medidor de custo', de: 'Kostenmesser', ko: '비용 미터' },
  description: { en: 'A line above the prompt box: the session cost so far and how full the context window is.', he: 'פס מעל תיבת הכתיבה: עלות הסשן עד כה ואחוז מילוי חלון ההקשר.', es: 'Una línea sobre el cuadro de texto: el costo de la sesión hasta ahora y qué tan llena está la ventana de contexto.', fr: 'Une ligne au-dessus de la zone de saisie : le coût de la session à ce jour et le remplissage de la fenêtre de contexte.', ru: 'Строка над полем ввода: стоимость сессии на данный момент и заполненность окна контекста.', zh: '输入框上方的一行：到目前为止的会话费用，以及上下文窗口的占用程度。', ja: 'プロンプト欄の上に表示される1行：これまでのセッションコストと、コンテキストウィンドウの使用率。', pt: 'Uma linha acima da caixa de prompt: o custo da sessão até agora e o quanto a janela de contexto está cheia.', de: 'Eine Zeile über dem Eingabefeld: die bisherigen Session-Kosten und wie voll das Kontextfenster ist.', ko: '입력창 위의 한 줄: 지금까지의 세션 비용과 컨텍스트 창이 얼마나 찼는지 보여 줍니다.' },
  cost: { en: 'Cost', he: 'עלות', es: 'Costo', fr: 'Coût', ru: 'Стоимость', zh: '费用', ja: 'コスト', pt: 'Custo', de: 'Kosten', ko: '비용' },
  context: { en: 'Context', he: 'הקשר', es: 'Contexto', fr: 'Contexte', ru: 'Контекст', zh: '上下文', ja: 'コンテキスト', pt: 'Contexto', de: 'Kontext', ko: '컨텍스트' },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dHead: { en: 'Cost per turn (newest first)', he: 'עלות לכל תור (החדשים ראשונים)', es: 'Costo por turno (los más recientes primero)', fr: 'Coût par tour (les plus récents d\'abord)', ru: 'Стоимость по ходам (сначала новые)', zh: '每轮费用（最新在前）', ja: 'ターンごとのコスト（新しい順）', pt: 'Custo por turno (mais recente primeiro)', de: 'Kosten pro Durchgang (neueste zuerst)', ko: '턴별 비용(최신순)' },
  dNoneHint: { en: 'After each finished turn, what it added to the session cost is listed here.', he: 'אחרי כל תור שהסתיים, מה שהוא הוסיף לעלות הסשן יופיע כאן.', es: 'Tras cada turno terminado, aquí aparece lo que añadió al costo de la sesión.', fr: 'Après chaque tour terminé, ce qu\'il a ajouté au coût de la session apparaît ici.', ru: 'После каждого завершённого хода здесь появится его вклад в стоимость сессии.', zh: '每轮结束后，这里会列出它给会话费用增加了多少。', ja: 'ターンが終わるたびに、そのターンがセッションコストに加えた額がここに並びます。', pt: 'Após cada turno concluído, o quanto ele somou ao custo da sessão é listado aqui.', de: 'Nach jedem abgeschlossenen Durchgang steht hier, was er zu den Session-Kosten beigetragen hat.', ko: '턴이 끝날 때마다 그 턴이 세션 비용에 더한 금액이 여기에 나열됩니다.' },
  dNone: { en: 'No turn has finished yet.', he: 'עדיין לא הסתיים אף תור.', es: 'Aún no ha terminado ningún turno.', fr: 'Aucun tour n\'est encore terminé.', ru: 'Ни один ход ещё не завершён.', zh: '还没有完成任何一轮。', ja: 'まだ完了したターンはありません。', pt: 'Nenhum turno terminou ainda.', de: 'Noch kein Durchgang abgeschlossen.', ko: '아직 끝난 턴이 없습니다.' },
  dRow: { en: '+{delta} · total {total}', he: '+{delta} · סה״כ {total}', es: '+{delta} · total {total}', fr: '+{delta} · total {total}', ru: '+{delta} · всего {total}', zh: '+{delta} · 合计 {total}', ja: '+{delta} · 合計 {total}', pt: '+{delta} · total {total}', de: '+{delta} · gesamt {total}', ko: '+{delta} · 합계 {total}' },
} as const

/** What one finished turn added to the session cost. */
type Delta = { at: number; delta: number; total: number }
type Meter = { usd: number; percent: number | null; deltas: Delta[] }

const meter = atom({ plugin: 'toolkitty', key: 'slot', id: 'cost-meter' } as const, null) as unknown as Atom<Meter | null>

export const feature: Feature = {
  id: 'cost-meter',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

/** Says how full the context window is: ok below 70, warn below 90, alert from 90. */
async function publishContext($: EngineInterface, percent: number | undefined): Promise<void> {
  if (percent === undefined) return
  const level: Level = percent >= 90 ? 'alert' : percent >= 70 ? 'warn' : 'ok'
  const rounded = Math.round(percent)
  await publish($, { id: 'cost-meter:context', feature: feature.id, kind: 'context', level, value: rounded, text: `context ${rounded}%` })
}

/** Usage moved (context fill): the signal follows it. The main module must call this on session.measure. */
export async function onMeasure($: EngineInterface, e: Input<'session.measure'>): Promise<void> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  const usage = await $.session.usage()
  await publishContext($, usage.context.percent)
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const usage = await $.session.usage()
  await publishContext($, usage.context.percent)
  const at = await $.clock.now()
  await update($, meter, prev => {
    const usd = usage.cost?.usd ?? 0
    const before = prev?.usd ?? 0
    const delta = usd >= before ? usd - before : usd
    return {
      usd,
      percent: usage.context.percent ?? null,
      deltas: [...(prev?.deltas ?? []), { at, delta, total: usd }].slice(-50),
    }
  })
}

/** What a press on the band line shows: cost and context now, and the last 10 turns' cost deltas. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const m = await read($, meter)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const rows = (m?.deltas ?? []).slice(-10).reverse()
  const money = (n: number): string => '$' + n.toFixed(2)
  return (
    <Box flexDirection="column">
      <Text>
        {`${t(T.cost)} ${money(m?.usd ?? 0)} · ${t(T.context)} ${m === null || m.percent === null ? '—' : `${Math.round(m.percent)}%`}`}
      </Text>
      {sectionTitle($, e, t(T.dHead))}
      {rows.length === 0 ? emptyState($, e, t(T.dNone), t(T.dNoneHint)) : null}
      {rows.map((d, i) =>
        listRow($, e, {
          key: `c${i}`,
          left: t(T.ago, { t: clockText(now - d.at) }),
          text: t(T.dRow, { delta: money(d.delta), total: money(d.total) }),
        }),
      )}
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const m = await read($, meter)
  if (m === null) return null

  const { Text } = $.ui.resolve(e)
  const percentColor = m.percent === null ? undefined : m.percent > 90 ? 'error' : m.percent > 70 ? 'warning' : undefined

  return (
    <Text dimColor size="footnote">
      {t(T.cost)} <Text mono>${m.usd.toFixed(2)}</Text>
      {' · '}
      {t(T.context)}{' '}
      {m.percent === null ? (
        '—'
      ) : (
        <Text mono color={percentColor}>
          {Math.round(m.percent)}%
        </Text>
      )}
    </Text>
  )
}

/** The short band form: cost and context fill; amber from 70%, red from 90%. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const m = await read($, meter)
  if (m === null) return null

  const level: Level = m.percent === null ? 'ok' : m.percent > 90 ? 'alert' : m.percent > 70 ? 'warn' : 'ok'
  const cost = m.usd >= 100 ? `$${Math.round(m.usd)}` : `$${m.usd.toFixed(2)}`
  return { text: m.percent === null ? cost : `${cost} · ${Math.round(m.percent)}%`, level, icon: ICONS.insight }
}
