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

type Usage = { usd?: number; percent?: number }

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
  const usage: Usage = { usd: 0, percent: 0 }
  const seen = { opened: [] as string[], toasts: [] as string[] }
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
  on('session.usage', () => ({
    value: {
      startedAt: T0,
      context: { window: 200_000, ...(usage.percent === undefined ? {} : { percent: usage.percent }) },
      rateLimits: [],
      ...(usage.usd === undefined ? {} : { cost: { usd: usage.usd } }),
    },
  }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, usage }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const done = (id = 't1', extra: Record<string, unknown> = {}) => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  turnId: id,
  reason: 'answer' as const,
  ...extra,
})

async function finishTurn($: any, id: string) {
  await $.turn.start({ text: 'hi', turnId: id })
  await $.turn.complete(done(id))
}


// The band shows two lines and hides the rest behind a toggle: open it so every line is drawn.
async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

/** A list row is two Texts (the dim left column, then the text); join them back as "left · text". */
async function rowsAfter(ui: any, left: RegExp): Promise<string[]> {
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  return all.flatMap((x, i) => (left.test(x) && i + 1 < all.length ? [`${x} · ${all[i + 1]}`] : []))
}

/** The chip Text the band draws for this feature in its compact row: its text and color, or undefined. */
async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const button = await ui.find({ key: 'chip-cost-meter' })
  const text = await ui.find({ type: 'Text', text: button?.text ?? '\u0000' })
  await ui.unmount()
  return button === undefined ? undefined : { text: button.text as string, color: text?.props['color'] as string | undefined }
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const line = await ui.find({ key: 'band-cost-meter' })
  const text = line?.text
  await ui.unmount()
  return text as string | undefined
}

async function openDetail($: any) {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-cost-meter' })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface: 'desktop' })
}

test('loads with no hook skipped and shows no band before a turn finished', SLOW, async ($, on) => {
  boot(on)
  await start($)
  expect(await bandText($)).toBeUndefined()
})

test('a finished turn shows cost and context in the band, on both surfaces', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  usage.usd = 1.5
  usage.percent = 42
  await finishTurn($, 't1')
  expect(await bandText($)).toBe('Cost $1.50 · Context 42%')
  expect(await bandText($, 'terminal')).toBe('Cost $1.50 · Context 42%')
})

test('the context percent is rounded and coloured warning past 70 and error past 90', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)

  const colorOf = async (percentText: string) => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const el = await ui.find({ type: 'Text', text: new RegExp('^' + percentText + '$') })
    await ui.unmount()
    return el?.props['color']
  }

  usage.usd = 1
  usage.percent = 42.4
  await finishTurn($, 't1')
  expect(await bandText($)).toBe('Cost $1.00 · Context 42%')
  expect(await colorOf('42%')).toBeUndefined()

  usage.percent = 70
  await finishTurn($, 't2')
  expect(await colorOf('70%')).toBeUndefined()

  usage.percent = 70.6
  await finishTurn($, 't3')
  expect(await bandText($)).toBe('Cost $1.00 · Context 71%')
  expect(await colorOf('71%')).toBe('warning')

  usage.percent = 90
  await finishTurn($, 't4')
  expect(await colorOf('90%')).toBe('warning')

  usage.percent = 95
  await finishTurn($, 't5')
  expect(await colorOf('95%')).toBe('error')
})

test('a missing context percent shows a dash and a missing cost counts as zero', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  usage.usd = undefined
  usage.percent = undefined
  await finishTurn($, 't1')
  expect(await bandText($)).toBe('Cost $0.00 · Context —')
})

test('a subagent turn adds no cost row', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  usage.usd = 3
  usage.percent = 10
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete(done('s1', { agentId: 'a1' }))
  expect(await bandText($)).toBeUndefined()
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  usage.usd = 1
  await finishTurn($, 't1')
  expect(await bandText($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane lists the per-turn deltas newest first and its buttons work', SLOW, async ($, on) => {
  const { usage, clock, seen } = boot(on)
  await start($)

  usage.usd = 1.5
  usage.percent = 20
  await finishTurn($, 't1')
  await clock.advance(61_000)
  usage.usd = 2.25
  usage.percent = 30
  await finishTurn($, 't2')
  await clock.advance(5_000)

  const ui = await openDetail($)
  expect(seen.opened).toContain('toolkitty-detail')
  expect(await ui.find({ type: 'Text', text: 'Cost meter' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Cost $2.25 · Context 30%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Cost per turn (newest first)' })).toBeDefined()
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows).toEqual(['0:05 ago · +$0.75 · total $2.25', '1:06 ago · +$1.50 · total $1.50'])

  const keys = (await ui.findAll({ type: 'Button' })).map(b => b.key)
  expect(keys).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))

  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBe('Cost $2.25 · Context 30%')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('a cost that drops (a new session, a reset) is counted as the whole new cost', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  usage.usd = 5
  await finishTurn($, 't1')
  usage.usd = 0.5
  await finishTurn($, 't2')
  const ui = await openDetail($)
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows[0]).toBe('0:00 ago · +$0.50 · total $0.50')
  expect(rows[1]).toBe('0:00 ago · +$5.00 · total $5.00')
  await ui.unmount()
})

test('the detail pane shows only the last 10 turns', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  for (let i = 1; i <= 12; i++) {
    usage.usd = i
    await finishTurn($, `t${i}`)
  }
  const ui = await openDetail($)
  const rows = await rowsAfter(ui, / ago$/)
  expect(rows).toHaveLength(10)
  expect(rows[0]).toContain('total $12.00')
  expect(rows[9]).toContain('total $3.00')
  await ui.unmount()
})

test('off switch: no band line, no recording, detail draws nothing', SLOW, async ($, on) => {
  const { usage } = boot(on, { enabled: { 'cost-meter': false } })
  await start($)
  usage.usd = 4
  await finishTurn($, 't1')
  expect(await bandText($)).toBeUndefined()
})

test('Hebrew: band and detail pane words are in Hebrew', SLOW, async ($, on) => {
  const { usage, clock } = boot(on, { language: 'he' })
  await start($)
  usage.usd = 1.5
  usage.percent = 42
  await finishTurn($, 't1')
  await clock.advance(1000)
  expect(await bandText($)).toBe('עלות $1.50 · הקשר 42%')
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'מד עלות' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'עלות לכל תור (החדשים ראשונים)' })).toBeDefined()
  expect(await rowsAfter(ui, /^לפני /)).toEqual(['לפני 0:01 · +$1.50 · סה"כ $1.50'])
  await ui.unmount()
})

test('the chip is the short form: cost and context, amber past 70, red past 90', SLOW, async ($, on) => {
  const { usage } = boot(on)
  await start($)
  expect(await chipOf($)).toBeUndefined()

  usage.usd = 1.5
  usage.percent = 42
  await finishTurn($, 't1')
  expect(await chipOf($)).toEqual({ text: '\u25d4 $1.50 \u00b7 42%', color: undefined })
  expect((await chipOf($, 'terminal'))?.text).toBe('\u25d4 $1.50 \u00b7 42%')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()

  usage.usd = 124.4
  usage.percent = 71
  await finishTurn($, 't2')
  expect(await chipOf($)).toEqual({ text: '\u25d4 $124 \u00b7 71%', color: 'warning' })

  usage.percent = 91
  await finishTurn($, 't3')
  expect((await chipOf($))?.color).toBe('error')

  usage.percent = null
  await finishTurn($, 't4')
  expect((await chipOf($))?.text).toBe('\u25d4 $124')
})
