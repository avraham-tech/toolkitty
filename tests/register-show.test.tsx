import { expect, test } from 'claude-code/testing'
import { BAND, PANE, joined, noticeTexts, start, texts, turnDone, turnStart, world } from './harness'

const SW = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty'), surface }) as const
const HOME = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty-home'), surface }) as const
const rowTitle = async (ui: any, id: string): Promise<string> => ((await ui.find({ key: `t-${id}` }))!.props['label'] as string).slice(2)
const allOn = (ids: string[]) => Object.fromEntries(ids.map(i => [i, true]))
const last = (w: any) => w.opened[w.opened.length - 1]

// ---------- the PANES map, seen through the Open button ----------

for (const [feature, pane] of [
  ['buddy', 'buddy'],
  ['week-heatmap', 'heatmap'],
  ['context-aquarium', 'aquarium'],
  ['incidents', 'incidents'],
  ['safety-receipt', 'safety-receipt'],
] as const) {
  test(`${feature}: the Open button opens its primary pane "${pane}", focused, titled by the feature`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on, { store: { enabled: allOn([feature]) } })
    await start($)
    const ui = await $.ui.mount(SW())
    const title = await rowTitle(ui, feature)
    await ui.press({ key: `open-${feature}` })
    expect(last(w)).toMatchObject({ id: pane, title, focus: true })
    // safety-receipt must never list the incidents pane that another feature draws
    if (feature === 'safety-receipt') expect(w.opened.map((o: any) => o.id)).not.toContain('incidents')
    await ui.unmount()
  })
}

test('Open buttons only exist while the feature is on; a feature with only a band shows a Show button that opens its detail', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false, 'cost-meter': true } } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect(await ui.find({ key: 'open-buddy' })).toBeUndefined()
  expect(((await ui.find({ key: 'open-cost-meter' }))!.props['label'])).toBe('Show')
  await ui.press({ key: 'open-cost-meter' })
  expect(last(w)).toMatchObject({ id: 'toolkitty-detail', focus: true, closeOnEscape: true })
  // no pane and no band: no button at all
  expect(await ui.find({ key: 'open-dangerous-commands' })).toBeUndefined()
  expect(await ui.find({ key: 'star-dangerous-commands' })).toBeUndefined()
  expect(await ui.find({ key: 'star-cost-meter' })).toBeUndefined()
  await ui.unmount()
})

// ---------- switching on shows it ----------

test('switching a pane feature on opens its pane and says so; switching off says only that', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  const title = await rowTitle(ui, 'buddy')
  const before = w.opened.length
  await ui.press({ key: 't-buddy' })
  expect(w.opened.length).toBe(before + 1)
  expect(last(w)).toMatchObject({ id: 'buddy', title, focus: true })
  expect(await noticeTexts($)).toContain(`${title} is on · opened`)
  const after = w.opened.length
  await ui.press({ key: 't-buddy' })
  expect(w.opened.length).toBe(after)
  expect(await noticeTexts($)).toContain(`${title} off`)
  await ui.unmount()
})

test('switching on a band-only feature opens its detail', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'cost-meter': false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  const title = await rowTitle(ui, 'cost-meter')
  await ui.press({ key: 't-cost-meter' })
  expect(last(w)).toMatchObject({ id: 'toolkitty-detail', focus: true })
  expect(await noticeTexts($)).toContain(`${title} is on · opened`)
  await ui.unmount()
})

test('switching on a background-only feature opens nothing and says what it does', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'dangerous-commands': false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  const title = await rowTitle(ui, 'dangerous-commands')
  const before = w.opened.length
  await ui.press({ key: 't-dangerous-commands' })
  expect(w.opened.length).toBe(before)
  expect(await noticeTexts($)).toContain(`${title} is on · works in the background: Blocks destructive commands: broad rm -rf, force push, reset --hard and more.`)
  await ui.unmount()
})

test('switching on from the detail pane shows the feature too', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await start($)
  const home = await $.ui.mount(HOME())
  await home.press({ key: 'live-buddy' })
  await home.unmount()
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  await d.press({ key: 'detail-toggle' })
  expect((await noticeTexts($)).some(x => x.endsWith(' off'))).toBe(true)
  await d.redraw()
  await d.press({ key: 'detail-toggle' })
  expect(last(w)).toMatchObject({ id: 'buddy', focus: true })
  expect((await noticeTexts($)).some(x => x.endsWith(' is on · opened'))).toBe(true)
  await d.unmount()
})

test('the notices are in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he', enabled: { buddy: false, 'dangerous-commands': false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  const buddy = await rowTitle(ui, 'buddy')
  const danger = await rowTitle(ui, 'dangerous-commands')
  expect((await ui.find({ key: 'open-advisor' }))!.props['label']).toBe('פתח')
  await ui.press({ key: 't-buddy' })
  await ui.press({ key: 't-dangerous-commands' })
  const n = await noticeTexts($)
  expect(n).toContain(`${buddy} פועל · נפתח`)
  expect(n.some(x => x.startsWith(`${danger} פועל · עובד ברקע: `))).toBe(true)
  await ui.press({ key: 't-buddy' })
  expect(await noticeTexts($)).toContain(`${buddy} כבוי`)
  expect(w.opened.some((o: any) => o.id === 'buddy')).toBe(true)
  await ui.unmount()
})

// ---------- open at start ----------

test('a star persists in the store, shows as a filled star, and toggles back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 'star-buddy' }))!.props['label']).toBe('☆')
  expect(w.store.get('autoOpen')).toBeUndefined()
  await ui.press({ key: 'star-buddy' })
  expect(w.store.get('autoOpen')).toEqual(['buddy'])
  await ui.press({ key: 'star-week-heatmap' })
  expect(w.store.get('autoOpen')).toEqual(['buddy', 'week-heatmap'])
  await ui.redraw()
  expect((await ui.find({ key: 'star-buddy' }))!.props['label']).toBe('★')
  await ui.press({ key: 'star-buddy' })
  expect(w.store.get('autoOpen')).toEqual(['week-heatmap'])
  await ui.unmount()
})

test('session.attach opens Toolkitty pane first, then every starred pane unfocused; stars of features that are off are skipped', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [], store: { autoOpen: ['buddy', 'week-heatmap', 'context-aquarium'], enabled: { 'context-aquarium': false, buddy: true, 'week-heatmap': true } } })
  await start($)
  expect(w.opened).toEqual([])
  w.surfaces = ['desktop']
  await $.session.attach({ clientId: 'c1' })
  const ids = w.opened.map((o: any) => o.id)
  expect(ids).toEqual(['toolkitty', 'buddy', 'heatmap'])
  expect(w.opened[1].focus).toBeFalsy()
  expect(w.opened[2].focus).toBeFalsy()
})

test('with no stars, attach opens nothing beyond the pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [] })
  await start($)
  w.surfaces = ['desktop']
  await $.session.attach({ clientId: 'c1' })
  expect(w.opened.map((o: any) => o.id)).toEqual(['toolkitty'])
})

// ---------- Live now ----------

test('the home pane has a Live now section: a pressable row per feature that draws, and a line for the silent ones', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await start($)
  const ui = await $.ui.mount(HOME())
  const all = await texts(ui)
  expect(all).toContain('Live now')
  const live = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string).filter((k: string) => k.startsWith('live-'))
  expect(live).toContain('live-advisor')
  expect(live).toContain('live-buddy')
  expect(all.some(x => /^\d+ features work silently in the background$/.test(x))).toBe(true)
  await ui.press({ key: 'live-buddy' })
  expect(last(w)).toMatchObject({ id: 'toolkitty-detail', focus: true, closeOnEscape: true })
  await ui.unmount()
})

test('the silent line counts only features that are on and draw nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(HOME())
  const count = async () => Number(/^(\d+) features? work/.exec((await texts(ui)).find(x => /work silently/.test(x)) ?? '')?.[1])
  const n = await count()
  expect(n).toBeGreaterThan(5)
  const sw = await $.ui.mount(SW())
  await sw.press({ key: 't-dangerous-commands' })
  await sw.unmount()
  await ui.redraw()
  expect(await count()).toBe(n - 1)
  expect(w.cmds).toContain('home')
  await ui.unmount()
})

test('Live now in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const ui = await $.ui.mount(HOME('terminal'))
  const all = await joined(ui)
  expect(all).toContain('פעילים כעת')
  expect(all).toMatch(/\d+ שכלולים עובדים בשקט ברקע/)
  await ui.unmount()
})

// ---------- display profile untouched ----------

test('the profile chip limit still cuts the band to the headline plus two', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { profile: 'minimal' } })
  w.limits = [{ kind: 'five_hour', percentUsed: 60, resetsAt: new Date(2026, 10, 8, 15).toISOString() }]
  w.usage = { percent: 40, usd: 2 }
  await start($)
  await turnStart($)
  await turnDone($, 5000)
  const b = await $.ui.mount(BAND())
  const chips = (await b.findAll({ type: 'Button' })).map((x: any) => x.key as string).filter((k: string) => k.startsWith('chip-') && k !== 'chip-notices' && k !== 'chip-advisor')
  expect(chips.length).toBeLessThanOrEqual(2)
  await b.unmount()
})
