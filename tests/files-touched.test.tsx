import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'files-touched',
  props: {
    title: 'Files this turn',
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
  const clock = mock.clock(on)
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
  on('tool.call', () => ({ result: {} }))
  return { registered, opened, clock }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const mount = ($: any, surface: 'desktop' | 'terminal' = 'desktop', extra: Record<string, unknown> = {}) =>
  $.ui.mount({ ...PANE, surface, ...extra })
// a row is two Texts: the dim kind label, then the path
const allTexts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
const KIND = /^(read|edited|נקרא|נערך)$/
const pathTexts = async (ui: any): Promise<string[]> => {
  const all = await allTexts(ui)
  return all.flatMap((x, i) => (KIND.test(x) ? [all[i + 1]!] : []))
}

test('loads and registers /files-touched', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('files-touched')
})

test('/files-touched opens the pane for every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', 'whatever', '   ']) {
    const r = await $.command.run({ command: 'files-touched', args })
    expect((r as any).text).toBe('The files pane was opened.')
  }
  expect(s.opened.filter(x => x === 'files-touched').length).toBe(3)
})

test('/files-touched in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'files-touched', args: '' })
  expect((r as any).text).toBe('חלונית הקבצים נפתחה.')
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '0 · נערכו 0' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: 'עדיין לא נגעו בקבצים.' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: 'קבצים בתור' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /הרשימה מתאפסת בכל תור חדש/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('empty pane on both surfaces', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    expect((await ui.find({ type: 'Text', text: '0 · edited 0' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: 'No files touched yet.' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: 'Files this turn' }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /the list resets with each new turn/ }))?.text).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
    await ui.unmount()
  }
})

test('Read, Glob, Grep record reads; Edit, Write, NotebookEdit record edits', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.tool.call({ tool: 'Glob', pattern: '*.ts', path: 'C:/p/src' })
  await $.tool.call({ tool: 'Grep', pattern: 'foo', path: 'C:/p/lib' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/b.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: 'C:/p/c.ts', content: 'x' })
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/p/n.ipynb', new_source: 'x' })
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '6 · edited 3' }))?.text).toBeTruthy()
  expect(await pathTexts(ui)).toEqual(['C:/p/a.ts', 'C:/p/src', 'C:/p/lib', 'C:/p/b.ts', 'C:/p/c.ts', 'C:/p/n.ipynb'])
  const labels = (await allTexts(ui)).filter((x: string) => KIND.test(x))
  expect(labels.filter((x: string) => x === 'read').length).toBe(3)
  expect(labels.filter((x: string) => x === 'edited').length).toBe(3)
  await ui.unmount()
})

test('Glob and Grep without a path record nothing', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Glob', pattern: '*.ts' })
  await $.tool.call({ tool: 'Grep', pattern: 'foo' })
  await $.tool.call({ tool: 'Read', file_path: '' })
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '0 · edited 0' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a file read twice appears once; an edit upgrades a read, a later read does not downgrade', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  let ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '1 · edited 0' }))?.text).toBeTruthy()
  await ui.unmount()
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '1 · edited 1' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /^edited$/ }))?.text).toBe('edited')
  expect(await ui.find({ type: 'Text', text: /^read$/ })).toBeUndefined()
  await ui.unmount()
})

test('a new turn clears the list; a subagent turn does not', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'agent-1' })
  let ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '1 · edited 0' }))?.text).toBeTruthy()
  await ui.unmount()
  await $.turn.start({ text: 'hello', turnId: 't2' })
  ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '0 · edited 0' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a live pane redraws when a tool call lands', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: '0 · edited 0' }))?.text).toBeTruthy()
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/live.ts' })
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: '1 · edited 0' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: 'C:/p/live.ts' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('only the newest 100 are kept and the pane shows the newest that fit with a "more" line', { timeoutMs: 20000 }, async ($, on) => {
  setup(on)
  await start($)
  for (let i = 1; i <= 105; i++) await $.tool.call({ tool: 'Read', file_path: `C:/p/f${i}.ts` })
  const ui = await mount($, 'desktop', { viewport: { columns: 100, rows: 13 } })
  expect((await ui.find({ type: 'Text', text: '100 · edited 0' }))?.text).toBeTruthy()
  // rows 13 -> room 10: f96..f105 shown, 90 more
  const paths = await pathTexts(ui)
  expect(paths.length).toBe(10)
  expect(paths[0]).toBe('C:/p/f96.ts')
  expect(paths[9]).toBe('C:/p/f105.ts')
  expect((await ui.find({ type: 'Text', text: '90 more files...' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('Hebrew pane labels the kinds', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/b.ts', old_string: 'a', new_string: 'b' })
  const ui = await mount($, 'terminal')
  expect((await ui.find({ type: 'Text', text: 'נקרא' }))?.text).toBe('נקרא')
  expect((await ui.find({ type: 'Text', text: 'נערך' }))?.text).toBe('נערך')
  await ui.unmount()
})

test('off switch: command and pane say off, calls pass and record nothing, turn start is inert', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { enabled: { 'files-touched': false } })
  await start($)
  expect(s.registered).toContain('files-touched')
  const r = await $.command.run({ command: 'files-touched', args: '' })
  expect((r as any).text).toBe('The "Files this turn" feature is turned off in the switchboard.')
  expect(s.opened).not.toContain('files-touched')
  const res = (await $.tool.call({ tool: 'Read', file_path: 'C:/p/a.ts' })) as any
  expect(res.result).toBeTruthy()
  await $.turn.start({ text: 'x', turnId: 't9' })
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'The feature is turned off in the switchboard.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he', enabled: { 'files-touched': false } })
  await start($)
  const r = await $.command.run({ command: 'files-touched', args: '' })
  expect((r as any).text).toBe('שכלול "קבצים בתור" כבוי בלוח המתגים.')
})
