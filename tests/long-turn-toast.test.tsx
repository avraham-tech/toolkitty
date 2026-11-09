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

const RUNNING = /The turn has been running|התור רץ כבר|Ход выполняется/

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
function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { toasts: [] as string[] }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    seen.toasts.push(e.text)
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
  const running = async ($: any) => (await noticeRows($)).filter(r => RUNNING.test(r.text)).map(r => r.text)
  return { clock, seen, running }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const begin = ($: any, id = 't1', extra: Record<string, unknown> = {}) => $.turn.start({ text: 'hi', turnId: id, ...extra })
const done = ($: any, id = 't1', extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer', ...extra })

test('loads with no hook skipped and a short turn raises nothing', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  await clock.advance(4 * MIN + 59_000)
  expect(await running($)).toHaveLength(0)
  await done($)
})

test('an alert notice every 5 minutes with the elapsed minutes', SLOW, async ($, on) => {
  const { clock, running, seen } = boot(on)
  await start($)
  await begin($)
  await clock.advance(5 * MIN)
  expect(await running($)).toEqual(['The turn has been running for 5 minutes'])
  // alert level: red in the notices pane, and it toasts too
  expect((await noticeRows($)).find(r => RUNNING.test(r.text))?.color).toBe('error')
  expect(seen.toasts.filter(t => RUNNING.test(t))).toEqual(['The turn has been running for 5 minutes'])
  await clock.advance(5 * MIN)
  expect(await running($)).toEqual(['The turn has been running for 5 minutes', 'The turn has been running for 10 minutes'])
  await clock.advance(5 * MIN)
  expect((await running($))[2]).toBe('The turn has been running for 15 minutes')
  await done($)
})

test('the timer is cancelled when the turn completes', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  await clock.advance(3 * MIN)
  await done($)
  await clock.advance(30 * MIN)
  expect(await running($)).toHaveLength(0)
})

test('an aborted turn also stops the timer', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  await clock.advance(3 * MIN)
  await $.turn.complete({ answer: '', durationMs: 180_000, isAborted: true, turnId: 't1', reason: 'aborted' })
  await clock.advance(30 * MIN)
  expect(await running($)).toHaveLength(0)
})

test('a new turn starts its own count and cancels the old timer', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  await clock.advance(3 * MIN)
  await begin($, 't2')
  await clock.advance(2 * MIN)
  expect(await running($)).toHaveLength(0)
  await clock.advance(3 * MIN)
  expect(await running($)).toEqual(['The turn has been running for 5 minutes'])
})

test('a subagent turn neither starts nor stops the timer', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  await clock.advance(2 * MIN)
  await begin($, 's1', { agentId: 'a1' })
  await done($, 's1', { agentId: 'a1' })
  await clock.advance(3 * MIN)
  expect(await running($)).toEqual(['The turn has been running for 5 minutes'])
  await done($)
})

test('off switch: no timer, no notice', SLOW, async ($, on) => {
  const { clock, running } = boot(on, { enabled: { 'long-turn-toast': false } })
  await start($)
  await begin($)
  await clock.advance(20 * MIN)
  expect(await running($)).toHaveLength(0)
  await done($)
})

test('turned off during a turn from the switchboard the timer goes quiet; on again it speaks', SLOW, async ($, on) => {
  const { clock, running } = boot(on)
  await start($)
  await begin($)
  const ui = await $.ui.mount({ ...SWITCHBOARD, surface: 'desktop' })
  expect((await ui.find({ key: 't-long-turn-toast' }))?.props['label']).toMatch(/^●/)
  await ui.press({ key: 't-long-turn-toast' })
  expect((await ui.find({ key: 't-long-turn-toast' }))?.props['label']).toMatch(/^○/)
  await clock.advance(5 * MIN)
  expect(await running($)).toHaveLength(0)

  await ui.press({ key: 't-long-turn-toast' })
  await ui.unmount()
  await clock.advance(5 * MIN)
  expect(await running($)).toEqual(['The turn has been running for 10 minutes'])
  await done($)
})

test('Hebrew: the notice is in Hebrew', SLOW, async ($, on) => {
  const { clock } = boot(on, { language: 'he' })
  await start($)
  await begin($)
  await clock.advance(5 * MIN)
  expect((await noticeRows($)).map(r => r.text)).toContain('התור רץ כבר 5 דקות')
  await done($)
})
