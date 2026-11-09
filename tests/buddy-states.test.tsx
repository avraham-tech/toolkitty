import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, SPECIES, joined, roll, start, svgOf, turnDone, turnStart, world } from './harness'

/*
 * Mascot states: the buddy reads the signals bus and strikes a pose per state. The test `$` has no
 * state noun, so the signals are written into an in-memory state beneath the plugin (the same
 * store every atom of the plugin goes through), exactly as the advisor tests do.
 */
const SEED = 4242

type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
let items: Record<string, unknown>[] = []
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

function setup(on: any, o: Parameters<typeof world>[1] = {}) {
  slots = new Map()
  items = []
  elapsed = 0
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

/** Where the mock clock stands: `settle` moves it one second each time. */
let elapsed = 0

/** Puts one signal on the bus (replacing its id), `ageMs` old by the mock clock. */
const put = (id: string, kind: string, extra: Record<string, unknown> = {}, ageMs = 0): void => {
  const signal = { id, feature: id.split(':')[0] ?? 'x', kind, level: 'info', text: id, at: NOON + elapsed - ageMs, ...extra }
  items = [...items.filter(x => x['id'] !== id), signal]
  const k = 'toolkitty/slot/signals'
  slots.set(k, { value: { items }, version: (slots.get(k)?.version ?? 0) + 1 })
}
const clear = (): void => {
  items = []
  const k = 'toolkitty/slot/signals'
  slots.set(k, { value: { items }, version: (slots.get(k)?.version ?? 0) + 1 })
}

/**
 * A quiet turn, then one tick of the clock: the buddy re-reads the bus on turn start, on turn end and every
 * second. The tick matters because at turn end the live ticker's own "working" signal may still be on the
 * bus when the buddy's handler runs (handler order); the next second settles it, as in the app.
 */
const settle = async ($: any, w: { clock: { advance: (ms: number) => Promise<void> } }): Promise<void> => {
  await turnStart($)
  await turnDone($)
  await w.clock.advance(1000)
  elapsed += 1000
}

/** The buddy's pane, mounted fresh for each look: under the state mock a mounted drawing does not redraw on its own. */
const card = async ($: any): Promise<{ mood: string; source: string }> => {
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  const svg = await svgOf(ui)
  await ui.unmount()
  return { mood: svg.alt.replace(/^.*feeling /, ''), source: svg.source }
}
const moodOf = async ($: any): Promise<string> => (await card($)).mood
const terminalText = async ($: any): Promise<string> => {
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  const all = await joined(ui)
  await ui.unmount()
  return all
}

test('each signal has its pose, in order of importance', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel' } })
  await start($)
  await settle($, w)
  expect(await moodOf($)).toBe('idle')

  // typing while a tool works
  put('x:working', 'working', { text: 'Bash' })
  await settle($, w)
  expect(await moodOf($)).toBe('working')

  // worried from 70 % context, not before
  put('ctx:fill', 'context', { value: 69 })
  await settle($, w)
  expect(await moodOf($)).toBe('working')
  put('ctx:fill', 'context', { value: 70 })
  await settle($, w)
  expect(await moodOf($)).toBe('worried')

  // fresh passed evidence celebrates, even with the context high
  put('tests:run', 'evidence', { value: 1 })
  await settle($, w)
  expect(await moodOf($)).toBe('celebrating')
  expect(w.store.get('buddy:mood')).toBe('celebrating')

  // asleep at 90 % quota beats both
  put('plan:weekly', 'quota', { value: 90 })
  await settle($, w)
  expect(await moodOf($)).toBe('sleeping')
  expect((await card($)).source).toContain('>Z<')

  // a loop: tail-chasing beats sleep
  put('loop:edit', 'loop', { text: 'Edit a.ts x3' })
  await settle($, w)
  expect(await moodOf($)).toBe('chasing its tail')
  expect((await card($)).source).toContain('id="lap-0"')

  // an incident: the shield beats everything
  put('guard:block', 'incident', { value: 1, level: 'alert' })
  await settle($, w)
  expect(await moodOf($)).toBe('on guard')
  expect((await card($)).source).toContain('id="shield"')
  expect(w.store.get('buddy:mood')).toBe('guarding')

  // the band chip says so, with a warning color
  const b = await $.ui.mount({ ...BAND('desktop'), requestId: 'band' })
  const chip = await b.find({ key: 'chip-buddy' })
  expect(chip?.text).toContain('Pixel')
  await b.unmount()

  // the bus goes quiet: calm again
  clear()
  await settle($, w)
  expect(await moodOf($)).toBe('idle')
  expect(w.store.get('buddy:mood')).toBe('idle')
})

test('freshness: an old incident lowers the shield, old evidence is forgotten, a failed run worries', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { 'buddy:seed': SEED } })
  await start($)

  put('guard:block', 'incident', { value: 1 }, 61_000)
  await settle($, w)
  expect(await moodOf($)).toBe('idle')
  put('guard:block', 'incident', { value: 1 }, 50_000)
  await settle($, w)
  expect(await moodOf($)).toBe('on guard')

  clear()
  put('tests:run', 'evidence', { value: 0 })
  await settle($, w)
  expect(await moodOf($)).toBe('worried')
  put('tests:run', 'evidence', { value: 1 }, 11_000)
  await settle($, w)
  expect(await moodOf($)).toBe('idle')
})

test('the Minimal profile keeps the buddy calm: the bus is not read', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { 'buddy:seed': SEED, profile: 'minimal', enabled: { buddy: true } } })
  await start($)
  put('guard:block', 'incident', { value: 1 })
  put('loop:edit', 'loop')
  await settle($, w)
  expect(await moodOf($)).toBe('idle')
  // the person's own turn still shows typing (that is not a bus reaction)
  await turnStart($)
  expect(await moodOf($)).toBe('working')
  await turnDone($)
  // switching to a wider profile wakes the reactions up
  w.store.set('profile', 'playful')
  await settle($, w)
  expect(await moodOf($)).toBe('on guard')
})

test('terminal: the two new poses have their own ASCII art and one-liners, in Hebrew too', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, { store: { 'buddy:seed': SEED, language: 'he' } })
  await start($)
  put('loop:edit', 'loop')
  await settle($, w)
  let all = await terminalText($)
  expect(all).toContain('( @.@ )')
  expect(all).toContain('רודף אחרי הזנב')
  put('guard:block', 'incident', { value: 1 })
  await settle($, w)
  all = await terminalText($)
  expect(all).toContain('[> ^ <]')
  expect(all).toContain('על המשמר')
  expect(all).toMatch(/לא במשמרת שלי|מגן למעלה|נשאר חסום|ראיתי את זה בא|תורנות שמירה/)
})

// one seed per species: the shield and the tail-chase draw as valid cards for every body shape
const bySpecies: Record<string, number> = {}
for (let seed = 1; Object.keys(bySpecies).length < SPECIES.length && seed < 5000; seed++) {
  const r = roll(seed)
  if (bySpecies[r.species] === undefined) bySpecies[r.species] = seed
}
for (const species of SPECIES) {
  test(`species ${species} draws on guard and chasing its tail`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = setup(on, { store: { 'buddy:seed': bySpecies[species]! } })
    await start($)
    const sources = new Set<string>()
    await settle($, w)
    sources.add((await card($)).source)
    put('loop:edit', 'loop')
    await settle($, w)
    sources.add((await card($)).source)
    put('guard:block', 'incident', { value: 1 })
    await settle($, w)
    sources.add((await card($)).source)
    expect(sources.size).toBe(3)
    for (const s of sources) {
      expect(s.startsWith('<svg')).toBe(true)
      expect(s.endsWith('</svg>')).toBe(true)
      expect(s.length).toBeLessThan(128 * 1024)
    }
  })
}
