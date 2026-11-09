import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

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
  const seen = { notes: [] as { text: string; title?: string }[] }
  const verdict = { decision: 'ask' as 'allow' | 'ask' | 'deny' }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    return { value: undefined }
  })
  on('ui.notify', (_: any, e: any) => {
    seen.notes.push({ text: e.text, title: e.title })
    return { value: { isSent: true } }
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
  on('tool.check', () => ({ decision: verdict.decision }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  // only this feature's two sentences
  const notes = () => seen.notes.filter(n => /finished the task|waiting for your approval|סיים את המשימה|ממתין לאישור/.test(n.text))
  return { clock, seen, notes, verdict }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const begin = ($: any, id = 't1', extra: Record<string, unknown> = {}) => $.turn.start({ text: 'hi', turnId: id, ...extra })
const done = ($: any, durationMs: number, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: 't1', reason: 'answer', ...extra })

test('loads with no hook skipped and a quick turn raises nothing', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await done($, 5_000)
  expect(notes()).toHaveLength(0)
})

test('a turn longer than 20 seconds notifies with its length', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await done($, 25_000)
  expect(notes()).toEqual([{ text: 'The session finished the task (0:25)', title: 'Claude Code' }])
})

test('exactly 20 seconds is still too short; one millisecond more notifies', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await done($, 20_000)
  expect(notes()).toHaveLength(0)
  await begin($)
  await done($, 20_001)
  expect(notes()).toHaveLength(1)
})

test('long durations read as h:mm:ss', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await done($, 3_725_000)
  expect(notes()[0]?.text).toBe('The session finished the task (1:02:05)')
})

test('without a reported duration the clock since the turn started is used', SLOW, async ($, on) => {
  const { clock, notes } = boot(on)
  await start($)
  await begin($)
  await clock.advance(45_000)
  await done($, 0)
  expect(notes()).toEqual([{ text: 'The session finished the task (0:45)', title: 'Claude Code' }])
})

test('without a duration and without a start, nothing is claimed', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await done($, 0)
  expect(notes()).toHaveLength(0)
})

test('an aborted turn does not notify', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await $.turn.complete({ answer: '', durationMs: 90_000, isAborted: true, turnId: 't1', reason: 'aborted' })
  expect(notes()).toHaveLength(0)
})

test('a failed turn (reason error, not aborted) still notifies', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await $.turn.complete({ answer: '', durationMs: 60_000, isAborted: false, turnId: 't1', reason: 'error' })
  expect(notes()).toHaveLength(1)
})

test('a subagent turn does not notify', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await begin($)
  await begin($, 's1', { agentId: 'a1' })
  await $.turn.complete({ answer: 'ok', durationMs: 90_000, isAborted: false, turnId: 's1', reason: 'answer', agentId: 'a1' })
  expect(notes()).toHaveLength(0)
})

test('the start is forgotten after a turn: a duration-less completion afterwards says nothing', SLOW, async ($, on) => {
  const { clock, notes } = boot(on)
  await start($)
  await begin($)
  await done($, 1_000)
  await clock.advance(60_000)
  await done($, 0)
  expect(notes()).toHaveLength(0)
})

test('an approval being asked raises the waiting notification with the tool name', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  const v = await $.tool.check({ tool: 'Bash', input: { command: 'rm x' }, tool_use_id: 'tu1' })
  expect(v.decision).toBe('ask')
  expect(notes()).toEqual([{ text: 'Claude Code is waiting for your approval (Bash)', title: 'Claude Code' }])
})

test('an allowed or denied check raises nothing and the verdict passes unchanged', SLOW, async ($, on) => {
  const { notes, verdict } = boot(on)
  await start($)
  verdict.decision = 'allow'
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'tu1' })).decision).toBe('allow')
  verdict.decision = 'deny'
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'tu2' })).decision).toBe('deny')
  expect(notes()).toHaveLength(0)
})

test('a check without a tool_use_id (a probe, not a real call) raises nothing', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  const v = await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  expect(v.decision).toBe('ask')
  expect(notes()).toHaveLength(0)
})

test('a subagent approval raises nothing', SLOW, async ($, on) => {
  const { notes } = boot(on)
  await start($)
  await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'tu1', agentId: 'a1' })
  expect(notes()).toHaveLength(0)
})

test('off switch: neither the finish nor the approval notifies', SLOW, async ($, on) => {
  const { notes } = boot(on, { enabled: { 'done-notify': false } })
  await start($)
  await begin($)
  await done($, 60_000)
  const v = await $.tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'tu1' })
  expect(v.decision).toBe('ask')
  expect(notes()).toHaveLength(0)
})

test('Hebrew: both notifications are in Hebrew', SLOW, async ($, on) => {
  const { notes } = boot(on, { language: 'he' })
  await start($)
  await begin($)
  await done($, 30_000)
  await $.tool.check({ tool: 'Edit', input: {}, tool_use_id: 'tu1' })
  expect(notes().map(n => n.text)).toEqual(['הסשן סיים את המשימה (0:30)', 'Claude Code ממתין לאישור שלך (Edit)'])
})
