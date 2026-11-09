import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'agent-profiler',
  props: { title: 'Profile', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature agent-profiler failed/

function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = { commands: [] as { name: string }[], toasts: [] as string[], opened: [] as { id: string; title: string }[] }
  const plan = { hold: 0 }
  on('command.register', (_: any, e: any) => {
    seen.commands.push({ name: e.name })
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
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', async () => {
    if (plan.hold > 0) await clock.sleep(plan.hold)
    return { result: {} }
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, plan }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const begin = ($: any, id = 't1', extra: Record<string, unknown> = {}) => $.turn.start({ text: 'hi', turnId: id, ...extra })
const finish = ($: any, durationMs: number, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: 't1', reason: 'answer', ...extra })

/** One tool call that takes `ms` of mock time. */
async function timed($: any, clock: any, plan: { hold: number }, ms: number, call: Record<string, unknown>) {
  plan.hold = ms
  const p = $.tool.call(call)
  await clock.advance(ms)
  const r = await p
  plan.hold = 0
  return r
}

async function texts(ui: any): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
}

const squash = (xs: string[]) => xs.map(x => x.replace(/\s+/g, ' ').trim())

async function pane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  const ui = await $.ui.mount({ ...PANE, surface })
  const out = squash(await texts(ui))
  await ui.unmount()
  return out
}

test('loads and registers /profile', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands.map(c => c.name)).toContain('profile')
})

test('/profile opens the pane and answers; the pane is empty before the first finished turn', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  const r = await $.command.run({ command: 'profile', args: '' })
  expect(r.text).toBe('The profile pane is open.')
  expect(seen.opened).toContainEqual({ id: 'agent-profiler', title: 'Profile' })
  expect(await pane($)).toEqual(['◔', 'Profile', 'Nothing measured yet: finish a turn first.', 'The first finished turn fills this pane; /profile opens it any time.'])
  // extra arguments make no difference
  const r2 = await $.command.run({ command: 'profile', args: 'whatever' })
  expect(r2.text).toBe('The profile pane is open.')
})

test('a timed turn splits into model wait, tools and agents, with per-tool time and the slowest calls', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 2000, { tool: 'Bash', command: 'sleep 2', tool_use_id: 'b1' })
  await timed($, clock, plan, 3000, { tool: 'Agent', description: 'dig around', prompt: 'p', subagent_type: 'Explore', tool_use_id: 'a1' })
  await clock.advance(5000)
  await finish($, 10_000)

  const out = await pane($)
  expect(out).toContain('Last 1 turns')
  expect(out).toContain('# total model tools agents')
  expect(out).toContain('1 0:10 5.0s 2.0s 3.0s')
  expect(out).toContain('agents = the main loop waiting on Agent calls')
  expect(out).toContain('Session: 0:10 in 1 turns')
  expect(out).toContain('model 50% · tools 20% · subagents 30%')
  expect(out).toContain('Time per tool')
  expect(out).toContain('Agent: 3.0s (1 calls)')
  expect(out).toContain('Bash: 2.0s (1 calls)')
  expect(out.indexOf('Agent: 3.0s (1 calls)')).toBeLessThan(out.indexOf('Bash: 2.0s (1 calls)'))
  expect(out).toContain('Slowest calls')
  expect(out).toContain('3.0s · Agent: dig around')
  expect(out).toContain('2.0s · Bash: sleep 2')
  expect(out.some(x => x.startsWith('Subagent work'))).toBe(false)
})

test('subagent tool calls count per tool but not toward the turn; subagent turns add subagent work', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 1000, { tool: 'Read', file_path: 'C:/p/src/a.ts', tool_use_id: 'r1' })
  await begin($, 'sub1', { agentId: 'ag1' })
  await timed($, clock, plan, 4000, { tool: 'Read', file_path: 'C:/p/src/b.ts', tool_use_id: 'r2', agentId: 'ag1' })
  await finish($, 4500, { agentId: 'ag1', turnId: 'sub1' })
  await finish($, 6000)

  const out = await pane($)
  // the turn: 6 s total, 1 s in its own tools, the rest model
  expect(out).toContain('1 6.0s 5.0s 1.0s 0.0s')
  expect(out).toContain('Session: 6.0s in 1 turns')
  expect(out).toContain('model 83% · tools 17% · subagents 0%')
  expect(out).toContain('Read: 5.0s (2 calls)')
  expect(out).toContain('Subagent work: 4.5s across 1 subagent turns')
  expect(out).toContain('4.0s · Read src/b.ts')
})

test('the slowest list keeps the five slowest, and the tool list is sorted by time', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  const ms = [500, 4000, 100, 3000, 2000, 1000, 6000]
  let i = 0
  for (const m of ms) await timed($, clock, plan, m, { tool: 'Bash', command: `job ${m}`, tool_use_id: `j${i++}` })
  await finish($, 20_000)
  const out = squash(await pane($))
  const slowRows = out.filter(x => /^\d+\.\ds · Bash: job/.test(x))
  expect(slowRows).toEqual(['6.0s · Bash: job 6000', '4.0s · Bash: job 4000', '3.0s · Bash: job 3000', '2.0s · Bash: job 2000', '1.0s · Bash: job 1000'])
  // 16.6 s of Bash in 7 calls: a duration past ten seconds is shown as clock text
  expect(out).toContain('Bash: 0:16 (7 calls)')
})

test('only the last turns are listed (newest first) while the session summary counts them all', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($)
  for (let n = 1; n <= 12; n++) {
    await begin($, `t${n}`)
    await clock.advance(1000)
    await finish($, 1000 * n, { turnId: `t${n}` })
  }
  const out = await pane($)
  expect(out).toContain('Last 6 turns')
  const rows = out.filter(x => /^\d+ [\d:.]+s? /.test(x) && !x.startsWith('Session'))
  expect(rows[0]).toMatch(/^12 /)
  expect(rows[rows.length - 1]).toMatch(/^7 /)
  expect(rows).toHaveLength(6)
  // 1+2+...+12 = 78 s
  expect(out).toContain('Session: 1:18 in 12 turns')
  expect(out).toContain('model 100% · tools 0% · subagents 0%')
})

test('a single call is counted in the per-tool and slowest lists', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 1000, { tool: 'Glob', pattern: '*.md', tool_use_id: 'g1' })
  await finish($, 2000)
  const out = await pane($)
  expect(out).toContain('Glob: 1.0s (1 calls)')
  expect(out).toContain('1.0s · Glob: *.md')
})

test('the labels read file paths (last two parts), commands, patterns, urls and queries', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 900, { tool: 'Edit', file_path: 'C:\\p\\src\\e.ts', old_string: 'a', new_string: 'b', tool_use_id: 'x1' })
  await timed($, clock, plan, 800, { tool: 'NotebookEdit', notebook_path: 'C:/p/n.ipynb', new_source: 'x', tool_use_id: 'x2' })
  await timed($, clock, plan, 700, { tool: 'Grep', pattern: 'needle', tool_use_id: 'x3' })
  await timed($, clock, plan, 600, { tool: 'WebFetch', url: 'https://example.com/a', prompt: 'p', tool_use_id: 'x4' })
  await timed($, clock, plan, 500, { tool: 'WebSearch', query: 'docs', tool_use_id: 'x5' })
  await timed($, clock, plan, 400, { tool: 'mcp__srv__thing', tool_use_id: 'x6' })
  await timed($, clock, plan, 300, { tool: 'Bash', command: 'x'.repeat(80), tool_use_id: 'x7' })
  await finish($, 5000)
  const out = await pane($)
  expect(out).toContain('0.9s · Edit src/e.ts')
  expect(out).toContain('0.8s · NotebookEdit p/n.ipynb')
  expect(out).toContain('0.7s · Grep: needle')
  expect(out).toContain('0.6s · WebFetch: https://example.com/a')
  expect(out).toContain('0.5s · WebSearch: docs')
  // slowest keeps 5: the two shortest are not in the list but are in the per-tool list
  expect(out.some(x => x.includes('mcp__srv__thing') && x.startsWith('0.4s'))).toBe(false)
  expect(out).toContain('mcp__srv__thing: 0.4s (1 calls)')
  expect(out).toContain('Bash: 0.3s (1 calls)')
})

test('the long command label is clipped to 40 characters with an ellipsis', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 900, { tool: 'Bash', command: `${'y'.repeat(60)}`, tool_use_id: 'c1' })
  await finish($, 2000)
  const out = await pane($)
  expect(out).toContain(`0.9s · Bash: ${'y'.repeat(39)}…`)
})

test('the pane draws on the terminal too', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 2000, { tool: 'Bash', command: 'ls', tool_use_id: 'b1' })
  await finish($, 4000)
  const out = await pane($, 'terminal')
  expect(out).toContain('Session: 4.0s in 1 turns')
  expect(out).toContain('1 4.0s 2.0s 2.0s 0.0s')
})

test('tool calls are never denied by the profiler', SLOW, async ($, on) => {
  boot(on)
  await start($)
  await begin($)
  const r = await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'z1' })
  expect(r.deny).toBeUndefined()
  await finish($, 100)
})

test('off switch: nothing is measured, the command and the pane say so', SLOW, async ($, on) => {
  const { clock, plan, seen } = boot(on, { enabled: { 'agent-profiler': false } })
  await start($)
  await begin($)
  await timed($, clock, plan, 1000, { tool: 'Bash', command: 'ls', tool_use_id: 'b1' })
  await finish($, 2000)
  const r = await $.command.run({ command: 'profile', args: '' })
  expect(r.text).toBe('This feature is off; turn it on in the /toolkitty panel')
  expect(seen.opened.filter(o => o.id === 'agent-profiler')).toHaveLength(0)
  expect(await pane($)).toEqual(['The feature is off in the switches panel.'])
})

test('Hebrew: command, pane headings and rows are in Hebrew', SLOW, async ($, on) => {
  const { clock, plan } = boot(on, { language: 'he' })
  await start($)
  expect((await $.command.run({ command: 'profile', args: '' })).text).toBe('חלונית הפרופיל נפתחה.')
  expect(await pane($)).toEqual(['◔', 'פרופיל', 'עוד לא נמדד דבר: סיים תור קודם.', 'התור הראשון שיסתיים ימלא את החלונית; ‎/profile פותח אותה בכל עת.'])
  await begin($)
  await timed($, clock, plan, 2000, { tool: 'Bash', command: 'ls', tool_use_id: 'b1' })
  await finish($, 4000)
  const out = await pane($)
  expect(out).toContain('1 התורים האחרונים')
  expect(out).toContain('# סה״כ מודל כלים סוכנים')
  expect(out).toContain('סשן: 4.0s ב-1 תורים')
  expect(out).toContain('מודל 50% · כלים 50% · תתי-סוכנים 0%')
  expect(out).toContain('זמן לפי כלי')
  expect(out).toContain('Bash: 2.0s (1 קריאות)')
  expect(out).toContain('הקריאות האיטיות ביותר')
})

test('the pane header: the title, the turn count as status, then sections', SLOW, async ($, on) => {
  const { clock, plan } = boot(on)
  await start($)
  await begin($)
  await timed($, clock, plan, 1000, { tool: 'Bash', command: 'ls', tool_use_id: 'b1' })
  await finish($, 3000)
  const out = await pane($)
  expect(out.slice(0, 3)).toEqual(['◔', 'Profile', '1 turns'])
})
