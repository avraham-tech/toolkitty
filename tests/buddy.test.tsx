import { expect, test } from 'claude-code/testing'
import { BAND, DAY, NOON, PANE, SPECIES, dayKey, joined, lastNotice, noticeTexts, roll, start, svgOf, texts, turnDone, turnStart, world, SHOWN } from './harness'

const SEED = 4242
const OFF = 'The feature is off; turn it on in the /toolkitty pane'

test('load: registers /buddy and rolls a seed on first use', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('buddy')
  const r = await $.command.run({ command: 'buddy', args: '' })
  expect(r.text).toBe('Your buddy is here.')
  expect(w.opened.map(o => o.id)).toContain('buddy')
  const seed = w.store.get('buddy:seed')
  expect(typeof seed).toBe('number')
  expect(seed as number).toBeGreaterThan(0)
  // the same buddy next time
  await $.command.run({ command: 'buddy', args: '' })
  expect(w.store.get('buddy:seed')).toBe(seed)
})

test('/buddy name in every argument form', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  expect((await $.command.run({ command: 'buddy', args: 'name' })).text).toBe('Usage: /buddy name <name>')
  expect((await $.command.run({ command: 'buddy', args: 'name    ' })).text).toBe('Usage: /buddy name <name>')
  expect((await $.command.run({ command: 'buddy', args: 'name Rex' })).text).toBe('Your buddy is now called Rex.')
  expect(w.store.get('buddy:name')).toBe('Rex')
  expect((await $.command.run({ command: 'buddy', args: '  NAME   Mr Bean  ' })).text).toBe('Your buddy is now called Mr Bean.')
  const long = 'x'.repeat(40)
  expect((await $.command.run({ command: 'buddy', args: `name ${long}` })).text).toBe(`Your buddy is now called ${'x'.repeat(24)}.`)
  // a word that only starts with "name" is not the rename form
  expect((await $.command.run({ command: 'buddy', args: 'names' })).text).toBe('Your buddy is here.')
  expect((await $.command.run({ command: 'buddy', args: 'bogus words' })).text).toBe('Your buddy is here.')
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect((await svgOf(ui)).alt).toContain('x'.repeat(24))
  await ui.unmount()
})

test('/buddy answers in Hebrew when the language is he', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'buddy:seed': SEED } })
  await start($)
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe('החבר שלך כאן.')
  expect((await $.command.run({ command: 'buddy', args: 'name' })).text).toBe('שימוש: /buddy name <שם>')
  expect((await $.command.run({ command: 'buddy', args: 'name רקס' })).text).toBe('החבר שלך נקרא עכשיו רקס.')
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  const all = await joined(ui)
  expect(all).toContain('רקס')
  expect(all).toMatch(/רגוע/)
  await ui.unmount()
})

test('off switch: the command says so, the pane and the band are quiet', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { buddy: false }, 'buddy:seed': SEED } })
  await start($)
  expect((await $.command.run({ command: 'buddy', args: '' })).text).toBe(OFF)
  expect((await $.command.run({ command: 'buddy', args: 'name Rex' })).text).toBe(OFF)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'share-buddy' })).toBeUndefined()
  expect(await joined(ui)).toContain('The feature is off')
  await ui.unmount()
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  expect(await b.find({ key: 'band-buddy' })).toBeUndefined()
  await turnStart($)
  await turnDone($)
  expect(await b.find({ key: 'band-buddy' })).toBeUndefined()
  await b.unmount()
})

test('desktop pane: an Svg with alt and a source under 128 KB, that follows the mood', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel' } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  const idle = await svgOf(ui)
  expect(idle.source.startsWith('<svg')).toBe(true)
  expect(idle.source.length).toBeLessThan(128 * 1024)
  expect(idle.alt).toMatch(/^Pixel, a \w+ \w+, feeling idle$/)
  expect(idle.alt.toLowerCase()).toContain(roll(SEED).rarity)
  expect(idle.isInteractive).toBe(true)
  expect(await joined(ui)).toContain('Pixel')

  await turnStart($)
  const working = await svgOf(ui)
  expect(working.alt).toMatch(/feeling working$/)
  expect(working.source).not.toBe(idle.source)
  expect(working.source.length).toBeLessThan(128 * 1024)

  // a green build celebrates
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const celebrating = await svgOf(ui)
  expect(celebrating.alt).toMatch(/feeling celebrating$/)
  expect(celebrating.source).not.toBe(working.source)
  expect(celebrating.source.length).toBeLessThan(128 * 1024)

  // the flash ends after ten seconds
  await w.clock.advance(11_000)
  expect((await svgOf(ui)).alt).toMatch(/feeling working$/)

  // an error worries
  w.toolResult = { isError: true, result: 'boom' }
  await $.tool.call({ tool: 'Bash', command: 'false' })
  const worried = await svgOf(ui)
  expect(worried.alt).toMatch(/feeling worried$/)
  expect(worried.source).not.toBe(working.source)

  await w.clock.advance(11_000)
  w.toolResult = { result: {} }
  await turnDone($)
  expect((await svgOf(ui)).alt).toMatch(/feeling idle$/)

  // three quiet minutes put it to sleep
  await w.clock.advance(4 * 60_000)
  const sleeping = await svgOf(ui)
  expect(sleeping.alt).toMatch(/feeling sleeping$/)
  expect(sleeping.source).not.toBe(idle.source)
  expect(sleeping.source).toContain('>Z<')
  await ui.unmount()
})

test('only a green build celebrates; a failing build worries', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  await turnStart($)
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  expect((await svgOf(ui)).alt).toMatch(/feeling working$/)
  w.toolResult = { isError: true, result: 'fail' }
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect((await svgOf(ui)).alt).toMatch(/feeling worried$/)
  await ui.unmount()
})

test('subagent turns do not move the buddy', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  await turnStart($, { agentId: 'a1' })
  expect((await svgOf(ui)).alt).toMatch(/feeling idle$/)
  await ui.unmount()
})

test('terminal pane: the ASCII fallback and no Svg', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  const all = await joined(ui)
  expect(all).toContain('( o.o )')
  expect(all).toContain('Buddy')
  await turnStart($)
  expect(await joined(ui)).toContain('( ò.ó )')
  await turnDone($)
  await w.clock.advance(4 * 60_000)
  expect(await joined(ui)).toContain('( -.- )z')
  await ui.unmount()
})

test('share button: saves the SVG beside the project and copies the post text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  await ui.press({ key: 'share-buddy' })
  expect(w.written.length).toBe(1)
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/buddy-2026-11-08-1200.svg')
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  const info = roll(SEED)
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]!.text).toContain('My Claude Code buddy is a ')
  expect(w.copies[0]!.text).toContain(info.rarity)
  expect(w.copies[0]!.text).toContain(info.species)
  expect(w.copies[0]!.text).toContain('claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(w.copies[0]!.surface).toBe('desktop')
  expect(await lastNotice($)).toBe(`Copied + saved ${SHOWN}buddy-2026-11-08-1200.svg`)

  await ui.unmount()
})

// The share notices are info notices: a second one from the same feature within a minute is dropped, so each outcome has its own session.
test('share: the copy fails, the SVG is still saved and the notice says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  w.copyOk = false
  await ui.press({ key: 'share-buddy' })
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}buddy-2026-11-08-1200.svg (could not copy)`)
  await ui.unmount()
})

test('share: neither works, a warning says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  w.copyOk = false
  w.failWrite = true
  await ui.press({ key: 'share-buddy' })
  expect(await lastNotice($)).toBe('Could not copy or save')
  await ui.unmount()
})

test('share: the SVG cannot be saved, the copy still goes through', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  w.failWrite = true
  await ui.press({ key: 'share-buddy' })
  expect(await lastNotice($)).toBe('Copied (could not save the SVG)')
  await ui.unmount()
})

test('share button on the terminal, in Hebrew, with a trailing slash in the cwd', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, language: 'he' }, cwd: 'C:/proj/' })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  await ui.press({ key: 'share-buddy' })
  expect(w.written[0]!.path).toBe('C:/proj/toolkitty-exports/buddy-2026-11-08-1200.svg')
  expect(w.copies[0]!.surface).toBe('terminal')
  expect(w.copies[0]!.text).toContain('החבר שלי ב-Claude Code')
  expect(await lastNotice($)).toBe(`הועתק + נשמר: ${SHOWN}buddy-2026-11-08-1200.svg`)
  await ui.unmount()
})

test('evolution: XP (here from hours) grows the buddy at 150 and announces the new stage once', { timeoutMs: 30_000 }, async ($, on) => {
  const days = { '2026-11-07': { turns: 3, ms: 150 * 3_600_000, tokens: 1000, cost: 1 } }
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel', 'week-heatmap:days': days } })
  await start($)
  expect(await noticeTexts($)).toContain('Pixel grew into a companion!')
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await joined(ui)).toContain('companion · 150h')
  expect(await joined(ui)).toContain('XP 150 · stage 2')
  expect((await svgOf(ui)).source).toContain('stroke="#00000033"') // the scarf
  expect((await svgOf(ui)).source).not.toContain('#b8860b') // no crown yet
  await ui.unmount()
  // already announced: a second session says nothing more
  const n = (await noticeTexts($)).filter(x => x.includes('grew into')).length
  await start($)
  expect((await noticeTexts($)).filter(x => x.includes('grew into')).length).toBe(n)
  void w
})

test('evolution to veteran at 600 XP adds the crown (desktop) and the crown mark (terminal)', { timeoutMs: 30_000 }, async ($, on) => {
  const days = { '2026-11-07': { turns: 3, ms: 600 * 3_600_000, tokens: 1, cost: 1 } }
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel', 'week-heatmap:days': days } })
  await start($)
  expect(await noticeTexts($)).toContain('Pixel grew into a veteran!')
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect((await svgOf(ui)).source).toContain('#b8860b')
  expect(await joined(ui)).toContain('veteran · 600h')
  expect(await joined(ui)).toContain('XP 600 · stage 3')
  await ui.unmount()
  const t = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  const all = await joined(t)
  expect(all).toContain('♛')
  expect(all).toContain('=~~~~~=>')
  await t.unmount()
  void w
})

test('a seven-day streak shows the charm, six days do not', { timeoutMs: 30_000 }, async ($, on) => {
  const days: Record<string, unknown> = {}
  for (let i = 0; i < 7; i++) days[dayKey(NOON - i * DAY)] = { turns: 2, ms: 60_000, tokens: 1, cost: 0 }
  world(on, { store: { 'buddy:seed': SEED, 'week-heatmap:days': days } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await joined(ui)).toContain('⚡ streak')
  expect((await svgOf(ui)).source).toContain('⚡ streak')
  await ui.unmount()
})

test('six days is not a streak', { timeoutMs: 30_000 }, async ($, on) => {
  const days: Record<string, unknown> = {}
  for (let i = 0; i < 6; i++) days[dayKey(NOON - i * DAY)] = { turns: 2, ms: 60_000, tokens: 1, cost: 0 }
  world(on, { store: { 'buddy:seed': SEED, 'week-heatmap:days': days } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await joined(ui)).not.toContain('⚡ streak')
  expect((await svgOf(ui)).source).not.toContain('⚡ streak')
  await ui.unmount()
})

test('progress is re-read every sixty ticks and after a turn', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await joined(ui)).toContain('hatchling · 0.0h')
  expect(await joined(ui)).toContain('XP 0 · stage 1')
  w.store.set('week-heatmap:days', { '2026-11-07': { turns: 1, ms: 155 * 3_600_000, tokens: 1, cost: 0 } })
  await w.clock.advance(61_000)
  expect(await joined(ui)).toContain('companion · 155h')
  expect(await joined(ui)).toContain('XP 155 · stage 2')
  await ui.unmount()
})

test('the band chip shows only while the buddy has something to show; the full line is behind the toggle', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel', enabled: { 'monday-report': false } } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  // idle: no chip, only the toggle (the full line is the one hidden line)
  expect(await b.find({ key: 'chip-buddy' })).toBeUndefined()
  expect((await b.find({ key: 'toolkitty-band-toggle' }))!.props['label']).toBe('⋯ 1 more')
  await b.press({ key: 'toolkitty-band-toggle' })
  const line = await b.find({ key: 'band-buddy' })
  expect(line).toBeDefined()
  expect(line!.text).toBe('🐾 Pixel · idle')
  await turnStart($)
  // working: the shortest honest form, the name, with the visual group's icon
  const chip = await b.find({ key: 'chip-buddy' })
  expect(chip).toBeDefined()
  expect(chip!.text.trim()).toBe('🐾 Pixel')
  expect((await b.find({ key: 'band-buddy' }))!.text).toBe('🐾 Pixel · working')
  // a press on the line opens the detail
  await b.press({ key: 'band-buddy' })
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  const info = roll(SEED)
  const all = await joined(d)
  expect(all).toContain('Pixel · ')
  expect(all.toLowerCase()).toContain(info.species)
  expect(all).toContain('working · hatchling')
  expect(all).toMatch(/“.+”/)
  expect(all).toContain('/buddy')
  await d.unmount()
  await b.unmount()
})

test('the band chip: celebrating is info, worried is warn, working is quiet, idle and asleep have none', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel', enabled: { 'monday-report': false } } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  const colorOf = async () => (await b.find({ type: 'Text', text: /Pixel/ }))?.props['color']
  const quiet = async () => (await b.find({ type: 'Text', text: /Pixel/ }))?.props['dimColor']
  await turnStart($)
  expect(await colorOf()).toBeUndefined()
  expect(await quiet()).toBe(true)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await colorOf()).toBe('claude')
  w.toolResult = { isError: true, result: 'fail' }
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await colorOf()).toBe('warning')
  expect((await b.find({ key: 'chip-buddy' }))!.text.trim()).toBe('🐾 Pixel')
  // after the turn and a quiet minute the flash is over and the buddy is idle again
  await turnDone($)
  await w.clock.advance(120_000)
  expect(await b.find({ key: 'chip-buddy' })).toBeUndefined()
  await b.unmount()
})

test('the pane: a header with the title, the mood as status and the share action; the card stays the hero', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel' } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE('buddy'), surface })
    const all = await texts(ui)
    expect(all.slice(0, 3)).toEqual(['✦', 'Buddy', 'idle'])
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map((x: any) => x.key)).toEqual(['share-buddy', 'exp-save-buddy', 'exp-print-buddy', 'exp-open-buddy', 'exp-path-buddy'])
    expect(buttons[0].props['label']).toBe('share')
    await ui.unmount()
  }
})

test('the band yields to a survey', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { 'buddy:seed': SEED } })
  await start($)
  const b = await $.ui.mount({ ...BAND('desktop', { hasSurvey: true }), requestId: 'band2' })
  expect(await b.find({ key: 'band-buddy' })).toBeUndefined()
  expect(await b.find({ key: 'chip-buddy' })).toBeUndefined()
  await b.unmount()
})

test('a shiny seed shows the sparkle', { timeoutMs: 30_000 }, async ($, on) => {
  let seed = 1
  while (!roll(seed).shiny) seed++
  world(on, { store: { 'buddy:seed': seed } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await joined(ui)).toContain('✦ shiny')
  expect((await svgOf(ui)).source).toContain('#fff6b0')
  const share = await ui.press({ key: 'share-buddy' })
  void share
  await ui.unmount()
})

// one seed per species: every drawing is a valid card, in every mood
const bySpecies: Record<string, number> = {}
for (let seed = 1; Object.keys(bySpecies).length < SPECIES.length && seed < 5000; seed++) {
  const r = roll(seed)
  if (bySpecies[r.species] === undefined) bySpecies[r.species] = seed
}
for (const species of SPECIES) {
  test(`species ${species} draws in all five moods`, { timeoutMs: 30_000 }, async ($, on) => {
    const seed = bySpecies[species]!
    const w = world(on, { store: { 'buddy:seed': seed } })
    await start($)
    const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
    const sources = new Set<string>()
    sources.add((await svgOf(ui)).source)
    await turnStart($)
    sources.add((await svgOf(ui)).source)
    await $.tool.call({ tool: 'Bash', command: 'npm run build' })
    sources.add((await svgOf(ui)).source)
    await w.clock.advance(11_000)
    w.toolResult = { isError: true, result: 'x' }
    await $.tool.call({ tool: 'Read', file_path: 'a' })
    sources.add((await svgOf(ui)).source)
    w.toolResult = { result: {} }
    await w.clock.advance(11_000)
    await turnDone($)
    await w.clock.advance(4 * 60_000)
    sources.add((await svgOf(ui)).source)
    expect(sources.size).toBe(5)
    for (const s of sources) {
      expect(s.startsWith('<svg')).toBe(true)
      expect(s.length).toBeLessThan(128 * 1024)
    }
    expect((await svgOf(ui)).alt.toLowerCase()).toContain(roll(seed).rarity)
    await ui.unmount()
  })
}

// ---------- progression by verified events ----------

const CLAIMS = { 'claim-check': true }
const bashRun = async ($: any, w: { toolResult: unknown }, command: string, ok: boolean) => {
  w.toolResult = ok ? { result: {} } : { isError: true, result: 'failed' }
  await $.tool.call({ tool: 'Bash', command })
  w.toolResult = { result: {} }
}
const hours = (h: number) => ({ '2026-11-07': { turns: 1, ms: h * 3_600_000, tokens: 1, cost: 0 } })
const xpText = async (ui: any): Promise<string> => (await texts(ui)).find(x => x.startsWith('XP ')) ?? ''

test('XP math: hours + 10 per passed test run + 15 per incident + 5 per 10k tokens + 20 per achievement', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, {
    store: {
      'buddy:seed': SEED,
      enabled: CLAIMS,
      'week-heatmap:days': hours(20), // 20
      'incidents:C:/proj': { count: 4, items: [], lastAt: null }, // 60
      'savings:days': { '2026-11-06': { tokens: 25_000, usd: 0 }, '2026-11-07': { tokens: 5_000, usd: 0 } }, // 30,000 tokens: 15
      'achievements:unlocked': { 'first-save': 1, polyglot: 2 }, // 40
    },
  })
  await start($)
  await turnStart($)
  await bashRun($, w, 'npm test', true) // 30 for the three passes, none for the failure
  await bashRun($, w, 'npm test', true)
  await bashRun($, w, 'npm test', false)
  await bashRun($, w, 'npm run test:unit', true)
  await turnDone($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await xpText(ui)).toBe('XP 165 · stage 2')
  expect(w.store.get('buddy:tests')).toBe(3)
  await ui.unmount()
})

test('test runs are credited once: later turns, the sixty-second refresh and a new session add nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, enabled: CLAIMS } })
  await start($)
  await turnStart($)
  await bashRun($, w, 'npm test', true)
  await bashRun($, w, 'npm test', true)
  await turnDone($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await xpText(ui)).toBe('XP 20 · stage 1')
  await turnStart($)
  await turnDone($)
  await w.clock.advance(125_000)
  await start($)
  expect(await xpText(ui)).toBe('XP 20 · stage 1')
  expect(w.store.get('buddy:tests')).toBe(2)
  // a third run, later, is the only new credit
  await w.clock.advance(5_000)
  await turnStart($)
  await bashRun($, w, 'npm test', true)
  await turnDone($)
  expect(await xpText(ui)).toBe('XP 30 · stage 1')
  expect(w.store.get('buddy:tests')).toBe(3)
  await ui.unmount()
})

test('failed test runs earn no XP', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, enabled: CLAIMS } })
  await start($)
  await turnStart($)
  await bashRun($, w, 'npm test', false)
  await bashRun($, w, 'npm test', false)
  await turnDone($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await xpText(ui)).toBe('XP 0 · stage 1')
  await ui.unmount()
})

const THRESHOLDS: Array<[number, number, string]> = [
  [0, 1, 'hatchling'],
  [149, 1, 'hatchling'],
  [150, 2, 'companion'],
  [599, 2, 'companion'],
  [600, 3, 'veteran'],
  [900, 3, 'veteran'],
]
for (const [xp, stage, name] of THRESHOLDS) {
  test(`stage thresholds: ${xp} XP is stage ${stage} (${name})`, { timeoutMs: 30_000 }, async ($, on) => {
    world(on, { store: { 'buddy:seed': SEED, 'week-heatmap:days': hours(xp) } })
    await start($)
    const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
    const all = await joined(ui)
    expect(all).toContain(`XP ${xp} · stage ${stage}`)
    expect(all).toContain(`${name} · `)
    expect(all.includes('♛')).toBe(stage === 3)
    expect(all.includes('=~~~~~=>')).toBe(stage >= 2)
    await ui.unmount()
  })
}

test('tokens saved: 5 XP per full 10k, 9,999 is none', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'savings:days': { '2026-11-07': { tokens: 9_999, usd: 0 } } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await xpText(ui)).toBe('XP 0 · stage 1')
  w.store.set('savings:days', { '2026-11-07': { tokens: 10_000, usd: 0 } })
  await w.clock.advance(61_000)
  expect(await xpText(ui)).toBe('XP 5 · stage 1')
  w.store.set('savings:days', { '2026-11-06': { tokens: 70_000, usd: 0 }, '2026-11-07': { tokens: 35_000, usd: 0 } })
  await w.clock.advance(61_000)
  expect(await xpText(ui)).toBe('XP 50 · stage 1')
  await ui.unmount()
})

test('each achievement unlocked is 20 XP, read from achievements:unlocked', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'achievements:unlocked': { a: 1, b: 2, c: 3 } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await xpText(ui)).toBe('XP 60 · stage 1')
  w.store.set('achievements:unlocked', { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 })
  await w.clock.advance(61_000)
  expect(await xpText(ui)).toBe('XP 160 · stage 2')
  expect(await noticeTexts($)).toContain('Buddy grew into a companion!')
  await ui.unmount()
})

test('incidents prevented: 15 XP each, 10 of them reach the companion stage', { timeoutMs: 30_000 }, async ($, on) => {
  // achievements off: its trophies would add their own 20 XP, and this test is about the buddy's XP
  world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel', enabled: { achievements: false }, 'incidents:C:/proj': { count: 10, items: [], lastAt: null } } })
  await start($)
  expect(await noticeTexts($)).toContain('Pixel grew into a companion!')
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect(await xpText(ui)).toBe('XP 150 · stage 2')
  await ui.unmount()
})

test('XP shows under the pet on both surfaces and in the band detail', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, {
    store: {
      'buddy:seed': SEED,
      'buddy:name': 'Pixel',
      enabled: { 'monday-report': false, achievements: false }, // trophies would add their own XP
      'week-heatmap:days': hours(20),
      'incidents:C:/proj': { count: 20, items: [], lastAt: null },
    },
  })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE('buddy'), surface })
    expect(await xpText(ui)).toBe('XP 320 · stage 2')
    await ui.unmount()
  }
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  await turnStart($)
  await b.press({ key: 'toolkitty-band-toggle' })
  await b.press({ key: 'band-buddy' })
  const d = await $.ui.mount({ ...PANE('toolkitty-detail'), surface: 'desktop' })
  const all = await joined(d)
  expect(all).toContain('XP 320 · stage 2')
  expect(all).toContain('working · companion')
  expect(all).toContain('+10 per passed test run')
  await d.unmount()
  await b.unmount()
})

test('XP does not touch the roll: the species and rarity stay the seed', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, 'buddy:name': 'Pixel' } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  const before = (await svgOf(ui)).alt
  w.store.set('incidents:C:/proj', { count: 60, items: [], lastAt: null })
  await w.clock.advance(61_000)
  expect(await xpText(ui)).toBe('XP 900 · stage 3')
  const after = (await svgOf(ui)).alt
  expect(after).toBe(before)
  const info = roll(SEED)
  expect(after.toLowerCase()).toContain(info.rarity)
  expect(after.toLowerCase()).toContain(info.species)
  await ui.unmount()
})

test('Hebrew: the XP line', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he', 'buddy:seed': SEED, 'buddy:name': 'רקס', enabled: { achievements: false }, 'week-heatmap:days': hours(320) } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await xpText(ui)).toBe('XP 320 · שלב 2')
  await ui.unmount()
})

test('off switch: no XP is computed or credited, nothing is stored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': SEED, enabled: { buddy: false, 'claim-check': true }, 'incidents:C:/proj': { count: 50, items: [], lastAt: null } } })
  await start($)
  await turnStart($)
  await bashRun($, w, 'npm test', true)
  await turnDone($)
  await w.clock.advance(125_000)
  expect(w.store.has('buddy:tests')).toBe(false)
  expect(w.store.has('buddy:tests-mark')).toBe(false)
  expect(w.store.has('buddy:stage')).toBe(false)
  const ui = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await joined(ui)).not.toContain('XP ')
  await ui.unmount()
})
