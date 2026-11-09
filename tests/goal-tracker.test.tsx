import { expect, test } from 'claude-code/testing'
import { BAND, NOON, PANE, joined, noticeTexts, refusal, start, turnDone, turnStart, world } from './harness'

/*
 * The goal tracker. The test `$` has no state noun of its own, so the evidence slot is an in-memory state
 * beneath the plugin (the same store every atom goes through) that a test can also seed.
 */
type Slot = { value: unknown; version: number }
let slots = new Map<string, Slot>()
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`
const EV = 'toolkitty/slot/evidence'

type Ev = { at: number; kind: string; ok: boolean; summary: string; ref: string; feature: string; turnId?: string }
const evItems = (): Ev[] => ((slots.get(EV)?.value as { items?: Ev[] } | undefined)?.items ?? []) as Ev[]
const seed = (items: Ev[]): void => {
  slots.set(EV, { value: { items }, version: (slots.get(EV)?.version ?? 0) + 1 })
}
const ev = (kind: string, ok: boolean, summary: string, ref = 'x', at = NOON): Ev => ({ at, kind, ok, summary, ref, feature: 'seed' })

type K = { filled: { text: string; mode?: string }[]; procs: string[][]; w: ReturnType<typeof world>; execs: Set<string> }

function setup(on: any, o: Parameters<typeof world>[1] = {}): K {
  slots = new Map()
  const w = world(on, o)
  const k: K = { filled: [], procs: [], w, execs: new Set() }
  on('state.get', (_: any, e: any) => {
    const s = slots.get(slotKey(e))
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const prev = slots.get(slotKey(e))
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    slots.set(slotKey(e), { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('prompt.fill', (_: any, e: any) => {
    k.filled.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  w.exists = (p: string) => w.files[p.split(String.fromCharCode(92)).join('/')] !== undefined || k.execs.has(p.split(String.fromCharCode(92)).join('/'))
  return k
}

const todo = (items: [string, 'pending' | 'in_progress' | 'completed'][], extra: Record<string, unknown> = {}) =>
  ({ tool: 'TodoWrite', todos: items.map(([content, status]) => ({ content, status, activeForm: content })), ...extra }) as any
const enabled = (more: Record<string, boolean> = {}) => ({ enabled: { 'goal-tracker': true, ...more } })
const paneOf = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('goal-tracker'), surface })
const FAIL = { isError: true, result: 'exit 1' }

const THREE: [string, 'pending' | 'in_progress' | 'completed'][] = [
  ['Add the parser in src/parser.ts', 'completed'],
  ['Make the tests pass', 'in_progress'],
  ['Fix lint errors', 'pending'],
  ['Update the docs', 'completed'],
]

test('load: /goals registers (the separate /goal is gone), nothing is drawn yet, and the pane explains how goals appear', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  expect(k.w.cmds).toContain('goals')
  expect(k.w.cmds).not.toContain('goal')
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-empty' })
  expect(await b.find({ key: 'chip-goal-tracker' })).toBeUndefined()
  await b.unmount()

  expect((await $.command.run({ command: 'goals', args: '' })).text).toBe('The goal tracker is open.')
  expect(k.w.opened.map(o => o.id)).toContain('goal-tracker')
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('Goals')
  expect(all).toContain('0/0 verified')
  expect(all).toContain('No goals yet.')
  expect(all).toContain("Claude's task list becomes goals; add your own with /goals add <text>.")
  expect(all).toContain('Evidence this session')
  expect(all).toContain('No evidence recorded yet.')
  await ui.unmount()
})

test('TodoWrite on the main loop becomes goals; an empty list and a subagent are ignored; a rewrite keeps identity', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  await $.tool.call(todo(THREE))
  let ui = await paneOf($)
  let all = await joined(ui)
  for (const [text] of THREE) expect(all).toContain(text)
  expect(all).toContain('0/4 verified')
  await ui.unmount()

  // a subagent's list and an empty list change nothing
  await $.tool.call(todo([['Subagent goal', 'pending']], { agentId: 'agent-1' }))
  await $.tool.call(todo([]))
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).not.toContain('Subagent goal')
  expect(all).toContain('Update the docs')
  await ui.unmount()

  // a later list replaces the todo goals but keeps the person's own
  await $.command.run({ command: 'goals', args: 'add Docs mention the new flag' })
  await $.tool.call(todo([['Add the parser in src/parser.ts', 'completed'], ['Ship it', 'pending']]))
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('Ship it')
  expect(all).toContain('Docs mention the new flag')
  expect(all).not.toContain('Make the tests pass')
  await ui.unmount()
})

test('every state from evidence: verified, unverified, failed, open, claimed, never from the model words', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call(todo(THREE))
  let ui = await paneOf($)
  let all = await joined(ui)
  // no evidence at all: completed goals are unverified, the others open
  expect(all).toContain('? Add the parser in src/parser.ts')
  expect(all).toContain('○ Make the tests pass')
  expect(all).toContain('○ Fix lint errors')
  expect(all).toContain('? Update the docs')
  expect(all).toContain('no evidence')
  expect(all).not.toContain('✓ ')
  await ui.unmount()

  // a passing test, a diff of parser.ts, a failing lint
  seed([ev('test', true, 'vitest · 12 passed'), ev('diff', true, '+10 −2 parser.ts', 'C:/proj/src/parser.ts'), ev('lint', false, 'eslint · 3 problems')])
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('✓ Make the tests pass')
  expect(all).toContain('vitest · 12 passed')
  expect(all).toContain('✓ Add the parser in src/parser.ts')
  expect(all).toContain('+10 −2 parser.ts')
  expect(all).toContain('✗ Fix lint errors')
  expect(all).toContain('eslint · 3 problems')
  // the docs goal names no check and no file: another ok record after completion is only a claim
  expect(all).toContain('? Update the docs')
  expect(all).toContain('claimed, not proven')
  expect(all).toContain('2/4 verified')
  await ui.unmount()

  // the lint check now passes: the last record of a kind decides
  seed([ev('test', true, 'vitest · 12 passed'), ev('lint', false, 'eslint · 3 problems'), ev('lint', true, 'eslint · clean', 'x', NOON + 1)])
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('✓ Fix lint errors')
  expect(all).toContain('eslint · clean')
  await ui.unmount()

  // the test run fails later: failed, not verified
  seed([ev('test', true, 'vitest · ok'), ev('test', false, 'vitest · 2 failed', 'x', NOON + 5)])
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('✗ Make the tests pass')
  expect(all).toContain('vitest · 2 failed')
  await ui.unmount()
})

test('evidence from before a goal was created does not count', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  seed([ev('test', true, 'old run', 'x', NOON - 60_000)])
  await $.tool.call(todo([['Run the tests', 'completed']]))
  const ui = await paneOf($)
  expect(await joined(ui)).toContain('? Run the tests')
  await ui.unmount()
  k.w.clock.advance(1000)
  seed([ev('test', true, 'old run', 'x', NOON - 60_000), ev('test', true, 'new run', 'x', NOON + 1000)])
  const ui2 = await paneOf($)
  expect(await joined(ui2)).toContain('✓ Run the tests')
  await ui2.unmount()
})

test('a goal that names several checks needs all of them; types and build words map to their kinds', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call(todo([['Tests and build are green', 'pending'], ['Types are clean', 'pending'], ['Hebrew טסטים ירוקים', 'pending']]))
  seed([ev('test', true, 'jest · ok')])
  let ui = await paneOf($)
  let all = await joined(ui)
  expect(all).toContain('○ Tests and build are green')
  await ui.unmount()
  seed([ev('test', true, 'jest · ok'), ev('build', true, 'npm run build · ok')])
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('✓ Tests and build are green')
  expect(all).toContain('○ Types are clean')
  await ui.unmount()
  seed([ev('test', true, 'jest · ok'), ev('build', false, 'npm run build · failed'), ev('typecheck', true, 'tsc · ok')])
  ui = await paneOf($)
  all = await joined(ui)
  expect(all).toContain('✗ Tests and build are green')
  expect(all).toContain('✓ Types are clean')
  expect(all).toContain('✓ Hebrew טסטים ירוקים')
  await ui.unmount()
})

test('/goals add and /goals na: texts, numbering, errors', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect((await $.command.run({ command: 'goals', args: 'bogus' })).text).toBe('Usage: /goals add <text> or /goals na <n> <reason>')
  expect((await $.command.run({ command: 'goals', args: 'add' })).text).toBe('Usage: /goals add <text> or /goals na <n> <reason>')
  expect((await $.command.run({ command: 'goals', args: 'bogus 1' })).text).toBe('Usage: /goals add <text> or /goals na <n> <reason>')
  expect((await $.command.run({ command: 'goals', args: 'add The API returns 404 for unknown ids' })).text).toBe('Goal 1 added: The API returns 404 for unknown ids')
  expect((await $.command.run({ command: 'goals', args: 'add Tests cover the 404' })).text).toBe('Goal 2 added: Tests cover the 404')
  expect((await $.command.run({ command: 'goals', args: 'na 1' })).text).toBe('Give a reason: /goals na <n> <reason>')
  expect((await $.command.run({ command: 'goals', args: 'na 9 not needed' })).text).toBe('There is no goal 9. Open /goals to see the numbers.')
  expect((await $.command.run({ command: 'goals', args: 'na 2 no test infra here' })).text).toBe('Goal 2 marked not applicable (no test infra here)')

  seed([ev('test', false, 'jest · failed')])
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('○ The API returns 404 for unknown ids')
  expect(all).toContain('– Tests cover the 404')
  expect(all).toContain('n/a · no test infra here')
  // not applicable goals leave the count: 0 of 1
  expect(all).toContain('0/1 verified')
  await ui.unmount()
})

test('real Bash results through claim-check become evidence and verify goals; a failing command fails them', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'claim-check': true }) })
  await start($)
  await turnStart($)
  await $.tool.call(todo([['Make the tests pass', 'in_progress'], ['Types are clean', 'in_progress'], ['Build works', 'in_progress'], ['Lint clean', 'in_progress']]))

  k.w.toolResult = { result: 'ok' }
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as any)
  k.w.toolResult = FAIL
  await $.tool.call({ tool: 'Bash', command: 'npx tsc --noEmit' } as any)
  k.w.toolResult = { result: 'ok' }
  await $.tool.call({ tool: 'Bash', command: 'ls -la' } as any) // not a check: no evidence
  await $.tool.call({ tool: 'Bash', command: 'npm run build && npx eslint src --max-warnings 0' } as any) // two kinds in one command

  const items = evItems()
  expect(items.map(x => `${x.kind}:${x.ok}:${x.feature}`)).toEqual(['test:true:claim-check', 'typecheck:false:claim-check', 'build:true:claim-check', 'lint:true:claim-check'])
  expect(items[0]?.summary).toBe('npm test · ok')
  expect(items[1]?.summary).toBe('npx tsc --noEmit · failed')
  expect(items[0]?.ref).toBe('npm test')

  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('✓ Make the tests pass')
  expect(all).toContain('✗ Types are clean')
  expect(all).toContain('✓ Build works')
  expect(all).toContain('✓ Lint clean')
  expect(all).toContain('3/4 verified')
  expect(all).toContain('✓ test · npm test · ok')
  expect(all).toContain('✗ typecheck · npx tsc --noEmit · failed')
  await ui.unmount()
})

test('a long command is cut to 80 characters in the summary', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'claim-check': true }) })
  await start($)
  k.w.toolResult = { result: 'ok' }
  const cmd = 'npx vitest run ' + 'src/some/very/long/path/'.repeat(8) + 'file.test.ts'
  await $.tool.call({ tool: 'Bash', command: cmd } as any)
  expect(evItems()).toHaveLength(1)
  expect(evItems()[0]?.summary).toBe(cmd.slice(0, 80) + ' · ok')
})

test('claim-check off records no evidence', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'claim-check': false }) })
  await start($)
  k.w.toolResult = { result: 'ok' }
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as any)
  expect(evItems()).toHaveLength(0)
})

test('test-on-change records test evidence with the runner and the tail of the result', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'test-on-change': true }), files: { 'C:/proj/src/a.test.ts': 'x' } })
  k.execs.add('C:/proj/node_modules/.bin/vitest')
  k.w.files['C:/proj/src/a.ts'] = 'export const a = 1'
  k.w.run = (e: any) => {
    if (String(e.argv[0]).includes('vitest')) k.procs.push([...e.argv])
    return { value: { exitCode: 0, stdout: 'Test Files  1 passed\nTests  3 passed (3)\n', stderr: '' } }
  }
  await start($)
  await $.tool.call({ tool: 'Write', file_path: 'C:/proj/src/a.ts', content: 'export const a = 2' } as any)
  expect(k.procs.length).toBe(1)
  const items = evItems().filter(x => x.kind === 'test')
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({ ok: true, summary: 'vitest · Tests  3 passed (3)', feature: 'test-on-change' })
  expect(items[0]?.ref).toContain('vitest run')
})

test('test-on-change records a failed run', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'test-on-change': true }), files: { 'C:/proj/src/a.test.ts': 'x', 'C:/proj/src/a.ts': 'x' } })
  k.execs.add('C:/proj/node_modules/.bin/vitest')
  k.w.run = () => ({ value: { exitCode: 1, stdout: 'FAIL a.test.ts\nTests  1 failed | 2 passed (3)\n', stderr: '' } })
  await start($)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/src/a.ts', old_string: 'x', new_string: 'y' } as any)
  const items = evItems().filter(x => x.kind === 'test')
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({ ok: false, summary: 'vitest · Tests  1 failed | 2 passed (3)' })
})

test('lint-after-edit records lint evidence for a clean run and for problems, not for a crash', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { files: { 'C:/proj/src/a.ts': 'x' } })
  k.execs.add('C:/proj/node_modules/.bin/eslint')
  let code = 0
  k.w.run = () => ({ value: { exitCode: code, stdout: code === 0 ? '' : 'a.ts\n  1:1  error  no-undef\n\n1 problem (1 error)\n', stderr: '' } })
  await start($)
  const edit = { tool: 'Edit', file_path: 'C:/proj/src/a.ts', old_string: 'x', new_string: 'y' } as any
  await $.tool.call(edit)
  code = 1
  await $.tool.call(edit)
  code = 2
  await $.tool.call(edit)
  const items = evItems().filter(x => x.kind === 'lint')
  expect(items.map(x => x.ok)).toEqual([true, false])
  expect(items[0]?.summary).toBe('eslint · clean')
  expect(items[1]?.summary).toBe('eslint · 1 problem (1 error)')
  expect(items[1]?.feature).toBe('lint-after-edit')
})

test('diff-review records one diff evidence per changed file at the end of the turn', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: enabled({ 'diff-review': true }), files: { 'C:/proj/src/a.ts': 'one\ntwo', 'C:/proj/src/b.ts': 'same' } })
  await start($)
  await turnStart($)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/src/a.ts', old_string: 'two', new_string: 'three' } as any)
  k.w.files['C:/proj/src/a.ts'] = 'one\nthree\nfour'
  await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/src/b.ts', old_string: 'same', new_string: 'same' } as any) // unchanged
  await turnDone($)
  const items = evItems().filter(x => x.kind === 'diff')
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({ ok: true, summary: '+2 −1 a.ts', ref: 'C:/proj/src/a.ts', feature: 'diff-review' })
})

test('Run missing checks fills the prompt with the specific checks; it never runs a command', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  await $.tool.call(todo([['Make the tests pass', 'in_progress'], ['Types are clean', 'completed'], ['Polish the readme', 'pending'], ['Lint clean', 'pending']]))
  seed([ev('lint', true, 'eslint · clean')])
  const ui = await paneOf($)
  await ui.press({ key: 'goal-run-missing' })
  expect(k.filled).toHaveLength(1)
  expect(k.filled[0]?.mode).toBe('replace')
  const text = k.filled[0]?.text ?? ''
  expect(text).toContain('1. "Make the tests pass": run the test command')
  expect(text).toContain('2. "Types are clean": run the type check command')
  expect(text).toContain('3. "Polish the readme": show evidence')
  expect(text).not.toContain('Lint clean')
  expect(k.procs).toEqual([])

  // a failed one asks to run it again
  seed([ev('lint', false, 'eslint · 2 problems'), ev('test', true, 'ok'), ev('typecheck', true, 'ok')])
  await ui.press({ key: 'goal-run-missing' })
  expect(k.filled[1]?.text).toContain('"Lint clean": run the lint command again, it failed last time')
  expect(k.filled[1]?.text).not.toContain('Make the tests pass')
  await ui.unmount()
})

test('Run missing checks with everything verified says so and fills nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  await $.tool.call(todo([['Make the tests pass', 'completed']]))
  seed([ev('test', true, 'ok')])
  const ui = await paneOf($)
  await ui.press({ key: 'goal-run-missing' })
  expect(k.filled).toHaveLength(0)
  await ui.unmount()
  const n = await $.ui.mount({ ...PANE('toolkitty-notices'), surface: 'desktop' })
  expect(await joined(n)).toContain('Every goal is verified or not applicable; nothing to run.')
  await n.unmount()
})

test('Create report copies a plain-text report; Clear empties the goals', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  await $.tool.call(todo(THREE))
  await $.command.run({ command: 'goals', args: 'add Docs mention the flag' })
  await $.command.run({ command: 'goals', args: 'na 5 internal only' })
  seed([ev('test', true, 'vitest · 12 passed'), ev('lint', false, 'eslint · 3 problems')])
  const ui = await paneOf($)
  await ui.press({ key: 'goal-report' })
  expect(k.w.copies).toHaveLength(1)
  const report = k.w.copies[0]?.text ?? ''
  const lines = report.split(String.fromCharCode(10))
  expect(lines[0]).toBe('Goal report: 1/4 verified')
  expect(report).toContain('2. [✓ verified] Make the tests pass (vitest · 12 passed)')
  expect(report).toContain('3. [✗ failed] Fix lint errors (eslint · 3 problems)')
  expect(report).toContain('1. [? unverified] Add the parser in src/parser.ts')
  expect(report).toContain('5. [– n/a] Docs mention the flag (n/a · internal only)')
  expect(report).toContain('Evidence this session')
  expect(report).toContain('- FAILED lint: eslint · 3 problems')
  expect(report).toContain('- ok test: vitest · 12 passed')
  expect(report).not.toContain('<')

  k.w.copyOk = false
  await ui.press({ key: 'goal-report' })
  expect(k.w.copies).toHaveLength(2)

  await ui.press({ key: 'goal-clear' })
  await ui.redraw()
  const all = await joined(ui)
  expect(all).toContain('No goals yet.')
  expect(all).toContain('0/0 verified')
  // the evidence is not the tracker's to delete
  expect(evItems()).toHaveLength(2)
  await ui.unmount()
  const n = await $.ui.mount({ ...PANE('toolkitty-notices'), surface: 'desktop' })
  const notes = await joined(n)
  expect(notes).toContain('Goal report copied.')
  expect(notes).toContain('Could not copy the report.')
  expect(notes).toContain('Goals cleared.')
  await n.unmount()
})

test('the pane lists the last ten evidence records, newest first, on both surfaces', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  seed(Array.from({ length: 13 }, (_, i) => ev('test', i % 2 === 0, `run ${i}`, 'x', NOON - (13 - i) * 1000)))
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await paneOf($, surface)
    const all = await joined(ui)
    expect(all).toContain('run 12')
    expect(all).toContain('run 3')
    expect(all).not.toContain('run 2')
    expect(all.indexOf('run 12')).toBeLessThan(all.indexOf('run 11'))
    expect(all).toContain('✗ test · run 11')
    await ui.unmount()
  }
})

test('the band chip: none without goals, info with unverified, warn with a failure, quiet when all verified', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const chip = async (surface: 'desktop' | 'terminal' = 'desktop') => {
    const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
    const c = await b.find({ key: 'chip-goal-tracker' })
    const t = c === undefined ? undefined : await b.find({ type: 'Text', text: c.text.trim() })
    const out = c === undefined ? undefined : { text: c.text.trim(), color: t?.props['color'] }
    await b.unmount()
    return out
  }
  expect(await chip()).toBeUndefined()
  await $.tool.call(todo([['Make the tests pass', 'completed'], ['Lint clean', 'pending'], ['Ship', 'pending']]))
  const unverified = await chip()
  expect(unverified?.text).toContain('goals 0/3 ✓')
  expect(unverified?.color).toBe('claude')
  seed([ev('test', true, 'ok')])
  expect((await chip())?.text).toContain('goals 1/3 ✓')
  seed([ev('test', true, 'ok'), ev('lint', false, 'bad')])
  const failed = await chip('terminal')
  expect(failed?.text).toContain('goals 1/3 ✓')
  expect(failed?.color).toBe('warning')
  // all goals verified or not applicable: still shown, quiet
  await $.command.run({ command: 'goals', args: 'na 2 skip' })
  await $.command.run({ command: 'goals', args: 'na 3 skip' })
  const done = await chip()
  expect(done?.text).toContain('goals 1/1 ✓')
  expect(done?.color).toBeUndefined()
  // a chip is not shown when only n/a goals remain
  await $.command.run({ command: 'goals', args: 'na 1 skip' })
  expect(await chip()).toBeUndefined()
})

test('the chip press opens the detail pane with the goal list', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  await $.tool.call(todo([['Make the tests pass', 'completed'], ['Ship', 'pending']]))
  seed([ev('test', true, 'vitest · ok')])
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-press' })
  await b.press({ key: 'chip-goal-tracker' })
  expect(k.w.opened.map(o => o.id)).toContain('toolkitty-detail')
  await b.unmount()
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  const all = await joined(d)
  expect(all).toContain('✓ Make the tests pass')
  expect(all).toContain('vitest · ok')
  expect(all).toContain('○ Ship')
  await d.unmount()
})

test('Hebrew: commands, pane and chip', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'goals', args: 'bogus' })).text).toBe('שימוש: /goals add <טקסט> או /goals na <מספר> <סיבה>')
  expect((await $.command.run({ command: 'goals', args: 'add בדיקות עוברות' })).text).toBe('יעד 1 נוסף: בדיקות עוברות')
  expect((await $.command.run({ command: 'goals', args: 'na 7 x' })).text).toBe('אין יעד 7. פתח /goals כדי לראות את המספרים.')
  expect((await $.command.run({ command: 'goals', args: '' })).text).toBe('מעקב היעדים נפתח.')
  seed([ev('test', true, 'jest · עבר')])
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('יעדים')
  expect(all).toContain('1/1 אומתו')
  expect(all).toContain('✓ בדיקות עוברות')
  expect(all).toContain('ראיות בסשן הזה')
  const labels = (await ui.findAll({ type: 'Button' })).map((x: any) => String(x.props.label ?? x.text))
  expect(labels).toEqual(['הרץ בדיקות חסרות', 'צור דוח', 'נקה'])
  await ui.unmount()
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-he' })
  expect((await b.find({ key: 'chip-goal-tracker' }))?.text).toContain('יעדים 1/1 ✓')
  await b.unmount()
})

test('the three header buttons, in English, in order', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const ui = await paneOf($)
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map((x: any) => x.key)).toEqual(['goal-run-missing', 'goal-report', 'goal-clear'])
  expect(buttons.map((x: any) => String(x.props.label ?? x.text))).toEqual(['Run missing checks', 'Create report', 'Clear'])
  expect(buttons.map((x: any) => x.props.hotkey)).toEqual(['1', '2', '3'])
  await ui.unmount()
})

test('off switch: nothing recorded, commands say off, no chip, the pane says off', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on, { store: { enabled: { 'goal-tracker': false } } })
  await start($)
  expect(k.w.cmds).toContain('goals')
  expect(k.w.cmds).not.toContain('goal')
  const OFF = 'The feature is off; turn it on in the /toolkitty pane'
  expect((await $.command.run({ command: 'goals', args: '' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'goals', args: 'add x' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'goals', args: 'na 1 x' })).text).toBe(OFF)
  await $.tool.call(todo(THREE))
  seed([ev('test', true, 'ok')])
  const b = await $.ui.mount({ ...BAND(), requestId: 'band-off' })
  expect(await b.find({ key: 'chip-goal-tracker' })).toBeUndefined()
  await b.unmount()
  const ui = await paneOf($)
  const all = await joined(ui)
  expect(all).toContain('The feature is off in the switches panel.')
  expect(all).not.toContain('Make the tests pass')
  expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
  await ui.unmount()
})

test('renamed: /goal is folded into /goals, which is registered; /goal is not', { timeoutMs: 30_000 }, async ($, on) => {
  const k = setup(on)
  await start($)
  expect(k.w.cmds).toContain('goals')
  expect(k.w.cmds).not.toContain('goal')
  expect((await $.command.run({ command: 'goals', args: 'add Fold the command' })).text).toBe('Goal 1 added: Fold the command')
  expect((await $.command.run({ command: 'goals', args: 'na 1 folded away' })).text).toContain('Goal 1 marked not applicable')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /goals registration (${how}) warns and the rest still works (todos still become goals)`, { timeoutMs: 30_000 }, async ($, on) => {
    const k = setup(on)
    refusal.name = 'goals'
    refusal.how = how
    await start($)
    expect(k.w.cmds).not.toContain('goals')
    expect(k.w.cmds.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /goals could not be registered: '))).toBe(true)
    await $.tool.call(todo(THREE))
    const ui = await paneOf($)
    expect(await joined(ui)).toContain('Update the docs')
    await ui.unmount()
  })
}
