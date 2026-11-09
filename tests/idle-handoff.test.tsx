import { expect, test } from 'claude-code/testing'

import { begin, boot, finishTurn, SLOW, noticesOf } from './world'

const ID = 'idle-handoff'
const ON = { enabled: { [ID]: true, 'context-aquarium': false, 'long-turn-toast': false } }
const MIN = 60_000
const idle = ($: any, args: string) => $.command.run({ command: 'idle-handoff', args })
const handoff = ($: any) => $.command.run({ command: 'handoff', args: '' })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const OPENED = 'The handoff preview is open. Nothing is compacted until you press Compact now.'
const BAD = 'Give a whole number of minutes from 1 to 1440.'
const toastFor = (minutes: number, percent: number) =>
  `Idle for ${minutes} min: the prompt cache has gone cold and the context is ${percent}% full. /handoff compacts the session cheaply.`

test('loads, registers both commands, and is off by default', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { 'context-aquarium': false } })
  await begin($, w)
  expect(w.commands).toContain('handoff')
  expect(w.commands).toContain('idle-handoff')
  expect((await idle($, '')).text).toBe(OFF)
  expect((await idle($, '30')).text).toBe(OFF)
  // /handoff belongs to the handoff feature (on by default), not to this one: it opens the preview pane, compacts nothing
  expect((await handoff($)).text).toBe(OPENED)
  expect(w.opened.filter(x => x.id === 'handoff').length).toBe(1)
  expect(w.compactCalls).toEqual([])
  // and a finished turn starts no timer
  w.usage.context = { window: 200_000, percent: 90 }
  await finishTurn($, 't1')
  await w.clock.advance(25 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
})

test('/idle-handoff shows the length and sets it with every argument form', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  expect((await idle($, '')).text).toBe('Idle handoff suggests /handoff after 20 idle minutes. Change it with /idle-handoff <minutes>.')
  expect((await idle($, '45')).text).toBe('Idle handoff set to 45 minutes.')
  expect((await idle($, '')).text).toBe('Idle handoff suggests /handoff after 45 idle minutes. Change it with /idle-handoff <minutes>.')
  expect((await idle($, '1')).text).toBe('Idle handoff set to 1 minutes.')
  expect((await idle($, ' 1440 ')).text).toBe('Idle handoff set to 1440 minutes.')
  for (const bad of ['0', '1441', 'abc', '-5', '1.5', '10 20', '5m', '٣', '+5']) {
    expect((await idle($, bad)).text).toBe(BAD)
  }
  expect((await idle($, '')).text).toMatch(/after 1440 idle minutes/)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
})

test('the length is kept in the store; a stored value out of range falls back to 20', SLOW, async ($, on) => {
  const a = boot(on, { ...ON, 'idle-handoff:minutes': 90 })
  await begin($, a)
  expect((await idle($, '')).text).toMatch(/after 90 idle/)
})

test('a stored out-of-range or fractional length is ignored', SLOW, async ($, on) => {
  const w = boot(on, { ...ON, 'idle-handoff:minutes': 5000 })
  await begin($, w)
  expect((await idle($, '')).text).toMatch(/after 20 idle/)
})

test('after the idle minutes with a large context a toast suggests /handoff; once only', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '3')
  w.usage.context = { window: 200_000, tokens: 120_000, percent: 55.4 }
  await finishTurn($, 't1')
  await w.clock.advance(2 * MIN + 59_000)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  await w.clock.advance(2000)
  expect(await noticesOf($, ID)).toEqual([toastFor(3, 55)])
  await w.clock.advance(20 * MIN)
  expect((await noticesOf($, ID)).length).toBe(1)
})

test('with the default 20 minutes', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  w.usage.context = { window: 200_000, percent: 41 }
  await finishTurn($, 't1')
  await w.clock.advance(19 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  await w.clock.advance(MIN + 1000)
  expect(await noticesOf($, ID)).toEqual([toastFor(20, 41)])
})

test('a context at or under 40% or of unknown size gets no suggestion', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '1')
  w.usage.context = { window: 200_000, percent: 40 }
  await finishTurn($, 't1')
  await w.clock.advance(MIN + 1000)
  w.usage.context = { window: 200_000 }
  await finishTurn($, 't2')
  await w.clock.advance(MIN + 1000)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  w.usage.context = { window: 200_000, percent: 40.5 }
  await finishTurn($, 't3')
  await w.clock.advance(MIN + 1000)
  expect(await noticesOf($, ID)).toEqual([toastFor(1, 41)])
})

test('a new turn from the person cancels the countdown; a subagent turn does not touch it', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '2')
  w.usage.context = { window: 200_000, percent: 80 }
  await finishTurn($, 't1')
  await w.clock.advance(MIN)
  // a subagent starting and finishing: neither cancels nor restarts
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 's1', reason: 'answer', agentId: 'a1' })
  await w.clock.advance(MIN + 1000)
  expect(await noticesOf($, ID)).toEqual([toastFor(2, 80)])
  // now the person starts a turn while the countdown runs: no second notice
  await finishTurn($, 't2')
  await w.clock.advance(MIN)
  await $.turn.start({ text: 'again', turnId: 't3' })
  await w.clock.advance(10 * MIN)
  expect(await noticesOf($, ID)).toEqual([toastFor(2, 80)])
})

test('each finished turn restarts the countdown from zero', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '3')
  w.usage.context = { window: 200_000, percent: 70 }
  await $.turn.start({ text: 'a', turnId: 't1' })
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await w.clock.advance(2 * MIN)
  // a second completion without a start in between (a retried turn) restarts it
  await $.turn.complete({ answer: 'x', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await w.clock.advance(2 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  await w.clock.advance(MIN + 1000)
  expect(await noticesOf($, ID)).toEqual([toastFor(3, 70)])
})

test('changing the length while a countdown runs restarts it with the new length; with none running it starts none', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  w.usage.context = { window: 200_000, percent: 70 }
  // no countdown yet: setting a length arms nothing
  await idle($, '2')
  await w.clock.advance(10 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  await finishTurn($, 't1')
  await w.clock.advance(MIN)
  await idle($, '4')
  await w.clock.advance(3 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  await w.clock.advance(MIN + 1000)
  expect(await noticesOf($, ID)).toEqual([toastFor(4, 70)])
})

test('a failing usage read at the idle moment raises no toast and no failure', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '1')
  await finishTurn($, 't1')
  w.usageFails = true
  await w.clock.advance(MIN + 1000)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
})

test('switching the feature off while the countdown runs silences it', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '2')
  w.usage.context = { window: 200_000, percent: 90 }
  await finishTurn($, 't1')
  const sw = await $.ui.mount({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'toolkitty',
    surface: 'desktop',
    props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  await sw.press({ key: `t-${ID}` })
  await sw.unmount()
  await w.clock.advance(3 * MIN)
  // Switching off posts the switchboard's own "off" notice; the countdown itself must stay silent.
  expect((await noticesOf($, ID)).filter(x => x !== 'Idle handoff off')).toEqual([])
  // the command is the handoff feature's: switching the idle suggestion off leaves it working
  expect((await handoff($)).text).toBe(OPENED)
})

// /handoff no longer compacts: it opens the handoff preview (handoff.tsx), and only that pane's Compact now button compacts
// (tested in the handoff's own file). Here: the command, its registration by this feature, and that nothing is compacted.
test('/handoff opens the preview pane and compacts nothing, now or later', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  const out = await handoff($)
  expect(out.text).toBe(OPENED)
  expect(w.opened.filter(x => x.id === 'handoff')).toEqual([{ id: 'handoff', title: 'Handoff', focus: true, closeOnEscape: true }])
  expect(w.toasts).toEqual([])
  await w.clock.advance(60 * MIN)
  expect(w.compactCalls).toEqual([])
  expect(w.toasts).toEqual([])
})

test('/handoff answers off when the handoff feature is off, whatever this feature is', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { ...ON.enabled, handoff: false } })
  await begin($, w)
  expect((await handoff($)).text).toBe(OFF)
  expect(w.opened.filter(x => x.id === 'handoff')).toEqual([])
})

test('hebrew: commands, toast and the handoff answer', SLOW, async ($, on) => {
  const w = boot(on, { ...ON, language: 'he' })
  await begin($, w)
  expect((await idle($, '')).text).toBe('העברה אחרי חוסר פעילות מציעה /handoff אחרי 20 דקות. לשינוי: /idle-handoff <דקות>.')
  expect((await idle($, '2')).text).toBe('ההעברה אחרי חוסר פעילות נקבעה ל-2 דקות.')
  expect((await idle($, 'x')).text).toBe('ציין מספר שלם של דקות בין 1 ל-1440.')
  expect((await handoff($)).text).toBe('התצוגה המקדימה להעברה נפתחה. שום דבר לא נדחס עד שתלחץ על דחוס עכשיו.')
  await w.clock.advance(100)
  expect(w.compactCalls).toEqual([])
  w.usage.context = { window: 200_000, percent: 60 }
  await finishTurn($, 't1')
  await w.clock.advance(2 * MIN + 1000)
  expect((await noticesOf($, ID)).slice(-1)).toEqual(['לא פעיל 2 דקות: מטמון הפרומפט התקרר וההקשר מלא ב-60%. /handoff דוחס את הסשן בזול.'])
})

test('the chosen length is written to the store, and only valid ones', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await idle($, '33')
  expect(w.stored['idle-handoff:minutes']).toBe(33)
  await idle($, '0')
  await idle($, 'x')
  expect(w.stored['idle-handoff:minutes']).toBe(33)
})
