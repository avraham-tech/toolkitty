import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'turn-history',
  props: {
    title: 'Turn history',
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
  const clock = mock.clock(on, { now: T0 })
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
  on('turn.start', (_: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  return { registered, opened, clock }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const mount = ($: any, surface: 'desktop' | 'terminal' = 'desktop', extra: Record<string, unknown> = {}) =>
  $.ui.mount({ ...PANE, surface, ...extra })
const done = (id: string, extra: Record<string, unknown> = {}) => ({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer', ...extra })

/** One finished turn of `ms` with `tools` tool calls. */
async function runTurn($: any, clock: any, id: string, ms: number, tools: number) {
  await $.turn.start({ text: 'go', turnId: id })
  for (let i = 0; i < tools; i++) await $.tool.call({ tool: 'Read', file_path: `C:/p/${id}-${i}.ts` })
  await clock.advance(ms)
  await $.turn.complete(done(id))
}

const lines = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)

test('loads and registers /turn-history', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('turn-history')
})

test('/turn-history opens the pane for every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', '5', 'garbage words']) {
    const r = await $.command.run({ command: 'turn-history', args })
    expect((r as any).text).toBe('The turn history is open.')
  }
  expect(s.opened.filter(x => x === 'turn-history').length).toBe(3)
})

test('/turn-history in Hebrew, empty pane in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'turn-history', args: '' })
  expect((r as any).text).toBe('היסטוריית התורים נפתחה.')
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'עדיין אין תורים שהסתיימו.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('empty pane on both surfaces has no buttons', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    expect((await ui.find({ type: 'Text', text: 'No turns have finished yet.' }))?.text).toBeTruthy()
    // a header with the title only, and a hint on what fills the pane
    expect((await ui.find({ type: 'Text', text: 'Turn history' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /adds a row with its duration and actions/ }))?.text).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
    await ui.unmount()
  }
})

test('a finished turn shows its duration and the tool calls it made', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await runTurn($, s.clock, 't1', 65_000, 3)
  const ui = await mount($)
  // the header: the pane title, then the status
  expect(((await lines(ui)).slice(0, 2))).toEqual(['Turn history', 'Last 1 turns'])
  expect((await ui.find({ type: 'Text', text: '1:05 · 3 actions' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('turns are listed newest first with a sparkline oldest to newest', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await runTurn($, s.clock, 't1', 1_000, 0)
  await runTurn($, s.clock, 't2', 4_000, 2)
  await runTurn($, s.clock, 't3', 8_000, 1)
  const ui = await mount($)
  const texts = await lines(ui)
  expect(texts).toContain('Last 3 turns')
  expect(texts).toContain('▁▄█')
  const i3 = texts.indexOf('0:08 · 1 actions')
  const i2 = texts.indexOf('0:04 · 2 actions')
  const i1 = texts.indexOf('0:01 · 0 actions')
  expect(i3).toBeGreaterThan(-1)
  expect(i3).toBeLessThan(i2)
  expect(i2).toBeLessThan(i1)
  await ui.unmount()
})

test('tool calls before a turn started are not counted into the next turn', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/early.ts' })
  await runTurn($, s.clock, 't1', 2_000, 1)
  const ui = await mount($)
  // start resets the count, so only the one in-turn call remains
  expect((await ui.find({ type: 'Text', text: '0:02 · 1 actions' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a completion without a start records nothing', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.turn.complete(done('orphan'))
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No turns have finished yet.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('an aborted turn is still recorded', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await $.turn.start({ text: 'go', turnId: 'ta' })
  await s.clock.advance(3_000)
  await $.turn.complete(done('ta', { isAborted: true, reason: 'aborted' }))
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '0:03 · 0 actions' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('subagent turns neither start nor finish a main turn', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await $.turn.start({ text: 'main', turnId: 'm1' })
  await s.clock.advance(1_000)
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'agent-1' })
  await s.clock.advance(1_000)
  await $.turn.complete(done('s1', { agentId: 'agent-1' }))
  let ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No turns have finished yet.' }))?.text).toBeTruthy()
  await ui.unmount()
  await s.clock.advance(1_000)
  await $.turn.complete(done('m1'))
  ui = await mount($)
  // 3s since the main start: the subagent's start did not reset it
  expect((await ui.find({ type: 'Text', text: '0:03 · 0 actions' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a live pane redraws when a turn ends', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No turns have finished yet.' }))?.text).toBeTruthy()
  await runTurn($, s.clock, 't1', 5_000, 1)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: '0:05 · 1 actions' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('only the last 20 turns are kept', { timeoutMs: 20000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (let i = 1; i <= 22; i++) await runTurn($, s.clock, `t${i}`, i * 1_000, 0)
  const ui = await mount($)
  const texts = await lines(ui)
  expect(texts).toContain('Last 20 turns')
  // turn 1 and 2 (0:01, 0:02) dropped; 0:03 is the oldest left, 0:22 the newest
  expect(texts).toContain('0:22 · 0 actions')
  expect(texts).toContain('0:03 · 0 actions')
  expect(texts).not.toContain('0:02 · 0 actions')
  expect(texts).not.toContain('0:01 · 0 actions')
  const spark = texts.find(x => /^[▁▂▃▄▅▆▇█]+$/.test(x))
  expect(spark?.length).toBe(20)
  await ui.unmount()
})

test('a short pane shows only the newest rows that fit', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (let i = 1; i <= 6; i++) await runTurn($, s.clock, `t${i}`, i * 1_000, 0)
  // rows 8 -> room max(3, 4) = 4
  const ui = await mount($, 'desktop', { viewport: { columns: 100, rows: 8 } })
  const rows = (await lines(ui)).filter(x => / actions$/.test(x))
  expect(rows).toEqual(['0:06 · 0 actions', '0:05 · 0 actions', '0:04 · 0 actions', '0:03 · 0 actions'])
  await ui.unmount()
})

test('Hebrew pane', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { language: 'he' })
  await start($)
  await runTurn($, s.clock, 't1', 2_000, 4)
  const ui = await mount($, 'terminal')
  expect((await ui.find({ type: 'Text', text: '1 התורים האחרונים' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: '0:02 · 4 פעולות' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch: command and pane say off, nothing recorded', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { enabled: { 'turn-history': false } })
  await start($)
  expect(s.registered).toContain('turn-history')
  const r = await $.command.run({ command: 'turn-history', args: '' })
  expect((r as any).text).toBe('The "Turn history" feature is off in the switches panel.')
  expect(s.opened).not.toContain('turn-history')
  await runTurn($, s.clock, 't1', 2_000, 2)
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'The feature is off in the switches panel.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he', enabled: { 'turn-history': false } })
  await start($)
  const r = await $.command.run({ command: 'turn-history', args: '' })
  expect((r as any).text).toBe('שכלול "היסטוריית תורים" כבוי בלוח המתגים.')
})
