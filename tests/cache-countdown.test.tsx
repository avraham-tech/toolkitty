import { expect, test } from 'claude-code/testing'

import { allText, begin, bandLine, boot, DETAIL, finishTurn, openDetail, SLOW, noticesOf } from './world'

const ID = 'cache-countdown'
const submit = ($: any, text: string, extra: Record<string, unknown> = {}) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...extra })
const cmd = ($: any, args: string) => $.command.run({ command: 'cache-ttl', args })

test('loads, registers /cache-ttl, draws no band before a turn finished', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  expect(w.commands).toContain('cache-ttl')
  expect(w.toasts).toEqual([])
  expect(await bandLine($, ID)).toBeUndefined()
})

test('/cache-ttl with every argument form', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  expect((await cmd($, '')).text).toMatch(/Prompt cache lifetime: 5m/)
  expect((await cmd($, '1h')).text).toBe('Prompt cache lifetime set to 1h.')
  expect((await cmd($, '')).text).toMatch(/Prompt cache lifetime: 1h/)
  expect((await cmd($, '  5M ')).text).toBe('Prompt cache lifetime set to 5m.')
  expect((await cmd($, '1H')).text).toBe('Prompt cache lifetime set to 1h.')
  for (const bad of ['2h', '10', 'abc', '5m 1h', '0']) {
    expect((await cmd($, bad)).text).toBe('Unknown value. Use /cache-ttl 5m or /cache-ttl 1h.')
  }
  // a bad value changed nothing
  expect((await cmd($, '')).text).toMatch(/lifetime: 1h/)
  expect(w.toasts).toEqual([])
})

test('the lifetime is kept in the store and read back at the next session start', SLOW, async ($, on) => {
  const w = boot(on, { 'cache-countdown:ttl': 3_600_000 })
  await begin($, w)
  expect((await cmd($, '')).text).toMatch(/lifetime: 1h/)
})

test('a stored value that is neither 5m nor 1h falls back to the nearest of the two', SLOW, async ($, on) => {
  const w = boot(on, { 'cache-countdown:ttl': 123 })
  await begin($, w)
  expect((await cmd($, '')).text).toMatch(/lifetime: 5m/)
})

test('the band counts down while warm, then says cold, on both surfaces', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBe('cache ⏱ 5:00')
  await w.clock.advance(60_000)
  expect(await bandLine($, ID)).toBe('cache ⏱ 4:00')
  expect(await bandLine($, ID, 'terminal')).toBe('cache ⏱ 4:00')
  await w.clock.advance(239_000)
  expect(await bandLine($, ID)).toBe('cache ⏱ 0:01')
  await w.clock.advance(2_000)
  expect(await bandLine($, ID)).toBe('cache cold')
  expect(await bandLine($, ID, 'terminal')).toBe('cache cold')
})

test('the ticker stops itself once the cache is cold and a new turn restarts it', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  await w.clock.advance(5 * 60_000 + 3_000)
  expect(await bandLine($, ID)).toBe('cache cold')
  // far later nothing ticks, still cold, and no handler threw
  await w.clock.advance(30 * 60_000)
  expect(await bandLine($, ID)).toBe('cache cold')
  await finishTurn($, 't2')
  expect(await bandLine($, ID)).toBe('cache ⏱ 5:00')
  await w.clock.advance(10_000)
  expect(await bandLine($, ID)).toBe('cache ⏱ 4:50')
  expect(w.toasts).toEqual([])
})

test('a subagent turn does not restart the countdown', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  await w.clock.advance(120_000)
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ ...{ answer: 'x', durationMs: 5, isAborted: false, turnId: 's1', reason: 'answer' }, agentId: 'a1' })
  expect(await bandLine($, ID)).toBe('cache ⏱ 3:00')
})

test('/cache-ttl 1h on a cache that went cold under 5m makes it warm again; the band follows', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  await w.clock.advance(6 * 60_000)
  expect(await bandLine($, ID)).toBe('cache cold')
  await cmd($, '1h')
  expect(await bandLine($, ID)).toBe('cache ⏱ 54:00')
  await w.clock.advance(60_000)
  expect(await bandLine($, ID)).toBe('cache ⏱ 53:00')
})

test('a large context sent into a cold cache warns once per send; small or warm sends pass silently', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  w.usage.context = { window: 200_000, tokens: 120_000, percent: 60 }
  // no turn yet: nothing to be cold
  const first = await submit($, 'hello')
  expect(first).toBeDefined()
  expect(await noticesOf($, ID)).toEqual([])
  await finishTurn($, 't1')
  // still warm
  await w.clock.advance(60_000)
  await submit($, 'again')
  expect(await noticesOf($, ID)).toEqual([])
  // cold now
  await w.clock.advance(5 * 60_000)
  await submit($, 'cold send')
  expect(await noticesOf($, ID)).toEqual([
    'The prompt cache is cold: this send re-reads the whole context (60% of the window, 120,000 tokens).',
  ])
  // a slash command and a meta prompt are not sends of the context
  await submit($, '/help', { command: { name: 'help', args: '' } })
  await submit($, 'meta', { isMeta: true })
  expect((await noticesOf($, ID)).length).toBe(1)
  // context at or under 30% is cheap
  w.usage.context = { window: 200_000, tokens: 60_000, percent: 30 }
  await submit($, 'small')
  expect((await noticesOf($, ID)).length).toBe(1)
  w.usage.context = { window: 200_000, tokens: 62_000, percent: 31 }
  await submit($, 'bigger')
  expect((await noticesOf($, ID)).length).toBe(2)
  // without a token count the percent alone is told
  w.usage.context = { window: 200_000, percent: 45.4 }
  await submit($, 'no tokens')
  expect((await noticesOf($, ID))[2]).toBe('The prompt cache is cold: this send re-reads the whole context (45% of the window).')
  // an unknown percent is never a warning
  w.usage.context = { window: 200_000 }
  await submit($, 'unknown')
  expect((await noticesOf($, ID)).length).toBe(3)
})

test('a failing usage read never blocks the send', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  await w.clock.advance(6 * 60_000)
  w.usageFails = true
  const out = await submit($, 'go')
  expect(out).toBeDefined()
  expect(await noticesOf($, ID)).toEqual([])
})

test('the detail pane lists the warnings and the lifetime (english)', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  w.usage.context = { window: 200_000, tokens: 100_000, percent: 50 }
  await finishTurn($, 't1')
  let ui = await openDetail($, ID)
  let text = await allText(ui)
  expect(text).toMatch(/Cache is warm for another 5:00\./)
  expect(text).toMatch(/Cold sends warned about: 0/)
  expect(text).toMatch(/Prompt cache lifetime: 5m/)
  await ui.unmount()

  await w.clock.advance(7 * 60_000)
  await submit($, 'cold send')
  ui = await openDetail($, ID)
  text = await allText(ui)
  expect(text).toMatch(/Cache went cold 2:00 ago\./)
  expect(text).toMatch(/Cold sends warned about: 1/)
  expect(text).toMatch(/0:00 ago · context 50% · 100,000 tokens/)
  await ui.unmount()
})

test('the detail pane with no feature chosen has nothing to show', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  expect(await allText(ui)).toBe('Nothing more to show yet.')
  await ui.unmount()
})

test('hebrew: command answers and band in hebrew', { timeoutMs: 60_000 }, async ($, on) => {
  const w = boot(on, { language: 'he' })
  await begin($, w)
  expect((await cmd($, '')).text).toBe('משך חיי מטמון הפרומפט: 5m. לשינוי: /cache-ttl 5m או /cache-ttl 1h.')
  expect((await cmd($, '1h')).text).toBe('משך חיי מטמון הפרומפט נקבע ל-1h.')
  expect((await cmd($, 'zz')).text).toBe('ערך לא מוכר. השתמש ב-/cache-ttl 5m או /cache-ttl 1h.')
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBe('מטמון ⏱ 1:00:00')
  // in steps: every feature with a one-second timer ticks along, and one advance may resolve only so many waits
  for (let i = 0; i < 4; i++) await w.clock.advance(i === 3 ? 901_000 : 900_000)
  expect(await bandLine($, ID)).toBe('המטמון קר')
  w.usage.context = { window: 200_000, tokens: 90_000, percent: 45 }
  await submit($, 'x')
  expect((await noticesOf($, ID))[0]).toBe('מטמון הפרומפט קר: השליחה הזו קוראת מחדש את כל ההקשר (45% מהחלון, 90,000 טוקנים).')
  const ui = await openDetail($, ID)
  expect(await allText(ui)).toMatch(/שליחות במטמון קר שהוזהר עליהן: 1/)
  await ui.unmount()
})

test('off switch: no band, no warning, no ticker, the command says it is off', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { [ID]: false } })
  await begin($, w)
  expect((await cmd($, '1h')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect((await cmd($, '')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  w.usage.context = { window: 200_000, tokens: 100_000, percent: 80 }
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBeUndefined()
  await w.clock.advance(10 * 60_000)
  const out = await submit($, 'go')
  expect(out).toBeDefined()
  expect(w.toasts).toEqual([])
})

test('switching the feature off while the ticker runs stops the ticker and the band', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBe('cache ⏱ 5:00')
  // the switchboard's detail pane toggle writes the enabled map
  const ui = await openDetail($, ID)
  await ui.press({ key: 'detail-toggle' })
  await ui.unmount()
  await w.clock.advance(5_000)
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('the chosen lifetime is written to the store, and only valid ones', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await cmd($, '1h')
  expect(w.stored['cache-countdown:ttl']).toBe(3_600_000)
  await cmd($, 'bogus')
  expect(w.stored['cache-countdown:ttl']).toBe(3_600_000)
  await cmd($, '5m')
  expect(w.stored['cache-countdown:ttl']).toBe(300_000)
})
