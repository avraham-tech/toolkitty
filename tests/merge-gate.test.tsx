import { expect, test } from 'claude-code/testing'
import { CWD, expandBand, mountBand, noticesOf, rig, lineOf } from './_kit'

const ON = { buddy: false }
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', command })
const cmd = ($: any, args: string) => $.command.run({ command: 'merge-gate', args })

type Gh = { json?: string; jsonFail?: string; text?: string; branch?: string; noGh?: boolean; branchFails?: boolean }

const failing = JSON.stringify([
  { name: 'build', state: 'FAILURE', bucket: 'fail' },
  { name: 'lint', state: 'SUCCESS', bucket: 'pass' },
  { name: 'unit', state: 'FAILURE', bucket: 'fail' },
])
const pending = JSON.stringify([
  { name: 'build', state: 'SUCCESS', bucket: 'pass' },
  { name: 'e2e', state: 'IN_PROGRESS', bucket: 'pending' },
])
const green = JSON.stringify([
  { name: 'build', state: 'SUCCESS', bucket: 'pass' },
  { name: 'lint', state: 'SUCCESS', bucket: 'pass' },
  { name: 'docs', state: 'SKIPPED', bucket: 'skipping' },
])

function gh(r: { proc: (argv: string[]) => any }, g: Gh) {
  r.proc = argv => {
    if (argv[0] === 'git' && argv[1] === 'rev-parse') {
      return g.branchFails ? { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' } : { exitCode: 0, stdout: `${g.branch ?? 'feat/x'}\n`, stderr: '' }
    }
    if (argv[0] === 'gh') {
      if (g.noGh) return 'throw'
      if (argv.includes('--json')) return g.json === undefined ? { exitCode: 1, stdout: '', stderr: g.jsonFail ?? 'unknown flag: --json' } : { exitCode: 0, stdout: g.json, stderr: '' }
      return { exitCode: 0, stdout: g.text ?? '', stderr: '' }
    }
    return { exitCode: 0, stdout: '', stderr: '' }
  }
}

const denyFail = (branch: string, names: string) =>
  `Toolkitty · Merge gate: CI is failing on ${branch}: ${names}. Fix the failing checks first. If the person wants to go ahead anyway, they can run /merge-gate allow for a one-time pass.`
const denyPending = (n: number, branch: string, names: string) =>
  `Toolkitty · Merge gate: CI still running (${n} pending) on ${branch}: ${names}. Wait for the checks to finish and try again. If the person wants to go ahead anyway, they can run /merge-gate allow for a one-time pass.`

test('registers /merge-gate; before any push the status says so', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  expect(r.regs).toContain('merge-gate')
  expect((await cmd($, '')).text).toBe('No push or merge has been checked yet in this session.')
  expect((await cmd($, 'status')).text).toBe('No push or merge has been checked yet in this session.')
})

test('gh pr merge is denied while CI fails or runs (8 inputs), with the exact text', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const cases: [string, Gh, string][] = [
    ['gh pr merge 42', { json: failing }, denyFail('feat/x', 'build, unit')],
    ['gh pr merge 42 --squash --delete-branch', { json: failing }, denyFail('feat/x', 'build, unit')],
    ['gh pr merge', { json: failing, branch: 'fix/y' }, denyFail('fix/y', 'build, unit')],
    ['gh pr merge --auto --squash', { json: failing, branch: 'main' }, denyFail('main', 'build, unit')],
    ['npm test && gh pr merge 7', { json: pending }, denyPending(1, 'feat/x', 'e2e')],
    ['gh pr merge 7 --merge', { json: pending }, denyPending(1, 'feat/x', 'e2e')],
    // no bucket: the state decides
    ['gh pr merge 9', { json: JSON.stringify([{ name: 'ci', state: 'TIMED_OUT' }]) }, denyFail('feat/x', 'ci')],
    ['gh pr merge 9', { json: JSON.stringify([{ name: 'ci', state: 'QUEUED' }, { name: 'ci2', state: 'WAITING' }]) }, denyPending(2, 'feat/x', 'ci, ci2')],
    // text form of an older gh
    ['gh pr merge 3', { text: 'build\tfail\t1m2s\thttps://x/1\nlint\tpass\t12s\thttps://x/2\n' }, denyFail('feat/x', 'build')],
    ['gh pr merge 3', { text: 'build\tpass\t1m2s\thttps://x/1\ne2e\tpending\t0\thttps://x/2\n' }, denyPending(1, 'feat/x', 'e2e')],
    // failing beats pending
    ['gh pr merge 3', { json: JSON.stringify([{ name: 'a', bucket: 'pending' }, { name: 'b', bucket: 'fail' }]) }, denyFail('feat/x', 'b')],
    // more than six names are cut
    ['gh pr merge 3', { json: JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ name: `c${i}`, bucket: 'fail' }))) }, denyFail('feat/x', 'c0, c1, c2, c3, c4, c5 +3')],
  ]
  for (const [command, g, expected] of cases) {
    gh(r, g)
    const res = await bash($, command)
    expect(res.deny, `${command} ${JSON.stringify(g).slice(0, 60)}`).toBe(expected)
  }
})

test('the PR number is the one asked about', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  gh(r, { json: failing })
  await bash($, 'gh pr merge 42 --squash')
  expect(r.procs.filter(p => p[0] === 'gh').pop()).toEqual(['gh', 'pr', 'checks', '42', '--json', 'name,state,bucket'])
  await bash($, 'gh pr merge --auto')
  expect(r.procs.filter(p => p[0] === 'gh').pop()).toEqual(['gh', 'pr', 'checks', 'feat/x', '--json', 'name,state,bucket'])
  // a flag's value is not the PR
  await bash($, 'gh pr merge --subject "Ship it" 17')
  expect(r.procs.filter(p => p[0] === 'gh').pop()).toEqual(['gh', 'pr', 'checks', '17', '--json', 'name,state,bucket'])
  await bash($, 'gh pr merge -b body-text 18 --squash')
  expect(r.procs.filter(p => p[0] === 'gh').pop()).toEqual(['gh', 'pr', 'checks', '18', '--json', 'name,state,bucket'])
})

test('merges and pushes with green or no CI pass (10 inputs)', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const cases: [string, Gh][] = [
    ['gh pr merge 42', { json: green }],
    ['gh pr merge 42', { json: '[]' }],
    ['gh pr merge 42', { jsonFail: 'no pull requests found for branch "feat/x"' }],
    ['gh pr merge 42', { noGh: true }],
    ['gh pr merge 42', { branchFails: true, json: failing }],
    ['git push', { json: green }],
    ['git push origin main', { json: green }],
    ['git push -u origin feat/x', { json: pending }],
    ['git -C sub push', { json: pending }],
    ['git push', { jsonFail: 'no pull requests found', text: '' }],
    // a push may be the fix: CI red is a warning there, not a block
    ['git push --force-with-lease', { json: failing }],
    // dry runs and detached heads
    ['git push --dry-run', { json: failing }],
    ['git push -n', { json: failing }],
    ['git push', { branch: 'HEAD', json: failing }],
  ]
  for (const [command, g] of cases) {
    gh(r, g)
    const res = await bash($, command)
    expect(res.deny, `${command} ${JSON.stringify(g).slice(0, 50)}`).toBe(undefined)
  }
})

test('commands that are not a push or a merge are never checked', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  gh(r, { json: failing })
  r.procs.length = 0
  const quiet = [
    'git status',
    'git pull',
    'git fetch origin',
    'gh pr view 42',
    'gh pr checks 42',
    'gh pr create --fill',
    'git commit -m "write docs about gh pr merge"',
    'echo "git push" > note.txt',
    'echo gh pr merge 5',
    'grep -rn "gh pr merge" docs/',
    'npm run push',
  ]
  for (const command of quiet) expect((await bash($, command)).deny, command).toBe(undefined)
  expect(r.procs.filter(p => p[0] === 'gh' || (p[0] === 'git' && p[1] === 'rev-parse' && p[2] === '--abbrev-ref'))).toEqual([])
  // a non-Bash tool is none of its business
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })).deny).toBe(undefined)
  // but a merge hidden in a chain or a subshell is
  gh(r, { json: failing })
  expect((await bash($, '(cd sub && gh pr merge 5)')).deny).toBe(denyFail('feat/x', 'build, unit'))
  expect((await bash($, 'if true; then gh pr merge 5; fi')).deny).toBe(denyFail('feat/x', 'build, unit'))
  expect((await bash($, 'GH_TOKEN=x gh pr merge 5')).deny).toBe(denyFail('feat/x', 'build, unit'))
})

test('a push with failing CI warns by notice and passes; a pending push is silent', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  gh(r, { json: failing })
  expect((await bash($, 'git push')).deny).toBe(undefined)
  const warned = (await noticesOf($, 'merge-gate')).filter(x => x.startsWith('Toolkitty · Merge gate'))
  expect(warned).toHaveLength(1)
  expect(warned[0]).toBe(denyFail('feat/x', 'build, unit').slice(0, 160))
  gh(r, { json: pending })
  expect((await bash($, 'git push')).deny).toBe(undefined)
  expect((await noticesOf($, 'merge-gate')).filter(x => x.startsWith('Toolkitty · Merge gate'))).toHaveLength(1)
  // a failing push is a verdict, not an incident; a blocked merge is
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "git push": blocked, CI still running. e2e')
})

test('/merge-gate allow gives exactly one pass', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  gh(r, { json: failing })
  expect((await bash($, 'gh pr merge 5')).deny).toBe(denyFail('feat/x', 'build, unit'))
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "gh pr merge 5": blocked, CI failing. build, unit')
  expect((await cmd($, 'allow')).text).toBe('One-time pass granted: the next git push or gh pr merge goes through without a CI check.')
  expect((await cmd($, '')).text).toBe(
    'Last verdict (0 min ago) for "gh pr merge 5": blocked, CI failing. build, unit\nA one-time pass is waiting for the next push or merge.',
  )
  r.procs.length = 0
  expect((await bash($, 'gh pr merge 5')).deny).toBe(undefined)
  // the pass ran no CI query
  expect(r.procs.filter(p => p[0] === 'gh')).toEqual([])
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "gh pr merge 5": allowed by one-time pass.')
  // and it is gone
  expect((await bash($, 'gh pr merge 5')).deny).toBe(denyFail('feat/x', 'build, unit'))
  // a pass is not spent by commands that are not pushes
  await cmd($, 'allow')
  await bash($, 'git status')
  expect((await bash($, 'git push')).deny).toBe(undefined)
  expect((await bash($, 'gh pr merge 5')).deny).toBe(denyFail('feat/x', 'build, unit'))
  // two allows are still one
  await cmd($, 'allow')
  await cmd($, 'ALLOW')
  expect((await bash($, 'gh pr merge 5')).deny).toBe(undefined)
  expect((await bash($, 'gh pr merge 5')).deny).toBe(denyFail('feat/x', 'build, unit'))
})

test('/merge-gate: every verdict wording, and bad arguments', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const usage = 'Usage: /merge-gate (last verdict) or /merge-gate allow (one-time pass)'
  expect((await cmd($, 'bogus')).text).toBe(usage)
  expect((await cmd($, 'allow now')).text).toBe(usage)
  expect((await cmd($, '--help')).text).toBe(usage)
  gh(r, { json: green })
  await bash($, 'gh pr merge 1')
  expect((await cmd($, 'status')).text).toBe('Last verdict (0 min ago) for "gh pr merge 1": allowed, CI green. 3 checks')
  gh(r, { json: '[]' })
  await bash($, 'git push')
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "git push": allowed, no CI to check. no checks reported')
  gh(r, { noGh: true })
  await bash($, 'git push origin main')
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "git push origin main": allowed, no CI to check. gh not available')
  gh(r, { jsonFail: 'no pull requests found' })
  await bash($, 'git push origin dev')
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "git push origin dev": allowed, no CI to check. no pull request')
  await r.clock.advance(7 * 60_000)
  expect((await cmd($, '')).text).toBe('Last verdict (7 min ago) for "git push origin dev": allowed, no CI to check. no pull request')
})

test('a CI query that takes longer than 15 seconds lets the command through and says so', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  r.proc = async argv => {
    if (argv[0] === 'git') return { exitCode: 0, stdout: 'feat/x\n', stderr: '' }
    await r.clock.advance(16_000)
    return 'throw'
  }
  expect((await bash($, 'gh pr merge 5')).deny).toBe(undefined)
  expect(await noticesOf($, 'merge-gate')).toContain('Merge gate: the CI check took longer than 15 seconds, so the command was allowed')
  expect((await cmd($, '')).text).toBe('Last verdict (0 min ago) for "gh pr merge 5": allowed, check timed out. gh pr checks')
})

test('a blocked merge counts as an incident, a warned push does not', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON })
  await start($)
  const prevented = async () => {
    const ui = await mountBand($)
    await expandBand(ui)
    const t = (await lineOf(ui, 'incidents'))
    await ui.unmount()
    return t
  }
  gh(r, { json: failing })
  await bash($, 'git push')
  expect(await prevented()).toBe(undefined)
  await bash($, 'gh pr merge 5')
  expect(await prevented()).toBe('🛡 1 prevented')
  gh(r, { json: pending })
  await bash($, 'gh pr merge 5')
  expect(await prevented()).toBe('🛡 2 prevented')
})

test('off switch: nothing is checked, the command says off', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: { ...ON, 'merge-gate': false } })
  await start($)
  gh(r, { json: failing })
  r.procs.length = 0
  expect((await bash($, 'gh pr merge 5')).deny).toBe(undefined)
  expect(r.procs.filter(p => p[0] === 'gh')).toEqual([])
  expect((await cmd($, '')).text).toBe(OFF_TEXT)
  expect((await cmd($, 'allow')).text).toBe(OFF_TEXT)
})

test('Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const r = rig(on, { enabled: ON, lang: 'he' })
  await start($)
  expect((await cmd($, '')).text).toBe('עדיין לא נבדקו דחיפה או מיזוג בסשן הזה.')
  expect((await cmd($, 'x')).text).toBe('שימוש: /merge-gate (פסק הדין האחרון) או /merge-gate allow (מעבר חד-פעמי)')
  gh(r, { json: failing })
  const res = await bash($, 'gh pr merge 5')
  expect(res.deny).toBe(
    'Toolkitty · שער מיזוג: ה-CI נכשל בענף feat/x: build, unit. תקנו קודם את הבדיקות שנכשלו. אם המשתמש רוצה להמשיך בכל זאת, הוא יכול להריץ /merge-gate allow למעבר חד-פעמי.',
  )
  expect((await cmd($, '')).text).toBe('פסק הדין האחרון (לפני 0 דקות) עבור "gh pr merge 5": נחסם, ה-CI נכשל. build, unit')
  expect((await cmd($, 'allow')).text).toBe('ניתן מעבר חד-פעמי: ה-git push או ה-gh pr merge הבא יעברו בלי בדיקת CI.')
})
