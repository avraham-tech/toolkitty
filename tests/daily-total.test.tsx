import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const HOUR = 3_600_000
const DAY = 24 * HOUR

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

// The key the feature uses for a moment: the local calendar day.
const dayOf = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const TODAY = dayOf(T0)

const OWN_FAILURE = /feature (task-pulse|cost-meter|daily-total|model-indicator|error-counter|uncommitted-reminder|break-timer|long-turn-toast|done-notify) failed/

/** Toolkitty reports a feature handler that threw as a toast; for this feature that is a test failure. */
function noOwnFailure(text: string) {
  if (OWN_FAILURE.test(text)) throw new Error('a feature handler threw: ' + text)
}

// Every call the plugin makes on `$` is answered here, the engine's side.
function boot(on: any, store: Record<string, unknown> = {}, now = T0) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { opened: [] as string[] }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.notify', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: [] }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200_000 }, rateLimits: [] } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })

async function finishTurn($: any, id: string, durationMs: number, extra: Record<string, unknown> = {}) {
  await $.turn.start({ text: 'hi', turnId: id, ...(extra['agentId'] === undefined ? {} : { agentId: extra['agentId'] }) })
  await $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: id, reason: 'answer', ...extra })
}


// The band shows two lines and hides the rest behind a toggle: open it so every line is drawn.
/** A list row is two Texts (the dim left column, then the text); join them back as "left · text". */
async function rowsAfter(ui: any, left: RegExp): Promise<string[]> {
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  return all.flatMap((x, i) => (left.test(x) && i + 1 < all.length ? [`${x} · ${all[i + 1]}`] : []))
}

async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

/** The chip Text the band draws for this feature in its compact row: its text and color, or undefined. */
async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const button = await ui.find({ key: 'chip-daily-total' })
  const text = await ui.find({ type: 'Text', text: button?.text ?? '\u0000' })
  await ui.unmount()
  return button === undefined ? undefined : { text: button.text as string, color: text?.props['color'] as string | undefined }
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const line = await ui.find({ key: 'band-daily-total' })
  const text = line?.text
  await ui.unmount()
  return text as string | undefined
}

async function openDetail($: any) {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-daily-total' })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface: 'desktop' })
}

test('loads with no hook skipped and shows no band before a turn finished', SLOW, async ($, on) => {
  boot(on)
  await start($)
  expect(await bandText($)).toBeUndefined()
})

test('turns add up to hours:minutes in the band, on both surfaces', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await finishTurn($, 't1', 90 * 60_000)
  expect(await bandText($)).toBe('Today: 1:30 hours of work with Claude')
  await finishTurn($, 't2', 45 * 60_000)
  expect(await bandText($)).toBe('Today: 2:15 hours of work with Claude')
  expect(await bandText($, 'terminal')).toBe('Today: 2:15 hours of work with Claude')
})

test('minutes round down and the hour field passes ten', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await finishTurn($, 't1', 59_999)
  expect(await bandText($)).toBe('Today: 0:00 hours of work with Claude')
  await finishTurn($, 't2', 11 * HOUR + 5 * 60_000)
  expect(await bandText($)).toBe('Today: 11:05 hours of work with Claude')
})

test('the total is kept in the store under today and picks up what an earlier session wrote', SLOW, async ($, on) => {
  boot(on, { [`daily-total:${TODAY}`]: HOUR })
  await start($)
  await finishTurn($, 't1', 60_000)
  expect(await bandText($)).toBe('Today: 1:01 hours of work with Claude')
  const ui = await openDetail($)
  expect(await rowsAfter(ui, /^\d{4}-\d{2}-\d{2}$/)).toContain(`${TODAY} · 1:01`)
  await ui.unmount()
})

test('a negative duration adds nothing', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await finishTurn($, 't1', 30 * 60_000)
  await finishTurn($, 't2', -5000)
  expect(await bandText($)).toBe('Today: 0:30 hours of work with Claude')
})

test('a new day starts a new total', SLOW, async ($, on) => {
  // two minutes before local midnight, so crossing it costs few timer ticks
  const lateEvening = new Date(2023, 10, 14, 23, 58, 0).getTime()
  const { clock } = boot(on, {}, lateEvening)
  await start($)
  await finishTurn($, 't1', 2 * HOUR)
  await clock.advance(5 * 60_000)
  await finishTurn($, 't2', 10 * 60_000)
  expect(dayOf(lateEvening + 5 * 60_000)).not.toBe(dayOf(lateEvening))
  expect(await bandText($)).toBe('Today: 0:10 hours of work with Claude')
  const ui = await openDetail($)
  expect(await rowsAfter(ui, /^\d{4}-\d{2}-\d{2}$/)).toContain(`${dayOf(lateEvening)} · 2:00`)
  expect(await rowsAfter(ui, /^\d{4}-\d{2}-\d{2}$/)).toContain(`${dayOf(lateEvening + 5 * 60_000)} · 0:10`)
  await ui.unmount()
})

test('a subagent turn adds no time', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await finishTurn($, 's1', HOUR, { agentId: 'a1' })
  expect(await bandText($)).toBeUndefined()
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await finishTurn($, 't1', HOUR)
  expect(await bandText($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane shows today, the week newest first, and its buttons work', SLOW, async ($, on) => {
  const old = (n: number) => `daily-total:${dayOf(T0 - n * DAY)}`
  const { seen } = boot(on, { [old(1)]: 3 * HOUR + 7 * 60_000, [old(2)]: 30 * 60_000 })
  await start($)
  await finishTurn($, 't1', 20 * 60_000)
  await finishTurn($, 't2', 10 * 60_000)

  const ui = await openDetail($)
  expect(seen.opened).toContain('toolkitty-detail')
  expect(await ui.find({ type: 'Text', text: 'Daily total' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Today: 0:30 of work · 2 turns this session' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Last 7 days' })).toBeDefined()
  const rows = await rowsAfter(ui, /^\d{4}-\d{2}-\d{2}$/)
  expect(rows).toEqual([`${TODAY} · 0:30`, `${dayOf(T0 - DAY)} · 3:07`, `${dayOf(T0 - 2 * DAY)} · 0:30`])

  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBe('Today: 0:30 hours of work with Claude')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('only the last 7 days are kept in the store and listed', SLOW, async ($, on) => {
  const seed: Record<string, unknown> = {}
  for (let n = 1; n <= 9; n++) seed[`daily-total:${dayOf(T0 - n * DAY)}`] = n * 60_000
  boot(on, seed)
  await start($)
  await finishTurn($, 't1', 60_000)

  const ui = await openDetail($)
  const rows = await rowsAfter(ui, /^\d{4}-\d{2}-\d{2}$/)
  expect(rows).toHaveLength(7)
  expect(rows[0]).toBe(`${TODAY} · 0:01`)
  // the oldest kept is 6 days back; days 7, 8 and 9 were pruned
  expect(rows[6]).toBe(`${dayOf(T0 - 6 * DAY)} · 0:06`)
  expect(rows).not.toContain(`${dayOf(T0 - 7 * DAY)} · 0:07`)
  await ui.unmount()
})

test('off switch: nothing recorded, no band line', SLOW, async ($, on) => {
  boot(on, { enabled: { 'daily-total': false } })
  await start($)
  await finishTurn($, 't1', HOUR)
  expect(await bandText($)).toBeUndefined()
})

test('Hebrew: the band and the detail pane are in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  await finishTurn($, 't1', 75 * 60_000)
  expect(await bandText($)).toBe('היום: 1:15 שעות עבודה עם Claude')
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'סה״כ יומי' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '7 הימים האחרונים' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'היום: 1:15 עבודה · 1 תורים בסשן הזה' })).toBeDefined()
  await ui.unmount()
})

test('the chip is the short form: the hours today', SLOW, async ($, on) => {
  boot(on)
  await start($)
  expect(await chipOf($)).toBeUndefined()
  await finishTurn($, 't1', 75 * 60_000)
  expect(await chipOf($)).toEqual({ text: '\u25d4 1:15 today', color: undefined })
  expect((await chipOf($, 'terminal'))?.text).toBe('\u25d4 1:15 today')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('Hebrew: the chip is in Hebrew', SLOW, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  await finishTurn($, 't1', 75 * 60_000)
  expect((await chipOf($))?.text).toBe('\u25d4 \u05d4\u05d9\u05d5\u05dd 1:15')
})

test('off switch: no chip', SLOW, async ($, on) => {
  boot(on, { enabled: { 'daily-total': false } })
  await start($)
  await finishTurn($, 't1', HOUR)
  expect(await chipOf($)).toBeUndefined()
})
