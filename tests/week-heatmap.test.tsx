import { expect, test } from 'claude-code/testing'
import { DAY, NOON, PANE, dayKey, joined, lastNotice, start, svgOf, turnDone, turnStart, world, SHOWN } from './harness'

const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const USAGE = { input_tokens: 400, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' }
const GREEN = ['#2d333b', '#0e4429', '#006d32', '#26a641', '#39d353']

type Day = { turns: number; ms: number; tokens: number; cost: number }
const day = (turns: number, hours: number, tokens: number, cost: number): Day => ({ turns, ms: hours * 3_600_000, tokens, cost })

/** today (a Sunday), yesterday and the day before, then a run of five a while back. */
function seeded(): Record<string, Day> {
  const days: Record<string, Day> = {}
  days[dayKey(NOON)] = day(2, 2, 1000, 1.5)
  days[dayKey(NOON - DAY)] = day(2, 1, 500, 0.4)
  days[dayKey(NOON - 2 * DAY)] = day(1, 0.5, 100, 0.1)
  for (let i = 10; i < 15; i++) days[dayKey(NOON - i * DAY)] = day(1, 0.25, 50, 0.05)
  return days
}

const cells = async (ui: any): Promise<string[]> =>
  (await ui.findAll({ type: 'Box' })).map((b: any) => b.props.backgroundColor as string | undefined).filter((c: string | undefined): c is string => c !== undefined)

test('load: both commands are registered and open their panes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('heatmap')
  expect(w.cmds).toContain('wrapped')
  expect((await $.command.run({ command: 'heatmap', args: '' })).text).toBe('Opened.')
  expect(w.opened.map(o => o.id)).toContain('heatmap')
  expect((await $.command.run({ command: 'wrapped', args: '' })).text).toBe('Opened.')
  expect(w.opened.map(o => o.id)).toContain('wrapped')
  // arguments are ignored
  expect((await $.command.run({ command: 'wrapped', args: 'anything' })).text).toBe('Opened.')
})

test('commands in Hebrew and off', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' } })
  await start($)
  expect((await $.command.run({ command: 'heatmap', args: '' })).text).toBe('נפתח.')
  expect((await $.command.run({ command: 'wrapped', args: '' })).text).toBe('נפתח.')
})

test('off switch: commands and panes say so, turns record nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'week-heatmap': false } } })
  await start($)
  expect((await $.command.run({ command: 'heatmap', args: '' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'wrapped', args: '' })).text).toBe(OFF)
  for (const id of ['heatmap', 'wrapped']) {
    const ui = await $.ui.mount({ ...PANE(id), surface: 'desktop' })
    expect(await joined(ui)).toBe(OFF)
    await ui.unmount()
  }
  await turnStart($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  await turnDone($, 5000, { usage: USAGE })
  expect(w.store.get('week-heatmap:days')).toBeUndefined()
})

test('no data yet', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  for (const id of ['heatmap', 'wrapped']) {
    for (const surface of ['desktop', 'terminal'] as const) {
      const ui = await $.ui.mount({ ...PANE(id), surface })
      const all = await joined(ui)
      expect(all).toContain('No data yet: finish a turn and come back.')
      expect(all).toContain('Each finished turn adds to it; /heatmap and /wrapped open these panes.')
      expect(await ui.find({ type: 'Button' })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('the heatmap draws the 12-week grid with the right levels, streaks and totals', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE('heatmap'), surface })
    const all = await joined(ui)
    // a Sunday: the last column is whole, 12 x 7 = 84 cells, plus the 5 legend swatches
    const c = await cells(ui)
    expect(c.length).toBe(84 + 5)
    const count = (color: string) => c.filter(x => x === color).length
    expect(count('#39d353')).toBe(1 + 1) // today (max tokens) + legend
    expect(count('#006d32')).toBe(1 + 1) // yesterday: 500/1000 -> level 2
    expect(count('#0e4429')).toBe(1 + 1 + 5) // the day before at 10% -> level 1, and the five old days at 5%
    expect(count('#2d333b')).toBe(1 + (84 - 8)) // inactive days + legend
    expect(all).toContain('Current streak:')
    expect(all).toContain('3 days')
    expect(all).toContain('Longest streak:')
    expect(all).toContain('5 days')
    expect(all).toContain('Total hours:')
    expect(all).toContain('4.8') // 2 + 1 + .5 + 5*.25 = 4.75
    expect(all).toContain('Turns:')
    expect(all).toContain('Tokens 1.9K · Cost $2.25')
    expect(all).toContain('less')
    expect(all).toContain('more')
    expect(all).toContain('Nov')
    expect(all).toContain('Oct')
    // weekday letters: Monday first
    expect(all).toContain('M ')
    await ui.unmount()
  }
})

test('a Wednesday leaves the last column short', { timeoutMs: 30_000 }, async ($, on) => {
  const wed = new Date(2026, 10, 4, 12, 0, 0).getTime()
  const days: Record<string, Day> = { [dayKey(wed)]: day(1, 1, 10, 0.2) }
  world(on, { now: wed, store: { 'week-heatmap:days': days } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'terminal' })
  const c = await cells(ui)
  expect(c.length).toBe(80 + 5)
  expect(c.filter(x => x === '#39d353').length).toBe(2)
  await ui.unmount()
})

test('streak counts from yesterday when today has no turn yet', { timeoutMs: 30_000 }, async ($, on) => {
  const days: Record<string, Day> = {}
  for (let i = 1; i <= 4; i++) days[dayKey(NOON - i * DAY)] = day(1, 1, 10, 0.1)
  world(on, { store: { 'week-heatmap:days': days } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'desktop' })
  const all = await joined(ui)
  expect(all).toContain('4 days')
  await ui.unmount()
})

test('heatmap in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'desktop' })
  const all = await joined(ui)
  expect(all).toContain('רצף נוכחי')
  expect(all).toContain('3 ימים')
  expect(all).toContain('נוב')
  expect(await ui.find({ type: 'Button', key: 'open-wrapped' })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'open-wrapped' }))!.props['label']).toBe('פתח כרטיס Wrapped')
  await ui.unmount()
})

test('heatmap button opens the Wrapped pane, and Wrapped opens the heatmap', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const h = await $.ui.mount({ ...PANE('heatmap'), surface: 'desktop' })
  await h.press({ key: 'open-wrapped' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'wrapped' })
  await h.unmount()
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  await ui.press({ key: 'open-heatmap' })
  expect(w.opened[w.opened.length - 1]).toMatchObject({ id: 'heatmap' })
  await ui.unmount()
})

test('Wrapped on the desktop is an Svg card that follows the data', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded(), 'week-heatmap:tools': { Read: 3, Edit: 2 } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  const before = await svgOf(ui)
  expect(before.source.startsWith('<svg')).toBe(true)
  expect(before.source.length).toBeLessThan(128 * 1024)
  expect(before.alt).toBe('Claude Code Wrapped card: 4.8 hours, 10 turns, 1.9K tokens, $2.25, longest streak 5 days, The Newcomer')
  expect(before.source).toContain('CLAUDE CODE WRAPPED')
  expect(before.source).toContain('The Newcomer')
  expect(before.source).toContain('Claude Code · proj')
  expect(before.source).toContain('LAST 12 WEEKS')
  expect(before.source).toContain('8 active days')
  expect(await ui.find({ type: 'Button', key: 'save-svg' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'share-wrapped' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'open-heatmap' })).toBeDefined()

  // a real turn moves the card
  w.usage.usd = 1
  await start($)
  await turnStart($)
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'Edit', file_path: 'C:/proj/a.ts', old_string: 'a', new_string: 'b' })
  w.usage.usd = 3
  await turnDone($, 3_600_000, { usage: USAGE })
  const after = await svgOf(ui)
  expect(after.source).not.toBe(before.source)
  expect(after.alt).toContain('11 turns')
  expect(after.alt).toContain('5.8 hours')
  expect(after.alt).toContain('The Refactorer')
  expect(after.alt).toContain('$4.25')
  expect(after.source).toContain('Edit')
  expect(after.source).toContain('The Refactorer')
  await ui.unmount()
})

test('Wrapped on the terminal is a bordered card', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'week-heatmap:days': seeded(), 'week-heatmap:tools': { Read: 40, Edit: 20, Bash: 5 } } })
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  const all = await joined(ui)
  expect(all).toContain('CLAUDE CODE WRAPPED')
  expect(all).toContain('The Investigator')
  expect(all).toContain('You read first, ask questions, then act.')
  expect(all).toContain('HOURS')
  expect(all).toContain('TURNS')
  expect(all).toContain('TOKENS')
  expect(all).toContain('COST')
  expect(all).toContain('LONGEST STREAK')
  expect(all).toMatch(/Read\s+█+ 40/)
  expect(all).toMatch(/Edit\s+█+ 20/)
  expect(all).toContain('Claude Code · proj')
  await ui.unmount()
})

for (const [name, tools, persona] of [
  ['Newcomer', { Read: 3 }, 'The Newcomer'],
  ['Refactorer', { Edit: 20, Read: 5, Bash: 5 }, 'The Refactorer'],
  ['Investigator', { Read: 20, Edit: 5, Bash: 5 }, 'The Investigator'],
  ['Shipper', { Bash: 20, Read: 5, Edit: 5 }, 'The Shipper'],
  ['Collaborator', { Bash: 10, Read: 10, Edit: 10 }, 'The Collaborator'],
] as const) {
  test(`persona ${name}`, { timeoutMs: 30_000 }, async ($, on) => {
    world(on, { store: { 'week-heatmap:days': seeded(), 'week-heatmap:tools': tools } })
    await start($)
    const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
    expect((await svgOf(ui)).alt.endsWith(persona)).toBe(true)
    await ui.unmount()
  })
}

test('Wrapped in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  const svg = await svgOf(ui)
  expect(svg.alt).toContain('כרטיס Claude Code Wrapped')
  expect(svg.alt).toContain('המתחיל')
  expect(svg.source).toContain('הרצף הארוך ביותר')
  expect((await ui.find({ type: 'Button', key: 'save-svg' }))!.props['label']).toBe('שמור SVG')
  await ui.unmount()
})

test('save SVG writes a new wrapped file under toolkitty-exports', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  await ui.press({ key: 'save-svg' })
  expect(w.written.length).toBe(1)
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/wrapped-2026-11-08-1200.svg')
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  expect(w.written[0]!.text).toBe((await svgOf(ui)).source)
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}wrapped-2026-11-08-1200.svg`)
  w.failWrite = true
  await ui.press({ key: 'save-svg' })
  expect(await lastNotice($)).toBe('Could not save the file')
  await ui.unmount()
})

test('share: saves a wrapped file under toolkitty-exports and copies the week as a post', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  await ui.press({ key: 'share-wrapped' })
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/wrapped-2026-11-08-1200.svg')
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  // the last 7 days: today, yesterday and the day before (3.5 h, 5 turns, $2.00)
  expect(w.copies[0]!.text).toBe('This week with Claude Code: 4h, 5 turns, $2 — made with Toolkitty\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(w.copies[0]!.surface).toBe('desktop')
  expect(await lastNotice($)).toBe(`Copied + saved ${SHOWN}wrapped-2026-11-08-1200.svg`)
  await ui.unmount()
})

// The share notices are info notices: a second one from the same feature within a minute is dropped, so each outcome has its own session.
test('share: the copy fails, the SVG is still saved and the notice says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  w.copyOk = false
  await ui.press({ key: 'share-wrapped' })
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}wrapped-2026-11-08-1200.svg (could not copy)`)
  await ui.unmount()
})

test('share: neither works, a warning says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  w.copyOk = false
  w.failWrite = true
  await ui.press({ key: 'share-wrapped' })
  expect(await lastNotice($)).toBe('Could not copy or save')
  await ui.unmount()
})

test('share: the SVG cannot be saved, the copy still goes through', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  w.failWrite = true
  await ui.press({ key: 'share-wrapped' })
  expect(await lastNotice($)).toBe('Copied (could not save the SVG)')
  await ui.unmount()
})

test('share on the terminal in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he', 'week-heatmap:days': seeded() } })
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'terminal' })
  await ui.press({ key: 'share-wrapped' })
  expect(w.copies[0]!.surface).toBe('terminal')
  expect(w.copies[0]!.text).toContain('השבוע עם Claude Code')
  await ui.unmount()
})

test('a finished turn is recorded and persisted: turns, time, tokens, cost, tools, longest', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  w.usage.usd = 1
  await start($)
  await turnStart($)
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/proj/b.ts' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  w.toolResult = { deny: 'blocked' }
  await $.tool.call({ tool: 'Bash', command: 'rm' })
  w.toolResult = { result: {} }
  w.usage.usd = 1.75
  await turnDone($, 90_000, { usage: USAGE })
  const key = dayKey(NOON)
  expect(w.store.get('week-heatmap:days')).toEqual({ [key]: { turns: 1, ms: 90_000, tokens: 500, cost: 0.75 } })
  expect(w.store.get('week-heatmap:tools')).toEqual({ Read: 2, Bash: 1 })
  expect(w.store.get('week-heatmap:longest')).toBe(90_000)

  // a second, shorter turn adds up
  w.usage.usd = 2
  await turnStart($)
  w.usage.usd = 2.25
  await turnDone($, 10_000, { usage: USAGE })
  expect(w.store.get('week-heatmap:days')).toEqual({ [key]: { turns: 2, ms: 100_000, tokens: 1000, cost: 1.25 } })
  expect(w.store.get('week-heatmap:longest')).toBe(90_000)
  // subagent turns are not days
  await turnStart($, { agentId: 'a' })
  await turnDone($, 10_000, { agentId: 'a' })
  expect((w.store.get('week-heatmap:days') as Record<string, Day>)[key]!.turns).toBe(2)

  // the heatmap pane picks it up live
  const ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'desktop' })
  const all = await joined(ui)
  expect(all).toContain('Turns:')
  expect(all).toContain('1 days')
  await ui.unmount()
})

test('a new day starts a new column entry; days older than 400 are dropped', { timeoutMs: 30_000 }, async ($, on) => {
  const old = dayKey(NOON - 401 * DAY)
  const days: Record<string, Day> = { [old]: day(1, 1, 1, 1), [dayKey(NOON - DAY)]: day(1, 1, 1, 1) }
  const w = world(on, { store: { 'week-heatmap:days': days } })
  await start($)
  await turnStart($)
  await turnDone($, 1000)
  const saved = w.store.get('week-heatmap:days') as Record<string, Day>
  expect(Object.keys(saved).sort()).toEqual([dayKey(NOON - DAY), dayKey(NOON)].sort())
})

test('the Wrapped Svg stays under 128 KB with a long history', { timeoutMs: 30_000 }, async ($, on) => {
  const days: Record<string, Day> = {}
  for (let i = 0; i < 400; i++) days[dayKey(NOON - i * DAY)] = day(3, 1, 100 + i * 7, 0.3)
  const tools: Record<string, number> = {}
  for (let i = 0; i < 60; i++) tools[`Tool${i}`] = i * 1000
  world(on, { store: { 'week-heatmap:days': days, 'week-heatmap:tools': tools } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'desktop' })
  const svg = await svgOf(ui)
  expect(svg.source.length).toBeLessThan(128 * 1024)
  expect(svg.alt).toContain('400 days')
  expect(svg.source).toContain('Tool59')
  await ui.unmount()
})

test('the pane headers: Activity shows the streak and opens Wrapped; Wrapped holds save, share and open-heatmap', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const h = await $.ui.mount({ ...PANE('heatmap'), surface })
    expect((await h.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)).toEqual(['✦', 'Activity', '3 days'])
    expect((await h.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['open-wrapped'])
    await h.unmount()
    const wr = await $.ui.mount({ ...PANE('wrapped'), surface })
    const top = (await wr.findAll({ type: 'Text' })).slice(0, 3).map((x: any) => x.text)
    expect(top.slice(0, 2)).toEqual(['✦', 'Wrapped'])
    expect(top[2]!.length).toBeGreaterThan(0)
    expect((await wr.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['save-svg', 'share-wrapped', 'open-heatmap'])
    expect((await wr.findAll({ type: 'Button' })).map((b: any) => b.props['label'])).toEqual(['save SVG', 'share', 'Open heatmap'])
    await wr.unmount()
  }
})

// ---------- the panes re-read the store when opened (the demo writes the real keys) ----------

test('opening by command re-reads the store: weeks another feature wrote show without a restart, and leave when removed', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  let ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'terminal' })
  expect(await joined(ui)).toContain('No data yet: finish a turn and come back.')
  await ui.unmount()

  // someone (the demo) writes the keys behind the feature's back
  w.store.set('week-heatmap:days', seeded())
  w.store.set('week-heatmap:longest', 90 * 60_000)
  expect((await $.command.run({ command: 'heatmap', args: '' })).text).toBe('Opened.')
  ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'terminal' })
  let all = await joined(ui)
  expect(all).toContain('Current streak:')
  expect(all).toContain('3 days')
  expect(all).toContain('4.8')
  await ui.unmount()

  expect((await $.command.run({ command: 'wrapped', args: '' })).text).toBe('Opened.')
  ui = await $.ui.mount({ ...PANE('wrapped'), surface: 'terminal' })
  all = await joined(ui)
  expect(all).not.toContain('No data yet')
  expect(all).toContain('4.8')
  await ui.unmount()

  // the keys are removed again (demo off restores an empty store): the panes follow on the next open
  w.store.delete('week-heatmap:days')
  w.store.delete('week-heatmap:longest')
  await $.command.run({ command: 'heatmap', args: '' })
  ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'terminal' })
  expect(await joined(ui)).toContain('No data yet: finish a turn and come back.')
  await ui.unmount()
})

test('the open-wrapped and open-heatmap buttons re-read the store too', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': seeded() } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('heatmap'), surface: 'desktop' })
  const more = seeded()
  more[dayKey(NOON - 3 * DAY)] = day(1, 1, 100, 0.1)
  w.store.set('week-heatmap:days', more)
  await ui.press({ key: 'open-wrapped' })
  await w.clock.settle()
  expect(w.opened.map(o => o.id)).toContain('wrapped')
  const after = await joined(ui)
  expect(after).toContain('4 days')
  expect(after).toContain('5.8')
  await ui.unmount()
})
