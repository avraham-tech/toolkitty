import { expect, mock, test } from 'claude-code/testing'

type Out = { exitCode?: number; stdout?: string; stderr?: string; throws?: boolean }
type Run = { argv: string[]; cwd?: string }
type Ctx = {
  toasts: string[]
  runs: Run[]
  existing: Set<string>
  outcome: Record<string, Out>
  toolReply: any
}

const CWD = 'C:/tmp/project'
const ON = { enabled: { 'test-on-change': true } }

async function boot($: any, on: any, store: Record<string, unknown> = {}): Promise<Ctx> {
  const ctx: Ctx = { toasts: [], runs: [], existing: new Set(), outcome: {}, toolReply: { result: { ok: 'ran' } } }
  mock.store(on, { language: 'en', ...store })
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_: any, e: any) => {
    ctx.toasts.push(typeof e === 'string' ? e : (e.text ?? e.message ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('fs.exists', (_: any, e: any) => ({ value: ctx.existing.has(String(e.path).replace(/\\/g, '/')) }))
  on('process.run', (_: any, e: any) => {
    const argv: string[] = [...e.argv]
    const none = { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    const program = argv[0] === 'cmd' ? (argv[2] ?? '') : (argv[0] ?? '')
    const key = program.replace(/\\/g, '/').split('/').pop() ?? program
    if (!(key in ctx.outcome)) return { value: none }
    ctx.runs.push({ argv, cwd: e.init?.cwd })
    const o = ctx.outcome[key]!
    if (o.throws) throw new Error(`timed out ${key}`)
    return { value: { ...none, exitCode: o.exitCode ?? 0, stdout: o.stdout ?? '', stderr: o.stderr ?? '' } }
  })
  for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Read']) on('tool.call', { tool }, () => ctx.toolReply)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }) as any)
  return ctx
}

const start = async ($: any, ctx: Ctx) => {
  await $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
  ctx.toasts.length = 0
}
const edit = ($: any, file_path: string) => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as Promise<any>
const write = ($: any, file_path: string) => $.tool.call({ tool: 'Write', file_path, content: 'x' }) as Promise<any>

const VITEST = `${CWD}/node_modules/.bin/vitest.cmd`
const JEST = `${CWD}/node_modules/.bin/jest.cmd`

/** Notices are the new toasts: read them back through the notices pane. */
async function shown($: any): Promise<string[]> {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'x', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const hits = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return hits.map((h: any) => String(h.text)).filter((x: string) => /Tests failed|Running the tests|util\.ts|mod\.py/.test(x))
}

test('a failing sibling test: toast and the tail of the output go to the model', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  const stdout = Array.from({ length: 40 }, (_, i) => `out ${i + 1}`).join('\n')
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout, stderr: 'AssertionError: expected 1 to be 2' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.result?.ok).toBe('ran')
  expect(ctx.runs.length).toBe(1)
  expect(ctx.runs[0]!.argv).toEqual(['cmd', '/c', VITEST, 'run', 'C:/tmp/project/src/util.test.ts'])
  expect(ctx.runs[0]!.cwd).toBe(CWD)
  expect(await shown($)).toEqual(['Tests failed: util.ts'])
  expect(r.context.length).toBe(1)
  const ctxLines: string[] = r.context[0].split('\n')
  expect(ctxLines[0]).toBe('Tests failed after editing util.ts:')
  expect(ctxLines.length).toBe(1 + 20) // header + last 20 lines
  expect(ctxLines.at(-1)).toBe('AssertionError: expected 1 to be 2')
  expect(ctxLines[1]).toBe('out 22') // 41 lines of output (40 + stderr) -> last 20 start at 22
})

test('passing tests add nothing and raise no toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 0, stdout: 'all good' }
  await start($, ctx)
  const r = await write($, 'C:/tmp/project/src/util.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs.length).toBe(1)
  expect(await shown($)).toEqual([])
})

test('spec files and __tests__ are found as well', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/a.spec.ts')
  ctx.existing.add('C:/tmp/project/src/__tests__/b.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/src/a.ts')
  await edit($, 'C:/tmp/project/src/b.ts')
  expect(ctx.runs.map(r => r.argv.at(-1))).toEqual(['C:/tmp/project/src/a.spec.ts', 'C:/tmp/project/src/__tests__/b.ts'])
})

test('jest is used when vitest is absent', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(JEST)
  ctx.outcome['jest.cmd'] = { exitCode: 1, stdout: 'FAIL src/util.test.ts' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(ctx.runs[0]!.argv).toEqual(['cmd', '/c', JEST, 'C:/tmp/project/src/util.test.ts'])
  expect(r.context[0]).toContain('FAIL src/util.test.ts')
})

test('no sibling test file: nothing runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/lonely.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
})

test('editing a test file itself does not run it', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  for (const f of ['src/util.test.ts', 'src/util.spec.ts', 'pkg/test_mod.py', 'pkg/mod_test.go']) ctx.existing.add(`C:/tmp/project/${f}`)
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  ctx.outcome['python'] = { exitCode: 1, stdout: 'x' }
  ctx.outcome['go'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  for (const f of ['src/util.test.ts', 'src/util.spec.ts', 'pkg/test_mod.py', 'pkg/mod_test.go']) {
    const r = await edit($, `C:/tmp/project/${f}`)
    expect(r.context).toBeUndefined()
  }
  expect(ctx.runs).toEqual([])
})

test('a test file but no runner installed: silent', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
  expect(await shown($)).toEqual([])
})

test('python: pytest runs the test_ file; a failure is reported', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/pkg/test_mod.py')
  ctx.outcome['python'] = { exitCode: 1, stdout: '1 failed', stderr: '' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/pkg/mod.py')
  expect(ctx.runs[0]!.argv).toEqual(['python', '-m', 'pytest', '-q', 'C:/tmp/project/pkg/test_mod.py'])
  expect(await shown($)).toEqual(['Tests failed: mod.py'])
  expect(r.context[0]).toContain('Tests failed after editing mod.py:')
  expect(r.context[0]).toContain('1 failed')
})

test('go: go test runs in the package directory', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/pkg/mod_test.go')
  ctx.outcome['go'] = { exitCode: 1, stdout: '--- FAIL: TestMod' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/pkg/mod.go')
  expect(ctx.runs[0]!.argv).toEqual(['go', 'test', '.'])
  expect(ctx.runs[0]!.cwd).toBe('C:/tmp/project/pkg')
  expect(r.context[0]).toContain('--- FAIL: TestMod')
})

test('a Windows backslash path finds the test and names the file', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'FAIL' }
  await start($, ctx)
  await edit($, 'C:\\tmp\\project\\src\\util.ts')
  expect(await shown($)).toEqual(['Tests failed: util.ts'])
})

test('a runner that cannot run (timeout/crash) shows the failure toast and keeps the result', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { throws: true }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.result?.ok).toBe('ran')
  expect(r.context).toBeUndefined()
  expect(await shown($)).toEqual(['Running the tests failed or took longer than 60 seconds'])
})

test('a denied or errored edit does not run tests; NotebookEdit neither', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, ON)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/src/util.ipynb', new_source: 'x' })
  ctx.toolReply = { isError: true, result: 'no match', text: 'no match' }
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.isError).toBe(true)
  expect(ctx.runs).toEqual([])
})

test('Hebrew toast and context', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { ...ON, language: 'he' })
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'FAIL' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  const notes = await shown($)
  expect(notes.length).toBe(1)
  expect(notes[0]).toContain('util.ts')
  expect(notes[0]).not.toContain('Tests failed')
  expect(r.context[0]).not.toContain('Tests failed')
})

test('off by default: nothing runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
})

test('off switch: explicitly off, nothing runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'test-on-change': false } })
  ctx.existing.add('C:/tmp/project/src/util.test.ts')
  ctx.existing.add(VITEST)
  ctx.outcome['vitest.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/util.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
})
