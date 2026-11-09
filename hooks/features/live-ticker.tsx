import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Timer } from 'claude-code'

import { clockText, isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { publish, retract, retractAll } from '../signals'
import { ICONS, emptyState } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: {
    en: 'Live ticker',
    he: 'שורת פעולה חיה',
    es: 'Indicador en vivo',
    fr: 'Indicateur en direct',
    ru: 'Живая строка',
    zh: '实时状态条',
    ja: 'ライブティッカー',
    pt: 'Ticker ao vivo',
    de: 'Live-Ticker',
    ko: '실시간 티커',
  },
  description: {
    en: 'One live line above the prompt with what Claude is doing right now, and for how long.',
    he: 'שורה חיה אחת מעל תיבת הכתיבה על מה ש-Claude עושה כרגע ולכמה זמן.',
    es: 'Una línea en vivo sobre el cuadro de texto con lo que Claude está haciendo ahora y desde hace cuánto.',
    fr: "Une ligne en direct au-dessus de la zone de saisie : ce que Claude fait en ce moment, et depuis combien de temps.",
    ru: 'Живая строка над полем ввода: что Claude делает прямо сейчас и как долго.',
    zh: '提示框上方的一行实时信息，显示 Claude 正在做什么以及已持续多久。',
    ja: 'プロンプトの上に 1 行で、Claude が今していることと経過時間を表示します。',
    pt: 'Uma linha ao vivo acima do prompt com o que o Claude está fazendo agora e há quanto tempo.',
    de: 'Eine Live-Zeile über dem Prompt, was Claude gerade tut und wie lange schon.',
    ko: '프롬프트 위에 Claude가 지금 무엇을 하는지와 얼마나 걸렸는지를 한 줄로 보여줍니다.',
  },
  thinking: { en: 'thinking…', he: 'חושב…', es: 'pensando…', fr: 'réflexion…', ru: 'думает…', zh: '思考中…', ja: '考え中…', pt: 'pensando…', de: 'denkt nach…', ko: '생각 중…' },
  reading: { en: 'reading {path}', he: 'קורא {path}', es: 'leyendo {path}', fr: 'lecture de {path}', ru: 'читает {path}', zh: '正在读取 {path}', ja: '{path} を読み取り中', pt: 'lendo {path}', de: 'liest {path}', ko: '{path} 읽는 중' },
  editing: { en: 'editing {path}', he: 'עורך {path}', es: 'editando {path}', fr: 'modification de {path}', ru: 'правит {path}', zh: '正在编辑 {path}', ja: '{path} を編集中', pt: 'editando {path}', de: 'bearbeitet {path}', ko: '{path} 편집 중' },
  writing: { en: 'writing {path}', he: 'כותב {path}', es: 'escribiendo {path}', fr: 'écriture de {path}', ru: 'пишет {path}', zh: '正在写入 {path}', ja: '{path} を書き込み中', pt: 'escrevendo {path}', de: 'schreibt {path}', ko: '{path} 쓰는 중' },
  searching: { en: "searching '{text}'", he: "מחפש '{text}'", es: "buscando '{text}'", fr: "recherche de « {text} »", ru: "ищет '{text}'", zh: '正在搜索“{text}”', ja: '「{text}」を検索中', pt: 'buscando \'{text}\'', de: 'sucht \'{text}\'', ko: '\'{text}\' 검색 중' },
  finding: { en: 'finding {text}', he: 'מאתר {text}', es: 'localizando {text}', fr: 'recherche de fichiers {text}', ru: 'ищет файлы {text}', zh: '正在查找 {text}', ja: '{text} を探索中', pt: 'procurando {text}', de: 'sucht nach {text}', ko: '{text} 찾는 중' },
  running: { en: 'running: {text}', he: 'מריץ: {text}', es: 'ejecutando: {text}', fr: 'exécution : {text}', ru: 'выполняет: {text}', zh: '正在运行：{text}', ja: '実行中：{text}', pt: 'executando: {text}', de: 'führt aus: {text}', ko: '실행 중: {text}' },
  fetching: { en: 'fetching {text}', he: 'מביא {text}', es: 'descargando {text}', fr: 'récupération de {text}', ru: 'загружает {text}', zh: '正在获取 {text}', ja: '{text} を取得中', pt: 'baixando {text}', de: 'ruft {text} ab', ko: '{text} 가져오는 중' },
  webSearch: { en: "searching the web '{text}'", he: "מחפש ברשת '{text}'", es: "buscando en la web '{text}'", fr: "recherche web « {text} »", ru: "ищет в сети '{text}'", zh: '正在网上搜索“{text}”', ja: 'ウェブで「{text}」を検索中', pt: 'pesquisando na web \'{text}\'', de: 'sucht im Web \'{text}\'', ko: '웹에서 \'{text}\' 검색 중' },
  agent: { en: 'agent: {text}', he: 'סוכן: {text}', es: 'agente: {text}', fr: 'agent : {text}', ru: 'агент: {text}', zh: '代理：{text}', ja: 'エージェント：{text}', pt: 'agente: {text}', de: 'Agent: {text}', ko: '에이전트: {text}' },
  other: { en: 'using {text}', he: 'משתמש ב-{text}', es: 'usando {text}', fr: 'utilisation de {text}', ru: 'использует {text}', zh: '正在使用 {text}', ja: '{text} を使用中', pt: 'usando {text}', de: 'verwendet {text}', ko: '{text} 사용 중' },
  ago: { en: '{t} ago', he: 'לפני {t}', es: 'hace {t}', fr: 'il y a {t}', ru: '{t} назад', zh: '{t}前', ja: '{t}前', pt: 'há {t}', de: 'vor {t}', ko: '{t} 전' },
  dHead: { en: 'Last actions (newest first)', he: 'הפעולות האחרונות (החדשות ראשונות)', es: 'Últimas acciones (las más recientes primero)', fr: 'Dernières actions (les plus récentes d\'abord)', ru: 'Последние действия (сначала новые)', zh: '最近的操作（最新的在前）', ja: '直近の操作（新しい順）', pt: 'Últimas ações (mais recentes primeiro)', de: 'Letzte Aktionen (neueste zuerst)', ko: '최근 작업(최신순)' },
  dNoneHint: { en: 'Finished actions appear here while Claude works.', he: 'פעולות שהסתיימו יופיעו כאן בזמן ש-Claude עובד.', es: 'Las acciones terminadas aparecerán aquí mientras Claude trabaja.', fr: 'Les actions terminées apparaîtront ici pendant que Claude travaille.', ru: 'Завершённые действия появятся здесь, пока Claude работает.', zh: 'Claude 工作时，已完成的操作会显示在这里。', ja: 'Claude の作業中、完了した操作がここに表示されます。', pt: 'As ações concluídas aparecem aqui enquanto o Claude trabalha.', de: 'Abgeschlossene Aktionen erscheinen hier, während Claude arbeitet.', ko: 'Claude가 작업하는 동안 완료된 작업이 여기에 표시됩니다.' },
  dNone: { en: 'No action has finished yet.', he: 'עדיין לא הסתיימה אף פעולה.', es: 'Aún no ha terminado ninguna acción.', fr: 'Aucune action n\'est encore terminée.', ru: 'Ни одно действие ещё не завершено.', zh: '还没有完成任何操作。', ja: '完了した操作はまだありません。', pt: 'Nenhuma ação foi concluída ainda.', de: 'Noch keine Aktion abgeschlossen.', ko: '아직 완료된 작업이 없습니다.' },
  dNow: { en: 'Now: {text}', he: 'עכשיו: {text}', es: 'Ahora: {text}', fr: 'Maintenant : {text}', ru: 'Сейчас: {text}', zh: '当前：{text}', ja: '現在：{text}', pt: 'Agora: {text}', de: 'Jetzt: {text}', ko: '지금: {text}' },
  dFailed: { en: 'failed', he: 'נכשלה', es: 'falló', fr: 'échec', ru: 'сбой', zh: '失败', ja: '失敗', pt: 'falhou', de: 'fehlgeschlagen', ko: '실패' },
} as const

type Tick = { text: string; startedAt: number; now: number; isAction: boolean }
/** A finished action: what it was, when it ended, how long it took, whether it failed. */
type Done = { text: string; at: number; ms: number; failed: boolean }
type Ticker = { cur: Tick | null; log: Done[] }

const tick = atom({ plugin: 'toolkitty', key: 'slot', id: 'live-ticker' } as const, { cur: null, log: [] } as Ticker) as unknown as Atom<Ticker>

export const feature: Feature = {
  id: 'live-ticker',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

let ticker: Timer | undefined

const field = (e: unknown, key: string): string => {
  const value = (e as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

/** The last two path segments: src/a.ts. */
const shortPath = (path: string): string => path.split(/[\\/]/).filter(s => s !== '').slice(-2).join('/')

const clip = (text: string, max: number): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const hostOf = (url: string): string => url.replace(/^[a-z]+:\/\//i, '').split('/')[0] ?? url

const describe = (e: ToolCallInput): string => {
  const tool = e.tool
  switch (tool) {
    case 'Read':
      return t(T.reading, { path: shortPath(field(e, 'file_path')) })
    case 'Edit':
    case 'NotebookEdit':
      return t(T.editing, { path: shortPath(field(e, 'file_path') || field(e, 'notebook_path')) })
    case 'Write':
      return t(T.writing, { path: shortPath(field(e, 'file_path')) })
    case 'Grep':
      return t(T.searching, { text: clip(field(e, 'pattern'), 40) })
    case 'Glob':
      return t(T.finding, { text: clip(field(e, 'pattern'), 40) })
    case 'Bash':
    case 'PowerShell':
      return t(T.running, { text: clip(field(e, 'command'), 60) })
    case 'WebFetch':
      return t(T.fetching, { text: clip(hostOf(field(e, 'url')), 40) })
    case 'WebSearch':
      return t(T.webSearch, { text: clip(field(e, 'query'), 40) })
    case 'Agent':
      return t(T.agent, { text: clip(field(e, 'description'), 50) })
    default: {
      const short = tool.startsWith('mcp__') ? (tool.split('__').pop() ?? tool) : tool
      return t(T.other, { text: short })
    }
  }
}

/** Says what Claude is doing right now (the action's text) and for how many seconds. */
async function publishWorking($: EngineInterface, text: string, startedAt: number, now: number): Promise<void> {
  await publish($, { id: 'live-ticker:working', feature: feature.id, kind: 'working', level: 'ok', value: Math.max(0, Math.floor((now - startedAt) / 1000)), text })
}

async function startTicker($: EngineInterface): Promise<void> {
  ticker?.cancel()
  // One state write a second: only the band that reads the slot redraws.
  ticker = $.clock.every(1000, async () => {
    if (!(await isOn($, feature))) {
      await retractAll($, feature.id)
      return
    }
    const now = await $.clock.now()
    await update($, tick, p => (p.cur === null ? p : { ...p, cur: { ...p.cur, now } }))
    const cur = (await read($, tick)).cur
    if (cur !== null) await publishWorking($, cur.text, cur.startedAt, now)
  })
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined) return
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return
  }

  const now = await $.clock.now()
  await update($, tick, p => ({ ...p, cur: { text: t(T.thinking), startedAt: now, now, isAction: false } }))
  await publishWorking($, 'thinking', now, now)
  await startTicker($)
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.agentId !== undefined) return undefined
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return undefined
  }

  const now = await $.clock.now()
  const text = describe(e)
  await update($, tick, p => ({ ...p, cur: { text, startedAt: now, now, isAction: true } }))
  await publishWorking($, text, now, now)
  if (ticker === undefined) await startTicker($)
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result

  await retract($, 'live-ticker:working')
  const at = await $.clock.now()
  const failed = result.deny === undefined && result.isError === true
  await update($, tick, p => ({
    cur: null,
    log:
      p.cur !== null && p.cur.isAction
        ? [...(p.log ?? []), { text: p.cur.text, at, ms: Math.max(0, at - p.cur.startedAt), failed }].slice(-50)
        : (p.log ?? []),
  }))
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return

  ticker?.cancel()
  ticker = undefined
  await update($, tick, p => ({ ...p, cur: null }))
  await retractAll($, feature.id)
}

/** What a press on the band line shows: the current action and the last 10 finished ones, with durations. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, tick)
  const now = await $.clock.now()
  const { Box, Text } = $.ui.resolve(e)
  const rows = (s.log ?? []).slice(-10).reverse()
  return (
    <Box flexDirection="column">
      {s.cur !== null ? <Text color="success">{t(T.dNow, { text: s.cur.text })}</Text> : null}
      <Text bold>{t(T.dHead)}</Text>
      {rows.length === 0 ? emptyState($, e, t(T.dNone), t(T.dNoneHint)) : null}
      {rows.map((d, i) => (
        <Text key={`a${i}`}>
          {`${t(T.ago, { t: clockText(now - d.at) })} · ${d.text} · ${(d.ms / 1000).toFixed(1)}s${d.failed ? ` · ${t(T.dFailed)}` : ''}`}
        </Text>
      ))}
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = (await read($, tick)).cur
  if (p === null) return null

  const seconds = Math.floor(Math.max(0, p.now - p.startedAt) / 1000)
  const { Text } = $.ui.resolve(e)

  return (
    <Text dimColor size="footnote">
      {'▶ '}
      {p.text}
      {p.isAction && seconds >= 2 ? ` · ${seconds}s` : ''}
    </Text>
  )
}

/** The short band form: the action and, once it runs long, its seconds. Null when idle. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = (await read($, tick)).cur
  if (p === null) return null

  const seconds = Math.floor(Math.max(0, p.now - p.startedAt) / 1000)
  const label = clip(p.text.replace(/^[a-z]+: /i, ''), 12)
  return { text: `▶ ${label}${p.isAction && seconds >= 2 ? ` ${seconds}s` : ''}`, level: 'info', icon: ICONS.visibility }
}
