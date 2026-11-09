import { expect, mock, test } from 'claude-code/testing'

/*
 * Task ETA. The history is seeded in the store under 'task-eta:history'. Per-item minutes of the seeded
 * tasks are 1, 2, 3, 4, 5, so p25 = 2, median = 3, p75 = 4 minutes (linear interpolation between ranks).
 */
const T0 = 1_700_000_000_000
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const KEY = 'task-eta:history'
const OWN_FAILURE = /feature task-eta failed/

type Task = { items: number; ms: number; turns: number }
type Status = 'pending' | 'in_progress' | 'completed'

const task = (items: number, perItemMin: number, turns = 2): Task => ({ items, ms: items * perItemMin * MIN, turns })
const ONE_TO_FIVE: Task[] = [task(2, 1), task(3, 2), task(1, 3), task(4, 4), task(5, 5)]
const TIGHT: Task[] = [1, 2, 3, 4, 5].map(() => task(1, 2))

type Rig = {
  store: Map<string, unknown>
  sets: { key: string; value: unknown }[]
  cmds: string[]
  toasts: string[]
  clock: ReturnType<typeof mock.clock>
}

function setup(
  on: any,
  o: { history?: unknown; enabled?: boolean | undefined; lang?: string } = {},
): Rig {
  const r: Rig = { store: new Map(), sets: [], cmds: [], toasts: [], clock: undefined as never }
  r.store.set('onboarding:done', true)
  if (o.history !== undefined) r.store.set(KEY, o.history)
  if (o.enabled !== undefined) r.store.set('enabled', { 'task-eta': o.enabled })
  if (o.lang !== undefined) r.store.set('language', o.lang)
  on('store.get', (_: any, e: any) => ({ value: r.store.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    r.store.set(e.key, e.value)
    r.sets.push({ key: e.key, value: e.value })
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    r.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...r.store.keys()] }))
  r.clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('command.register', (_: any, e: any) => {
    r.cmds.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => {
    const text = typeof e === 'string' ? e : String(e.text ?? '')
    if (OWN_FAILURE.test(text)) throw new Error('a feature handler threw: ' + text)
    r.toasts.push(text)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: 'C:/proj' }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200000, percent: 10 }, rateLimits: [] } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', () => ({ result: {} }) as never)
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  return r
}

const start = ($: any) => $.session.start({ cwd: 'C:/proj', surface: 'desktop', isInteractive: true })
const todo = (items: Status[], extra: Record<string, unknown> = {}): any => ({
  tool: 'TodoWrite',
  todos: items.map((status, i) => ({ content: `item ${i + 1}`, status, activeForm: `doing ${i + 1}` })),
  ...extra,
})
const list = (done: number, total: number, extra: Record<string, unknown> = {}): any =>
  todo(Array.from({ length: total }, (_, i): Status => (i < done ? 'completed' : 'pending')), extra)

let turnNo = 0
const turnStart = ($: any, extra: Record<string, unknown> = {}) => $.turn.start({ text: 'go', turnId: `t${++turnNo}`, ...extra })
const turnDone = ($: any, ms = 2000, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: ms, isAborted: false, turnId: `t${turnNo}`, reason: 'answer', ...extra })

const eta = async ($: any, args = ''): Promise<string> => String(((await $.command.run({ command: 'eta', args })) as any).text)

const BAND = {
  plugin: 'toolkitty',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 },
} as const
const DETAIL = {
  plugin: 'toolkitty',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const joined = async (ui: any): Promise<string> => (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)).join('\n')

/** The chip's text, or undefined when the band draws no task-eta chip. */
async function chipText($: any): Promise<string | undefined> {
  const band = await $.ui.mount(BAND)
  const chip = await band.find({ key: 'chip-task-eta' })
  const text = chip === undefined ? undefined : (await band.findAll({ type: 'Text' })).map((x: any) => String(x.text)).find((s: string) => s.includes('⏳'))
  await band.unmount()
  return text
}

/** Presses the chip and returns the detail pane's text. */
async function detailText($: any): Promise<string> {
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'chip-task-eta' })
  await band.unmount()
  const ui = await $.ui.mount(DETAIL)
  const text = await joined(ui)
  await ui.unmount()
  return text
}

const history = (r: Rig): Task[] => (r.store.get(KEY) as Task[] | undefined) ?? []

test('off by default: nothing is tracked, no chip, /eta answers that it is off, the command is still registered', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { history: ONE_TO_FIVE })
  await start($)
  expect(r.cmds).toContain('eta')
  await turnStart($)
  await $.tool.call(list(0, 4))
  await $.tool.call(list(4, 4))
  await turnDone($)
  expect(await chipText($)).toBeUndefined()
  expect(r.sets.filter(s => s.key === KEY)).toHaveLength(0)
  expect(history(r)).toHaveLength(5)
  expect(await eta($)).toBe('Task estimate is off; turn it on in the /toolkitty panel')
  expect(await eta($, 'reset')).toBe('Task estimate is off; turn it on in the /toolkitty panel')
  expect(history(r)).toHaveLength(5)
})

test('an explicit off switch overrides nothing: still off', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { history: ONE_TO_FIVE, enabled: false })
  await start($)
  await $.tool.call(list(0, 4))
  expect(await chipText($)).toBeUndefined()
  expect(await eta($)).toMatch(/estimate is off/)
  expect(r.cmds).toContain('eta')
})

test('no history: unavailable with the exact text and the word estimate; a chip never appears', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true })
  await start($)
  const text = await eta($)
  expect(text).toContain('Task estimate: unavailable (needs 5 finished tasks, has 0)')
  expect(text).toMatch(/estimate/)
  expect(text).toContain('Samples: 0 finished tasks')
  expect(text).toContain('Median per item: n/a')

  await turnStart($)
  await $.tool.call(list(1, 4))
  const open = await eta($)
  expect(open).toContain('Task estimate: unavailable (needs 5 finished tasks, has 0)')
  expect(open).toContain('Items: 1 done, 3 remaining')
  expect(await chipText($)).toBeUndefined()
})

test('two samples: still unavailable (has 2) and no chip', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: [task(2, 1), task(3, 2)] })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 3))
  expect(await eta($)).toContain('Task estimate: unavailable (needs 5 finished tasks, has 2)')
  expect(await chipText($)).toBeUndefined()
})

test('five seeded tasks: the range is p25..p75 times the items left (8-16 min for 4 left), as chip, detail and command', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))

  // per item 1,2,3,4,5 min: p25 2, median 3, p75 4. R = 4: lo 8, mid 12, hi 16 (>= +-30 % of 12 is 8.4..15.6).
  expect(await chipText($)).toBe('⏳ 8–16 min')

  const text = await eta($)
  expect(text).toContain('Task estimate: 8–16 min')
  expect(text).toContain('Items: 0 done, 4 remaining')
  expect(text).toContain('Median per item: 3:00')
  expect(text).toContain('Middle half of past tasks: 2:00 to 4:00 per item')
  expect(text).toContain('Current pace: no item finished yet')
  expect(text).toContain('Samples: 5 finished tasks')
  expect(text).toContain('Last 5 finished tasks')
  // newest first: the 5 min/item task, 5 items = 25:00
  expect(text).toContain('5 items · 25:00 · 2 turns')
  expect(text).toMatch(/estimate/)

  const detail = await detailText($)
  expect(detail).toContain('Task estimate: 8–16 min')
  expect(detail).toContain('Items: 0 done, 4 remaining')
  expect(detail).toContain('Median per item: 3:00')
  expect(detail).toContain('Samples: 5 finished tasks')
  expect(detail).toContain('Last 5 finished tasks')
  expect(detail).toContain('5 items · 25:00 · 2 turns')
  expect(detail).toContain('4 items · 16:00 · 2 turns')
  expect(detail).toMatch(/estimate/)
})

test('the range scales with the items left', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 1))
  expect(await chipText($)).toBe('⏳ 2–4 min') // 2..4 min exactly (hi 4 -> ceil 4, mid 3: 2.1..3.9 is inside)
  await $.tool.call(list(0, 10))
  expect(await chipText($)).toBe('⏳ 20–40 min')
})

test('widening: identical history (every task 2 min/item) still gives a range of at least +-30 %', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: TIGHT })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 3))
  // p25 = median = p75 = 2 min, R = 3: raw 6..6; widened to 4.2..7.8 min -> "4-8 min"
  expect(await chipText($)).toBe('⏳ 4–8 min')
  expect(await eta($)).toContain('Task estimate: 4–8 min')
})

test('the current pace is a floor: a slow task pushes the range up, widened by 30 % around the floor', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  expect(await chipText($)).toBe('⏳ 8–16 min')

  // 20 minutes pass, then 2 of 4 are done: pace 10 min/item, 2 left, floor 20 min.
  // lo = max(4, 20) = 20, hi = max(8, 20) = 20, mid = 20 -> widened 14..26.
  await r.clock.advance(20 * MIN)
  await $.tool.call(list(2, 4))
  expect(await chipText($)).toBe('⏳ 14–26 min')
  const text = await eta($)
  expect(text).toContain('Items: 2 done, 2 remaining')
  expect(text).toContain('Elapsed on this task: 20:00')
  expect(text).toContain('Current pace: 10:00 per item')

  // 3 of 4 done: pace 6:40, 1 left, floor 6.67 min -> lo = hi = mid = 6.67 -> 4.67..8.67 -> "4-9 min"
  await $.tool.call(list(3, 4))
  expect(await chipText($)).toBe('⏳ 4–9 min')
})

test('a fast task does not lower the estimate below the history range (the floor only raises)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  await r.clock.advance(1 * MIN)
  await $.tool.call(list(2, 4)) // pace 30 s/item, floor 1 min; R = 2: p25 4, median 6, p75 8
  expect(await chipText($)).toBe('⏳ 4–8 min')
})

test('hours and sub-minute ranges are formatted as ranges too', { timeoutMs: 30_000 }, async ($, on) => {
  const hours = [1, 2, 3, 4, 5].map(() => task(1, 60))
  setup(on, { enabled: true, history: hours })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 3))
  // 60 min per item, R = 3 -> mid 180, widened 126..234 min = 2.1..3.9 h
  expect(await chipText($)).toBe('⏳ 2.1–3.9 h')
})

test('a very short estimate says under 1 min', { timeoutMs: 30_000 }, async ($, on) => {
  const quick = [1, 2, 3, 4, 5].map((): Task => ({ items: 1, ms: 5 * SEC, turns: 1 }))
  setup(on, { enabled: true, history: quick })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 2))
  expect(await chipText($)).toBe('⏳ under 1 min')
})

test('enough history but no open task: no chip, /eta says no task is open', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  expect(await chipText($)).toBeUndefined()
  const text = await eta($)
  expect(text).toContain('Task estimate: no task is open')
  expect(text).toContain('Samples: 5 finished tasks')
  expect(text).toMatch(/estimate/)
})

test('a task is recorded when all items are completed: items, ms, turns; the chip goes away', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true })
  await start($)

  await turnStart($)
  await $.tool.call(list(0, 3)) // opens at T0
  await turnDone($, 2000)

  await r.clock.advance(10 * MIN)
  await turnStart($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  let text = await eta($)
  expect(text).toContain('This task: 2 turns, 1 tool calls')
  expect(text).toContain('Last turn: 0:02, 1 tool calls')
  await $.tool.call(list(3, 3)) // all done, 10 minutes after it opened, in the second turn

  expect(history(r)).toEqual([{ items: 3, ms: 10 * MIN, turns: 2 }])
  text = await eta($)
  expect(text).toContain('Samples: 1 finished tasks')
  expect(text).toContain('3 items · 10:00 · 2 turns')
  expect(text).not.toContain('Items: ')
})

test('an all-completed list with no open task, an empty list, and a subagent list record nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(3, 3)) // appears already finished: not a task
  expect(r.sets.filter(s => s.key === KEY)).toHaveLength(0)

  await $.tool.call(list(0, 2, { agentId: 'agent-1' })) // a subagent's list
  expect(await chipText($)).toBeUndefined()

  await $.tool.call(list(0, 2))
  expect(await chipText($)).toBe('⏳ 4–8 min')
  await $.tool.call(todo([])) // an empty list closes the task without recording it
  expect(await chipText($)).toBeUndefined()
  expect(r.sets.filter(s => s.key === KEY)).toHaveLength(0)
  expect(history(r)).toHaveLength(5)
})

test('subagent turns and tool calls are not counted', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 2))
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'agent-1' })
  await turnStart($, { agentId: 'agent-1' })
  await turnDone($, 9000, { agentId: 'agent-1' })
  const text = await eta($)
  expect(text).toContain('This task: 1 turns, 0 tool calls')
  expect(text).not.toContain('Last turn')
})

test('the history is capped at 100 tasks: the oldest is dropped, the newest kept, and it is persisted', { timeoutMs: 30_000 }, async ($, on) => {
  const old: Task[] = Array.from({ length: 100 }, (_, i): Task => ({ items: i + 1, ms: (i + 1) * MIN, turns: 1 }))
  const r = setup(on, { enabled: true, history: old })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 7))
  await r.clock.advance(14 * MIN)
  await $.tool.call(list(7, 7))
  const saved = history(r)
  expect(saved).toHaveLength(100)
  expect(saved[0]).toEqual({ items: 2, ms: 2 * MIN, turns: 1 })
  expect(saved[99]).toEqual({ items: 7, ms: 14 * MIN, turns: 1 })
  expect(await eta($)).toContain('Samples: 100 finished tasks')
})

test('an oversized stored history is trimmed to the newest 100 on load; garbage entries are ignored', { timeoutMs: 30_000 }, async ($, on) => {
  const big: unknown[] = Array.from({ length: 130 }, (_, i) => ({ items: i + 1, ms: (i + 1) * MIN, turns: 0 }))
  big.push('junk', null, { items: 0, ms: 5 }, { items: 2, ms: -1 }, { items: 'x', ms: 1 })
  setup(on, { enabled: true, history: big })
  await start($)
  expect(await eta($)).toContain('Samples: 100 finished tasks')
  const text = await eta($)
  expect(text).toContain('130 items · 2:10:00 · 0 turns')
})

test('garbage in the store counts as no history', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: { not: 'a list' } })
  await start($)
  expect(await eta($)).toContain('(needs 5 finished tasks, has 0)')
})

test('/eta reset clears the history in memory and in the store; the estimate becomes unavailable', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  expect(await chipText($)).toBe('⏳ 8–16 min')

  expect(await eta($, 'reset')).toBe('Task estimate history cleared (5 finished tasks removed).')
  expect(history(r)).toEqual([])
  expect(await chipText($)).toBeUndefined()
  const text = await eta($)
  expect(text).toContain('Task estimate: unavailable (needs 5 finished tasks, has 0)')
  // the open task survives the reset
  expect(text).toContain('Items: 0 done, 4 remaining')
  expect(await eta($, '  RESET ')).toContain('0 finished tasks removed')
})

test('timer: every 30 s while a task is open the clock is written; the chip and detail move without a turn', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  expect(await eta($)).toContain('Elapsed on this task: 0:00')

  await r.clock.advance(29 * SEC)
  expect(await eta($)).toContain('Elapsed on this task: 0:00')
  await r.clock.advance(1 * SEC)
  expect(await eta($)).toContain('Elapsed on this task: 0:30')
  await r.clock.advance(30 * SEC)
  expect(await eta($)).toContain('Elapsed on this task: 1:00')

  // with 2 of 4 done the pace floor binds, so the chip itself moves with the timer alone
  await $.tool.call(list(2, 4))
  expect(await chipText($)).toBe('⏳ 4–8 min')
  await r.clock.advance(30 * MIN)
  // elapsed 31 min over 2 done: pace 15.5 min, floor 31 -> 31 +- 30 % = 21.7..40.3 -> 21-41
  expect(await chipText($)).toBe('⏳ 21–41 min')
  expect(await detailText($)).toContain('Elapsed on this task: 31:00')
})

test('timer stops when the task is finished: the clock keeps running without errors and a new task restarts it', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 2))
  await r.clock.advance(5 * MIN)
  await $.tool.call(list(2, 2))
  expect(history(r)).toHaveLength(6)
  await r.clock.advance(10 * MIN)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toHaveLength(0)

  await $.tool.call(list(0, 2))
  await r.clock.advance(30 * SEC)
  expect(await eta($)).toContain('Elapsed on this task: 0:30')
})

test('turn end refreshes the clock too', { timeoutMs: 30_000 }, async ($, on) => {
  const r = setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  await r.clock.advance(7 * SEC)
  await turnDone($, 7000)
  const text = await eta($)
  expect(text).toContain('Elapsed on this task: 0:07')
  expect(text).toContain('Last turn: 0:07, 1 tool calls')
  expect(text).toContain('This task: 1 turns, 0 tool calls')
})

test('Hebrew: the command, the unavailable text, the range and the unit are in Hebrew, with the word for estimate', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, lang: 'he', history: [task(2, 1), task(3, 2)] })
  await start($)
  const text = await eta($)
  expect(text).toContain('הערכת משימה: לא זמינה (נדרשות 5 משימות שהסתיימו, יש 2)')
  expect(text).toContain('דגימות: 2 משימות שהסתיימו')
  expect(text).toContain('הערכה')
  expect(text).not.toContain('Task estimate')
})

test('Hebrew: range, chip, detail and reset', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, lang: 'he', history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  expect(await chipText($)).toBe('⏳ 8–16 דק׳')
  const text = await eta($)
  expect(text).toContain('הערכת משימה: 8–16 דק׳')
  expect(text).toContain('פריטים: 0 הושלמו, 4 נותרו')
  expect(text).toContain('הערכה ולא הבטחה')
  const detail = await detailText($)
  expect(detail).toContain('הערכת משימה: 8–16 דק׳')
  expect(detail).toContain('דגימות: 5 משימות שהסתיימו')
  expect(await eta($, 'reset')).toBe('היסטוריית הערכת המשימות נוקתה (5 משימות שהסתיימו הוסרו).')
})

const LANG_CASES: [string, RegExp, RegExp][] = [
  ['es', /Estimación de la tarea: no disponible \(necesita 5 tareas terminadas, hay 1\)/, /estimación/],
  ['fr', /Estimation de la tâche : indisponible \(il faut 5 tâches terminées, il y en a 1\)/, /estimation/],
  ['ru', /Оценка задачи: недоступна \(нужно завершённых задач: 5, есть: 1\)/, /оценк/],
]
for (const [lang, exact, word] of LANG_CASES) {
  test(`language ${lang}: /eta carries the exact unavailable numbers and the estimate word`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, { enabled: true, lang, history: [task(2, 1)] })
    await start($)
    const text = await eta($)
    expect(text).toMatch(exact)
    expect(text.toLowerCase()).toMatch(word)
  })
}

test('the detail pane with no tasks at all: the empty state tells what fills it', { timeoutMs: 30_000 }, async ($, on) => {
  // The pane is reachable from the chip only when a chip exists, so seed 5 tasks, open one, then reset the history.
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'chip-task-eta' })
  await band.unmount()
  await eta($, 'reset')
  const ui = await $.ui.mount(DETAIL)
  const all = await joined(ui)
  expect(all).toContain('Task estimate: unavailable (needs 5 finished tasks, has 0)')
  expect(all).toContain('No finished tasks yet.')
  expect(all).toContain('A task is a TodoWrite list worked to the end')
  expect(all).toContain('An estimate, not a promise')
  await ui.unmount()
})

test('terminal surface draws the same chip text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await band.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  expect(texts.some((s: string) => s.includes('⏳ 8–16 min'))).toBe(true)
  await band.unmount()
})

test('a survey on screen hides the chip', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { enabled: true, history: ONE_TO_FIVE })
  await start($)
  await turnStart($)
  await $.tool.call(list(0, 4))
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await band.find({ key: 'chip-task-eta' })).toBeUndefined()
  await band.unmount()
})
