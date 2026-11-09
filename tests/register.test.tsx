import { expect, test } from 'claude-code/testing'
import { BAND, PANE, joined, labels, lastNotice, noticeTexts, start, texts, turnDone, turnStart, world } from './harness'

const SW = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty'), surface }) as const
const DETAIL = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty-detail'), surface }) as const
const LANGS = ['en', 'he', 'es', 'fr', 'ru', 'zh', 'ja', 'pt', 'de', 'ko']
const ids = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string).filter((k: string) => k.startsWith('t-')).map((k: string) => k.slice(2))
const rowLabel = async (ui: any, id: string): Promise<string> => (await ui.find({ key: `t-${id}` }))!.props['label'] as string
const enabledOf = (w: any) => (w.store.get('enabled') ?? {}) as Record<string, boolean>
const headerKeys = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string).filter((k: string) => !/^(t|open|star|sb)-/.test(k))

/** A session with a busy turn behind it, so the band holds several lines. */
async function busy($: any, w: any) {
  w.limits = [
    { kind: 'five_hour', percentUsed: 60, resetsAt: new Date(2026, 10, 8, 15).toISOString() },
    { kind: 'seven_day', percentUsed: 30, resetsAt: new Date(2026, 10, 12).toISOString() },
  ]
  w.usage = { percent: 40, usd: 2 }
  await start($)
  await turnStart($)
  w.toolResult = { isError: true, result: 'x' }
  await $.tool.call({ tool: 'Bash', command: 'false' })
  w.toolResult = { result: {} }
  await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/a.ts', old_string: 'a', new_string: 'b' })
  await turnDone($, 5000)
}
const bandKeys = async (b: any): Promise<string[]> => (await b.findAll({ type: 'Button' })).map((x: any) => x.key as string)

// ---------- the switchboard ----------

for (const surface of ['desktop', 'terminal'] as const) {
  test(`switchboard on ${surface}: header, hint, groups and one row per feature`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on)
    await start($, surface)
    const ui = await $.ui.mount(SW(surface))
    const rows = await ids(ui)
    expect(rows.length).toBeGreaterThan(70)
    expect(new Set(rows).size).toBe(rows.length)
    expect(await headerKeys(ui)).toEqual(['lang', 'all-on', 'all-off', 'save-default', 'factory'])
    const all = await joined(ui)
    expect(all).toContain('Toolkitty')
    expect(all).toContain('Press a row to turn a feature on or off. /toolkitty reopens this pane.')
    // N/total active: count the filled rows
    let filled = 0
    for (const id of rows) if ((await rowLabel(ui, id)).startsWith('●')) filled++
    expect(all).toContain(`${filled}/${rows.length} active`)
    // aurora is the one default-off feature among the known ones
    expect(await rowLabel(ui, 'aurora-backdrop')).toBe('○ Aurora backdrop')
    expect(await rowLabel(ui, 'buddy')).toBe('● Buddy')
    // group titles and descriptions
    expect(all).toContain('Eye candy')
    expect(all).toContain('Setup & maintenance')
    expect(all).toContain('A companion pet that reacts to your session')
    void w
    await ui.unmount()
  })
}

test('each group of the switchboard has its own key', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  const keys = (await ui.findAll({ type: 'Box' })).map((b: any) => b.key as string | undefined).filter((k: string | undefined): k is string => k !== undefined && k.startsWith('g-'))
  expect(keys.length).toBeGreaterThan(5)
  expect(new Set(keys).size).toBe(keys.length)
  await ui.unmount()
})

test('the language button opens a picker of all languages; picking one keeps it and redraws', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 'lang' }))!.props['label']).toBe('🌐 English')
  expect(await ui.find({ key: 'lang-he' })).toBeUndefined()
  await ui.press({ key: 'lang' })
  for (const l of LANGS) expect(await ui.find({ key: `lang-${l}` })).toBeDefined()
  expect((await ui.find({ key: 'lang-en' }))!.props['label']).toBe('● English')
  await ui.press({ key: 'lang-he' })
  expect(w.store.get('language')).toBe('he')
  expect(await ui.find({ key: 'lang-he' })).toBeUndefined() // the picker closes
  expect((await ui.find({ key: 'lang' }))!.props['label']).toBe('🌐 עברית')
  expect(await labels(ui)).toContain('הפעל הכל')
  expect(await joined(ui)).toContain('לחיצה על שורה מפעילה או מכבה את השכלול')
  expect(await rowLabel(ui, 'buddy')).toBe('● חבר')
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-es' })
  expect(await labels(ui)).toContain('Activar todo')
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-fr' })
  expect(await labels(ui)).toContain('Tout activer')
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-ru' })
  expect(await labels(ui)).toContain('Включить всё')
  expect(await rowLabel(ui, 'buddy')).toBe('● Питомец')
  // a language with no translations yet falls back to English
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-ja' })
  expect(w.store.get('language')).toBe('ja')
  expect((await ui.find({ key: 'lang' }))!.props['label']).toBe('🌐 日本語')
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-ru' })
  await ui.unmount()
  // the language also reaches commands
  const r = await $.command.run({ command: 'toolkitty', args: '' })
  expect(r.text).toBe('Панель Toolkitty открыта.')
})

test('the saved language is restored at the next session start', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'fr' } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 'lang' }))!.props['label']).toBe('🌐 Français')
  expect(await labels(ui)).toContain('Tout activer')
  await ui.unmount()
})

test('all off, all on, factory, and undo', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false, notes: false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  const rows = await ids(ui)
  expect(await headerKeys(ui)).not.toContain('undo-all')

  await ui.press({ key: 'all-off' })
  for (const id of rows) expect(await rowLabel(ui, id), id).toMatch(/^○/)
  expect(Object.keys(enabledOf(w)).length).toBe(rows.length)
  expect(Object.values(enabledOf(w)).every(v => v === false)).toBe(true)
  expect(await joined(ui)).toContain(`0/${rows.length} active`)
  expect(await headerKeys(ui)).toContain('undo-all')
  expect(w.store.get('enabled-undo')).toEqual({ buddy: false, notes: false })

  await ui.press({ key: 'undo-all' })
  expect(enabledOf(w)).toEqual({ buddy: false, notes: false })
  expect(await rowLabel(ui, 'task-pulse')).toMatch(/^●/)
  expect(await rowLabel(ui, 'buddy')).toMatch(/^○/)
  expect(w.store.get('enabled-undo')).toBeNull()
  expect(await headerKeys(ui)).not.toContain('undo-all')

  await ui.press({ key: 'all-on' })
  for (const id of rows) expect(await rowLabel(ui, id), id).toMatch(/^●/)
  expect(Object.values(enabledOf(w)).every(v => v === true)).toBe(true)
  expect(await joined(ui)).toContain(`${rows.length}/${rows.length} active`)

  await ui.press({ key: 'factory' })
  expect(await rowLabel(ui, 'aurora-backdrop')).toMatch(/^○/)
  expect(await rowLabel(ui, 'buddy')).toMatch(/^●/)
  expect(enabledOf(w)['aurora-backdrop']).toBe(false)
  expect(enabledOf(w)['buddy']).toBe(true)
  expect(Object.keys(enabledOf(w)).length).toBe(rows.length)
  await ui.unmount()
})

test('all off twice does not lose the way back', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  await ui.press({ key: 'all-off' })
  await ui.press({ key: 'all-off' })
  await ui.press({ key: 'undo-all' })
  expect(enabledOf(w)).toEqual({ buddy: false })
  expect(await rowLabel(ui, 'task-pulse')).toMatch(/^●/)
  await ui.unmount()
})

test('save as my default, change, restore my default', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { buddy: false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect(await headerKeys(ui)).not.toContain('restore-default')
  await ui.press({ key: 'save-default' })
  // an info notice now (notices pane), not a toast
  expect(await noticeTexts($)).toContain('Saved: this set of features is now your default.')
  expect(w.toasts).not.toContain('Saved: this set of features is now your default.')
  const saved = w.store.get('enabled-default') as Record<string, boolean>
  expect(saved['buddy']).toBe(false)
  expect(saved['task-pulse']).toBe(true)
  expect(saved['aurora-backdrop']).toBe(false)
  expect(Object.keys(saved).length).toBe((await ids(ui)).length)
  expect(await headerKeys(ui)).toContain('restore-default')

  await ui.press({ key: 'all-off' })
  expect(await rowLabel(ui, 'task-pulse')).toMatch(/^○/)
  await ui.press({ key: 'restore-default' })
  expect(await rowLabel(ui, 'task-pulse')).toMatch(/^●/)
  expect(await rowLabel(ui, 'buddy')).toMatch(/^○/)
  expect(enabledOf(w)).toEqual(saved)
  await ui.unmount()
})

test('the saved default survives into a new session', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'enabled-default': { buddy: false } } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect(await headerKeys(ui)).toContain('restore-default')
  await ui.press({ key: 'restore-default' })
  expect(enabledOf(w)).toEqual({ buddy: false })
  await ui.unmount()
})

test('every row toggles, persists to the store, and flips back', { timeoutMs: 60_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  const rows = await ids(ui)
  for (const id of rows) {
    const before = await rowLabel(ui, id)
    const wasOn = before.startsWith('●')
    await ui.press({ key: `t-${id}` })
    expect(enabledOf(w)[id], id).toBe(!wasOn)
    expect((await rowLabel(ui, id)).startsWith('●'), id).toBe(!wasOn)
    // the name in the label does not change
    expect((await rowLabel(ui, id)).slice(1), id).toBe(before.slice(1))
  }
  // a second pass flips them all back
  for (const id of rows) await ui.press({ key: `t-${id}` })
  for (const id of rows) expect(typeof enabledOf(w)[id], id).toBe('boolean')
  expect(await joined(ui)).toMatch(/\d+\/\d+ active/)
  await ui.unmount()
})

test('a row toggle reaches the feature at once', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': 4242 } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('Your buddy is here.')
  await ui.press({ key: 't-buddy' })
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  await ui.press({ key: 't-buddy' })
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('Your buddy is here.')
  await ui.unmount()
})

test('the enabled map the store holds at start is what the rows show', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { 'task-pulse': false, 'aurora-backdrop': true } } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect(await rowLabel(ui, 'task-pulse')).toMatch(/^○/)
  expect(await rowLabel(ui, 'aurora-backdrop')).toMatch(/^●/)
  await ui.unmount()
})

// ---------- /toolkitty ----------

test('/toolkitty opens the focused pane; /toolkitty help asks the model', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('toolkitty')
  const r = await $.command.run({ command: 'toolkitty', args: '' })
  expect(r.text).toBe('Toolkitty pane opened.')
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty', title: 'Toolkitty', focus: true })
  const r2 = await $.command.run({ command: 'toolkitty', args: '   ' })
  expect(r2.text).toBe('Toolkitty pane opened.')
  // anything else that is not "help" also opens the pane
  expect((await $.command.run({ command: 'toolkitty', args: 'helpful' })).text).toBe('Toolkitty pane opened.')
  expect((await $.command.run({ command: 'toolkitty', args: 'foo' })).text).toBe('Toolkitty pane opened.')
  expect(w.modelPrompts).toEqual([])
})

test('/toolkitty help <question> sends the catalogue and the question, answers with the model text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.modelText = 'Use /buddy to meet your companion.'
  await start($)
  const r = await $.command.run({ command: 'toolkitty', args: 'help how do I rename my buddy?' })
  expect(r.text).toBe('Toolkitty help\n\nUse /buddy to meet your companion.')
  expect(w.modelPrompts.length).toBe(1)
  const prompt = w.modelPrompts[0]!
  expect(prompt).toContain('in English')
  expect(prompt).toContain('Question: how do I rename my buddy?')
  expect(prompt).toContain('"Buddy" (buddy): A companion pet')
  expect(prompt).toContain('(turn-receipt)')
  expect(prompt).toContain('(project-config)')
  expect(prompt.split('\n').filter(l => l.startsWith('- "')).length).toBeGreaterThan(70)
  // the pane does not open for a help question
  expect(w.opened.filter(o => o.id === 'toolkitty' && (o as any).focus).length).toBe(0)
})

test('/toolkitty help with no question, in any case', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const r = await $.command.run({ command: 'toolkitty', args: 'HELP' })
  expect(r.text).toBe('Toolkitty help\n\nmodel says hi')
  expect(w.modelPrompts[0]).toContain('Question: What can this plugin do?')
  await $.command.run({ command: 'toolkitty', args: ' Help   what is cost meter ' })
  expect(w.modelPrompts[1]).toContain('Question: what is cost meter')
})

test('/toolkitty help when the model gives no answer', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.modelText = undefined
  await start($)
  const r = await $.command.run({ command: 'toolkitty', args: 'help anything' })
  expect(r.text).toBe('Toolkitty help\n\nNo answer came back; try again.')
})

test('/toolkitty help in Hebrew asks for a Hebrew answer', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($)
  const r = await $.command.run({ command: 'toolkitty', args: 'help מה זה' })
  expect(r.text).toBe('עזרה ל-Toolkitty\n\nmodel says hi')
  expect(w.modelPrompts[0]).toContain('in עברית')
  expect(w.modelPrompts[0]).toContain('Question: מה זה')
  expect(w.modelPrompts[0]).toContain('"חבר" (buddy)')
})

test('/toolkitty pane opened in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'toolkitty', args: '' })).text).toBe('לוח ה-Toolkitty נפתח.')
})

// ---------- opening the pane: session.start, session.attach, turn.start ----------

test('session start with a surface opens the pane and announces the load', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const opened = w.opened.filter(o => o.id === 'toolkitty')
  expect(opened.length).toBe(1)
  expect(w.toasts.filter(x => /^Toolkitty loaded: \d+ features$/.test(x)).length).toBe(1)
  const ui = await $.ui.mount(SW())
  const n = (await ids(ui)).length
  expect(w.toasts).toContain(`Toolkitty loaded: ${n} features`)
  await ui.unmount()
  // a later turn does not open it again
  await turnStart($)
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
})

test('session start where the pane cannot be drawn says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.openPlaced = false
  await start($)
  expect(w.toasts.some(x => x.startsWith('Toolkitty loaded:') && x.includes('(pane not drawn: /toolkitty opens it)'))).toBe(true)
})

test('session start with no surface waits for session.attach, then opens once', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [] })
  await start($)
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(0)
  expect(w.toasts.some(x => x.startsWith('Toolkitty loaded'))).toBe(false)
  w.surfaces = ['desktop']
  await $.session.attach({ surface: 'desktop', clientId: 'c1' })
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
  expect(w.toasts.filter(x => x.startsWith('Toolkitty loaded')).length).toBe(1)
  await $.session.attach({ surface: 'terminal', clientId: 'c2' })
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
})

test('a failed open is retried at the next attach', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.failOpen = true
  await start($)
  expect(w.toasts.some(x => x.startsWith('Toolkitty loaded'))).toBe(false)
  w.failOpen = false
  await $.session.attach({ surface: 'desktop', clientId: 'c1' })
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
  expect(w.toasts.filter(x => x.startsWith('Toolkitty loaded')).length).toBe(1)
})

test('a turn starting with a surface opens a pane that is still wanted', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { surfaces: [] })
  await start($)
  w.surfaces = ['terminal']
  await turnStart($)
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
  await turnStart($)
  expect(w.opened.filter(o => o.id === 'toolkitty').length).toBe(1)
})

test('the load announcement is in the chosen language', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($)
  expect(w.toasts.some(x => /^Toolkitty נטען: \d+ שכלולים$/.test(x))).toBe(true)
})

// ---------- the band ----------

/** Opens the full band lines (if they are not open yet) and presses one. */
async function pressLine(b: any, slug: string): Promise<void> {
  if ((await b.find({ key: `band-${slug}` })) === undefined) await b.press({ key: 'toolkitty-band-toggle' })
  await b.press({ key: `band-${slug}` })
}
const chipKeys = async (b: any): Promise<string[]> => (await bandKeys(b)).filter(k => k.startsWith('chip-') && k !== 'chip-notices')
const lineKeys = async (b: any): Promise<string[]> => (await bandKeys(b)).filter(k => k.startsWith('band-'))
/** Quiet start: the weekly report would put a notice (and the bell) on every first session. */
const NO_REPORT = { enabled: { 'monday-report': false } }

test('the band is a row of chips and a toggle; the toggle opens and closes the full lines', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242, ...NO_REPORT } })
  await busy($, w)
  for (const surface of ['desktop', 'terminal'] as const) {
    const b = await $.ui.mount({ ...BAND(surface), requestId: `band-${surface}` })
    // compact: chips only, never a full line, and the toggle last
    const compact = await bandKeys(b)
    expect((await chipKeys(b)).length).toBeGreaterThanOrEqual(2)
    expect(await lineKeys(b)).toEqual([])
    expect(compact[compact.length - 1]).toBe('toolkitty-band-toggle')
    const toggle = (await b.find({ key: 'toolkitty-band-toggle' }))!
    const hidden = Number(/(\d+) more/.exec(toggle.props['label'] as string)![1])
    expect(hidden).toBeGreaterThan(0)

    await b.press({ key: 'toolkitty-band-toggle' })
    expect((await lineKeys(b)).length).toBe(hidden)
    expect((await chipKeys(b)).length).toBeGreaterThanOrEqual(2)
    expect((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label']).toBe('▴ less')

    await b.press({ key: 'toolkitty-band-toggle' })
    expect(await lineKeys(b)).toEqual([])
    expect((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label']).toBe(`⋯ ${hidden} more`)
    await b.unmount()
  }
})

test('the band toggle in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he', 'buddy:seed': 4242 } })
  await busy($, w)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  expect(((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label'] as string)).toMatch(/^⋯ עוד \d+$/)
  await b.press({ key: 'toolkitty-band-toggle' })
  expect((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label']).toBe('▴ פחות')
  await b.unmount()
})

test('a quiet session: an idle buddy has no chip, only its full line behind the toggle', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': 4242, ...NO_REPORT } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  // the advisor's headline chip is always first while that feature is on
  expect(await bandKeys(b)).toEqual(['chip-advisor', 'toolkitty-band-toggle'])
  expect((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label']).toBe('⋯ 1 more')
  await b.press({ key: 'toolkitty-band-toggle' })
  expect(await bandKeys(b)).toEqual(['chip-advisor', 'toolkitty-band-toggle', 'band-buddy'])
  await b.unmount()
})

test('with every feature off the band is empty', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242, ...NO_REPORT } })
  await start($)
  const sw = await $.ui.mount(SW())
  await sw.press({ key: 'all-off' })
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  expect(await bandKeys(b)).toEqual([])
  await sw.press({ key: 'all-on' })
  expect((await bandKeys(b)).length).toBeGreaterThan(0)
  await b.unmount()
  await sw.unmount()
  void w
})

test('a chip carries its icon and text, is pressable, and opens the feature detail', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242, ...NO_REPORT } })
  await busy($, w)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  const keys = await chipKeys(b)
  expect(keys.length).toBeGreaterThanOrEqual(2)
  for (const key of keys) {
    const slug = key.slice('chip-'.length)
    const chip = (await b.find({ key }))!
    expect(chip.type, slug).toBe('Button')
    expect(chip.text.trim().length, slug).toBeGreaterThan(0)
    await b.press({ key })
    expect(w.opened[w.opened.length - 1], slug).toMatchObject({ id: 'toolkitty-detail', focus: true, closeOnEscape: true })
  }
  await b.unmount()
})

test('the chips are sorted so that what needs attention comes first', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242, ...NO_REPORT } })
  await busy($, w)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  const order = ['alert', 'warn', 'info', 'ok']
  const colorOf = (c: any): string => (c?.props?.['color'] === 'error' ? 'alert' : c?.props?.['color'] === 'warning' ? 'warn' : c?.props?.['color'] === 'claude' ? 'info' : 'ok')
  // compact band: the only Texts are the chips' (and the bell's), in document order
  const levels = (await b.findAll({ type: 'Text' }))
    .filter((x: any) => !String(x.text).startsWith('🔔'))
    .map((x: any) => colorOf(x))
  expect(levels.length).toBe((await chipKeys(b)).length)
  expect(levels).toEqual([...levels].sort((x, y) => order.indexOf(x) - order.indexOf(y)))
  await b.unmount()
})

test('every band line opens its detail pane, with a toggle and a close button', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await busy($, w)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  await b.press({ key: 'toolkitty-band-toggle' })
  const lines = (await bandKeys(b)).filter(k => k.startsWith('band-') && k !== 'toolkitty-band-toggle')
  expect(lines.length).toBeGreaterThanOrEqual(4)
  for (const key of lines) {
    const slug = key.slice('band-'.length)
    await b.press({ key })
    expect(w.opened[w.opened.length - 1], slug).toMatchObject({ id: 'toolkitty-detail', title: 'Toolkitty', focus: true, closeOnEscape: true })
    const d = await $.ui.mount(DETAIL())
    const all = await joined(d)
    expect(all, slug).toContain('●')
    expect(all, slug).toMatch(/Details are recorded since the last load \(\d+:\d\d ago\)\./)
    expect(await labels(d), slug).toEqual(['Turn off', 'Close'])
    // the band line as it stands now sits in the detail
    const bandText = (await b.find({ key }))!.text
    expect(all, slug).toContain(bandText)
    // toggling turns the feature off and the button follows
    await d.press({ key: 'detail-toggle' })
    expect(enabledOf(w)[slug], slug).toBe(false)
    expect(await joined(d), slug).toContain('○')
    expect(await labels(d), slug).toEqual(['Turn on', 'Close'])
    await d.press({ key: 'detail-toggle' })
    expect(enabledOf(w)[slug], slug).toBe(true)
    expect(await labels(d), slug).toEqual(['Turn off', 'Close'])
    await d.press({ key: 'detail-close' })
    expect(w.closed[w.closed.length - 1], slug).toBe('toolkitty-detail')
    await d.unmount()
  }
  await b.unmount()
})

test('a detail pane lists the feature commands and its data', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242, 'buddy:name': 'Pixel' } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  await pressLine(b, 'buddy')
  const d = await $.ui.mount(DETAIL())
  const all = await joined(d)
  expect(all).toContain('Buddy')
  expect(all).toContain('A companion pet that reacts to your session')
  expect(all).toContain('🐾 Pixel · idle')
  expect(all).toContain('Commands: /buddy')
  expect(all).toContain('Pixel · ')
  void w
  await d.unmount()
  await b.unmount()
})

test('turning a feature off from its detail removes its band line', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  await pressLine(b, 'buddy')
  const d = await $.ui.mount(DETAIL())
  await d.press({ key: 'detail-toggle' })
  expect(await b.find({ key: 'band-buddy' })).toBeUndefined()
  // the detail of an off feature has no data, only the note
  expect(await joined(d)).toContain('Nothing more to show yet.')
  expect(enabledOf(w)['buddy']).toBe(false)
  await d.unmount()
  await b.unmount()
})

test('the detail pane in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'buddy:seed': 4242 } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  await pressLine(b, 'buddy')
  const d = await $.ui.mount(DETAIL('terminal'))
  expect(await labels(d)).toEqual(['כבה', 'סגור'])
  expect(await joined(d)).toContain('פקודות: /buddy')
  expect(await joined(d)).toMatch(/הפרטים נרשמים מאז הטעינה האחרונה/)
  await d.unmount()
  await b.unmount()
})

test('the detail pane before any line was pressed has nothing to show', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const d = await $.ui.mount(DETAIL())
  expect(await joined(d)).toBe('Nothing more to show yet.')
  expect(await d.find({ type: 'Button' })).toBeUndefined()
  await d.unmount()
})

// ---------- notices: the bell chip, the pane and the command ----------

const NOTICES = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty-notices'), surface }) as const
const HOME = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty-home'), surface }) as const
const MURKY = 'The water is getting murky: context is past 90%. Time to /compact or start fresh.'
const measure = ($: any, percent: number) => $.session.measure({ context: { window: 200000, percent }, rateLimits: [], changed: [] })
const buttonKeys = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((el: any) => el['key'] as string).filter((k: string) => !k.startsWith('live-'))

test('the bell chip counts unread notices; a press opens the pane and clears the count', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await start($) // the weekly report puts one notice in the center
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  const bell = (await b.find({ key: 'chip-notices' }))!
  expect(bell.text.trim()).toBe('🔔 1')
  expect((await b.find({ type: 'Text', text: '🔔 1' }))!.props['color']).toBe('claude')
  await measure($, 95) // a warn
  expect((await b.find({ key: 'chip-notices' }))!.text.trim()).toBe('🔔 2')
  await b.press({ key: 'chip-notices' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty-notices', focus: true, closeOnEscape: true })
  expect(await b.find({ key: 'chip-notices' })).toBeUndefined()
  // a new notice brings the bell back with a count of one
  await $.command.run({ command: 'themes', args: 'sunset' })
  expect((await b.find({ key: 'chip-notices' }))!.text.trim()).toBe('🔔 1')
  await b.unmount()
})

test('/notices opens the pane, in the chosen language', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('notices')
  const r = await $.command.run({ command: 'notices', args: '' })
  expect(r.text).toBe('Notices pane opened.')
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty-notices', focus: true, closeOnEscape: true })
  const ui = await $.ui.mount(NOTICES())
  expect(await joined(ui)).toContain('Notices')
  await ui.unmount()
})

test('/notices in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', enabled: { 'monday-report': false, achievements: false } } }) // achievements would post a Polyglot trophy for language != en
  await start($)
  expect((await $.command.run({ command: 'notices', args: '' })).text).toBe('פאנל ההתראות נפתח.')
  const ui = await $.ui.mount(NOTICES('terminal'))
  const all = await joined(ui)
  expect(all).toContain('התראות')
  expect(all).toContain('אין עדיין התראות.')
  expect(((await ui.find({ key: 'notices-clear' }))!.props['label'])).toBe('נקה')
  await ui.unmount()
})

test('the notices pane: an empty state, then the newest notice first with its level, then Clear', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { 'monday-report': false } } })
  await start($)
  const ui = await $.ui.mount(NOTICES())
  expect(await buttonKeys(ui)).toEqual(['notices-clear', 'notices-quiet', 'notices-toast'])
  expect((await ui.find({ key: 'notices-clear' }))!.props['label']).toBe('Clear')
  let all = await joined(ui)
  expect(all).toContain('No notices yet.')
  expect(all).toContain('Everything Toolkitty would have said shows up here; only prevented disasters and limits still pop up.')

  await measure($, 95) // warn
  await $.command.run({ command: 'themes', args: 'sunset' }) // info
  const rows = await texts(ui)
  expect(rows).toContain('Theme: Sunset')
  expect(rows).toContain(MURKY)
  expect(rows.indexOf('Theme: Sunset')).toBeLessThan(rows.indexOf(MURKY))
  expect(rows).toContain('themes')
  expect(rows).toContain('context-aquarium')
  // the pane's Texts are its title, its count, then per row the time, the text and the feature
  expect(rows.slice(0, 2)).toEqual(['Notices', '2 notices'])
  expect(rows[3]).toBe('Theme: Sunset')
  // the level is the row's color: warn is amber, info is quiet
  expect((await ui.find({ type: 'Text', text: MURKY }))!.props['color']).toBe('warning')
  expect((await ui.find({ type: 'Text', text: 'Theme: Sunset' }))!.props['color']).toBeUndefined()
  expect(await joined(ui)).not.toContain('No notices yet.')

  await ui.press({ key: 'notices-clear' })
  all = await joined(ui)
  expect(all).toContain('No notices yet.')
  expect(all).not.toContain(MURKY)
  await ui.unmount()
})

test('only an alert pops a toast; info and warn go to the notices alone', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'monday-report': false } } })
  await start($)
  const before = w.toasts.length
  await measure($, 95) // warn
  await $.command.run({ command: 'themes', args: 'sunset' }) // info
  expect(w.toasts.length).toBe(before)
  expect(await noticeTexts($)).toContain(MURKY)
})

// ---------- the home pane ----------

test('/home opens the home pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('home')
  expect((await $.command.run({ command: 'home', args: '' })).text).toBe('Toolkitty home opened.')
  // register.tsx opens the home pane without closeOnEscape (the notices pane has it): reported, asserted as it is
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty-home', focus: true })
})

test('/home in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'home', args: '' })).text).toBe('הבית של ה-Toolkitty נפתח.')
  const ui = await $.ui.mount(HOME('terminal'))
  const all = await joined(ui)
  expect(all).toContain('עכשיו')
  expect(all).toContain('התראות אחרונות')
  expect(all).toMatch(/\d+\/\d+ פעילים/)
  await ui.unmount()
})

test('the home pane when all is quiet: header with active count and actions, two sections with empty states', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { 'monday-report': false } } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(HOME(surface))
    // the advisor's headline chip is a row of its own, after the three header actions
    expect(await buttonKeys(ui)).toEqual(['home-switchboard', 'home-notices', 'home-help', 'home-advisor'])
    expect((await labels(ui)).slice(0, 3)).toEqual(['Switchboard', 'Notices', 'Help'])
    const all = await texts(ui)
    expect(all[0]).toBe('Toolkitty')
    expect(all[1]).toMatch(/^\d+\/\d+ active$/)
    expect(all).toContain('Right now')
    // the advisor always has its headline chip, so "Right now" is never empty while that feature is on
    expect(all).not.toContain('All quiet. Chips appear here as features have something to say.')
    expect(all.map(x => x.trim())).toContain('Smart Advisor')
    expect(all).toContain('Recent notices')
    expect(all).toContain('No notices yet.')
    await ui.unmount()
  }
})

test('the home pane with the advisor off: Right now is empty and says all is quiet', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { 'monday-report': false, advisor: false } } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(HOME(surface))
    expect(await buttonKeys(ui)).toEqual(['home-switchboard', 'home-notices', 'home-help'])
    expect(await texts(ui)).toContain('All quiet. Chips appear here as features have something to say.')
    await ui.unmount()
  }
})

test('the home pane lists the chips of the moment, each a row that opens its detail, and the recent notices', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await busy($, w)
  const ui = await $.ui.mount(HOME())
  const rows = (await buttonKeys(ui)).filter(k => k.startsWith('home-') && !['home-switchboard', 'home-notices', 'home-help'].includes(k))
  expect(rows.length).toBeGreaterThanOrEqual(2)
  expect(await joined(ui)).not.toContain('All quiet.')
  // the weekly report notice sits under "Recent notices"
  expect(await joined(ui)).toContain('Your weekly Toolkitty report is ready: /report')
  for (const key of rows) {
    const slug = key.slice('home-'.length)
    await ui.press({ key })
    expect(w.opened[w.opened.length - 1], slug).toMatchObject({ id: 'toolkitty-detail', focus: true, closeOnEscape: true })
  }
  await ui.unmount()
})

test('the home actions open the switchboard and the notices, and the help one says how to ask', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(HOME())
  await ui.press({ key: 'home-switchboard' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty', focus: true })
  await ui.press({ key: 'home-notices' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty-notices', focus: true, closeOnEscape: true })
  await ui.press({ key: 'home-help' })
  expect(w.toasts).toContain('Type /toolkitty help <question>')
  await ui.unmount()
})

// ---------- guards and chains ----------

test('a feature that throws is reported once, and the others go on', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  w.failUsage = true
  await start($)
  const failed = w.toasts.filter(x => /^Toolkitty: feature [\w-]+ failed: .+$/.test(x))
  expect(failed.length).toBeGreaterThan(0)
  expect(new Set(failed).size).toBe(failed.length)
  // the buddy (which never reads usage) still works
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('Your buddy is here.')
  // a second round reports nothing new for the same features
  const n = w.toasts.filter(x => x.includes(' failed: ')).length
  await turnStart($)
  await turnDone($)
  const after = w.toasts.filter(x => x.includes(' failed: '))
  expect(new Set(after).size).toBe(after.length)
  expect(after.length).toBeGreaterThanOrEqual(n)
})

test('failure notices are in the chosen language', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  w.failUsage = true
  await start($)
  expect(w.toasts.some(x => /^Toolkitty: השכלול [\w-]+ נכשל: .+$/.test(x))).toBe(true)
})

test('prompt.submit goes down the chain, a secret in it is masked on the way', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const plain = await $.prompt.submit({ text: 'please refactor the parser' })
  expect(plain.text).toBe('please refactor the parser')
  const secret = await $.prompt.submit({ text: 'deploy with key AKIAIOSFODNN7EXAMPLE now' })
  expect(secret.text).not.toContain('AKIAIOSFODNN7EXAMPLE')
  expect(secret.text).toContain('deploy with key')
  expect(secret.text).toContain('now')
})

test('prompt.submit rewrites chain: a snippet is expanded, then the result is scanned', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await $.command.run({ command: 'snippet', args: 'add leak Here is AKIAIOSFODNN7EXAMPLE for you' })
  const r = await $.prompt.submit({ text: '!leak please' })
  expect(r.text).not.toContain('AKIAIOSFODNN7EXAMPLE')
  expect(r.text).toContain('for you')
  expect(r.text).toContain('please')
  void w
})

test('a denied tool call stops the chain before the tool and the after-hooks', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 4242 } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })
  expect(typeof (r as any).deny).toBe('string')
  expect((r as any).deny.length).toBeGreaterThan(0)
  // no worried flash, and the live ticker's "working" signal for the denied call does not leave the buddy typing
  const alt = (await ui.find({ type: 'Svg' }))!.props['alt'] as string
  expect(alt).toMatch(/feeling idle$/)
  // a harmless call goes through
  w.toolResult = { result: {} }
  const ok = await $.tool.call({ tool: 'Bash', command: 'echo hi' })
  expect((ok as any).deny).toBeUndefined()
  await ui.unmount()
})

test('session.measure and turn.complete come back whole through their chains', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  await turnStart($)
  const m = await $.session.measure({ context: { window: 200000, percent: 50 }, rateLimits: [], changed: [] })
  expect(m).toEqual({ changed: [] })
  const c = await turnDone($, 1000)
  expect((c as any).text).toContain('ok')
})

test('the tool.check chain passes a verdict through', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  on('tool.check', () => ({ decision: 'allow' }) as any)
  await start($)
  const v = await $.tool.check({ tool: 'Bash', command: 'ls' } as any)
  expect((v as any).decision).toBe('allow')
  void w
})

test('/tk is an alias of /toolkitty: registered, opens the pane, takes the same arguments', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('tk')
  expect((await $.command.run({ command: 'tk', args: '' })).text).toBe('Toolkitty pane opened.')
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'toolkitty', focus: true })
  expect((await $.command.run({ command: 'tk', args: 'perf' })).text).toBe('Performance pane opened.')
  expect((await $.command.run({ command: 'toolkitty', args: 'perf' })).text).toBe('Performance pane opened.')
})
