import { expect, test } from 'claude-code/testing'

import { allText, bandLine, BAND, begin, boot, DAY, DETAIL, finishTurn, HOUR, iso, measure, openBand, openDetail, SLOW, T0 } from './world'

const ID = 'plan-pace'
const five = (percentUsed: number, resetsInMs: number) => ({ kind: 'five_hour', percentUsed, resetsAt: iso(T0 + resetsInMs) })
const week = (percentUsed: number, resetsInMs: number) => ({ kind: 'seven_day', percentUsed, resetsAt: iso(T0 + resetsInMs) })

/** The coloured runs of the band line: [text, color] for every Text that has a colour. */
async function colours($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  const ui = await $.ui.mount({ ...BAND, surface })
  await openBand(ui)
  const out = (await ui.findAll({ type: 'Text' })).filter((x: any) => x.props['color'] !== undefined && !String(x.text).startsWith('🔔')).map((x: any) => [x.text, x.props['color']])
  await ui.unmount()
  return out
}

test('loads and shows no band before any limit is reported', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('a measure with both windows draws the band: percentages, the 5h reset only', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  // 5h: 2h left (60% elapsed), 30% used; 7d: half way, 40% used
  await measure($, w, [five(30, 2 * HOUR), week(40, 3.5 * DAY)])
  expect(await bandLine($, ID)).toBe('5h 30% · resets 2:00 · 7d 40%')
  expect(await bandLine($, ID, 'terminal')).toBe('5h 30% · resets 2:00 · 7d 40%')
  expect(w.toasts).toEqual([])
})

test('the weekly window alone shows its reset time, with days', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [week(10, 3 * DAY + 5 * HOUR + 7 * 60_000)])
  expect(await bandLine($, ID)).toBe('7d 10% · resets 3d 5:07')
})

test('rounding and the spend limit', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(29.6, 2 * HOUR), { kind: 'spend_limit', percentUsed: 104.4 }, { kind: 'other_window', percentUsed: 5 }])
  // the unknown window kind is not drawn; the spend window has no reset
  expect(await bandLine($, ID)).toBe('5h 30% · resets 2:00 · spend 104%')
})

test('running out before the reset is an error colour, with the note', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  // 60% of the 5h window elapsed, 75% used: projects to 125%
  await measure($, w, [five(75, 2 * HOUR)])
  expect(await bandLine($, ID)).toBe('5h 75% · runs out before reset · resets 2:00')
  const c = await colours($)
  expect(c).toContainEqual(['5h 75% · runs out before reset', 'error'])
})

test('early in the window a quick start is "ahead of pace" in the warning colour', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  // 5% elapsed (4h45m left), 25% used: too early to project, but far ahead
  await measure($, w, [five(25, 4.75 * HOUR)])
  expect(await bandLine($, ID)).toBe('5h 25% · ahead of pace · resets 4:45')
  expect(await colours($)).toContainEqual(['5h 25% · ahead of pace', 'warning'])
  // a small use early is not flagged
  await measure($, w, [five(15, 4.75 * HOUR)])
  expect(await bandLine($, ID)).toBe('5h 15% · resets 4:45')
  expect(await colours($)).toEqual([])
})

test('a steady pace has no note and no colour', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(55, 2 * HOUR)])
  expect(await bandLine($, ID)).toBe('5h 55% · resets 2:00')
  expect(await colours($)).toEqual([])
})

test('a reset time that cannot be read leaves the percentage alone', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [{ kind: 'five_hour', percentUsed: 30, resetsAt: 'not-a-date' }, { kind: 'seven_day', percentUsed: 12 }])
  expect(await bandLine($, ID)).toBe('5h 30% · 7d 12%')
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toMatch(/5h: 30% used/)
  expect(text).toMatch(/7d: 12% used/)
  expect(text).not.toMatch(/resets in/)
  await ui.unmount()
})

test('the band follows the clock between measures', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR)])
  expect(await bandLine($, ID)).toBe('5h 30% · resets 2:00')
  await w.clock.advance(30 * 60_000)
  expect(await bandLine($, ID)).toBe('5h 30% · resets 1:30')
  // 30 min later the window is 70% elapsed with 30% used: still fine
  await measure($, w, [five(30, 10 * 60_000)])
  await w.clock.advance(11 * 60_000)
  // past the reset the time is clamped at 0
  expect(await bandLine($, ID)).toBe('5h 30% · resets 0:00')
})

test('a finished turn reads the usage again; a subagent turn does not', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  w.usage.rateLimits = [five(20, 3 * HOUR)]
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBe('5h 20% · resets 3:00')
  w.usage.rateLimits = [five(80, 3 * HOUR)]
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 's1', reason: 'answer', agentId: 'a1' })
  expect(await bandLine($, ID)).toBe('5h 20% · resets 3:00')
  await finishTurn($, 't2')
  expect(await bandLine($, ID)).toContain('5h 80%')
})

test('when the usage disappears (API key) the band goes away', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR)])
  expect(await bandLine($, ID)).toBeDefined()
  await measure($, w, [])
  expect(await bandLine($, ID)).toBeUndefined()
})

test('a survey above the prompt hides the band', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR)])
  expect(await bandLine($, ID, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane shows the pace maths for each window', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR), week(40, 3.5 * DAY), { kind: 'spend_limit', percentUsed: 50 }])
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toMatch(/5h: 30% used · 60% of the window elapsed · projected 50% at reset/)
  expect(text).toMatch(/5h resets in 2:00 \(at .+\)/)
  expect(text).toMatch(/7d: 40% used · 50% of the window elapsed · projected 80% at reset/)
  expect(text).toMatch(/7d resets in 3d 12:00 \(at .+\)/)
  expect(text).toMatch(/spend: 50% used/)
  expect(text).toMatch(/"Ahead of pace" means/)
  // the pane's own chrome: title, band line again, the switch and close buttons, the commands note
  expect(text).toMatch(/Plan pace/)
  expect(text).toMatch(/5h 30% · resets 2:00 · 7d 40%/)
  expect(await ui.find({ key: 'detail-toggle' })).toBeDefined()
  expect(await ui.find({ key: 'detail-close' })).toBeDefined()
  await ui.unmount()
})

test('the detail pane says it is too early to project in the first tenth of a window', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(25, 4.75 * HOUR)])
  const ui = await openDetail($, ID)
  expect(await allText(ui)).toMatch(/5h: 25% used · 5% of the window elapsed · too early to project/)
  await ui.unmount()
})

test('the detail pane after the usage vanished says there is no data', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR)])
  const ui = await openDetail($, ID)
  await measure($, w, [])
  await ui.redraw()
  expect(await allText(ui)).toMatch(/No plan usage data yet\./)
  await ui.unmount()
})

test('detail buttons: close dismisses, the switch turns the feature off and on', SLOW, async ($, on) => {
  const w = boot(on)
  await begin($, w)
  await measure($, w, [five(30, 2 * HOUR)])
  const ui = await openDetail($, ID)
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn off')
  await ui.press({ key: 'detail-toggle' })
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  expect(await bandLine($, ID)).toBeUndefined()
  await ui.press({ key: 'detail-toggle' })
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn off')
  expect(await bandLine($, ID)).toBe('5h 30% · resets 2:00')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('hebrew labels', SLOW, async ($, on) => {
  const w = boot(on, { language: 'he' })
  await begin($, w)
  await measure($, w, [five(75, 2 * HOUR), week(40, 3.5 * DAY)])
  const line = await bandLine($, ID)
  expect(line).toContain('5 ש׳ 75%')
  expect(line).toContain('7 י׳ 40%')
  expect(line).toContain('איפוס בעוד 2:00')
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toContain('5 ש׳: 75% נוצלו · 60% מהחלון חלפו · צפי של 125% באיפוס')
  expect(text).toContain('5 ש׳ מתאפס בעוד 2:00')
  expect(text).toContain('"מהיר מהקצב" אומר')
  expect(text).toContain('קצב התוכנית')
  expect(line).toContain('ייגמר לפני האיפוס')
  await ui.unmount()
})

test('off switch: nothing is drawn and a measure is ignored', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { [ID]: false } })
  await begin($, w)
  await measure($, w, [five(90, 1 * HOUR)])
  expect(await bandLine($, ID)).toBeUndefined()
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
  void DETAIL
})
