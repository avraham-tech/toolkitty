import { expect, test } from 'claude-code/testing'
import { PANE, joined, start, world } from './harness'

const SW = (surface: 'desktop' | 'terminal' = 'desktop') => ({ ...PANE('toolkitty'), surface }) as const

const buttons = async (ui: any): Promise<any[]> => ui.findAll({ type: 'Button' })
const rowIds = async (ui: any): Promise<string[]> => (await buttons(ui)).map((b: any) => String(b.key)).filter((k: string) => k.startsWith('t-')).map((k: string) => k.slice(2))
const rowTitles = async (ui: any): Promise<string[]> => (await buttons(ui)).filter((b: any) => String(b.key).startsWith('t-')).map((b: any) => String(b.props['label']).slice(2))
const keysOf = async (ui: any): Promise<string[]> => (await buttons(ui)).map((b: any) => String(b.key))
const typeInto = (ui: any, text: string) => ui.input({ key: 'sb-search', text, kind: 'change' })
/** The one-letter headings of the A–Z view, in order. */
const headings = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)).filter((x: string) => [...x].length === 1)
const initial = (title: string): string => {
  const ch = title.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toLocaleUpperCase()
  return /\p{L}/u.test(ch) ? ch : '#'
}
const unique = (xs: string[]): string[] => xs.filter((x, i) => xs.indexOf(x) === i)
const invalidate = (on: any) => on('ui.invalidate', () => ({ value: undefined }))

// ---------- the search field ----------

test('desktop: a search field under the header, the view button, no Find button', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  invalidate(on)
  await start($)
  const ui = await $.ui.mount(SW())
  const input = await ui.find({ key: 'sb-search' })
  expect(input).toBeTruthy()
  expect(input!.props['placeholder']).toBe('Search features…')
  expect(input!.props['value']).toBe('')
  const keys = await keysOf(ui)
  expect(keys).toContain('sb-view')
  expect(keys).not.toContain('sb-find')
  expect((await ui.find({ key: 'sb-view' }))!.props['label']).toBe('⇅ Groups')
  // nothing typed: the grouped view, no status, no chips
  expect(await joined(ui)).toContain('Eye candy')
  expect(await joined(ui)).not.toMatch(/matches?\b/)
  expect(keys.some(k => k.startsWith('sb-jump-'))).toBe(false)
  await ui.unmount()
})

test('typing narrows the list to one flat list with an "N matches" status; clearing restores the groups', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  const all = await rowIds(ui)
  await typeInto(ui, 'git')
  const hits = await rowIds(ui)
  expect(hits.length).toBeGreaterThan(1)
  expect(hits.length).toBeLessThan(all.length)
  expect(hits).toContain('git-context')
  const text = await joined(ui)
  expect(text).toContain(`${hits.length} matches`)
  expect(text).not.toContain('Eye candy')
  expect((await ui.find({ key: 'sb-search' }))!.props['value']).toBe('git')
  // a row of the flat list still toggles, with its usual key
  await ui.press({ key: 't-git-context' })
  expect((await ui.find({ key: 't-git-context' }))!.props['label']).toBe('○ Git context')
  await ui.press({ key: 't-git-context' })
  expect((await ui.find({ key: 't-git-context' }))!.props['label']).toBe('● Git context')
  // an empty query is the grouped view again
  await typeInto(ui, '')
  expect(await rowIds(ui)).toEqual(all)
  expect(await joined(ui)).toContain('Eye candy')
  expect(await joined(ui)).not.toMatch(/\d+ matches/)
  await ui.unmount()
})

test('one match says "1 match"; case and surrounding spaces do not matter', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, '  TROPHIES ')
  expect(await rowIds(ui)).toEqual(['achievements'])
  expect(await joined(ui)).toContain('1 match')
  await ui.unmount()
})

test('a command name finds its feature, with or without the slash', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  // "trophies" is the command of Achievements, which neither its title nor its id spell
  await typeInto(ui, 'trophies')
  expect(await rowIds(ui)).toEqual(['achievements'])
  await typeInto(ui, '/trophies')
  expect(await rowIds(ui)).toEqual(['achievements'])
  await typeInto(ui, 'subagents')
  expect(await rowIds(ui)).toContain('agents-monitor')
  await ui.unmount()
})

test('the id finds a row too, even with a hyphen or a space', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'task-pulse')
  expect(await rowIds(ui)).toContain('task-pulse')
  await typeInto(ui, 'task pulse')
  expect(await rowIds(ui)).toContain('task-pulse')
  await ui.unmount()
})

test('Hebrew UI: the English id, the English title and the Hebrew title all find the same row', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 't-buddy' }))!.props['label']).toBe('● חבר')
  for (const q of ['buddy', 'BUDDY', 'חבר', 'חָבֵר', 'bud']) {
    await typeInto(ui, q)
    const ids = await rowIds(ui)
    expect(ids, q).toContain('buddy')
    expect((await ui.find({ key: 't-buddy' }))!.props['label'], q).toBe('● חבר')
  }
  // the status is in Hebrew
  expect(await joined(ui)).toMatch(/תוצאות|תוצאה אחת/)
  expect((await ui.find({ key: 'sb-search' }))!.props['placeholder']).toBe('חיפוש שכלולים…')
  // a command still works in Hebrew
  await typeInto(ui, 'trophies')
  expect(await rowIds(ui)).toEqual(['achievements'])
  await ui.unmount()
})

test('English UI does not search the other languages (only the current one and English)', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'חבר')
  expect(await rowIds(ui)).toEqual([])
  await ui.unmount()
})

test('accents do not matter (Spanish)', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'es' } })
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'sesión')
  const accented = await rowIds(ui)
  await typeInto(ui, 'sesion')
  const plain = await rowIds(ui)
  expect(accented.length).toBeGreaterThan(0)
  expect(plain).toEqual(accented)
  await ui.unmount()
})

test('relevance: title starts with it, then title or id contains it, then description', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'error')
  const ids = await rowIds(ui)
  const titles = await rowTitles(ui)
  // the first row's title starts with the query
  expect(titles[0]).toBe('Error detective')
  // a title that merely contains it comes before rows that matched only through their description
  expect(ids.indexOf('explain-error')).toBeLessThan(ids.indexOf('session-replay'))
  expect(ids.indexOf('explain-error')).toBeLessThan(ids.indexOf('buddy'))
  // an id-only match (Failure counter, id error-counter) is still ahead of the description-only rows
  expect(ids.indexOf('error-counter')).toBeLessThan(ids.indexOf('session-replay'))
  expect(ids.indexOf('error-detective')).toBe(0)
  await ui.unmount()
})

test('nothing matches: the empty state names the query and Clear brings everything back', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  const all = await rowIds(ui)
  await typeInto(ui, 'zzzqqq')
  expect(await rowIds(ui)).toEqual([])
  expect(await joined(ui)).toContain("Nothing matches 'zzzqqq'")
  expect(await keysOf(ui)).toContain('sb-clear')
  await ui.press({ key: 'sb-clear' })
  expect(await rowIds(ui)).toEqual(all)
  expect((await ui.find({ key: 'sb-search' }))!.props['value']).toBe('')
  expect(await joined(ui)).toContain('Eye candy')
  expect(await keysOf(ui)).not.toContain('sb-clear')
  await ui.unmount()
})

test('the empty state in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'zzzqqq')
  expect(await joined(ui)).toContain("שום דבר לא תואם 'zzzqqq'")
  expect((await ui.find({ key: 'sb-clear' }))!.props['label']).toBe('נקה')
  await ui.unmount()
})

test('the query is per session: it is not stored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'git')
  expect([...w.store.keys()].some(k => k.includes('query') || k.includes('search'))).toBe(false)
  expect(w.storeSets.some(s => s.value === 'git')).toBe(false)
  await ui.unmount()
})

test('the existing row buttons and the header keep their keys while searching', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await typeInto(ui, 'buddy')
  const keys = await keysOf(ui)
  expect(keys).toEqual(expect.arrayContaining(['lang', 'all-on', 'all-off', 'save-default', 'factory', 't-buddy', 'star-buddy', 'open-buddy']))
  await ui.press({ key: 'open-buddy' })
  expect(w.opened.some(o => o.id === 'buddy')).toBe(true)
  await ui.press({ key: 'star-buddy' })
  expect(w.store.get('autoOpen')).toEqual(['buddy'])
  await ui.unmount()
})

// ---------- the terminal ----------

test('terminal: no text field, a Find button that asks with a question', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  const ui = await $.ui.mount(SW('terminal'))
  const keys = await keysOf(ui)
  expect(keys).not.toContain('sb-search')
  expect(keys).toContain('sb-find')
  expect((await ui.find({ key: 'sb-find' }))!.props['label']).toBe('🔎 Find')
  const all = await rowIds(ui)

  w.askAnswer = 'buddy'
  await ui.press({ key: 'sb-find' })
  expect(w.asked).toEqual(['What do you want to find?'])
  const hits = await rowIds(ui)
  expect(hits).toContain('buddy')
  expect(hits.length).toBeLessThan(all.length)
  expect((await ui.find({ key: 'sb-find' }))!.props['label']).toBe('🔎 buddy')
  expect(await joined(ui)).toContain(`${hits.length} match`)

  // Cancel keeps the search
  w.askAnswer = 'Cancel'
  await ui.press({ key: 'sb-find' })
  expect(await rowIds(ui)).toEqual(hits)

  // Clear search drops it
  w.askAnswer = 'Clear search'
  await ui.press({ key: 'sb-find' })
  expect(await rowIds(ui)).toEqual(all)
  expect((await ui.find({ key: 'sb-find' }))!.props['label']).toBe('🔎 Find')

  // nothing matches on the terminal too, and Clear works there
  w.askAnswer = 'zzzqqq'
  await ui.press({ key: 'sb-find' })
  expect(await joined(ui)).toContain("Nothing matches 'zzzqqq'")
  await ui.press({ key: 'sb-clear' })
  expect(await rowIds(ui)).toEqual(all)
  await ui.unmount()
})

test('terminal in Hebrew: the Find button and the question', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  await start($, 'terminal')
  const ui = await $.ui.mount(SW('terminal'))
  expect((await ui.find({ key: 'sb-find' }))!.props['label']).toBe('🔎 חפש')
  w.askAnswer = 'buddy'
  await ui.press({ key: 'sb-find' })
  expect(w.asked).toEqual(['מה לחפש?'])
  expect(await rowIds(ui)).toContain('buddy')
  await ui.unmount()
})

// ---------- the A–Z view ----------

for (const [lang, locale] of [['en', 'en'], ['he', 'he']] as const) {
  test(`A–Z view (${lang}): sorted by title with the ${locale} collation, a heading before each initial`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on, { store: { language: lang } })
    invalidate(on)
    await start($)
    const ui = await $.ui.mount(SW())
    const grouped = await rowIds(ui)
    await ui.press({ key: 'sb-view' })
    expect(w.store.get('switchboard:view')).toBe('az')
    await ui.redraw()
    expect((await ui.find({ key: 'sb-view' }))!.props['label']).toBe(lang === 'he' ? '⇅ א–ת' : '⇅ A–Z')
    const ids = await rowIds(ui)
    const titles = await rowTitles(ui)
    // the same rows, in another order
    expect([...ids].sort()).toEqual([...grouped].sort())
    expect(titles.length).toBe(grouped.length)
    for (let i = 1; i < titles.length; i++) {
      expect(titles[i - 1]!.localeCompare(titles[i]!, locale), `${titles[i - 1]} before ${titles[i]}`).toBeLessThanOrEqual(0)
    }
    // no group titles in this view; one heading per initial, in order of appearance
    expect(await joined(ui)).not.toContain('Eye candy')
    const heads = await headings(ui)
    expect(heads).toEqual(unique(titles.map(initial)))
    expect(heads.length).toBeGreaterThan(5)
    if (lang === 'he') expect(heads).toContain('ח')
    else expect(heads.slice(0, 2)).toEqual(['A', 'B'])
    await ui.unmount()
  })
}

test('A–Z: the search narrows it and keeps the alphabetical order and headings', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  invalidate(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  await typeInto(ui, 'git')
  const titles = await rowTitles(ui)
  expect(titles.length).toBeGreaterThan(1)
  expect(titles).toContain('Git context')
  for (let i = 1; i < titles.length; i++) expect(titles[i - 1]!.localeCompare(titles[i]!, 'en')).toBeLessThanOrEqual(0)
  expect(await headings(ui)).toEqual(unique(titles.map(initial)))
  expect(await joined(ui)).toContain(`${titles.length} matches`)
  // few rows: no letter chips
  expect((await keysOf(ui)).some(k => k.startsWith('sb-jump-'))).toBe(false)
  // and an empty result has the same empty state
  await typeInto(ui, 'zzzqqq')
  expect(await joined(ui)).toContain("Nothing matches 'zzzqqq'")
  await ui.press({ key: 'sb-clear' })
  expect((await rowIds(ui)).length).toBeGreaterThan(70)
  await ui.unmount()
})

test('the view is remembered: a new pane, a new session, and back to Groups', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  invalidate(on)
  await start($)
  let ui = await $.ui.mount(SW())
  const grouped = await rowIds(ui)
  expect(w.store.has('switchboard:view')).toBe(false)
  await ui.press({ key: 'sb-view' })
  await ui.unmount()

  // a fresh drawing reads the store
  ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 'sb-view' }))!.props['label']).toBe('⇅ A–Z')
  const az = await rowIds(ui)
  expect(az).not.toEqual(grouped)
  await ui.unmount()

  // a terminal drawing too
  ui = await $.ui.mount(SW('terminal'))
  expect((await ui.find({ key: 'sb-view' }))!.props['label']).toBe('⇅ A–Z')
  await ui.unmount()

  ui = await $.ui.mount(SW())
  await ui.press({ key: 'sb-view' })
  expect(w.store.get('switchboard:view')).toBe('groups')
  await ui.redraw()
  expect(await rowIds(ui)).toEqual(grouped)
  expect(await joined(ui)).toContain('Eye candy')
  await ui.unmount()
})

test('a stored view of "az" survives a restart of the session', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'switchboard:view': 'az' } })
  await start($)
  const ui = await $.ui.mount(SW())
  expect((await ui.find({ key: 'sb-view' }))!.props['label']).toBe('⇅ A–Z')
  expect(await joined(ui)).not.toContain('Eye candy')
  await ui.unmount()
})

// ---------- quick jump ----------

test('A–Z with 20+ rows: letter chips for the letters that occur; a chip filters, the same chip again lifts it', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  invalidate(on)
  await start($)
  const ui = await $.ui.mount(SW())
  // not in the grouped view
  expect((await keysOf(ui)).some(k => k.startsWith('sb-jump-'))).toBe(false)
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  const titles = await rowTitles(ui)
  expect(titles.length).toBeGreaterThanOrEqual(20)
  const letters = unique(titles.map(initial))
  const chips = (await keysOf(ui)).filter(k => k.startsWith('sb-jump-')).map(k => k.slice('sb-jump-'.length))
  expect(chips).toEqual(letters)
  // a letter that does not occur has no chip
  expect(chips).not.toContain('Q')
  expect(await keysOf(ui)).not.toContain('sb-letter-clear')

  const pick = letters.find(l => titles.filter(x => initial(x) === l).length > 2) ?? letters[0]!
  const expected = titles.filter(x => initial(x) === pick)
  await ui.press({ key: `sb-jump-${pick}` })
  expect(await rowTitles(ui)).toEqual(expected)
  expect(await joined(ui)).toContain(`starts with ${pick}`)
  expect(await headings(ui)).toEqual([pick])
  // the chips stay, so another letter is one press away
  expect((await keysOf(ui)).filter(k => k.startsWith('sb-jump-')).length).toBe(letters.length)
  expect(await keysOf(ui)).toContain('sb-letter-clear')

  // another letter replaces it
  const other = letters.find(l => l !== pick)!
  await ui.press({ key: `sb-jump-${other}` })
  expect(await rowTitles(ui)).toEqual(titles.filter(x => initial(x) === other))
  expect(await joined(ui)).toContain(`starts with ${other}`)

  // the same chip again clears
  await ui.press({ key: `sb-jump-${other}` })
  expect(await rowTitles(ui)).toEqual(titles)
  expect(await keysOf(ui)).not.toContain('sb-letter-clear')
  expect(await joined(ui)).not.toContain('starts with')

  // the Clear button next to the status lifts it too
  await ui.press({ key: `sb-jump-${pick}` })
  await ui.press({ key: 'sb-letter-clear' })
  expect(await rowTitles(ui)).toEqual(titles)
  await ui.unmount()
})

test('quick jump in Hebrew: Hebrew letter chips and the Hebrew status', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'switchboard:view': 'az' } })
  await start($)
  const ui = await $.ui.mount(SW())
  const titles = await rowTitles(ui)
  const letters = unique(titles.map(initial))
  const chips = (await keysOf(ui)).filter(k => k.startsWith('sb-jump-')).map(k => k.slice('sb-jump-'.length))
  expect(chips).toEqual(letters)
  expect(chips).toContain('ח')
  await ui.press({ key: 'sb-jump-ח' })
  const rows = await rowTitles(ui)
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.every(x => initial(x) === 'ח')).toBe(true)
  expect(await joined(ui)).toContain('מתחיל ב-ח')
  await ui.unmount()
})

test('the letter filter is combined with the search and dropped when its letter has no match any more', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  invalidate(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  await ui.press({ key: 'sb-jump-G' })
  const g = await rowTitles(ui)
  expect(g.every(x => initial(x) === 'G')).toBe(true)
  // search "context" (Git context, Context info...): only the G rows among its matches remain
  await typeInto(ui, 'context')
  const ctx = await rowTitles(ui)
  expect(ctx.every(x => initial(x) === 'G')).toBe(true)
  expect(ctx).toContain('Git context')
  // a search with no G among its matches: the stale letter is ignored instead of leaving an empty list
  await typeInto(ui, 'trophies')
  expect(await rowIds(ui)).toEqual(['achievements'])
  expect(await keysOf(ui)).not.toContain('sb-letter-clear')
  await ui.unmount()
})

test('switching back to Groups drops the letter filter', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  invalidate(on)
  await start($)
  const ui = await $.ui.mount(SW())
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  await ui.press({ key: 'sb-jump-G' })
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  expect((await rowIds(ui)).length).toBeGreaterThan(70)
  expect(await joined(ui)).toContain('Eye candy')
  expect(await joined(ui)).not.toContain('starts with')
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  expect(await keysOf(ui)).not.toContain('sb-letter-clear')
  await ui.unmount()
})

test('the A–Z view and the search work on the terminal as well', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  invalidate(on)
  await start($, 'terminal')
  const ui = await $.ui.mount(SW('terminal'))
  await ui.press({ key: 'sb-view' })
  await ui.redraw()
  const titles = await rowTitles(ui)
  for (let i = 1; i < titles.length; i++) expect(titles[i - 1]!.localeCompare(titles[i]!, 'en')).toBeLessThanOrEqual(0)
  await ui.press({ key: 'sb-jump-A' })
  expect((await rowTitles(ui)).every(x => initial(x) === 'A')).toBe(true)
  await ui.press({ key: 'sb-jump-A' })
  w.askAnswer = 'git'
  await ui.press({ key: 'sb-find' })
  expect(await rowIds(ui)).toContain('git-context')
  await ui.unmount()
})

test('an ✕ beside the search field clears the query; it is absent while the field is empty', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...SW(), surface: 'desktop' })
  expect(await ui.find({ key: 'sb-x' })).toBeUndefined()
  await typeInto(ui, 'bud')
  expect(await ui.find({ key: 'sb-x' })).toBeDefined()
  await ui.press({ key: 'sb-x' })
  expect(await ui.find({ key: 'sb-x' })).toBeUndefined()
  expect((await ui.find({ key: 'sb-search' }))!.props['value']).toBe('')
  await ui.unmount()
})
