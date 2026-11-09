import { expect, test } from 'claude-code/testing'
import { PANE, joined, noticeTexts, start, svgOf, turnDone, turnStart, world } from './harness'

const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const MURKY = 'The water is getting murky: context is past 90%. Time to /compact or start fresh.'
const measure = ($: any, percent: number | undefined) => $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed: [] })
const read = async ($: any, n = 1) => {
  for (let i = 0; i < n; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
}

test('load: /aquarium opens the pane; arguments are ignored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('aquarium')
  expect((await $.command.run({ command: 'aquarium', args: '' })).text).toBe('The aquarium is open.')
  expect(w.opened.map(o => o.id)).toContain('aquarium')
  expect((await $.command.run({ command: 'aquarium', args: 'whatever' })).text).toBe('The aquarium is open.')
})

test('desktop: an Svg tank with alt, under 128 KB, whose water follows the context', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 10 } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  const low = await svgOf(ui)
  expect(low.source.startsWith('<svg')).toBe(true)
  expect(low.source.length).toBeLessThan(128 * 1024)
  expect(low.alt).toBe('An aquarium filled to 10%, with 1 fish')
  expect(low.isInteractive).toBe(true)
  expect(low.source).toContain('>10%<')
  expect(await joined(ui)).toContain('10% of the context window · 1 fish (tool calls this turn)')

  await measure($, 55)
  const mid = await svgOf(ui)
  expect(mid.source).not.toBe(low.source)
  expect(mid.alt).toContain('55%')
  expect(mid.source).toContain('>55%<')

  await measure($, 80)
  const murky = await svgOf(ui)
  expect(murky.source).not.toBe(mid.source)
  expect(murky.source).toContain('#d9f99d') // the warm label past 70%

  await measure($, 96)
  const brown = await svgOf(ui)
  expect(brown.source).not.toBe(murky.source)
  expect(brown.source).toContain('#fca5a5')
  expect(brown.source.length).toBeLessThan(128 * 1024)

  // the figure also comes from the usage at the end of a turn
  w.usage.percent = 30
  await turnStart($)
  await turnDone($)
  expect((await svgOf(ui)).alt).toContain('30%')
  await ui.unmount()
})

test('the percent is rounded and clamped', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  await measure($, 42.6)
  expect(await joined(ui)).toContain('43%')
  await measure($, 150)
  expect(await joined(ui)).toContain('100%')
  await measure($, -5)
  expect(await joined(ui)).toContain('0%')
  await ui.unmount()
})

test('each tool call is a fish, reset by the next turn, at most twelve', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect((await svgOf(ui)).alt).toContain('with 1 fish')
  await turnStart($)
  await read($, 3)
  expect((await svgOf(ui)).alt).toContain('with 3 fish')
  // a denied call is not a fish
  w.toolResult = { deny: 'no' }
  await read($, 2)
  w.toolResult = { result: {} }
  expect((await svgOf(ui)).alt).toContain('with 3 fish')
  await read($, 12)
  const crowded = await svgOf(ui)
  expect(crowded.alt).toContain('with 12 fish')
  expect(crowded.source.length).toBeLessThan(128 * 1024)
  await turnDone($)
  // the fish stay until the next turn begins
  expect((await svgOf(ui)).alt).toContain('with 12 fish')
  await turnStart($)
  expect((await svgOf(ui)).alt).toContain('with 1 fish')
  await ui.unmount()
})

test('bubbles rise while Claude works', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  const calm = (await svgOf(ui)).source
  await turnStart($)
  const busy = (await svgOf(ui)).source
  expect(busy).not.toBe(calm)
  expect(busy).toContain('fill-opacity=".18"')
  expect(calm).not.toContain('fill-opacity=".18"')
  await turnDone($)
  expect((await svgOf(ui)).source).not.toContain('fill-opacity=".18"')
  // a subagent's turn is not Claude working here
  await turnStart($, { agentId: 'a' })
  expect((await svgOf(ui)).source).not.toContain('fill-opacity=".18"')
  await ui.unmount()
})

test('terminal: a boxed tank of text with the context label and a colored percent', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { usage: { percent: 10 } })
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  const all = await joined(ui)
  expect(all).toContain('CONTEXT')
  expect(all).toContain('10%')
  expect(all).toContain('1 fish')
  // the header repeats the percent as its status word; the tank's own figure is the last one
  const pct = async () => (await ui.findAll({ type: 'Text' })).filter((x: any) => /^\d+%$/.test(x.text)).pop()!
  expect((await pct()).props['color']).toBe('success')
  await measure($, 75)
  expect((await pct()).props['color']).toBe('warning')
  await measure($, 92)
  expect((await pct()).props['color']).toBe('error')
  // the tank rows are drawn (10 rows of text in a boxed column)
  const rows = (await ui.findAll({ type: 'Text' })).filter((x: any) => x.key === undefined && x.text.length >= 20)
  expect(rows.length).toBeGreaterThan(5)
  await turnStart($)
  await read($, 4)
  expect(await joined(ui)).toContain('4 fish')
  await ui.unmount()
})

test('an unknown percent shows a dash', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { usage: { percent: undefined } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await joined(ui)).toContain('—')
  await ui.unmount()
  const d = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect((await svgOf(d)).alt).toContain('filled to —')
  await d.unmount()
})

test('the murky warning fires once past 90% and re-arms under 80%', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  // the same warning inside five minutes is one row with a count (`MURKY ×2`): the warnings raised are the sum of the counts
  const count = async () =>
    (await noticeTexts($))
      .filter(x => x === MURKY || x.startsWith(`${MURKY} ×`))
      .reduce((n, x) => n + (x === MURKY ? 1 : Number(x.slice(MURKY.length + 2))), 0)
  await measure($, 85)
  expect(await count()).toBe(0)
  await measure($, 90)
  expect(await count()).toBe(1)
  await measure($, 95)
  expect(await count()).toBe(1)
  await measure($, 85) // not yet under 80
  await measure($, 92)
  expect(await count()).toBe(1)
  await measure($, 79)
  await measure($, 91)
  expect(await count()).toBe(2)
  // a warn is listed in the notices but never pops a toast
  expect(w.toasts.filter(x => x === MURKY)).toEqual([])
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'aquarium', args: '' })).text).toBe('האקווריום פתוח.')
  const t = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await joined(t)).toContain('הקשר')
  await t.unmount()
  const d = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await joined(d)).toContain('10%')
  await d.unmount()
  await measure($, 93)
  expect((await noticeTexts($)).some(x => x.includes('90%'))).toBe(true)
})

test('off switch: the command and pane say so; events change nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'context-aquarium': false } } })
  await start($)
  expect((await $.command.run({ command: 'aquarium', args: '' })).text).toBe(OFF)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await joined(ui)).toBe(OFF)
  await measure($, 99)
  await turnStart($)
  await read($, 2)
  await turnDone($)
  expect((await noticeTexts($)).filter(x => x === MURKY).length).toBe(0)
  expect(await joined(ui)).toBe(OFF)
  await ui.unmount()
})

test('switching the feature on at run time starts the tank', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { 'context-aquarium': false } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await joined(ui)).toBe(OFF)
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  await sw.press({ key: 't-context-aquarium' })
  await measure($, 66)
  expect((await svgOf(ui)).alt).toContain('66%')
  await sw.unmount()
  await ui.unmount()
})

test('the pane header: the title, the percent as the status word colored by level', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { usage: { percent: 10 } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE('aquarium'), surface })
    expect((await ui.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)).toEqual(['✦', 'Aquarium', '10%'])
    const status = async () => (await ui.findAll({ type: 'Text' }))[2]!.props['color']
    expect(await status()).toBe('claude')
    await measure($, 75)
    expect(await status()).toBe('warning')
    await measure($, 93)
    expect(await status()).toBe('error')
    await measure($, 10)
    await ui.unmount()
  }
})
