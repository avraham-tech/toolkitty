import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'task-board',
  props: {
    title: 'Tasks',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

function setup(on: any, store?: Record<string, unknown>) {
  const registered: string[] = []
  const opened: string[] = []
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string }) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: unknown, e: { id: string }) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('tool.call', () => ({ result: {} }))
  return { registered, opened }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const mount = ($: any, surface: 'desktop' | 'terminal' = 'desktop', extra: Record<string, unknown> = {}) =>
  $.ui.mount({ ...PANE, surface, ...extra })
const call = ($: any, input: Record<string, unknown>) => $.tool.call(input as any)
// a task row is two Texts (the dim marker, then the task): join them back as "marker task"
const texts = async (ui: any): Promise<string[]> => {
  const raw: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  const out: string[] = []
  for (let i = 0; i < raw.length; i++) {
    if (/^[✔▸○]$/.test(raw[i]!) && i + 1 < raw.length) out.push(`${raw[i]} ${raw[++i]}`)
    else out.push(raw[i]!)
  }
  return out
}

test('loads and registers /board', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('board')
})

test('/board opens the pane for every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', 'list', '  1 2  ']) {
    const r = await $.command.run({ command: 'board', args })
    expect((r as any).text).toBe('The task board is open.')
  }
  expect(s.opened.filter(x => x === 'task-board').length).toBe(3)
})

test('/board and the empty pane in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'board', args: '' })
  expect((r as any).text).toBe('לוח המשימות נפתח.')
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'אין עדיין משימות בסשן.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('empty pane on both surfaces has no buttons', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    expect((await ui.find({ type: 'Text', text: 'No tasks in the session yet.' }))?.text).toBeTruthy()
    // a header with the title only, and a hint on what fills the board
    expect((await ui.find({ type: 'Text', text: 'Tasks' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /TodoWrite/ }))?.text).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
    await ui.unmount()
  }
})

test('TodoWrite replaces the board; statuses map to icons', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const r = (await call($, {
    tool: 'TodoWrite',
    todos: [
      { content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
      { content: 'Fix bugs', status: 'in_progress', activeForm: 'Fixing bugs' },
      { content: 'Ship it', status: 'pending', activeForm: 'Shipping' },
    ],
  })) as any
  expect(r.result).toBeTruthy()
  const ui = await mount($)
  const t = await texts(ui)
  expect(t.slice(0, 2)).toEqual(['Tasks', '1/3 completed'])
  expect(t).toContain('✔ Write tests')
  expect(t).toContain('▸ Fix bugs')
  expect(t).toContain('○ Ship it')
  await ui.unmount()
  // a second TodoWrite replaces the first
  await call($, { tool: 'TodoWrite', todos: [{ content: 'Only one', status: 'pending', activeForm: 'x' }] })
  const ui2 = await mount($)
  const t2 = await texts(ui2)
  expect(t2).toContain('0/1 completed')
  expect(t2).not.toContain('✔ Write tests')
  await ui2.unmount()
})

test('TodoWrite with a bad shape leaves the board alone; odd items are skipped', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TodoWrite', todos: [{ content: 'Keep me', status: 'pending', activeForm: 'x' }] })
  await call($, { tool: 'TodoWrite', todos: 'not an array' })
  await call($, { tool: 'TodoWrite' })
  let ui = await mount($)
  expect(await texts(ui)).toContain('○ Keep me')
  await ui.unmount()
  await call($, { tool: 'TodoWrite', todos: [null, 7, { status: 'pending' }, { content: 42 }, { content: 'Valid', status: 'weird-status', activeForm: 'x' }] })
  ui = await mount($)
  const t = await texts(ui)
  expect(t).toContain('0/1 completed')
  expect(t).toContain('○ Valid')
  await ui.unmount()
})

test('an empty TodoWrite clears the board', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TodoWrite', todos: [{ content: 'a', status: 'pending', activeForm: 'x' }] })
  await call($, { tool: 'TodoWrite', todos: [] })
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No tasks in the session yet.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('an update_plan tool (any server prefix) feeds the board from step/status', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, {
    tool: 'mcp__codex__update_plan',
    plan: [
      { step: 'Plan it', status: 'completed' },
      { step: 'Do it', status: 'in_progress' },
    ],
  })
  const ui = await mount($)
  const t = await texts(ui)
  expect(t).toContain('1/2 completed')
  expect(t).toContain('✔ Plan it')
  expect(t).toContain('▸ Do it')
  await ui.unmount()
})

test('TaskCreate appends with growing ids; TaskUpdate changes status and subject', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TaskCreate', subject: 'First', description: 'd' })
  await call($, { tool: 'TaskCreate', subject: 'Second', description: 'd' })
  await call($, { tool: 'TaskCreate', description: 'no subject' })
  let ui = await mount($)
  let t = await texts(ui)
  expect(t).toContain('0/2 completed')
  expect(t).toContain('○ First')
  expect(t).toContain('○ Second')
  await ui.unmount()

  await call($, { tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  await call($, { tool: 'TaskUpdate', taskId: '2', status: 'completed', subject: 'Second (renamed)' })
  ui = await mount($)
  t = await texts(ui)
  expect(t).toContain('▸ First')
  expect(t).toContain('✔ Second (renamed)')
  expect(t).toContain('1/2 completed')
  await ui.unmount()

  // a subject alone keeps the status
  await call($, { tool: 'TaskUpdate', taskId: '1', subject: 'First!' })
  ui = await mount($)
  expect(await texts(ui)).toContain('▸ First!')
  await ui.unmount()

  // unknown id and non-string id change nothing
  await call($, { tool: 'TaskUpdate', taskId: '99', status: 'completed' })
  await call($, { tool: 'TaskUpdate', taskId: 2, status: 'pending' })
  await call($, { tool: 'TaskUpdate', status: 'pending' })
  ui = await mount($)
  t = await texts(ui)
  expect(t).toContain('1/2 completed')
  await ui.unmount()
})

test('TaskUpdate with status deleted removes the task and ids do not collide afterwards', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TaskCreate', subject: 'A' })
  await call($, { tool: 'TaskCreate', subject: 'B' })
  await call($, { tool: 'TaskUpdate', taskId: '2', status: 'deleted' })
  await call($, { tool: 'TaskCreate', subject: 'C' })
  await call($, { tool: 'TaskUpdate', taskId: '2', status: 'completed' })
  const ui = await mount($)
  const t = await texts(ui)
  expect(t).not.toContain('○ B')
  expect(t).toContain('○ A')
  expect(t).toContain('✔ C')
  await ui.unmount()
})

test('done/active aliases are understood', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TodoWrite', todos: [{ content: 'x', status: 'done' }, { content: 'y', status: 'active' }] })
  const ui = await mount($)
  const t = await texts(ui)
  expect(t).toContain('✔ x')
  expect(t).toContain('▸ y')
  await ui.unmount()
})

test('a live pane redraws when the plan changes', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No tasks in the session yet.' }))?.text).toBeTruthy()
  await call($, { tool: 'TaskCreate', subject: 'Live' })
  await ui.redraw()
  expect(await texts(ui)).toContain('○ Live')
  await ui.unmount()
})

test('a long list shows what fits and an "and N more" line', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const todos = Array.from({ length: 12 }, (_, i) => ({ content: `task ${i + 1}`, status: 'pending', activeForm: 'x' }))
  await call($, { tool: 'TodoWrite', todos })
  // rows 8 -> room max(3, 5) = 5
  const ui = await mount($, 'desktop', { viewport: { columns: 100, rows: 8 } })
  const t = await texts(ui)
  expect(t.filter(x => /^○ task/.test(x)).length).toBe(5)
  expect(t).toContain('○ task 5')
  expect(t).not.toContain('○ task 6')
  expect(t).toContain('... and 7 more')
  await ui.unmount()
})

test('other tools do not touch the board', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'Bash', command: 'ls' })
  await call($, { tool: 'Read', file_path: 'C:/x' })
  await call($, { tool: 'mcp__x__update_plan_extra', plan: [{ step: 'no', status: 'pending' }] })
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No tasks in the session yet.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('Hebrew header', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  await call($, { tool: 'TodoWrite', todos: [{ content: 'א', status: 'completed', activeForm: 'x' }, { content: 'ב', status: 'pending', activeForm: 'x' }] })
  const ui = await mount($, 'terminal')
  expect((await ui.find({ type: 'Text', text: 'משימות' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: '1/2 הושלמו' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch: command and pane say off, calls pass, board stays empty', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { enabled: { 'task-board': false } })
  await start($)
  expect(s.registered).toContain('board')
  const r = await $.command.run({ command: 'board', args: '' })
  expect((r as any).text).toBe('This feature is off; turn it on in the /toolkitty panel')
  expect(s.opened).not.toContain('task-board')
  const res = (await call($, { tool: 'TaskCreate', subject: 'ignored' })) as any
  expect(res.result).toBeTruthy()
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'The feature is off in the switches panel.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he', enabled: { 'task-board': false } })
  await start($)
  const r = await $.command.run({ command: 'board', args: '' })
  expect((r as any).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

test('a subagent TodoWrite (current behaviour: it also replaces the session board)', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await call($, { tool: 'TodoWrite', todos: [{ content: 'main plan', status: 'pending', activeForm: 'x' }] })
  await call($, { tool: 'TodoWrite', agentId: 'agent-1', todos: [{ content: 'sub plan', status: 'pending', activeForm: 'x' }] })
  const ui = await mount($)
  const t = await texts(ui)
  // documents what the board does today; see the report
  expect(t).toContain('○ sub plan')
  await ui.unmount()
})

test('the old /tasks name is not registered; /board is', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).not.toContain('tasks')
  expect(s.registered).toContain('board')
})
