import { expect, mock, test } from 'claude-code/testing'

type Ctx = {
  registered: Array<{ name: string; description?: string; argumentHint?: string }>
  files: Map<string, string>
  writes: Array<{ path: string; text: string }>
  failWrite: Set<string>
  clock: any
}

const CWD = 'C:/tmp/project'
const norm = (p: string) => String(p).replace(/\\/g, '/')

async function boot($: any, on: any, store: Record<string, unknown> = {}): Promise<Ctx> {
  refusal = null
  const ctx: Ctx = { registered: [], files: new Map(), writes: [], failWrite: new Set(), clock: undefined }
  mock.store(on, { language: 'en', ...store })
  ctx.clock = mock.clock(on, { now: Date.UTC(2026, 10, 8, 12, 0, 0) })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_: any, e: any) => {
    if (refusal !== null && refusal.name === e.name) {
      if (refusal.how === 'throw') throw new Error('taken')
      return { deny: 'taken' }
    }
    ctx.registered.push({ name: e.name, description: e.description, argumentHint: e.argumentHint })
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', (_: any, e: any) => ({ value: ctx.files.has(norm(e.path)) }))
  on('fs.stat', (_: any, e: any) => {
    const text = ctx.files.get(norm(e.path))
    if (text === undefined) throw new Error('ENOENT')
    return { value: { kind: 'file', size: text.length, mtimeMs: 0, isLink: false } }
  })
  on('fs.read', (_: any, e: any) => {
    const text = ctx.files.get(norm(e.path))
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', (_: any, e: any) => {
    if (ctx.failWrite.has(norm(e.path))) throw new Error('EACCES')
    ctx.writes.push({ path: norm(e.path), text: e.text })
    ctx.files.set(norm(e.path), e.text)
    return { value: undefined }
  })
  // The tools themselves: Edit replaces text in the in-memory file, Write replaces the whole file.
  on('tool.call', { tool: 'Edit' }, (_: any, e: any) => {
    const p = norm(e.file_path)
    const cur = ctx.files.get(p) ?? ''
    ctx.files.set(p, cur.replace(e.old_string, e.new_string))
    return { result: { ok: 'ran' } } as any
  })
  on('tool.call', { tool: 'Write' }, (_: any, e: any) => {
    ctx.files.set(norm(e.file_path), e.content)
    return { result: { ok: 'ran' } } as any
  })
  on('tool.call', { tool: 'NotebookEdit' }, () => ({ result: { ok: 'ran' } }) as any)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }) as any)
  return ctx
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const edit = ($: any, file_path: string, old_string: string, new_string: string) => $.tool.call({ tool: 'Edit', file_path, old_string, new_string }) as Promise<any>
const write = ($: any, file_path: string, content: string) => $.tool.call({ tool: 'Write', file_path, content }) as Promise<any>
const undo = async ($: any, args = ''): Promise<string> => ((await $.command.run({ command: 'edit-undo', args })) as any).text

const A = 'C:/tmp/project/src/a.ts'
const B = 'C:/tmp/project/src/b.ts'

test('loads and registers /edit-undo with its argument hint', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  const u = ctx.registered.find(r => r.name === 'edit-undo')
  expect(u).toBeDefined()
  expect(u!.argumentHint).toBe('[list]')
  expect(u!.description).toBe('Restores the last file Claude edited (list: shows the list)')
})

test('nothing edited yet: /edit-undo and /edit-undo list say so', { timeoutMs: 30000 }, async ($, on) => {
  await boot($, on)
  await start($)
  expect(await undo($)).toBe('No edits to restore.')
  expect(await undo($, 'list')).toBe('No edits to restore.')
})

test('/edit-undo restores the file as it was before an Edit', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'const x = 1\n')
  await start($)
  await edit($, A, 'x = 1', 'x = 2')
  expect(ctx.files.get(A)).toBe('const x = 2\n')
  expect(await undo($)).toBe(`Restored: ${A}`)
  expect(ctx.files.get(A)).toBe('const x = 1\n')
  expect(ctx.writes).toEqual([{ path: A, text: 'const x = 1\n' }])
  expect(await undo($)).toBe('No edits to restore.')
})

test('/edit-undo restores the file as it was before a Write', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'old contents')
  await start($)
  await write($, A, 'brand new contents')
  expect(ctx.files.get(A)).toBe('brand new contents')
  await undo($)
  expect(ctx.files.get(A)).toBe('old contents')
})

test('repeated edits unwind newest first, across files', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'a0')
  ctx.files.set(B, 'b0')
  await start($)
  await edit($, A, 'a0', 'a1')
  await edit($, B, 'b0', 'b1')
  await edit($, A, 'a1', 'a2')
  expect(await undo($)).toBe(`Restored: ${A}`)
  expect(ctx.files.get(A)).toBe('a1')
  expect(await undo($)).toBe(`Restored: ${B}`)
  expect(ctx.files.get(B)).toBe('b0')
  expect(await undo($)).toBe(`Restored: ${A}`)
  expect(ctx.files.get(A)).toBe('a0')
  expect(await undo($)).toBe('No edits to restore.')
})

test('/edit-undo list shows newest first, numbered, with path and time', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'a0')
  ctx.files.set(B, 'b0')
  await start($)
  await edit($, A, 'a0', 'a1')
  await ctx.clock.advance(60_000)
  await edit($, B, 'b0', 'b1')
  const text = await undo($, 'list')
  const lines = text.split('\n')
  expect(lines.length).toBe(2)
  expect(lines[0]).toMatch(new RegExp(`^1\\. ${B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(\\d{1,2}[:.]\\d{2}[:.]\\d{2}`))
  expect(lines[1]).toContain(`2. ${A}`)
  // listing does not restore anything
  expect(ctx.files.get(A)).toBe('a1')
  expect(await undo($, '  list  ')).toBe(text)
})

test('a new file (it did not exist) leaves nothing to restore', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  await write($, 'C:/tmp/project/src/created.ts', 'new')
  expect(ctx.files.get('C:/tmp/project/src/created.ts')).toBe('new')
  expect(await undo($)).toBe('No edits to restore.')
})

test('a Windows backslash path is restored to the same path', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set('C:/tmp/project/src/win.ts', 'w0')
  await start($)
  await edit($, 'C:\\tmp\\project\\src\\win.ts', 'w0', 'w1')
  expect(await undo($)).toBe('Restored: C:\\tmp\\project\\src\\win.ts')
  expect(ctx.files.get('C:/tmp/project/src/win.ts')).toBe('w0')
})

test('a failed restore says so and keeps the snapshot for a retry', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'a0')
  await start($)
  await edit($, A, 'a0', 'a1')
  ctx.failWrite.add(A)
  expect(await undo($)).toBe(`Restore failed: ${A}`)
  expect(ctx.files.get(A)).toBe('a1')
  ctx.failWrite.delete(A)
  expect(await undo($)).toBe(`Restored: ${A}`)
  expect(ctx.files.get(A)).toBe('a0')
})

test('only the newest 20 versions are kept', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set(A, 'v0')
  await start($)
  for (let i = 0; i < 25; i++) await edit($, A, `v${i}`, `v${i + 1}`)
  const lines = (await undo($, 'list')).split('\n')
  expect(lines.length).toBe(20)
  // 20 undos reach v5 (the oldest kept); the 21st finds nothing
  for (let i = 0; i < 20; i++) await undo($)
  expect(ctx.files.get(A)).toBe('v5')
  expect(await undo($)).toBe('No edits to restore.')
})

test('a file over 400 KB is not snapshotted', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  const big = 'x'.repeat(400 * 1024 + 1)
  ctx.files.set(A, big)
  ctx.files.set(B, 'small')
  await start($)
  await edit($, A, 'xx', 'yy')
  expect(await undo($)).toBe('No edits to restore.')
  await edit($, B, 'small', 'smaller')
  expect(await undo($)).toBe(`Restored: ${B}`)
})

test('the total kept is capped at 2 MB, oldest dropped first', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  const chunk = 'y'.repeat(390 * 1024)
  for (const n of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) ctx.files.set(`C:/tmp/project/${n}.txt`, chunk)
  await start($)
  for (const n of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) await edit($, `C:/tmp/project/${n}.txt`, 'yy', 'zz')
  const lines = (await undo($, 'list')).split('\n')
  expect(lines.length).toBe(5) // 5 x 390 KB = 1.95 MB <= 2 MB, 6 would be 2.3 MB
  expect(lines[0]).toContain('p7.txt')
  expect(lines[4]).toContain('p3.txt')
})

test('an edit another guard denies is not left on the undo stack', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set('C:/tmp/project/.env', 'KEY=1')
  ctx.files.set(A, 'a0')
  await start($)
  const denied = await edit($, 'C:/tmp/project/.env', 'KEY=1', 'KEY=2')
  expect(denied.deny).toContain('Secret protection')
  expect(ctx.files.get('C:/tmp/project/.env')).toBe('KEY=1')
  expect(await undo($, 'list')).toBe('No edits to restore.')
})

test('NotebookEdit snapshots the notebook path', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  ctx.files.set('C:/tmp/project/n.ipynb', '{"cells":[]}')
  await start($)
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/tmp/project/n.ipynb', new_source: 'print(1)' })
  expect(await undo($, 'list')).toContain('1. C:/tmp/project/n.ipynb')
})

test('Hebrew answers', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { language: 'he' })
  ctx.files.set(A, 'a0')
  await start($)
  expect(await undo($)).toBe('אין עריכות לשחזור.')
  expect(ctx.registered.find(r => r.name === 'edit-undo')!.description).toContain('משחזר')
  await edit($, A, 'a0', 'a1')
  expect(await undo($)).toContain(A)
  expect(await undo($)).not.toContain('Restored')
})

test('off switch: nothing is saved and /edit-undo answers that it is off', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on, { enabled: { 'edit-undo': false } })
  ctx.files.set(A, 'a0')
  await start($)
  await edit($, A, 'a0', 'a1')
  expect(ctx.files.get(A)).toBe('a1')
  expect(await undo($)).toBe('Undo edits is turned off in the Toolkitty pane.')
  expect(await undo($, 'list')).toBe('Undo edits is turned off in the Toolkitty pane.')
  expect(ctx.files.get(A)).toBe('a1')
})

/** The harness' command.register answer refuses this name (the engine: a built-in or another plugin owns it). */
let refusal: { name: string; how: 'deny' | 'throw' } | null = null

/** Everything Toolkitty noticed, as the notices pane draws it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'toolkitty', surface: 'desktop', component: 'Pane', requestId: 'toolkitty-notices', props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

test('renamed: /undo is no longer registered, /edit-undo is', { timeoutMs: 30000 }, async ($, on) => {
  const ctx = await boot($, on)
  await start($)
  const names = ctx.registered.map(r => r.name)
  expect(names).toContain('edit-undo')
  expect(names).not.toContain('undo')
})
for (const how of ['throw', 'deny'] as const) {
  test(`a refused /edit-undo registration (${how}) warns and edits are still saved`, { timeoutMs: 30000 }, async ($, on) => {
    const ctx = await boot($, on)
    ctx.files.set(A, 'const x = 1\n')
    refusal = { name: 'edit-undo', how }
    await start($)
    const names = ctx.registered.map(r => r.name)
    expect(names).not.toContain('edit-undo')
    expect(names.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /edit-undo could not be registered: '))).toBe(true)
    await edit($, A, 'x = 1', 'x = 2')
    expect(await undo($)).toBe(`Restored: ${A}`)
    expect(ctx.files.get(A)).toBe('const x = 1\n')
  })
}
