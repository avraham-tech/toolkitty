import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, RenderElement } from 'claude-code'

import { isOn, language, notice, t, LANG_ENGLISH_NAMES } from '../core'
import type { Feature, Input, ToolCallInput, ToolCallOutput } from '../core'
import { ICONS, emptyState, listRow, paneHeader, sectionTitle } from '../ui'

const T = {
  cmdTaken: { en: 'The command /{name} could not be registered: {reason}', he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}', es: 'No se pudo registrar el comando /{name}: {reason}', fr: 'La commande /{name} ne peut pas être enregistrée : {reason}', ru: 'Не удалось зарегистрировать команду /{name}: {reason}', zh: '无法注册命令 /{name}：{reason}', ja: 'コマンド /{name} を登録できませんでした: {reason}', pt: 'Não foi possível registrar o comando /{name}: {reason}', de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}', ko: '/{name} 명령을 등록할 수 없습니다: {reason}' },
  title: {
    en: 'Decision ledger',
    he: 'יומן החלטות',
    es: 'Registro de decisiones',
    fr: 'Registre des décisions',
    ru: 'Журнал решений',
    zh: '决策账本',
    ja: '決定台帳',
    pt: 'Registro de decisões',
    de: 'Entscheidungsprotokoll',
    ko: '결정 기록부',
  },
  description: {
    en: 'After each answer, a cheap model lists choices and assumptions Claude made without asking; /decisions shows them. Calls a model every turn.',
    he: 'אחרי כל תשובה מודל זול מציין בחירות והנחות ש-Claude עשה בלי לשאול; /decisions מציג אותן. קורא למודל בכל תור.',
    es: 'Tras cada respuesta, un modelo barato lista las elecciones y suposiciones que Claude hizo sin preguntar; /decisions las muestra. Llama a un modelo en cada turno.',
    fr: "Après chaque réponse, un modèle économique liste les choix et hypothèses de Claude faits sans demander ; /decisions les affiche. Appelle un modèle à chaque tour.",
    ru: 'После каждого ответа недорогая модель перечисляет выборы и допущения, сделанные Claude без вопросов; /decisions показывает их. Вызывает модель каждый ход.',
    zh: '每次回答后，由一个低成本模型列出 Claude 未经询问就做出的选择和假设；/decisions 可查看。每一轮都会调用一次模型。',
    ja: '回答のたびに、低コストのモデルが Claude が確認なしに行った選択と仮定を一覧にします。/decisions で確認できます。毎ターンモデルを呼び出します。',
    pt: 'Após cada resposta, um modelo barato lista as escolhas e suposições que o Claude fez sem perguntar; /decisions as mostra. Chama um modelo a cada turno.',
    de: 'Nach jeder Antwort listet ein günstiges Modell Entscheidungen und Annahmen auf, die Claude ohne Rückfrage getroffen hat; /decisions zeigt sie. Ruft in jedem Durchgang ein Modell auf.',
    ko: '답변이 끝날 때마다 저렴한 모델이 Claude가 묻지 않고 내린 선택과 가정을 나열합니다. /decisions로 볼 수 있습니다. 매 턴 모델을 호출합니다.',
  },
  commandDesc: {
    en: 'Shows decisions and assumptions Claude made without asking',
    he: 'מציג החלטות והנחות ש-Claude עשה בלי לשאול',
    es: 'Muestra decisiones y suposiciones que Claude hizo sin preguntar',
    fr: 'Affiche les décisions et hypothèses de Claude faites sans demander',
    ru: 'Показывает решения и допущения Claude, сделанные без вопросов',
    zh: '显示 Claude 未经询问做出的决策和假设',
    ja: 'Claude が確認なしに行った決定と仮定を表示します',
    pt: 'Mostra decisões e suposições que o Claude fez sem perguntar',
    de: 'Zeigt Entscheidungen und Annahmen, die Claude ohne Rückfrage getroffen hat',
    ko: 'Claude가 묻지 않고 내린 결정과 가정을 보여 줍니다',
  },
  off: {
    en: 'Decision ledger is turned off in the Toolkitty pane.',
    he: 'יומן ההחלטות כבוי בלוח ה-Toolkitty.',
    es: 'El registro de decisiones está desactivado en el panel de Toolkitty.',
    fr: 'Le registre des décisions est désactivé dans le panneau Toolkitty.',
    ru: 'Журнал решений отключён в панели Toolkitty.',
    zh: '决策账本已在 Toolkitty 面板中关闭。',
    ja: '決定台帳は Toolkitty ペインでオフになっています。',
    pt: 'O registro de decisões está desativado no painel do Toolkitty.',
    de: 'Das Entscheidungsprotokoll ist im Toolkitty-Panel ausgeschaltet.',
    ko: '결정 기록부가 Toolkitty 창에서 꺼져 있습니다.',
  },
  opened: {
    en: 'Decisions pane opened.',
    he: 'לוח ההחלטות נפתח.',
    es: 'Panel de decisiones abierto.',
    fr: 'Panneau des décisions ouvert.',
    ru: 'Панель решений открыта.',
    zh: '已打开决策面板。',
    ja: '決定ペインを開きました。',
    pt: 'Painel de decisões aberto.',
    de: 'Entscheidungs-Panel geöffnet.',
    ko: '결정 창을 열었습니다.',
  },
  paneTitle: { en: 'Decisions', he: 'החלטות', es: 'Decisiones', fr: 'Décisions', ru: 'Решения', zh: '决策', ja: '決定事項', pt: 'Decisões', de: 'Entscheidungen', ko: '결정' },
  paneOff: {
    en: 'Decision ledger is turned off.',
    he: 'יומן ההחלטות כבוי.',
    es: 'El registro de decisiones está desactivado.',
    fr: 'Le registre des décisions est désactivé.',
    ru: 'Журнал решений отключён.',
    zh: '决策账本已关闭。',
    ja: '決定台帳はオフです。',
    pt: 'O registro de decisões está desativado.',
    de: 'Das Entscheidungsprotokoll ist aus.',
    ko: '결정 기록부가 꺼져 있습니다.',
  },
  empty: {
    en: 'Nothing recorded yet.',
    he: 'עוד לא נרשם דבר.',
    es: 'Aún no hay nada registrado.',
    fr: "Rien n'est encore enregistré.",
    ru: 'Пока ничего не записано.',
    zh: '还没有记录。',
    ja: 'まだ記録はありません。',
    pt: 'Nada registrado ainda.',
    de: 'Noch nichts erfasst.',
    ko: '아직 기록된 것이 없습니다.',
  },
  emptyHint: {
    en: 'Choices Claude makes on its own are listed here after long answers.',
    he: 'בחירות ש-Claude עושה מעצמו יירשמו כאן אחרי תשובות ארוכות.',
    es: 'Las decisiones que Claude toma por su cuenta aparecerán aquí tras respuestas largas.',
    fr: 'Les choix que Claude fait de lui-même apparaîtront ici après les longues réponses.',
    ru: 'Самостоятельные решения Claude появятся здесь после длинных ответов.',
    zh: 'Claude 自行做出的选择会在较长的回答之后列在这里。',
    ja: 'Claude が自分で行った選択は、長い回答の後にここに一覧表示されます。',
    pt: 'As escolhas que o Claude faz por conta própria são listadas aqui após respostas longas.',
    de: 'Entscheidungen, die Claude selbst trifft, werden hier nach langen Antworten aufgelistet.',
    ko: 'Claude가 스스로 내린 선택은 긴 답변 뒤에 여기에 나열됩니다.',
  },
  statusCount: { en: '{n} recorded', he: '{n} נרשמו', es: '{n} registradas', fr: '{n} enregistrées', ru: 'записано: {n}', zh: '已记录 {n} 条', ja: '{n} 件を記録', pt: '{n} registradas', de: '{n} erfasst', ko: '{n}개 기록됨' },
  turnHead: { en: 'Turn {n}', he: 'תור {n}', es: 'Turno {n}', fr: 'Tour {n}', ru: 'Ход {n}', zh: '第 {n} 轮', ja: 'ターン {n}', pt: 'Turno {n}', de: 'Durchgang {n}', ko: '{n}번째 턴' },
  decision: { en: 'decision', he: 'החלטה', es: 'decisión', fr: 'décision', ru: 'решение', zh: '决策', ja: '決定', pt: 'decisão', de: 'Entscheidung', ko: '결정' },
  assumption: { en: 'assumption', he: 'הנחה', es: 'suposición', fr: 'hypothèse', ru: 'допущение', zh: '假设', ja: '仮定', pt: 'suposição', de: 'Annahme', ko: '가정' },
  clear: { en: 'clear', he: 'נקה', es: 'borrar', fr: 'effacer', ru: 'очистить', zh: '清除', ja: '消去', pt: 'limpar', de: 'löschen', ko: '지우기' },
  decisionsOne: { en: '1 decision', he: 'החלטה אחת', es: '1 decisión', fr: '1 décision', ru: '1 решение', zh: '1 项决策', ja: '決定 1 件', pt: '1 decisão', de: '1 Entscheidung', ko: '결정 1개' },
  decisionsMany: { en: '{n} decisions', he: '{n} החלטות', es: '{n} decisiones', fr: '{n} décisions', ru: 'решений: {n}', zh: '{n} 项决策', ja: '決定 {n} 件', pt: '{n} decisões', de: '{n} Entscheidungen', ko: '결정 {n}개' },
  assumptionsOne: { en: '1 assumption', he: 'הנחה אחת', es: '1 suposición', fr: '1 hypothèse', ru: '1 допущение', zh: '1 项假设', ja: '仮定 1 件', pt: '1 suposição', de: '1 Annahme', ko: '가정 1개' },
  assumptionsMany: { en: '{n} assumptions', he: '{n} הנחות', es: '{n} suposiciones', fr: '{n} hypothèses', ru: 'допущений: {n}', zh: '{n} 项假设', ja: '仮定 {n} 件', pt: '{n} suposições', de: '{n} Annahmen', ko: '가정 {n}개' },
  toast: {
    en: '📝 {parts} this turn',
    he: '📝 {parts} בתור הזה',
    es: '📝 {parts} en este turno',
    fr: '📝 {parts} ce tour',
    ru: '📝 {parts} за этот ход',
    zh: '📝 本轮 {parts}',
    ja: '📝 このターン: {parts}',
    pt: '📝 {parts} neste turno',
    de: '📝 {parts} in diesem Durchgang',
    ko: '📝 이번 턴 {parts}',
  },
} as const

type Kind = 'decision' | 'assumption'
type Item = { id: string; turn: number; at: number; kind: Kind; text: string }
type State = { items: Item[]; turn: number; seq: number; files: string[] }

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'decision-ledger' } as const,
  { items: [], turn: 0, seq: 0, files: [] } as State,
) as unknown as Atom<State>

const MIN_ANSWER = 300
const MAX_ANSWER = 6000
const MAX_ITEMS = 100
const MAX_PER_TURN = 5
const MAX_TEXT = 300


export const feature: Feature = {
  id: 'decision-ledger',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const pathOf = (e: object): string | undefined => {
  const x = e as Record<string, unknown>
  const p = x['file_path'] ?? x['notebook_path']
  return typeof p === 'string' ? p : undefined
}

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

/** Pulls the first JSON array out of a model reply and keeps only well-formed items. */
function parseItems(raw: string): { kind: Kind; text: string }[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let data: unknown
  try {
    data = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: { kind: Kind; text: string }[] = []
  for (const entry of data) {
    if (entry === null || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const kind = rec['kind']
    const text = rec['text']
    if ((kind !== 'decision' && kind !== 'assumption') || typeof text !== 'string') continue
    const clean = text.trim().slice(0, MAX_TEXT)
    if (clean === '') continue
    out.push({ kind, text: clean })
    if (out.length >= MAX_PER_TURN) break
  }
  return out
}

export async function onSessionStart($: EngineInterface, _e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'decisions', description: t(T.commandDesc) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'decisions', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
}

export async function afterEditCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return result
  if (result.deny !== undefined || result.isError) return result

  const path = pathOf(e)
  if (path !== undefined) {
    const name = baseName(path)
    await update($, state, s => (s.files.includes(name) ? s : { ...s, files: [...s.files, name].slice(0, 50) }))
  }
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  if (e.reason !== 'answer') return

  const before = await read($, state)
  const files = before.files
  await update($, state, s => ({ ...s, files: [], turn: s.turn + 1 }))
  if (e.answer.length <= MIN_ANSWER) return

  const turn = before.turn + 1
  const fileLine = files.length > 0 ? files.join(', ') : '(none)'
  const prompt =
    'You review one answer from an AI coding assistant. List the choices the assistant made on its own that the user did not explicitly ask for.\n' +
    'Two kinds: "decision" (a choice between alternatives, such as a library, a name, a structure, a behavior) and "assumption" (something it took for granted about the request, the code or the environment).\n' +
    'Ignore anything the user clearly asked for and ignore trivial details. Return at most ' + MAX_PER_TURN + ' items.\n' +
    'Reply with ONLY a JSON array, no prose and no code fence: [{"kind":"decision"|"assumption","text":"one short sentence"}]. Reply [] when there is nothing.\n' +
    'Write each "text" in ' + LANG_ENGLISH_NAMES[language()] + '.\n\n' +
    'Files edited this turn: ' + fileLine + '\n\n' +
    'Assistant answer:\n' + e.answer.slice(0, MAX_ANSWER)

  let found: { kind: Kind; text: string }[] = []
  try {
    const r = await $.model.complete({ model: 'claude-haiku-5-5', prompt })
    if (!r.isAnswered) return
    found = parseItems(r.text)
  } catch {
    return
  }
  if (found.length === 0) return

  const at = await $.clock.now()
  await update($, state, s => {
    const fresh: Item[] = found.map((f, i) => ({ id: `d${s.seq + i + 1}`, turn, at, kind: f.kind, text: f.text }))
    return { ...s, seq: s.seq + found.length, items: [...s.items, ...fresh].slice(-MAX_ITEMS) }
  })

  const d = found.filter(f => f.kind === 'decision').length
  const a = found.length - d
  const parts: string[] = []
  if (d > 0) parts.push(d === 1 ? t(T.decisionsOne) : t(T.decisionsMany, { n: d }))
  if (a > 0) parts.push(a === 1 ? t(T.assumptionsOne) : t(T.assumptionsMany, { n: a }))
  await notice($, 'info', t(T.toast, { parts: parts.join(', ') }), feature.id)
}

export function register(on: On) {
  on('command.run', { command: 'decisions' }, async $ => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await $.ui.open({ id: 'decision-ledger', title: t(T.paneTitle) })
    return { text: t(T.opened) }
  })

  on('ui.render', { component: 'Pane', requestId: 'decision-ledger' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (!(await isOn($, feature))) return <Text dimColor>{t(T.paneOff)}</Text>

    const { items } = await read($, state)
    if (items.length === 0) {
      return (
        <Box flexDirection="column">
          {paneHeader($, e, { title: t(T.paneTitle), icon: ICONS.insight })}
          {emptyState($, e, t(T.empty), t(T.emptyHint))}
        </Box>
      )
    }

    const dismiss = async (id: string) => {
      await update($, state, s => ({ ...s, items: s.items.filter(i => i.id !== id) }))
    }
    const clearAll = async () => {
      await update($, state, s => ({ ...s, items: [] }))
    }

    const newest = [...items].reverse()
    const room = Math.max(4, (e.viewport?.rows ?? 25) - 6)
    const shown = newest.slice(0, room)
    const rows: RenderElement[] = []
    let lastTurn = -1
    for (const item of shown) {
      if (item.turn !== lastTurn) {
        lastTurn = item.turn
        rows.push(<Box key={`turn-${item.turn}`}>{sectionTitle($, e, t(T.turnHead, { n: item.turn }))}</Box>)
      }
      rows.push(
        listRow($, e, {
          key: `dismiss-${item.id}`,
          left: item.kind === 'decision' ? t(T.decision) : t(T.assumption),
          text: item.text,
          right: '✕',
          level: item.kind === 'decision' ? 'info' : 'warn',
          onPress: () => dismiss(item.id),
        }),
      )
    }

    return (
      <Box flexDirection="column">
        {paneHeader($, e, {
          title: t(T.paneTitle),
          status: t(T.statusCount, { n: items.length }),
          level: 'info',
          icon: ICONS.insight,
          actions: [{ key: 'clear-all', label: t(T.clear), onPress: () => clearAll() }],
        })}
        {rows}
      </Box>
    )
  })
}
