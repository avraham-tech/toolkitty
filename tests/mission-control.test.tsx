import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const SLOW = { timeoutMs: 30_000 }

const HOME = 'C:/Users/test'
const DIR = `${HOME}/.claude/toolkitty-sessions`
const SELF = 'sess-self'
const SELF_FILE = `${DIR}/${SELF}.json`
const OWN_FAILURE = /feature mission-control failed/

type Beat = Record<string, unknown>

const beat = (id: string, project: string, state: string, task: string, ageMs: number, over: Beat = {}): Beat => ({
  id,
  cwd: `C:/work/${project}`,
  project,
  startedAt: T0 - 2 * HOUR,
  updatedAt: T0 - ageMs,
  state,
  task,
  ...over,
})

/** Four live sessions in four states, plus a done one, a stale one, a day-old one and an ended one. */
const SEEDED: Record<string, Beat | string> = {
  'sess-a': beat('sess-a', 'alpha', 'working', 'Refactor the parser', 5 * SEC),
  'sess-b': beat('sess-b', 'beta', 'waiting', 'Deploy to staging', 10 * SEC, { stateSince: T0 - 3 * MIN }),
  'sess-c': beat('sess-c', 'gamma', 'error', 'Fix the flaky build', 20 * SEC, { lastError: 'turn ended with an error', stateSince: T0 - 2 * MIN }),
  'sess-d': beat('sess-d', 'delta', 'idle', 'Write the docs', 30 * SEC),
  'sess-e': beat('sess-e', 'epsilon', 'done', 'Migrate the config', 40 * SEC),
  'sess-old': beat('sess-old', 'zeta', 'working', 'Long gone session', 10 * MIN),
  'sess-dead': beat('sess-dead', 'eta', 'working', 'A day old session', 25 * HOUR),
  'sess-ended': JSON.stringify({ ended: true }),
  'bad.json': 'this is not json {',
  'notes.txt': 'not a heartbeat',
}

type Rig = {
  files: Map<string, { text: string; mtime: number }>
  writes: { path: string; text: string }[]
  lists: number
  commands: string[]
  toasts: string[]
  opened: string[]
  panes: () => boolean
  clock: ReturnType<typeof mock.clock>
  failWrite: boolean
  failUsage: boolean
  verdict: { decision: 'allow' | 'ask' | 'deny' }
  usage: { context: { window: number; percent?: number }; rateLimits: { kind: string; percentUsed: number }[] }
}

function rig(on: any, o: { lang?: string; enabled?: Record<string, boolean>; seed?: Record<string, Beat | string>; cwd?: string } = {}): Rig {
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
    lists: 0,
    commands: [],
    toasts: [],
    opened: [],
    panes: () => true,
    clock,
    failWrite: false,
    failUsage: false,
    verdict: { decision: 'ask' },
    usage: { context: { window: 200000, percent: 63.4 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12 }, { kind: 'seven_day', percentUsed: 41.6 }] },
  }
  for (const [name, v] of Object.entries(o.seed ?? {})) r.files.set(`${DIR}/${name.includes('.') ? name : name + '.json'}`, { text: typeof v === 'string' ? v : JSON.stringify(v), mtime: T0 - 1000 })

  const norm = (p: string): string => p.split(String.fromCharCode(92)).join('/')
  on('fs.write', (_: any, e: any) => {
    if (r.failWrite) throw new Error('EACCES ' + e.path)
    const path = norm(e.path)
    r.writes.push({ path, text: e.text })
    r.files.set(path, { text: e.text, mtime: clock.now() })
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    const f = r.files.get(norm(e.path))
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: f.text }
  })
  on('fs.exists', (_: any, e: any) => ({ value: r.files.has(norm(e.path)) }))
  on('fs.stat', (_: any, e: any) => {
    const f = r.files.get(norm(e.path))
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: { kind: 'file', size: f.text.length, mtimeMs: f.mtime, isLink: false } }
  })
  on('fs.list', (_: any, e: any) => {
    const dir = norm(e.path).replace(/\/+$/, '')
    if (dir === DIR) r.lists += 1
    const out: any[] = []
    for (const [path, f] of r.files) {
      if (path.startsWith(dir + '/') && !path.slice(dir.length + 1).includes('/')) {
        out.push({ name: path.slice(dir.length + 1), kind: 'file', size: f.text.length, mtimeMs: f.mtime, isLink: false })
      }
    }
    return { value: out }
  })
  on('command.register', (_: any, e: any) => {
    r.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    r.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: r.panes() ? [{ id: 'mission-control', title: 'Mission Control', isShown: true, isFocused: false, isPlaced: true }] : [] }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    r.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.id', () => ({ value: SELF }))
  on('session.cwd', () => ({ value: o.cwd ?? 'C:/work/proj' }))
  on('session.usage', () => {
    if (r.failUsage) throw new Error('no usage')
    return { value: { startedAt: T0, ...r.usage } } as never
  })
  on('agent.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('tool.check', () => ({ decision: r.verdict.decision }))
  on('tool.call', () => ({ result: {} }) as never)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return r
}

const PANE = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'mission-control',
    surface,
    props: { title: 'Mission Control', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const BAND = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({ plugin: 'toolkitty', component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} } }) as const

const start = ($: any) => $.session.start({ cwd: 'C:/work/proj', surface: 'desktop', isInteractive: true })
let turns = 0
const turnStart = ($: any, text = 'hi') => $.turn.start({ text, turnId: `t${++turns}` })
const turnDone = ($: any, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: `t${turns}`, reason: 'answer', ...extra })

const mine = (r: Rig): Beat => JSON.parse(r.files.get(SELF_FILE)?.text ?? '{}')
const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
const indexOf = async (ui: any, re: RegExp): Promise<number> => (await texts(ui)).findIndex(x => re.test(x))

async function chip($: any, surface: 'desktop' | 'terminal' = 'desktop'): Promise<{ text: string; color: unknown } | undefined> {
  const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
  const c = await b.find({ key: 'chip-mission-control' })
  let out: { text: string; color: unknown } | undefined
  if (c !== undefined) {
    const txt = await b.find({ type: 'Text', text: c.text.trim() })
    out = { text: c.text.trim(), color: txt?.props['color'] }
  }
  await b.unmount()
  return out
}

test('loads: registers /mission and writes the first heartbeat', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  expect(r.commands).toContain('mission')
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  const b = mine(r)
  expect(b['id']).toBe(SELF)
  expect(b['cwd']).toBe('C:/work/proj')
  expect(b['project']).toBe('proj')
  expect(b['state']).toBe('idle')
  expect(b['task']).toBe('')
  expect(b['startedAt']).toBe(T0)
  expect(b['updatedAt']).toBe(T0)
  expect(Object.keys(b).sort()).toEqual(['cwd', 'id', 'project', 'startedAt', 'state', 'stateSince', 'task', 'updatedAt', 'usage'])
  // the home comes from USERPROFILE (backslashes), the file is <id>.json in .claude/toolkitty-sessions
  expect(r.writes[0]?.path).toBe(SELF_FILE)
})

test('the heartbeat follows the session: prompt, turn, ask, tool, todo, complete, error', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)

  await $.prompt.submit({ text: 'Please refactor the parser module' })
  expect(mine(r)['state']).toBe('idle') // a prompt alone writes nothing new
  await turnStart($, 'Please refactor the parser module')
  let b = mine(r)
  expect(b['state']).toBe('working')
  expect(b['task']).toBe('Please refactor the parser module')

  // an ask verdict: waiting
  await $.tool.check({ tool: 'Bash', input: { command: 'rm x' }, tool_use_id: 'tu1' })
  b = mine(r)
  expect(b['state']).toBe('waiting')
  expect(b['stateSince']).toBe(T0)

  // an allow verdict leaves the state alone
  r.verdict.decision = 'allow'
  await $.tool.check({ tool: 'Read', input: { file_path: 'a' }, tool_use_id: 'tu2' })
  expect(mine(r)['state']).toBe('waiting')

  // the tool ran: back to working; TodoWrite's in-progress item becomes the task
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Read the parser', status: 'completed', activeForm: 'Reading' },
      { content: 'Fix the empty-input crash', status: 'in_progress', activeForm: 'Fixing' },
      { content: 'Add tests', status: 'pending', activeForm: 'Testing' },
    ],
  })
  b = mine(r)
  expect(b['state']).toBe('working')
  expect(b['task']).toBe('Fix the empty-input crash')

  await turnDone($)
  b = mine(r)
  expect(b['state']).toBe('idle')
  expect(b['task']).toBe('Fix the empty-input crash')
  expect(b['lastError']).toBeUndefined()

  // an error turn
  await turnStart($, 'run the build')
  expect(mine(r)['task']).toBe('run the build')
  await turnDone($, { reason: 'error' })
  b = mine(r)
  expect(b['state']).toBe('error')
  expect(b['lastError']).toBe('turn ended with an error')

  // the next turn clears it
  await turnStart($, 'again')
  b = mine(r)
  expect(b['state']).toBe('working')
  expect(b['lastError']).toBeUndefined()

  // an aborted turn is idle; slash commands never become the task
  await turnDone($, { reason: 'aborted', isAborted: true })
  expect(mine(r)['state']).toBe('idle')
  await $.prompt.submit({ text: '/mission' })
  await turnStart($, '/mission')
  expect(mine(r)['task']).toBe('again')

  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
})

test('the prompt collected at submit is the task; sub-agent turns do not move the state', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.prompt.submit({ text: 'First collected prompt' })
  await turnStart($, 'a different turn text')
  expect(mine(r)['task']).toBe('First collected prompt')
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'sub1', agentId: 'agent-1', reason: 'error' })
  expect(mine(r)['state']).toBe('working')
})

test('a heartbeat never carries a secret, a newline or more than 80 characters', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  const long = 'x'.repeat(300)
  const secret = 'Fix\nthe   bug with key sk-abc123def456ghi789jkl and password=hunter2 token: ghp_abcdefghijklmnopqrstuvwxyz0123 ' + long
  await $.prompt.submit({ text: secret })
  await turnStart($, secret)
  const raw = r.files.get(SELF_FILE)?.text ?? ''
  const b = mine(r)
  const task = b['task'] as string
  expect(task.length).toBeLessThanOrEqual(80)
  expect(task).not.toMatch(/\n|\r|\t/)
  expect(task.startsWith('Fix the bug with key ')).toBe(true)
  for (const bad of ['sk-abc123', 'hunter2', 'ghp_abcdef', long.slice(0, 100)]) expect(raw).not.toContain(bad)
  expect(raw).toContain('[redacted]')
  // all heartbeats written during the test, too
  for (const w of r.writes) expect(w.text).not.toContain('hunter2')

  // a long plain prompt is cut at exactly 80 characters
  await turnDone($)
  const plain = 'word '.repeat(60)
  await $.prompt.submit({ text: plain })
  await turnStart($, plain)
  expect((mine(r)['task'] as string).length).toBe(79) // 80 characters cut, trailing space dropped by the one-line rule
  // a hebrew prompt survives
  await turnDone($)
  await $.prompt.submit({ text: 'תקן את הבאג בפרסר' })
  await turnStart($, 'תקן את הבאג בפרסר')
  expect(mine(r)['task']).toBe('תקן את הבאג בפרסר')
})

test('usage: context and weekly percent are rounded; a failing usage call just leaves them out', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  expect(mine(r)['usage']).toEqual({ contextPercent: 63, weeklyPercent: 42 })

  r.failUsage = true
  await turnStart($, 'go')
  expect(mine(r)['state']).toBe('working')
  expect(mine(r)['usage']).toBeUndefined()

  r.failUsage = false
  r.usage = { context: { window: 200000 }, rateLimits: [] }
  await turnDone($)
  expect(mine(r)['usage']).toBeUndefined()
})

test('the 30 s timer refreshes updatedAt and keeps the rest', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await turnStart($, 'long task')
  const before = mine(r)
  expect(before['updatedAt']).toBe(T0)
  const writes = r.writes.length
  await r.clock.advance(29_000)
  expect(r.writes.length).toBe(writes)
  await r.clock.advance(1_000)
  expect(r.writes.length).toBe(writes + 1)
  const after = mine(r)
  expect(after['updatedAt']).toBe(T0 + 30_000)
  expect(after['state']).toBe('working')
  expect(after['task']).toBe('long task')
  expect(after['startedAt']).toBe(T0)
  await r.clock.advance(30_000)
  expect(mine(r)['updatedAt']).toBe(T0 + 60_000)
})

test('the pane lists four seeded states, Needs me first, this session marked', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  await turnStart($, 'Review Toolkitty')
  const cmd = await $.command.run({ command: 'mission', args: '' })
  expect(cmd.text).toBe('Mission Control is open.')
  expect(r.opened).toContain('mission-control')

  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Mission Control')
  // self (working) + alpha working + beta waiting + gamma error + delta idle + epsilon done = 6 live; 2 need me
  expect(all).toContain('6 sessions · 2 need you')
  const status = await ui.find({ type: 'Text', text: '6 sessions · 2 need you' })
  expect(status.props['color']).toBe('error') // an error among them

  // sections: Needs me, then Sessions, then Stale
  const needs = await indexOf(ui, /^Needs me$/)
  const sessions = await indexOf(ui, /^Sessions$/)
  const stale = await indexOf(ui, /^Stale/)
  expect(needs).toBeGreaterThanOrEqual(0)
  expect(sessions).toBeGreaterThan(needs)
  expect(stale).toBeGreaterThan(sessions)

  // each row: glyph, "project · task", "state · age"
  const rows = await texts(ui)
  const at = (re: RegExp): number => rows.findIndex(x => re.test(x))
  expect(rows[at(/^beta · Deploy to staging$/) - 1]).toBe('🟡')
  expect(rows[at(/^beta · Deploy to staging$/) + 1]).toBe('waiting for you · 3m')
  expect(rows[at(/^gamma · Fix the flaky build$/) - 1]).toBe('🔴')
  expect(rows[at(/^gamma · Fix the flaky build$/) + 1]).toBe('error · 2m')
  expect(rows[at(/^alpha · Refactor the parser$/) - 1]).toBe('⚡')
  expect(rows[at(/^alpha · Refactor the parser$/) + 1]).toBe('working · now')
  expect(rows[at(/^delta · Write the docs$/) - 1]).toBe('○')
  expect(rows[at(/^delta · Write the docs$/) + 1]).toBe('idle · now')
  expect(rows[at(/^epsilon · Migrate the config$/) - 1]).toBe('✓')
  expect(rows[at(/^epsilon · Migrate the config$/) + 1]).toBe('done · now')
  expect(rows[at(/^proj \(this\) · Review Toolkitty$/) - 1]).toBe('⚡')
  // waiting before error; both before the rest; the stale one dimmed into its own section
  expect(at(/^beta ·/)).toBeLessThan(at(/^gamma ·/))
  expect(at(/^gamma ·/)).toBeLessThan(at(/^alpha ·/))
  expect(rows[at(/^zeta · Long gone session$/) - 1]).toBe('◌')
  expect(rows[at(/^zeta · Long gone session$/) + 1]).toBe('stale · 10m')
  expect(at(/^zeta ·/)).toBeGreaterThan(at(/^epsilon ·/))
  // the day-old, ended, corrupt and non-json files do not show
  expect(all).not.toContain('eta · A day old session')
  expect(all).not.toContain('bad.json')
  expect(all.match(/\(this\)/g)?.length).toBe(1)
  // no navigation: the footer says so, and no row is a button
  expect(all).toContain('switching to another session from here is not supported')
  const keys = (await ui.findAll({ type: 'Button' })).map((x: any) => x.key)
  expect(keys.sort()).toEqual(['mc-only', 'mc-prune', 'mc-refresh'])

  // a day-old heartbeat is overwritten with the tombstone by whoever reads
  expect(r.files.get(`${DIR}/sess-dead.json`)?.text).toBe('{"ended":true}')
  // others' live files were not touched
  expect(JSON.parse(r.files.get(`${DIR}/sess-b.json`)?.text ?? '{}').state).toBe('waiting')
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})

test('a session is stale after 2 minutes without a heartbeat, not before', SLOW, async ($, on) => {
  const r = rig(on, {
    seed: {
      'sess-fresh': beat('sess-fresh', 'fresh', 'waiting', 'Just under', 119 * SEC),
      'sess-late': beat('sess-late', 'late', 'waiting', 'Just over', 121 * SEC),
    },
  })
  await start($)
  await $.command.run({ command: 'mission', args: '' })
  const ui = await $.ui.mount(PANE())
  const rows = await texts(ui)
  const i = rows.findIndex(x => x === 'late · Just over')
  expect(rows[i + 1]).toBe('stale · 2m')
  const j = rows.findIndex(x => x === 'fresh · Just under')
  expect(rows[j - 1]).toBe('🟡')
  expect(await joined(ui)).toContain('2 sessions · 1 need you')
  expect(r.lists).toBeGreaterThan(0)
  await ui.unmount()
})

test('the chip says how many OTHER sessions need you and is quiet otherwise', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  const c = await chip($)
  expect(c?.text).toBe('◉ 2 need you')
  expect(c?.color).toBe('warning')
  expect((await chip($, 'terminal'))?.text).toBe('◉ 2 need you')

  // this session waiting does not count: it is the one the person is looking at
  r.files.delete(`${DIR}/sess-b.json`)
  r.files.delete(`${DIR}/sess-c.json`)
  await r.clock.advance(30_000) // the timer rescans
  r.files.set(`${DIR}/sess-a.json`, { text: JSON.stringify(beat('sess-a', 'alpha', 'working', 'x', 1 * SEC)), mtime: T0 })
  await $.tool.check({ tool: 'Bash', input: { command: 'x' }, tool_use_id: 'tu' })
  expect(mine(r)['state']).toBe('waiting')
  expect(await chip($)).toBeUndefined()
})

test('a stale waiting session does not count in the chip or the header', SLOW, async ($, on) => {
  rig(on, { seed: { 'sess-x': beat('sess-x', 'xray', 'waiting', 'Silent', 5 * MIN) } })
  await start($)
  expect(await chip($)).toBeUndefined()
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('1 sessions · 0 need you')
  await ui.unmount()
})

test('Refresh reads the folder again', SLOW, async ($, on) => {
  const r = rig(on, { seed: { 'sess-a': beat('sess-a', 'alpha', 'working', 'Refactor the parser', 5 * SEC) } })
  await start($)
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).not.toContain('omega')
  r.files.set(`${DIR}/sess-n.json`, { text: JSON.stringify(beat('sess-n', 'omega', 'waiting', 'New arrival', 1 * SEC)), mtime: T0 })
  const before = r.lists
  await ui.press({ key: 'mc-refresh' })
  expect(r.lists).toBe(before + 1)
  const all = await joined(ui)
  expect(all).toContain('omega · New arrival')
  expect(all).toContain('Needs me')
  expect(all).toContain('3 sessions · 1 need you')
  await ui.unmount()
})

test('Only mine needing attention is a toggle', SLOW, async ($, on) => {
  rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE())
  expect((await ui.find({ key: 'mc-only' })).props['label']).toBe('○ Only mine needing attention')
  await ui.press({ key: 'mc-only' })
  expect((await ui.find({ key: 'mc-only' })).props['label']).toBe('● Only mine needing attention')
  let all = await joined(ui)
  expect(all).toContain('beta · Deploy to staging')
  expect(all).toContain('gamma · Fix the flaky build')
  expect(all).not.toContain('alpha · Refactor the parser')
  expect(all).not.toContain('delta · Write the docs')
  expect(all).not.toContain('zeta')
  expect(all).not.toMatch(/^Sessions$/m)
  await ui.press({ key: 'mc-only' })
  all = await joined(ui)
  expect(all).toContain('alpha · Refactor the parser')
  expect((await ui.find({ key: 'mc-only' })).props['label']).toBe('○ Only mine needing attention')
  await ui.unmount()
})

test('the filter with nothing needing attention shows an empty state with a hint', SLOW, async ($, on) => {
  rig(on, { seed: { 'sess-a': beat('sess-a', 'alpha', 'working', 'Refactor the parser', 5 * SEC) } })
  await start($)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'mc-only' })
  const all = await joined(ui)
  expect(all).toContain('No session needs you right now.')
  expect(all).toContain('Turn off "Only mine needing attention" to see every session.')
  await ui.unmount()
})

test('alone: an empty-state hint says other sessions will appear and that switching is not supported', SLOW, async ($, on) => {
  rig(on)
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('1 sessions · 0 need you')
  expect(all).toContain('proj (this) · no task yet')
  expect(all).toContain('No other sessions are running.')
  expect(all).toContain('Switching to another session from here is not supported.')
  await ui.unmount()
})

test('Prune stale overwrites only stale files with the ended marker', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('zeta · Long gone session')
  const oldText = r.files.get(`${DIR}/sess-old.json`)?.text ?? ''
  const bText = r.files.get(`${DIR}/sess-b.json`)?.text
  r.writes.length = 0

  await ui.press({ key: 'mc-prune' })
  expect(r.files.get(`${DIR}/sess-old.json`)?.text).toBe('{"ended":true}')
  expect(oldText).not.toBe('{"ended":true}')
  expect(r.files.get(`${DIR}/sess-b.json`)?.text).toBe(bText)
  expect(r.files.get(SELF_FILE)?.text).toContain('"id":"sess-self"')
  expect(r.writes.map(w => w.path)).toEqual([`${DIR}/sess-old.json`])
  const all = await joined(ui)
  expect(all).not.toContain('zeta')
  expect(all).not.toMatch(/^Stale/m)
  expect(all).toContain('beta · Deploy to staging')

  // nothing left to prune: pressing again writes nothing
  r.writes.length = 0
  await ui.press({ key: 'mc-prune' })
  expect(r.writes).toEqual([])

  // the notices pane has both outcomes
  const n = await $.ui.mount({ plugin: 'toolkitty', component: 'Pane', requestId: 'toolkitty-notices', surface: 'desktop', props: PANE().props })
  const seen = await joined(n)
  expect(seen).toContain('Pruned 1 stale sessions.')
  expect(seen).toContain('Nothing stale to prune.')
  await n.unmount()
  await ui.unmount()
})

test('the folder is polled every 15 s while the pane is open, and the poll stops when the pane closes', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.command.run({ command: 'mission', args: '' })
  const l0 = r.lists
  await r.clock.advance(15_000)
  expect(r.lists).toBe(l0 + 1) // the poll
  r.files.set(`${DIR}/sess-p.json`, { text: JSON.stringify(beat('sess-p', 'pi', 'waiting', 'Polled in', 1 * SEC)), mtime: T0 })
  await r.clock.advance(15_000) // poll and the 30 s heartbeat both fire
  expect(r.lists).toBe(l0 + 3)
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('pi · Polled in')
  await ui.unmount()

  // the pane closes: the next poll tick cancels itself without reading
  r.panes = () => false
  const l1 = r.lists
  await r.clock.advance(15_000)
  expect(r.lists).toBe(l1)
  await r.clock.advance(15_000) // only the 30 s heartbeat remains
  expect(r.lists).toBe(l1 + 1)
  await r.clock.advance(15_000)
  expect(r.lists).toBe(l1 + 1)
})

test('the poll is cancelled when a turn ends', SLOW, async ($, on) => {
  const r = rig(on)
  await start($)
  await $.command.run({ command: 'mission', args: '' })
  await turnStart($, 'work')
  await turnDone($)
  const l = r.lists
  await r.clock.advance(15_000)
  expect(r.lists).toBe(l) // no poll at 15 s
  await r.clock.advance(15_000)
  expect(r.lists).toBe(l + 1) // the 30 s heartbeat still reads the folder
})

test('unreadable or odd files are skipped; a missing folder is an empty list', SLOW, async ($, on) => {
  rig(on, {
    seed: {
      'sess-1': '[]',
      'sess-2': '{"updatedAt":"yesterday"}',
      'sess-3': '"text"',
      'sess-4': JSON.stringify({ id: 'sess-4', updatedAt: T0 - SEC, state: 'bogus', task: 'Odd state', cwd: 'C:\\x\\y\\odd' }),
    },
  })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('2 sessions · 0 need you')
  expect(all).toContain('odd · Odd state') // project from the cwd's last folder, unknown state read as idle
  await ui.unmount()
})

test('files from other writers are shown cleaned: one line, 80 characters, no secrets', SLOW, async ($, on) => {
  rig(on, { seed: { 'sess-w': beat('sess-w', 'wild', 'working', 'line1\nline2 sk-live-abcdef123456 ' + 'y'.repeat(200), 1 * SEC) } })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('wild · line1 line2 [redacted] ')
  expect(all).not.toContain('sk-live')
  const row = (await texts(ui)).find(x => x.startsWith('wild · ')) ?? ''
  expect(row.length).toBeLessThanOrEqual('wild · '.length + 80)
  await ui.unmount()
})

test('a failing write never breaks a turn and this session still shows in the pane', SLOW, async ($, on) => {
  const r = rig(on)
  r.failWrite = true
  await start($)
  await turnStart($, 'offline work')
  await $.tool.check({ tool: 'Bash', input: { command: 'x' }, tool_use_id: 'tu' })
  await turnDone($)
  expect(r.files.size).toBe(0)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('proj (this) · offline work')
  await ui.unmount()
})

test('the terminal draws the same pane', SLOW, async ($, on) => {
  rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE('terminal'))
  const all = await joined(ui)
  expect(all).toContain('6 sessions · 2 need you')
  expect(all).toContain('beta · Deploy to staging')
  expect((await ui.findAll({ type: 'Button' })).length).toBe(3)
  await ui.unmount()
})

test('Hebrew: command, pane, buttons, ages and chip', SLOW, async ($, on) => {
  rig(on, { lang: 'he', seed: SEEDED })
  await start($)
  const cmd = await $.command.run({ command: 'mission', args: '' })
  expect(cmd.text).toBe('חדר הבקרה נפתח.')
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('חדר בקרה')
  expect(all).toContain('6 סשנים · 2 זקוקים לך')
  expect(all).toContain('זקוקים לי')
  expect(all).toContain('מחכה לך · 3 ד׳')
  expect(all).toContain('שגיאה · 2 ד׳')
  expect(all).toContain('תקוע · 10 ד׳')
  expect(all).toContain('(זה)')
  expect(all).toContain('מעבר לסשן אחר מכאן אינו נתמך')
  expect((await ui.find({ key: 'mc-refresh' })).props['label']).toBe('רענן')
  expect((await ui.find({ key: 'mc-only' })).props['label']).toBe('○ רק אלה שזקוקים לי')
  expect((await ui.find({ key: 'mc-prune' })).props['label']).toBe('נקה תקועים')
  await ui.unmount()
  expect((await chip($))?.text).toBe('◉ 2 זקוקים לך')
})

test('off switch: no heartbeat, no chip, the command and pane answer that it is off', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'mission-control': false }, seed: SEEDED })
  await start($)
  expect(r.commands).toContain('mission') // registered even when off
  expect(r.files.has(SELF_FILE)).toBe(false)

  const cmd = await $.command.run({ command: 'mission', args: '' })
  expect(cmd.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(r.opened).not.toContain('mission-control')

  const out = await $.prompt.submit({ text: 'hello there' })
  expect((out as any).text).toBe('hello there')
  await turnStart($, 'hello there')
  await $.tool.check({ tool: 'Bash', input: { command: 'x' }, tool_use_id: 'tu' })
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'x', status: 'in_progress', activeForm: 'x' }] })
  await turnDone($)
  await r.clock.advance(60_000)
  expect(r.writes).toEqual([])
  expect(r.lists).toBe(0)

  expect(await chip($)).toBeUndefined()
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('The feature is off in the switchboard.')
  expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
  await ui.unmount()
})
