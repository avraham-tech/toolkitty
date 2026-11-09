import { expect, mock, test } from 'claude-code/testing'

import { BUILTIN_THEMES } from '../hooks/themes'
import {
  CARD_KINDS,
  cardSvg,
  containsText,
  dayKeyOf,
  latestAchievement,
  minutesWorked,
  petFromStore,
  postText,
  redact,
  redactReport,
  rollPet,
  safetyFromIncidents,
  savingsFromDays,
  summaryText,
} from '../hooks/sharing'

const T0 = 1_700_000_000_000
const DAY = 86_400_000
const HOUR = 3_600_000
const SLOW = { timeoutMs: 30_000 }
const BS = String.fromCharCode(92)
const OWN_FAILURE = /feature share-cards failed/

const CWD = 'C:/work/my-app'
const SEED = 424242
const PET = rollPet(SEED)

// ---------- pure: redaction ----------

test('redact: paths become their basename, in every shape', () => {
  const win = ['C:', 'Users', 'bob', 'my-app', 'src', 'app.ts'].join(BS)
  expect(redact(`edited ${win} today`)).toBe('edited app.ts today')
  expect(redact(`see ${win}.`)).toBe('see app.ts.')
  expect(redact('open /home/bob/projects/x/y.txt, then /etc/hosts')).toBe('open y.txt, then hosts')
  expect(redact('in ~/notes/todo.md')).toBe('in todo.md')
  expect(redact(`on ${BS}${BS}srv${BS}share${BS}report.pdf now`)).toBe('on report.pdf now')
  expect(redact('forward/slash C:/work/my-app/src/index.ts here')).toBe('forward/slash index.ts here')
  // a user folder never survives as a name
  expect(redact(['C:', 'Users', 'bob'].join(BS))).toBe('~')
  expect(redact('/home/bob')).toBe('~')
  // not paths: a slash command, a date, and/or, and a URL
  expect(redact('run /cards then /buddy')).toBe('run /cards then /buddy')
  expect(redact('on 1/2/2024 and/or later')).toBe('on 1/2/2024 and/or later')
  expect(redact('https://github.com/OWNER/REPO')).toBe('https://github.com/OWNER/REPO')
  const report = redactReport(`${win} and /home/bob/a/b.txt`)
  expect(report.paths).toBe(2)
  expect(report.secrets).toBe(0)
})

test('redact: secrets are masked with the kinds of pasted-secret-scan', () => {
  const cases: [string, string][] = [
    ['sk-abcdefghij1234567890abcd', 'api-key'],
    ['ghp_' + 'a1'.repeat(20), 'github'],
    ['AKIAABCDEFGHIJKLMNOP', 'aws'],
    ['xoxb-12345678-abcdefgh', 'slack'],
    ['AIza' + 'a1B2c3D4e5'.repeat(3) + 'a1B2c', 'google'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abc_def-123', 'jwt'],
  ]
  for (const [secret, kind] of cases) {
    const out = redact(`token is ${secret} ok`)
    expect(out).not.toContain(secret)
    expect(out).toContain(`[REDACTED ${kind}]`)
  }
  const generic = redact('api_key = "abcd1234efgh5678ijkl"')
  expect(generic).not.toContain('abcd1234efgh5678ijkl')
  expect(generic).toContain('[REDACTED generic]')
  const key = redact('-----BEGIN RSA PRIVATE KEY-----\nMIIEabc/def+ghi==\n-----END RSA PRIVATE KEY-----')
  expect(key).toBe('[REDACTED private-key]')
  // plain words are not secrets
  expect(redact('password = getPasswordFromEnvironment')).toBe('password = getPasswordFromEnvironment')
  expect(redact('sk-learn-is-a-library-name-here')).toBe('sk-learn-is-a-library-name-here')
  expect(redactReport(`${cases[0]?.[0]} ${cases[2]?.[0]}`).secrets).toBe(2)
})

test('redact: the project folder name is "my project" unless allowed', () => {
  expect(redact('Shipped my-app v1', { project: 'my-app' })).toBe('Shipped my project v1')
  expect(redact('Shipped my-app v1', { project: 'my-app', allowProject: true })).toBe('Shipped my-app v1')
  expect(redact('Shipped MY-APP v1', { project: 'my-app' })).toBe('Shipped my project v1')
  // whole names only
  expect(redact('my-app-v2 and my-apple', { project: 'my-app' })).toBe('my-app-v2 and my-apple')
  expect(redact('a my-app, b my-app.', { projects: ['my-app', 'other'] })).toBe('a my project, b my project.')
  expect(redactReport('my-app and my-app', { project: 'my-app' }).projects).toBe(2)
  expect(redactReport('my-app', { project: 'my-app', allowProject: true }).projects).toBe(0)
  // a regex-special project name is taken literally
  expect(redact('in c++ (v1.0) now', { project: 'c++ (v1.0)' })).toBe('in my project now')
  // paths first: the project folder inside a path is cut to the basename
  const p = ['C:', 'work', 'my-app', 'src', 'a.ts'].join(BS)
  expect(redact(`${p} in my-app`, { project: 'my-app' })).toBe('a.ts in my project')
  // already redacted text stays put
  const once = redact(`${p} sk-abcdefghij1234567890abcd my-app`, { project: 'my-app' })
  expect(redact(once, { project: 'my-app' })).toBe(once)
})

// ---------- pure: data builders ----------

test('data builders read the stores defensively', () => {
  const days = {
    [dayKeyOf(T0)]: { tokens: 12_000, usd: 0.036 },
    [dayKeyOf(T0 - DAY)]: { tokens: 30_000, usd: 0.09 },
    [dayKeyOf(T0 - 10 * DAY)]: { tokens: 999_999, usd: 9 },
    junk: 'x',
  }
  const s = savingsFromDays(days, T0)
  expect(s.tokens).toBe(42_000)
  expect(Math.abs(s.usd - 0.126)).toBeLessThan(1e-9)
  expect(s.days.length).toBe(7)
  expect(s.days[6]).toBe(12_000)
  expect(s.days[5]).toBe(30_000)
  expect(savingsFromDays(undefined, T0)).toEqual({ tokens: 0, usd: 0, days: [0, 0, 0, 0, 0, 0, 0] })
  expect(savingsFromDays('nope', T0).tokens).toBe(0)

  const inc = {
    count: 6,
    items: [
      { at: T0 - HOUR, kind: 'pasted-secret' },
      { at: T0 - HOUR, kind: 'secret-file' },
      { at: T0 - 2 * HOUR, kind: 'dangerous-command' },
      { at: T0 - 3 * HOUR, kind: 'ci-red' },
      { at: T0 - 4 * HOUR, kind: 'mystery' },
      { at: T0 - 40 * DAY, kind: 'dangerous-command' },
    ],
  }
  expect(safetyFromIncidents(inc, T0)).toEqual({ total: 5, families: { secrets: 2, destructive: 1, ci: 1, other: 1 } })
  expect(safetyFromIncidents(undefined, T0)).toEqual({ total: 0, families: {} })
  expect(safetyFromIncidents({ items: 'x' }, T0).total).toBe(0)

  expect(latestAchievement(undefined)).toBeNull()
  expect(latestAchievement([])).toBeNull()
  expect(latestAchievement({})).toBeNull()
  const list = [
    { id: 'a', title: 'First', icon: '🥇', at: T0 - 5 * DAY },
    { id: 'b', title: 'Newest', icon: '🚀', at: T0 - DAY },
    { id: 'c', title: 'Middle', at: T0 - 2 * DAY },
  ]
  expect(latestAchievement(list)).toEqual({ icon: '🚀', title: 'Newest', date: dayKeyOf(T0 - DAY) })
  expect(latestAchievement({ 'first-commit': T0 - 3 * DAY, 'ten-turns': T0 - DAY })).toEqual({ icon: '', title: 'ten turns', date: dayKeyOf(T0 - DAY) })
  expect(latestAchievement(['one', 'two'])?.title).toBe('two')

  expect(petFromStore(undefined, 2, 10)).toBeNull()
  expect(petFromStore(0, 2, 10)).toBeNull()
  const pet = petFromStore(SEED, 3, 125.4)
  expect(pet).toEqual({ ...PET, stage: 3, xp: 125, mood: 'idle' })
  expect(petFromStore(SEED, 'x', 0)?.stage).toBe(1)
  // the pose comes from buddy:mood; anything unknown is the calm pose
  expect(petFromStore(SEED, 2, 0, 'guarding')?.mood).toBe('guarding')
  expect(petFromStore(SEED, 2, 0, 'bogus')?.mood).toBe('idle')
  expect(petFromStore(SEED, 2, 0, 7)?.mood).toBe('idle')
  // the same seed always gives the same companion; the species and rarity come from the closed sets
  expect(rollPet(SEED)).toEqual(rollPet(SEED))
  const seen = new Set<string>()
  for (let seed = 1; seed < 400; seed++) seen.add(rollPet(seed).species)
  expect(seen.size).toBe(12)
  expect(minutesWorked({ a: { ms: 2 * HOUR }, b: { ms: 30 * 60_000 }, c: 'x' })).toBe(150)
  expect(minutesWorked(undefined)).toBe(0)
})

// ---------- pure: cards and posts ----------

const SAVINGS = { tokens: 1_234_567, usd: 3.7, days: [0, 100, 250, 0, 500, 900, 1000] }
const SAFETY = { total: 7, families: { secrets: 3, destructive: 2, edits: 1, ci: 1 } }
const TROPHY = { icon: '🚀', title: 'Shipped it', date: '2026-11-08' }
const PETCARD = { species: 'fox' as const, rarity: 'epic' as const, shiny: false, stage: 2 as const, xp: 5400, mood: 'idle' as const }

const DATA = { savings: SAVINGS, safety: SAFETY, achievement: TROPHY, pet: PETCARD }

test('every card is a 1200x630 SVG under 24 KB with its key texts, in every theme and language', () => {
  const bytes = (s: string): number => new TextEncoder().encode(s).length
  for (const theme of BUILTIN_THEMES) {
    for (const kind of CARD_KINDS) {
      const svg = cardSvg(kind, DATA[kind] as never, theme)
      expect(svg.startsWith('<svg ')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain('viewBox="0 0 1200 630"')
      expect(svg).toContain('width="1200" height="630"')
      expect(bytes(svg)).toBeLessThan(24 * 1024)
      expect(svg).toContain('Claude Code · Toolkitty')
      expect((svg.match(/<text/g) ?? []).length).toBe((svg.match(/<\/text>/g) ?? []).length)
      // the theme drives the background
      expect(svg).toContain(theme.receipt.accent)
    }
  }
  const th = BUILTIN_THEMES[0]!
  const savings = cardSvg('savings', SAVINGS, th)
  expect(savings).toContain('1.2M')
  expect(savings).toContain('tokens')
  expect(savings).toContain('$3.70')
  expect(savings).toContain('estimated')
  expect((savings.match(/<rect x="\d+" y="\d+" width="48"/g) ?? []).length).toBe(7)

  const safety = cardSvg('safety', SAFETY, th)
  expect(safety).toContain('>7<')
  expect(safety).toContain('potentially dangerous operations blocked')
  expect(safety).toContain('Secrets')
  expect(safety).toContain('Destructive commands')

  const trophy = cardSvg('achievement', TROPHY, th)
  expect(trophy).toContain('Shipped it')
  expect(trophy).toContain('🚀')
  expect(trophy).toContain('Unlocked 2026-11-08')

  const pet = cardSvg('pet', PETCARD, th)
  expect(pet).toContain('Fox')
  expect(pet).toContain('Epic')
  expect(pet).toContain('Stage 2')
  expect(pet).toContain('5.4K')
  expect(pet).toContain('XP')
  // the pose: the calm card carries no emblem; every other pose draws its own, statically, and names itself
  expect(pet).toContain('· calm')
  expect(pet).not.toContain('id="pose-')
  const guard = cardSvg('pet', { ...PETCARD, mood: 'guarding' }, th)
  expect(guard).toContain('id="pose-shield"')
  expect(guard).toContain('· on guard')
  expect(guard).not.toContain('<animate')
  expect(guard.length).toBeLessThan(24 * 1024)
  expect(cardSvg('pet', { ...PETCARD, mood: 'chasing' }, th)).toContain('id="pose-loop"')
  expect(cardSvg('pet', { ...PETCARD, mood: 'sleeping' }, th)).toContain('id="pose-zzz"')
  expect(cardSvg('pet', { ...PETCARD, mood: 'celebrating' }, th)).toContain('id="pose-confetti"')
  expect(cardSvg('pet', { ...PETCARD, mood: 'worried' }, th)).toContain('id="pose-drop"')
  expect(cardSvg('pet', { ...PETCARD, mood: 'working' }, th)).toContain('id="pose-typing"')
  expect(cardSvg('pet', { ...PETCARD, mood: 'guarding' }, th, 'he')).toContain('על המשמר')
  expect(pet).toContain('★★★★☆')

  // every species draws, and every language fits the size budget
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]) {
    const r = rollPet(seed)
    const svg = cardSvg('pet', { ...r, stage: 3, xp: 99_999 }, th, 'ru')
    expect(bytes(svg)).toBeLessThan(24 * 1024)
  }
  for (const lang of ['en', 'he', 'es', 'fr', 'ru'] as const) {
    for (const kind of CARD_KINDS) expect(bytes(cardSvg(kind, DATA[kind] as never, th, lang))).toBeLessThan(24 * 1024)
  }
  expect(cardSvg('safety', SAFETY, th, 'he')).toContain('פעולות שעלולות להיות מסוכנות נחסמו')
  expect(cardSvg('savings', SAVINGS, th, 'he')).toContain('הערכה')
})

test('cards carry no user identity, escape their text and scrub free text', () => {
  const th = BUILTIN_THEMES[1]!
  const evil = { icon: '🏆', title: `<b>"Rock" & roll</b> ${['C:', 'Users', 'bob', 'secret-proj', 'x.ts'].join(BS)} sk-abcdefghij1234567890abcd`, date: '2026-01-01' }
  const svg = cardSvg('achievement', evil, th)
  expect(svg).not.toContain('<b>')
  expect(svg).toContain('&lt;b&gt;')
  expect(svg).toContain('&amp;')
  expect(svg).not.toContain('bob')
  expect(svg).not.toContain('secret-proj')
  expect(svg).not.toContain('sk-abcdefghij')
  // none of the cards mentions a path, a project or a user
  for (const kind of CARD_KINDS) {
    const out = cardSvg(kind, DATA[kind] as never, th)
    expect(out).not.toMatch(/C:|\/home\/|\/Users\/|my-app/)
  }
  // a long title wraps into at most two lines and ends with an ellipsis
  const long = cardSvg('achievement', { icon: '🏆', title: 'word '.repeat(40), date: '2026-01-01' }, th)
  expect(long).toContain('…')
  expect((long.match(/font-size="58"/g) ?? []).length).toBe(2)
})

test('empty data draws the empty cards', () => {
  const th = BUILTIN_THEMES[2]!
  const savings = cardSvg('savings', { tokens: 0, usd: 0, days: [] }, th)
  expect(savings).toContain('estimated')
  expect(savings).toContain('$0.00')
  expect(cardSvg('safety', { total: 0, families: {} }, th)).toContain('potentially dangerous operations blocked')
  const none = cardSvg('achievement', null, th)
  expect(none).toContain('No achievements yet')
  const nopet = cardSvg('pet', null, th)
  expect(nopet).toContain('No companion yet')
  expect(nopet).toContain('/buddy')
  expect(cardSvg('pet', null, th, 'he')).toContain('עדיין אין מלווה')
  expect(summaryText('achievement', null)).toBe('No achievements yet')
  expect(summaryText('pet', null)).toContain('/buddy')
})

test('post texts are localized, scrubbed, and end with the install command and the repository link', () => {
  for (const kind of CARD_KINDS) {
    for (const lang of ['en', 'he', 'es', 'fr', 'ru'] as const) {
      const text = postText(kind, DATA[kind] as never, lang)
      // the install command, then the repository link, are the last two lines
      expect(text.endsWith('claude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')).toBe(true)
      expect(text.split('\n').length).toBe(3)
    }
  }
  expect(postText('savings', SAVINGS, 'en')).toBe('Toolkitty saved me an estimated $3.70 (1.2M tokens) this week.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(postText('savings', SAVINGS, 'he')).toBe('Toolkitty חסך לי לפי הערכה $3.70 (1.2M טוקנים) השבוע.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(postText('safety', SAFETY, 'en')).toBe('Toolkitty blocked 7 potentially dangerous operations this month (secrets 3, destructive commands 2, risky edits 1, red ci 1).\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(postText('safety', SAFETY, 'he')).toContain('חסם 7 פעולות שעלולות להיות מסוכנות')
  expect(postText('safety', { total: 0, families: {} }, 'en')).toContain('no potentially dangerous operations this month')
  expect(postText('achievement', TROPHY, 'en')).toContain('Unlocked “Shipped it” in Claude Code (2026-11-08).')
  expect(postText('achievement', TROPHY, 'he')).toContain('“Shipped it”')
  expect(postText('achievement', null, 'en')).toContain('Collecting achievements')
  expect(postText('pet', PETCARD, 'en')).toBe('My Claude Code companion is a epic fox: companion, 5.4K XP.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(postText('pet', PETCARD, 'he')).toContain('שועל (אפי)')
  expect(postText('pet', { ...PETCARD, shiny: true }, 'en')).toContain('shiny')
  expect(postText('pet', null, 'en')).toContain('Meet your Claude Code companion')
  // a secret or a path in free text never reaches the post
  const sneaky = postText('achievement', { icon: '', title: `Cracked sk-abcdefghij1234567890abcd in ${['C:', 'Users', 'bob', 'p', 'f.ts'].join(BS)}`, date: '' }, 'en')
  expect(sneaky).not.toContain('sk-abcdefghij')
  expect(sneaky).not.toContain('bob')
  expect(sneaky).not.toContain('()')
  // what each card contains is spelled out in every language
  for (const kind of CARD_KINDS) {
    expect(containsText(kind, 'en')).toContain('Claude Code · Toolkitty')
    expect(containsText(kind, 'he')).not.toBe(containsText(kind, 'en'))
  }
})

// ---------- the engine: the /cards pane ----------

type Rig = {
  kv: Map<string, unknown>
  writes: { path: string; text: string }[]
  copies: string[]
  opened: string[]
  commands: string[]
  toasts: string[]
  http: string[]
  failWrite: boolean
  failCopy: boolean
}

function rig(on: any, o: { lang?: string; enabled?: Record<string, boolean>; seed?: Record<string, unknown>; cwd?: string } = {}): Rig {
  const kv = new Map<string, unknown>(Object.entries({ language: o.lang ?? 'en', // achievements off: with the seeded incidents it would unlock its own trophy and change what the cards show
    enabled: { achievements: false, ...(o.enabled ?? {}) }, ...(o.seed ?? {}) }))
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    kv.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    kv.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...kv.keys()] }))
  mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:\\Users\\test', TEMP: 'C:/tmp' })
  mock.session(on)

  const r: Rig = { kv, writes: [], copies: [], opened: [], commands: [], toasts: [], http: [], failWrite: false, failCopy: false }
  const norm = (p: string): string => p.split(BS).join('/')
  on('fs.write', (_: any, e: any) => {
    if (r.failWrite) throw new Error('EACCES ' + e.path)
    // other features write their own files (the session heartbeat); only the cards are under test
    if (norm(e.path).endsWith('.svg')) r.writes.push({ path: norm(e.path), text: e.text })
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    throw new Error('ENOENT ' + e.path)
  })
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('http.fetch', (_: any, e: any) => {
    r.http.push(String(e.url))
    throw new Error('no network in tests')
  })
  on('ui.copy', (_: any, e: any) => {
    if (r.failCopy) return { value: { isCopied: false, reason: 'refused' } }
    r.copies.push(e.text)
    return { value: { isCopied: true } }
  })
  on('command.register', (_: any, e: any) => {
    r.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    r.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    r.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.id', () => ({ value: 'sess-y' }))
  on('session.cwd', () => ({ value: o.cwd ?? CWD }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200000 }, rateLimits: [] } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', () => ({ result: {} }) as never)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return r
}

const SEEDED: Record<string, unknown> = {
  'savings:days': { [dayKeyOf(T0)]: { tokens: 12_000, usd: 0.036 }, [dayKeyOf(T0 - DAY)]: { tokens: 30_000, usd: 0.09 } },
  [`incidents:${CWD}`]: {
    count: 3,
    lastAt: T0 - HOUR,
    items: [
      { at: T0 - HOUR, feature: 'pasted-secret-scan', kind: 'pasted-secret', detail: 'api-key' },
      { at: T0 - 2 * HOUR, feature: 'dangerous-commands', kind: 'dangerous-command', detail: 'rm -rf' },
      { at: T0 - 3 * HOUR, feature: 'merge-gate', kind: 'ci-red', detail: 'main' },
    ],
  },
  // the real format of features/achievements.tsx: { [id]: unlockedAtMs }
  'achievements:unlocked': { 'first-save': T0 - DAY },
  'buddy:seed': SEED,
  'buddy:stage': 2,
  'week-heatmap:days': { [dayKeyOf(T0)]: { turns: 4, ms: 2 * HOUR, tokens: 1, cost: 0 } },
}

const PANE = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'share-cards',
    surface,
    props: { title: 'Share cards', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
const keysOf = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((x: any) => x.key as string)

test('loads, registers /cards and /cards opens the gallery', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  expect(r.commands).toContain('cards')
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  const cmd = await $.command.run({ command: 'cards', args: '' })
  expect(cmd.text).toBe('Share cards opened')
  expect(r.opened).toContain('share-cards')
})

// An id the catalog does not know falls back to the id text itself, which can carry free text (a project name):
// this is the seed for the project-name toggle and the redaction tests.
const SEEDED_FREE = { ...SEEDED, 'achievements:unlocked': { 'Shipped my-app v1': T0 - DAY } }

test('the gallery lists the four cards with their buttons and a privacy line each', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  for (const title of ['Savings card', 'Safety card', 'Achievement card', 'Companion card']) expect(all).toContain(title)
  const keys = await keysOf(ui)
  for (const kind of CARD_KINDS) for (const verb of ['preview', 'save', 'copy']) expect(keys).toContain(`${verb}-${kind}`)
  expect(keys).toContain('share-allow-project')
  // the summaries come from the stores
  expect(all).toContain('≈ 42K tokens · ≈ $0.13 · estimated')
  expect(all).toContain('3 potentially dangerous operations blocked (Secrets 1, Destructive commands 1, Red CI 1)')
  expect(all).toContain('🛟 First Save')
  expect(all).toContain(PET.species[0]!.toUpperCase() + PET.species.slice(1))
  expect(all).toContain('Stage 2')
  expect(all).toContain('120 XP')
  // privacy lines: what the card contains and what was redacted
  const privacy = (await texts(ui)).filter(x => x.startsWith('Privacy: contains '))
  expect(privacy.length).toBe(4)
  expect(privacy[0]).toContain('estimated tokens and dollars saved this week')
  expect(privacy[0]).toContain('Redacted: 0 paths, 0 secrets, 0 project names. Project name: hidden.')
  expect(privacy[2]).toContain('Redacted: 0 paths, 0 secrets, 0 project names. Project name: hidden.')
  expect(privacy[3]).toContain('its name is left out')
  expect(all).toContain('Nothing is uploaded')
  expect(all).toContain('local only')
  expect(r.http).toEqual([])
  await ui.unmount()
})

test('Preview shows the card on the desktop and a text summary on the terminal', SLOW, async ($, on) => {
  rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE('desktop'))
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.press({ key: 'preview-safety' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  const source = String(svg.props['source'])
  expect(source).toContain('potentially dangerous operations blocked')
  expect(source).toContain('Claude Code · Toolkitty')
  expect(String(svg.props['alt'])).toContain('Safety card')
  // pressing again hides it; another card replaces it
  await ui.press({ key: 'preview-safety' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.press({ key: 'preview-savings' })
  expect(String((await ui.find({ type: 'Svg' })).props['source'])).toContain('estimated')
  await ui.press({ key: 'preview-pet' })
  expect(String((await ui.find({ type: 'Svg' })).props['source'])).toContain('XP')
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(1)
  await ui.unmount()

  const term = await $.ui.mount({ ...PANE('terminal'), requestId: 'share-cards' })
  await term.press({ key: 'preview-savings' })
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  const all = await joined(term)
  expect(all).toContain('Claude Code · Toolkitty')
  expect(all.match(/≈ 42K tokens · ≈ \$0\.13 · estimated/g)?.length).toBe(2) // the section line and the preview box
  await term.unmount()
})

const stampOf = (ms: number): string => {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

test('Save SVG writes card-<kind>-<stamp>.svg under toolkitty-exports', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE())
  for (const kind of CARD_KINDS) await ui.press({ key: `save-${kind}` })
  expect(r.writes.map(w => w.path)).toEqual(CARD_KINDS.map(k => `${CWD}/toolkitty-exports/card-${k}-${stampOf(T0)}.svg`))
  for (const w of r.writes) {
    expect(w.text.startsWith('<svg ')).toBe(true)
    expect(w.text).toContain('Claude Code · Toolkitty')
    expect(w.text).not.toContain('my-app')
  }
  expect(r.writes[0]!.text).toContain('estimated')
  expect(r.writes[1]!.text).toContain('potentially dangerous operations blocked')
  expect(r.writes[2]!.text).toContain('First Save')
  expect(r.writes[3]!.text).toContain('Stage 2')
  // a failing disk is a notice, not a crash
  r.failWrite = true
  await ui.press({ key: 'save-savings' })
  expect(r.writes.length).toBe(4)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  expect(r.http).toEqual([])
  await ui.unmount()
})

test('Copy post copies the localized post text', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED })
  await start($)
  const ui = await $.ui.mount(PANE())
  for (const kind of CARD_KINDS) await ui.press({ key: `copy-${kind}` })
  expect(r.copies.length).toBe(4)
  expect(r.copies[0]).toBe('Toolkitty saved me an estimated $0.13 (42K tokens) this week.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(r.copies[1]).toBe('Toolkitty blocked 3 potentially dangerous operations this month (secrets 1, destructive commands 1, red ci 1).\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  expect(r.copies[2]).toContain('“First Save”')
  expect(r.copies[3]).toContain('My Claude Code companion')
  for (const c of r.copies) {
    expect(c.endsWith('claude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')).toBe(true)
    expect(c).not.toContain('my-app')
  }
  r.failCopy = true
  await ui.press({ key: 'copy-savings' })
  expect(r.copies.length).toBe(4)
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})

test('the project name toggle shows and hides it, and is remembered', SLOW, async ($, on) => {
  const r = rig(on, { seed: SEEDED_FREE })
  await start($)
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('Project name: hidden')
  expect(await joined(ui)).toContain('Shipped my project v1')
  expect(await joined(ui)).toContain('Redacted: 0 paths, 0 secrets, 1 project names. Project name: hidden.')
  await ui.press({ key: 'share-allow-project' })
  const shown = await joined(ui)
  expect(shown).toContain('Project name: shown')
  expect(shown).toContain('Shipped my-app v1')
  expect(shown).toContain('Redacted: 0 paths, 0 secrets, 0 project names. Project name: shown.')
  expect(r.kv.get('share-cards:allowProject')).toBe(true)
  await ui.press({ key: 'save-achievement' })
  expect(r.writes.at(-1)!.text).toContain('Shipped my-app v1')
  await ui.press({ key: 'copy-achievement' })
  expect(r.copies.at(-1)).toContain('“Shipped my-app v1”')
  await ui.press({ key: 'share-allow-project' })
  expect(r.kv.get('share-cards:allowProject')).toBe(false)
  expect(await joined(ui)).toContain('Project name: hidden')
  await ui.unmount()

})

test('a stored allow switch is honoured from the first draw', SLOW, async ($, on) => {
  rig(on, { seed: { ...SEEDED_FREE, 'share-cards:allowProject': true } })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Project name: shown')
  expect(all).toContain('Shipped my-app v1')
  await ui.unmount()
})

test('secrets and paths in a trophy title are redacted and counted', SLOW, async ($, on) => {
  const title = `Fixed ${['C:', 'Users', 'bob', 'my-app', 'a.ts'].join(BS)} with sk-abcdefghij1234567890abcd`
  const r = rig(on, { seed: { ...SEEDED, 'achievements:unlocked': { [title]: T0 } } })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).not.toContain('sk-abcdefghij')
  expect(all).not.toContain('bob')
  expect(all).toContain('Redacted: 1 paths, 1 secrets, 0 project names.')
  await ui.press({ key: 'save-achievement' })
  await ui.press({ key: 'copy-achievement' })
  expect(r.writes[0]!.text).not.toContain('sk-abcdefghij')
  expect(r.copies[0]).not.toContain('sk-abcdefghij')
  expect(r.copies[0]).not.toContain('bob')
  await ui.unmount()
})

test('empty data: every card says "none yet", Save and Copy do nothing', SLOW, async ($, on) => {
  // the companion feature rolls a buddy on the first session start, so it is off here
  const r = rig(on, { enabled: { buddy: false } })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all.match(/none yet/g)?.length).toBe(4)
  expect(all).toContain('Run /buddy to meet your companion.')
  expect(all).toContain('It fills when you unlock your first achievement.')
  expect(all).toContain('see /incidents')
  expect((await texts(ui)).filter(x => x.startsWith('Privacy: contains ')).length).toBe(4)
  for (const kind of CARD_KINDS) {
    await ui.press({ key: `save-${kind}` })
    await ui.press({ key: `copy-${kind}` })
  }
  expect(r.writes).toEqual([])
  expect(r.copies).toEqual([])
  // the preview still draws the empty card
  await ui.press({ key: 'preview-pet' })
  expect(String((await ui.find({ type: 'Svg' })).props['source'])).toContain('No companion yet')
  await ui.unmount()
})

test('the pane is Hebrew when the language is', SLOW, async ($, on) => {
  const r = rig(on, { lang: 'he', seed: SEEDED })
  await start($)
  const cmd = await $.command.run({ command: 'cards', args: '' })
  expect(cmd.text).toBe('כרטיסי השיתוף נפתחו')
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('כרטיס חיסכון')
  expect(all).toContain('כרטיס בטיחות')
  expect(all).toContain('שום דבר לא מועלה')
  expect(all).toContain('שם הפרויקט: מוסתר')
  const labels = (await ui.findAll({ type: 'Button' })).map((x: any) => String(x.props['label']))
  expect(labels).toContain('תצוגה מקדימה')
  expect(labels).toContain('שמור SVG')
  expect(labels).toContain('העתק פוסט')
  await ui.press({ key: 'copy-savings' })
  expect(r.copies[0]).toBe('Toolkitty חסך לי לפי הערכה $0.13 (42K טוקנים) השבוע.\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty\nhttps://github.com/avraham-tech/toolkitty')
  await ui.press({ key: 'save-safety' })
  expect(r.writes[0]!.text).toContain('פעולות שעלולות להיות מסוכנות נחסמו')
  await ui.unmount()
})

test('off switch: the command says so, the pane shows the off text, nothing is offered', SLOW, async ($, on) => {
  const r = rig(on, { enabled: { 'share-cards': false }, seed: SEEDED })
  await start($)
  expect(r.commands).toContain('cards')
  const cmd = await $.command.run({ command: 'cards', args: '' })
  expect(cmd.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(r.opened).not.toContain('share-cards')
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toContain('The feature is off; turn it on in the /toolkitty pane')
  expect((await keysOf(ui)).filter(k => /^(preview|save|copy)-/.test(k))).toEqual([])
  expect(r.writes).toEqual([])
  expect(r.toasts.filter(x => OWN_FAILURE.test(x))).toEqual([])
  await ui.unmount()
})
