import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, joined, labels, noticeTexts, start, world, refusal } from './harness'

const OFF = 'The Smart Advisor is off. Turn it on in the /toolkitty pane.'

/*
 * The test `$` has no state noun, so the signals are written into an in-memory
 * state beneath the plugin (the same store every atom of the plugin goes through).
 */
type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
let items: Record<string, unknown>[] = []
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

/** The standard world plus a working state store. */
function setup(on: any, o: Parameters<typeof world>[1] = {}) {
  slots = new Map()
  items = []
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
  return w
}

/** Puts one signal on the bus (replacing its id), `ageMs` old by the mock clock. */
const put = async (_: any, id: string, kind: string, extra: Record<string, unknown> = {}, ageMs = 0): Promise<void> => {
  const signal = { id, feature: id.split(':')[0] ?? 'x', kind, level: 'info', text: id, at: NOON - ageMs, ...extra }
  items = [...items.filter(x => x['id'] !== id), signal]
  const k = 'toolkitty/slot/signals'
  slots.set(k, { value: { items }, version: (slots.get(k)?.version ?? 0) + 1 })
}

/** The advisor's headline chip as the band draws it. */
async function chip($: any, surface: 'desktop' | 'terminal' = 'desktop'): Promise<{ text: string; color: unknown } | undefined> {
  const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
  const c = await b.find({ key: 'chip-advisor' })
  const t = c === undefined ? undefined : await b.find({ type: 'Text', text: c.text.trim() })
  const out = c === undefined ? undefined : { text: c.text.trim(), color: t?.props['color'] }
  await b.unmount()
  return out
}
const headline = async ($: any) => (await chip($))?.text

const paneOf = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('advisor'), surface })

test('load: the command is registered and opens the pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  expect(w.cmds).toContain('smart')
  expect((await $.command.run({ command: 'smart', args: '' })).text).toBe('Opened the Advisor.')
  expect(w.opened.map(o => o.id)).toContain('advisor')
  expect((await $.command.run({ command: 'smart', args: 'whatever' })).text).toBe('Opened the Advisor.')
})

test('headline: ready, with and without a context reading', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await headline($)).toBe('🟢 ready')
  await put($, 'context-info:ctx', 'context', { value: 34 })
  expect(await headline($)).toBe('🟢 ready · ctx 34%')
  const c = await chip($)
  expect(c?.color).toBeUndefined() // ok is the quiet level
})

test('headline: error from repeated failures or a loop', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'error-counter:fails', 'failure', { value: 2 })
  expect(await headline($)).toBe('🟢 ready') // two failures are not "repeated"
  await put($, 'error-counter:fails', 'failure', { value: 3 })
  expect(await headline($)).toBe('🔴 3 repeated failures')
  expect((await chip($))?.color).toBe('error')
  await put($, 'error-counter:fails', 'failure', { value: 0 })
  await put($, 'loop-detective:loop', 'loop', { value: 4, level: 'alert' })
  expect(await headline($)).toBe('🔴 looping') // a loop pattern reads as looping whatever its count
  await put($, 'loop-detective:loop', 'loop', { level: 'alert' })
  expect(await headline($)).toBe('🔴 looping')
})

test('headline: security for ten seconds after an incident', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'incidents:secret-file', 'incident', { value: 1, level: 'alert', text: '.env blocked' }, 3_000)
  expect(await headline($)).toBe('🔴 blocked: secret-file')
  expect((await chip($))?.color).toBe('error')
  await put($, 'incidents:secret-file', 'incident', { value: 1, level: 'alert', text: '.env blocked' }, 11_000)
  expect(await headline($)).toBe('🟢 ready')
})

test('headline: waiting', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'waiting-alert:ask', 'waiting', { level: 'warn' })
  expect(await headline($)).toBe('🟡 approval needed')
  expect((await chip($))?.color).toBe('warning')
})

test('headline: resource from context, quota and budget', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'context-info:ctx', 'context', { value: 79 })
  expect(await headline($)).toBe('🟢 ready · ctx 79%')
  await put($, 'context-info:ctx', 'context', { value: 87 })
  expect(await headline($)).toBe('🟠 context 87%')
  expect((await chip($))?.color).toBe('warning')
  await put($, 'context-info:ctx', 'context', { value: 93 })
  expect((await chip($))?.color).toBe('error')
  await put($, 'context-info:ctx', 'context', { value: 30 })
  await put($, 'plan-pace:weekly', 'quota', { value: 91, level: 'warn' })
  expect(await headline($)).toBe('🟠 weekly 91%')
  expect((await chip($))?.color).toBe('error') // 90 and over is an alert
  await put($, 'plan-pace:weekly', 'quota', { value: 82, level: 'warn' })
  expect(await headline($)).toBe('🟠 weekly 82%')
  expect((await chip($))?.color).toBe('warning')
  await put($, 'plan-pace:weekly', 'quota', { value: 40, level: 'ok' })
  expect(await headline($)).toBe('🟢 ready · ctx 30%')
  await put($, 'budget-guard:day', 'budget', { value: 85, level: 'alert' })
  expect(await headline($)).toBe('🟠 budget 85%')
  expect((await chip($))?.color).toBe('error') // a budget alert
})

test('headline: working with the elapsed time', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'task-pulse:work', 'working', { text: 'Running tests' }, 65_000)
  expect(await headline($)).toBe('⚡ Running tests · 1:05')
  expect((await chip($))?.color).toBe('claude')
})

test('headline: done, with the tests word only from an evidence signal', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'turn-receipt:done', 'done', { value: 3, text: 'x' }, 2_000)
  expect(await headline($)).toBe('✅ done · 3 files · tests not run')
  await put($, 'lint:ev', 'evidence', { value: 1, level: 'ok' })
  expect(await headline($)).toBe('✅ done · 3 files · tests passed')
  expect((await chip($))?.color).toBeUndefined()
  await put($, 'lint:ev', 'evidence', { value: 0, level: 'warn' })
  expect(await headline($)).toBe('✅ done · 3 files · tests failed')
  await put($, 'lint:ev', 'evidence', { text: 'no number' })
  expect(await headline($)).toBe('✅ done · 3 files · tests not run')
  await put($, 'turn-receipt:done', 'done', { value: 1, text: 'x' }, 2_000)
  expect(await headline($)).toBe('✅ done · 1 file · tests not run')
  await put($, 'turn-receipt:done', 'done', { value: 1, text: 'x' }, 10_500)
  expect(await headline($)).toBe('🟢 ready') // older than ten seconds
})

test('headline: priority error > security > waiting > resource > working > done > ready', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'a:done', 'done', { value: 2 })
  await put($, 'a:work', 'working', { text: 'Editing' })
  expect(await headline($)).toBe('⚡ Editing · 0:00')
  await put($, 'a:ctx', 'context', { value: 85 })
  expect(await headline($)).toBe('🟠 context 85%')
  await put($, 'a:wait', 'waiting', { level: 'warn' })
  expect(await headline($)).toBe('🟡 approval needed')
  await put($, 'a:inc', 'incident', { level: 'alert' })
  expect(await headline($)).toBe('🔴 blocked: inc') // the kind is the id tail
  await put($, 'a:fail', 'failure', { value: 5 })
  expect(await headline($)).toBe('🔴 5 repeated failures')
})

test('headline: the terminal draws it too', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { surfaces: ['terminal'] })
  await start($, 'terminal')
  await put($, 'a:wait', 'waiting', { level: 'warn' })
  expect((await chip($, 'terminal'))?.text).toBe('🟡 approval needed')
})

test('headline: Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  expect(await headline($)).toBe('🟢 מוכן')
  await put($, 'plan-pace:weekly', 'quota', { value: 91, level: 'warn' })
  expect(await headline($)).toBe('🟠 שבועי 91%')
  await put($, 'a:wait', 'waiting', { level: 'warn' })
  expect(await headline($)).toBe('🟡 נדרש אישור')
  await put($, 'a:fail', 'failure', { value: 3 })
  expect(await headline($)).toBe('🔴 3 כשלים חוזרים')
})

test('empty pane and the Hebrew pane', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await paneOf($, surface)
    const all = await joined(ui)
    expect(all).toContain('Advisor')
    expect(all).toContain('ready')
    expect(all).toContain('Nothing to recommend.')
    expect(all).toContain('Signals appear as the session runs.')
    expect(all).not.toContain('Signals now')
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
})

test('pane in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  await put($, 'a:loop', 'loop', { value: 3, level: 'alert', text: 'same edit' })
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('יועץ')
  expect(all).toContain('Claude תקוע בלולאה')
  expect(all).toContain('אות לולאה: same edit')
  expect(all).toContain('אותות עכשיו')
  expect(await labels(ui)).toEqual(['ראה את הלולאה', 'פתח התראות', 'התעלם'])
  await ui.unmount()
})

test('rule: repeated work and context pressure', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'context-info:ctx', 'context', { value: 85 })
  await put($, 'dup-read-detector:dups', 'waste', { value: 2 })
  await put($, 'error-counter:fails', 'failure', { value: 2 })
  let ui = await paneOf($)
  expect(await joined(ui)).not.toContain('Repeated work and context pressure')
  await ui.unmount()

  await put($, 'dup-read-detector:dups', 'waste', { value: 4 })
  ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('Repeated work and context pressure')
  expect(all).toContain('context 85% · 4 repeated reads · 2 failures')
  expect(await labels(ui)).toEqual(['Prepare handoff', 'How to hand off', 'Ignore'])
  expect((await ui.find({ key: 'adv-pressure-1' }))?.props['hotkey']).toBe('1')
  expect((await ui.find({ key: 'adv-pressure-2' }))?.props['hotkey']).toBe('2')

  await ui.press({ key: 'adv-pressure-1' })
  expect(w.opened.map(o => o.id)).toContain('toolkitty-detail')
  await ui.press({ key: 'adv-pressure-2' })
  expect((await noticeTexts($)).join('\n')).toContain('Run /handoff to save a summary')
  await ui.unmount()

  // failures alone also fire it
  await put($, 'dup-read-detector:dups', 'waste', { value: 0 })
  await put($, 'error-counter:fails', 'failure', { value: 3 })
  ui = await paneOf($)
  expect(await joined(ui)).toContain('context 85% · 0 repeated reads · 3 failures')
  await ui.unmount()
})

test('rule: usage ahead of pace', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'plan-pace:weekly', 'quota', { value: 91, level: 'warn', text: 'weekly 91%' })
  await put($, 'budget-guard:day', 'budget', { value: 75, level: 'warn', text: 'budget 75%' })
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('Usage ahead of pace')
  expect(all).toContain('Signals: weekly 91% · budget 75%')
  expect(await labels(ui)).toEqual(['See plan pace', 'See budget', 'Ignore'])
  await ui.press({ key: 'adv-pace-1' })
  await ui.press({ key: 'adv-pace-2' })
  expect(w.opened.filter(o => o.id === 'toolkitty-detail').length).toBe(2)
  await ui.unmount()
})

test('rule: Claude is looping', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert', text: 'Edit a.ts x3' })
  const ui = await paneOf($)
  expect(await joined(ui)).toContain('Claude is looping')
  expect(await joined(ui)).toContain('Loop signal: Edit a.ts x3')
  expect(await labels(ui)).toEqual(['See the loop', 'Open notices', 'Ignore'])
  await ui.press({ key: 'adv-loop-2' })
  expect(w.opened.map(o => o.id)).toContain('toolkitty-notices')
  await ui.unmount()
})

test('rule: duplicate reads', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'dup-read-detector:dups', 'waste', { value: 4 })
  let ui = await paneOf($)
  expect(await joined(ui)).not.toContain('Duplicate reads')
  await ui.unmount()
  await put($, 'dup-read-detector:dups', 'waste', { value: 5 })
  ui = await paneOf($)
  expect(await joined(ui)).toContain('Duplicate reads')
  expect(await joined(ui)).toContain('5 repeated reads in this session')
  expect(await labels(ui)).toEqual(['See duplicate reads', 'Ignore'])
  await ui.press({ key: 'adv-dups-1' })
  expect(w.opened.map(o => o.id)).toContain('toolkitty-detail')
  await ui.unmount()
})

test('rule: cold cache with a filling context', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const cardsOf = async () => {
    const ui = await paneOf($)
    const all = await joined(ui)
    await ui.unmount()
    return all
  }
  await put($, 'cache-countdown:cache', 'cache', { value: 0, text: 'cache cold' })
  expect(await cardsOf()).not.toContain('Cold cache') // context unknown
  await put($, 'context-info:ctx', 'context', { value: 39 })
  expect(await cardsOf()).not.toContain('Cold cache')
  await put($, 'context-info:ctx', 'context', { value: 45 })
  const all = await cardsOf()
  expect(all).toContain('Cold cache: the next send re-reads everything')
  expect(all).toContain('cache cold · context 45%')
  await put($, 'cache-countdown:cache', 'cache', { value: 180, text: 'warm 3:00' })
  expect(await cardsOf()).not.toContain('Cold cache') // a warm cache has nothing to say
})

test('rule: a guard blocked something', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'incidents:dangerous-command', 'incident', { value: 1, level: 'alert', text: 'rm -rf blocked' }, 120_000)
  const ui = await paneOf($)
  expect(await joined(ui)).toContain('A guard blocked something')
  expect(await joined(ui)).toContain('dangerous-command · rm -rf blocked')
  expect(await labels(ui)).toEqual(['Open incidents', 'Ignore'])
  await ui.press({ key: 'adv-guard-1' })
  expect(w.opened.map(o => o.id)).toContain('incidents')
  await ui.unmount()
})

test('rule: subagent requests were denied', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'subagent-guard:agents', 'agents', { value: 1, level: 'ok', text: '1 running' })
  let ui = await paneOf($)
  expect(await joined(ui)).not.toContain('Subagent requests were denied')
  await ui.unmount()
  await put($, 'subagent-guard:agents', 'agents', { value: 1, level: 'warn', text: '2 denied' })
  ui = await paneOf($)
  expect(await joined(ui)).toContain('Subagent requests were denied')
  expect(await joined(ui)).toContain('Signals: 2 denied')
  await ui.press({ key: 'adv-agents-1' })
  expect(w.opened.map(o => o.id)).toContain('toolkitty-detail')
  await ui.unmount()
})

test('rule: waiting for more than a minute has only Ignore', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'waiting-alert:ask', 'waiting', { level: 'warn' }, 30_000)
  let ui = await paneOf($)
  expect(await joined(ui)).not.toContain('Claude is waiting for you')
  await ui.unmount()
  await put($, 'waiting-alert:ask', 'waiting', { level: 'warn' }, 75_000)
  ui = await paneOf($)
  expect(await joined(ui)).toContain('Claude is waiting for you')
  expect(await joined(ui)).toContain('waiting for your approval for 1:15')
  expect(await labels(ui)).toEqual(['Ignore'])
  await ui.unmount()
})

test('at most three cards, ordered by level then recency', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await put($, 'dup-read-detector:dups', 'waste', { value: 6 }, 5_000) // dups: warn, older
  await put($, 'plan-pace:weekly', 'quota', { value: 85, level: 'warn' }, 1_000) // pace: warn, newer
  await put($, 'incidents:secret-file', 'incident', { level: 'alert', text: 'blocked' }, 60_000) // guard: warn
  await put($, 'subagent-guard:agents', 'agents', { level: 'warn', text: '1 denied' }, 30_000) // agents: warn
  await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert', text: 'looping' }, 90_000) // loop: alert
  const ui = await paneOf($)
  const titles = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  const order = ['Claude is looping', 'Usage ahead of pace', 'Duplicate reads', 'A guard blocked something', 'Subagent requests were denied']
  const at = order.map(x => titles.indexOf(x))
  expect(at[0]).toBeGreaterThan(-1) // alert first
  expect(at[1]).toBeGreaterThan(at[0]!) // then the newest warn
  expect(at[2]).toBeGreaterThan(at[1]!)
  expect(at[3]).toBe(-1) // cut at three
  expect(at[4]).toBe(-1)
  expect((await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).endsWith('-ignore')).length).toBe(3)
  // the signals below, one row per live signal with its feature and level
  const all = await joined(ui)
  expect(all).toContain('Signals now')
  expect(all).toContain('dup-read-detector')
  expect(all).toContain('plan-pace')
  expect(all).toContain('alert')
  expect(all).toContain('warning')
  await ui.unmount()
})

test('Ignore: 30 minutes, a second press within ten minutes: today; remembered in the store', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'dup-read-detector:dups', 'waste', { value: 7 })
  const ui = await paneOf($)
  expect(await ui.find({ key: 'adv-dups-1' })).toBeDefined()

  await ui.press({ key: 'adv-dups-ignore' })
  await ui.redraw() // the test's state store does not notify the drawing; the engine's own does
  expect(await ui.find({ key: 'adv-dups-1' })).toBeUndefined() // the card is gone
  let all = await joined(ui)
  expect(all).not.toContain('5 repeated reads')
  expect(all).toContain('Ignored for 30 min: Duplicate reads')
  const again = await ui.find({ key: 'adv-dups-ignore' })
  expect(again?.props['label']).toBe('Ignore for today')
  let saved = w.store.get('advisor:dismissed') as { rules: Record<string, { until: number; at: number; day: boolean }> }
  expect(saved.rules['dups']).toEqual({ until: NOON + 30 * 60_000, at: NOON, day: false })

  await w.clock.advance(60_000)
  await ui.press({ key: 'adv-dups-ignore' }) // the second press, a minute later
  await ui.redraw()
  all = await joined(ui)
  expect(all).not.toContain('Ignored for 30 min')
  expect(await ui.find({ key: 'adv-dups-ignore' })).toBeUndefined()
  saved = w.store.get('advisor:dismissed') as typeof saved
  const midnight = new Date(NOON + 60_000)
  midnight.setHours(24, 0, 0, 0)
  expect(saved.rules['dups']).toEqual({ until: midnight.getTime(), at: NOON + 60_000, day: true })
  await ui.unmount()
  const fresh = await paneOf($)
  expect(await fresh.find({ key: 'adv-dups-1' })).toBeUndefined()
  await fresh.unmount()
})

test('Ignore: the cooldown survives a new session', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'dup-read-detector:dups', 'waste', { value: 7 }, 0)
  let ui = await paneOf($)
  await ui.press({ key: 'adv-dups-ignore' })
  await ui.unmount()
  expect(w.storeSets.some(s => s.key === 'advisor:dismissed')).toBe(true)

  // eleven minutes later: still hidden, and the "Ignore for today" row is gone
  await w.clock.advance(11 * 60_000)
  await put($, 'dup-read-detector:dups', 'waste', { value: 7 }, 0)
  ui = await paneOf($)
  expect(await ui.find({ key: 'adv-dups-1' })).toBeUndefined()
  expect(await ui.find({ key: 'adv-dups-ignore' })).toBeUndefined()
  expect(await joined(ui)).toContain('Nothing to recommend.')
  await ui.unmount()

  // a new session reads the store: the mark is still there
  await start($)
  ui = await paneOf($)
  expect(await ui.find({ key: 'adv-dups-1' })).toBeUndefined()
  await ui.unmount()
})

test('Ignore: a stored cooldown is read at session start', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { 'advisor:dismissed': { rules: { dups: { until: NOON + 600_000, at: NOON - 1_200_000, day: false }, loop: { until: NOON - 5, at: NOON - 99, day: false } } } } })
  await start($)
  await put($, 'dup-read-detector:dups', 'waste', { value: 7 })
  await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert', text: 'looping' })
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).not.toContain('Duplicate reads') // cooling down
  expect(all).toContain('Claude is looping') // its cooldown ended
  await ui.unmount()
})

test('the headline press shows the same cards in the detail pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-press' })
  expect(await b.find({ key: 'chip-advisor' })).toBeDefined()
  await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert', text: 'Edit a.ts x3' })
  await b.press({ key: 'chip-advisor' })
  expect(w.opened.map(o => o.id)).toContain('toolkitty-detail')
  await b.unmount()

  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  const all = await joined(d)
  expect(all).toContain('Claude is looping')
  expect(all).toContain('Loop signal: Edit a.ts x3')
  expect(await d.find({ key: 'adv-loop-1' })).toBeDefined()
  expect(await d.find({ key: 'adv-loop-ignore' })).toBeDefined()
  expect((await d.find({ key: 'adv-loop-1' }))?.props['hotkey']).toBeUndefined()

  // the detail pane's Ignore works and its "Open the Advisor" opens the pane
  await d.press({ key: 'adv-open' })
  expect(w.opened.map(o => o.id)).toContain('advisor')
  await d.press({ key: 'adv-loop-ignore' })
  await d.redraw()
  expect(await d.find({ key: 'adv-loop-1' })).toBeUndefined()
  await d.unmount()
})

test('the detail pane has an empty state', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-press' })
  await b.press({ key: 'chip-advisor' })
  await b.unmount()
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'terminal' })
  const all = await joined(d)
  expect(all).toContain('Nothing to recommend.')
  expect(await d.find({ key: 'adv-open' })).toBeDefined()
  expect(w.opened.length).toBeGreaterThan(0)
  await d.unmount()
})

test('the headline moves on by itself: the ticker writes its slot when what it says changes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  await put($, 'turn-receipt:done', 'done', { value: 2 })
  const tickKey = () => (slots.get('toolkitty/slot/advisor-tick')?.value as { key: string } | undefined)?.key
  await w.clock.advance(1_000)
  expect(tickKey()).toBe('✅ done · 2 files · tests not run||')
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-tick' })
  expect((await b.find({ key: 'chip-advisor' }))?.text.trim()).toBe('✅ done · 2 files · tests not run')
  const writes = slots.get('toolkitty/slot/advisor-tick')?.version ?? 0
  await w.clock.advance(3_000) // nothing changed: no writes, so nothing redraws
  expect(slots.get('toolkitty/slot/advisor-tick')?.version).toBe(writes)
  await w.clock.advance(8_000) // the done chip is older than ten seconds now
  expect(tickKey()).toBe('🟢 ready||')
  await b.redraw()
  expect((await b.find({ key: 'chip-advisor' }))?.text.trim()).toBe('🟢 ready')
  // working: the elapsed time moves, so the key moves every second
  await put($, 'task-pulse:work', 'working', { text: 'Editing' }, 0)
  await w.clock.advance(1_000)
  const first = tickKey()
  await w.clock.advance(1_000)
  expect(first).toContain('⚡ Editing')
  expect(tickKey()).not.toBe(first)
  await b.unmount()
})

test('off switch: no chip, the command and panes say so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { enabled: { advisor: false } } })
  await start($)
  expect(w.cmds).toContain('smart') // registered even when off
  expect((await $.command.run({ command: 'smart', args: '' })).text).toBe(OFF)
  expect(w.opened.map(o => o.id)).not.toContain('advisor')
  await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert' })
  expect(await headline($)).toBeUndefined()
  const ui = await paneOf($)
  expect(await joined(ui)).toBe('The Smart Advisor is off.')
  await ui.unmount()
})

test('renamed: /advisor is no longer registered, /smart is', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on)
  await start($)
  expect(w.cmds).toContain('smart')
  expect(w.cmds).not.toContain('advisor')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /smart registration (${how}) warns and the rest of session start still runs`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = setup(on, { store: { 'advisor:dismissed': { rules: { dups: { until: NOON + 600_000, at: NOON - 1_200_000, day: false }, loop: { until: NOON - 5, at: NOON - 99, day: false } } } } })
    refusal.name = 'smart'
    refusal.how = how
    await start($)
    expect(w.cmds).not.toContain('smart')
    expect(w.cmds.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /smart could not be registered: '))).toBe(true)
    // the stored cooldowns were still read after the refusal
    await put($, 'dup-read-detector:dups', 'waste', { value: 7 })
    await put($, 'loop-detective:loop', 'loop', { value: 3, level: 'alert', text: 'looping' })
    const ui = await paneOf($)
    const all = await joined(ui)
    expect(all).not.toContain('Duplicate reads')
    expect(all).toContain('Claude is looping')
    await ui.unmount()
  })
}
