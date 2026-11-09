import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'diff-review',
  props: { title: 'Review', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature diff-review failed/
/** The engine hands the plugin Windows paths with backslashes; the fake disk is keyed by forward slashes. */
const k = (p: string) => p.split('\\').join('/')
/** A path as it appears in the pane's button keys (the surface keeps forward slashes). */
const w = (p: string) => p
const A = 'C:/p/src/a.ts'
const B = 'C:/p/src/b.ts'

function boot(on: any, files: Record<string, string> = {}, store: Record<string, unknown> = {}) {
  refusal = null
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const fs = new Map<string, string>(Object.entries(files))
  const seen = {
    commands: [] as string[],
    toasts: [] as string[],
    opened: [] as { id: string; title: string }[],
    writes: [] as { path: string; text: string }[],
  }
  const plan = {
    /** Runs inside the tool, as the edit's effect on disk. */
    effect: null as null | (() => void),
    fail: false,
    size: new Map<string, number>(),
    kind: 'file' as 'file' | 'dir',
    failWrite: false,
  }
  on('command.register', (_: any, e: any) => {
    if (refusal !== null && refusal.name === e.name) {
      if (refusal.how === 'throw') throw new Error('taken')
      return { deny: 'taken' }
    }
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    seen.opened.push({ id: e.id, title: e.title })
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.exists', (_: any, e: any) => ({ value: fs.has(k(e.path)) }))
  on('fs.stat', (_: any, e: any) => ({
    value: { kind: plan.kind, size: plan.size.get(k(e.path)) ?? (fs.get(k(e.path)) ?? '').length, mtimeMs: 0, isLink: false },
  }))
  on('fs.read', (_: any, e: any) => ({ value: fs.get(k(e.path)) ?? '' }))
  on('fs.write', (_: any, e: any) => {
    if (plan.failWrite) throw new Error('disk full')
    seen.writes.push({ path: k(e.path), text: e.text })
    fs.set(k(e.path), e.text)
    return { value: undefined }
  })
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/p' }))
  on('session.surfaces', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => {
    if (plan.effect !== null) plan.effect()
    return plan.fail ? { isError: true, result: 'boom' } : { result: {} }
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, plan, fs }
}

const start = ($: any) => $.session.start({ cwd: 'C:/p', surface: 'desktop', isInteractive: true })
const finish = ($: any, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', ...extra })

/** An edit of `path` whose effect on disk is `content`. */
async function edit($: any, plan: any, fs: Map<string, string>, path: string, content: string, tool: 'Edit' | 'Write' | 'NotebookEdit' = 'Edit', extra: Record<string, unknown> = {}) {
  plan.effect = () => fs.set(path, content)
  const call =
    tool === 'Write'
      ? { tool: 'Write', file_path: path, content }
      : tool === 'NotebookEdit'
        ? { tool: 'NotebookEdit', notebook_path: path, new_source: content }
        : { tool: 'Edit', file_path: path, old_string: 'x', new_string: 'y' }
  const r = await $.tool.call({ ...call, ...extra } as any)
  plan.effect = null
  return r
}

async function texts(ui: any): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
}

/** Everything Toolkitty noticed, as the notices pane shows it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const out = (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
  await ui.unmount()
  return out
}

const EMPTY = ['›', 'Review', 'No changes to review from the last turn.', 'After a turn that edits files, they are listed here to keep or revert.']

async function openPane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  return $.ui.mount({ ...PANE, surface })
}

const keysOf = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string)

test('loads and registers /diff-review; /diff-review opens the pane; the pane starts empty', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('diff-review')
  const r = await $.command.run({ command: 'diff-review', args: '' })
  expect(r.text).toBe('Review pane opened.')
  expect(seen.opened).toContainEqual({ id: 'diff-review', title: 'Review' })
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
  expect((await $.command.run({ command: 'diff-review', args: 'junk' })).text).toBe('Review pane opened.')
})

test('an Edit of an existing file lists +added -removed and toasts one file changed', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'a\nb\nc' })
  await start($)
  await edit($, plan, fs, A, 'a\nB\nc\nd')
  await finish($)
  expect(await noticeTexts($)).toContain('✎ 1 file changed · /diff-review')
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('+2')
  expect(out).toContain('−1')
  expect(out).toContain('a.ts')
  expect(out).not.toContain('(new)')
  expect(await keysOf(ui)).toEqual(['revert-all', `revert-${w(A)}`, `keep-${w(A)}`])
  await ui.unmount()
})

test('a Write that creates a file is marked new, and reverting it empties it', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on)
  await start($)
  await edit($, plan, fs, B, 'x\ny', 'Write')
  await finish($)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('+2')
  expect(out).toContain('−0')
  expect(out).toContain('(new)')
  await ui.press({ key: `revert-${w(B)}` })
  expect(seen.writes).toEqual([{ path: B, text: '' }])
  // the revert notice is direct feedback (immediate): never dropped by the info cooldown
  expect(await noticeTexts($)).toContain('Reverted: b.ts')
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('revert writes the exact content from before the turn; the first snapshot wins over later edits', SLOW, async ($, on) => {
  const original = 'line1\r\nline2\n\nline4 ünï\n'
  const { plan, fs, seen } = boot(on, { [A]: original })
  await start($)
  await edit($, plan, fs, A, 'first change')
  await edit($, plan, fs, A, 'second change', 'Write')
  await finish($)
  const ui = await openPane($)
  await ui.press({ key: `revert-${w(A)}` })
  expect(seen.writes).toEqual([{ path: A, text: original }])
  expect(fs.get(A)).toBe(original)
  await ui.unmount()
})

test('keep drops the row without touching the file; revert-all writes every file back and toasts the count', SLOW, async ($, on) => {
  const C = 'C:/p/src/c.ts'
  const { plan, fs, seen } = boot(on, { [A]: 'a1', [B]: 'b1', [C]: 'c1' })
  await start($)
  await edit($, plan, fs, A, 'a2')
  await edit($, plan, fs, B, 'b2')
  await edit($, plan, fs, C, 'c2')
  await finish($)
  expect(await noticeTexts($)).toContain('✎ 3 files changed · /diff-review')
  const ui = await openPane($)
  expect(await keysOf(ui)).toEqual(['revert-all', `revert-${w(A)}`, `keep-${w(A)}`, `revert-${w(B)}`, `keep-${w(B)}`, `revert-${w(C)}`, `keep-${w(C)}`])

  await ui.press({ key: `keep-${w(B)}` })
  expect(seen.writes).toHaveLength(0)
  expect(await keysOf(ui)).toEqual(['revert-all', `revert-${w(A)}`, `keep-${w(A)}`, `revert-${w(C)}`, `keep-${w(C)}`])
  expect(fs.get(B)).toBe('b2')

  await ui.press({ key: 'revert-all' })
  expect(seen.writes).toEqual([
    { path: A, text: 'a1' },
    { path: C, text: 'c1' },
  ])
  // immediate feedback: shown despite the cooldown started by "3 files changed"
  expect(await noticeTexts($)).toContain('Reverted 2 files')
  expect(fs.get(B)).toBe('b2')
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('an edit that did not change the content, an errored edit and a subagent edit list nothing', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'same', [B]: 'bee', 'C:/p/c.ts': 'cee' })
  await start($)
  await edit($, plan, fs, A, 'same')
  plan.fail = true
  await edit($, plan, fs, B, 'changed but the tool failed')
  plan.fail = false
  await edit($, plan, fs, 'C:/p/c.ts', 'sub change', 'Edit', { agentId: 'ag1' })
  await finish($)
  expect((await noticeTexts($)).filter(x => x.startsWith('✎'))).toEqual([])
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('a file over 1 MB and a directory are never snapshotted', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'small', [B]: 'big' })
  await start($)
  plan.size.set(B, 2 * 1024 * 1024)
  await edit($, plan, fs, B, 'big2')
  plan.kind = 'dir'
  await edit($, plan, fs, A, 'small2')
  plan.kind = 'file'
  await finish($)
  expect((await noticeTexts($)).filter(x => x.startsWith('✎'))).toEqual([])
  expect(seen.writes).toHaveLength(0)
})

test('a file deleted by the edit counts all its lines as removed', SLOW, async ($, on) => {
  const { plan, fs } = boot(on, { [A]: 'one\ntwo\nthree' })
  await start($)
  plan.effect = () => fs.delete(A)
  await $.tool.call({ tool: 'Edit', file_path: A, old_string: 'x', new_string: 'y' })
  plan.effect = null
  await finish($)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('+0')
  expect(out).toContain('−3')
  await ui.unmount()
})

test('a NotebookEdit is tracked through its notebook path', SLOW, async ($, on) => {
  const nb = 'C:/p/n.ipynb'
  const { plan, fs } = boot(on, { [nb]: '{}' })
  await start($)
  await edit($, plan, fs, nb, '{"cells":[]}', 'NotebookEdit')
  await finish($)
  const ui = await openPane($)
  expect(await texts(ui)).toContain('n.ipynb')
  await ui.unmount()
})

test('the review is kept until a later turn changes files, which replaces it', SLOW, async ($, on) => {
  const { plan, fs } = boot(on, { [A]: 'a1', [B]: 'b1' })
  await start($)
  await edit($, plan, fs, A, 'a2')
  await finish($)
  // a turn with no edits keeps the previous review
  await finish($)
  let ui = await openPane($)
  expect(await keysOf(ui)).toContain(`revert-${w(A)}`)
  await ui.unmount()
  // a turn that changes another file replaces it
  await edit($, plan, fs, B, 'b2')
  await finish($)
  ui = await openPane($)
  const keys = await keysOf(ui)
  expect(keys).toContain(`revert-${w(B)}`)
  expect(keys).not.toContain(`revert-${w(A)}`)
  await ui.unmount()
})

test('at most 40 files are listed from one turn', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on)
  await start($)
  for (let i = 0; i < 45; i++) await edit($, plan, fs, `C:/p/f${i}.ts`, `content ${i}`, 'Write')
  await finish($)
  expect(await noticeTexts($)).toContain('✎ 40 files changed · /diff-review')
})

test('the pane draws on the terminal and its buttons work there', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'a1' })
  await start($)
  await edit($, plan, fs, A, 'a2\na3')
  await finish($)
  const ui = await openPane($, 'terminal')
  expect(await texts(ui)).toContain('+2')
  await ui.press({ key: 'revert-all' })
  expect(seen.writes).toEqual([{ path: A, text: 'a1' }])
  await ui.unmount()
})

test('off switch: nothing is snapshotted or listed, the command and the pane say so', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'a1' }, { enabled: { 'diff-review': false } })
  await start($)
  const r = await edit($, plan, fs, A, 'a2')
  expect(r.deny).toBeUndefined()
  await finish($)
  expect((await noticeTexts($)).filter(x => x.startsWith('✎'))).toEqual([])
  expect((await $.command.run({ command: 'diff-review', args: '' })).text).toBe('Diff review is turned off in the Toolkitty pane.')
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(['Diff review is turned off.'])
  await ui.unmount()
})

test('edits are never denied by the review', SLOW, async ($, on) => {
  const { plan, fs } = boot(on, { [A]: 'a' })
  await start($)
  const r = await edit($, plan, fs, A, 'b')
  expect(r.deny).toBeUndefined()
  expect(r.isError).toBeUndefined()
})

test('Hebrew: command, buttons, labels and toasts are in Hebrew', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'a1' }, { language: 'he' })
  await start($)
  expect((await $.command.run({ command: 'diff-review', args: '' })).text).toBe('חלונית הסקירה נפתחה.')
  await edit($, plan, fs, A, 'a2')
  await edit($, plan, fs, B, 'new', 'Write')
  await finish($)
  expect((await noticeTexts($)).some(x => x.startsWith('✎') && /[א-ת]/.test(x))).toBe(true)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('(חדש)')
  const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => b.props['label'])
  expect(labels).toEqual(['שחזר הכול', 'שחזר', 'השאר', 'שחזר', 'השאר'])
  await ui.press({ key: `revert-${w(A)}` })
  // immediate feedback: shown despite the cooldown the files-changed notice started
  expect(await noticeTexts($)).toContain('שוחזר: a.ts')
  await ui.unmount()
})

test('a revert whose write is refused keeps the row and toasts that it could not revert', SLOW, async ($, on) => {
  const { plan, fs, seen } = boot(on, { [A]: 'a1' })
  await start($)
  await edit($, plan, fs, A, 'a2')
  await finish($)
  const ui = await openPane($)
  plan.failWrite = true
  await ui.press({ key: `revert-${w(A)}` })
  plan.failWrite = false
  expect(await noticeTexts($)).toContain('Could not revert: a.ts')
  expect(await keysOf(ui)).toContain(`revert-${w(A)}`)
  await ui.unmount()
})

test('the pane header: the file count as status and Revert all as its action, ahead of the per-file buttons', SLOW, async ($, on) => {
  const { plan, fs } = boot(on, { [A]: 'a\nb\nc' })
  await start($)
  await edit($, plan, fs, A, 'a\nB\nc\nd')
  await finish($)
  const ui = await openPane($)
  expect((await texts(ui)).slice(0, 3)).toEqual(['›', 'Review', '1 files'])
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons[0].key).toBe('revert-all')
  expect(buttons[0].props['label']).toBe('revert all')
  await ui.unmount()
})

/** The harness' command.register answer refuses this name (the engine: a built-in or another plugin owns it). */
let refusal: { name: string; how: 'deny' | 'throw' } | null = null

test('renamed: /review is no longer registered, /diff-review is', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('diff-review')
  expect(seen.commands).not.toContain('review')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /diff-review registration (${how}) warns and the rest of session start still runs`, SLOW, async ($, on) => {
    const { seen } = boot(on)
    refusal = { name: 'diff-review', how }
    await start($)
    expect(seen.commands).not.toContain('diff-review')
    expect(seen.commands.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /diff-review could not be registered: '))).toBe(true)
    expect((await $.command.run({ command: 'diff-review', args: '' })).text).toBe('Review pane opened.')
  })
}
