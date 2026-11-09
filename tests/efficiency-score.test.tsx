import { expect, test } from 'claude-code/testing'
import { BAND, DAY, NOON, PANE, dayKey, joined, noticeTexts, start, texts, turnDone, turnStart } from './harness'
import { pointsOf, put, putEvidence, setHealth, setup, slotValue } from './zkit'

const ID = 'efficiency-score'
const ON = [ID]
const LABELS = ['Duplicate work', 'Repeated failures', 'Context management', 'Verification', 'Budget awareness']
const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('efficiency'), surface })
const READ = (n: number) => ({ tool: 'Read', file_path: `C:/proj/f${n}.ts` })
const EDIT = { tool: 'Edit', file_path: 'C:/proj/a.ts', old_string: 'a', new_string: 'b' }

/** One finished turn with `calls` Read calls. */
async function turn($: any, calls = 5): Promise<void> {
  await turnStart($)
  for (let i = 0; i < calls; i++) await $.tool.call(READ(i))
  await turnDone($)
}

async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}): Promise<string | undefined> {
  const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}`, props: { ...BAND(surface).props, ...props } })
  const c = await b.find({ key: 'chip-efficiency-score' })
  await b.unmount()
  return c === undefined ? undefined : String(c.text).replace(/^◔\s*/, '').trim()
}

test('it is opt-in: off by default, the command says so and nothing is scored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, [])
  await start($)
  expect(w.cmds).toContain('efficiency')
  expect((await $.command.run({ command: 'efficiency', args: '' })).text).toBe('Efficiency score is off. Turn it on in the /toolkitty pane.')
  expect(w.opened.map(o => o.id)).not.toContain('efficiency')
  await turn($)
  expect(w.store.get('efficiency-score:days')).toBeUndefined()
  expect(await chipOf($)).toBeUndefined()
  const ui = await pane($)
  expect(await joined(ui)).toContain('Efficiency score is off.')
  await ui.unmount()
})

test('turned on: /efficiency opens the pane, which is empty until a turn ends', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  expect((await $.command.run({ command: 'efficiency', args: '' })).text).toBe('Opened the efficiency score.')
  expect(w.opened.map(o => o.id)).toContain('efficiency')
  const ui = await pane($)
  const text = await joined(ui)
  expect(text).toContain('No score yet.')
  expect(text).toContain('It appears after your first completed turn.')
  expect(text).toContain('Based on your own history only. There is no global ranking.')
  await ui.unmount()
})

test('a clean session scores 100: five bars of 20, each with its printed formula, title Power User', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turn($)
  const ui = await pane($)
  for (const label of LABELS) expect(await pointsOf(ui, label)).toBe(20)
  const text = await joined(ui)
  expect(text).toContain('100/100')
  expect(text).toContain('Formula: 20 × (1 − repeats per 100 calls ÷ 10).')
  expect(text).toContain('Formula: 20 − 2 per failed tool call − 5 per loop, never below 0.')
  expect(text).toContain('Formula: average context health ÷ 80 × 20.')
  expect(text).toContain('Formula: 20 × share of file-changing turns with a passing test, build, lint or typecheck.')
  expect(text).toContain('Formula: 20 while the budget stayed at or under 90%')
  expect(text).toContain('Based on your own history only. There is no global ranking.')
  expect(text).toContain('Token use and task size are never scored')
  expect(text).toContain('Title: Power User')
  expect(text).toContain('█'.repeat(20))
  await ui.unmount()
})

test('token use never moves the score', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turnStart($)
  await turnDone($, 600_000, { usage: { input_tokens: 9_000_000, output_tokens: 900_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } })
  const ui = await pane($)
  expect(await joined(ui)).toContain('100/100')
  await ui.unmount()
})

// ---- duplicate work: 20 x (1 - repeats per 100 calls / 10), at least 20 calls counted ----
for (const [waste, calls, points] of [
  [0, 5, 20],
  [1, 5, 10],
  [2, 5, 0],
  [3, 5, 0],
  [4, 50, 4],
  [1, 40, 15],
] as const) {
  test(`duplicate work: ${waste} repeats in ${calls} calls gives ${points}/20`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON)
    await start($)
    if (waste > 0) put('seed:waste', 'waste', { value: waste })
    await turn($, calls)
    const ui = await pane($)
    expect(await pointsOf(ui, 'Duplicate work')).toBe(points)
    const rate = ((waste / Math.max(calls, 20)) * 100).toFixed(1)
    expect(await joined(ui)).toContain(`${waste} repeats in ${calls} calls (${rate} per 100)`)
    await ui.unmount()
  })
}

// ---- repeated failures: 20 - 2 per failed call - 5 per loop ----
test('failures: three failed calls give 14, a loop on top gives 9, never below 0', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  put('seed:failure', 'failure', { value: 3 })
  await turn($)
  let ui = await pane($)
  expect(await pointsOf(ui, 'Repeated failures')).toBe(14)
  expect(await joined(ui)).toContain('3 failed calls, 0 loops')
  await ui.unmount()

  put('seed:failure', 'failure', { value: 0 })
  put('seed:loop', 'loop')
  await turn($)
  ui = await pane($)
  expect(await joined(ui)).toContain('3 failed calls, 1 loops')
  expect(await pointsOf(ui, 'Repeated failures')).toBe(9)

  put('seed:failure', 'failure', { value: 9 })
  await turn($)
  await ui.unmount()
  ui = await pane($)
  expect(await pointsOf(ui, 'Repeated failures')).toBe(0)
  await ui.unmount()
})

test('failures: a signal from an earlier turn is not counted again', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  put('seed:failure', 'failure', { value: 4 }, 5000)
  put('seed:loop', 'loop', {}, 5000)
  await turn($)
  const ui = await pane($)
  expect(await pointsOf(ui, 'Repeated failures')).toBe(20)
  await ui.unmount()
})

// ---- context management: average health / 80 x 20 ----
for (const [health, points] of [
  [100, 20],
  [80, 20],
  [40, 10],
  [20, 5],
  [1, 0],
] as const) {
  test(`context management: health ${health} gives ${points}/20`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON)
    await start($)
    setHealth(health)
    await turn($)
    const ui = await pane($)
    expect(await pointsOf(ui, 'Context management')).toBe(points)
    expect(await joined(ui)).toContain(`average health ${health}`)
    await ui.unmount()
  })
}

test('context management: no reading yet is full marks, and the readings are averaged', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turn($)
  let ui = await pane($)
  expect(await pointsOf(ui, 'Context management')).toBe(20)
  expect(await joined(ui)).toContain('no health reading yet, full marks')
  await ui.unmount()

  setHealth(80)
  await turn($)
  setHealth(0)
  await turn($)
  ui = await pane($)
  expect(await joined(ui)).toContain('average health')
  await ui.unmount()
})

// ---- verification: 20 x share of file-changing turns with an ok test/build/lint/typecheck ----
test('verification: an edit with no evidence scores 0, then one verified of two scores 10', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turnStart($)
  await $.tool.call(EDIT)
  await turnDone($)
  let ui = await pane($)
  expect(await pointsOf(ui, 'Verification')).toBe(0)
  expect(await joined(ui)).toContain('0 of 1 file-changing turns verified')
  await ui.unmount()

  await turnStart($)
  await $.tool.call(EDIT)
  putEvidence('test', true, NOON)
  await turnDone($)
  ui = await pane($)
  expect(await pointsOf(ui, 'Verification')).toBe(10)
  expect(await joined(ui)).toContain('1 of 2 file-changing turns verified')
  await ui.unmount()
})

test('verification: a failed test, a diff or a git record is not verification; build, lint and typecheck are', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turnStart($)
  await $.tool.call(EDIT)
  putEvidence('test', false)
  putEvidence('diff', true)
  putEvidence('git', true)
  await turnDone($)
  let ui = await pane($)
  expect(await pointsOf(ui, 'Verification')).toBe(0)
  await ui.unmount()

  for (const kind of ['build', 'lint', 'typecheck']) {
    await turnStart($)
    await $.tool.call(EDIT)
    putEvidence(kind, true)
    await turnDone($)
  }
  ui = await pane($)
  expect(await joined(ui)).toContain('3 of 4 file-changing turns verified')
  expect(await pointsOf(ui, 'Verification')).toBe(15)
  await ui.unmount()
})

test('verification: evidence from an earlier turn does not verify this one; failed edits and edit-free turns are not counted', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  putEvidence('test', true, NOON - 5000)
  await turnStart($)
  await $.tool.call(EDIT)
  await turnDone($)
  let ui = await pane($)
  expect(await pointsOf(ui, 'Verification')).toBe(0)
  await ui.unmount()

  w.toolResult = { result: 'boom', isError: true }
  await turnStart($)
  await $.tool.call(EDIT)
  await turnDone($)
  ui = await pane($)
  expect(await joined(ui)).toContain('0 of 1 file-changing turns verified')
  await ui.unmount()

  w.toolResult = { result: {} }
  await turn($)
  ui = await pane($)
  expect(await joined(ui)).toContain('0 of 1 file-changing turns verified')
  await ui.unmount()
})

test('verification: no file-changing turns is full marks', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turn($)
  const ui = await pane($)
  expect(await pointsOf(ui, 'Verification')).toBe(20)
  expect(await joined(ui)).toContain('no file-changing turns, full marks')
  await ui.unmount()
})

// ---- budget awareness ----
for (const [kind, id, value, points] of [
  ['budget', 'seed:budget', 60, 20],
  ['budget', 'seed:budget', 90, 20],
  ['budget', 'seed:budget', 95, 10],
  ['budget', 'seed:budget', 100, 0],
  ['quota', 'seed:7d', 95, 0],
  ['quota', 'seed:7d', 96, 0],
  ['quota', 'seed:7d', 94, 12],
  ['quota', 'seed:5h', 99, 20],
] as const) {
  test(`budget awareness: ${kind} ${id} at ${value}% gives ${points}/20`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON)
    await start($)
    put(id, kind, { value })
    await turn($)
    const ui = await pane($)
    expect(await pointsOf(ui, 'Budget awareness')).toBe(points)
    await ui.unmount()
  })
}

test('budget awareness: no reading is full marks', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turn($)
  const ui = await pane($)
  expect(await pointsOf(ui, 'Budget awareness')).toBe(20)
  expect(await joined(ui)).toContain('no budget reading, full marks')
  await ui.unmount()
})

test('the five dimensions add up: 10 + 14 + 10 + 0 + 10 = 44, title Explorer', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  put('seed:waste', 'waste', { value: 1 })
  put('seed:failure', 'failure', { value: 3 })
  put('seed:budget', 'budget', { value: 95 })
  setHealth(40)
  await turnStart($)
  for (let i = 0; i < 5; i++) await $.tool.call(READ(i))
  await $.tool.call(EDIT)
  await turnDone($)
  // 6 calls count as 20: 1 repeat per 20 = 5 per 100 -> 10
  const ui = await pane($)
  expect(await pointsOf(ui, 'Duplicate work')).toBe(10)
  expect(await pointsOf(ui, 'Repeated failures')).toBe(14)
  expect(await pointsOf(ui, 'Context management')).toBe(10)
  expect(await pointsOf(ui, 'Verification')).toBe(0)
  expect(await pointsOf(ui, 'Budget awareness')).toBe(10)
  const text = await joined(ui)
  expect(text).toContain('44/100')
  expect(text).toContain('Title: Explorer')
  await ui.unmount()
})

// ---- days, weeks, labels, titles ----
test('the day record: this session overwrites its own score, one entry per session, stored under efficiency-score:days', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await turn($)
  const key = dayKey(NOON)
  expect(w.store.get('efficiency-score:days')).toEqual({ [key]: { [String(NOON)]: 100 } })
  put('seed:failure', 'failure', { value: 2 })
  await turn($)
  expect(w.store.get('efficiency-score:days')).toEqual({ [key]: { [String(NOON)]: 96 } })
  expect(slotValue('efficiency-score').days).toEqual({ [key]: { [String(NOON)]: 96 } })
})

test('a sub-agent turn is not a turn of the session', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await turnStart($, { agentId: 'sub-1' })
  await turnDone($, 1000, { agentId: 'sub-1' })
  expect(w.store.get('efficiency-score:days')).toBeUndefined()
  expect(slotValue('efficiency-score').turns).toBe(0)
})

test('old days (over 4 weeks) are dropped from the store', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON, { store: { 'efficiency-score:days': { [dayKey(NOON - 40 * DAY)]: { x: 10 }, [dayKey(NOON - 3 * DAY)]: { y: 90 } } } })
  await start($)
  await turn($)
  const days = w.store.get('efficiency-score:days') as Record<string, unknown>
  expect(Object.keys(days).sort()).toEqual([dayKey(NOON - 3 * DAY), dayKey(NOON)].sort())
})

/** One session on each of several days: this week (1-4 days back) and last week (8+ days back). */
const weeks = (thisWeek: number[], lastWeek: number[]): Record<string, Record<string, number>> => {
  const out: Record<string, Record<string, number>> = {}
  thisWeek.forEach((s, i) => (out[dayKey(NOON - (i + 1) * DAY)] = { [`t${i}`]: s }))
  lastWeek.forEach((s, i) => (out[dayKey(NOON - (8 + i) * DAY)] = { [`l${i}`]: s }))
  return out
}

for (const [thisWeek, lastWeek, label] of [
  [[90], [80], 'Improving'],
  [[85], [80], 'Improving'],
  [[84], [80], 'Steady'],
  [[80], [80], 'Steady'],
  [[76], [80], 'Steady'],
  [[75], [80], 'Slipping'],
  [[60], [80], 'Slipping'],
  [[70], [], 'Steady'],
] as const) {
  test(`week over week: this ${thisWeek[0]} vs last ${lastWeek[0] ?? 'none'} is ${label}`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON, { store: { 'efficiency-score:days': weeks([...thisWeek], [...lastWeek]) } })
    await start($)
    const ui = await pane($)
    const text = await joined(ui)
    expect(text).toContain(`This week ${thisWeek[0]} · last week ${lastWeek[0] ?? '–'}`)
    expect(await texts(ui)).toContain(label)
    expect(text).toContain('Compared with your own last week, by 5 points or more.')
    await ui.unmount()
  })
}

test('week averages every session of the week; last week is 7-13 days back, older days do not count', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON, { store: { 'efficiency-score:days': { ...weeks([100, 80], [60, 40]), [dayKey(NOON - 14 * DAY)]: { old: 0 } } } })
  await start($)
  const ui = await pane($)
  expect(await joined(ui)).toContain('This week 90 · last week 50')
  await ui.unmount()
})

for (const [score, title] of [
  [100, 'Power User'],
  [85, 'Power User'],
  [84, 'Craftsperson'],
  [70, 'Craftsperson'],
  [69, 'Explorer'],
  [10, 'Explorer'],
] as const) {
  test(`title: a week of ${score} is ${title}`, { timeoutMs: 30_000 }, async ($, on) => {
    setup(on, ON, { store: { 'efficiency-score:days': weeks([score], []) } })
    await start($)
    const ui = await pane($)
    expect(await joined(ui)).toContain(`Title: ${title}`)
    await ui.unmount()
  })
}

test('the current session counts in its own week', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON, { store: { 'efficiency-score:days': weeks([80], [80]) } })
  await start($)
  await turn($)
  const ui = await pane($)
  expect(await joined(ui)).toContain('This week 90 · last week 80')
  expect(await texts(ui)).toContain('Improving')
  await ui.unmount()
})

// ---- the chip ----
test('chip: "⚡ n" on the first turn of a session only, gone when the second turn starts', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON, { store: { 'efficiency-score:days': weeks([87], []) } })
  await start($)
  expect(await chipOf($)).toBeUndefined()
  await turnStart($)
  expect(await chipOf($)).toBe('⚡ 87')
  expect(await chipOf($, 'terminal')).toBe('⚡ 87')
  await turnDone($)
  expect(await chipOf($)).toMatch(/^⚡ \d+$/)
  await turnStart($)
  expect(await chipOf($)).toBeUndefined()
  await turnDone($)
  await turnStart($)
  expect(await chipOf($)).toBeUndefined()
})

test('chip: without history it shows the session score; a survey hides it', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turnStart($)
  expect(await chipOf($)).toBe('⚡ 100')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('chip: pressing it opens the detail pane with the five bars and their formulas', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  put('seed:waste', 'waste', { value: 1 })
  await turnStart($)
  await $.tool.call(READ(1))
  const b = await $.ui.mount({ ...BAND('desktop'), requestId: 'band-detail' })
  await b.press({ key: 'chip-efficiency-score' })
  await b.unmount()
  expect(w.opened.map(o => o.id)).toContain('toolkitty-detail')
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  const text = await joined(d)
  for (const label of LABELS) expect(text).toContain(label)
  expect(text).toContain('Formula: 20 × (1 − repeats per 100 calls ÷ 10).')
  await d.unmount()
})

// ---- copy ----
test('Copy puts the score, the five lines and the week on the clipboard', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON, { store: { 'efficiency-score:days': weeks([70], [90]) } })
  await start($)
  put('seed:waste', 'waste', { value: 1 })
  await turn($)
  const ui = await pane($)
  await ui.press({ key: 'efficiency-copy' })
  const text = w.copies[0]?.text ?? ''
  expect(text).toContain('My efficiency score (from my own history): ')
  expect(text).toContain('Duplicate work: 10/20 (1 repeats in 5 calls (5.0 per 100))')
  expect(text).toContain('Budget awareness: 20/20')
  expect(text).toContain('Slipping')
  expect(await noticeTexts($)).toContain('Efficiency score copied')
  await ui.unmount()
})

test('Copy: a failed copy says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await turn($)
  w.copyOk = false
  const ui = await pane($)
  await ui.press({ key: 'efficiency-copy' })
  expect(await noticeTexts($)).toContain('Could not copy')
  await ui.unmount()
})

test('terminal: the pane draws the same bars with Text and has the Copy button', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON)
  await start($)
  await turn($)
  const ui = await pane($, 'terminal')
  expect(await pointsOf(ui, 'Verification')).toBe(20)
  expect(await ui.find({ type: 'Button', key: 'efficiency-copy' })).toBeDefined()
  await ui.unmount()
})

// ---- Hebrew and the off switch ----
test('Hebrew: the command, the pane and the labels are localized', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, ON, { store: { language: 'he', 'efficiency-score:days': weeks([90], [70]) } })
  await start($)
  expect((await $.command.run({ command: 'efficiency', args: '' })).text).toBe('ציון היעילות נפתח.')
  await turn($)
  const ui = await pane($)
  const text = await joined(ui)
  expect(text).toContain('ציון יעילות')
  expect(text).toContain('עבודה כפולה')
  expect(text).toContain('כשלים חוזרים')
  expect(text).toContain('ניהול הקשר')
  expect(text).toContain('אימות')
  expect(text).toContain('מודעות לתקציב')
  expect(text).toContain('מבוסס על ההיסטוריה שלך בלבד')
  expect(text).toContain('תואר: ')
  expect(text).not.toContain('Duplicate work')
  await ui.unmount()
})

test('Hebrew: the off text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, [], { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'efficiency', args: '' })).text).toBe('ציון היעילות כבוי. הפעל אותו בלוח /toolkitty.')
})

test('switched off: a later session records nothing, the command answers the off text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = setup(on, ON)
  await start($)
  await turn($)
  expect(w.store.get('efficiency-score:days')).toBeDefined()
  const before = JSON.stringify(w.store.get('efficiency-score:days'))
  w.store.set('enabled', { ...Object.fromEntries([[ID, false]]) })
  await start($)
  await turn($)
  expect(JSON.stringify(w.store.get('efficiency-score:days'))).toBe(before)
  expect((await $.command.run({ command: 'efficiency', args: '' })).text).toContain('is off')
})
