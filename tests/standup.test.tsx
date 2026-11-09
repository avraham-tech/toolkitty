import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'

type Git = {
  repo?: boolean
  name?: string | null
  log?: string
  stat?: string
  work?: string
  throwAll?: boolean
}

function boot(on: On, store: Record<string, unknown> = {}, git: Git = {}) {
  const seen = { registered: [] as string[], argvs: [] as string[][] }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => {
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('process.run', (_, e) => {
    seen.argvs.push([...e.argv])
    const a = e.argv.join(' ')
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (git.throwAll && e.argv[0] === 'git' && e.argv[1] !== 'rev-parse') throw new Error('spawn failed')
    if (a === 'git rev-parse --is-inside-work-tree') return git.repo === false ? out('', 128) : out('true\n')
    if (a === 'git config user.name') return git.name === null ? out('', 1) : out((git.name ?? 'Avi') + '\n')
    if (e.argv[1] === 'log') return out(git.log ?? '')
    if (a === 'git diff --shortstat HEAD@{midnight}') return out(git.stat ?? '')
    if (a === 'git diff --shortstat HEAD') return out(git.work ?? '')
    return out('')
  })
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const run = ($: any, args = '') => $.command.run({ command: 'daily-standup', args })

test('registers /daily-standup at session start', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('daily-standup')
})

test('lists today commits and the change stat', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, {}, { log: 'feat: a\nfix: b\n\n', stat: ' 3 files changed, 10 insertions(+), 2 deletions(-)' })
  await start($)
  const r = await run($)
  expect(r.text).toBe(
    ['What was done today:', '• feat: a', '• fix: b', '', '3 files changed, 10 insertions(+), 2 deletions(-)'].join('\n'),
  )
  const log = seen.argvs.find(a => a[1] === 'log' && a[2] === '--since=midnight')
  expect(log).toEqual(['git', 'log', '--since=midnight', '--pretty=format:%s', '--author=Avi'])
})

test('arguments make no difference', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { log: 'feat: a', stat: ' 1 file changed' })
  await start($)
  expect((await run($, 'yesterday')).text).toBe((await run($)).text)
})

test('no git user name drops the author filter', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, {}, { name: null, log: 'feat: a' })
  await start($)
  await run($)
  const log = seen.argvs.find(a => a[1] === 'log' && a[2] === '--since=midnight')
  expect(log).toEqual(['git', 'log', '--since=midnight', '--pretty=format:%s'])
})

test('commits but no stat', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { log: 'feat: a' })
  await start($)
  expect((await run($)).text).toBe('What was done today:\n• feat: a')
})

test('no commits: falls back to uncommitted changes against HEAD', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { work: ' 2 files changed, 5 insertions(+)' })
  await start($)
  expect((await run($)).text).toBe(
    ['What was done today:', 'No commits today.', '', '2 files changed, 5 insertions(+) (uncommitted changes)'].join('\n'),
  )
})

test('nothing at all', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  expect((await run($)).text).toBe('What was done today:\nNo commits today.')
})

test('not a repository', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, {}, { repo: false })
  await start($)
  expect((await run($)).text).toBe('What was done today:\nThe folder is not a git repository.')
  expect(seen.argvs.some(a => a[2] === '--since=midnight')).toBe(false)
})

test('git failing to spawn is survived', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { throwAll: true })
  await start($)
  expect((await run($)).text).toBe('What was done today:\nNo commits today.')
})

test('at most 40 commits are listed', { timeoutMs: 30000 }, async ($, on) => {
  const log = Array.from({ length: 55 }, (_, i) => `c${i}`).join('\n')
  boot(on, {}, { log })
  await start($)
  const lines = ((await run($)).text as string).split('\n')
  expect(lines.filter(l => l.startsWith('• '))).toHaveLength(40)
})

test('Hebrew output', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { work: ' 1 file changed' })
  await start($)
  expect((await run($)).text).toBe('מה נעשה היום:\nאין קומיטים מהיום.\n\n1 file changed (שינויים שטרם נשמרו)')
})

test('Hebrew, not a repository', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { repo: false })
  await start($)
  expect((await run($)).text).toBe('מה נעשה היום:\nהתיקייה אינה מאגר git.')
})

test('off switch: off text and git never run', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { standup: false } })
  await start($)
  expect(seen.registered).toContain('daily-standup')
  seen.argvs.length = 0
  expect((await run($)).text).toBe('This feature is off; turn it on in the /toolkitty panel')
  expect(seen.argvs).toHaveLength(0)
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he', enabled: { standup: false } })
  await start($)
  expect((await run($)).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

test('the old /standup name is not registered; /daily-standup is', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).not.toContain('standup')
  expect(seen.registered).toContain('daily-standup')
})
