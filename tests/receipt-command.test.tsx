import { expect, test } from 'claude-code/testing'
import { PANE, joined, labels, lastNotice, start, svgOf, texts, turnDone, turnStart, world, SHOWN } from './harness'

/* The /receipt command, the History list in the receipt pane, and the history kept in the store across sessions. */

const USAGE = { input_tokens: 1000, output_tokens: 234, cache_read_input_tokens: 5000, cache_creation_input_tokens: 100, model: 'claude-sonnet-5-5' }
const STAMP = '2026-11-08-1200'
const DIR = 'C:/proj/toolkitty-exports'
const KEY = 'turn-receipt:history'

async function busyTurn($: any, w: any, reads = 5): Promise<void> {
  w.usage.usd = 1
  await turnStart($)
  for (let i = 0; i < reads; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  w.usage.usd = 1.5
  await turnDone($, 2000, { usage: USAGE })
}

const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('receipt'), surface })

const STORED = (id: number, reads: number) => ({
  id,
  at: new Date(2026, 10, 7, 9, id).getTime(),
  counts: { reads, edits: 0, writes: 0, searches: 0, bash: 0, web: 0, agents: 0, other: 0 },
  durationMs: 20000,
  tokens: 1500 * id,
  cost: id / 10,
})

test('load: /receipt is registered; with no receipt it opens the pane focused and says there is none', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('receipt')
  expect((await $.command.run({ command: 'receipt', args: '' })).text).toBe('No receipt yet.')
  expect(w.opened.find(o => o.id === 'receipt')).toMatchObject({ id: 'receipt', title: 'Receipt', focus: true })
  const ui = await pane($)
  expect(await joined(ui)).toContain('A long or busy turn prints one here.')
  await ui.unmount()
})

test('/receipt opens the pane focused on the latest receipt', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w, 4)
  await busyTurn($, w, 6)
  const res = await $.command.run({ command: 'receipt', args: '' })
  expect(res.text).toBe('Opened the receipt pane.')
  expect(w.opened.filter(o => o.id === 'receipt' && o.focus === true).length).toBe(1)
  const ui = await pane($)
  expect((await svgOf(ui)).alt).toContain('6 tool calls')
  await ui.unmount()
})

test('the pane keeps a collapsed History (N); a press expands it, one line per kept receipt, newest first', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w, 4)
  await busyTurn($, w, 5)
  await busyTurn($, w, 6)
  const ui = await pane($)
  expect(await labels(ui)).toContain('▸ History (3)')
  expect(await ui.find({ type: 'Button', key: 'receipt-hist-1' })).toBeUndefined()

  await ui.press({ key: 'receipt-history' })
  await ui.redraw()
  expect(await labels(ui)).toContain('▾ History (3)')
  const rows = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('receipt-hist-'))
  expect(rows.map((b: any) => b.key)).toEqual(['receipt-hist-3', 'receipt-hist-2', 'receipt-hist-1'])
  expect(rows[0].text).toContain('11-08 12:00 · 6 calls · 6,334 tok · $0.50')
  expect(rows[2].text).toContain('4 calls')

  // a press on a line shows that receipt in the pane
  await ui.press({ key: 'receipt-hist-1' })
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('4 tool calls')
  expect(await texts(ui)).toContain('4 calls')
  await ui.press({ key: 'receipt-hist-3' })
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('6 tool calls')

  // collapse again
  await ui.press({ key: 'receipt-history' })
  await ui.redraw()
  expect(await ui.find({ type: 'Button', key: 'receipt-hist-2' })).toBeUndefined()
  await ui.unmount()
})

test('the export bar saves and copies the receipt that is shown, not only the latest', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w, 4)
  await busyTurn($, w, 6)
  const ui = await pane($)
  await ui.press({ key: 'receipt-history' })
  await ui.redraw()
  await ui.press({ key: 'receipt-hist-1' })
  await ui.redraw()
  await ui.press({ key: 'exp-copy-receipt' })
  expect(w.copies[0]!.text).toMatch(/READS \.+ 4/)
  await ui.unmount()
})

test('a new receipt brings the pane back to the latest, and /receipt does too', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w, 4)
  await busyTurn($, w, 5)
  const ui = await pane($)
  await ui.press({ key: 'receipt-history' })
  await ui.redraw()
  await ui.press({ key: 'receipt-hist-1' })
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('4 tool calls')
  await busyTurn($, w, 7)
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('7 tool calls')
  await ui.press({ key: 'receipt-hist-2' })
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('5 tool calls')
  await $.command.run({ command: 'receipt', args: '' })
  await ui.redraw()
  expect((await svgOf(ui)).alt).toContain('7 tool calls')
  await ui.unmount()
})

test('/receipt save writes the latest receipt as an SVG that never overwrites', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await $.command.run({ command: 'receipt', args: 'save' })).text).toBe('No receipt yet.')
  expect(w.written).toEqual([])
  await busyTurn($, w, 4)
  await busyTurn($, w, 6)
  const first = await $.command.run({ command: 'receipt', args: 'save' })
  expect(first.text).toBe(`Saved the latest receipt: ${DIR}/receipt-${STAMP}.svg`)
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  expect(w.written[0]!.text).toContain('>6<')
  const second = await $.command.run({ command: 'receipt', args: 'SAVE' })
  expect(second.text).toBe(`Saved the latest receipt: ${DIR}/receipt-${STAMP}-2.svg`)
  w.failWrite = true
  expect((await $.command.run({ command: 'receipt', args: 'save' })).text).toBe('Could not save the file')
})

test('/receipt all writes the whole history as one .txt, oldest first', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect((await $.command.run({ command: 'receipt', args: 'all' })).text).toBe('No receipt yet.')
  await busyTurn($, w, 4)
  await busyTurn($, w, 5)
  await busyTurn($, w, 6)
  const res = await $.command.run({ command: 'receipt', args: 'all' })
  expect(res.text).toBe(`Saved 3 receipts: ${DIR}/receipt-history-${STAMP}.txt`)
  expect(w.written.length).toBe(1)
  const text = w.written[0]!.text
  expect(text).toContain('CLAUDE CODE · RECEIPT · History (3)')
  const reads = [...text.matchAll(/READS \.+ (\d+)/g)].map(m => m[1])
  expect(reads).toEqual(['4', '5', '6'])
  expect(text.match(/Get yours: claude plugin install toolkitty --marketplace avraham-tech\/toolkitty/g)?.length).toBe(1)
})

test('/receipt with an unknown argument prints the usage', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const res = await $.command.run({ command: 'receipt', args: 'frobnicate' })
  expect(res.text).toBe('Usage: /receipt · /receipt save (latest as SVG) · /receipt all (history as .txt)')
  expect(w.opened.map(o => o.id)).not.toContain('receipt')
})

test('the last 30 receipts are kept in the store, and a new session reads them back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  for (let i = 0; i < 32; i++) await busyTurn($, w, 4)
  const stored = w.store.get(KEY) as { seq: number; list: { id: number }[] }
  expect(stored.seq).toBe(32)
  expect(stored.list.length).toBe(30)
  expect(stored.list[0]!.id).toBe(3)
  expect(stored.list[29]!.id).toBe(32)
})

test('history survives a restart: stored receipts show in History, and the next receipt continues the numbering', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { [KEY]: { seq: 7, list: [STORED(6, 8), STORED(7, 9)] } } })
  await start($)
  const ui = await pane($)
  expect(await labels(ui)).toContain('▸ History (2)')
  expect((await svgOf(ui)).alt).toContain('9 tool calls')
  await ui.press({ key: 'receipt-history' })
  await ui.redraw()
  const rows = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('receipt-hist-'))
  expect(rows.map((b: any) => b.key)).toEqual(['receipt-hist-7', 'receipt-hist-6'])
  expect(rows[1].text).toContain('11-07 09:06 · 8 calls · 9,000 tok · $0.60')

  await busyTurn($, w, 5)
  expect(w.placed).toEqual(['receipt-8'])
  await ui.redraw()
  expect(await labels(ui)).toContain('▾ History (3)')
  expect((w.store.get(KEY) as { seq: number; list: unknown[] }).seq).toBe(8)
  expect((w.store.get(KEY) as { seq: number; list: unknown[] }).list.length).toBe(3)
  await ui.unmount()

  // /receipt all includes the old receipts
  const all = await $.command.run({ command: 'receipt', args: 'all' })
  expect(all.text).toContain('Saved 3 receipts')
  expect([...w.written[0]!.text.matchAll(/READS \.+ (\d+)/g)].map(m => m[1])).toEqual(['8', '9', '5'])
})

test('a damaged stored history is ignored without a crash', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { [KEY]: { seq: 'x', list: [null, 5, { id: 'a' }, { id: 1, at: 1, durationMs: 1, tokens: 1, counts: null }, STORED(2, 3)] } } })
  await start($)
  expect(w.cmds).toContain('receipt')
  const ui = await pane($)
  expect(await labels(ui)).toContain('▸ History (1)')
  await ui.unmount()
})

test('garbage instead of a history object is ignored too', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { [KEY]: 'nope' } })
  await start($)
  const ui = await pane($)
  expect(await joined(ui)).toContain('No receipt yet.')
  await ui.unmount()
})

test('off switch: /receipt says so and nothing is stored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'turn-receipt': false } } })
  await start($)
  expect(w.cmds).toContain('receipt')
  for (const args of ['', 'save', 'all']) {
    expect((await $.command.run({ command: 'receipt', args })).text).toBe('Turn receipts are off. Turn them on in the /toolkitty pane.')
  }
  await busyTurn($, w)
  expect(w.store.get(KEY)).toBeUndefined()
  expect(w.opened.map(o => o.id)).not.toContain('receipt')
})

test('Hebrew: the command texts, the history line and the bar labels', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'receipt', args: '' })).text).toBe('עדיין אין קבלה.')
  await busyTurn($, w)
  expect((await $.command.run({ command: 'receipt', args: '' })).text).toBe('חלונית הקבלה נפתחה.')
  expect((await $.command.run({ command: 'receipt', args: 'zzz' })).text).toContain('שימוש: /receipt')
  const ui = await pane($)
  expect(await labels(ui)).toEqual(['שמור SVG', 'העתק טקסט', 'שתף', 'הדפס', 'פתח תיקייה', 'העתק נתיב', '▸ היסטוריה (1)'])
  await ui.press({ key: 'exp-save-receipt' })
  expect(await lastNotice($)).toBe(`נשמר ${SHOWN}receipt-${STAMP}.svg`)
  expect((await $.command.run({ command: 'receipt', args: 'save' })).text).toBe(`הקבלה האחרונה נשמרה: ${DIR}/receipt-${STAMP}-2.svg`)
  expect((await $.command.run({ command: 'receipt', args: 'all' })).text).toBe(`1 קבלות נשמרו: ${DIR}/receipt-history-${STAMP}.txt`)
  await ui.unmount()
  const term = await pane($, 'terminal')
  expect(await labels(term)).toEqual(['שמור טקסט', 'העתק טקסט', 'שתף', 'הדפס', 'פתח תיקייה', 'העתק נתיב', '▸ היסטוריה (1)'])
  await term.unmount()
})

test('Japanese: the command texts, the history line and the bar labels', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'ja' } })
  await start($)
  expect((await $.command.run({ command: 'receipt', args: '' })).text).toBe('レシートはまだありません。')
  await busyTurn($, w)
  expect((await $.command.run({ command: 'receipt', args: '' })).text).toBe('レシートのパネルを開きました。')
  const ui = await pane($)
  expect(await labels(ui)).toEqual(['SVG を保存', 'テキストをコピー', '共有', '印刷', 'フォルダーを開く', 'パスをコピー', '▸ 履歴（1）'])
  expect((await $.command.run({ command: 'receipt', args: 'save' })).text).toBe(`最新のレシートを保存しました：${DIR}/receipt-${STAMP}.svg`)
  expect((await $.command.run({ command: 'receipt', args: 'all' })).text).toBe(`1 件のレシートを保存しました：${DIR}/receipt-history-${STAMP}.txt`)
  await ui.unmount()
})
