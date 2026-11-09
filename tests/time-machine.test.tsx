import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const MIN = 60_000
const SLOW = { timeoutMs: 60_000 }
const OWN_FAILURE = /feature time-machine failed/

const DIR = 'C:/work/proj'
const A = `${DIR}/src/a.ts`
const B = `${DIR}/src/b.ts`
const C = `${DIR}/src/c.ts`

type Run = { exitCode: number; stdout: string; stderr: string }
type Rig = {
  files: Map<string, string>
  writes: { path: string; text: string }[]
  commands: string[]
  toasts: string[]
  copies: string[]
  copyOk: boolean
  asks: { question: string; header?: string; options: string[] }[]
  answers: string[]
  runs: string[][]
  run: (argv: string[]) => Run
  bashFails: boolean
  failWriteFor: string | null
  clock: ReturnType<typeof mock.clock>
}

const hh = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function rig(on: any, o: { lang?: string; enabled?: Record<string, boolean> } = {}): Rig {
  const kv = new Map<string, unknown>(Object.entries({ language: o.lang ?? 'en', ...(o.enabled === undefined ? {} : { enabled: o.enabled }) }))
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    kv.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    kv.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...kv.keys()] }))
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:\\Users\\test', TEMP: 'C:/tmp' })
  mock.session(on)

  const r: Rig = {
    files: new Map(),
    writes: [],
    commands: [],
    toasts: [],
    copies: [],
    copyOk: true,
    asks: [],
    answers: [],
    runs: [],
    run: () => ({ exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }),
    bashFails: false,
    failWriteFor: null,
    clock,
  }
  const norm = (p: string): string => p.split(String.fromCharCode(92)).join('/')
  on('fs.write', (_: any, e: any) => {
    const path = norm(e.path)
    if (r.failWriteFor !== null && path === r.failWriteFor) throw new Error('EACCES ' + path)
    if (!path.includes('toolkitty-sessions')) r.writes.push({ path, text: e.text })
    r.files.set(path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    const f = r.files.get(norm(e.path))
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: f }
  })
  on('fs.exists', (_: any, e: any) => ({ value: r.files.has(norm(e.path)) }))
  on('fs.stat', (_: any, e: any) => {
    const f = r.files.get(norm(e.path))
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: { kind: 'file', size: f.length, mtimeMs: T0, isLink: false } }
  })
  on('fs.list', () => ({ value: [] }))
  on('command.register', (_: any, e: any) => {
    r.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    r.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', (_: any, e: any) => {
    r.copies.push(e.text)
    return { value: r.copyOk ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } } as never
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.id', () => ({ value: 'sess-t' }))
  on('session.cwd', () => ({ value: DIR }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200000, percent: 10 }, rateLimits: [] } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('process.run', (_: any, e: any) => {
    r.runs.push(e.argv)
    return { value: { ...r.run(e.argv), isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('prompt.compose', () => ({ sections: [] }))
  on('session.measure', (_: any, e: any) => ({ changed: e.changed }))
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0]
      r.asks.push({ question: q.question, header: q.header, options: q.options.map((x: any) => x.label) })
      const answer = r.answers.shift()
      if (answer === undefined) return { deny: 'dismissed' } as never
      return { result: { questions: e.questions, answers: { [q.question]: answer } } } as never
    }
    if (e.tool === 'Write') {
      r.files.set(norm(e.file_path), e.content)
      return { result: {} } as never
    }
    if (e.tool === 'Edit') {
      const path = norm(e.file_path)
      const cur = r.files.get(path) ?? ''
      r.files.set(path, cur.split(e.old_string).join(e.new_string))
      return { result: {} } as never
    }
    if (e.tool === 'Bash') return (r.bashFails ? { isError: true, result: 'exit 1', text: 'exit 1' } : { result: {} }) as never
    return { result: {} } as never
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return r
}

const PANE = (surface: 'desktop' | 'terminal' = 'desktop', requestId = 'time-machine') =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId,
    surface,
    props: { title: 'Timeline', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const start = ($: any) => $.session.start({ cwd: DIR, surface: 'desktop', isInteractive: true })
let turns = 0

/** One main-loop turn: prompt, start, the body (tool calls), complete; the clock moves a minute first. */
async function turn($: any, r: Rig, prompt: string, body: () => Promise<unknown>): Promise<void> {
  await r.clock.advance(MIN)
  const id = `t${++turns}`
  await $.prompt.submit({ text: prompt })
  await $.turn.start({ text: prompt, turnId: id })
  await body()
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer' })
}

const edit = ($: any, path: string, from: string, to: string, extra: Record<string, unknown> = {}) =>
  $.tool.call({ tool: 'Edit', file_path: path, old_string: from, new_string: to, ...extra })
const write = ($: any, path: string, content: string, extra: Record<string, unknown> = {}) =>
  $.tool.call({ tool: 'Write', file_path: path, content, ...extra })

const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
const rowOf = async (ui: any, id: number): Promise<string> => ((await ui.find({ key: `cp-${id}` }))?.text as string | undefined) ?? ''
const press = async (ui: any, key: string): Promise<string> => {
  await ui.press({ key })
  await ui.redraw()
  return joined(ui)
}
// The real module keeps the evidence log in an engine atom with no test pane of its own; the goal tracker's
// pane (default on) copies it as text: "- ok|FAILED <kind>: <summary>", newest first, the last ten. Other features record diffs too,
// so time-machine's own records are told apart by their summary wording.
async function evidence($: any, r: Rig): Promise<any[]> {
  const ui = await $.ui.mount(PANE('desktop', 'goal-tracker'))
  const before = r.copies.length
  await ui.press({ key: 'goal-report' })
  const text = r.copies.length > before ? r.copies[r.copies.length - 1]! : ''
  await ui.unmount()
  const out: any[] = []
  for (const line of text.split(String.fromCharCode(10))) {
    const m = /^- (ok|FAILED) (\w+): (.*)$/.exec(line)
    if (m !== null) out.push({ ok: m[1] === 'ok', kind: m[2], summary: m[3], feature: /^(restored \d+ files? to |git checkout )/.test(m[3]!) ? 'time-machine' : 'other' })
  }
  return out.reverse()
}

test('loads: registers /timeline, checkpoint 0 is the session start, the pane draws it', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  expect(r.commands).toContain('timeline')
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  const out = await $.command.run({ command: 'timeline', args: '' })
  expect(out.text).toBe('Timeline opened.')

  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Timeline')
  expect(all).toContain('1 checkpoint')
  expect(await rowOf(ui, 0)).toContain(`${hh(T0)} · Session start · 0 files · tests –`)
  for (const label of ['Inspect', 'Compare', 'Restore', 'Git restore', 'Copy']) expect(await ui.find({ type: 'Button', text: label })).toBeDefined()
  // nothing changed yet: the empty state says so
  expect(all).toContain('No file changes in the session yet.')
  await ui.unmount()
})

test('a turn that edits files makes a checkpoint: first-change snapshot, +/- counts, newest first', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'one\ntwo\nthree')
  await start($)
  await turn($, r, 'Rename two to deux and add a new file', async () => {
    await edit($, A, 'two', 'deux')
    await edit($, A, 'three', 'trois') // the second edit of the same file keeps the FIRST snapshot
    await write($, B, 'hello\nworld')
  })
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('2 checkpoints')
  expect(await rowOf(ui, 1)).toContain(`${hh(T0 + MIN)} · Rename two to deux and add a new file · 2 files · tests –`)
  expect(all).toContain('Selected: Rename two to deux and add a new file')
  expect(all).toContain('+2')
  expect(all).toContain('−2')
  expect(all).toContain(A)
  expect(all).toContain(B)
  expect(all).toContain('(new)')
  expect(all).toContain('File-level only, not the whole project.')

  // newest first: checkpoint 1 is drawn before checkpoint 0
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string).filter((k: string) => k.startsWith('cp-'))
  expect(keys).toEqual(['cp-1', 'cp-0'])
  await ui.unmount()
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
})

test('turns without a real change, sub-agent edits, unreadable and oversized files make no checkpoint', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'same')
  r.files.set(B, 'x'.repeat(1_100_000))
  await start($)
  await turn($, r, 'just talk', async () => {})
  await turn($, r, 'no-op write', async () => {
    await write($, A, 'same')
  })
  await turn($, r, 'agent edit', async () => {
    await edit($, A, 'same', 'other', { agentId: 'agent-1' })
  })
  await turn($, r, 'too big', async () => {
    await write($, B, 'small now')
  })
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('1 checkpoint')
  await ui.unmount()
})

test('the label is the first 60 characters of the prompt, one line, secrets masked; slash commands are not prompts', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  const long = 'Please   refactor\nthe parser module so that it handles empty input and nested groups correctly'
  await turn($, r, long, async () => {
    await write($, A, '1')
  })
  await $.prompt.submit({ text: '/timeline' })
  await turn($, r, 'Use key sk-abcdef1234567890 and password=hunter2 here', async () => {
    await write($, B, '2')
  })
  const ui = await $.ui.mount(PANE())
  const row1 = await rowOf(ui, 1)
  const label1 = 'Please refactor the parser module so that it handles empty inpu'.slice(0, 60)
  expect(label1.length).toBe(60)
  expect(row1).toContain(` · ${label1} · 1 file · `)
  const row2 = await rowOf(ui, 2)
  expect(row2).toContain('[redacted]')
  expect(row2).not.toContain('sk-abcdef')
  expect(row2).not.toContain('hunter2')
  await ui.unmount()
})

test('evidence: tests passed, failed or none in the turn show on the row; older evidence is not counted', SLOW, async ($, on) => {
  // claim-check (off by default) is what turns a Bash test command into test evidence
  const r = rig(on, { enabled: { 'claim-check': true } })
  await start($)
  await turn($, r, 'green', async () => {
    await write($, A, '1')
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
  })
  r.bashFails = true
  await turn($, r, 'red', async () => {
    await write($, B, '2')
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
  })
  r.bashFails = false
  await turn($, r, 'silent', async () => {
    await write($, C, '3')
  })
  const ui = await $.ui.mount(PANE())
  expect(await rowOf(ui, 1)).toContain(' · green · 1 file · tests passed')
  expect(await rowOf(ui, 2)).toContain(' · red · 1 file · tests failed')
  expect(await rowOf(ui, 3)).toContain(' · silent · 1 file · tests –')
  await ui.unmount()
})

test('the 4 MB cap drops the oldest before-texts first and says so; the newest checkpoint stays whole', SLOW, async ($, on) => {
  const r = rig(on)
  const big = (c: string) => c.repeat(900_000)
  r.files.set(`${DIR}/f1.txt`, big('a'))
  r.files.set(`${DIR}/f2.txt`, big('b'))
  r.files.set(`${DIR}/f3.txt`, big('c'))
  await start($)
  for (const [i, c] of [['1', 'x'], ['2', 'y'], ['3', 'z']] as const) {
    await turn($, r, `big ${i}`, async () => {
      await write($, `${DIR}/f${i}.txt`, big(c))
    })
  }
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('4 checkpoints')
  // newest (selected): intact
  expect(await joined(ui)).not.toContain('content dropped')
  await ui.press({ key: 'cp-1' })
  await ui.redraw()
  expect(await joined(ui)).toContain('(content dropped)')
  const inspect = await press(ui, 'tm-inspect')
  expect(inspect).toContain('content before this turn was dropped to save space')
  // Restore skips the dropped file and writes nothing
  const before = r.writes.length
  const restored = await press(ui, 'tm-restore')
  expect(restored).toContain('skipped, its earlier content was dropped to save space')
  expect(restored).toContain('0 restored, 1 skipped, 0 failed')
  expect(r.writes.length).toBe(before)
  expect(r.asks).toEqual([])
  await ui.press({ key: 'cp-2' })
  await ui.redraw()
  expect(await joined(ui)).toContain('(content dropped)')
  await ui.press({ key: 'cp-3' })
  await ui.redraw()
  expect(await joined(ui)).not.toContain('(content dropped)')
  await ui.unmount()
})

test('only the last 30 checkpoints are kept', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  for (let i = 1; i <= 33; i++) {
    await turn($, r, `change ${i}`, async () => {
      await write($, A, `v${i}`)
    })
  }
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('30 checkpoints')
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string).filter((k: string) => k.startsWith('cp-'))
  expect(keys[0]).toBe('cp-33')
  expect(keys.length).toBeLessThanOrEqual(30)
  expect(await ui.find({ key: 'cp-0' })).toBeUndefined()
  await ui.unmount()
})

test('Inspect: per file, lines added with +, removed with −, at most 12, with a count of the rest', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'keep1\nold line\nkeep2')
  await start($)
  await turn($, r, 'swap a line', async () => {
    await edit($, A, 'old line', 'new line')
    await write($, B, Array.from({ length: 15 }, (_, i) => `row ${i + 1}`).join('\n'))
  })
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-inspect')
  expect(out).toContain(`${A} (+1 −1)`)
  expect(out).toContain('− old line')
  expect(out).toContain('+ new line')
  expect(out).not.toContain('keep1')
  expect(out).toContain(`${B} (+15 −0)`)
  expect(out).toContain('+ row 12')
  expect(out).not.toContain('+ row 13')
  expect(out).toContain('… 3 more changed lines')
  await ui.unmount()
})

test('Compare: against the previous checkpoint; with none, it says so', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'a0')
  await start($)
  await turn($, r, 'first', async () => {
    await write($, A, 'a1')
    await write($, B, 'b1')
  })
  await turn($, r, 'second', async () => {
    await write($, A, 'a2')
    await write($, C, 'c2')
  })
  const ui = await $.ui.mount(PANE())
  // newest selected by default
  let out = await press(ui, 'tm-compare')
  expect(out).toContain('Compare with previous checkpoint')
  expect(out).toContain(`differs: ${A}`)
  expect(out).toContain(`only in this checkpoint: ${C}`)
  expect(out).toContain(`only in the previous one: ${B}`)
  expect(out).toContain('files neither touched are not listed')
  // the first checkpoint compares with the session start (no files): everything is "only here"
  await ui.press({ key: 'cp-1' })
  await ui.redraw()
  out = await press(ui, 'tm-compare')
  expect(out).toContain(`only in this checkpoint: ${A}`)
  expect(out).toContain(`only in this checkpoint: ${B}`)
  // the session start has nothing before it
  await ui.press({ key: 'cp-0' })
  await ui.redraw()
  out = await press(ui, 'tm-compare')
  expect(out).toContain('No earlier checkpoint to compare with.')
  await ui.unmount()
})

test('Restore without conflict: exact writes, before-text back, evidence recorded, file-level wording', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'orig a')
  await start($)
  await turn($, r, 'Edit things', async () => {
    await edit($, A, 'orig', 'mid')
    await edit($, A, 'mid', 'final')
    await write($, B, 'brand new')
  })
  const writesBefore = r.writes.length
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-restore')
  expect(r.asks).toEqual([])
  expect(r.writes.slice(writesBefore)).toEqual([
    { path: A, text: 'orig a' },
    { path: B, text: '' },
  ])
  expect(r.files.get(A)).toBe('orig a')
  expect(out).toContain('Restore (file-level)')
  expect(out).toContain(`${A}: restored`)
  expect(out).toContain(`${B}: emptied (it did not exist before; the engine cannot delete files)`)
  expect(out).toContain('1 restored, 0 skipped, 0 failed'.replace('1 restored', '2 restored'))
  expect(out).toContain('This is not a full project restore.')
  const ev = (await evidence($, r)).filter((x: any) => x.kind === 'diff' && x.feature === 'time-machine')
  expect(ev.length).toBe(1)
  expect(ev[0].ok).toBe(true)
  expect(ev[0].summary).toBe('restored 2 files to Edit things')
  await ui.unmount()
})

test('Restore with a conflict: asks per file with Overwrite / Skip and writes exactly what was chosen', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'a-orig')
  r.files.set(B, 'b-orig')
  r.files.set(C, 'c-orig')
  await start($)
  await turn($, r, 'Three files', async () => {
    await write($, A, 'a-new')
    await write($, B, 'b-new')
    await write($, C, 'c-new')
  })
  // someone changed A and B since; C is untouched
  r.files.set(A, 'a-someone')
  r.files.set(B, 'b-someone')
  r.answers = ['Overwrite', 'Skip']
  const writesBefore = r.writes.length
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-restore')
  expect(r.asks.length).toBe(2)
  expect(r.asks[0]).toEqual({
    question: `${A} changed since this checkpoint. Overwrite it with the version from before this turn, or skip it?`,
    header: 'Conflict',
    options: ['Overwrite', 'Skip'],
  })
  expect(r.asks[1]?.question).toContain(B)
  expect(r.writes.slice(writesBefore)).toEqual([
    { path: A, text: 'a-orig' },
    { path: C, text: 'c-orig' },
  ])
  expect(r.files.get(B)).toBe('b-someone')
  expect(out).toContain(`${A}: restored`)
  expect(out).toContain(`${B}: skipped (changed since)`)
  expect(out).toContain('2 restored, 1 skipped, 0 failed')
  const ev = (await evidence($, r)).filter((x: any) => x.kind === 'diff' && x.feature === 'time-machine')
  expect(ev[0].summary).toBe('restored 2 files to Three files')
  await ui.unmount()
})

test('Restore: a dismissed question counts as Skip; a failing write is reported and marks the evidence not ok', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'a-orig')
  r.files.set(B, 'b-orig')
  await start($)
  await turn($, r, 'Two files', async () => {
    await write($, A, 'a-new')
    await write($, B, 'b-new')
  })
  r.files.set(A, 'a-changed') // conflict, but no answer queued: dismissed
  r.failWriteFor = B
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-restore')
  expect(r.files.get(A)).toBe('a-changed')
  expect(out).toContain(`${A}: skipped (changed since)`)
  expect(out).toContain(`${B}: could not write`)
  expect(out).toContain('0 restored, 1 skipped, 1 failed')
  // nothing restored: no evidence of a restore
  expect((await evidence($, r)).filter((x: any) => x.kind === 'diff' && x.feature === 'time-machine')).toEqual([])
  await ui.unmount()
})

test('Git restore: not a repository says so and points to Restore; no file is touched', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turn($, r, 'edit', async () => {
    await write($, A, 'x')
  })
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-git')
  expect(out).toContain('Not a git repository, so Git restore is unavailable. Use Restore for a file-level rollback.')
  expect(r.runs.some(a => a[1] === 'checkout')).toBe(false)
  expect(r.asks).toEqual([])
  await ui.unmount()
})

test('Git restore in a repo: shows git diff --stat, asks per file, runs git checkout -- <file> only after Run', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'a-orig')
  r.files.set(B, 'b-orig')
  await start($)
  await turn($, r, 'Two files', async () => {
    await write($, A, 'a-new')
    await write($, B, 'b-new')
  })
  r.run = argv => {
    if (argv[1] === 'rev-parse') return { exitCode: 0, stdout: 'true\n', stderr: '' }
    if (argv[1] === 'diff') return { exitCode: 0, stdout: ' src/a.ts | 2 +-\n src/b.ts | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)\n', stderr: '' }
    if (argv[1] === 'checkout' && argv[3] === B) return { exitCode: 1, stdout: '', stderr: 'error: pathspec did not match\nmore' }
    return { exitCode: 0, stdout: '', stderr: '' }
  }
  r.answers = ['Run', 'Run']
  const ui = await $.ui.mount(PANE())
  const out = await press(ui, 'tm-git')
  expect(r.runs.filter(a => a[1] === 'diff')).toEqual([['git', 'diff', '--stat=200', '--', A, B]])
  expect(out).toContain('Git restore is separate from Restore')
  expect(out).toContain('src/a.ts | 2 +-')
  expect(r.asks.map(a => a.question)).toEqual([
    `Run "git checkout -- ${A}"? It discards the uncommitted changes in that file.`,
    `Run "git checkout -- ${B}"? It discards the uncommitted changes in that file.`,
  ])
  expect(r.asks[0]?.options).toEqual(['Run', 'Skip'])
  expect(r.runs.filter(a => a[1] === 'checkout')).toEqual([
    ['git', 'checkout', '--', A],
    ['git', 'checkout', '--', B],
  ])
  expect(out).toContain(`${A}: checked out from git`)
  expect(out).toContain(`${B}: git checkout failed: error: pathspec did not match`)
  // the file-level files were not written by Git restore
  expect(r.files.get(A)).toBe('a-new')
  const ev = (await evidence($, r)).filter((x: any) => x.kind === 'git' && x.feature === 'time-machine')
  expect(ev.length).toBe(1)
  expect(ev[0].ok).toBe(false)
  expect(ev[0].summary).toBe('git checkout -- 1 file (Two files)')
  await ui.unmount()
})

test('Git restore: Skip runs nothing; a clean diff offers nothing', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turn($, r, 'one', async () => {
    await write($, A, 'x')
  })
  r.run = argv => (argv[1] === 'rev-parse' ? { exitCode: 0, stdout: 'true\n', stderr: '' } : argv[1] === 'diff' ? { exitCode: 0, stdout: ' src/a.ts | 1 +\n', stderr: '' } : { exitCode: 0, stdout: '', stderr: '' })
  r.answers = ['Skip']
  const ui = await $.ui.mount(PANE())
  let out = await press(ui, 'tm-git')
  expect(r.runs.some(a => a[1] === 'checkout')).toBe(false)
  expect(out).toContain(`${A}: skipped (changed since)`)
  r.asks.length = 0
  r.run = argv => (argv[1] === 'rev-parse' ? { exitCode: 0, stdout: 'true\n', stderr: '' } : { exitCode: 0, stdout: '', stderr: '' })
  out = await press(ui, 'tm-git')
  expect(out).toContain('git sees no unstaged changes in these files, so there is nothing to check out.')
  expect(r.asks).toEqual([])
  await ui.unmount()
})

test('Copy puts the whole timeline on the clipboard as text, newest first; a refused copy does not throw', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'old')
  await start($)
  await turn($, r, 'Change a', async () => {
    await write($, A, 'new')
  })
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'tm-copy' })
  expect(r.copies.length).toBe(1)
  const text = r.copies[0] as string
  const lines = text.split('\n')
  expect(lines[0]).toBe('Timeline · 2 checkpoints')
  expect(lines[1]).toBe(`${hh(T0 + MIN)} · Change a · 1 file · tests –`)
  expect(lines[2]).toBe(`  +1 −1 ${A}`)
  expect(lines[3]).toBe(`${hh(T0)} · Session start · 0 files · tests –`)
  r.copyOk = false
  await ui.press({ key: 'tm-copy' })
  expect(r.copies.length).toBe(2)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})

test('selecting a row changes what Inspect and Restore act on', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'a0')
  r.files.set(B, 'b0')
  await start($)
  await turn($, r, 'first', async () => {
    await write($, A, 'a1')
  })
  await turn($, r, 'second', async () => {
    await write($, B, 'b1')
  })
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'cp-1' })
  await ui.redraw()
  expect(await joined(ui)).toContain('Selected: first')
  const out = await press(ui, 'tm-inspect')
  expect(out).toContain(`${A} (+1 −1)`)
  expect(out).not.toContain(`${B} (+1 −1)`)
  await ui.press({ key: 'tm-restore' })
  await ui.redraw()
  expect(r.files.get(A)).toBe('a0')
  expect(r.files.get(B)).toBe('b1')
  await ui.unmount()
})

test('detail: time-machine has no chip or band line in the real module, so Toolkitty detail pane has no way in', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  for (let i = 1; i <= 7; i++) {
    await turn($, r, `change ${i}`, async () => {
      await write($, A, `v${i}`)
    })
  }
  const band = await $.ui.mount({ plugin: 'toolkitty', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } } as never)
  const keys = (await band.findAll({ type: 'Button' })).map((x: any) => String(x.key))
  expect(keys.filter((k: string) => /time-machine/.test(k))).toEqual([])
  await band.unmount()
  // the checkpoints are in the feature's own pane
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('change 7')
  await ui.unmount()
})

test('Hebrew: command, pane, rows, reports and the restore question are translated', SLOW, async ($, on) => {
  const r = rig(on, { lang: 'he' })
  r.files.set(A, 'a-orig')
  await start($)
  const out = await $.command.run({ command: 'timeline', args: '' })
  expect(out.text).toBe('ציר הזמן נפתח.')
  await turn($, r, 'תקן את הבאג בפרסר', async () => {
    await write($, A, 'a-new')
  })
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('ציר זמן')
  expect(all).toContain('2 נקודות ביקורת')
  expect(await rowOf(ui, 1)).toContain(`${hh(T0 + MIN)} · תקן את הבאג בפרסר · קובץ אחד · בדיקות –`)
  expect(await rowOf(ui, 0)).toContain('תחילת סשן')
  expect(all).toContain('ברמת הקבצים בלבד, לא כל הפרויקט.')
  r.files.set(A, 'a-someone')
  r.answers = ['דרוס']
  const rest = await press(ui, 'tm-restore')
  expect(r.asks[0]?.question).toBe(`${A} השתנה מאז נקודת הביקורת הזו. לדרוס אותו בגרסה שלפני התור הזה, או לדלג?`)
  expect(r.asks[0]?.options).toEqual(['דרוס', 'דלג'])
  expect(r.files.get(A)).toBe('a-orig')
  expect(rest).toContain(`${A}: שוחזר`)
  expect(rest).toContain('זה לא שחזור מלא של הפרויקט.')
  expect((await evidence($, r)).filter((x: any) => x.feature === 'time-machine')[0].summary).toBe('restored 1 file to תקן את הבאג בפרסר')
  await ui.unmount()
})

test('terminal surface draws the same pane', SLOW, async ($, on) => {
  const r = rig(on)
  r.files.set(A, 'o')
  await start($)
  await turn($, r, 'term', async () => {
    await write($, A, 'n')
  })
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await joined(ui)).toContain('2 checkpoints')
  expect(await rowOf(ui, 1)).toContain(' · term · 1 file · tests –')
  await ui.unmount()
})

test('off switch: the command answers off, the pane and detail say off, nothing is recorded', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'time-machine': false } })
  r.files.set(A, 'o')
  await start($)
  expect(r.commands).toContain('timeline')
  const out = await $.command.run({ command: 'timeline', args: '' })
  expect(out.text).toBe('Time machine is turned off in the Toolkitty pane.')
  await turn($, r, 'off turn', async () => {
    await write($, A, 'n')
  })
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toBe('Time machine is turned off.')
  await ui.unmount()
  expect(r.writes).toEqual([])
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
})
