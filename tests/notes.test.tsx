import { expect, mock, test } from 'claude-code/testing'

let DATA = new Map<string, unknown>()
function memStore(on: any, entries: Record<string, unknown> = {}) {
  DATA = new Map(Object.entries(entries))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: DATA.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    DATA.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: unknown, e: { key: string }) => {
    DATA.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...DATA.keys()] }))
}
const readStore = async (key: string): Promise<unknown> => DATA.get(key)

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'notes',
  props: {
    title: 'Notes',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const CWD = 'C:/tmp/project'

function setup(on: any, store?: Record<string, unknown>, cwd: { value: string } = { value: CWD }) {
  const registered: string[] = []
  const opened: string[] = []
  memStore(on, store)
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
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: cwd.value }))
  return { registered, opened, cwd }
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const mount = ($: any, surface: 'desktop' | 'terminal' | 'mobile' | 'vscode' = 'desktop', extra: Record<string, unknown> = {}) =>
  $.ui.mount({ ...PANE, surface, ...extra })
const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text)
const add = (ui: any, text: string) => ui.input({ key: 'note-input', text })
const stored = ($: any, cwd = CWD) => readStore(`notes:${cwd}`)

test('loads and registers /notes', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.registered).toContain('notes')
})

test('/notes opens the pane for every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  for (const args of ['', 'buy milk', '   ']) {
    const r = await $.command.run({ command: 'notes', args })
    expect((r as any).text).toBe('The notepad is open.')
  }
  expect(s.opened.filter(x => x === 'notes').length).toBe(3)
})

test('/notes in Hebrew and the empty pane', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'notes', args: '' })
  expect((r as any).text).toBe('פנקס ההערות נפתח.')
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'אין הערות בתיקייה הזו.' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Input', key: 'note-input' }))?.props['placeholder']).toBe('הערה חדשה…')
  await ui.unmount()
})

test('empty pane on desktop and terminal: an input, the empty text, no delete buttons', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    expect((await ui.find({ type: 'Input', key: 'note-input' }))?.props['placeholder']).toBe('New note…')
    expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).length).toBe(0)
    await ui.unmount()
  }
})

test('mobile says the notepad is not available', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($, 'mobile')
  expect((await ui.find({ type: 'Text', text: 'The notepad is not available on mobile.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('the pane has a header with the note count and an empty state that says how to add one', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  expect((await texts(ui)).slice(0, 2)).toEqual(['Notes', '0 notes'])
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Type a note above and press Enter/ }))?.text).toBeTruthy()
  await add(ui, 'first')
  await ui.redraw()
  expect((await texts(ui)).slice(0, 2)).toEqual(['Notes', '1 notes'])
  expect(await ui.find({ type: 'Text', text: /Type a note above/ })).toBeUndefined()
  await ui.unmount()
})

test('the pane draws on vscode', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($, 'vscode')
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('typing a note adds it, newest first, trimmed, and keeps it in the store', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  await add(ui, '  first note  ')
  await add(ui, 'second note')
  await ui.redraw()
  const t = await texts(ui)
  expect(t.indexOf('second note')).toBeGreaterThan(-1)
  expect(t.indexOf('second note')).toBeLessThan(t.indexOf('first note'))
  expect(t).not.toContain('No notes in this folder.')
  expect(await stored($)).toEqual([
    { id: 1, text: 'first note' },
    { id: 2, text: 'second note' },
  ])
  await ui.unmount()
})

test('blank input is ignored', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  await add(ui, '')
  await add(ui, '    ')
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  expect(await stored($)).toBeUndefined()
  await ui.unmount()
})

test('a change event (typing, not Enter) adds nothing', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  await ui.input({ key: 'note-input', text: 'half typed', kind: 'change' })
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('each note has a delete button that removes only that note', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  await add(ui, 'alpha')
  await add(ui, 'beta')
  await add(ui, 'gamma')
  await ui.redraw()
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(b => b.key)).toEqual(['del-3', 'del-2', 'del-1'])
  expect(buttons.every(b => b.props['label'] === '✕')).toBe(true)
  await ui.press({ key: 'del-2' })
  await ui.redraw()
  const t = await texts(ui)
  expect(t).toContain('alpha')
  expect(t).toContain('gamma')
  expect(t).not.toContain('beta')
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['del-3', 'del-1'])
  expect(await stored($)).toEqual([
    { id: 1, text: 'alpha' },
    { id: 3, text: 'gamma' },
  ])
  await ui.press({ key: 'del-1' })
  await ui.press({ key: 'del-3' })
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  expect(await stored($)).toEqual([])
  await ui.unmount()
})

test('ids keep growing after a delete', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  await add(ui, 'one')
  await add(ui, 'two')
  await ui.press({ key: 'del-2' })
  await add(ui, 'three')
  expect(await stored($)).toEqual([
    { id: 1, text: 'one' },
    { id: 2, text: 'three' },
  ])
  await ui.unmount()
})

test('notes are per folder and survive the pane being reopened', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  let ui = await mount($)
  await add(ui, 'in project')
  await ui.unmount()

  s.cwd.value = 'C:/tmp/other'
  await $.command.run({ command: 'notes', args: '' })
  ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  await add(ui, 'in other')
  await ui.unmount()
  expect(await stored($, 'C:/tmp/other')).toEqual([{ id: 1, text: 'in other' }])

  s.cwd.value = CWD
  await $.command.run({ command: 'notes', args: '' })
  ui = await mount($)
  const t = await texts(ui)
  expect(t).toContain('in project')
  expect(t).not.toContain('in other')
  await ui.unmount()
})

test('notes already in the store are listed', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { [`notes:${CWD}`]: [{ id: 4, text: 'old A' }, { id: 7, text: 'old B' }] })
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($)
  const t = await texts(ui)
  expect(t.indexOf('old B')).toBeLessThan(t.indexOf('old A'))
  await add(ui, 'new')
  expect(await stored($)).toEqual([
    { id: 4, text: 'old A' },
    { id: 7, text: 'old B' },
    { id: 8, text: 'new' },
  ])
  await ui.unmount()
})

test('the pane keeps at most 50 notes and folds the old ones into a "more" line', { timeoutMs: 30000 }, async ($, on) => {
  setup(on)
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($, 'desktop', { viewport: { columns: 100, rows: 15 } })
  for (let i = 1; i <= 52; i++) await add(ui, `note ${i}`)
  await ui.redraw()
  const saved = (await stored($)) as { id: number; text: string }[]
  expect(saved.length).toBe(50)
  expect(saved[0]!.text).toBe('note 3')
  expect(saved[49]!.text).toBe('note 52')
  // rows 15 -> room 10: note 52..note 43 shown, 40 older folded
  expect((await ui.findAll({ type: 'Button' })).length).toBe(10)
  expect((await ui.find({ type: 'Text', text: '... and 40 more older notes' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('Hebrew "more" line', { timeoutMs: 30_000 }, async ($, on) => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, text: `n${i + 1}` }))
  setup(on, { language: 'he', [`notes:${CWD}`]: many })
  await start($)
  await $.command.run({ command: 'notes', args: '' })
  const ui = await mount($, 'terminal', { viewport: { columns: 100, rows: 8 } })
  // room 3 -> 5 older
  expect((await ui.find({ type: 'Text', text: '... ועוד 5 הערות ישנות' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('a pane opened before the command ran (no folder yet) ignores input', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const ui = await mount($)
  await add(ui, 'lost')
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: 'No notes in this folder.' }))?.text).toBeTruthy()
  await ui.unmount()
})

test('off switch: command and pane say off', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { enabled: { notes: false }, [`notes:${CWD}`]: [{ id: 1, text: 'hidden' }] })
  await start($)
  expect(s.registered).toContain('notes')
  const r = await $.command.run({ command: 'notes', args: '' })
  expect((r as any).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(s.opened).not.toContain('notes')
  const ui = await mount($)
  expect((await ui.find({ type: 'Text', text: 'The feature is off in the switchboard.' }))?.text).toBeTruthy()
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  await ui.unmount()
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he', enabled: { notes: false } })
  await start($)
  const r = await $.command.run({ command: 'notes', args: '' })
  expect((r as any).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
