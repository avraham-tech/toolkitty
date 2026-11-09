import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, On, Timer } from 'claude-code'

import { isOn, notice, storeSet, t } from '../core'
import type { BandInput, BandLine, Feature, Input, PaneInput, ToolCallInput, ToolCallOutput } from '../core'
import { emptyState, listRow, sectionTitle, short } from '../ui'
import type { Chip } from '../ui'

/*
 * Task ETA: an honest, opt-in estimate of the time left on the open task.
 *
 * A "task" is a TodoWrite list that Claude works through: it opens when a list
 * with unfinished items appears and closes when every item is completed (then
 * { items, ms, turns } goes into the history in `$.store`, capped at 100).
 * Only the main loop counts; subagents are ignored.
 *
 * The estimate needs at least 5 finished tasks. Per item time of each past
 * task = ms / items. With p25, median and p75 of those (linear interpolation
 * between ranks) and R = items remaining:
 *   floor  = (elapsed / items done) * R            (the current pace; 0 until an item is done)
 *   lo     = max(p25 * R, floor)
 *   hi     = max(p75 * R, lo)
 *   mid    = median * R, kept inside [lo, hi]
 *   then widened so the range is never tighter than +-30 % around mid:
 *   lo = min(lo, 0.7 * mid), hi = max(hi, 1.3 * mid)
 * The output is always a range ("5-12 min"), never a point.
 */

const T = {
  title: {
    en: 'Task ETA',
    he: 'הערכת זמן למשימה',
    es: 'ETA de la tarea',
    fr: 'ETA de la tâche',
    ru: 'ETA задачи',
    zh: '任务 ETA',
    ja: 'タスク ETA',
    pt: 'ETA da tarefa',
    de: 'Aufgaben-ETA',
    ko: '작업 ETA',
  },
  description: {
    en: 'An honest estimate of the time left on the open task: a range from your own past tasks, shown only after 5 finished ones (/eta).',
    he: 'הערכה כנה של הזמן שנותר למשימה הפתוחה: טווח לפי המשימות הקודמות שלך, מוצג רק אחרי 5 משימות שהסתיימו (‎/eta).',
    es: 'Una estimación honesta del tiempo que queda de la tarea abierta: un rango según tus tareas anteriores, solo tras 5 tareas terminadas (/eta).',
    fr: 'Une estimation honnête du temps restant pour la tâche en cours : une fourchette tirée de tes tâches passées, seulement après 5 tâches terminées (/eta).',
    ru: 'Честная оценка оставшегося времени открытой задачи: диапазон по вашим прошлым задачам, только после 5 завершённых (/eta).',
    zh: '对当前任务剩余时间的诚实估算：基于你过去任务得出的区间，完成 5 个任务后才会显示（/eta）。',
    ja: '進行中のタスクの残り時間を正直に見積もります。過去のタスクから出した範囲で、5 件完了するまで表示されません（/eta）。',
    pt: 'Uma estimativa honesta do tempo restante da tarefa aberta: um intervalo baseado nas suas tarefas anteriores, exibido só após 5 concluídas (/eta).',
    de: 'Eine ehrliche Schätzung der Restzeit der offenen Aufgabe: ein Bereich aus deinen bisherigen Aufgaben, erst nach 5 abgeschlossenen sichtbar (/eta).',
    ko: '진행 중인 작업의 남은 시간을 솔직하게 추정합니다. 과거 작업을 바탕으로 한 범위이며 5개를 마친 뒤에만 표시됩니다(/eta).',
  },
  cmd: {
    en: 'Shows the task time estimate; /eta reset clears its history',
    he: 'מציג את הערכת הזמן למשימה; ‎/eta reset מנקה את ההיסטוריה',
    es: 'Muestra la estimación de tiempo de la tarea; /eta reset borra su historial',
    fr: "Affiche l'estimation de durée de la tâche ; /eta reset efface son historique",
    ru: 'Показывает оценку времени задачи; /eta reset очищает её историю',
    zh: '显示任务用时估算；/eta reset 会清除其历史记录',
    ja: 'タスクの所要時間の見積もりを表示します。/eta reset で履歴を消去',
    pt: 'Mostra a estimativa de tempo da tarefa; /eta reset limpa o histórico',
    de: 'Zeigt die Zeitschätzung der Aufgabe; /eta reset löscht den Verlauf',
    ko: '작업 시간 추정치를 보여 줍니다. /eta reset은 기록을 지웁니다',
  },
  off: {
    en: 'Task estimate is off; turn it on in the /toolkitty panel',
    he: 'הערכת המשימה כבויה; הפעל אותה בלוח /toolkitty',
    es: 'La estimación de la tarea está desactivada; actívala en el panel /toolkitty',
    fr: "L’estimation de la tâche est désactivée ; active-la dans le panneau /toolkitty",
    ru: 'Оценка задачи выключена; включите её на панели /toolkitty',
    zh: '任务估算已关闭，请在 /toolkitty 面板中开启',
    ja: 'タスクの見積もりはオフです。/toolkitty ペインでオンにしてください',
    pt: 'A estimativa de tarefa está desativada; ative-a no painel /toolkitty',
    de: 'Die Aufgabenschätzung ist aus; aktiviere sie im Panel /toolkitty',
    ko: '작업 추정이 꺼져 있습니다. /toolkitty 창에서 켜세요',
  },
  label: {
    en: 'Task estimate',
    he: 'הערכת משימה',
    es: 'Estimación de la tarea',
    fr: 'Estimation de la tâche',
    ru: 'Оценка задачи',
    zh: '任务估算',
    ja: 'タスクの見積もり',
    pt: 'Estimativa da tarefa',
    de: 'Aufgabenschätzung',
    ko: '작업 추정',
  },
  line: { en: '{label}: {value}', he: '{label}: {value}', es: '{label}: {value}', fr: '{label} : {value}', ru: '{label}: {value}', zh: '{label}：{value}', ja: '{label}：{value}', pt: '{label}: {value}', de: '{label}: {value}', ko: '{label}: {value}' },
  unavailable: {
    en: 'unavailable (needs {need} finished tasks, has {have})',
    he: 'לא זמינה (נדרשות {need} משימות שהסתיימו, יש {have})',
    es: 'no disponible (necesita {need} tareas terminadas, hay {have})',
    fr: 'indisponible (il faut {need} tâches terminées, il y en a {have})',
    ru: 'недоступна (нужно завершённых задач: {need}, есть: {have})',
    zh: '暂不可用（需要 {need} 个已完成任务，目前 {have} 个）',
    ja: '利用不可（完了タスクが {need} 件必要、現在 {have} 件）',
    pt: 'indisponível (precisa de {need} tarefas concluídas, tem {have})',
    de: 'nicht verfügbar (braucht {need} abgeschlossene Aufgaben, hat {have})',
    ko: '사용할 수 없음(완료된 작업 {need}개 필요, 현재 {have}개)',
  },
  noOpen: {
    en: 'no task is open (a task starts with a TodoWrite list)',
    he: 'אין משימה פתוחה (משימה מתחילה ברשימת TodoWrite)',
    es: 'no hay ninguna tarea abierta (una tarea empieza con una lista TodoWrite)',
    fr: 'aucune tâche en cours (une tâche commence par une liste TodoWrite)',
    ru: 'нет открытой задачи (задача начинается со списка TodoWrite)',
    zh: '没有进行中的任务（任务从 TodoWrite 列表开始）',
    ja: '進行中のタスクはありません（タスクは TodoWrite リストから始まります）',
    pt: 'nenhuma tarefa aberta (uma tarefa começa com uma lista TodoWrite)',
    de: 'keine Aufgabe offen (eine Aufgabe beginnt mit einer TodoWrite-Liste)',
    ko: '진행 중인 작업이 없습니다(작업은 TodoWrite 목록으로 시작됩니다)',
  },
  lessThanMin: { en: 'under 1 min', he: 'פחות מדקה', es: 'menos de 1 min', fr: 'moins de 1 min', ru: 'меньше 1 мин', zh: '不到 1 分钟', ja: '1 分未満', pt: 'menos de 1 min', de: 'unter 1 Min.', ko: '1분 미만' },
  unitMin: { en: 'min', he: 'דק׳', es: 'min', fr: 'min', ru: 'мин', zh: '分钟', ja: '分', pt: 'min', de: 'Min.', ko: '분' },
  unitHour: { en: 'h', he: 'ש׳', es: 'h', fr: 'h', ru: 'ч', zh: '小时', ja: '時間', pt: 'h', de: 'Std.', ko: '시간' },
  items: {
    en: 'Items: {done} done, {left} remaining',
    he: 'פריטים: {done} הושלמו, {left} נותרו',
    es: 'Elementos: {done} hechos, {left} pendientes',
    fr: 'Éléments : {done} faits, {left} restants',
    ru: 'Пунктов: выполнено {done}, осталось {left}',
    zh: '项目：已完成 {done}，剩余 {left}',
    ja: '項目：完了 {done}、残り {left}',
    pt: 'Itens: {done} concluídos, {left} restantes',
    de: 'Elemente: {done} erledigt, {left} offen',
    ko: '항목: {done}개 완료, {left}개 남음',
  },
  median: {
    en: 'Median per item: {time}',
    he: 'חציון לפריט: {time}',
    es: 'Mediana por elemento: {time}',
    fr: 'Médiane par élément : {time}',
    ru: 'Медиана на пункт: {time}',
    zh: '每项中位数：{time}',
    ja: '項目あたりの中央値：{time}',
    pt: 'Mediana por item: {time}',
    de: 'Median pro Element: {time}',
    ko: '항목당 중앙값: {time}',
  },
  spread: {
    en: 'Middle half of past tasks: {lo} to {hi} per item',
    he: 'חצי האמצעי של המשימות הקודמות: {lo} עד {hi} לפריט',
    es: 'La mitad central de tareas pasadas: de {lo} a {hi} por elemento',
    fr: 'La moitié centrale des tâches passées : de {lo} à {hi} par élément',
    ru: 'Средняя половина прошлых задач: от {lo} до {hi} на пункт',
    zh: '过去任务的中间一半：每项 {lo} 至 {hi}',
    ja: '過去のタスクの中央 50%：1 項目あたり {lo}〜{hi}',
    pt: 'Metade central das tarefas anteriores: {lo} a {hi} por item',
    de: 'Mittlere Hälfte bisheriger Aufgaben: {lo} bis {hi} pro Element',
    ko: '과거 작업의 중간 50%: 항목당 {lo}~{hi}',
  },
  none: { en: 'n/a', he: 'אין נתון', es: 'n/d', fr: 'n/d', ru: 'н/д', zh: '无', ja: 'なし', pt: 'n/d', de: 'k. A.', ko: '해당 없음' },
  pace: {
    en: 'Current pace: {time} per item',
    he: 'הקצב הנוכחי: {time} לפריט',
    es: 'Ritmo actual: {time} por elemento',
    fr: 'Rythme actuel : {time} par élément',
    ru: 'Текущий темп: {time} на пункт',
    zh: '当前速度：每项 {time}',
    ja: '現在のペース：1 項目あたり {time}',
    pt: 'Ritmo atual: {time} por item',
    de: 'Aktuelles Tempo: {time} pro Element',
    ko: '현재 속도: 항목당 {time}',
  },
  paceNone: {
    en: 'Current pace: no item finished yet',
    he: 'הקצב הנוכחי: עדיין לא הושלם פריט',
    es: 'Ritmo actual: aún no hay elementos terminados',
    fr: "Rythme actuel : aucun élément terminé pour l'instant",
    ru: 'Текущий темп: пока нет выполненных пунктов',
    zh: '当前速度：尚无已完成的项目',
    ja: '現在のペース：完了した項目はまだありません',
    pt: 'Ritmo atual: nenhum item concluído ainda',
    de: 'Aktuelles Tempo: noch kein Element abgeschlossen',
    ko: '현재 속도: 아직 완료된 항목 없음',
  },
  samples: {
    en: 'Samples: {n} finished tasks',
    he: 'דגימות: {n} משימות שהסתיימו',
    es: 'Muestras: {n} tareas terminadas',
    fr: 'Échantillons : {n} tâches terminées',
    ru: 'Выборка: завершённых задач — {n}',
    zh: '样本：{n} 个已完成任务',
    ja: 'サンプル：完了タスク {n} 件',
    pt: 'Amostras: {n} tarefas concluídas',
    de: 'Stichproben: {n} abgeschlossene Aufgaben',
    ko: '표본: 완료된 작업 {n}개',
  },
  elapsed: {
    en: 'Elapsed on this task: {time}',
    he: 'זמן שחלף במשימה: {time}',
    es: 'Tiempo transcurrido en esta tarea: {time}',
    fr: 'Temps écoulé sur cette tâche : {time}',
    ru: 'Прошло времени на задаче: {time}',
    zh: '此任务已用时：{time}',
    ja: 'このタスクの経過時間：{time}',
    pt: 'Decorrido nesta tarefa: {time}',
    de: 'Bisher bei dieser Aufgabe: {time}',
    ko: '이 작업 경과 시간: {time}',
  },
  thisTask: {
    en: 'This task: {turns} turns, {tools} tool calls',
    he: 'המשימה הזו: {turns} תורים, {tools} קריאות לכלים',
    es: 'Esta tarea: {turns} turnos, {tools} llamadas a herramientas',
    fr: 'Cette tâche : {turns} tours, {tools} appels d’outils',
    ru: 'Эта задача: ходов — {turns}, вызовов инструментов — {tools}',
    zh: '此任务：{turns} 轮，{tools} 次工具调用',
    ja: 'このタスク：{turns} ターン、ツール呼び出し {tools} 回',
    pt: 'Esta tarefa: {turns} turnos, {tools} chamadas de ferramentas',
    de: 'Diese Aufgabe: {turns} Durchgänge, {tools} Tool-Aufrufe',
    ko: '이 작업: {turns}턴, 도구 호출 {tools}회',
  },
  lastTurn: {
    en: 'Last turn: {time}, {tools} tool calls',
    he: 'התור האחרון: {time}, {tools} קריאות לכלים',
    es: 'Último turno: {time}, {tools} llamadas a herramientas',
    fr: 'Dernier tour : {time}, {tools} appels d’outils',
    ru: 'Последний ход: {time}, вызовов инструментов — {tools}',
    zh: '上一轮：{time}，{tools} 次工具调用',
    ja: '直前のターン：{time}、ツール呼び出し {tools} 回',
    pt: 'Último turno: {time}, {tools} chamadas de ferramentas',
    de: 'Letzter Durchgang: {time}, {tools} Tool-Aufrufe',
    ko: '마지막 턴: {time}, 도구 호출 {tools}회',
  },
  recentHead: {
    en: 'Last {n} finished tasks',
    he: '{n} המשימות האחרונות שהסתיימו',
    es: 'Últimas {n} tareas terminadas',
    fr: '{n} dernières tâches terminées',
    ru: 'Последние завершённые задачи: {n}',
    zh: '最近 {n} 个已完成任务',
    ja: '直近の完了タスク {n} 件',
    pt: 'Últimas {n} tarefas concluídas',
    de: 'Letzte {n} abgeschlossene Aufgaben',
    ko: '최근 완료한 작업 {n}개',
  },
  recentRow: {
    en: '{items} items · {time} · {turns} turns',
    he: '{items} פריטים · {time} · {turns} תורים',
    es: '{items} elementos · {time} · {turns} turnos',
    fr: '{items} éléments · {time} · {turns} tours',
    ru: 'пунктов: {items} · {time} · ходов: {turns}',
    zh: '{items} 项 · {time} · {turns} 轮',
    ja: '{items} 項目 · {time} · {turns} ターン',
    pt: '{items} itens · {time} · {turns} turnos',
    de: '{items} Elemente · {time} · {turns} Durchgänge',
    ko: '항목 {items}개 · {time} · {turns}턴',
  },
  noRecent: {
    en: 'No finished tasks yet.',
    he: 'עדיין אין משימות שהסתיימו.',
    es: 'Aún no hay tareas terminadas.',
    fr: 'Aucune tâche terminée pour le moment.',
    ru: 'Завершённых задач пока нет.',
    zh: '还没有已完成的任务。',
    ja: '完了したタスクはまだありません。',
    pt: 'Nenhuma tarefa concluída ainda.',
    de: 'Noch keine abgeschlossenen Aufgaben.',
    ko: '아직 완료된 작업이 없습니다.',
  },
  noRecentHint: {
    en: 'A task is a TodoWrite list worked to the end; five finished ones unlock the estimate. /eta shows it any time.',
    he: 'משימה היא רשימת TodoWrite שהושלמה עד הסוף; חמש משימות שהסתיימו פותחות את ההערכה. ‎/eta מציג אותה בכל עת.',
    es: 'Una tarea es una lista TodoWrite completada; cinco terminadas desbloquean la estimación. /eta la muestra cuando quieras.',
    fr: "Une tâche est une liste TodoWrite menée à terme ; cinq tâches terminées débloquent l'estimation. /eta l'affiche à tout moment.",
    ru: 'Задача — это список TodoWrite, доведённый до конца; пять завершённых открывают оценку. /eta показывает её в любой момент.',
    zh: '任务指的是一份做到底的 TodoWrite 列表；完成五个后才会解锁估算。/eta 可随时查看。',
    ja: 'タスクとは、最後まで進めた TodoWrite リストのことです。5 件完了すると見積もりが使えるようになります。/eta でいつでも確認できます。',
    pt: 'Uma tarefa é uma lista TodoWrite levada até o fim; cinco concluídas liberam a estimativa. /eta mostra a qualquer momento.',
    de: 'Eine Aufgabe ist eine bis zum Ende abgearbeitete TodoWrite-Liste; fünf abgeschlossene schalten die Schätzung frei. /eta zeigt sie jederzeit.',
    ko: '작업은 끝까지 진행한 TodoWrite 목록입니다. 다섯 개를 마치면 추정치가 표시됩니다. /eta로 언제든 볼 수 있습니다.',
  },
  disclaimer: {
    en: 'An estimate, not a promise: the range comes from your own past tasks.',
    he: 'הערכה ולא הבטחה: הטווח נגזר מהמשימות הקודמות שלך.',
    es: 'Una estimación, no una promesa: el rango sale de tus propias tareas pasadas.',
    fr: 'Une estimation, pas une promesse : la fourchette vient de tes propres tâches passées.',
    ru: 'Это оценка, а не обещание: диапазон взят из ваших прошлых задач.',
    zh: '这是估算，不是承诺：区间来自你自己过去的任务。',
    ja: '見積もりであり、約束ではありません。範囲はあなた自身の過去のタスクから出しています。',
    pt: 'Uma estimativa, não uma promessa: o intervalo vem das suas próprias tarefas anteriores.',
    de: 'Eine Schätzung, kein Versprechen: Der Bereich stammt aus deinen eigenen früheren Aufgaben.',
    ko: '추정일 뿐 약속이 아닙니다. 범위는 사용자의 과거 작업을 바탕으로 합니다.',
  },
  resetDone: {
    en: 'Task estimate history cleared ({n} finished tasks removed).',
    he: 'היסטוריית הערכת המשימות נוקתה ({n} משימות שהסתיימו הוסרו).',
    es: 'Historial de la estimación de tareas borrado ({n} tareas terminadas eliminadas).',
    fr: "Historique de l'estimation des tâches effacé ({n} tâches terminées supprimées).",
    ru: 'История оценки задач очищена (удалено завершённых задач: {n}).',
    zh: '已清除任务估算历史（移除了 {n} 个已完成任务）。',
    ja: 'タスク見積もりの履歴を消去しました（完了タスク {n} 件を削除）。',
    pt: 'Histórico de estimativas limpo ({n} tarefas concluídas removidas).',
    de: 'Verlauf der Aufgabenschätzung gelöscht ({n} abgeschlossene Aufgaben entfernt).',
    ko: '작업 추정 기록을 지웠습니다(완료된 작업 {n}개 삭제).',
  },
  cmdTaken: {
    en: 'The command /{name} could not be registered: {reason}',
    he: 'לא ניתן היה לרשום את הפקודה /{name}: {reason}',
    es: 'No se pudo registrar el comando /{name}: {reason}',
    fr: "Impossible d'enregistrer la commande /{name} : {reason}",
    ru: 'Не удалось зарегистрировать команду /{name}: {reason}',
    zh: '无法注册命令 /{name}：{reason}',
    ja: 'コマンド /{name} を登録できませんでした：{reason}',
    pt: 'Não foi possível registrar o comando /{name}: {reason}',
    de: 'Der Befehl /{name} konnte nicht registriert werden: {reason}',
    ko: '/{name} 명령을 등록할 수 없습니다: {reason}',
  },
} as const

type Task = { items: number; ms: number; turns: number }
type Open = { startedAt: number; total: number; done: number; turns: number; tools: number }
type Turn = { ms: number; tools: number }
type State = {
  open: Open | null
  /** Written by the 30 s timer and by every turn end; the clock for elapsed time. */
  now: number
  turnTools: number
  inTurn: boolean
  lastTurn: Turn | null
  history: Task[]
  loaded: boolean
}

const state = atom(
  { plugin: 'toolkitty', key: 'slot', id: 'task-eta' } as const,
  { open: null, now: 0, turnTools: 0, inTurn: false, lastTurn: null, history: [], loaded: false } as State,
) as unknown as Atom<State>

export const feature: Feature = {
  id: 'task-eta',
  title: T.title,
  description: T.description,
  defaultOn: false,
}

const HISTORY_KEY = 'task-eta:history'
const MIN_SAMPLES = 5
const HISTORY_CAP = 100
const TICK_MS = 30_000
const MIN_MS = 60_000
const HOUR_MS = 3_600_000
const CLAMP = 0.3
const RECENT = 5

let ticker: Timer | undefined

function stopTicker(): void {
  ticker?.cancel()
  ticker = undefined
}

async function startTicker($: EngineInterface): Promise<void> {
  ticker?.cancel()
  ticker = $.clock.every(TICK_MS, async () => {
    if (!(await isOn($, feature))) {
      stopTicker()
      return
    }
    const s = await read($, state)
    if (s.open === null) {
      stopTicker()
      return
    }
    const now = await $.clock.now()
    await update($, state, cur => (cur.open === null ? cur : { ...cur, now }))
  })
}

const sanitize = (raw: unknown): Task[] => {
  if (!Array.isArray(raw)) return []
  const out: Task[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const items = r['items']
    const ms = r['ms']
    const turns = r['turns']
    if (typeof items !== 'number' || typeof ms !== 'number' || !Number.isFinite(items) || !Number.isFinite(ms)) continue
    if (items < 1 || ms <= 0) continue
    out.push({ items: Math.floor(items), ms, turns: typeof turns === 'number' && Number.isFinite(turns) ? Math.max(0, Math.floor(turns)) : 0 })
  }
  return out.slice(-HISTORY_CAP)
}

async function ensureLoaded($: EngineInterface): Promise<void> {
  const s = await read($, state)
  if (s.loaded) return
  const history = sanitize(await $.store.get(HISTORY_KEY))
  await update($, state, cur => (cur.loaded ? cur : { ...cur, history, loaded: true }))
}

const field = (e: unknown, key: string): unknown => (e as Record<string, unknown>)[key]

/** { total, done } of a TodoWrite input; total 0 when the list is empty or malformed. */
const countTodos = (e: unknown): { total: number; done: number } => {
  const raw = field(e, 'todos')
  if (!Array.isArray(raw)) return { total: 0, done: 0 }
  let total = 0
  let done = 0
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const content = r['content']
    if (typeof content !== 'string' || content.trim() === '') continue
    total += 1
    if (r['status'] === 'completed') done += 1
  }
  return { total, done }
}

/** Linear interpolation between ranks, on a sorted list. */
const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const a = sorted[lo] ?? 0
  const b = sorted[hi] ?? a
  return a + (b - a) * (pos - lo)
}

type Stats = { p25: number; median: number; p75: number }

const statsOf = (history: Task[]): Stats | null => {
  if (history.length === 0) return null
  const per = history.map(x => x.ms / x.items).sort((a, b) => a - b)
  return { p25: quantile(per, 0.25), median: quantile(per, 0.5), p75: quantile(per, 0.75) }
}

type Est = { lo: number; hi: number; mid: number; remaining: number; floor: number }

const estimateOf = (s: State): Est | null => {
  const open = s.open
  if (open === null || s.history.length < MIN_SAMPLES) return null
  const stats = statsOf(s.history)
  const remaining = open.total - open.done
  if (stats === null || remaining <= 0) return null
  const elapsed = Math.max(0, s.now - open.startedAt)
  const floor = open.done > 0 ? (elapsed / open.done) * remaining : 0
  let lo = Math.max(stats.p25 * remaining, floor)
  let hi = Math.max(stats.p75 * remaining, lo)
  const mid = Math.min(Math.max(stats.median * remaining, lo), hi)
  lo = Math.min(lo, mid * (1 - CLAMP))
  hi = Math.max(hi, mid * (1 + CLAMP))
  return { lo, hi, mid, remaining, floor }
}

/** "5–12 min", "1.5–3.0 h" or "under 1 min": always a range. */
const rangeText = (lo: number, hi: number): string => {
  if (hi < MIN_MS) return t(T.lessThanMin)
  if (hi >= 2 * HOUR_MS) return `${(lo / HOUR_MS).toFixed(1)}–${(hi / HOUR_MS).toFixed(1)} ${t(T.unitHour)}`
  const a = Math.max(1, Math.floor(lo / MIN_MS))
  const b = Math.max(a + 1, Math.ceil(hi / MIN_MS))
  return `${a}–${b} ${t(T.unitMin)}`
}

type View = { head: string; inputs: string[]; recent: string[] }

const viewOf = (s: State): View => {
  const label = t(T.label)
  const est = estimateOf(s)
  let value: string
  if (s.history.length < MIN_SAMPLES) value = t(T.unavailable, { need: MIN_SAMPLES, have: s.history.length })
  else if (est === null) value = t(T.noOpen)
  else value = rangeText(est.lo, est.hi)

  const inputs: string[] = []
  const stats = statsOf(s.history)
  const open = s.open
  if (open !== null) {
    const elapsed = Math.max(0, s.now - open.startedAt)
    inputs.push(t(T.items, { done: open.done, left: open.total - open.done }))
    inputs.push(t(T.elapsed, { time: short(elapsed) }))
    inputs.push(open.done > 0 ? t(T.pace, { time: short(elapsed / open.done) }) : t(T.paceNone))
    inputs.push(t(T.thisTask, { turns: open.turns + (s.inTurn ? 1 : 0), tools: open.tools }))
  }
  if (s.lastTurn !== null) inputs.push(t(T.lastTurn, { time: short(s.lastTurn.ms), tools: s.lastTurn.tools }))
  inputs.push(t(T.median, { time: stats === null ? t(T.none) : short(stats.median) }))
  if (stats !== null) inputs.push(t(T.spread, { lo: short(stats.p25), hi: short(stats.p75) }))
  inputs.push(t(T.samples, { n: s.history.length }))

  const recent = s.history
    .slice(-RECENT)
    .reverse()
    .map(x => t(T.recentRow, { items: x.items, time: short(x.ms), turns: x.turns }))
  return { head: t(T.line, { label, value }), inputs, recent }
}

export async function onSessionStart($: EngineInterface, e: Input<'session.start'>): Promise<void> {
  try {
    await $.command.register({ name: 'eta', description: t(T.cmd) })
  } catch (err) {
    await notice($, 'warn', t(T.cmdTaken, { name: 'eta', reason: String(err instanceof Error ? err.message : err).slice(0, 120) }), feature.id)
  }
  if (await isOn($, feature)) await ensureLoaded($)
}

export async function onTurnStart($: EngineInterface, e: Input<'turn.start'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  await ensureLoaded($)
  const now = await $.clock.now()
  await update($, state, s => ({ ...s, now, inTurn: true, turnTools: 0 }))
  const s = await read($, state)
  if (s.open !== null && ticker === undefined) await startTicker($)
}

export async function beforeToolCall($: EngineInterface, e: ToolCallInput): Promise<ToolCallOutput | undefined> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return undefined
  await update($, state, s => ({
    ...s,
    turnTools: s.turnTools + 1,
    open: s.open === null ? null : { ...s.open, tools: s.open.tools + 1 },
  }))
  return undefined
}

export async function afterToolCall($: EngineInterface, e: ToolCallInput, result: ToolCallOutput): Promise<ToolCallOutput> {
  if (e.tool !== 'TodoWrite' || e.agentId !== undefined || !(await isOn($, feature))) return result
  await ensureLoaded($)
  const now = await $.clock.now()
  const { total, done } = countTodos(e)

  const before = await read($, state)
  const prev = before.open

  if (total === 0) {
    await update($, state, s => ({ ...s, open: null, now }))
    stopTicker()
    return result
  }

  if (done >= total) {
    // Every item completed: the open task is finished and becomes a history sample.
    if (prev === null) {
      await update($, state, s => ({ ...s, now }))
      return result
    }
    const task: Task = { items: total, ms: Math.max(0, now - prev.startedAt), turns: prev.turns + (before.inTurn ? 1 : 0) }
    let kept: Task[] = before.history
    if (task.ms > 0) {
      kept = [...before.history, task].slice(-HISTORY_CAP)
      await storeSet($, HISTORY_KEY, kept)
    }
    await update($, state, s => ({ ...s, open: null, now, history: kept }))
    stopTicker()
    return result
  }

  const isNew = prev === null
  await update($, state, s => ({
    ...s,
    now,
    open: s.open === null ? { startedAt: now, total, done, turns: 0, tools: 0 } : { ...s.open, total, done },
  }))
  if (isNew || ticker === undefined) await startTicker($)
  return result
}

export async function onTurnComplete($: EngineInterface, e: Input<'turn.complete'>): Promise<void> {
  if (e.agentId !== undefined || !(await isOn($, feature))) return
  const now = await $.clock.now()
  await update($, state, s => ({
    ...s,
    now,
    inTurn: false,
    turnTools: 0,
    lastTurn: { ms: e.durationMs, tools: s.turnTools },
    open: s.open === null ? null : { ...s.open, turns: s.open.turns + 1 },
  }))
}

/** The short band form: the range while a task is open and an estimate exists. */
export async function renderChip($: EngineInterface, e: BandInput): Promise<Chip | null> {
  if (!(await isOn($, feature)) || e.props.hasSurvey) return null
  const est = estimateOf(await read($, state))
  if (est === null) return null
  return { text: `⏳ ${rangeText(est.lo, est.hi)}`, level: 'info' }
}

/** What a press on the chip shows: the estimate, the inputs behind it and the last 5 tasks. */
export async function renderDetail($: EngineInterface, e: PaneInput): Promise<BandLine> {
  if (!(await isOn($, feature))) return null
  const s = await read($, state)
  const view = viewOf(s)
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      <Text bold color={estimateOf(s) === null ? undefined : 'claude'}>
        {view.head}
      </Text>
      {view.inputs.map((line, i) => (
        <Text key={`in-${i}`}>{line}</Text>
      ))}
      {view.recent.length > 0 ? sectionTitle($, e, t(T.recentHead, { n: view.recent.length })) : null}
      {view.recent.map((line, i) => listRow($, e, { key: `task-${i}`, text: line }))}
      {view.recent.length === 0 ? emptyState($, e, t(T.noRecent), t(T.noRecentHint)) : null}
      <Text dimColor size="footnote">
        {t(T.disclaimer)}
      </Text>
    </Box>
  )
}

export function register(on: On) {
  on('command.run', { command: 'eta' }, async ($, e) => {
    if (!(await isOn($, feature))) return { text: t(T.off) }
    await ensureLoaded($)

    if (e.args.trim().toLowerCase() === 'reset') {
      const had = (await read($, state)).history.length
      await update($, state, s => ({ ...s, history: [] }))
      await storeSet($, HISTORY_KEY, [])
      return { text: t(T.resetDone, { n: had }) }
    }

    const view = viewOf(await read($, state))
    const recent = view.recent.length > 0 ? [t(T.recentHead, { n: view.recent.length }), ...view.recent] : []
    return { text: [view.head, ...view.inputs, ...recent, t(T.disclaimer)].join('\n') }
  })
}
