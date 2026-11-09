import { expect, test } from 'claude-code/testing'
import { BAND, DAY, NOON, PANE, dayKey, joined, labels, noticeTexts, start, texts, turnDone, turnStart, world } from './harness'

const OFF = 'Achievements is off; turn it on in the /toolkitty pane'
const TOTAL = 12
const AT = (h: number, m = 0) => new Date(2026, 10, 8, h, m, 0).getTime()

const unlockedOf = (w: { store: Map<string, unknown> }): Record<string, number> => (w.store.get('achievements:unlocked') ?? {}) as Record<string, number>
const idsOf = (w: { store: Map<string, unknown> }): string[] => Object.keys(unlockedOf(w)).sort()
const incidentsAt = (count: number) => ({ count, items: [], lastAt: null })
/** Active days before today: `n` days ending yesterday. */
const priorDays = (n: number, step = 1): Record<string, unknown> => {
  const days: Record<string, unknown> = {}
  for (let i = 1; i <= n; i++) days[dayKey(NOON - i * step * DAY)] = { turns: 2, ms: 60_000, tokens: 1, cost: 0 }
  return days
}
const bash = async ($: any, w: { toolResult: unknown }, command: string, ok: boolean) => {
  w.toolResult = ok ? { result: {} } : { isError: true, result: 'failed' }
  await $.tool.call({ tool: 'Bash', command })
  w.toolResult = { result: {} }
}
const CLAIMS_ON = { 'claim-check': true }

// ---------- load and the command ----------

test('load: registers /trophies, and the command opens the pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('trophies')
  const r = await $.command.run({ command: 'trophies', args: '' })
  expect(r.text).toBe('Opened your trophies.')
  expect(w.opened.map(o => o.id)).toContain('achievements')
  expect(w.opened.find(o => o.id === 'achievements')!.title).toBe('Achievements')
  // a fresh install has earned nothing and writes nothing
  expect(idsOf(w)).toEqual([])
})

// ---------- each achievement unlocks from seeded facts, exactly once ----------

type Case = {
  id: string
  title: string
  seed: (w: any, $: any) => Promise<void> | void
  store?: Record<string, unknown>
  now?: number
  /** Which event evaluates: a session start alone, or a finished turn. */
  turn?: boolean
  also?: string[]
  /** The unlock notice when it is not the English one. */
  line?: string
}

const CASES: Case[] = [
  { id: 'first-save', title: 'First Save', store: { 'incidents:C:/proj': incidentsAt(1) }, seed: () => {} },
  { id: 'safety-guardian', title: 'Safety Guardian', store: { 'incidents:C:/proj': incidentsAt(100) }, seed: () => {}, also: ['first-save'] },
  {
    id: 'green-streak',
    title: 'Green Streak',
    store: { enabled: CLAIMS_ON },
    turn: true,
    seed: async (w, $) => {
      for (let i = 0; i < 10; i++) await bash($, w, 'npm test', true)
    },
  },
  {
    id: 'bug-hunter',
    title: 'Bug Hunter',
    store: { enabled: CLAIMS_ON },
    turn: true,
    seed: async (w, $) => {
      await bash($, w, 'npm test', false)
      await bash($, w, 'npm test', true)
    },
  },
  { id: 'context-ninja', title: 'Context Ninja', store: { 'savings:days': { '2026-11-07': { tokens: 100_000, usd: 0.3 } } }, seed: () => {} },
  { id: 'marathon', title: 'Marathon', store: { 'week-heatmap:days': priorDays(4) }, turn: true, seed: () => {} },
  { id: 'night-owl', title: 'Night Owl', now: AT(2), turn: true, seed: () => {} },
  { id: 'early-bird', title: 'Early Bird', now: AT(6, 30), turn: true, seed: () => {} },
  { id: 'polyglot', title: 'Polyglot', store: { language: 'fr' }, line: '🏆 Succès débloqué : Polyglotte', seed: () => {} },
  {
    id: 'full-deck',
    title: 'Full Deck',
    store: { enabled: Object.fromEntries(Array.from({ length: 72 }, (_, i) => [`f${i}`, true])) },
    seed: () => {},
  },
  { id: 'minimalist', title: 'Minimalist', store: { profile: 'minimal' }, seed: () => {} },
  { id: 'week-one', title: 'Week One', store: { 'week-heatmap:days': priorDays(6, 2) }, turn: true, seed: () => {} },
]

for (const c of CASES) {
  test(`${c.id}: unlocks from seeded facts, with a notice, and never twice`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on, { store: c.store ?? {}, now: c.now ?? NOON })
    await start($)
    if (c.turn !== true) {
      expect(idsOf(w)).toEqual([c.id, ...(c.also ?? [])].sort())
    } else {
      expect(idsOf(w)).toEqual([])
      await turnStart($)
      await c.seed(w, $)
      await turnDone($)
      expect(idsOf(w)).toEqual([c.id, ...(c.also ?? [])].sort())
    }
    const at = unlockedOf(w)[c.id]!
    expect(typeof at).toBe('number')
    const titleLine = c.line ?? `🏆 Achievement unlocked: ${c.title}`
    const count = async () => (await noticeTexts($)).filter(x => x === titleLine).length
    expect(await count()).toBe(1)

    // more turns, a new session, a pane open: no second unlock, no second notice, the time stays
    await w.clock.advance(120_000)
    await turnStart($)
    await turnDone($)
    await start($)
    await $.command.run({ command: 'trophies', args: '' })
    await turnStart($)
    await turnDone($)
    expect(unlockedOf(w)[c.id]).toBe(at)
    expect(await count()).toBe(1)
  })
}

// ---------- boundaries: the near misses do not unlock ----------

test('near misses: nine passes, a break in the streak, no fail-then-pass on one command', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: CLAIMS_ON } })
  await start($)
  await turnStart($)
  for (let i = 0; i < 9; i++) await bash($, w, 'npm test', true)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
  // a failure on one command, a pass on another: not a fix; and the failure resets the run
  await turnStart($)
  await bash($, w, 'npm run test:unit', false)
  await bash($, w, 'npm test', true)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
  // a pass on the failing command is a fix
  await turnStart($)
  await bash($, w, 'npm run test:unit', true)
  await turnDone($)
  expect(idsOf(w)).toEqual(['bug-hunter'])
})

test('a streak of ten counts passes in a row: the failure in the middle starts it over', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: CLAIMS_ON } })
  await start($)
  await turnStart($)
  for (let i = 0; i < 6; i++) await bash($, w, 'npm test', true)
  await bash($, w, 'npm test', false)
  for (let i = 0; i < 9; i++) await bash($, w, 'npm test', true)
  await turnDone($)
  // 6 + 9 passes, but never 10 in a row; the fail then pass on the same command is a bug hunter
  expect(idsOf(w)).toEqual(['bug-hunter'])
  await turnStart($)
  await bash($, w, 'npm test', true)
  await turnDone($)
  expect(idsOf(w)).toEqual(['bug-hunter', 'green-streak'])
})

test('context ninja needs 100k: 99,999 tokens is not enough', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'savings:days': { '2026-11-06': { tokens: 60_000, usd: 0 }, '2026-11-07': { tokens: 39_999, usd: 0 } } } })
  await start($)
  expect(idsOf(w)).toEqual([])
  w.store.set('savings:days', { '2026-11-06': { tokens: 60_000, usd: 0 }, '2026-11-07': { tokens: 40_000, usd: 0 } })
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual(['context-ninja'])
})

test('safety guardian needs 100: 99 prevented is only a first save', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'incidents:C:/proj': incidentsAt(99) } })
  await start($)
  expect(idsOf(w)).toEqual(['first-save'])
})

test('marathon: four days (three before today) is not five', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': priorDays(3) } })
  await start($)
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
  // a gap breaks the run
  w.store.set('week-heatmap:days', { ...priorDays(3), [dayKey(NOON - 5 * DAY)]: { turns: 1, ms: 1, tokens: 0, cost: 0 }, [dayKey(NOON - 6 * DAY)]: { turns: 1, ms: 1, tokens: 0, cost: 0 } })
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
})

test('week one counts days of use, not a run: six spread-out days plus today', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': priorDays(6, 2) } })
  await start($)
  expect(idsOf(w)).toEqual([])
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual(['week-one'])
})

test('week one: five earlier days plus today is six', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'week-heatmap:days': priorDays(5, 3) } })
  await start($)
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
})

const HOURS: Array<[number, number, string[]]> = [
  [0, 0, ['night-owl']],
  [4, 59, ['night-owl']],
  [5, 0, ['early-bird']],
  [6, 59, ['early-bird']],
  [7, 0, []],
  [23, 59, []],
]
for (const [h, m, want] of HOURS) {
  test(`time of day ${h}:${String(m).padStart(2, '0')} earns ${want.join(',') || 'nothing'}, and never at a session start alone`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = world(on, { now: AT(h, m) })
    await start($)
    expect(idsOf(w)).toEqual([])
    await turnStart($)
    await turnDone($)
    expect(idsOf(w)).toEqual(want)
  })
}

test('a subagent turn at night does not earn a trophy', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { now: AT(2) })
  await start($)
  await turnStart($, { agentId: 'a1' })
  await turnDone($, 1000, { agentId: 'a1' })
  expect(idsOf(w)).toEqual([])
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual(['night-owl'])
})

test('polyglot: English is not a switch', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'en' } })
  await start($)
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
})

const deck = (n: number, off = false): Record<string, boolean> => {
  const m: Record<string, boolean> = Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, true]))
  if (off) m['off-one'] = false
  return m
}

test('full deck: 71 on is not the full deck', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: deck(71) } })
  await start($)
  expect(idsOf(w)).toEqual([])
})

test('full deck: 72 on with one explicitly off is not the full deck', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: deck(72, true) } })
  await start($)
  expect(idsOf(w)).toEqual([])
})

test('minimalist: another profile is not it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { profile: 'playful' } })
  await start($)
  expect(idsOf(w)).toEqual([])
})

test('spending and busy-ness earn nothing: a huge bill and thirty turns unlock no trophy', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 99, usd: 500 } })
  await start($)
  for (let i = 0; i < 30; i++) {
    await turnStart($)
    await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
    await turnDone($, 600_000)
  }
  expect(idsOf(w)).toEqual([])
})

// ---------- levels, sound ----------

test('a common trophy is an info notice (no toast); a rare or epic one is an alert (a toast)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'incidents:C:/proj': incidentsAt(100) } })
  await start($)
  // First Save is common, Safety Guardian epic
  expect(w.toasts).toContain('🏆 Achievement unlocked: Safety Guardian')
  expect(w.toasts).not.toContain('🏆 Achievement unlocked: First Save')
  const all = await noticeTexts($)
  expect(all).toContain('🏆 Achievement unlocked: First Save')
  expect(all).toContain('🏆 Achievement unlocked: Safety Guardian')
})

test('a rare trophy is an alert too', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'savings:days': { '2026-11-07': { tokens: 250_000, usd: 1 } } } })
  await start($)
  expect(w.toasts).toContain('🏆 Achievement unlocked: Context Ninja')
})

test('sound: the buddy clip plays once per unlock when Sounds is on, and not when it is off', { timeoutMs: 30_000 }, async ($, on) => {
  const played: string[] = []
  on('audio.play', (_: any, e: any) => {
    played.push(String(e.clip.asset))
    return { value: undefined } as any
  })
  const w = world(on, { store: { enabled: { sounds: true }, 'incidents:C:/proj': incidentsAt(100) } })
  await start($)
  expect(idsOf(w)).toEqual(['first-save', 'safety-guardian'])
  expect(played).toEqual(['sounds/buddy.wav'])
  // no more unlocks, no more sound
  await turnStart($)
  await turnDone($)
  expect(played).toEqual(['sounds/buddy.wav'])
})

test('sound off (the default): no clip', { timeoutMs: 30_000 }, async ($, on) => {
  const played: string[] = []
  on('audio.play', (_: any, e: any) => {
    played.push(String(e.clip.asset))
    return { value: undefined } as any
  })
  const w = world(on, { store: { 'incidents:C:/proj': incidentsAt(1) } })
  await start($)
  expect(idsOf(w)).toEqual(['first-save'])
  expect(played).toEqual([])
})

// ---------- the pane: the shelf ----------

test('the shelf: unlocked with icon, title and date; locked with a silhouette and how to earn it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'incidents:C:/proj': incidentsAt(1) } })
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE('achievements'), surface })
    const all = await texts(ui)
    const text = all.join('\n')
    expect(all.slice(0, 3)).toEqual(['✦', 'Achievements', `1 / ${TOTAL}`])
    expect(text).toContain('🛟 First Save')
    expect(text).toContain(dayKey(NOON))
    expect(text).toContain('common')
    // eleven locked ones, each a silhouette and a one-line hint
    expect(all.filter(x => x.startsWith('▢ ')).length).toBe(TOTAL - 1)
    expect(text).not.toContain('▢ First Save')
    expect(text).toContain('▢ Safety Guardian')
    expect(text).toContain('Have the guards stop 100 disasters.')
    expect(text).toContain('▢ Green Streak')
    expect(text).toContain('Get 10 passing test runs in a row.')
    expect(text).toContain('Unlocked')
    expect(text).toContain('Locked')
    await ui.unmount()
  }
  void w
})

test('the shelf lists the newest trophy first and shows rarity', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'achievements:unlocked': { 'first-save': NOON - 3 * DAY, polyglot: NOON - DAY, 'context-ninja': NOON - 2 * DAY } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  const all = await texts(ui)
  const order = all.filter(x => /First Save|Polyglot|Context Ninja/.test(x) && !x.startsWith('▢'))
  expect(order).toEqual(['🌍 Polyglot', '🥷 Context Ninja', '🛟 First Save'])
  expect(all).toContain('rare')
  expect(all).toContain(dayKey(NOON - DAY))
  expect(all.some(x => x === `3 / ${TOTAL}`)).toBe(true)
  await ui.unmount()
  void w
})

test('an empty shelf says so and what fills it; every trophy is locked', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  const all = await texts(ui)
  expect(all).toContain('No trophies yet.')
  expect(all.some(x => x.includes('never by spending'))).toBe(true)
  expect(all.filter(x => x.startsWith('▢ ')).length).toBe(TOTAL)
  // nothing to share yet: no share button
  expect(await labels(ui)).toEqual([])
  await ui.unmount()
})

test('a new unlock redraws an open pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  expect(await joined(ui)).toContain('0 / 12')
  w.store.set('incidents:C:/proj', incidentsAt(1))
  await turnStart($)
  await turnDone($)
  expect(await joined(ui)).toContain('1 / 12')
  expect(await joined(ui)).toContain('🛟 First Save')
  await ui.unmount()
})

// ---------- share ----------

test('share: copies a post with the latest trophy and the install line', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'achievements:unlocked': { 'first-save': NOON - 3 * DAY, polyglot: NOON - DAY } } })
  await start($)
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  expect(await labels(ui)).toEqual(['share'])
  await ui.press({ key: 'share-achievements' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]!.text).toBe('🏆 I just unlocked “Polyglot” in Claude Code (2/12 trophies). Get yours: claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(w.copies[0]!.surface).toBe('desktop')
  expect(await noticeTexts($)).toContain('Share text copied')
  await ui.unmount()
})

test('share on the terminal; a failed copy warns', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'achievements:unlocked': { 'first-save': NOON - DAY } } })
  await start($)
  w.copyOk = false
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'terminal' })
  await ui.press({ key: 'share-achievements' })
  expect(w.copies[0]!.surface).toBe('terminal')
  expect(w.copies[0]!.text).toContain('“First Save”')
  expect(await noticeTexts($)).toContain('Could not copy')
  await ui.unmount()
})

// ---------- the chip ----------

test('the chip shows the count for ten seconds after an unlock, then goes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { 'monday-report': false } } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  w.store.set('incidents:C:/proj', incidentsAt(1))
  await turnStart($)
  await turnDone($)
  const chip = await b.find({ key: 'chip-achievements' })
  expect(chip).toBeDefined()
  expect(chip!.text).toContain('🏆 1')
  await w.clock.advance(9_000)
  expect(await b.find({ key: 'chip-achievements' })).toBeDefined()
  await w.clock.advance(2_000)
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  await b.unmount()
})

test('the chip counts every trophy, and a second unlock restarts the ten seconds', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'achievements:unlocked': { 'first-save': NOON - DAY } } })
  await start($)
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  // an old trophy shows no chip
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  w.store.set('savings:days', { '2026-11-07': { tokens: 100_000, usd: 0 } })
  await turnStart($)
  await turnDone($)
  expect((await b.find({ key: 'chip-achievements' }))!.text).toContain('🏆 2')
  await w.clock.advance(8_000)
  w.store.set('language', 'es')
  await turnStart($)
  await turnDone($)
  expect((await b.find({ key: 'chip-achievements' }))!.text).toContain('🏆 3')
  await w.clock.advance(8_000)
  // the first ten seconds are over, the second unlock's are not
  expect(await b.find({ key: 'chip-achievements' })).toBeDefined()
  await w.clock.advance(3_000)
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  await b.unmount()
})

test('the chip yields to a survey', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'incidents:C:/proj': incidentsAt(1) } })
  await start($)
  const b = await $.ui.mount({ ...BAND('desktop', { hasSurvey: true }), requestId: 'band2' })
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  await b.unmount()
  void w
})

// ---------- Hebrew ----------

test('Hebrew: the command, the pane, the notice and the share text', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he', 'incidents:C:/proj': incidentsAt(1) } })
  await start($)
  expect(idsOf(w)).toEqual(['first-save', 'polyglot'])
  expect((await $.command.run({ command: 'trophies', args: '' })).text).toBe('הגביעים שלך נפתחו.')
  const notices = await noticeTexts($)
  expect(notices).toContain('🏆 הישג נפתח: ההצלה הראשונה')
  expect(notices).toContain('🏆 הישג נפתח: פוליגלוט')
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  const all = await texts(ui)
  expect(all).toContain('הישגים')
  expect(all).toContain(`2 / ${TOTAL}`)
  expect(all).toContain('נפתחו')
  expect(all).toContain('נעולים')
  expect(all.some(x => x.startsWith('▢ שומר הבטיחות'))).toBe(true)
  expect(all).toContain('   תנו לשומרי הסף לעצור 100 אסונות.')
  expect(all).toContain('נפוץ')
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons[0].props['label']).toBe('שתף')
  await ui.press({ key: 'share-achievements' })
  expect(w.copies[0]!.text).toContain('claude plugin install toolkitty --marketplace avraham-tech/toolkitty')
  expect(w.copies[0]!.text).toContain('הרגע פתחתי את')
  expect(w.copies[0]!.text).toContain('2/12')
  await ui.unmount()
})

// ---------- the off switch ----------

test('off switch: no unlocks, the command and pane say so, no chip', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { achievements: false }, 'incidents:C:/proj': incidentsAt(100), language: 'fr' }, now: AT(2) })
  await start($)
  await turnStart($)
  await turnDone($)
  expect(w.store.has('achievements:unlocked')).toBe(false)
  expect((await $.command.run({ command: 'trophies', args: '' })).text).toBe('Succès est désactivé ; activez-le dans le panneau /toolkitty')
  expect(w.opened.map(o => o.id)).not.toContain('achievements')
  const ui = await $.ui.mount({ ...PANE('achievements'), surface: 'desktop' })
  expect(await joined(ui)).toContain('Succès est désactivé')
  expect(await ui.find({ type: 'Button', key: 'share-achievements' })).toBeUndefined()
  await ui.unmount()
  const b = await $.ui.mount({ ...BAND(), requestId: 'band' })
  expect(await b.find({ key: 'chip-achievements' })).toBeUndefined()
  await b.unmount()
  expect((await noticeTexts($)).some(x => x.includes('🏆'))).toBe(false)
  expect(w.toasts.some(x => x.includes('🏆'))).toBe(false)
})

test('off switch in English', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { enabled: { achievements: false } } })
  await start($)
  expect((await $.command.run({ command: 'trophies', args: '' })).text).toBe(OFF)
})

test('turning it on later unlocks what was already true, once', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { enabled: { achievements: false }, 'incidents:C:/proj': incidentsAt(1) } })
  await start($)
  await turnStart($)
  await turnDone($)
  expect(idsOf(w)).toEqual([])
  w.store.set('enabled', {})
  await start($)
  expect(idsOf(w)).toEqual(['first-save'])
  await start($)
  expect((await noticeTexts($)).filter(x => x.includes('First Save')).length).toBe(1)
})
