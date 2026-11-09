import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'agents-monitor',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

type Agent = { id: string; description: string; type: string; status: string; name?: string }

function setup(on: any, opts: { refuse?: 'deny' | 'throw'; store?: Record<string, unknown>; agents?: () => Agent[]; paneOpen?: () => boolean } = {}) {
  const registered: string[] = []
  const opened: string[] = []
  mock.store(on, opts.store)
  const clock = mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string }) => {
    if (opts.refuse === 'throw' && e.name === 'subagents') throw new Error('taken')
    if (opts.refuse === 'deny' && e.name === 'subagents') return { deny: 'taken' }
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: unknown, e: { id: string }) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.panes', () => ({
    value: (opts.paneOpen?.() ?? true) ? [{ id: 'agents-monitor', title: 'Agents', isShown: true, isFocused: false, isPlaced: true }] : [],
  }))
  on('agent.list', () => ({ value: opts.agents?.() ?? [] }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  return { registered, opened, clock }
}

/** Everything Toolkitty noticed, as the notices pane draws it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'toolkitty', surface: 'desktop', component: 'Pane', requestId: 'toolkitty-notices', props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })

/** A list row is three Texts (the dim marker, the label, the dim right part); join them as "marker label right". */
async function agentRow(ui: any, label: string): Promise<string | undefined> {
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  const i = all.findIndex(x => x === label)
  return i < 1 ? undefined : `${all[i - 1]} ${all[i]} ${all[i + 1]}`
}

test('loads, registers /subagents, nothing skipped', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('subagents')
})

test('renamed: /agents is no longer registered, /subagents is', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('subagents')
  expect(s.registered).not.toContain('agents')
})

for (const refuse of ['throw', 'deny'] as const) {
  test(`a refused /subagents registration (${refuse}) warns and the poll still starts`, { timeoutMs: 30_000 }, async ($, on) => {
    let polls = 0
    const s = setup(on, { refuse, agents: () => (polls++, []) })
    await start($)
    expect(s.registered).not.toContain('subagents')
    expect((await noticeTexts($)).some(x => x.startsWith('The command /subagents could not be registered: '))).toBe(true)
    await s.clock.advance(2000)
    expect(polls).toBe(1)
  })
}

test('/subagents opens the pane (any args) and answers in English', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', 'foo bar', '   ']) {
    const r = await $.command.run({ command: 'subagents', args })
    expect((r as any).text).toBe('The agents monitor is open.')
  }
  expect(s.opened.filter(x => x === 'agents-monitor').length).toBe(3)
})

test('/subagents answers in Hebrew when the language is he', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  const r = await $.command.run({ command: 'subagents', args: '' })
  expect((r as any).text).toBe('מוניטור הסוכנים נפתח.')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /אין סוכנים/ }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /סוכני משנה מופיעים כאן/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('empty pane says there are no agents, on desktop and terminal', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /No agents in the session/ }))?.text).toBeTruthy()
    // the empty state: a header with the title only, and a hint on what fills the pane
    expect((await ui.find({ type: 'Text', text: 'Agents' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /open it with \/subagents/ }))?.text).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
    await ui.unmount()
  }
})

test('the poll fills the pane: live first, status names, durations, completes', { timeoutMs: 30_000 }, async ($, on) => {
  let agents: Agent[] = [
    { id: 'a1', description: 'Explore code', type: 'Explore', status: 'running' },
    { id: 'a2', description: 'Old job', type: 'general-purpose', status: 'completed', name: 'Worker' },
  ]
  const s = setup(on, { agents: () => agents })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await s.clock.advance(2000)
  await ui.redraw()
  // the header: the pane title, then the status word
  expect((await ui.find({ type: 'Text', text: 'Agents' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: '1 active of 2' }))?.text).toBeTruthy()
  const live = await agentRow(ui, 'Explore code')
  expect(live).toMatch(/● Explore code/)
  expect(live).toMatch(/running/)
  const done = await agentRow(ui, 'Worker')
  expect(done).toMatch(/○ Worker/)
  expect(done).toMatch(/completed/)
  // live agent sorts first
  const all = (await ui.findAll({ type: 'Text' })).map(x => x.text)
  const i1 = all.findIndex(x => /Explore code/.test(x))
  const i2 = all.findIndex(x => /Worker/.test(x))
  expect(i1).toBeLessThan(i2)

  // duration grows while live
  await s.clock.advance(4000)
  await ui.redraw()
  const later = await agentRow(ui, 'Explore code')
  expect(later).toMatch(/0:0[4-9]/)

  // status change: the agent finishes
  agents = [{ id: 'a1', description: 'Explore code', type: 'Explore', status: 'completed' }, agents[1]!]
  await s.clock.advance(2000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: '0 active of 2' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('every status is shown with its word', { timeoutMs: 30_000 }, async ($, on) => {
  const statuses = ['pending', 'running', 'waiting', 'idle', 'completed', 'failed', 'killed']
  const words: Record<string, string> = { pending: 'pending', running: 'running', waiting: 'waiting', idle: 'idle', completed: 'completed', failed: 'failed', killed: 'stopped' }
  const agents = statuses.map(st => ({ id: `s-${st}`, description: `d-${st}`, type: 'T', status: st }))
  const s = setup(on, { agents: () => agents })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await s.clock.advance(2000)
  await ui.redraw()
  for (const st of statuses) {
    const row = await agentRow(ui, `d-${st}`)
    expect(row).toMatch(new RegExp(`\\b${words[st]}\\b`))
  }
  expect((await ui.find({ type: 'Text', text: /3 active of 7/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('an unknown status is shown raw', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { agents: () => [{ id: 'x', description: 'weird', type: 'T', status: 'zombie' }] })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await s.clock.advance(2000)
  await ui.redraw()
  expect(await agentRow(ui, 'weird')).toMatch(/zombie/)
  await ui.unmount()
})

test('Hebrew pane header and status words', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { language: 'he' }, agents: () => [{ id: 'a', description: 'd', type: 'T', status: 'running' }] })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await s.clock.advance(2000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: '1 פעילים מתוך 1' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /\(T\)/ }))?.text).toMatch(/רץ/)
  await ui.unmount()
})

test('poll does nothing while the pane is closed', { timeoutMs: 30_000 }, async ($, on) => {
  let polls = 0
  const s = setup(on, { paneOpen: () => false, agents: () => (polls++, [{ id: 'a', description: 'd', type: 'T', status: 'running' }]) })
  await start($)
  await s.clock.advance(6000)
  expect(polls).toBe(0)
})

test('a failing agent.list poll is swallowed and retried', { timeoutMs: 30_000 }, async ($, on) => {
  let fail = true
  const s = setup(on, { agents: () => { if (fail) throw new Error('boom'); return [{ id: 'a', description: 'd', type: 'T', status: 'running' }] } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await s.clock.advance(2000)
  expect((await ui.find({ type: 'Text', text: /No agents/ }))?.text).toBeTruthy()
  fail = false
  await s.clock.advance(2000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: /\(T\)/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('restarting the session replaces the timer (no double polling)', { timeoutMs: 30_000 }, async ($, on) => {
  let polls = 0
  const s = setup(on, { agents: () => (polls++, []) })
  await start($)
  await start($)
  await s.clock.advance(2000)
  expect(polls).toBe(1)
})

test('off switch: command says off, pane says off, poll idle, no band', { timeoutMs: 30_000 }, async ($, on) => {
  let polls = 0
  const s = setup(on, { store: { enabled: { 'agents-monitor': false } }, agents: () => (polls++, [{ id: 'a', description: 'd', type: 'T', status: 'running' }]) })
  await start($)
  expect(s.registered).toContain('subagents')
  const r = await $.command.run({ command: 'subagents', args: '' })
  expect((r as any).text).toMatch(/is off/)
  expect(s.opened).not.toContain('agents-monitor')
  await s.clock.advance(4000)
  expect(polls).toBe(0)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /off in the switchboard/ }))?.text).toBeTruthy()
  await ui.unmount()
})
