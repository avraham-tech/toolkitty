import { expect, test } from 'claude-code/testing'
import { PANE, joined, start, svgOf, turnDone, turnStart, world } from './harness'

const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const ON = { enabled: { 'aurora-backdrop': true } }
const BACKDROP = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({ plugin: 'toolkitty', component: 'Backdrop', requestId: 'aurora', surface, props: { id: 'aurora', plugin: 'toolkitty', glass: { blur: 18, opacity: 0.5 } } }) as const
const measure = ($: any, percent: number) => $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed: [] })

test('it is off by default: no backdrop, the command says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('aurora')
  expect(w.backdrops).toEqual([])
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toBe(OFF)
  await turnStart($)
  await turnDone($)
  expect(w.backdrops).toEqual([])
  // the render passes to the engine
  const ui = await $.ui.mount(BACKDROP())
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('off, in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

test('on: the backdrop goes up once at session start, with glass', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON })
  await start($)
  expect(w.backdrops).toEqual([{ id: 'aurora', glass: { blur: 18, opacity: 0.5 } }])
  await turnStart($)
  await turnDone($)
  expect(w.backdrops.length).toBe(1)
})

test('the Backdrop render is an interactive Svg with alt, under 128 KB', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: ON })
  await start($)
  const ui = await $.ui.mount(BACKDROP())
  const svg = await svgOf(ui)
  expect(svg.source.startsWith('<svg')).toBe(true)
  expect(svg.source.length).toBeLessThan(128 * 1024)
  expect(svg.alt).toBe('A slowly drifting aurora of blurred color')
  expect(svg.isInteractive).toBe(true)
  expect(svg.source).toContain('#040a18') // the classic idle background
  await ui.unmount()
})

test('the Svg follows the state: working, context level, theme', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON })
  await start($)
  const ui = await $.ui.mount(BACKDROP())
  const idle = (await svgOf(ui)).source

  await turnStart($)
  const working = (await svgOf(ui)).source
  expect(working).not.toBe(idle)
  expect(working).toContain('#0a0418')

  await measure($, 75)
  const warn = (await svgOf(ui)).source
  expect(warn).not.toBe(working)
  expect(warn).toContain('#150b02')

  await measure($, 95)
  const hot = (await svgOf(ui)).source
  expect(hot).not.toBe(warn)
  expect(hot).toContain('#150409')

  // a measure under 70 clears the level; the turn ending also re-reads usage
  w.usage.percent = 20
  await turnDone($)
  const calm = (await svgOf(ui)).source
  expect(calm).toBe(idle)

  // 70 exactly is not past 70, 90 exactly is not past 90
  await measure($, 70)
  expect((await svgOf(ui)).source).toBe(idle)
  await measure($, 90)
  expect((await svgOf(ui)).source).toContain('#150b02')
  await measure($, 91)
  expect((await svgOf(ui)).source).toContain('#150409')
  await ui.unmount()
})

test('a measure with no percent is calm', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: ON })
  await start($)
  const ui = await $.ui.mount(BACKDROP())
  const idle = (await svgOf(ui)).source
  await measure($, 95)
  await $.session.measure({ context: { window: 200000 }, rateLimits: [], changed: [] })
  expect((await svgOf(ui)).source).toBe(idle)
  await ui.unmount()
})

test('a theme recolors the aurora', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { ...ON, 'themes:current': 'matrix' } })
  await start($)
  const ui = await $.ui.mount(BACKDROP())
  const svg = (await svgOf(ui)).source
  expect(svg).toContain('#00ff66')
  expect(svg).not.toContain('#040a18')
  await ui.unmount()
  // and switching theme at run time redraws it
  const u2 = await $.ui.mount({ ...BACKDROP(), requestId: 'aurora' })
  await $.command.run({ command: 'themes', args: 'sunset' })
  expect((await svgOf(u2)).source).toContain('#fb7185')
  await u2.unmount()
})

test('subagent turns do not make it work', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: ON })
  await start($)
  const ui = await $.ui.mount(BACKDROP())
  const idle = (await svgOf(ui)).source
  await turnStart($, { agentId: 'a1' })
  expect((await svgOf(ui)).source).toBe(idle)
  await turnDone($, 100, { agentId: 'a1' })
  await ui.unmount()
})

test('/aurora toggles the backdrop for this session', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON })
  await start($)
  expect(w.backdrops.length).toBe(1)
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toStartWith('Aurora backdrop off.')
  expect(w.backdrops[w.backdrops.length - 1]).toBeUndefined()
  expect(w.backdrops.length).toBe(2)
  // while unwanted the render passes
  const ui = await $.ui.mount(BACKDROP())
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect((await $.command.run({ command: 'aurora', args: 'x' })).text).toStartWith('Aurora backdrop on.')
  expect(w.backdrops.length).toBe(3)
  expect(w.backdrops[2]).toMatchObject({ id: 'aurora' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()
})

test('/aurora in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { ...ON, language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toStartWith('רקע האורורה כבוי.')
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toStartWith('רקע האורורה פועל.')
})

test('a terminal-only session cannot draw it: no backdrop, the command explains', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON, surfaces: ['terminal'] })
  await start($, 'terminal')
  expect(w.backdrops).toEqual([])
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toBe('The aurora backdrop works in the desktop app only; this terminal cannot draw it.')
  await turnStart($)
  await turnDone($)
  expect(w.backdrops).toEqual([])
  const ui = await $.ui.mount(BACKDROP('terminal'))
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('it goes up later when a desktop attaches after a terminal-only start', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON, surfaces: ['terminal'] })
  await start($, 'terminal')
  expect(w.backdrops).toEqual([])
  w.surfaces = ['terminal', 'desktop']
  await turnStart($)
  expect(w.backdrops.length).toBe(1)
  expect(w.backdrops[0]).toMatchObject({ id: 'aurora' })
})

test('turning the feature off calls $.theme.clear() at the next turn', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON })
  await start($)
  expect(w.backdrops.length).toBe(1)
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  await sw.press({ key: 't-aurora-backdrop' })
  await turnStart($)
  expect(w.backdrops.length).toBe(2)
  expect(w.backdrops[1]).toBeUndefined()
  // the render now passes
  const ui = await $.ui.mount(BACKDROP())
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  // and the command says so
  expect((await $.command.run({ command: 'aurora', args: '' })).text).toBe(OFF)
  // switching it back on and starting a turn raises it again
  await sw.press({ key: 't-aurora-backdrop' })
  await turnDone($)
  expect(w.backdrops.length).toBe(3)
  expect(w.backdrops[2]).toMatchObject({ id: 'aurora' })
  await ui.unmount()
  await sw.unmount()
})

test('a surface that fails the backdrop call does not break the turn', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: ON })
  w.failBackdrop = true
  await start($)
  await turnStart($)
  await turnDone($)
  expect(w.backdrops).toEqual([])
  void joined
})
