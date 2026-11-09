import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On } from 'claude-code'

import { isOn, notice, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import type { Savings } from '../shared'
import { publish, retract, retractAll } from '../signals'
import { ICONS } from '../ui'
import type { Chip } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした：{reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: { en: 'Duplicate read detector', he: 'זיהוי קריאות כפולות', es: 'Detector de lecturas duplicadas', fr: 'Détecteur de lectures en double', ru: 'Детектор повторных чтений', zh: '重复读取检测', ja: '重複読み取り検出', pt: 'Detector de leituras duplicadas', de: 'Erkennung doppelter Lesevorgänge', ko: '중복 읽기 감지' },
  description: {
    en: 'Spots wasted context: files read again unchanged and commands repeated needlessly. /waste lists the top offenders.',
    he: 'מזהה בזבוז הקשר: קבצים שנקראו שוב ללא שינוי ופקודות שחזרו שלא לצורך. /waste מציג את הגרועים ביותר.',
    es: 'Detecta contexto desperdiciado: archivos releídos sin cambios y comandos repetidos sin necesidad. /waste muestra los principales casos.',
    fr: "Repère le contexte gaspillé : fichiers relus sans changement et commandes répétées inutilement. /waste liste les principaux cas.",
    ru: 'Находит впустую потраченный контекст: файлы, прочитанные повторно без изменений, и лишние повторы команд. /waste показывает главные случаи.',
    zh: '找出被浪费的上下文：未改动却被重复读取的文件，以及被不必要重复的命令。/waste 列出最严重的几项。',
    ja: '無駄なコンテキストを見つけます：変更なしで再度読まれたファイルと、不必要に繰り返されたコマンド。/waste で上位を一覧表示します。',
    pt: 'Detecta contexto desperdiçado: arquivos relidos sem mudanças e comandos repetidos sem necessidade. /waste lista os maiores ofensores.',
    de: 'Erkennt verschwendeten Kontext: unverändert erneut gelesene Dateien und unnötig wiederholte Befehle. /waste listet die größten Verursacher auf.',
    ko: '낭비되는 컨텍스트를 찾아냅니다: 변경 없이 다시 읽은 파일과 불필요하게 반복된 명령. /waste가 상위 항목을 나열합니다.',
  },
  off: { en: 'The feature is off; turn it on in the /toolkitty pane', he: 'השכלול כבוי; הפעל אותו בלוח /toolkitty', es: 'La función está desactivada; actívala en el panel /toolkitty', fr: 'La fonctionnalité est désactivée ; active-la dans le panneau /toolkitty', ru: 'Функция отключена; включите её в панели /toolkitty', zh: '该功能已关闭；请在 /toolkitty 面板中开启', ja: 'この機能はオフです。/toolkitty ペインでオンにしてください', pt: 'O recurso está desativado; ative-o no painel /toolkitty', de: 'Die Funktion ist aus; aktiviere sie im Panel /toolkitty', ko: '이 기능이 꺼져 있습니다. /toolkitty 창에서 켜세요' },
  commandDesc: { en: 'Shows the files and commands that wasted the most context', he: 'מציג את הקבצים והפקודות שבזבזו הכי הרבה הקשר', es: 'Muestra los archivos y comandos que más contexto desperdiciaron', fr: 'Affiche les fichiers et commandes qui ont gaspillé le plus de contexte', ru: 'Показывает файлы и команды, впустую занявшие больше всего контекста', zh: '显示浪费上下文最多的文件和命令', ja: '最もコンテキストを無駄にしたファイルとコマンドを表示します', pt: 'Mostra os arquivos e comandos que mais desperdiçaram contexto', de: 'Zeigt die Dateien und Befehle, die am meisten Kontext verschwendet haben', ko: '컨텍스트를 가장 많이 낭비한 파일과 명령을 보여 줍니다' },
  chipReads: { en: '{n} dup reads', he: '{n} קריאות כפולות', es: '{n} lect. dup.', fr: '{n} lect. doubles', ru: 'повт. чтений: {n}', zh: '{n} 次重复读取', ja: '重複読み取り {n}', pt: '{n} releit.', de: '{n} doppelt', ko: '중복 읽기 {n}' },
  chipCmds: { en: '{n} dup cmds', he: '{n} פקודות חוזרות', es: '{n} cmd. rep.', fr: '{n} cmd. répétées', ru: 'повт. команд: {n}', zh: '{n} 次重复命令', ja: '重複コマンド {n}', pt: '{n} cmd rep.', de: '{n} Wdh.-Bef.', ko: '중복 명령 {n}' },
  readOne: { en: '{n} duplicate read', he: '{n} קריאה כפולה', es: '{n} lectura duplicada', fr: '{n} lecture en double', ru: 'повторных чтений: {n}', zh: '{n} 次重复读取', ja: '重複読み取り {n} 回', pt: '{n} leitura duplicada', de: '{n} doppelter Lesevorgang', ko: '중복 읽기 {n}회' },
  readMany: { en: '{n} duplicate reads', he: '{n} קריאות כפולות', es: '{n} lecturas duplicadas', fr: '{n} lectures en double', ru: 'повторных чтений: {n}', zh: '{n} 次重复读取', ja: '重複読み取り {n} 回', pt: '{n} leituras duplicadas', de: '{n} doppelte Lesevorgänge', ko: '중복 읽기 {n}회' },
  cmdOne: { en: '{n} repeated command', he: '{n} פקודה חוזרת', es: '{n} comando repetido', fr: '{n} commande répétée', ru: 'повторов команд: {n}', zh: '{n} 个重复命令', ja: '繰り返しコマンド {n} 件', pt: '{n} comando repetido', de: '{n} wiederholter Befehl', ko: '반복된 명령 {n}개' },
  cmdMany: { en: '{n} repeated commands', he: '{n} פקודות חוזרות', es: '{n} comandos repetidos', fr: '{n} commandes répétées', ru: 'повторов команд: {n}', zh: '{n} 个重复命令', ja: '繰り返しコマンド {n} 件', pt: '{n} comandos repetidos', de: '{n} wiederholte Befehle', ko: '반복된 명령 {n}개' },
  none: { en: 'No wasted context so far.', he: 'עדיין אין בזבוז הקשר.', es: 'Aún no hay contexto desperdiciado.', fr: "Aucun contexte gaspillé pour l'instant.", ru: 'Пока контекст не тратился впустую.', zh: '目前没有浪费上下文。', ja: 'これまでに無駄なコンテキストはありません。', pt: 'Nenhum contexto desperdiçado até agora.', de: 'Bisher kein verschwendeter Kontext.', ko: '지금까지 낭비된 컨텍스트가 없습니다.' },
  headReads: { en: 'Files read again unchanged:', he: 'קבצים שנקראו שוב ללא שינוי:', es: 'Archivos releídos sin cambios:', fr: 'Fichiers relus sans changement :', ru: 'Файлы, прочитанные повторно без изменений:', zh: '未改动却被重复读取的文件：', ja: '変更なしで再度読まれたファイル：', pt: 'Arquivos relidos sem mudanças:', de: 'Unverändert erneut gelesene Dateien:', ko: '변경 없이 다시 읽은 파일:' },
  headCmds: { en: 'Commands repeated:', he: 'פקודות שחזרו:', es: 'Comandos repetidos:', fr: 'Commandes répétées :', ru: 'Повторённые команды:', zh: '重复的命令：', ja: '繰り返されたコマンド：', pt: 'Comandos repetidos:', de: 'Wiederholte Befehle:', ko: '반복된 명령:' },
} as const

type CmdCount = { cmd: string; n: number }
/** One place the context was spent twice: what, how many tokens (chars / 4), and which file or command. */
type Leak = { kind: 'dup-read' | 'repeat-cmd'; tokens: number; detail: string }
type State = {
  /** read key (path + range) → signature (mtime, or a content hash) at its last read */
  seen: Record<string, string>
  /** every main-loop tool call so far */
  calls: number
  /** command hash → the call number it last ran at */
  lastCmd: Record<string, number>
  /** path → how many duplicate reads */
  dupReads: Record<string, number>
  /** command hash → the command and how many repeats */
  dupCmds: Record<string, CmdCount>
  /** tool_use_id of a duplicate Read → its path, until afterToolCall adds the note */
  pending: Record<string, string>
  /** tool_use_id of a repeated Bash command → its command hash, until afterToolCall measures the output */
  pendingCmd: Record<string, string>
  /** the newest duplicate reads and repeated commands with their token estimate (the savings slot's `leaks` holds the sums) */
  leaks: Leak[]
}

const empty = (): State => ({ seen: {}, calls: 0, lastCmd: {}, dupReads: {}, dupCmds: {}, pending: {}, pendingCmd: {}, leaks: [] })

const state = atom({ plugin: 'toolkitty', key: 'slot', id: 'dup-read-detector' } as const, empty()) as unknown as Atom<State>

const savings = atom({ plugin: 'toolkitty', key: 'slot', id: 'savings' } as const, { tokens: 0, usd: 0, byFeature: {}, leaks: {} } as Savings) as unknown as Atom<Savings>

const WINDOW = 10
const MAX_KEYS = 400
const MAX_LEAKS = 100
const HASH_BYTES = 64 * 1024
const NATURAL_START = /^\s*(git\s+(status|diff)\b|ls\b|pwd\b)/
const NATURAL_ANYWHERE = /test|build|lint|tsc|pytest|npm run/i

export const feature: Feature = {
  id: 'dup-read-detector',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

const hashOf = (text: string): string => {
  let acc = 5381
  for (let i = 0; i < text.length; i++) acc = ((acc * 33) ^ text.charCodeAt(i)) >>> 0
  return `${acc.toString(36)}.${text.length}`
}

/** Keeps the newest `MAX_KEYS` entries of a record (insertion order). */
function capRecord<V>(rec: Record<string, V>): Record<string, V> {
  const keys = Object.keys(rec)
  if (keys.length <= MAX_KEYS) return rec
  const out: Record<string, V> = {}
  for (const k of keys.slice(keys.length - MAX_KEYS)) out[k] = rec[k] as V
  return out
}

const total = (rec: Record<string, number>): number => Object.values(rec).reduce((a, b) => a + b, 0)

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Adds one leak to the atom's list and its tokens to the savings slot's `leaks` (hypothetical: not part of `tokens`). */
async function recordLeak($: EngineInterface, leak: Leak): Promise<void> {
  await update($, state, s => ({ ...s, leaks: [...(s.leaks ?? []), leak].slice(-MAX_LEAKS) }))
  await update($, savings, s => ({ ...s, leaks: { ...(s.leaks ?? {}), [leak.kind]: (s.leaks?.[leak.kind] ?? 0) + leak.tokens } }))
}

/** The file's signature now: its mtime, or a hash of its first 64 KB when stat gives none. */
async function signatureOf($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    const st = await $.fs.stat(path)
    if (typeof st.mtimeMs === 'number' && st.mtimeMs > 0) return `m${st.mtimeMs}:${st.size}`
  } catch {
    // fall through to the content hash
  }
  try {
    const text = await $.fs.read(path)
    return `h${hashOf(text.slice(0, HASH_BYTES))}`
  } catch {
    return undefined
  }
}

/** Tells the signals bus how much was read or run twice for nothing: duplicate reads plus repeated commands (none retracts). */
async function publishWaste($: EngineInterface): Promise<void> {
  const s = await read($, state)
  const reads = total(s.dupReads)
  const cmds = Object.values(s.dupCmds).reduce((a, b) => a + b.n, 0)
  const n = reads + cmds
  if (n === 0) {
    await retract($, 'dup-read-detector:waste')
    return
  }
  await publish($, { id: 'dup-read-detector:waste', feature: feature.id, kind: 'waste', level: 'info', value: n, text: n === 1 ? '1 repeat' : `${n} repeats` })
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'waste', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'waste', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  await update($, state, () => empty())
  await retractAll($, feature.id)
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) {
    await retractAll($, feature.id)
    return undefined
  }
  if (e.agentId !== undefined) return undefined

  if (e.tool === 'Read') {
    const path = e.file_path
    const key = `${path}|${e.offset ?? ''}|${e.limit ?? ''}|${e.pages ?? ''}`
    const sig = await signatureOf($, path)
    const id = e.tool_use_id
    const wasDup = sig !== undefined && (await read($, state)).seen[key] === sig
    await update($, state, s => {
      const calls = s.calls + 1
      if (sig === undefined) return { ...s, calls }
      const isDup = s.seen[key] === sig
      const seen = capRecord({ ...s.seen, [key]: sig })
      if (!isDup) return { ...s, calls, seen }
      return {
        ...s,
        calls,
        seen,
        dupReads: capRecord({ ...s.dupReads, [path]: (s.dupReads[path] ?? 0) + 1 }),
        pending: id === undefined ? s.pending : capRecord({ ...s.pending, [id]: path }),
      }
    })
    await publishWaste($)
    if (wasDup) {
      // flagged only: the model may still re-read, so this stays out of `tokens`
      const size = /^m[^:]*:(\d+)$/.exec(sig ?? '')
      const flagged = size !== null && Number(size[1]) > 0 ? Math.ceil(Number(size[1]) / 4) : 2000
      await update($, savings, s => ({
        ...s,
        byFeature: { ...s.byFeature, 'dup-read-detector': (s.byFeature['dup-read-detector'] ?? 0) + flagged },
      }))
      await recordLeak($, { kind: 'dup-read', tokens: flagged, detail: clip(path, 120) })
    }
    return undefined
  }

  if (e.tool === 'Bash') {
    const cmd = e.command.trim().replace(/\s+/g, ' ')
    const natural = cmd === '' || NATURAL_START.test(cmd) || NATURAL_ANYWHERE.test(cmd)
    const hash = hashOf(cmd)
    const useId = e.tool_use_id
    await update($, state, s => {
      const calls = s.calls + 1
      if (natural) return { ...s, calls }
      const last = s.lastCmd[hash]
      const lastCmd = capRecord({ ...s.lastCmd, [hash]: calls })
      if (last === undefined || calls - last > WINDOW) return { ...s, calls, lastCmd }
      const prev = s.dupCmds[hash]
      return {
        ...s,
        calls,
        lastCmd,
        dupCmds: capRecord({ ...s.dupCmds, [hash]: { cmd: clip(cmd, 200), n: (prev?.n ?? 0) + 1 } }),
        pendingCmd: useId === undefined ? s.pendingCmd : capRecord({ ...(s.pendingCmd ?? {}), [useId]: hash }),
      }
    })
    await publishWaste($)
    return undefined
  }

  await update($, state, s => ({ ...s, calls: s.calls + 1 }))
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (!(await isOn($, feature))) return result
  if (e.agentId !== undefined) return result

  if (e.tool === 'Bash') {
    const useId = e.tool_use_id
    if (useId === undefined || result.deny !== undefined) return result
    const cur = await read($, state)
    const hash = cur.pendingCmd?.[useId]
    if (hash === undefined) return result
    await update($, state, s => {
      const { [useId]: _gone, ...rest } = s.pendingCmd ?? {}
      return { ...s, pendingCmd: rest }
    })
    const out = result.result as unknown
    const size =
      typeof result.text === 'string'
        ? result.text.length
        : typeof out === 'string'
          ? out.length
          : out !== null && typeof out === 'object'
            ? ['stdout', 'stderr'].reduce((n, k) => n + String((out as Record<string, unknown>)[k] ?? '').length, 0)
            : 0
    const tokens = Math.ceil(size / 4)
    if (tokens > 0) await recordLeak($, { kind: 'repeat-cmd', tokens, detail: clip(cur.dupCmds[hash]?.cmd ?? '', 120) })
    return result
  }

  if (e.tool !== 'Read') return result
  if (result.deny !== undefined || result.isError) return result

  const id = e.tool_use_id
  if (id === undefined) return result
  const s = await read($, state)
  const path = s.pending[id]
  if (path === undefined) return result

  await update($, state, cur => {
    const { [id]: _gone, ...rest } = cur.pending
    return { ...cur, pending: rest }
  })

  const note = `Toolkitty note: ${path} is unchanged since it was last read in this session, so it did not need to be read again. Rely on the earlier contents instead of re-reading it.`
  return { ...result, context: [...(result.context ?? []), note] }
}

/** The short band form: "3 dup reads" (plus repeated commands). Quiet until a duplicate shows up. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, state)
  const reads = total(s.dupReads)
  const cmds = Object.values(s.dupCmds).reduce((a, b) => a + b.n, 0)
  if (reads === 0 && cmds === 0) return null

  const parts: string[] = []
  if (reads > 0) parts.push(t(T.chipReads, { n: reads }))
  if (cmds > 0) parts.push(t(T.chipCmds, { n: cmds }))
  return { text: parts.join(' · '), level: 'info', icon: ICONS.hygiene }
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const s = await read($, state)
  const reads = total(s.dupReads)
  const cmds = Object.values(s.dupCmds).reduce((a, b) => a + b.n, 0)
  if (reads === 0 && cmds === 0) return null

  const parts: string[] = []
  if (reads > 0) parts.push(t(reads === 1 ? T.readOne : T.readMany, { n: reads }))
  if (cmds > 0) parts.push(t(cmds === 1 ? T.cmdOne : T.cmdMany, { n: cmds }))

  const { Text } = $.ui.resolve(e)
  return <Text dimColor size="footnote">♻ {parts.join(' · ')}</Text>
}

/** What a press on the band line shows: the duplicate paths and repeated commands, most repeated first. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const s = await read($, state)
  const reads = Object.entries(s.dupReads).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const cmds = Object.values(s.dupCmds).sort((a, b) => b.n - a.n).slice(0, 5)
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {reads.length === 0 && cmds.length === 0 ? <Text dimColor>{t(T.none)}</Text> : null}
      {reads.length > 0 ? <Text bold>{t(T.headReads)}</Text> : null}
      {reads.map(([path, n]) => (
        <Text key={`r${path}`}>{`${n}× ${clip(path, 100)}`}</Text>
      ))}
      {cmds.length > 0 ? <Text bold>{t(T.headCmds)}</Text> : null}
      {cmds.map(c => (
        <Text key={`c${c.cmd}`}>{`${c.n}× ${clip(c.cmd, 100)}`}</Text>
      ))}
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'waste' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }

    const s = await read($, state)
    const reads = Object.entries(s.dupReads).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const cmds = Object.values(s.dupCmds).sort((a, b) => b.n - a.n).slice(0, 5)
    if (reads.length === 0 && cmds.length === 0) return { text: t(T.none) }

    const lines: string[] = []
    if (reads.length > 0) {
      lines.push(t(T.headReads))
      for (const [path, n] of reads) lines.push(`  ${n}× ${path}`)
    }
    if (cmds.length > 0) {
      lines.push(t(T.headCmds))
      for (const c of cmds) lines.push(`  ${c.n}× ${clip(c.cmd, 100)}`)
    }
    return { text: lines.join('\n') }
  })
}
