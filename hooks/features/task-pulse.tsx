import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Timer } from 'claude-code'

import { clockText, isOn, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { emptyState, ICONS, short } from '../ui'
import type { Chip } from '../ui'

const T = {
  title: {
    en: 'Task pulse',
    he: 'דופק המשימה',
    es: 'Pulso de la tarea',
    fr: 'Pouls de la tâche',
    ru: 'Пульс задачи',
    zh: '任务动态',
    ja: 'タスクパルス',
    pt: 'Pulso da tarefa',
    de: 'Aufgaben-Puls',
    ko: '작업 펄스',
  },
  description: {
    en: 'A line above the prompt box: current turn time, actions in it, and total actions in the session.',
    he: 'פס מעל תיבת הכתיבה: זמן התור הנוכחי, פעולות בו וסה"כ פעולות בסשן.',
    es: 'Una línea sobre el cuadro de texto: tiempo del turno actual, acciones en él y total de acciones de la sesión.',
    fr: 'Une ligne au-dessus de la zone de saisie : durée du tour en cours, actions dans ce tour et total des actions de la session.',
    ru: 'Строка над полем ввода: время текущего хода, число действий в нём и общее число действий в сессии.',
    zh: '输入框上方的一行：当前轮次用时、其中的操作数以及会话总操作数。',
    ja: 'プロンプト欄の上の 1 行：現在のターンの経過時間、その中のアクション数、セッション全体のアクション数。',
    pt: 'Uma linha acima da caixa de prompt: tempo do turno atual, ações nele e total de ações na sessão.',
    de: 'Eine Zeile über dem Eingabefeld: Dauer der aktuellen Runde, Aktionen darin und Aktionen insgesamt in der Sitzung.',
    ko: '프롬프트 입력창 위의 한 줄: 현재 턴 시간, 그 안의 작업 수, 세션 전체 작업 수.',
  },
  working: {
    en: '● working',
    he: '● עובד',
    es: '● trabajando',
    fr: '● en cours',
    ru: '● работает',
    zh: '● 进行中',
    ja: '● 作業中',
    pt: '● trabalhando',
    de: '● arbeitet',
    ko: '● 작업 중',
  },
  lastTask: {
    en: '○ last task',
    he: '○ המשימה האחרונה',
    es: '○ última tarea',
    fr: '○ dernière tâche',
    ru: '○ последняя задача',
    zh: '○ 上一个任务',
    ja: '○ 前回のタスク',
    pt: '○ última tarefa',
    de: '○ letzte Aufgabe',
    ko: '○ 마지막 작업',
  },
  actions: {
    en: '{n} actions',
    he: '{n} פעולות',
    es: '{n} acciones',
    fr: '{n} actions',
    ru: 'действий: {n}',
    zh: '{n} 个操作',
    ja: 'アクション {n} 件',
    pt: '{n} ações',
    de: '{n} Aktionen',
    ko: '작업 {n}개',
  },
  sessionTotal: {
    en: 'session total {n}',
    he: 'סה״כ בסשן {n}',
    es: 'total en la sesión: {n}',
    fr: 'total de la session : {n}',
    ru: 'всего в сессии: {n}',
    zh: '会话共 {n}',
    ja: 'セッション合計 {n}',
    pt: 'total da sessão {n}',
    de: 'Sitzung gesamt {n}',
    ko: '세션 합계 {n}',
  },
  dStarted: { en: 'started {t} ago', he: 'התחילה לפני {t}', es: 'empezó hace {t}', fr: 'commencée il y a {t}', ru: 'начато {t} назад', zh: '{t} 前开始', ja: '{t} 前に開始', pt: 'iniciada há {t}', de: 'vor {t} gestartet', ko: '{t} 전 시작' },
  dNoneHint: { en: 'Send a prompt and the clock for the turn, its actions and the session total start here.', he: 'שלחו בקשה והשעון של התור, הפעולות שלו וסה"כ הסשן יתחילו כאן.', es: 'Envía un mensaje y aquí empiezan el reloj del turno, sus acciones y el total de la sesión.', fr: 'Envoyez un message : le chrono du tour, ses actions et le total de la session démarrent ici.', ru: 'Отправьте запрос, и здесь начнут отсчёт время хода, его действия и итог сессии.', zh: '发送提示后，本轮的计时、操作数和会话总数会从这里开始显示。', ja: 'プロンプトを送ると、ターンの時計、アクション数、セッション合計がここに表示されます。', pt: 'Envie um prompt e o relógio do turno, as ações e o total da sessão começam aqui.', de: 'Sende einen Prompt, dann starten hier die Uhr der Runde, ihre Aktionen und die Sitzungssumme.', ko: '프롬프트를 보내면 턴 시계, 작업 수, 세션 합계가 여기서 시작됩니다.' },
  dNone: { en: 'No task has run yet.', he: 'עדיין לא רצה משימה.', es: 'Aún no se ha ejecutado ninguna tarea.', fr: 'Aucune tâche n\'a encore été exécutée.', ru: 'Задач ещё не было.', zh: '还没有运行过任务。', ja: 'まだタスクは実行されていません。', pt: 'Nenhuma tarefa foi executada ainda.', de: 'Es ist noch keine Aufgabe gelaufen.', ko: '아직 실행된 작업이 없습니다.' },
} as const

type Pulse = { startedAt: number; endedAt: number | null; now: number; tools: number; sessionTools: number }

const pulse = atom({ plugin: 'toolkitty', key: 'slot', id: 'task-pulse' } as const, null) as unknown as Atom<Pulse | null>

export const feature: Feature = {
  id: 'task-pulse',
  title: T.title,
  description: T.description,
  defaultOn: true,
}

let ticker: Timer | undefined

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return

  const startedAt = await $.clock.now()
  await update($, pulse, p => ({
    startedAt,
    endedAt: null,
    now: startedAt,
    tools: 0,
    sessionTools: p?.sessionTools ?? 0,
  }))

  // One state write a second: only the band that reads the slot redraws.
  ticker?.cancel()
  ticker = $.clock.every(1000, async () => {
    const now = await $.clock.now()
    await update($, pulse, p => (p === null || p.endedAt !== null ? p : { ...p, now }))
  })
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (!(await isOn($, feature))) return undefined

  await update($, pulse, p =>
    p === null
      ? p
      : { ...p, tools: p.endedAt === null ? p.tools + 1 : p.tools, sessionTools: p.sessionTools + 1 },
  )

  return undefined
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined) return

  ticker?.cancel()
  ticker = undefined

  const endedAt = await $.clock.now()
  await update($, pulse, p => (p === null ? p : { ...p, endedAt, now: endedAt }))
}

/** What a press on the band line shows: the current or last task's timing and the session total. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null

  const p = await read($, pulse)
  const { Box, Text } = $.ui.resolve(e)
  if (p === null) {
    return (
      <Box flexDirection="column">{emptyState($, e, t(T.dNone), t(T.dNoneHint))}</Box>
    )
  }

  const now = await $.clock.now()
  const isRunning = p.endedAt === null
  return (
    <Box flexDirection="column">
      <Text bold>{`${isRunning ? t(T.working) : t(T.lastTask)} · ${clockText((p.endedAt ?? p.now ?? p.startedAt) - p.startedAt)}`}</Text>
      <Text>{t(T.dStarted, { t: clockText(now - p.startedAt) })}</Text>
      <Text>{t(T.actions, { n: p.tools })}</Text>
      <Text>{t(T.sessionTotal, { n: p.sessionTools })}</Text>
    </Box>
  )
}

export async function renderBand($: EngineInterface, e: BandInput): Promise<BandLine> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = await read($, pulse)
  if (p === null) return null

  const isRunning = p.endedAt === null
  const { Text } = $.ui.resolve(e)

  return (
    <Text dimColor size="footnote">
      {isRunning ? t(T.working) : t(T.lastTask)}
      {' · '}
      <Text mono>{clockText((p.endedAt ?? p.now ?? p.startedAt) - p.startedAt)}</Text>
      {' · '}
      {t(T.actions, { n: p.tools })}
      {' · '}
      {t(T.sessionTotal, { n: p.sessionTools })}
    </Text>
  )
}

/** The short band form: turn time and actions; accent while a turn is working. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null

  const p = await read($, pulse)
  if (p === null) return null

  const isRunning = p.endedAt === null
  return {
    text: `${short((p.endedAt ?? p.now ?? p.startedAt) - p.startedAt)} · ${p.tools}`,
    level: isRunning ? 'info' : 'ok',
    icon: ICONS.insight,
  }
}
