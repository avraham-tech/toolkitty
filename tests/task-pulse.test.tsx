import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

const BAND = {
  plugin: 'toolkitty',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const DETAIL = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: {
    title: 'Toolkitty',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const OWN_FAILURE = /feature (task-pulse|cost-meter|daily-total|model-indicator|error-counter|uncommitted-reminder|break-timer|long-turn-toast|done-notify) failed/

/** Toolkitty reports a feature handler that threw as a toast; for this feature that is a test failure. */
function noOwnFailure(text: string) {
  if (OWN_FAILURE.test(text)) throw new Error('a feature handler threw: ' + text)
}

// Every call the plugin makes on `$` is answered here, the engine's side.
function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { commands: [] as string[], toasts: [] as string[], opened: [] as string[] }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.usage', () => ({ value: { context: { percent: null } } }))
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  // what the engine draws above the prompt when the plugin adds nothing
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const turn = (id = 't1') => ({ text: 'hello', turnId: id })
const done = (id = 't1', extra: Record<string, unknown> = {}) => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  turnId: id,
  reason: 'answer' as const,
  ...extra,
})

// The band shows chips and hides the full lines behind a toggle: open it so every line is drawn.
async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

/** The short chip text the band shows for this feature (compact mode), or undefined. */
async function chipText($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const chip = await ui.find({ key: 'chip-task-pulse' })
  const text = chip?.text
  await ui.unmount()
  return text as string | undefined
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  const ui = await $.ui.mount({ ...BAND, surface })
  await openBand(ui)
  const line = await ui.find({ key: 'band-task-pulse' })
  const text = line?.text
  await ui.unmount()
  return text as string | undefined
}

test('loads, hides the band before any turn, and skips no hook', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(await bandText($)).toBeUndefined()
  // this feature registers no command of its own
  expect(seen.commands).not.toContain('task-pulse')
})

test('a turn shows working, counts actions, ticks each second and ends as last task', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($)

  await $.turn.start(turn())
  expect(await bandText($)).toBe('● working · 0:00 · 0 actions · session total 0')

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await clock.advance(5000)
  expect(await bandText($)).toBe('● working · 0:05 · 2 actions · session total 2')

  await clock.advance(65_000)
  expect(await bandText($)).toContain('1:10')

  await $.turn.complete(done())
  const after = await bandText($)
  expect(after).toBe('○ last task · 1:10 · 2 actions · session total 2')

  // the ticker is cancelled: time passing no longer moves the line
  await clock.advance(30_000)
  expect(await bandText($)).toBe(after)

  // a second turn restarts the turn count but keeps the session total
  await $.turn.start(turn('t2'))
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await bandText($)).toBe('● working · 0:00 · 1 actions · session total 3')
  await $.turn.complete(done('t2'))
})

test('a subagent turn does not start or stop the pulse', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($)
  await $.turn.start(turn())
  await clock.advance(3000)
  await $.turn.start({ text: 'sub', turnId: 'sub1', agentId: 'a1' })
  await $.turn.complete(done('sub1', { agentId: 'a1' }))
  await clock.advance(2000)
  expect(await bandText($)).toContain('● working · 0:05')
  await $.turn.complete(done())
})

test('a tool call after the turn ended counts only toward the session total', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete(done())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await bandText($)).toBe('○ last task · 0:00 · 1 actions · session total 2')
})

test('a tool call is never denied by the pulse', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  const r = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r.deny).toBeUndefined()
  await $.turn.complete(done())
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await ui.find({ key: 'band-task-pulse' })).toBeUndefined()
  await ui.unmount()
  await $.turn.complete(done())
})

test('the band draws on the terminal too', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await bandText($, 'terminal')).toBe('● working · 0:00 · 1 actions · session total 1')
  await $.turn.complete(done())
})

test('pressing the band line opens the detail pane with the numbers, and its buttons work', SLOW, async ($, on) => {
  const { clock, seen } = boot(on)
  await start($)

  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(7000)

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-task-pulse' })
  expect(seen.opened).toContain('toolkitty-detail')
  await band.unmount()

  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Task pulse' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● working · 0:07/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'started 0:07 ago' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 actions' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'session total 1' })).toBeDefined()

  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(b => b.key)).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))

  // finish the turn: the detail redraws as last task
  await $.turn.complete(done())
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /○ last task · 0:07/ })).toBeDefined()

  // toggle switches the feature off, the band disappears, and the label flips
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toContain('○ last task')

  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('off switch: no band line, no counting, hooks pass through', SLOW, async ($, on) => {
  const { clock } = boot(on, { enabled: { 'task-pulse': false } })
  await start($)
  await $.turn.start(turn())
  const r = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r.deny).toBeUndefined()
  await clock.advance(5000)
  expect(await bandText($)).toBeUndefined()
  await $.turn.complete(done())
  expect(await bandText($)).toBeUndefined()
})

test('turning it on mid-session starts a clean pulse on the next turn', SLOW, async ($, on) => {
  boot(on, { enabled: { 'task-pulse': false } })
  await start($)
  await $.turn.start(turn())
  await $.turn.complete(done())
  expect(await bandText($)).toBeUndefined()
  await $.turn.start(turn('t2'))
  expect(await bandText($)).toBeUndefined()
  await $.turn.complete(done('t2'))
})

test('Hebrew: the band and the detail pane are in Hebrew', SLOW, async ($, on) => {
  const { seen } = boot(on, { language: 'he' })
  await start($)
  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await bandText($)).toBe('● עובד · 0:00 · 1 פעולות · סה״כ בסשן 1')

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-task-pulse' })
  await band.unmount()
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'דופק המשימה' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'סה״כ בסשן 1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'התחילה לפני 0:00' })).toBeDefined()
  expect(seen.opened).toContain('toolkitty-detail')
  await ui.unmount()
  await $.turn.complete(done())
})

test('the chip is the short form: time and actions, accent while working, quiet after', SLOW, async ($, on) => {
  const { clock, seen } = boot(on)
  await start($)
  expect(await chipText($)).toBeUndefined()

  await $.turn.start(turn())
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(5000)
  expect(await chipText($)).toContain('0:05 · 1')
  expect(await chipText($, 'terminal')).toContain('0:05 · 1')
  expect(await chipText($, 'desktop', { hasSurvey: true })).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const running = await ui.find({ type: 'Text', text: /0:05 · 1/ })
  expect(running?.props['color']).toBe('claude')
  await $.turn.complete(done())
  await ui.redraw()
  const idle = await ui.find({ type: 'Text', text: /0:05 · 1/ })
  expect(idle?.props['color']).toBeUndefined()
  expect(idle?.props['dimColor']).toBe(true)

  // a press on the chip opens the detail pane
  await ui.press({ key: 'chip-task-pulse' })
  expect(seen.opened).toContain('toolkitty-detail')
  await ui.unmount()
})

