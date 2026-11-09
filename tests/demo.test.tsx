import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, DAY, dayKey, labels, start, texts, world } from './harness'

const SLOW = { timeoutMs: 40_000 }
const OWN_FAILURE = /feature demo failed/

/*
 * The test `$` has no state noun, so the plugin's atoms are answered from an
 * in-memory map beneath it; the tests read the signals, notices and evidence
 * straight from there.
 */
type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

function setup(on: any, store: Record<string, unknown> = {}) {
  slots = new Map()
  const w = world(on, { store })
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

type Sig = { id: string; feature: string; kind: string; level: string; text: string; value?: number; at: number; ttlMs?: number }
type Note = { at: number; level: 'info' | 'warn' | 'alert'; text: string; feature?: string; count: number }
type Ev = { at: number; kind: string; ok: boolean; summary: string; ref: string; feature: string }

const signals = (): Sig[] => ((slots.get('toolkitty/slot/signals')?.value as { items: Sig[] } | undefined)?.items ?? []) as Sig[]
const mySignals = (): Sig[] => signals().filter(s => s.feature === 'demo')
const noticeItems = (): Note[] => ((slots.get('toolkitty/slot/notices')?.value as { items: Note[] } | undefined)?.items ?? []) as Note[]
const evidenceItems = (): Ev[] => ((slots.get('toolkitty/slot/evidence')?.value as { items: Ev[] } | undefined)?.items ?? []) as Ev[]
const demoState = (): { active: boolean; scene: string; keys: string[] } | undefined => slots.get('toolkitty/slot/demo')?.value as never
const sig = (kind: string): Sig | undefined => mySignals().find(s => s.kind === kind)

const sorted = (m: Map<string, unknown>): string => JSON.stringify([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
const CWD = 'C:/proj'
const KEYS = ['week-heatmap:days', 'savings:days', `incidents:${CWD}`, 'achievements:unlocked', 'session-finder:index', 'buddy:name']

/** What a real user would have in the store before the demo. */
const REAL: Record<string, unknown> = {
  'week-heatmap:days': { '2026-11-07': { turns: 5, ms: 600_000, tokens: 90_000, cost: 1.25 } },
  'incidents:C:/proj': { count: 1, lastAt: 1234, items: [{ at: 1234, feature: 'protect-secrets', kind: 'env file', detail: '.env' }] },
  'session-finder:index': [{ id: 'real-1', cwd: 'C:/proj', title: 'My real session', startedAt: 1, updatedAt: 2, prompts: ['hello'] }],
  'buddy:name': 'Rex',
  'buddy:seed': 4242,
}

async function chipOf($: any, key: string, surface: 'desktop' | 'terminal' = 'desktop'): Promise<{ text: string; color: unknown } | undefined> {
  const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}-${key}` })
  const c = await b.find({ key })
  let out: { text: string; color: unknown } | undefined
  if (c !== undefined) {
    const txt = await b.find({ type: 'Text', text: c.text.trim() })
    out = { text: c.text.trim(), color: txt?.props['color'] }
  }
  await b.unmount()
  return out
}

const demoPane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('demo'), surface })
const run = ($: any, args: string) => $.command.run({ command: 'demo', args })

test('loads: /demo is registered and nothing failed', SLOW, async ($, on) => {
  const w = setup(on)
  await start($)
  expect(w.cmds).toContain('demo')
  expect(w.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  expect(demoState()?.active ?? false).toBe(false)
  expect(await chipOf($, 'chip-demo')).toBeUndefined()
})

test('on/off round trip restores every key byte for byte, including keys that did not exist', SLOW, async ($, on) => {
  // achievements off: with an incident in the store it would unlock a trophy at session start and write
  // 'achievements:unlocked' itself, which this test needs absent (it checks demo's own keys)
  const w = setup(on, { ...REAL, enabled: { achievements: false } })
  await start($)
  expect(w.store.has('savings:days')).toBe(false)
  expect(w.store.has('achievements:unlocked')).toBe(false)
  const before = sorted(w.store)
  const beforeEach = Object.fromEntries(KEYS.map(k => [k, JSON.stringify(w.store.get(k) ?? null)]))

  const r = await run($, 'on')
  expect(r.text).toContain('Demo mode is on (scene: busy)')
  expect(r.text).toContain('/demo off')
  for (const k of KEYS) {
    expect(w.store.has(k)).toBe(true)
    expect(JSON.stringify(w.store.get(k))).not.toBe(beforeEach[k])
    expect(w.store.has(`demo:backup:${k}`)).toBe(true)
  }
  // the backup of a real value is the value itself; of an absent key it says so
  expect(w.store.get('demo:backup:buddy:name')).toEqual({ had: true, value: 'Rex' })
  expect(w.store.get('demo:backup:savings:days')).toEqual({ had: false })
  expect(w.store.get('demo:backup:week-heatmap:days')).toEqual({ had: true, value: REAL['week-heatmap:days'] })
  // the companion keeps its real seed
  expect(w.store.get('buddy:seed')).toBe(4242)
  expect(w.store.get('buddy:name')).toBe('Pixel')

  const off = await run($, 'off')
  expect(off.text).toBe('Demo mode is off; your data is back.')
  expect(sorted(w.store)).toBe(before)
  for (const k of KEYS) expect(JSON.stringify(w.store.get(k) ?? null)).toBe(beforeEach[k])
  expect(w.store.has('savings:days')).toBe(false)
  expect([...w.store.keys()].filter(k => k.startsWith('demo:'))).toEqual([])
})

test('starting twice (or switching scene) never backs up demo data over the real data', SLOW, async ($, on) => {
  const w = setup(on, REAL)
  await start($)
  const before = sorted(w.store)
  await run($, 'on')
  await run($, 'on')
  await run($, 'scene rescue')
  await run($, 'scene calm')
  expect(w.store.get('demo:backup:buddy:name')).toEqual({ had: true, value: 'Rex' })
  await run($, 'off')
  expect(sorted(w.store)).toBe(before)
})

test('the synthetic stores look plausible and every text in them says DEMO', SLOW, async ($, on) => {
  const w = setup(on, REAL)
  await start($)
  await run($, 'on')

  const days = w.store.get('week-heatmap:days') as Record<string, { turns: number; ms: number; tokens: number; cost: number }>
  const keys = Object.keys(days)
  expect(keys.length).toBeGreaterThan(50)
  expect(keys.length).toBeLessThanOrEqual(84)
  const oldest = dayKey(NOON - 83 * DAY)
  for (const k of keys) {
    expect(k >= oldest && k <= dayKey(NOON)).toBe(true)
    const d = days[k]!
    expect(d.turns).toBeGreaterThan(0)
    expect(d.ms).toBeGreaterThan(0)
    expect(d.tokens).toBeGreaterThan(0)
    expect(d.cost).toBeGreaterThan(0)
  }
  // 12 weeks: activity in every one of them
  for (let wk = 0; wk < 12; wk++) {
    const inWeek = Array.from({ length: 7 }, (_, i) => dayKey(NOON - (wk * 7 + i) * DAY)).filter(k => days[k] !== undefined)
    expect(inWeek.length).toBeGreaterThan(0)
  }

  const sav = w.store.get('savings:days') as Record<string, { tokens: number; usd: number }>
  expect(Object.keys(sav).length).toBe(30)
  for (const v of Object.values(sav)) expect(v.tokens).toBeGreaterThan(0)

  const inc = w.store.get(`incidents:${CWD}`) as { count: number; lastAt: number; items: { at: number; feature: string; kind: string; detail: string }[] }
  expect(inc.count).toBe(5)
  expect(inc.items).toHaveLength(5)
  expect(new Set(inc.items.map(i => i.kind)).size).toBe(5)
  for (const i of inc.items) expect(i.detail.startsWith('[DEMO] ')).toBe(true)

  const ach = w.store.get('achievements:unlocked') as { id: string; title: string }[]
  expect(ach).toHaveLength(3)
  for (const a of ach) expect(a.title).toContain('DEMO')

  const sess = w.store.get('session-finder:index') as { id: string; title: string; prompts: string[]; startedAt: number; updatedAt: number }[]
  expect(sess).toHaveLength(6)
  expect(new Set(sess.map(s => s.id)).size).toBe(6)
  for (const s of sess) {
    expect(s.title).toContain('DEMO')
    for (const p of s.prompts) expect(p).toContain('DEMO')
    expect(s.updatedAt).toBeGreaterThan(s.startedAt)
  }
  expect(w.store.get('buddy:name')).toBe('Pixel')
})

test('30 labelled notices of mixed levels and 8 labelled evidence records', SLOW, async ($, on) => {
  setup(on, REAL)
  await start($)
  const noticesBefore = noticeItems().length
  const evBefore = evidenceItems().length
  await run($, 'on busy')

  const mine = noticeItems().slice(noticesBefore)
  expect(mine).toHaveLength(30)
  for (const n of mine) {
    expect(n.text.startsWith('[DEMO] ')).toBe(true)
    expect(n.count).toBe(1)
  }
  expect(new Set(mine.map(n => n.text)).size).toBe(30)
  const levels = (l: string) => mine.filter(n => n.level === l).length
  expect([levels('info'), levels('warn'), levels('alert')]).toEqual([18, 9, 3])
  // levels are spread, not three blocks
  const firstAlert = mine.findIndex(n => n.level === 'alert')
  const lastInfo = mine.map(n => n.level).lastIndexOf('info')
  expect(firstAlert).toBeLessThan(lastInfo)

  const ev = evidenceItems().slice(evBefore)
  expect(ev).toHaveLength(8)
  for (const x of ev) {
    expect(x.feature).toBe('demo')
    expect(x.summary.startsWith('[DEMO] ')).toBe(true)
  }
  expect(new Set(ev.map(x => x.kind))).toEqual(new Set(['test', 'build', 'lint', 'typecheck', 'diff', 'git', 'run']))
  expect(ev[0]?.ok).toBe(false)
  expect(ev[ev.length - 1]).toMatchObject({ kind: 'test', ok: true })

  // the notices pane shows them
  const pane = await $.ui.mount({ ...PANE('toolkitty-notices'), surface: 'desktop' })
  const shown = (await texts(pane)).filter(x => x.includes('[DEMO]'))
  expect(shown.length).toBeGreaterThanOrEqual(20)
  await pane.unmount()
})

test('busy: the mixed scene publishes every signal kind and the headline is red', SLOW, async ($, on) => {
  setup(on, REAL)
  await start($)
  // another feature's signal must survive the whole demo
  slots.set('toolkitty/slot/signals', { value: { items: [{ id: 'cache:warm', feature: 'cache-countdown', kind: 'cache', level: 'ok', text: 'warm', value: 200, at: NOON }] }, version: 1 })
  await run($, 'on busy')

  const kinds = new Set(mySignals().map(s => s.kind))
  for (const k of ['context', 'quota', 'budget', 'failure', 'loop', 'waste', 'saving', 'incident', 'working', 'agents', 'evidence']) expect(kinds.has(k)).toBe(true)
  expect(sig('context')).toMatchObject({ value: 83, level: 'warn' })
  expect(sig('quota')).toMatchObject({ value: 46, level: 'warn' })
  expect(sig('budget')).toMatchObject({ value: 91, level: 'warn' })
  expect(sig('failure')?.value).toBe(3)
  expect(sig('waste')?.value).toBe(6)
  expect(sig('saving')?.value).toBe(254_000)
  expect(sig('working')?.text).toBe('npm test')
  expect(sig('agents')?.text).toBe('2 running · 1 denied')
  expect(sig('evidence')?.value).toBe(1)
  const incident = sig('incident')
  expect(incident?.ttlMs).toBeGreaterThan(0)
  expect(incident?.level).toBe('alert')
  for (const s of mySignals()) expect(s.id.startsWith('demo:')).toBe(true)
  expect(signals().some(s => s.id === 'cache:warm')).toBe(true)

  const head = await chipOf($, 'chip-advisor')
  expect(head?.text).toBe('🔴 3 repeated failures')
})

test('calm: all green, low numbers, no incident, no failures', SLOW, async ($, on) => {
  setup(on, REAL)
  await start($)
  const noticesBefore = noticeItems().length
  await run($, 'scene calm')
  expect(demoState()).toMatchObject({ active: true, scene: 'calm' })
  expect(mySignals().length).toBeGreaterThan(5)
  for (const s of mySignals()) expect(s.level).toBe('ok')
  expect((sig('context')?.value ?? 100) < 40).toBe(true)
  expect((sig('quota')?.value ?? 100) < 25).toBe(true)
  expect(sig('failure')).toBeUndefined()
  expect(sig('loop')).toBeUndefined()
  expect(sig('incident')).toBeUndefined()
  expect(sig('evidence')?.value).toBe(1)
  const mine = noticeItems().slice(noticesBefore)
  expect(mine).toHaveLength(30)
  expect(mine.filter(n => n.level === 'alert')).toHaveLength(0)
  expect(mine.filter(n => n.level === 'warn')).toHaveLength(2)
  const head = await chipOf($, 'chip-advisor')
  expect(head?.text.startsWith('🔴')).toBe(false)
  expect(head?.text).toContain('npm test')
  expect(evidenceItems().filter(x => x.feature === 'demo').every(x => x.ok)).toBe(true)
})

test('rescue: an incident just blocked and a red headline that stays fresh', SLOW, async ($, on) => {
  const w = setup(on, REAL)
  await start($)
  const noticesBefore = noticeItems().length
  await run($, 'scene rescue')
  const incident = sig('incident')
  expect(incident?.level).toBe('alert')
  expect(NOON - (incident?.at ?? 0)).toBeLessThan(10_000)
  expect(sig('failure')?.value ?? 0).toBeLessThan(3)
  expect(sig('loop')).toBeUndefined()
  expect(noticeItems().slice(noticesBefore).filter(n => n.level === 'alert').length).toBe(4)
  const head = await chipOf($, 'chip-advisor')
  expect(head?.text).toMatch(/^🔴 .*rm -rf/)
  const inc = w.store.get(`incidents:${CWD}`) as { lastAt: number }
  expect(NOON - inc.lastAt).toBeLessThan(10_000)

  // half a minute later the ticker has kept the incident fresh
  await w.clock.advance(30_000)
  const later = sig('incident')
  expect(w.clock.now() - (later?.at ?? 0)).toBeLessThan(10_000)
  expect((await chipOf($, 'chip-advisor'))?.text).toMatch(/^🔴 .*rm -rf/)
})

test('switching scene replaces the signals and adds one notice, not 30 more', SLOW, async ($, on) => {
  setup(on, REAL)
  await start($)
  await run($, 'on busy')
  const count = noticeItems().length
  const evCount = evidenceItems().length
  await run($, 'scene calm')
  expect(sig('loop')).toBeUndefined()
  expect(sig('context')?.value).toBe(31)
  expect(noticeItems().length).toBe(count + 1)
  expect(noticeItems()[noticeItems().length - 1]?.text).toBe('[DEMO] Scene changed to calm')
  expect(evidenceItems().length).toBe(evCount)
  expect(demoState()?.scene).toBe('calm')
})

test('the chip: 🎬 DEMO in warn colour while on, gone after off', SLOW, async ($, on) => {
  setup(on, REAL)
  await start($)
  expect(await chipOf($, 'chip-demo')).toBeUndefined()
  await run($, 'on')
  for (const surface of ['desktop', 'terminal'] as const) {
    const c = await chipOf($, 'chip-demo', surface)
    expect(c?.text).toBe('🎬 DEMO')
    expect(c?.color).toBe('warning')
  }
  await run($, 'off')
  expect(await chipOf($, 'chip-demo')).toBeUndefined()
})

test('signals are published, the working seconds move every second, and everything is retracted on off', SLOW, async ($, on) => {
  const w = setup(on, REAL)
  await start($)
  slots.set('toolkitty/slot/signals', { value: { items: [{ id: 'x:1', feature: 'x', kind: 'cache', level: 'ok', text: 'x', at: NOON }] }, version: 1 })
  await run($, 'on busy')
  const first = sig('working')?.value ?? -1
  expect(first).toBe(47)
  await w.clock.advance(1000)
  expect(sig('working')?.value).toBe(first + 1)
  await w.clock.advance(4000)
  expect(sig('working')?.value).toBe(first + 5)

  await run($, 'off')
  expect(mySignals()).toEqual([])
  expect(signals().map(s => s.id)).toEqual(['x:1'])
  // the ticker is gone: no demo signal comes back
  await w.clock.advance(5000)
  expect(mySignals()).toEqual([])
  // the end of the demo is announced
  expect(noticeItems().some(n => n.text === 'Demo mode ended: your real data is back.')).toBe(true)
})

test('commands: no args opens the pane; bad args answer the usage or the scene list', SLOW, async ($, on) => {
  const w = setup(on, REAL)
  await start($)
  expect((await run($, '')).text).toBe('Opened the Demo mode pane.')
  expect(w.opened.map(o => o.id)).toContain('demo')
  expect(w.opened.find(o => o.id === 'demo')).toMatchObject({ focus: true, closeOnEscape: true })
  expect((await run($, 'bogus')).text).toMatch(/^Usage: \/demo/)
  expect((await run($, 'scene')).text).toMatch(/^Usage: \/demo/)
  expect((await run($, 'scene nope')).text).toBe('Unknown scene "nope". The scenes are calm, busy and rescue.')
  expect((await run($, 'on nope')).text).toBe('Unknown scene "nope". The scenes are calm, busy and rescue.')
  expect(demoState()?.active ?? false).toBe(false)
  expect((await run($, 'off')).text).toBe('Demo mode is not on. Start it with /demo on.')
  expect((await run($, 'ON Calm')).text).toContain('(scene: calm)')
  expect((await run($, 'on')).text).toContain('(scene: calm)') // `on` alone keeps the scene in use
  expect(w.store.get('buddy:name')).toBe('Pixel')
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`the pane (${surface}): scenes, buttons, footnote and the exact restore command`, SLOW, async ($, on) => {
    const w = setup(on, REAL)
    await start($, surface)
    const before = sorted(w.store)
    const ui = await demoPane($, surface)
    let out = await texts(ui)
    expect(out).toContain('Demo mode')
    expect(out).toContain('off')
    for (const s of ['calm', 'busy', 'rescue']) expect(out).toContain(s)
    expect(out.some(x => x.includes('Starting the demo replaces them; to restore: /demo off'))).toBe(true)
    expect(out).toContain('week-heatmap:days')
    expect(out).toContain('buddy:name')
    const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string)
    expect(keys).toEqual(expect.arrayContaining(['demo-on', 'demo-scene-calm', 'demo-scene-busy', 'demo-scene-rescue']))
    expect(keys).not.toContain('demo-off')

    await ui.press({ key: 'demo-scene-rescue' })
    await ui.redraw()
    out = await texts(ui)
    expect(out).toContain('ON · rescue')
    expect(out).toContain('incidents:C:/proj')
    expect(out).toContain('To restore everything, run: /demo off')
    expect(out.some(x => x.includes('labelled DEMO'))).toBe(true)
    expect(await labels(ui)).toContain('Stop and restore')
    expect(demoState()).toMatchObject({ active: true, scene: 'rescue' })

    await ui.press({ key: 'demo-scene-calm' })
    await ui.redraw()
    expect(await texts(ui)).toContain('ON · calm')

    await ui.press({ key: 'demo-off' })
    await ui.redraw()
    out = await texts(ui)
    expect(out).toContain('off')
    expect(out.some(x => x.includes('ON ·'))).toBe(false)
    expect(sorted(w.store)).toBe(before)
    expect(mySignals()).toEqual([])

    await ui.press({ key: 'demo-on' })
    await ui.redraw()
    expect(demoState()).toMatchObject({ active: true })
    await ui.unmount()
    await run($, 'off')
    expect(sorted(w.store)).toBe(before)
  })
}

test('Hebrew: command texts, notices, the pane and the end notice', SLOW, async ($, on) => {
  setup(on, { ...REAL, language: 'he' })
  await start($)
  const noticesBefore = noticeItems().length
  const r = await run($, 'on')
  expect(r.text).toBe('מצב ההדגמה פועל (סצנה: busy). כל מה שמוצג סינתטי ומסומן DEMO. שחזר את הנתונים שלך עם /demo off.')
  const mine = noticeItems().slice(noticesBefore)
  expect(mine).toHaveLength(30)
  for (const n of mine) {
    expect(n.text.startsWith('[DEMO] ')).toBe(true)
    expect(/[\u0590-\u05ff]/.test(n.text)).toBe(true)
  }
  const ui = await demoPane($)
  const out = await texts(ui)
  expect(out).toContain('מצב הדגמה')
  expect(out).toContain('פועל · עמוסה')
  expect(out).toContain('כדי לשחזר הכול, הרץ: /demo off')
  await ui.unmount()
  expect((await run($, 'bogus')).text).toMatch(/^שימוש: \/demo/)
  expect((await run($, 'off')).text).toBe('מצב ההדגמה כבוי; הנתונים שלך חזרו.')
  expect(noticeItems().some(n => n.text === 'מצב ההדגמה הסתיים: הנתונים האמיתיים שלך חזרו.')).toBe(true)
  expect(await run($, 'off').then((x: any) => x.text)).toBe('מצב ההדגמה לא פועל. הפעל אותו עם /demo on.')
})

test('other languages: the start text and a notice exist in es, fr and ru', SLOW, async ($, on) => {
  setup(on, { ...REAL, language: 'ru' })
  await start($)
  const before = noticeItems().length
  const r = await run($, 'on calm')
  expect(r.text).toContain('Демо-режим включён')
  const mine = noticeItems().slice(before)
  expect(mine.every(n => /[А-Яа-я]/.test(n.text) && n.text.startsWith('[DEMO] '))).toBe(true)
  await run($, 'off')
})

test('off switch: the command answers the off text, the pane and chip stay quiet, nothing is written', SLOW, async ($, on) => {
  const w = setup(on, { ...REAL, enabled: { demo: false } })
  await start($)
  const before = sorted(w.store)
  const r = await run($, 'on')
  expect(r.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect((await run($, '')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect((await run($, 'off')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(w.opened.map(o => o.id)).not.toContain('demo')
  expect(sorted(w.store)).toBe(before)
  expect(mySignals()).toEqual([])
  expect(await chipOf($, 'chip-demo')).toBeUndefined()
  const ui = await demoPane($)
  expect(await texts(ui)).toEqual(['Demo mode is off in the /toolkitty pane.'])
  await ui.unmount()
})

test('a demo left over from a previous session is cleaned up at the next start', SLOW, async ($, on) => {
  const w = setup(on, {
    'buddy:name': 'Pixel',
    'savings:days': { '2026-11-01': { tokens: 1, usd: 0 } },
    'demo:state': { active: true, scene: 'busy', keys: ['buddy:name', 'savings:days'], at: 1 },
    'demo:backup:buddy:name': { had: true, value: 'Rex' },
    'demo:backup:savings:days': { had: false },
  })
  await start($)
  expect(w.store.get('buddy:name')).toBe('Rex')
  expect(w.store.has('savings:days')).toBe(false)
  expect([...w.store.keys()].filter(k => k.startsWith('demo:'))).toEqual([])
  expect(noticeItems().some(n => n.text.startsWith('A demo left over'))).toBe(true)
  expect(demoState()?.active ?? false).toBe(false)
})

test('the same real data survives different folders: the incidents key follows the folder', SLOW, async ($, on) => {
  const w = setup(on, { 'incidents:C:/other': { count: 2, lastAt: 5, items: [] } })
  w.cwd = 'C:/other'
  await start($)
  await run($, 'on')
  expect((w.store.get('incidents:C:/other') as { count: number }).count).toBe(5)
  expect(w.store.has('incidents:C:/proj')).toBe(false)
  await run($, 'off')
  expect(w.store.get('incidents:C:/other')).toEqual({ count: 2, lastAt: 5, items: [] })
})
