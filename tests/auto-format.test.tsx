import { expect, mock, test } from 'claude-code/testing'

type Run = { argv: string[]; cwd?: string }
type Ctx = {
  toasts: string[]
  runs: Run[]
  existing: Set<string>
  /** argv[0] (or the program after `cmd /c`) -> how the run ends */
  outcome: Record<string, { exitCode?: number; throws?: boolean }>
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
    ctx.runs.push({ argv, cwd: e.init?.cwd })
    const o = ctx.outcome[key]!
    if (o.throws) throw new Error(`spawn ${key} ENOENT`)
    return { value: { ...none, exitCode: o.exitCode ?? 0 } }
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
  return hits.map((h: any) => String(h.text)).filter((x: string) => /Formatted|עוצב/.test(x))
}

test('prettier.cmd present: it runs through cmd /c on the edited file and a toast says so', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r.result?.ok).toBe('ran')
  expect(ctx.runs.length).toBe(1)
  expect(ctx.runs[0]!.argv).toEqual(['cmd', '/c', `${CWD}/node_modules/.bin/prettier.cmd`, '--write', '--log-level', 'warn', 'C:/tmp/project/src/app.ts'])
  expect(ctx.runs[0]!.cwd).toBe(CWD)
  expect(await shown($)).toEqual(['Formatted: app.ts'])
})

test('a plain prettier binary runs directly, no cmd', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier`)
  ctx.outcome['prettier'] = { exitCode: 0 }
  await start($, ctx)
  await write($, 'C:/tmp/project/styles/site.css')
  expect(ctx.runs[0]!.argv[0]).toBe(`${CWD}/node_modules/.bin/prettier`)
  expect(await shown($)).toEqual(['Formatted: site.css'])
})

test('every prettier extension is formatted', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  for (const ext of ['js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'md', 'yaml', 'yml', 'html', 'vue', 'svelte']) {
    ctx.runs.length = 0
    await edit($, `C:/tmp/project/f.${ext}`)
    expect(ctx.runs.length).toBe(1)
  }
})

test('prettier missing from the project: nothing runs, no toast, result unchanged', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  ctx.outcome['prettier'] = { exitCode: 0 }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r).toEqual({ result: { ok: 'ran' } })
  expect(ctx.runs).toEqual([])
  expect(await shown($)).toEqual([])
})

test('a formatter that fails (non-zero exit) gives no toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 2 }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/src/broken.ts')
  expect(r.result?.ok).toBe('ran')
  expect(ctx.runs.length).toBe(1)
  expect(await shown($)).toEqual([])
})

test('the toast shows once; later formats are silent', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/a.ts')
  await edit($, 'C:/tmp/project/b.ts')
  await edit($, 'C:/tmp/project/c.ts')
  expect(ctx.runs.length).toBe(3)
  expect(await shown($)).toEqual(['Formatted: a.ts'])
})

test('a Windows backslash path shows only the file name in the toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:\\tmp\\project\\src\\deep\\widget.tsx')
  expect(await shown($)).toEqual(['Formatted: widget.tsx'])
})

test('python: ruff is tried first, black when ruff is not installed', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['ruff'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/app.py')
  expect(ctx.runs.map(r => r.argv).filter(a => a[1] !== 'check')).toEqual([['ruff', 'format', 'C:/tmp/project/app.py']])
  expect(await shown($)).toEqual(['Formatted: app.py'])

  ctx.runs.length = 0
  ctx.outcome['ruff'] = { throws: true }
  ctx.outcome['black'] = { exitCode: 0 }
  await edit($, 'C:/tmp/project/other.py')
  expect(ctx.runs.map(r => r.argv).filter(a => a[1] !== 'check')).toEqual([['ruff', 'format', 'C:/tmp/project/other.py'], ['black', '-q', 'C:/tmp/project/other.py']])
})

test('python: neither formatter installed is silent', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['ruff'] = { throws: true }
  ctx.outcome['black'] = { throws: true }
  await start($, ctx)
  const r = await edit($, 'C:/tmp/project/app.py')
  expect(r.result?.ok).toBe('ran')
  expect(await shown($)).toEqual([])
})

test('go and rust use gofmt and rustfmt; a missing one is swallowed', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.outcome['gofmt'] = { exitCode: 0 }
  ctx.outcome['rustfmt'] = { throws: true }
  await start($, ctx)
  await edit($, 'C:/tmp/project/main.go')
  expect(ctx.runs.map(r => r.argv)).toEqual([['gofmt', '-w', 'C:/tmp/project/main.go']])
  expect(await shown($)).toEqual(['Formatted: main.go'])
  const r = await edit($, 'C:/tmp/project/lib.rs')
  expect(r.result?.ok).toBe('ran')
})

test('files with no formatter (txt, ipynb) run nothing', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/notes.txt')
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/a.ipynb', new_source: 'x' })
  expect(ctx.runs).toEqual([])
})

test('a denied or errored edit is not formatted', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  ctx.toolReply = { isError: true, result: 'old_string not found', text: 'old_string not found' }
  const r = await edit($, 'C:/tmp/project/src/app.ts')
  expect(r.isError).toBe(true)
  expect(ctx.runs).toEqual([])
})

test('Hebrew toast', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { language: 'he' })
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/src/app.ts')
  expect(await shown($)).toEqual(['עוצב: app.ts'])
})

test('off switch: nothing runs', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'auto-format': false } })
  ctx.existing.add(`${CWD}/node_modules/.bin/prettier.cmd`)
  ctx.outcome['prettier.cmd'] = { exitCode: 0 }
  await start($, ctx)
  await edit($, 'C:/tmp/project/src/app.ts')
  expect(ctx.runs).toEqual([])
  expect(await shown($)).toEqual([])
})
