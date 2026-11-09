import { expect, test } from 'claude-code/testing'
import { CWD, added, noticesOf, rig, unfold } from './_kit'

const ON = { 'claim-check': true, buddy: false }
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'
const FAIL = { isError: true, result: 'exit 1', text: 'exit 1' }
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const bash = (command: string) => ({ tool: 'Bash', command }) as const
/** Flagged claims are warn notices now, not toasts. */
const claims = async ($: any) => unfold((await noticesOf($, 'claim-check')).filter(x => x.includes('⚠ ')))

let turn = 0
const finish = ($: any, answer: string, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer, reason: 'answer', durationMs: 10, isAborted: false, turnId: `t${++turn}`, ...extra })

/** One whole turn: the commands run (each with its outcome), then the answer. Returns the claim toasts it raised. */
async function turnOf($: any, r: { toasts: string[]; answer: (e: Record<string, unknown>) => Record<string, unknown> }, cmds: [string, boolean][], answer: string, extra: Record<string, unknown> = {}): Promise<string[]> {
  const before = await claims($)
  for (const [cmd, ok] of cmds) {
    r.answer = () => (ok ? {} : FAIL)
    await $.tool.call(bash(cmd))
  }
  await finish($, answer, extra)
  return added(before, await claims($))
}

test('registers /claims; a quiet session says so', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('claims')
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe('No unverified claims caught in this session.')
  expect((await $.command.run({ command: 'claims', args: 'whatever' })).text).toBe('No unverified claims caught in this session.')
})

test('claims with no matching command are flagged, with the exact toast (12 answers)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const cases: [string, string, string[]][] = [
    ['All tests pass now.', "⚠ claimed 'All tests pass' but no test command ran this turn", []],
    ['I fixed it and the tests are passing.', "⚠ claimed 'tests are passing' but no test command ran this turn", []],
    ['Tests now pass.', "⚠ claimed 'Tests now pass' but no test command ran this turn", []],
    ['The build succeeds.', "⚠ claimed 'build succeeds' but no build command ran this turn", []],
    ['Good news: the build is green.', "⚠ claimed 'build is green' but no build command ran this turn", []],
    ['Typecheck passes.', "⚠ claimed 'Typecheck passes' but no typecheck command ran this turn", []],
    ['There are no type errors.', "⚠ claimed 'no type errors' but no typecheck command ran this turn", []],
    ['Lint is clean.', "⚠ claimed 'Lint is clean' but no lint command ran this turn", []],
    ['Linting passed.', "⚠ claimed 'Linting passed' but no lint command ran this turn", []],
    ['I verified the change works.', "⚠ claimed 'verified' but no test, build, lint or typecheck command ran this turn", []],
    // a command that is not a check does not count
    ['All the tests pass.', "⚠ claimed 'All the tests pass' but no test command ran this turn", ['ls -la', 'git status']],
    // only the wrong kind of check ran
    ['The build succeeds.', "⚠ claimed 'build succeeds' but no build command ran this turn", ['npm test']],
  ]
  for (const [answer, toast, cmds] of cases) {
    const got = await turnOf($, r, cmds.map(c => [c, true] as [string, boolean]), answer)
    expect(got, answer).toEqual([toast])
  }
  expect((await $.command.run({ command: 'claims', args: '' })).text.split('\n')[0]).toBe('Unverified claims in this session: 12')
})

test('a matching command that FAILED is flagged with its own wording', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(await turnOf($, r, [['npm test', false]], 'All tests pass.')).toEqual(["⚠ claimed 'All tests pass' but the test command failed this turn"])
  expect(await turnOf($, r, [['npx tsc --noEmit', false]], 'No type errors.')).toEqual(["⚠ claimed 'No type errors' but the typecheck command failed this turn"])
  // failed first, then green: the green one counts
  expect(await turnOf($, r, [['pytest', false], ['pytest', true]], 'All tests pass.')).toEqual([])
  // the text of /claims keeps the difference
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe(
    [
      'Unverified claims in this session: 2',
      '1. "All tests pass" (the test command failed)',
      '2. "No type errors" (the typecheck command failed)',
    ].join('\n'),
  )
})

test('claims backed by a successful matching command pass (12 answers)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const cases: [string, string, string][] = [
    ['npm test', 'All tests pass.', 'npm test'],
    ['pnpm run test -- --watch=false', 'The tests are passing.', 'pnpm test'],
    ['npx vitest run', 'Tests now pass.', 'vitest'],
    ['python -m pytest -q', 'All the tests passed.', 'pytest'],
    ['go test ./...', 'All tests pass.', 'go test'],
    ['npm run build', 'The build succeeds.', 'npm build'],
    ['cargo build --release', 'The build passed.', 'cargo'],
    ['npx tsc --noEmit', 'Typecheck passes and there are no type errors.', 'tsc'],
    ['npx eslint src', 'Lint is clean.', 'eslint'],
    ['ruff check .', 'Linting passes.', 'ruff'],
    ['cd app && npm test', 'I verified it.', 'verified by npm test'],
    ['make', 'The build is green.', 'make'],
  ]
  for (const [cmd, answer, name] of cases) {
    expect(await turnOf($, r, [[cmd, true]], answer), name).toEqual([])
  }
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe('No unverified claims caught in this session.')
})

test('answers without a claim, unverified wording, aborted turns and subagent turns raise nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const quiet = [
    'I edited the file and renamed the helper.',
    'The tests failed, here is the log.',
    'This is unverified.',
    'Not sure yet whether the build works.',
    'I have not verified this yet.',
    'Hopefully the tests pass.',
    "I couldn't check if all tests pass.",
    'The tests should pass once you merge.',
    '',
  ]
  for (const answer of quiet) expect(await turnOf($, r, [], answer), answer).toEqual([])
  expect(await turnOf($, r, [], 'All tests pass.', { reason: 'aborted', isAborted: true })).toEqual([])
  expect(await turnOf($, r, [], 'All tests pass.', { reason: 'error' })).toEqual([])
  expect(await turnOf($, r, [], 'All tests pass.', { agentId: 'sub1' })).toEqual([])
  expect(await turnOf($, r, [], 'Verified.', { reason: 'refusal', refusal: { category: null, explanation: null } })).toEqual([])
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe('No unverified claims caught in this session.')
})

test('commands belong to the turn that ran them', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(await turnOf($, r, [['npm test', true]], 'Done, nothing to report.')).toEqual([])
  expect(await turnOf($, r, [], 'All tests pass.')).toEqual(["⚠ claimed 'All tests pass' but no test command ran this turn"])
  // a turn that ended some other way still drops its commands
  expect(await turnOf($, r, [['npm test', true]], 'stopped', { reason: 'aborted', isAborted: true })).toEqual([])
  expect(await turnOf($, r, [], 'All tests pass.')).toEqual(["⚠ claimed 'All tests pass' but no test command ran this turn"])
  // subagent commands do not back the main agent's claim
  r.answer = () => ({})
  await $.tool.call({ ...bash('npm test'), agentId: 'sub1' })
  await finish($, 'All tests pass.')
  expect((await claims($))).toHaveLength(3)
})

test('commands that only mention a check are not checks', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const mentions = ['cat jest.config.js', 'echo "npm test"', 'grep -rn pytest .', 'ls node_modules/.bin/tsc', 'git log --grep=eslint']
  for (const cmd of mentions) {
    expect(await turnOf($, r, [[cmd, true]], 'Verified.'), cmd).toHaveLength(1)
  }
})

test('the same claim twice in one answer is counted once; two different claims are two', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(await turnOf($, r, [], 'All tests pass. Really, all tests pass.')).toHaveLength(1)
  expect(await turnOf($, r, [], 'All tests pass and the build succeeds and lint is clean.')).toEqual([
    "⚠ claimed 'All tests pass' but no test command ran this turn",
    "⚠ claimed 'build succeeds' but no build command ran this turn",
    "⚠ claimed 'lint is clean' but no lint command ran this turn",
  ])
  expect((await $.command.run({ command: 'claims', args: '' })).text.split('\n')[0]).toBe('Unverified claims in this session: 4')
})

test('/claims lists every catch with its wording', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  await turnOf($, r, [], 'All tests pass.')
  await turnOf($, r, [['npm run build', false]], 'The build succeeds.')
  await turnOf($, r, [], 'verified')
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe(
    [
      'Unverified claims in this session: 3',
      '1. "All tests pass" (no test command ran)',
      '2. "build succeeds" (the build command failed)',
      '3. "verified" (no test, build, lint or typecheck command ran)',
    ].join('\n'),
  )
})

test('the log keeps the newest hundred', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  for (let i = 0; i < 105; i++) await finish($, 'All tests pass.')
  // the same claim inside five minutes is one notices row with a count, not 105 rows
  expect((await noticesOf($, 'claim-check')).filter(x => x.includes('⚠ '))).toEqual(["⚠ claimed 'All tests pass' but no test command ran this turn ×105"])
  const lines = (await $.command.run({ command: 'claims', args: '' })).text.split('\n')
  expect(lines[0]).toBe('Unverified claims in this session: 100')
  expect(lines).toHaveLength(101)
})

test('off by default and off when switched off: no toast, the command says so', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, {})
  await start($)
  expect(await turnOf($, r, [], 'All tests pass.')).toEqual([])
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe(OFF_TEXT)
})

test('switched off after being on: nothing more is caught', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'claim-check': false } })
  await start($)
  expect(await turnOf($, r, [], 'All tests pass.')).toEqual([])
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe(OFF_TEXT)
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  await start($)
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe('לא נתפסו טענות שלא אומתו בסשן הזה.')
  expect(await turnOf($, r, [], 'הבדיקות עוברות.')).toEqual(["⚠ נטען 'הבדיקות עוברות' אך לא רצה פקודת בדיקות בתור הזה"])
  expect(await turnOf($, r, [['npm test', false]], 'הבדיקות עוברות.')).toEqual(["⚠ נטען 'הבדיקות עוברות' אך פקודת בדיקות נכשלה בתור הזה"])
  expect(await turnOf($, r, [['npm test', true]], 'הבדיקות עוברות.')).toEqual([])
  expect(await turnOf($, r, [], 'הקובץ מלא והבדיקות עוברות.')).toEqual(["⚠ נטען 'הבדיקות עוברות' אך לא רצה פקודת בדיקות בתור הזה"])
  expect(await turnOf($, r, [], 'לא בדקתי אם הבדיקות עוברות.')).toEqual([])
  expect(await turnOf($, r, [], 'הבנייה הצליחה.')).toEqual(["⚠ נטען 'הבנייה הצליחה' אך לא רצה פקודת בנייה בתור הזה"])
  expect(await turnOf($, r, [], 'בדקתי הכול.')).toEqual(["⚠ נטען 'בדקתי' אך לא רצה פקודת בדיקות, בנייה, לינט או בדיקת טיפוסים בתור הזה"])
  expect((await $.command.run({ command: 'claims', args: '' })).text).toBe(
    [
      'טענות שלא אומתו בסשן הזה: 5',
      '1. "הבדיקות עוברות" (לא רצה פקודת בדיקות)',
      '2. "הבדיקות עוברות" (פקודת בדיקות נכשלה)',
      '3. "הבדיקות עוברות" (לא רצה פקודת בדיקות)',
      '4. "הבנייה הצליחה" (לא רצה פקודת בנייה)',
      '5. "בדקתי" (לא רצה פקודת בדיקות, בנייה, לינט או בדיקת טיפוסים)',
    ].join('\n'),
  )
})
