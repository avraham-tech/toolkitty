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
  const seen = { opened: [] as string[] }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('turn.step', async function* (_: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })

/** One model request of a turn, read to its end as the engine does. */
async function step($: any, input: Record<string, unknown>) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-4-1', messageCount: 1, ...input })
  const it = stream[Symbol.asyncIterator]()
  for (;;) {
    const next = await it.next()
    if (next.done) return next.value
  }
}


// The band shows two lines and hides the rest behind a toggle: open it so every line is drawn.
async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

/** The chip Text the band draws for this feature in its compact row: its text and color, or undefined. */
async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const button = await ui.find({ key: 'chip-model-indicator' })
  const text = await ui.find({ type: 'Text', text: button?.text ?? '\u0000' })
  await ui.unmount()
  return button === undefined ? undefined : { text: button.text as string, color: text?.props['color'] as string | undefined }
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const line = await ui.find({ key: 'band-model-indicator' })
  const text = line?.text
  await ui.unmount()
  return text as string | undefined
}

async function openDetail($: any) {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-model-indicator' })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface: 'desktop' })
}

test('loads with no hook skipped and shows no band before a model request', SLOW, async ($, on) => {
  boot(on)
  await start($)
  expect(await bandText($)).toBeUndefined()
})

test('the first request of a turn sets the model and effort in the band, on both surfaces', SLOW, async ($, on) => {
  boot(on)
  await start($)
  const r = await step($, { effort: 'high' })
  expect(r.answer).toBe('')
  expect(await bandText($)).toBe('Model claude-opus-4-1 · effort high')
  expect(await bandText($, 'terminal')).toBe('Model claude-opus-4-1 · effort high')
})

test('no effort shows the model alone', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, { model: 'claude-sonnet-5-5' })
  expect(await bandText($)).toBe('Model claude-sonnet-5-5')
})

test('a numeric effort is shown as a number', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, { effort: 8000 })
  expect(await bandText($)).toBe('Model claude-opus-4-1 · effort 8000')
})

test('a later request in the same turn (index above 0) does not change it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, { effort: 'low' })
  await step($, { index: 1, model: 'claude-haiku-5-5', effort: 'max' })
  expect(await bandText($)).toBe('Model claude-opus-4-1 · effort low')
})

test('the next turn replaces it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, { effort: 'low' })
  await step($, { turnId: 't2', model: 'claude-haiku-5-5', effort: 'max' })
  expect(await bandText($)).toBe('Model claude-haiku-5-5 · effort max')
})

test('a subagent request does not change it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, { effort: 'low' })
  await step($, { agentId: 'a1', model: 'claude-haiku-5-5', effort: 'max' })
  expect(await bandText($)).toBe('Model claude-opus-4-1 · effort low')
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await step($, {})
  expect(await bandText($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane shows the model and effort and its buttons work', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  await step($, { effort: 'xhigh' })

  const ui = await openDetail($)
  expect(seen.opened).toContain('toolkitty-detail')
  expect(await ui.find({ type: 'Text', text: 'Model indicator' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Model claude-opus-4-1 · effort xhigh' })).toBeDefined()

  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBe('Model claude-opus-4-1 · effort xhigh')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('a request passes through untouched: the result comes from beneath', SLOW, async ($, on) => {
  boot(on)
  await start($)
  const r = await step($, { effort: 'high' })
  expect(r).toEqual({ turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null })
})

test('off switch: nothing is recorded, no band line, the request still passes', SLOW, async ($, on) => {
  boot(on, { enabled: { 'model-indicator': false } })
  await start($)
  const r = await step($, { effort: 'high' })
  expect(r.stopReason).toBe('end_turn')
  expect(await bandText($)).toBeUndefined()
})

test('Hebrew: the band and the detail pane are in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  await step($, { effort: 'high' })
  expect(await bandText($)).toBe('מודל claude-opus-4-1 · מאמץ high')
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'מחוון מודל' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'מודל claude-opus-4-1 · מאמץ high' })).toBeDefined()
  await ui.unmount()
})

test('the chip is the short form: the model without its vendor prefix, plus the effort', SLOW, async ($, on) => {
  boot(on)
  await start($)
  expect(await chipOf($)).toBeUndefined()
  await step($, { effort: 'high' })
  expect(await chipOf($)).toEqual({ text: '\u25d4 opus-4-1 high', color: undefined })
  expect((await chipOf($, 'terminal'))?.text).toBe('\u25d4 opus-4-1 high')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()
  await step($, { model: 'claude-haiku-4-5-20251001' })
  expect((await chipOf($))?.text).toBe('\u25d4 haiku-4-5')
})

test('off switch: no chip', SLOW, async ($, on) => {
  boot(on, { enabled: { 'model-indicator': false } })
  await start($)
  await step($, { effort: 'high' })
  expect(await chipOf($)).toBeUndefined()
})
