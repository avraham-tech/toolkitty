import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, joined, labels, noticeTexts, start, turnDone, turnStart, world } from './harness'

const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const HANDOFF_START = 'Keep the task goal, the decisions made so far and why'

/*
 * The test `$` has no state noun: the plugin's atoms (and the signals bus) live in an in-memory
 * state beneath it, which the tests seed directly.
 */
type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
let items: Record<string, unknown>[] = []
let compactCalls: unknown[] = []
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

function setup(on: any, o: Parameters<typeof world>[1] = {}) {
  slots = new Map()
  items = []
  compactCalls = []
  const w = world(on, o)
  on('state.get', (_: any, e: any) => {
    const s = slots.get(slotKey(e))
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const prev = slots.get(slotKey(e))
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    slots.set(slotKey(e), { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  // The doctor must never compact: any call lands here (and is counted).
  on('session.compact', { trigger: 'plugin' }, (_: any, e: any) => {
    compactCalls.push(e)
    return { skip: 'test' } as any
  })
  return w
}

/** Puts one signal on the bus (replacing its id). */
const put = (id: string, kind: string, extra: Record<string, unknown> = {}): void => {
  const signal = { id, feature: id.split(':')[0] ?? 'x', kind, level: 'info', text: id, at: NOON, ...extra }
  items = [...items.filter(x => x['id'] !== id), signal]
  const k = 'toolkitty/slot/signals'
  slots.set(k, { value: { items }, version: (slots.get(k)?.version ?? 0) + 1 })
}
const waste = (n: number) => put('dup-read-detector:waste', 'waste', { value: n })
const coldCache = () => put('cache-countdown:cache', 'cache', { value: 0, text: 'cache cold' })
const failures = (n: number) => put('error-counter:turn', 'failure', { value: n })
const saved = (n: number) => put('savings:session', 'saving', { value: n })
const seedSavings = (tokens: number, byFeature: Record<string, number>) => slots.set('toolkitty/slot/savings', { value: { tokens, usd: 0, byFeature }, version: 1 })
const slotValue = (id: string): any => slots.get(`toolkitty/slot/${id}`)?.value

const paneOf = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('context-doctor'), surface })

async function chip($: any, surface: 'desktop' | 'terminal' = 'desktop'): Promise<{ text: string; color: unknown } | undefined> {
  const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
  const c = await b.find({ key: 'chip-context-doctor' })
  let out: { text: string; color: unknown } | undefined
  if (c !== undefined) {
    const txt = await b.find({ type: 'Text', text: c.text.trim() })
    out = { text: c.text.trim(), color: txt?.props['color'] }
  }
  await b.unmount()
  return out
}

/** The pane's status word ("32/100") and its colour. */
async function status(ui: any): Promise<{ text: string; color: unknown }> {
  const f = await ui.find({ type: 'Text', text: /^\d+\/100$/ })
  return { text: f.text as string, color: f.props['color'] }
}

const measure = ($: any, percent: number) => $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed: [] })

test('load: the command is registered, opens the pane, and nothing was compacted', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  expect(w.cmds).toContain('context-doctor')
  expect((await $.command.run({ command: 'context-doctor', args: '' })).text).toBe('Opened the Context Doctor.')
  expect(w.opened.map(o => o.id)).toContain('context-doctor')
  expect((await $.command.run({ command: 'context-doctor', args: 'anything' })).text).toBe('Opened the Context Doctor.')
  expect(compactCalls.length).toBe(0)
})

test('score: every penalty at once, with the formula lines shown', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 83
  await start($)
  waste(2)
  coldCache()
  failures(3)
  const ui = await paneOf($)
  expect(await status(ui)).toEqual({ text: '32/100', color: 'error' }) // 100 - 33 - 10 - 10 - 15
  const all = await joined(ui)
  expect(all).toContain('Context health')
  expect(all).toContain('Start → 100')
  expect(all).toContain('Context 83% → −33')
  expect(all).toContain('Duplicate reads 2 → −10 (5 each, at most 25)')
  expect(all).toContain('Cache cold with context over 40% → −10')
  expect(all).toContain('Repeated failures (3) → −15')
  expect(all).toContain('Score → 32')
  await ui.unmount()
})

test('score: healthy is 100 and quiet; each rule has its edge', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 40
  await start($)
  const ui = await paneOf($)
  expect(await status(ui)).toEqual({ text: '100/100', color: undefined })
  expect(await joined(ui)).toContain('Context 40% → 0 (penalty only above 50%)')
  expect(await joined(ui)).toContain('Cache not cold, or context 40% or less → 0')
  expect(await joined(ui)).toContain('Failures (0, repeated at 3) → 0')

  // exactly 40% is not over 40%; 41% is
  coldCache()
  await ui.redraw()
  expect((await status(ui)).text).toBe('100/100')
  w.usage.percent = 41
  await ui.redraw()
  expect((await status(ui)).text).toBe('90/100')

  // duplicate reads: 5 points each, at most 25
  w.usage.percent = 10
  waste(3)
  await ui.redraw()
  expect((await status(ui)).text).toBe('85/100')
  waste(40)
  await ui.redraw()
  expect((await status(ui)).text).toBe('75/100')
  expect(await joined(ui)).toContain('Duplicate reads 40 → −25')

  // two failures are not "repeated"
  failures(2)
  await ui.redraw()
  expect((await status(ui)).text).toBe('75/100')
  failures(3)
  await ui.redraw()
  expect((await status(ui)).text).toBe('60/100')
  await ui.unmount()
})

test('score: levels of the status word, and the context signal when usage has no percent', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 70 // 80 → ok
  await start($)
  const ui = await paneOf($)
  expect(await status(ui)).toEqual({ text: '80/100', color: undefined })
  w.usage.percent = 71 // 79 → warn
  await ui.redraw()
  expect(await status(ui)).toEqual({ text: '79/100', color: 'warning' })
  w.usage.percent = 100 // 50 → warn
  await ui.redraw()
  expect(await status(ui)).toEqual({ text: '50/100', color: 'warning' })
  waste(1) // 45 → alert
  await ui.redraw()
  expect(await status(ui)).toEqual({ text: '45/100', color: 'error' })

  w.usage.percent = undefined
  put('cost-meter:context', 'context', { value: 60 })
  await ui.redraw()
  expect(await joined(ui)).toContain('Context 60% → −10')
  expect((await status(ui)).text).toBe('85/100') // 100 - 10 - 5 (one duplicate)
  put('cost-meter:context', 'context', { value: undefined })
  await ui.redraw()
  expect(await joined(ui)).toContain('Context unknown → 0')
  await ui.unmount()
})

test('four numbers: each labelled, estimates marked, archived row only when reported', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 80
  await start($)
  const ui = await paneOf($)
  let all = await joined(ui)
  expect(all).toContain('In the conversation now')
  expect(all).toContain('80% of the window (token count is not exposed)')
  expect(all).toContain('Future use prevented (estimated)')
  expect(all).toContain('≈ 0 tokens')
  expect(all).not.toContain('Archived outside the conversation')
  expect(all).toContain('Reclaimable (estimated, verified only after a compaction)')
  expect(all).toContain('≈ 40% of the window')
  expect(all).toContain('Nothing has been compacted by the Context Doctor.')

  saved(12_000)
  seedSavings(15_000, { 'output-archive': 8_000, 'output-trimmer': 7_000 })
  await ui.redraw()
  all = await joined(ui)
  expect(all).toContain('≈ 12k tokens') // the savings signal, not the slot
  expect(all).toContain('Archived outside the conversation (estimated)')
  expect(all).toContain('≈ 8.0k tokens')

  // without a savings signal the store's total stands in
  items = []
  slots.set('toolkitty/slot/signals', { value: { items }, version: 99 })
  await ui.redraw()
  expect(await joined(ui)).toContain('≈ 15k tokens')

  w.usage.percent = undefined
  await ui.redraw()
  all = await joined(ui)
  expect(all).toContain('unknown')
  await ui.unmount()
})

test('four numbers: tokens in the conversation when the engine exposes them', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 62
  ;(w.usage as any).tokens = 124_000 // this group's harness passes `tokens` through to session.usage
  await start($)
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('124k tokens (62%)')
  expect(all).not.toContain('token count is not exposed')
  expect(all).toContain('≈ 62k tokens') // half of the active tokens, marked as an estimate
  await ui.unmount()
})

test('Analyze: records a snapshot, the shared health slot, the trend and a notice', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 83
  await start($)
  waste(2)
  coldCache()
  failures(3)
  const ui = await paneOf($)
  expect(await joined(ui)).not.toContain('Trend')
  expect(slotValue('context-health')).toBeUndefined()
  await ui.press({ key: 'doctor-analyze' })
  expect(slotValue('context-health')).toEqual({ score: 32, at: NOON })
  expect(slotValue('context-doctor').scores).toEqual([32])
  await ui.redraw()
  const all = await joined(ui)
  expect(all).toContain('Trend ▂')
  expect(all).toContain('Last analysis: score 32, context 83%')
  expect(await noticeTexts($)).toContain('Context health 32/100 recorded.')
  w.usage.percent = 20
  await ui.press({ key: 'doctor-analyze' })
  expect(slotValue('context-health').score).toBe(75) // 100 - 10 (2 dups) - 15 (3 failures); the cache penalty needs context over 40%
  expect(slotValue('context-doctor').scores).toEqual([32, 75])
  await ui.unmount()
})

test('Prepare optimization: previews what a compaction keeps, toggles, copies; compacts nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 60
  await start($)
  const ui = await paneOf($)
  expect(await ui.find({ key: 'doctor-copy' })).toBeUndefined()
  expect(await joined(ui)).not.toContain('Goal')
  await ui.press({ key: 'doctor-prepare' })
  await ui.redraw()
  let all = await joined(ui)
  for (const word of ['A compaction would keep (nothing is compacted here)', 'Goal', 'Decisions', 'Open items', 'Files', 'the task goal', 'open items and next steps', 'Dropped: exploratory dead ends']) {
    expect(all).toContain(word)
  }
  expect(all).toContain(HANDOFF_START)
  await ui.press({ key: 'doctor-copy' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]?.text.startsWith(HANDOFF_START)).toBe(true)
  expect(await noticeTexts($)).toContain('Copied.')
  w.copyOk = false
  await ui.press({ key: 'doctor-copy' })
  expect(await noticeTexts($)).toContain('Could not copy.')
  await ui.press({ key: 'doctor-prepare' })
  await ui.redraw()
  all = await joined(ui)
  expect(all).not.toContain('Goal')
  expect(compactCalls.length).toBe(0)
  await ui.unmount()
})

test('Create handoff and View waste open the right panes; a missing pane fails quietly; no compaction ever', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  w.usage.percent = 60
  await start($)
  const ui = await paneOf($)
  expect(await labels(ui)).toEqual(['Analyze', 'Prepare optimization', 'Create handoff', 'View waste'])

  await ui.press({ key: 'doctor-handoff' })
  expect(w.opened.find(o => o.id === 'handoff')).toEqual({ id: 'handoff', title: 'Toolkitty', focus: true, closeOnEscape: undefined })

  await ui.press({ key: 'doctor-waste' })
  expect(w.opened.find(o => o.id === 'toolkitty-detail')).toMatchObject({ id: 'toolkitty-detail', focus: true })
  expect(slotValue('detail-feature')).toBe('dup-read-detector')

  w.failOpen = true // the handoff pane (or any surface) is not there
  await ui.press({ key: 'doctor-handoff' })
  await ui.press({ key: 'doctor-waste' })
  expect((await status(ui)).text).toBe('90/100') // still drawn, nothing thrown

  await ui.press({ key: 'doctor-analyze' })
  await ui.press({ key: 'doctor-prepare' })
  expect(compactCalls.length).toBe(0)
  await ui.unmount()
})

test('the chip: quiet at 80 and over, warn below 80, alert below 50', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  w.usage.percent = 60 // 90
  expect(await chip($)).toBeUndefined()
  w.usage.percent = 70 // 80
  expect(await chip($)).toBeUndefined()
  w.usage.percent = 71 // 79
  expect(await chip($)).toEqual({ text: '♻ ctx health 79', color: 'warning' })
  w.usage.percent = 100 // 50
  expect((await chip($))?.text).toBe('♻ ctx health 50')
  expect((await chip($))?.color).toBe('warning')
  waste(1) // 45
  expect(await chip($)).toEqual({ text: '♻ ctx health 45', color: 'error' })
  const b = await $.ui.mount({ ...BAND('desktop', { hasSurvey: true }), requestId: 'band-survey' })
  expect(await b.find({ key: 'chip-context-doctor' })).toBeUndefined()
  await b.unmount()
})

test('the chip on the terminal, and what a press on it shows', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { surfaces: ['terminal'] })
  w.usage.percent = 83
  await start($, 'terminal')
  waste(2)
  expect((await chip($, 'terminal'))?.text).toBe('♻ ctx health 57')
  const b = await $.ui.mount({ ...BAND('terminal'), requestId: 'band-terminal-press' })
  await b.press({ key: 'chip-context-doctor' })
  await b.unmount()
  expect(slotValue('detail-feature')).toBe('context-doctor')
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'terminal' })
  const all = await joined(d)
  expect(all).toContain('Context health: 57/100')
  expect(all).toContain('Context 83% → −33')
  expect(all).toContain('In the conversation now: 83% of the window (token count is not exposed)')
  expect(all).toContain('Reclaimable (estimated, verified only after a compaction)')
  await d.unmount()
})

test('both surfaces draw the pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { surfaces: ['desktop', 'terminal'] })
  w.usage.percent = 83
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await paneOf($, surface)
    expect((await status(ui)).text).toBe('67/100')
    expect((await labels(ui)).length).toBe(4)
    await ui.press({ key: 'doctor-prepare' })
    await ui.redraw()
    expect(await joined(ui)).toContain('Decisions')
    await ui.press({ key: 'doctor-prepare' })
    await ui.unmount()
  }
})

test('measure and turn complete: score slot, deduplicated history, trend, cap of 50', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  w.usage.percent = 80
  await measure($, 80)
  expect(slotValue('context-health')).toEqual({ score: 70, at: NOON })
  expect(slotValue('context-doctor').scores).toEqual([70])
  await measure($, 80) // same score: nothing new
  expect(slotValue('context-doctor').scores).toEqual([70])
  w.usage.percent = 90
  await measure($, 90)
  expect(slotValue('context-health').score).toBe(60)
  expect(slotValue('context-doctor').scores).toEqual([70, 60])

  await turnStart($)
  await turnDone($) // a finished turn always adds a point
  expect(slotValue('context-doctor').scores).toEqual([70, 60, 60])
  await turnDone($, 1000, { agentId: 'sub-1' }) // subagents do not count
  expect(slotValue('context-doctor').scores).toEqual([70, 60, 60])

  const ui = await paneOf($)
  expect(await joined(ui)).toContain('Trend ▅▅▅')
  await ui.unmount()

  for (let i = 0; i < 60; i++) await turnDone($)
  expect(slotValue('context-doctor').scores.length).toBe(50)
  expect(compactCalls.length).toBe(0)
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { language: 'he' } })
  w.usage.percent = 83
  await start($)
  waste(2)
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('בריאות ההקשר')
  expect(all).toContain('הקשר 83% → −33')
  expect(all).toContain('בשיחה עכשיו')
  expect(all).toContain('ניתן לשחרור (הערכה, מאומת רק אחרי דחיסה)')
  expect(await labels(ui)).toEqual(['נתח', 'הכן אופטימיזציה', 'צור העברה', 'הצג בזבוז'])
  expect((await chip($))?.text).toBe('♻ בריאות 57')
  expect((await $.command.run({ command: 'context-doctor', args: '' })).text).toBe('רופא ההקשר נפתח.')
  await ui.unmount()
})

test('off switch: nothing recorded, no chip, the command and the pane say so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { enabled: { 'context-doctor': false } } })
  w.usage.percent = 95
  await start($)
  waste(4)
  expect((await $.command.run({ command: 'context-doctor', args: '' })).text).toBe(OFF)
  expect(w.opened.map(o => o.id)).not.toContain('context-doctor')
  expect(await chip($)).toBeUndefined()
  await measure($, 95)
  await turnStart($)
  await turnDone($)
  expect(slotValue('context-health')).toBeUndefined()
  expect(slotValue('context-doctor')).toBeUndefined()
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('The Context Doctor is off. Turn it on in the /toolkitty pane.')
  expect(await ui.find({ key: 'doctor-analyze' })).toBeUndefined()
  await ui.unmount()
  expect(compactCalls.length).toBe(0)
})
