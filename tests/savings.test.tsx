import { expect, test } from 'claude-code/testing'

import { allText, bandLine, bashResult, begin, boot, DAY, finishTurn, openDetail, paneOf, SLOW, T0, noticesOf } from './world'

const ID = 'savings'
const QUIET = { 'output-trimmer': false, 'injection-tripwire': false, 'secret-mask': false, 'loop-detective': false }
const store = (extra: Record<string, unknown> = {}, enabled: Record<string, boolean> = {}) => ({ enabled: { ...QUIET, ...enabled }, ...extra })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'

// The same formulas the meter uses, spelled out here so a change to them is caught.
const tokText = (n: number): string => (n < 1000 ? String(Math.round(n)) : n < 10_000 ? `${(n / 1000).toFixed(1)}k` : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${(n / 1_000_000).toFixed(1)}M`)
const usdText = (usd: number): string => (usd > 0 && usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)
const line = (tokens: number, usd: number) => `≈ ${tokText(tokens)} tok · ${usdText(usd)}`
const footer = (n: number) => `[… archived as #${n}: /recall ${n} <term> searches it, /recall ${n} shows more]`
/** Tokens the archive credits for an output of `len` characters (a head of 3000 and the footer stay). */
const savedFor = (len: number, n = 1) => Math.ceil((len - (3000 + 1 + footer(n).length)) / 4)
const dayKey = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const bash = ($: any, command = 'cat big') => $.tool.call({ tool: 'Bash', command })
const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...paneOf('savings'), surface })
const big = (len: number) => 'x'.repeat(len)

test('loads, registers /savings, shows no band while nothing was saved', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect(w.commands).toContain('savings')
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('/savings opens the meter pane and answers', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect((await $.command.run({ command: 'savings', args: '' })).text).toBe('Opened the savings meter.')
  expect(w.opened).toContainEqual({ id: 'savings', title: 'Savings meter' })
  // arguments are ignored
  expect((await $.command.run({ command: 'savings', args: 'week' })).text).toBe('Opened the savings meter.')
})

test('archived output is credited: the band shows tokens and dollars for the session', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const saved = savedFor(20_000)
  expect(await bandLine($, ID)).toBe(`💸 saved ≈ ${tokText(saved)} tok · ${usdText(saved * 0.000003)} this session`)
  expect(await bandLine($, ID, 'terminal')).toBe(`💸 saved ≈ ${tokText(saved)} tok · ${usdText(saved * 0.000003)} this session`)
  // a second one adds up
  w.toolResult = () => bashResult(big(60_000))
  await bash($)
  const both = saved + savedFor(60_000, 2)
  expect(await bandLine($, ID)).toBe(`💸 saved ≈ ${tokText(both)} tok · ${usdText(both * 0.000003)} this session`)
})

test('small amounts show "<$0.01", large ones k and M', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(9000))
  await bash($)
  expect(await bandLine($, ID)).toBe(`💸 saved ≈ ${tokText(savedFor(9000))} tok · <$0.01 this session`)
  w.toolResult = () => bashResult(big(300_000))
  await bash($)
  const total = savedFor(9000) + savedFor(300_000, 2)
  expect(total).toBeGreaterThan(10_000)
  expect(await bandLine($, ID)).toBe(`💸 saved ≈ ${Math.round(total / 1000)}k tok · ${usdText(total * 0.000003)} this session`)
  w.toolResult = () => bashResult(big(3_900_000))
  await bash($)
  expect(await bandLine($, ID)).toMatch(/saved ≈ \d+\.\dM tok/)
})

test('a survey hides the band', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  expect(await bandLine($, ID, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane breaks the session down by feature and states the rate', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const saved = savedFor(20_000)
  const ui = await openDetail($, ID)
  const lines = (await allText(ui)).split('\n')
  expect(lines).toContain(`This session: ${line(saved, saved * 0.000003)}`)
  expect(lines).toContain('By feature (this session)')
  expect(lines).toContain(`Output archive · ${line(saved, saved * 0.000003)}`)
  expect(lines).toContain('Estimate rate: characters ÷ 4 = tokens, at $0.000003 per input token ($3 per million).')
  await ui.unmount()
})

test('the detail pane lists a flagged duplicate-read amount apart from the saved total', SLOW, async ($, on) => {
  const w = boot(on, store({}, { 'dup-read-detector': true }))
  await begin($, w)
  w.toolResult = (e: any) =>
    e.tool === 'Read'
      ? { result: { type: 'text', file: { filePath: e.file_path, content: 'hi', numLines: 1, startLine: 1, totalLines: 1 } }, text: 'hi' }
      : bashResult(big(20_000))
  w.stat = () => ({ kind: 'file', size: 8000, mtimeMs: 5, isLink: false })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  // only flagged so far: the session total is still zero and the band is silent
  expect(await bandLine($, ID)).toBeUndefined()
  await bash($)
  const saved = savedFor(20_000)
  const ui = await openDetail($, ID)
  const lines = (await allText(ui)).split('\n')
  expect(lines).toContain(`This session: ${line(saved, saved * 0.000003)}`)
  expect(lines).toContain(`Output archive · ${line(saved, saved * 0.000003)}`)
  expect(lines).toContain(`Duplicate read detector · ${line(2000, 2000 * 0.000003)} (flagged, not yet saved)`)
  await ui.unmount()
})

test('the pane: session, today, 7 days and all time rows with bars per feature', SLOW, async ($, on) => {
  const today = dayKey(T0)
  const threeAgo = dayKey(T0 - 3 * DAY)
  const tenAgo = dayKey(T0 - 10 * DAY)
  const w = boot(
    on,
    store({
      'savings:days': {
        [today]: { tokens: 1000, usd: 0.003 },
        [threeAgo]: { tokens: 2000, usd: 0.006 },
        [tenAgo]: { tokens: 5000, usd: 0.015 },
      },
    }),
  )
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const s = savedFor(20_000)
  const ui = await pane($)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  expect(texts).toContain('Estimated savings')
  const rowValues = (label: string) => {
    const i = texts.indexOf(label)
    return i < 0 ? undefined : texts[i + 1]
  }
  expect(rowValues('This session')).toBe(line(s, s * 0.000003))
  expect(rowValues('Today')).toBe(line(1000 + s, 0.003 + s * 0.000003))
  expect(rowValues('Last 7 days')).toBe(line(3000 + s, 0.009 + s * 0.000003))
  expect(rowValues('All time')).toBe(line(8000 + s, 0.024 + s * 0.000003))
  expect(texts).toContain('By feature (this session)')
  expect(texts).toContain('Output archive')
  expect(texts).toContain('█'.repeat(20))
  expect(texts).toContain(tokText(s))
  expect(texts.some(x => /^All figures are estimates/.test(x))).toBe(true)
  await ui.unmount()
})

test('the pane on the terminal draws the same rows', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w, 'terminal')
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const ui = await pane($, 'terminal')
  const text = await allText(ui)
  expect(text).toContain('This session')
  expect(text).toContain('Output archive')
  expect(await ui.find({ key: 'savings-copy' })).toBeDefined()
  await ui.unmount()
})

test('the pane with nothing saved says so', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const ui = await pane($)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  expect(texts).toContain('Nothing saved yet this session.')
  expect(texts).toContain('This session')
  await ui.unmount()
})

test('bars are scaled to the biggest feature, the flagged one is drawn light and labelled', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = (e: any) =>
    e.tool === 'Read'
      ? { result: { type: 'text', file: { filePath: e.file_path, content: 'hi', numLines: 1, startLine: 1, totalLines: 1 } }, text: 'hi' }
      : bashResult(big(200_000))
  w.stat = () => ({ kind: 'file', size: 4000, mtimeMs: 5, isLink: false })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await bash($)
  const ui = await pane($)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  expect(texts).toContain('█'.repeat(20))
  // 1000 flagged vs ~48k saved: round(1000/48k*20) = 0, but never fewer than one block
  expect(texts).toContain('░')
  expect(texts).toContain('1.0k (flagged, not yet saved)')
  expect(texts).toContain('Duplicate read detector')
  await ui.unmount()
})

test('a finished turn writes the session to today\'s total once, without double counting', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const s = savedFor(20_000)
  await finishTurn($, 't1')
  const days = w.stored['savings:days'] as Record<string, { tokens: number; usd: number }>
  expect(days[dayKey(T0)]?.tokens).toBe(s)
  expect(Math.abs((days[dayKey(T0)]?.usd ?? 0) - s * 0.000003)).toBeLessThan(1e-9)
  // a second turn with nothing new changes nothing
  await finishTurn($, 't2')
  expect((w.stored['savings:days'] as any)[dayKey(T0)].tokens).toBe(s)
  // more savings add only the difference
  w.toolResult = () => bashResult(big(40_000))
  await bash($)
  const s2 = savedFor(40_000, 2)
  await finishTurn($, 't3')
  expect((w.stored['savings:days'] as any)[dayKey(T0)].tokens).toBe(s + s2)
  expect(w.stored['savings:mark']).toEqual({ started: w.usage.startedAt, tokens: s + s2, usd: expect.any(Number) })
  // the pane shows the stored total once, not twice
  const ui = await pane($)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  const todayRow = texts[texts.indexOf('Today') + 1]
  expect(todayRow).toBe(line(s + s2, (s + s2) * 0.000003))
  await ui.unmount()
})

test('a subagent turn does not write the totals', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 's1', reason: 'answer', agentId: 'a1' })
  expect(w.stored['savings:days']).toBeUndefined()
})

test('the copy Button puts the weekly share text on the clipboard and says so', SLOW, async ($, on) => {
  const w = boot(on, store({ 'savings:days': { [dayKey(T0 - DAY)]: { tokens: 12_345, usd: 0.037035 } } }))
  await begin($, w)
  const ui = await pane($)
  const btn = await ui.find({ key: 'savings-copy' })
  expect(btn?.props['label']).toBe('Copy share text')
  await ui.press({ key: 'savings-copy' })
  expect(w.copied.length).toBe(1)
  expect(w.copied[0].text).toBe('Toolkitty saved me ≈ $0.04 and 12k tokens this week.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(await noticesOf($, 'savings')).toEqual(['Copied the share text'])
  w.copyOk = false
  await ui.press({ key: 'savings-copy' })
  expect((await noticesOf($, 'savings'))[1]).toBe('Could not copy')
  await ui.unmount()
})

test('hebrew: pane, band and command answers', SLOW, async ($, on) => {
  const w = boot(on, store({ language: 'he' }))
  await begin($, w)
  expect((await $.command.run({ command: 'savings', args: '' })).text).toBe('מד החיסכון נפתח.')
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  const s = savedFor(20_000)
  expect(await bandLine($, ID)).toBe(`💸 נחסך ≈ ${tokText(s)} טוקנים · ${usdText(s * 0.000003)} בסשן הזה`)
  const ui = await pane($)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  expect(texts).toContain('חיסכון משוער')
  expect(texts).toContain('הסשן הזה')
  expect(texts).toContain('היום')
  expect(texts).toContain('7 הימים האחרונים')
  expect(texts).toContain('סך הכול')
  expect(texts).toContain('ארכיון פלט')
  expect((await ui.find({ key: 'savings-copy' }))?.props['label']).toBe('העתק טקסט לשיתוף')
  await ui.unmount()
})

test('off switch: no band, the command and the pane say it is off, nothing is written', SLOW, async ($, on) => {
  const w = boot(on, store({}, { [ID]: false }))
  await begin($, w)
  w.toolResult = () => bashResult(big(20_000))
  await bash($)
  expect(await bandLine($, ID)).toBeUndefined()
  expect((await $.command.run({ command: 'savings', args: '' })).text).toBe(OFF)
  const ui = await pane($)
  expect(await allText(ui)).toBe('◐\nSavings meter\nThe savings meter is off. Turn it on in the /toolkitty pane.')
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  await ui.unmount()
  await finishTurn($, 't1')
  expect(w.stored['savings:days']).toBeUndefined()
})
