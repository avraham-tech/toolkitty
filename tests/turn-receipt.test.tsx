import { expect, test } from 'claude-code/testing'
import { PANE, joined, lastNotice, start, svgOf, turnDone, turnStart, world, SHOWN } from './harness'

const PLACED = (n: number, surface: 'desktop' | 'terminal' = 'desktop') =>
  ({ plugin: 'toolkitty', component: 'Placed', requestId: `receipt-${n}`, surface, props: { id: `receipt-${n}`, plugin: 'toolkitty' } }) as const

const USAGE = { input_tokens: 1000, output_tokens: 234, cache_read_input_tokens: 5000, cache_creation_input_tokens: 100, model: 'claude-sonnet-5-5' }

/** A turn with n Read calls and the usage cost moving from `from` to `to`. */
async function busyTurn($: any, w: any, opts: { reads?: number; ms?: number; from?: number; to?: number; usage?: boolean } = {}) {
  w.usage.usd = opts.from ?? 1
  await turnStart($)
  for (let i = 0; i < (opts.reads ?? 5); i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  w.usage.usd = opts.to ?? 1.5
  await turnDone($, opts.ms ?? 2000, opts.usage === false ? {} : { usage: USAGE })
}

test('a busy turn places a receipt row; the Placed render draws it as an Svg on the desktop', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  expect(w.placed).toEqual(['receipt-1'])
  expect(w.opened.map(o => o.id)).not.toContain('receipt')

  const ui = await $.ui.mount(PLACED(1))
  const svg = await svgOf(ui)
  expect(svg.source.startsWith('<svg')).toBe(true)
  expect(svg.source.length).toBeLessThan(128 * 1024)
  expect(svg.alt).toBe('Receipt for the last turn: 5 tool calls, 0:02, 6,334 tokens, total $0.50')
  expect(svg.source).toContain('CLAUDE CODE · RECEIPT')
  expect(svg.source).toContain('READS')
  expect(svg.source).toContain('THANK YOU FOR VIBING')
  expect(svg.source).toContain('$0.50')
  expect(svg.source).toContain('6,334 tok')
  expect(await ui.find({ type: 'Button', key: 'exp-share-receipt' })).toBeDefined()
  await ui.unmount()
})

test('terminal: the receipt is a Box of rows', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  const all = await joined(ui)
  expect(all).toContain('CLAUDE CODE · RECEIPT')
  expect(all).toMatch(/READS \.+ 5/)
  expect(all).toMatch(/TIME \.+ 0:02/)
  expect(all).toMatch(/SUBTOTAL \.+ 6,334 tok/)
  expect(all).toMatch(/TOTAL \.+ \$0\.50/)
  expect(all).toContain('THANK YOU FOR VIBING')
  expect(all).toMatch(/\* 0001 \d{5} \*/)
  expect(all).not.toContain('WRITES')
  await ui.unmount()
})

test('every tool lands in its own line of the receipt', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await turnStart($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/b.ts' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: 'C:/proj/new.ts', content: 'x' })
  await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  await $.tool.call({ tool: 'Glob', pattern: '*.ts' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'WebFetch', url: 'https://example.com', prompt: 'x' })
  await $.tool.call({ tool: 'TodoWrite', todos: [] })
  await turnDone($, 1000)
  expect(w.placed).toEqual(['receipt-1'])
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  const all = await joined(ui)
  expect(all).toMatch(/READS \.+ 2/)
  expect(all).toMatch(/EDITS \.+ 1/)
  expect(all).toMatch(/WRITES \.+ 1/)
  expect(all).toMatch(/SEARCHES \.+ 2/)
  expect(all).toMatch(/COMMANDS \.+ 1/)
  expect(all).toMatch(/WEB FETCHES \.+ 1/)
  expect(all).toMatch(/OTHER TOOLS \.+ 1/)
  expect(all).not.toContain('SUBAGENTS')
  await ui.unmount()
})

test('a short quiet turn prints no receipt; a long one or a busy one does', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  // 3 calls and 15 s exactly are not enough
  await turnStart($)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  await turnDone($, 15_000)
  expect(w.placed).toEqual([])
  // longer than 15 s is
  await turnStart($)
  await turnDone($, 15_001)
  expect(w.placed).toEqual(['receipt-1'])
  // more than 3 calls is
  await turnStart($)
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  await turnDone($, 100)
  expect(w.placed).toEqual(['receipt-1', 'receipt-2'])
  // a quiet turn: "(no tool calls)"
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  expect(await joined(ui)).toContain('(no tool calls)')
  await ui.unmount()
})

test('denied tool calls are not counted, subagent turns are not receipts', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await turnStart($)
  w.toolResult = { deny: 'nope' }
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  w.toolResult = { result: {} }
  await turnDone($, 100)
  expect(w.placed).toEqual([])
  // a subagent's own turn.start / turn.complete are ignored
  await turnStart($, { agentId: 'sub1' })
  await turnDone($, 60_000, { agentId: 'sub1' })
  expect(w.placed).toEqual([])
})

test('no usage on the turn means 0 tokens; no cost reading means a dash', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 5 } })
  await start($, 'terminal')
  await turnStart($)
  await turnDone($, 20_000)
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  const all = await joined(ui)
  expect(all).toMatch(/SUBTOTAL \.+ 0 tok/)
  expect(all).toMatch(/TOTAL \.+ —/)
  await ui.unmount()
  w.usage.usd = 2
})

test('the pane fallback when the surface cannot place a row', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.placeOk = false
  await start($)
  const empty = await $.ui.mount({ ...PANE('receipt'), surface: 'desktop' })
  expect(await joined(empty)).toContain('No receipt yet.')
  expect(await joined(empty)).toContain('A long or busy turn prints one here.')
  await busyTurn($, w)
  expect(w.opened.map(o => o.id)).toContain('receipt')
  const ui = empty
  expect((await svgOf(ui)).alt).toContain('5 tool calls')
  expect(await ui.find({ type: 'Button', key: 'exp-share-receipt' })).toBeDefined()
  // a second receipt replaces the first in the pane
  await busyTurn($, w, { reads: 7 })
  expect((await svgOf(ui)).alt).toContain('7 tool calls')
  await ui.unmount()
})

test('the pane on the terminal', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await busyTurn($, w)
  const ui = await $.ui.mount({ ...PANE('receipt'), surface: 'terminal' })
  expect(await joined(ui)).toContain('CLAUDE CODE · RECEIPT')
  await ui.unmount()
})

test('share: saves the SVG and copies the plain-text receipt', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  await ui.press({ key: 'exp-share-receipt' })
  expect(w.written.length).toBe(1)
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/receipt-2026-11-08-1200.svg')
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  expect(w.copies.length).toBe(1)
  const text = w.copies[0]!.text
  expect(text).toContain('CLAUDE CODE · RECEIPT')
  expect(text).toMatch(/READS \.+ 5/)
  expect(text).toMatch(/TOTAL \.+ \$0\.50/)
  expect(text).toContain('Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(w.copies[0]!.surface).toBe('desktop')
  expect(await lastNotice($)).toBe(`Copied + saved ${SHOWN}receipt-2026-11-08-1200.svg`)
  await ui.unmount()
})

// The share notices are info notices: a second one from the same feature within a minute is dropped, so each outcome has its own session.
test('share: the copy fails, the SVG is still saved and the notice says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  w.copyOk = false
  await ui.press({ key: 'exp-share-receipt' })
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}receipt-2026-11-08-1200.svg (could not copy)`)
  await ui.unmount()
})

test('share: neither works, a warning says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  w.copyOk = false
  w.failWrite = true
  await ui.press({ key: 'exp-share-receipt' })
  expect(await lastNotice($)).toBe('Could not copy or save')
  await ui.unmount()
})

test('share: the SVG cannot be saved, the copy still goes through', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  w.failWrite = true
  await ui.press({ key: 'exp-share-receipt' })
  expect(await lastNotice($)).toBe('Copied (could not save the SVG)')
  await ui.unmount()
})

test('share on the terminal', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  await ui.press({ key: 'exp-share-receipt' })
  expect(w.copies[0]!.surface).toBe('terminal')
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/receipt-2026-11-08-1200.svg')
  await ui.unmount()
})

test('Hebrew labels', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($, 'terminal')
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  const all = await joined(ui)
  expect(all).toContain('קריאות')
  expect(all).toContain('סה״כ')
  expect(all).toContain('תודה שנהניתם')
  await ui.press({ key: 'exp-share-receipt' })
  expect(w.copies[0]!.text).toContain('קבלו גם אתם')
  await ui.unmount()
  const d = await $.ui.mount({ ...PLACED(1), surface: 'desktop' })
  expect((await svgOf(d)).alt).toContain('קבלה לתור האחרון')
  await d.unmount()
})

test('the theme sets the footer and the accent', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'themes:current': 'sunset' } })
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  const svg = await svgOf(ui)
  expect(svg.source).toContain('SEE YOU AT DUSK')
  expect(svg.source).toContain('#f97316')
  await ui.unmount()
  const t = await $.ui.mount(PLACED(1, 'terminal'))
  expect(await joined(t)).toContain('SEE YOU AT DUSK')
  await t.unmount()
})

test('only the last 30 receipts are kept; other rows pass to the engine', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  for (let i = 0; i < 32; i++) {
    await turnStart($)
    await turnDone($, 20_000)
  }
  expect(w.placed.length).toBe(32)
  expect(w.placed[31]).toBe('receipt-32')
  const old = await $.ui.mount(PLACED(1))
  expect(await old.find({ type: 'Svg' })).toBeUndefined()
  const fresh = await $.ui.mount(PLACED(32))
  expect(await fresh.find({ type: 'Svg' })).toBeDefined()
  const kept = await $.ui.mount(PLACED(3))
  expect(await kept.find({ type: 'Svg' })).toBeDefined()
  const evicted = await $.ui.mount(PLACED(2))
  expect(await evicted.find({ type: 'Svg' })).toBeUndefined()
  // a row of another feature passes through
  const other = await $.ui.mount({ plugin: 'toolkitty', component: 'Placed', requestId: 'notes-1', surface: 'desktop', props: { id: 'notes-1', plugin: 'toolkitty' } })
  expect(await other.find({ type: 'Svg' })).toBeUndefined()
  for (const m of [old, fresh, kept, evicted, other]) await m.unmount()
})

test('off switch: no receipt, no row, the pane says nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'turn-receipt': false } } })
  await start($)
  await busyTurn($, w)
  expect(w.placed).toEqual([])
  const p = await $.ui.mount({ ...PANE('receipt'), surface: 'desktop' })
  expect(await p.find({ type: 'Svg' })).toBeUndefined()
  expect(await joined(p)).toContain('Receipt')
  await p.unmount()
})

test('switching off mid-session draws existing rows no more', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  const sw = await $.ui.mount({ ...PANE('toolkitty'), surface: 'desktop' })
  await sw.press({ key: 't-turn-receipt' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await sw.press({ key: 't-turn-receipt' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await sw.unmount()
  await ui.unmount()
})

test('the pane has a header and the export bar plus the history line; the placed row has the bar and no header', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE('receipt'), surface })
    expect((await pane.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)).toEqual(['✦', 'Receipt', '5 calls'])
    const keys = (await pane.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(keys).toEqual(['exp-save-receipt', 'exp-copy-receipt', 'exp-share-receipt', 'exp-print-receipt', 'exp-open-receipt', 'exp-path-receipt', 'receipt-history'])
    await pane.press({ key: 'exp-share-receipt' })
    expect(await lastNotice($)).toMatch(/^Copied \+ saved /)
    await pane.unmount()

    const row = await $.ui.mount({ ...PLACED(1, surface), requestId: `receipt-1-${surface}` })
    expect((await row.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['exp-save-receipt', 'exp-copy-receipt', 'exp-share-receipt', 'exp-print-receipt', 'exp-open-receipt', 'exp-path-receipt'])
    expect(await joined(row)).not.toContain('Receipt\n')
    await row.unmount()
  }
})
