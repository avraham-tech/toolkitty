import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const MIN = 60_000

const SWITCHBOARD = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

// The toast only: the switch-on notice quotes the feature description, which also mentions an hour of work.
const BREAK = /hour of continuous work has passed|עברה שעה של עבודה רצופה|Прошёл час непрерывной/

const NOTICES = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-notices',
  props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

/** Toolkitty's notices, oldest first, as the notices pane draws them: the text and the Text color of the level. */
async function noticeRows($: any): Promise<{ text: string; color?: string }[]> {
  const ui = await $.ui.mount({ ...NOTICES, surface: 'desktop' })
  const rows = (await ui.findAll({ type: 'Text' })).map((x: any) => ({ text: x.text as string, color: x.props['color'] as string | undefined }))
  await ui.unmount()
  return rows.reverse()
}

const OWN_FAILURE = /feature (task-pulse|cost-meter|daily-total|model-indicator|error-counter|uncommitted-reminder|break-timer|long-turn-toast|done-notify) failed/

/** Toolkitty reports a feature handler that threw as a toast; for this feature that is a test failure. */
function noOwnFailure(text: string) {
  if (OWN_FAILURE.test(text)) throw new Error('a feature handler threw: ' + text)
}

// Every call the plugin makes on `$` is answered here, the engine's side.
// Other features run one-second timers; with hours of mock time that is thousands of ticks, so they sit this out.
const QUIET = { advisor: false, buddy: false, 'auto-continue': false, 'agents-monitor': false, 'cache-countdown': false, 'live-ticker': false }

function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store, enabled: { ...QUIET, ...((store['enabled'] as object | undefined) ?? {}) } })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { toasts: [] as { text: string; timeoutMs?: number }[] }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    seen.toasts.push({ text: e.text, timeoutMs: e.timeoutMs })
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.surfaces', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const breaks = async ($: any) => (await noticeRows($)).filter(r => BREAK.test(r.text)).map(r => r.text)
  return { clock, seen, breaks }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const work = ($: any) => $.tool.call({ tool: 'Bash', command: 'ls' })

/** Works for `minutes`, touching the session every ten minutes, as a person using it would. */
async function workFor($: any, clock: any, minutes: number) {
  for (let spent = 0; spent < minutes; spent += 10) {
    await clock.advance(Math.min(10, minutes - spent) * MIN)
    await work($)
  }
}

test('loads with no hook skipped and says nothing at first', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await clock.advance(5 * MIN)
  expect(await breaks($)).toHaveLength(0)
})

test('an hour of continuous work raises one info notice; not a minute earlier', SLOW, async ($, on) => {
  const { clock, breaks, seen } = boot(on)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })

  await workFor($, clock, 50)
  expect(await breaks($)).toHaveLength(0)
  await clock.advance(9 * MIN)
  expect(await breaks($)).toHaveLength(0)
  await clock.advance(MIN)
  expect(await breaks($)).toHaveLength(1)
  expect((await breaks($))[0]).toBe('An hour of continuous work has passed. How about a break?')
  // a notice, not a toast: only an alert pops up
  expect(seen.toasts.filter(t => BREAK.test(t.text))).toHaveLength(0)
  const row = (await noticeRows($)).find(r => BREAK.test(r.text))
  expect(row?.color).toBeUndefined()
})

test('it repeats once per further hour of continuous work, not more often', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await workFor($, clock, 60)
  expect(await breaks($)).toHaveLength(1)
  await workFor($, clock, 50)
  expect(await breaks($)).toHaveLength(1)
  await workFor($, clock, 10)
  expect(await breaks($)).toHaveLength(2)
})

test('a quarter hour of silence restarts the streak: no notice at the first hour mark', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await work($)
  await clock.advance(20 * MIN)
  await work($)
  await workFor($, clock, 40)
  // 60 minutes after the first call, but only 40 after the streak restarted
  expect(await breaks($)).toHaveLength(0)
  await workFor($, clock, 20)
  expect(await breaks($)).toHaveLength(1)
})

test('a pause under a quarter hour keeps the streak going', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await work($)
  await clock.advance(14 * MIN)
  await work($)
  await workFor($, clock, 46)
  expect(await breaks($)).toHaveLength(1)
})

test('without any further activity there is no notice, however long it runs', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await work($)
  await clock.advance(130 * MIN)
  expect(await breaks($)).toHaveLength(0)
})

test('with no activity at all nothing happens', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await clock.advance(130 * MIN)
  expect(await breaks($)).toHaveLength(0)
})

test('a turn start counts as activity too', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  for (let i = 0; i < 6; i++) {
    await $.turn.start({ text: 'hi', turnId: `t${i}` })
    await clock.advance(10 * MIN)
  }
  expect(await breaks($)).toHaveLength(1)
})

test('the tool call is never denied by the timer', SLOW, async ($, on) => {
  boot(on)
  await start($)
  const r = await work($)
  expect(r.deny).toBeUndefined()
})

test('restarting the session keeps the notice to one per hour', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await workFor($, clock, 60)
  expect(await breaks($)).toHaveLength(1)
})

test('off switch: activity is not tracked and no notice comes', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on, { enabled: { 'break-timer': false } })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const r = await work($)
  expect(r.deny).toBeUndefined()
  await workFor($, clock, 90)
  expect(await breaks($)).toHaveLength(0)
})

test('turned on mid-session from the switchboard, the always-running timer starts to count', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on, { enabled: { 'break-timer': false } })
  await start($)
  await workFor($, clock, 90)
  expect(await breaks($)).toHaveLength(0)

  const ui = await $.ui.mount({ ...SWITCHBOARD, surface: 'desktop' })
  expect((await ui.find({ key: 't-break-timer' }))?.props['label']).toMatch(/^○/)
  await ui.press({ key: 't-break-timer' })
  expect((await ui.find({ key: 't-break-timer' }))?.props['label']).toMatch(/^●/)
  await ui.unmount()

  await work($)
  await workFor($, clock, 60)
  expect(await breaks($)).toHaveLength(1)
})

test('turned off mid-session, a due notice is held back', SLOW, async ($, on) => {
  const { clock, breaks } = boot(on)
  await start($)
  await work($)
  await workFor($, clock, 50)
  const ui = await $.ui.mount({ ...SWITCHBOARD, surface: 'desktop' })
  await ui.press({ key: 't-break-timer' })
  expect((await ui.find({ key: 't-break-timer' }))?.props['label']).toMatch(/^○/)
  await ui.unmount()
  await clock.advance(15 * MIN)
  expect(await breaks($)).toHaveLength(0)
})

test('Hebrew: the notice is in Hebrew', SLOW, async ($, on) => {
  const { clock } = boot(on, { language: 'he' })
  await start($)
  await work($)
  await workFor($, clock, 60)
  expect((await noticeRows($)).map(r => r.text)).toContain('עברה שעה של עבודה רצופה, רגע הפסקה?')
})
