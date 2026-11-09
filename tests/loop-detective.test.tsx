import { expect, test } from 'claude-code/testing'
import { COMPOSE, CWD, expandBand, mountBand, mountPane, rig, texts, lineOf } from './_kit'

const ON = { buddy: false }
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const bash = (command: string) => ({ tool: 'Bash', command }) as const
const loops = (r: { toasts: string[] }) => r.toasts.filter(x => x.includes('🔁'))
const FAIL = { isError: true, result: 'exit 1', text: 'exit 1' }

/** An engine that fails every Bash command containing "fail" or the listed ones. */
function failing(r: { answer: (e: Record<string, unknown>) => Record<string, unknown> }, pred: (e: Record<string, unknown>) => boolean) {
  r.answer = e => (pred(e) ? FAIL : {})
}

async function sections($: any): Promise<{ id: string; text: string }[]> {
  const out = await $.prompt.compose(COMPOSE)
  return out.sections
}

test('registers /repeats; a quiet session says so and draws no band', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('repeats')
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe('No loops caught in this session.')
  const ui = await mountBand($)
  expect(await ui.find({ key: 'band-loop-detective' })).toBe(undefined)
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(0)
  await ui.unmount()
})

test('pattern A: the same command failing three times in a row is caught (and shown everywhere)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, () => true)
  await start($)
  await $.tool.call(bash('npm run build'))
  await $.tool.call(bash('npm run build'))
  expect(loops(r)).toEqual([])
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe('No loops caught in this session.')
  await $.tool.call(bash('npm run build'))
  expect(loops(r)).toEqual(['🔁 Possible loop: "npm run build" keeps failing'])

  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe(
    ['Loops caught in this session: 1', '1. "npm run build" keeps failing', 'Active now: "npm run build" keeps failing'].join('\n'),
  )

  const section = (await sections($)).find(s => s.id === 'toolkitty:loop-detective')
  expect(section?.text).toContain('# Possible loop detected')
  expect(section?.text).toContain('the command "npm run build" has failed 3 times in a row')
  expect(section?.text).toContain('Do not run the same thing again.')

  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'loop-detective'))).toBe('🔁 loop: "npm run build" keeps failing')
  await ui.unmount()
})

test('pattern A is not raised by 2 failures, different commands, or a success in between', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  r.answer = () => FAIL
  await start($)
  const cases: string[][] = [
    ['npm run build', 'npm run build'],
    ['yarn lint', 'yarn typecheck', 'yarn lint'],
    ['cargo build', 'cargo build --release', 'cargo build'],
  ]
  for (const c of cases) for (const cmd of c) await $.tool.call(bash(cmd))
  // a success in the middle breaks the run
  r.answer = () => FAIL
  await $.tool.call(bash('make deploy'))
  await $.tool.call(bash('make deploy'))
  r.answer = () => ({})
  await $.tool.call(bash('make deploy'))
  // a non-Bash tool failing three times is not pattern A either
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/proj/missing.ts' })
  expect(loops(r)).toEqual([])
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe('No loops caught in this session.')
})

test('pattern B: edit, then failing tests on the same file, three cycles', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  r.answer = e => (e['tool'] === 'Bash' ? FAIL : {})
  await start($)
  const cycle = async (cmd: string, i: number) => {
    await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/src/a.ts', old_string: `o${i}`, new_string: `n${i}` })
    await $.tool.call(bash(cmd))
  }
  await cycle('npm test', 1)
  await cycle('npx vitest run', 2)
  expect(loops(r)).toEqual([])
  await cycle('pytest -x', 3)
  expect(loops(r)).toEqual(['🔁 Possible loop: edit, then failing tests on C:/proj/src/a.ts'])
  const text = (await $.command.run({ command: 'repeats', args: '' })).text
  expect(text).toContain('Loops caught in this session: 1')
  expect(text).toContain('1. edit, then failing tests on C:/proj/src/a.ts')
  const section = (await sections($)).find(s => s.id === 'toolkitty:loop-detective')
  expect(section?.text).toContain('editing C:/proj/src/a.ts and re-running "pytest -x" has failed 3 times')
})

test('pattern B is not raised by alternating files, a green run, or non-test commands', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  let green = false
  r.answer = e => (e['tool'] === 'Bash' && !green ? FAIL : {})
  await start($)
  const edit = (f: string, i: number) => $.tool.call({ tool: 'Edit', file_path: f, old_string: `o${i}`, new_string: `n${i}` })
  // three failures spread over two files: 2 + 1
  await edit('C:/proj/a.ts', 1)
  await $.tool.call(bash('npm test'))
  await edit('C:/proj/b.ts', 2)
  await $.tool.call(bash('npm test -- b'))
  await edit('C:/proj/a.ts', 3)
  await $.tool.call(bash('pytest'))
  // a failing non-verify command after edits does not count as a cycle
  for (let i = 0; i < 4; i++) {
    await edit('C:/proj/c.ts', 10 + i)
    await $.tool.call(bash(`echo oops ${i}`))
  }
  // a green test run resets the cycles
  green = true
  await edit('C:/proj/a.ts', 4)
  await $.tool.call(bash('npm test -- green'))
  green = false
  await edit('C:/proj/a.ts', 5)
  await $.tool.call(bash('npm test -- red1'))
  await edit('C:/proj/a.ts', 6)
  await $.tool.call(bash('npm test -- red2'))
  expect(loops(r)).toEqual([])
})

test('pattern C: the same tool with the same input four times', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  expect(loops(r)).toEqual([])
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  expect(loops(r)).toEqual(['🔁 Possible loop: Read repeated with the same input'])
  const section = (await sections($)).find(s => s.id === 'toolkitty:loop-detective')
  expect(section?.text).toContain('the Read tool has been called 4 times with identical input')
  const text = (await $.command.run({ command: 'repeats', args: '' })).text
  expect(text).toBe(['Loops caught in this session: 1', '1. Read repeated with the same input', 'Active now: Read repeated with the same input'].join('\n'))
})

test('pattern C is not raised by varied inputs, TodoWrite, or calls spread beyond the window', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'x', status: 'pending', activeForm: 'xing' }] })
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/other${i}.ts` })
  await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  expect(loops(r)).toEqual([])
})

test('the nudge clears when the model changes course; the log keeps the catch', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, e => e['command'] !== 'npm run build -- --fixed')
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call(bash('npm run build'))
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(1)
  // a different failing call does not clear pattern A
  await $.tool.call(bash('npm run lint'))
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(1)
  // the same command succeeding does
  r.answer = () => ({})
  await $.tool.call(bash('npm run build'))
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(0)
  const ui = await mountBand($)
  expect(await ui.find({ key: 'band-loop-detective' })).toBe(undefined)
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe('Loops caught in this session: 1\n1. "npm run build" keeps failing')
  // pattern C clears on any different successful call
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Glob', pattern: '*.ts' })
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(1)
  await $.tool.call({ tool: 'Glob', pattern: '*.md' })
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(0)
  await ui.unmount()
})

test('toasts are spaced five minutes per kind, the log is not', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, e => e['tool'] === 'Bash' && String(e['command']).startsWith('bad'))
  await start($)
  const trip = async (cmd: string) => {
    for (let i = 0; i < 3; i++) await $.tool.call(bash(cmd))
    r.answer = () => ({})
    await $.tool.call(bash(cmd))
    failing(r, e => e['tool'] === 'Bash' && String(e['command']).startsWith('bad'))
  }
  await trip('bad one')
  expect(loops(r)).toHaveLength(1)
  await r.clock.advance(60_000)
  await trip('bad two')
  expect(loops(r)).toHaveLength(1)
  await r.clock.advance(5 * 60_000)
  await trip('bad three')
  expect(loops(r)).toHaveLength(2)
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toContain('Loops caught in this session: 3')
})

test('subagent calls are ignored', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, () => true)
  await start($)
  for (let i = 0; i < 5; i++) await $.tool.call({ ...bash('npm run build'), agentId: 'sub1' })
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts', agentId: 'sub1' })
  expect(loops(r)).toEqual([])
})

test('detail pane: pressing the band line shows the catches, newest first, with time', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, e => e['tool'] === 'Bash')
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call(bash('npm run build'))
  await r.clock.advance(65_000)
  const ui = await mountBand($)
  await expandBand(ui)
  await ui.press({ key: 'band-loop-detective' })
  expect(r.opened).toContain('toolkitty-detail')
  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('Loop detective')
  expect(all).toContain('Loops caught in this session: 1')
  expect(all).toContain('Active now: "npm run build" keeps failing')
  expect(all).toContain('1:05 ago · same command failing · "npm run build" keeps failing · 3 times')
  expect(all).toContain('Commands: /repeats')
  expect((await detail.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['detail-toggle', 'detail-close'])
  await detail.press({ key: 'detail-close' })
  expect(r.closed).toContain('toolkitty-detail')
  await ui.unmount()
  await detail.unmount()
})

test('a survey holding the band hides the line', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  failing(r, () => true)
  await start($)
  for (let i = 0; i < 3; i++) await $.tool.call(bash('npm run build'))
  const ui = await mountBand($, { hasSurvey: true })
  await expandBand(ui)
  expect(await ui.find({ key: 'band-loop-detective' })).toBe(undefined)
  await ui.unmount()
})

test('off switch: nothing is tracked, no band, no section, the command says off', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'loop-detective': false } })
  failing(r, () => true)
  await start($)
  for (let i = 0; i < 6; i++) await $.tool.call(bash('npm run build'))
  for (let i = 0; i < 6; i++) await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  expect(loops(r)).toEqual([])
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe(OFF_TEXT)
  expect((await sections($)).filter(s => s.id === 'toolkitty:loop-detective')).toHaveLength(0)
  const ui = await mountBand($)
  await expandBand(ui)
  expect(await ui.find({ key: 'band-loop-detective' })).toBe(undefined)
  await ui.unmount()
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  failing(r, () => true)
  await start($)
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe('לא נתפסו לולאות בסשן הזה.')
  for (let i = 0; i < 3; i++) await $.tool.call(bash('npm run build'))
  expect(loops(r)).toEqual(['🔁 ייתכן שזו לולאה: "npm run build" ממשיכה להיכשל'])
  expect((await $.command.run({ command: 'repeats', args: '' })).text).toBe(
    ['לולאות שנתפסו בסשן הזה: 1', '1. "npm run build" ממשיכה להיכשל', 'פעילה כעת: "npm run build" ממשיכה להיכשל'].join('\n'),
  )
  const ui = await mountBand($)
  await expandBand(ui)
  expect((await lineOf(ui, 'loop-detective'))).toBe('🔁 לולאה: "npm run build" ממשיכה להיכשל')
  await ui.press({ key: 'band-loop-detective' })
  const detail = await mountPane($, 'toolkitty-detail')
  const all = await texts(detail)
  expect(all).toContain('בלש לולאות')
  expect(all).toContain('לפני 0:00 · אותה פקודה נכשלת · "npm run build" ממשיכה להיכשל · 3 פעמים')
  await ui.unmount()
  await detail.unmount()
})
