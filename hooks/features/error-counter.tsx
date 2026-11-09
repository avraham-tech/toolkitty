import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import { clockText, isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { publish, retract, retractAll } from '../signals'
import { emptyState, ICONS, listRow, sectionTitle } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: { en: 'Failure counter', he: 'מונה כישלונות', es: 'Contador de fallos', fr: "Compteur d'échecs", ru: 'Счётчик сбоев', zh: '失败计数器', ja: '失敗カウンター', pt: 'Contador de falhas', de: 'Fehlerzähler', ko: '실패 카운터' },
  description: {
    en: 'A line above the input box when actions failed in the current turn, with a session summary.',
    he: 'פס מעל תיבת הכתיבה כשפעולות נכשלו בתור הנוכחי, עם סיכום הסשן.',
    es: 'Una línea sobre el cuadro de entrada cuando fallaron acciones en el turno actual, con el resumen de la sesión.',
    fr: "Une ligne au-dessus de la zone de saisie lorsque des actions ont échoué pendant le tour en cours, avec le total de la session.",
    ru: 'Строка над полем ввода, когда в текущем ходе были неудачные действия, с итогом по сессии.',
    zh: '本轮有操作失败时，在输入框上方显示一行，并附带会话汇总。',
    ja: '現在のターンで操作が失敗したとき、入力欄の上に 1 行表示し、セッションのまとめも添えます。',
    pt: 'Uma linha acima da caixa de entrada quando ações falham no turno atual, com um resumo da sessão.',
    de: 'Eine Zeile über dem Eingabefeld, wenn im aktuellen Durchgang Aktionen fehlgeschlagen sind, mit Session-Übersicht.',
    ko: '현재 턴에서 작업이 실패하면 입력창 위에 한 줄로 표시하며 세션 요약도 함께 보여줍니다.',
  },
  failedOne: {
    en: '⚠ 1 action failed this turn · {session} this session',
    he: '⚠ פעולה אחת נכשלה בתור הזה · {session} בסשן',
    es: '⚠ 1 acción falló en este turno · {session} en la sesión',
    fr: '⚠ 1 action a échoué ce tour · {session} dans la session',
    ru: '⚠ 1 действие не удалось в этом ходе · {session} за сессию',
    zh: '⚠ 本轮 1 个操作失败 · 本会话共 {session}',
    ja: '⚠ このターンで 1 件の操作が失敗 · このセッション計 {session}',
    pt: '⚠ 1 ação falhou neste turno · {session} nesta sessão',
    de: '⚠ 1 Aktion in diesem Durchgang fehlgeschlagen · {session} in dieser Session',
    ko: '⚠ 이번 턴에 작업 1건 실패 · 이번 세션 {session}건',
  },
  failedMany: {
    en: '⚠ {n} actions failed this turn · {session} this session',
    he: '⚠ {n} פעולות נכשלו בתור הזה · {session} בסשן',
    es: '⚠ {n} acciones fallaron en este turno · {session} en la sesión',
    fr: '⚠ {n} actions ont échoué ce tour · {session} dans la session',
    ru: '⚠ Неудачных действий в этом ходе: {n} · {session} за сессию',
    zh: '⚠ 本轮 {n} 个操作失败 · 本会话共 {session}',
    ja: '⚠ このターンで {n} 件の操作が失敗 · このセッション計 {session}',
    pt: '⚠ {n} ações falharam neste turno · {session} nesta sessão',
    de: '⚠ {n} Aktionen in diesem Durchgang fehlgeschlagen · {session} in dieser Session',
    ko: '⚠ 이번 턴에 작업 {n}건 실패 · 이번 세션 {session}건',
  },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dHead: {
    en: 'Failed actions this session: {n} (newest first)',
    he: 'פעולות שנכשלו בסשן: {n} (החדשות ראשונות)',
    es: 'Acciones fallidas en esta sesión: {n} (las más recientes primero)',
    fr: 'Actions échouées dans cette session : {n} (les plus récentes d\'abord)',
    ru: 'Неудачные действия за сессию: {n} (сначала новые)',
    zh: '本会话失败的操作：{n}（最新的在前）',
    ja: 'このセッションの失敗した操作：{n} 件（新しい順）',
    pt: 'Ações com falha nesta sessão: {n} (mais recentes primeiro)',
    de: 'Fehlgeschlagene Aktionen in dieser Session: {n} (neueste zuerst)',
    ko: '이번 세션의 실패한 작업: {n}건 (최신순)',
  },
  chip: { en: '{n} failed · {session}', he: '{n} נכשלו · {session}', es: '{n} fallos · {session}', fr: '{n} échecs · {session}', ru: 'сбоев {n} · {session}', zh: '{n} 个失败 · {session}', ja: '{n} 件失敗 · {session}', pt: '{n} falhas · {session}', de: '{n} fehlgeschlagen · {session}', ko: '{n}건 실패 · {session}' },
  dNoneHint: { en: 'A tool call that ends in an error is listed here with its time and message.', he: 'קריאת כלי שמסתיימת בשגיאה תופיע כאן עם הזמן וההודעה שלה.', es: 'Una llamada a una herramienta que termina en error aparece aquí con su hora y mensaje.', fr: 'Un appel d\'outil qui se termine en erreur est listé ici avec son heure et son message.', ru: 'Вызов инструмента, завершившийся ошибкой, появится здесь со временем и сообщением.', zh: '以错误结束的工具调用会在这里列出，并附带时间和消息。', ja: 'エラーで終わったツール呼び出しは、時刻とメッセージ付きでここに一覧表示されます。', pt: 'Uma chamada de ferramenta que termina em erro é listada aqui com o horário e a mensagem.', de: 'Ein Tool-Aufruf, der mit einem Fehler endet, wird hier mit Zeit und Meldung aufgelistet.', ko: '오류로 끝난 도구 호출은 시간과 메시지와 함께 여기에 표시됩니다.' },
  dNone: {
    en: 'No action has failed this session.',
    he: 'שום פעולה לא נכשלה בסשן הזה.',
    es: 'Ninguna acción ha fallado en esta sesión.',
    fr: 'Aucune action n\'a échoué dans cette session.',
    ru: 'В этой сессии не было неудачных действий.',
    zh: '本会话没有失败的操作。',
    ja: 'このセッションで失敗した操作はありません。',
    pt: 'Nenhuma ação falhou nesta sessão.',
    de: 'In dieser Session ist keine Aktion fehlgeschlagen.',
    ko: '이번 세션에는 실패한 작업이 없습니다.',
  },
  dNoText: { en: '(no error text)', he: '(אין טקסט שגיאה)', es: '(sin texto de error)', fr: '(pas de texte d\'erreur)', ru: '(нет текста ошибки)', zh: '（无错误文本）', ja: '（エラーテキストなし）', pt: '(sem texto de erro)', de: '(kein Fehlertext)', ko: '(오류 텍스트 없음)' },
} as const

type Failure = { at: number; tool: string; msg: string }
type Errors = { turn: number; session: number; log: Failure[] }

const errors = atom({ plugin: 'toolkitty', key: 'slot', id: 'error-counter' } as const, {
  turn: 0,
  session: 0,
  log: [],
} as Errors) as unknown as Atom<Errors>

export const feature: Feature = {
  id: 'error-counter',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }
  await update($, errors, c => ({ ...c, turn: 0 }))
  await retract($, 'error-counter:turn')
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result

  if (result.deny === undefined && result.isError === true) {
    const raw = result.text ?? (e.tool === 'Bash' ? e.command : '')
    const fail: Failure = { at: await $.clock.now(), tool: e.tool, msg: raw.replace(/\s+/g, ' ').trim().slice(0, 100) }
    await update($, errors, c => ({ turn: c.turn + 1, session: c.session + 1, log: [...(c.log ?? []), fail].slice(-50) }))
    const failed = (await read($, errors)).turn
    await publish($, {
      id: 'error-counter:turn',
      feature: feature.id,
      kind: 'failure',
      level: failed >= 3 ? 'alert' : 'warn',
      value: failed,
      text: failed === 1 ? '1 failure this turn' : `${failed} failures this turn`,
    })
  }
  return result
}

/** What a press on the band line shows: the failed actions of this session, newest first. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const c = await read($, errors)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const rows = (c.log ?? []).slice(-14).reverse()
  return (
    <Box flexDirection="column">
      {sectionTitle($, e, t(T.dHead, { n: c.session }))}
      {rows.length === 0 ? emptyState($, e, t(T.dNone), t(T.dNoneHint)) : null}
      {rows.map((f, i) =>
        listRow($, e, {
          key: `f${i}`,
          left: t(T.ago, { t: clockText(now - f.at) }),
          text: `${f.tool} · ${f.msg === '' ? t(T.dNoText) : f.msg}`,
        }),
      )}
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, errors)
  if (c.turn === 0) return null

  const { Text } = $.ui.resolve(e)
  const line = c.turn === 1 ? t(T.failedOne, { session: c.session }) : t(T.failedMany, { n: c.turn, session: c.session })
  return (
    <Text color="warning" size="footnote">
      {line}
    </Text>
  )
}

/** The short band form: failures this turn and this session; quiet when this turn had none. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const c = await read($, errors)
  if (c.turn === 0) return null

  return { text: t(T.chip, { n: c.turn, session: c.session }), level: 'alert', icon: ICONS.alert }
}
