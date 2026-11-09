import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

const BAND = {
  plugin: 'toolkitty',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const DETAIL = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

type Outcome = { fail?: boolean; text?: string; deny?: string }

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
  const seen = { opened: [] as string[], toasts: [] as string[] }
  // What the next tool call comes back as: the engine's side of `tool.call`.
  const outcome: Outcome = {}
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
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
  on('tool.call', () => {
    if (outcome.deny !== undefined) return { deny: outcome.deny }
    if (outcome.fail === true) return { isError: true, result: outcome.text ?? '', ...(outcome.text === undefined ? {} : { text: outcome.text }) }
    return { result: {} }
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, outcome }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const begin = ($: any, id = 't1') => $.turn.start({ text: 'hi', turnId: id })
const done = ($: any, id = 't1') => $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer' })

// The band shows two lines and hides the rest behind a toggle: open it so every line is drawn.
/** A list row is two Texts (the dim left column, then the text); join them back as "left · text". */
async function rowsAfter(ui: any, left: RegExp): Promise<string[]> {
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  return all.flatMap((x, i) => (left.test(x) && i + 1 < all.length ? [`${x} · ${all[i + 1]}`] : []))
}

/** The chip Text the band draws for this feature in its compact row: its text and color, or undefined. */
async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const button = await ui.find({ key: 'chip-error-counter' })
  const text = await ui.find({ type: 'Text', text: button?.text ?? '\u0000' })
  await ui.unmount()
  return button === undefined ? undefined : { text: button.text as string, color: text?.props['color'] as string | undefined }
}

async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

async function bandLine($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const line = await ui.find({ key: 'band-error-counter' })
  await ui.unmount()
  return line
}

const bandText = async ($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) =>
  (await bandLine($, surface, props))?.text as string | undefined

async function openDetail($: any) {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-error-counter' })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface: 'desktop' })
}

test('loads with no hook skipped and shows no band without failures', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await bandText($)).toBeUndefined()
  await done($)
})

test('one failed action: singular wording, warning colour, on both surfaces', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'command not found: foo'
  await $.tool.call({ tool: 'Bash', command: 'foo' })
  expect(await bandText($)).toBe('⚠ 1 action failed this turn · 1 this session')
  expect(await bandText($, 'terminal')).toBe('⚠ 1 action failed this turn · 1 this session')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(ui)
  expect((await ui.find({ type: 'Text', text: /action failed/ }))?.props['color']).toBe('warning')
  await ui.unmount()
})

test('several failures: plural wording with turn and session counts', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'boom'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/x' })
  await $.tool.call({ tool: 'Bash', command: 'b' })
  expect(await bandText($)).toBe('⚠ 3 actions failed this turn · 3 this session')
})

test('a new turn resets the turn count but not the session count', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'boom'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  await $.tool.call({ tool: 'Bash', command: 'b' })
  await done($)
  // still shown after the turn ended
  expect(await bandText($)).toBe('⚠ 2 actions failed this turn · 2 this session')

  await begin($, 't2')
  expect(await bandText($)).toBeUndefined()
  await $.tool.call({ tool: 'Bash', command: 'c' })
  expect(await bandText($)).toBe('⚠ 1 action failed this turn · 3 this session')
})

test('a subagent turn start does not reset the count', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'boom'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  expect(await bandText($)).toBe('⚠ 1 action failed this turn · 1 this session')
})

test('successful calls and denied calls are not counted', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  outcome.deny = 'not allowed'
  const r = await $.tool.call({ tool: 'Bash', command: 'rm x' })
  expect(r.deny).toBe('not allowed')
  expect(await bandText($)).toBeUndefined()
})

test('the failure is passed through unchanged to the caller', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'exit code 2'
  const r = await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(r.isError).toBe(true)
  expect(r.text).toBe('exit code 2')
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'boom'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  expect(await bandText($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane lists failures newest first with age, tool and text, and its buttons work', SLOW, async ($, on) => {
  const { outcome, clock, seen } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'first   failure\n  on two lines'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  await clock.advance(30_000)
  outcome.text = 'second failure'
  await $.tool.call({ tool: 'Edit', file_path: 'C:/x', old_string: 'a', new_string: 'b' })
  await clock.advance(5_000)

  const ui = await openDetail($)
  expect(seen.opened).toContain('toolkitty-detail')
  expect(await ui.find({ type: 'Text', text: 'Failure counter' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Failed actions this session: 2 (newest first)' })).toBeDefined()
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows).toEqual(['0:05 ago · Edit · second failure', '0:35 ago · Bash · first failure on two lines'])

  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBe('⚠ 2 actions failed this turn · 2 this session')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('a long error text is cut at 100 characters and an empty one says so', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'x'.repeat(250)
  await $.tool.call({ tool: 'Bash', command: 'a' })
  outcome.text = undefined
  await $.tool.call({ tool: 'Read', file_path: 'C:/none' })

  const ui = await openDetail($)
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows[0]).toBe('0:00 ago · Read · (no error text)')
  expect(rows[1]).toBe(`0:00 ago · Bash · ${'x'.repeat(100)}`)
  await ui.unmount()
})

test('with no text, a Bash failure falls back to the command', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  await $.tool.call({ tool: 'Bash', command: 'npm  run   build' })
  const ui = await openDetail($)
  expect(await rowsAfter(ui, / ago$/)).toContain('0:00 ago · Bash · npm run build')
  await ui.unmount()
})

test('the detail pane shows the last 14 failures and the session count keeps going', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  outcome.fail = true
  for (let i = 1; i <= 16; i++) {
    outcome.text = `fail ${i}`
    await $.tool.call({ tool: 'Bash', command: `c${i}` })
  }
  expect(await bandText($)).toBe('⚠ 16 actions failed this turn · 16 this session')
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'Failed actions this session: 16 (newest first)' })).toBeDefined()
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows).toHaveLength(14)
  expect(rows[0]).toContain('fail 16')
  expect(rows[13]).toContain('fail 3')
  await ui.unmount()
})

test('off switch: failures are not counted and the band is gone', SLOW, async ($, on) => {
  const { outcome } = boot(on, { enabled: { 'error-counter': false } })
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'boom'
  const r = await $.tool.call({ tool: 'Bash', command: 'a' })
  expect(r.isError).toBe(true)
  expect(await bandText($)).toBeUndefined()
})

test('Hebrew: band wording for one and for many, and the detail pane', SLOW, async ($, on) => {
  const { outcome } = boot(on, { language: 'he' })
  await start($)
  await begin($)
  outcome.fail = true
  outcome.text = 'שגיאה'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  expect(await bandText($)).toBe('⚠ פעולה אחת נכשלה בתור הזה · 1 בסשן')
  await $.tool.call({ tool: 'Bash', command: 'b' })
  expect(await bandText($)).toBe('⚠ 2 פעולות נכשלו בתור הזה · 2 בסשן')

  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'מונה כשלונות' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'פעולות שנכשלו בסשן: 2 (החדשות ראשונות)' })).toBeDefined()
  expect(await rowsAfter(ui, /^לפני /)).toContain('לפני 0:00 · Bash · שגיאה')
  await ui.unmount()
})

test('the chip is the short form, red, and quiet when this turn had no failure', SLOW, async ($, on) => {
  const { outcome } = boot(on)
  await start($)
  await begin($)
  expect(await chipOf($)).toBeUndefined()
  outcome.fail = true
  outcome.text = 'boom'
  await $.tool.call({ tool: 'Bash', command: 'a' })
  expect(await chipOf($)).toEqual({ text: '\u25b2 1 failed \u00b7 1', color: 'error' })
  expect((await chipOf($, 'terminal'))?.text).toBe('\u25b2 1 failed \u00b7 1')
  await $.tool.call({ tool: 'Bash', command: 'b' })
  expect((await chipOf($))?.text).toBe('\u25b2 2 failed \u00b7 2')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()
  // a new turn starts from zero again, the session count stays in the detail pane
  await begin($, 't2')
  expect(await chipOf($)).toBeUndefined()
})
