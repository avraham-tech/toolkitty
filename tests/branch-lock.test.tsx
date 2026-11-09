import { expect, mock, test } from 'claude-code/testing'

type Ctx = { branch: string | null; exit: number; throws: boolean; cwd: string; clock: any }

async function boot($: any, on: any, store: Record<string, unknown> = {}): Promise<Ctx> {
  const ctx: Ctx = { branch: 'main', exit: 0, throws: false, cwd: 'C:/tmp/project', clock: undefined }
  mock.store(on, { language: 'en', ...store })
  ctx.clock = mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: ctx.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('process.run', (_: any, e: any) => {
    const argv: readonly string[] = e.argv
    const none = { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    if (argv[0] === 'git' && argv[1] === 'rev-parse' && argv[2] === '--abbrev-ref') {
      if (ctx.throws) throw new Error('git is not installed')
      return { value: { ...none, exitCode: ctx.exit, stdout: ctx.branch === null ? '' : ctx.branch + '\n' } }
    }
    return { value: none }
  })
  on('fs.exists', () => ({ value: false }))
  on('tool.call', { tool: 'Edit' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Write' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'NotebookEdit' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Read' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }) as any)
  return ctx
}

const ON = { enabled: { 'branch-lock': true } }
const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const edit = ($: any, file_path = 'C:/tmp/project/src/app.ts') => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as Promise<any>
const write = ($: any, file_path = 'C:/tmp/project/src/new.ts') => $.tool.call({ tool: 'Write', file_path, content: 'x' }) as Promise<any>
const notebook = ($: any) => $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/a.ipynb', new_source: 'x' }) as Promise<any>

test('on main, Edit, Write and NotebookEdit are denied naming the branch', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  await start($)
  for (const call of [edit, write, notebook]) {
    const r = await call($)
    expect(r.deny).toContain('Branch lock')
    expect(r.deny).toContain('you are on the main branch')
    expect(r.deny).toContain('git switch -c <name>')
  }
  expect(ctx.branch).toBe('main')
})

test('on master it is denied too', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.branch = 'master'
  await start($)
  expect((await edit($)).deny).toContain('you are on the master branch')
})

test('on a working branch edits pass through', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  for (const branch of ['feature/login', 'main-fix', 'mainline', 'dev', 'HEAD']) {
    ctx.branch = branch
    await ctx.clock.advance(60_000)
    await start($)
    const r = await edit($)
    expect(r.deny).toBeUndefined()
    expect(r.result?.ok).toBe('ran')
  }
})

test('outside a git repository (non-zero exit) edits pass', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.exit = 128
  ctx.branch = 'main'
  await start($)
  expect((await edit($)).deny).toBeUndefined()
})

test('git failing to run lets the edit through', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.throws = true
  await start($)
  const r = await edit($)
  expect(r.deny).toBeUndefined()
  expect(r.result?.ok).toBe('ran')
})

test('only edits are guarded: Bash and Read pass on main', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, ON)
  await start($)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' }) as any).deny).toBeUndefined()
  expect((await $.tool.call({ tool: 'Read', file_path: 'C:/tmp/project/a.ts' }) as any).deny).toBeUndefined()
})

test('the branch is cached for 10 seconds, then read again', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  await start($)
  expect((await edit($)).deny).toContain('main')
  ctx.branch = 'feature/x'
  await ctx.clock.advance(5_000)
  expect((await edit($)).deny).toContain('main') // still cached
  await ctx.clock.advance(6_000)
  expect((await edit($)).deny).toBeUndefined() // 11 s later: re-read
  ctx.branch = 'main'
  await ctx.clock.advance(11_000)
  expect((await edit($)).deny).toContain('main')
})

test('a different working directory is not served from the cache', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  await start($)
  expect((await edit($)).deny).toContain('main')
  ctx.branch = 'feature/x'
  ctx.cwd = 'C:/tmp/other'
  expect((await edit($)).deny).toBeUndefined()
})

test('Hebrew deny text', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, { ...ON, language: 'he' })
  await start($)
  const r = await edit($)
  expect(r.deny).toContain('נעילת ענף')
  expect(r.deny).toContain('main')
})

test('the feature is off by default: edits on main pass', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  const r = await edit($)
  expect(r.deny).toBeUndefined()
  expect(r.result?.ok).toBe('ran')
})

test('off switch: turned off explicitly, edits on main pass', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, { enabled: { 'branch-lock': false } })
  await start($)
  expect((await edit($)).deny).toBeUndefined()
})

test('a block is reported to Disasters prevented', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on, ON)
  await start($)
  await edit($)
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'incidents',
    props: { title: 'x', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const hits = await ui.findAll({ type: 'Text', text: /branch-lock/ })
  expect(hits.length).toBeGreaterThan(0)
  expect(hits.map((h: any) => h.text).join('\n')).toContain('edit on main')
  await ui.unmount()
})
