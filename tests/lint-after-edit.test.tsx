import { expect, mock, test } from 'claude-code/testing'

type Out = { exitCode?: number; stdout?: string; stderr?: string; throws?: boolean }
type Ctx = {
  toasts: string[]
  runs: string[][]
  existing: Set<string>
  outcome: Record<string, Out>
  toolReply: any
}

const CWD = 'C:/tmp/project'

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
    ctx.runs.push(argv)
    const o = ctx.outcome[key]!
    if (o.throws) throw new Error(`spawn ${key} ENOENT`)
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

const ESLINT = `${CWD}/node_modules/.bin/eslint.cmd`

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
  return hits.map((h: any) => String(h.text)).filter((x: string) => /Lint run failed|הרצת הלינט/.test(x))
}

test('ESLint problems are handed to the model as context, the result kept', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: "C:/tmp/project/src/app.ts:3:7: 'x' is assigned a value but never used. [Error/no-unused-vars]\n1 problem", stderr: '' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r.result?.ok).toBe('ran')
  expect(r.context).toEqual([
    "ESLint:\nC:/tmp/project/src/app.ts:3:7: 'x' is assigned a value but never used. [Error/no-unused-vars]\n1 problem",
  ])
  expect(ctx.runs[0]!.slice(0, 3)).toEqual(['cmd', '/c', ESLINT])
  expect(ctx.runs[0]!.at(-1)).toBe('C:/tmp/project/src/app.ts')
})

test('Write is linted as well, and stderr is appended to stdout', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'a.js:1:1: bad', stderr: 'warning: deprecated' }
  await start($, ctx)
  const r = await write($, 'C:/tmp/project/a.js')
  expect(r.context).toEqual(['ESLint:\na.js:1:1: bad\nwarning: deprecated'])
})

test('clean code adds no context', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 0 }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs.length).toBe(1)
})

test('only the first 30 lines of a long report are passed on', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  const many = Array.from({ length: 100 }, (_, i) => `a.ts:${i + 1}:1: problem ${i + 1}`).join('\n')
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: many }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.ts')
  const lines: string[] = r.context[0].split('\n')
  expect(lines.length).toBe(31) // "ESLint:" + 30
  expect(lines[1]).toBe('a.ts:1:1: problem 1')
  expect(lines[30]).toBe('a.ts:30:1: problem 30')
})

test('context already on the result is kept and ours is added after it', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'a.ts:1:1: bad' }
  ctx.toolReply = { result: { ok: 'ran' }, context: ['earlier note'] }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.ts')
  expect(r.context[0]).toBe('earlier note')
  expect(r.context[1]).toBe('ESLint:\na.ts:1:1: bad')
})

test('ESLint missing from the project: nothing runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'x' }
  ctx.outcome['eslint'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
})

test('a plain eslint binary runs directly', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/eslint`)
  ctx.outcome['eslint'] = { exitCode: 1, stdout: 'a.ts:1:1: bad' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.tsx')
  expect(ctx.runs[0]![0]).toBe(`${CWD}/node_modules/.bin/eslint`)
  expect(r.context).toEqual(['ESLint:\na.ts:1:1: bad'])
})

test('a lint run that crashes the runner shows the failure toast and keeps the result', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { throws: true }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.ts')
  expect(r.result?.ok).toBe('ran')
  expect(r.context).toBeUndefined()
  expect(await shown($)).toEqual(['Lint run failed'])
})

test('ESLint exiting 2 (no config, crash) is not passed to the model as a problem', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 2, stderr: 'ESLint couldn\'t find an eslint.config.js file.' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.ts')
  expect(r.context).toBeUndefined()
})

test('the ESLint argv does not use the unix formatter (removed in ESLint 9)', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/a.ts')
  expect(ctx.runs[0]!.join(' ')).not.toContain('unix')
})

test('python: ruff problems become context labelled Ruff', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['ruff'] = { exitCode: 1, stdout: 'app.py:1:8: F401 `os` imported but unused' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/app.py')
  expect(ctx.runs.find(a => a[1] === 'check')).toEqual(['ruff', 'check', '--output-format', 'concise', 'C:/tmp/project/app.py'])
  expect(r.context).toEqual(['Ruff:\napp.py:1:8: F401 `os` imported but unused'])
})

test('python: ruff not installed is silent', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['ruff'] = { throws: true }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/app.py')
  expect(r.context).toBeUndefined()
  expect(await shown($)).toEqual([])
})

test('other extensions are not linted', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'x' }
  ctx.outcome['ruff'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  for (const f of ['notes.md', 'main.go', 'style.css', 'data.json']) {
    const r = await edit($, `C:/tmp/project/${f}`)
    expect(r.context).toBeUndefined()
  }
  expect(ctx.runs).toEqual([])
})

test('NotebookEdit and failed edits are not linted', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/a.ipynb', new_source: 'x' })
  ctx.toolReply = { isError: true, result: 'no match', text: 'no match' }
  const r = await edit($, 'C:/tmp/project/a.ts')
  expect(r.isError).toBe(true)
  expect(ctx.runs).toEqual([])
})

test('Hebrew failure toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { language: 'he' })
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { throws: true }
  await start($, ctx)
  await edit($, 'C:/tmp/project/a.ts')
  expect(await shown($)).toEqual(['הרצת הלינט נכשלה'])
})

test('off switch: no lint runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'lint-after-edit': false } })
  ctx.existing.add(ESLINT)
  ctx.outcome['eslint.cmd'] = { exitCode: 1, stdout: 'x' }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/a.ts')
  expect(r.context).toBeUndefined()
  expect(ctx.runs).toEqual([])
})
