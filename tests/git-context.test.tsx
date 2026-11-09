import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'
const ID = 'toolkitty:git-context'

type Git = {
  repo?: boolean
  branch?: string
  head?: string | null
  status?: string
  log?: string
  throwAll?: boolean
}

function boot(on: On, store: Record<string, unknown> = {}, git: { current: Git } = { current: {} }) {
  const seen = { argvs: [] as string[][], invalidated: [] as string[] }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', (_, e) => {
    seen.invalidated.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'base', text: 'base', scope: 'shared' }] }))
  on('process.run', (_, e) => {
    seen.argvs.push([...e.argv])
    const g = git.current
    const a = e.argv.join(' ')
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (g.throwAll && e.argv[0] === 'git') throw new Error('spawn failed')
    if (a === 'git rev-parse --is-inside-work-tree') return g.repo === false ? out('', 128) : out('true\n')
    if (a === 'git branch --show-current') return out((g.branch ?? 'main') + '\n')
    if (a === 'git rev-parse --short HEAD') return g.head === null ? out('', 128) : out((g.head ?? 'abc1234') + '\n')
    if (a === 'git status --porcelain') return out(g.status ?? '')
    if (a === 'git log -5 --pretty=format:%s') return out(g.log ?? '')
    return out('')
  })
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const compose = ($: any) =>
  $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] }) as Promise<{
    sections: { id: string; text: string; scope: string }[]
  }>
const section = async ($: any) => (await compose($)).sections.find(s => s.id === ID)
const turn = ($: any, extra: Record<string, unknown> = {}) => $.turn.start({ text: 'go', turnId: 't' + Math.random(), ...extra })

test('a clean repository: branch, clean tree and recent commits at session start', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { branch: 'feature/x', log: 'fix: a\nfeat: b\n' } })
  await start($)
  const s = await section($)
  expect(s?.scope).toBe('session')
  expect(s?.text).toBe('# Git context\nBranch: feature/x\nWorking tree: clean\nRecent commits:\n  - fix: a\n  - feat: b')
  // the base section stays
  expect((await compose($)).sections[0]?.id).toBe('base')
})

test('modified, staged and untracked files are counted and listed', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { status: ' M a.ts\nA  b.ts\n?? c.ts\n' } })
  await start($)
  const text = (await section($))?.text ?? ''
  expect(text).toContain('Working tree: 2 modified/staged, 1 untracked')
  expect(text).toContain('Changed paths (first 3 of 3):\n  M a.ts\n  A  b.ts\n  ?? c.ts')
})

test('at most 15 paths are listed and the text is capped at 3500 characters', { timeoutMs: 30000 }, async ($, on) => {
  const status = Array.from({ length: 40 }, (_, i) => ` M file${i}.ts`).join('\n')
  boot(on, {}, { current: { status } })
  await start($)
  const text = (await section($))?.text ?? ''
  expect(text).toContain('Changed paths (first 15 of 40):')
  expect(text).toContain('file14.ts')
  expect(text).not.toContain('file15.ts')

})

test('the text is capped at 3500 characters', { timeoutMs: 30000 }, async ($, on) => {
  const log = Array.from({ length: 5 }, (_, i) => `${i}`.repeat(1200)).join('\n')
  boot(on, {}, { current: { log } })
  await start($)
  expect((await section($))?.text).toHaveLength(3500)
})

test('a detached head shows the short hash; no commits yet says so', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { branch: '', head: 'deadbee' } })
  await start($)
  expect((await section($))?.text).toContain('Branch: (detached at deadbee)')
})

test('a repository with no commits yet', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { branch: '', head: null } })
  await start($)
  expect((await section($))?.text).toContain('Branch: (no commits yet)')
})

test('not a repository: no section', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { repo: false } })
  await start($)
  expect(await section($)).toBeUndefined()
})

test('git failing to spawn adds no section and breaks nothing', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { current: { throwAll: true } })
  await start($)
  expect(await section($)).toBeUndefined()
})

test('each turn refreshes the info and redraws the prompt only when it changed', { timeoutMs: 30000 }, async ($, on) => {
  const git = { current: { branch: 'main' } as Git }
  const seen = boot(on, {}, git)
  await start($)
  seen.invalidated.length = 0
  await turn($)
  expect(seen.invalidated.filter(s => s.includes('prompt.section'))).toHaveLength(0)

  git.current = { branch: 'other', status: '?? new.txt' }
  await turn($)
  expect(seen.invalidated.filter(s => s.includes('prompt.section'))).toHaveLength(1)
  const text = (await section($))?.text ?? ''
  expect(text).toContain('Branch: other')
  expect(text).toContain('Working tree: 0 modified/staged, 1 untracked')
})

test('a subagent turn does not refresh', { timeoutMs: 30000 }, async ($, on) => {
  const git = { current: { branch: 'main' } as Git }
  const seen = boot(on, {}, git)
  await start($)
  const logs = () => seen.argvs.filter(a => a.join(' ') === 'git log -5 --pretty=format:%s').length
  const before = logs()
  expect(before).toBeGreaterThan(0)
  await turn($, { agentId: 'a1' })
  expect(logs()).toBe(before)
  await turn($)
  expect(logs()).toBe(before + 1)
})

test('the section is replaced, not duplicated', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  await compose($)
  expect((await compose($)).sections.filter(s => s.id === ID)).toHaveLength(1)
})

test('off switch: no git calls, no section, turns do nothing', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { 'git-context': false } })
  await start($)
  await turn($)
  expect(seen.argvs.filter(a => a.join(' ') === 'git log -5 --pretty=format:%s')).toHaveLength(0)
  expect(await section($)).toBeUndefined()
})
