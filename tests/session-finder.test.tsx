import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const HOUR = 3_600_000
const SLOW = { timeoutMs: 30_000 }
const INDEX = 'session-finder:index'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'session-finder',
  props: { title: 'Sessions', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature session-finder failed/
const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type Entry = { id: string; cwd: string; title: string; startedAt: number; updatedAt: number; prompts: string[] }
const entry = (id: string, title: string, over: Partial<Entry> = {}): Entry => ({
  id,
  cwd: 'C:/work/proj',
  title,
  startedAt: T0 - 5 * HOUR,
  updatedAt: T0 - 5 * HOUR,
  prompts: [],
  ...over,
})

function boot(on: any, store: Record<string, unknown> = {}) {
  const kv = new Map<string, unknown>(Object.entries({ language: 'en', ...store }))
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
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = {
    commands: [] as { name: string; argumentHint?: string }[],
    toasts: [] as string[],
    opened: [] as { id: string; title: string }[],
    titlePrompts: [] as string[],
    copies: [] as { text: string; surface?: string }[],
    invalidated: [] as string[],
  }
  const plan = { throws: false, reply: 'A Session Title', answered: true, copy: true, sid: 'sess-1', cwd: 'C:/work/proj' }
  on('command.register', (_: any, e: any) => {
    seen.commands.push({ name: e.name, argumentHint: e.argumentHint })
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
  on('ui.copy', (_: any, e: any) => {
    seen.copies.push({ text: e.text, surface: e.surface })
    return { value: plan.copy ? { isCopied: true } : { isCopied: false, reason: 'refused' } }
  })
  on('model.complete', (_: any, e: any) => {
    // decision-ledger asks too (when on); only this feature's title prompt is recorded
    if (e.prompt.startsWith('Write a title')) seen.titlePrompts.push(e.prompt)
    if (plan.throws && e.prompt.startsWith('Write a title')) throw new Error('model down')
    if (!plan.answered) return { value: { isAnswered: false, reason: 'api-error', status: 500, error: 'server_error', usage: USAGE } }
    return { value: { isAnswered: true, text: plan.reply, usage: USAGE } }
  })
  on('session.id', () => ({ value: plan.sid }))
  on('session.cwd', () => ({ value: plan.cwd }))
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', (_: any, e: any) => {
    seen.invalidated.push(String(e.what ?? e.event ?? e.name ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, plan, kv }
}

const start = ($: any) => $.session.start({ cwd: 'C:/work/proj', surface: 'desktop', isInteractive: true })
const say = ($: any, text: string) => $.prompt.submit({ text })
const finish = ($: any, answer = 'Here is the answer.', extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', ...extra })
const find = ($: any, args: string) => $.command.run({ command: 'find', args })
const idx = (kv: Map<string, unknown>) => (kv.get(INDEX) ?? []) as Entry[]

async function openPane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  return $.ui.mount({ ...PANE, surface })
}
async function texts(ui: any): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
}
/** Everything Toolkitty noticed, as the notices pane shows it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const out = (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
  await ui.unmount()
  return out
}

const EMPTY = ['›', 'Sessions', 'No sessions indexed yet.', 'Sessions are indexed once Claude has answered a few times; /find searches them.']

async function labels(ui: any): Promise<string[]> {
  return (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.text))
}

test('loads and registers /find with its hint and /sessions', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands.find(c => c.name === 'find')?.argumentHint).toBe('<term>')
  expect(seen.commands.map(c => c.name)).toContain('sessions')
})

test('the first answer titles the session and writes the index entry', SLOW, async ($, on) => {
  const { seen, plan, kv } = boot(on)
  await start($)
  plan.reply = '"Fix the login bug"\nbecause reasons'
  await say($, 'please fix the login')
  await say($, '/compact')
  await say($, '   ')
  await say($, 'and the logout too')
  await finish($, 'I fixed it.')
  expect(seen.titlePrompts).toHaveLength(1)
  const p = seen.titlePrompts[0]!
  expect(p).toContain('in English.')
  expect(p).toContain("1. please fix the login\n2. and the logout too")
  expect(p).not.toContain('/compact')
  expect(p).toContain('I fixed it.')
  expect(idx(kv)).toEqual([
    {
      id: 'sess-1',
      cwd: 'C:/work/proj',
      title: 'Fix the login bug',
      startedAt: T0,
      updatedAt: T0,
      prompts: ['please fix the login', 'and the logout too'],
    },
  ])
})

test('prompt.submit passes the prompt on unchanged', SLOW, async ($, on) => {
  boot(on)
  await start($)
  const r = await say($, 'keep me')
  expect(r.text).toBe('keep me')
  expect(r.drop).toBeUndefined()
})

test('the title is cleaned: first line, quotes stripped, cut to 100 characters; empty titles add nothing', SLOW, async ($, on) => {
  const { plan, kv } = boot(on)
  await start($)
  plan.reply = '«  Spaced title  »\n\nsecond line'
  await finish($)
  expect(idx(kv)[0]!.title).toBe('Spaced title')

  // a new session starts counting answers again
  await start($)
  plan.sid = 'sess-2'
  plan.reply = 'w'.repeat(150)
  await finish($)
  expect(idx(kv).find(x => x.id === 'sess-2')!.title).toBe('w'.repeat(100))

  await start($)
  plan.sid = 'sess-3'
  plan.reply = '""'
  await finish($)
  expect(idx(kv).find(x => x.id === 'sess-3')).toBeUndefined()
})

test('an unanswered model call, a blank answer, non-answer reasons and subagent turns add nothing', SLOW, async ($, on) => {
  const { seen, plan, kv } = boot(on)
  await start($)
  plan.answered = false
  await finish($)
  plan.answered = true
  await finish($, '   ')
  await finish($, 'text', { reason: 'aborted', isAborted: true })
  await finish($, 'text', { reason: 'error' })
  await finish($, 'text', { agentId: 'ag1' })
  expect(kv.get(INDEX)).toBeUndefined()
  // only the first (unanswered) attempt reached the model
  expect(seen.titlePrompts).toHaveLength(1)
})

test('only the 1st and 6th answers ask for a title; the entry keeps its start and is refreshed in place', SLOW, async ($, on) => {
  const { clock, seen, plan, kv } = boot(on)
  await start($)
  await say($, 'first request')
  plan.reply = 'Title one'
  await finish($)
  expect(idx(kv)[0]!.updatedAt).toBe(T0)

  await clock.advance(60_000)
  plan.reply = 'ignored'
  for (let i = 2; i <= 5; i++) await finish($)
  expect(seen.titlePrompts).toHaveLength(1)

  plan.reply = 'Title six'
  await finish($)
  expect(seen.titlePrompts).toHaveLength(2)
  expect(seen.titlePrompts[1]).toContain('1. first request')
  expect(idx(kv)).toHaveLength(1)
  expect(idx(kv)[0]).toEqual({
    id: 'sess-1',
    cwd: 'C:/work/proj',
    title: 'Title six',
    startedAt: T0,
    updatedAt: T0 + 60_000,
    prompts: ['first request'],
  })

  // a seventh answer asks nothing more
  await finish($)
  expect(seen.titlePrompts).toHaveLength(2)
})

test('a new session goes first in the index; at most five prompts of 300 characters are kept', SLOW, async ($, on) => {
  const { plan, kv } = boot(on, { [INDEX]: [entry('old-1', 'Old session')] })
  await start($)
  for (let i = 1; i <= 7; i++) await say($, i === 1 ? 'p'.repeat(400) : `prompt ${i}`)
  plan.sid = 'sess-new'
  await finish($)
  const list = idx(kv)
  expect(list.map(x => x.id)).toEqual(['sess-new', 'old-1'])
  expect(list[0]!.prompts).toHaveLength(5)
  expect(list[0]!.prompts[0]).toBe('p'.repeat(300))
  expect(list[0]!.prompts[4]).toBe('prompt 5')
})

test('the index is capped at 300 sessions', SLOW, async ($, on) => {
  const many = Array.from({ length: 300 }, (_, i) => entry(`s${i}`, `Session ${i}`))
  const { kv } = boot(on, { [INDEX]: many })
  await start($)
  await finish($)
  const list = idx(kv)
  expect(list).toHaveLength(300)
  expect(list[0]!.id).toBe('sess-1')
  expect(list[299]!.id).toBe('s298')
})

test('/find with no term shows the usage; a term that matches nothing says so', SLOW, async ($, on) => {
  boot(on, { [INDEX]: [entry('a1', 'Fix login')] })
  await start($)
  expect((await find($, '')).text).toBe('Usage: /find <term>')
  expect((await find($, '    ')).text).toBe('Usage: /find <term>')
  expect((await find($, 'zebra')).text).toBe('No session matches "zebra".')
})

test('/find searches titles and prompts case-insensitively and shows id, folder path and date', SLOW, async ($, on) => {
  const day = Date.UTC(2026, 2, 5, 12)
  boot(on, {
    [INDEX]: [
      entry('t-1', 'Fix LOGIN bug', { updatedAt: day }),
      entry('p-2', 'Unrelated title', { cwd: 'D:/other', updatedAt: day, prompts: ['please   migrate\nthe\tdatabase to Postgres'] }),
      entry('n-3', 'Nothing here'),
    ],
  })
  await start($)
  const r = await find($, '  login ')
  expect(r.text).toBe('Sessions matching "login":\nFix LOGIN bug · C:/work/proj · 2026-03-05 · t-1')
  const r2 = await find($, 'POSTGRES')
  expect(r2.text).toBe('Sessions matching "POSTGRES":\nUnrelated title · D:/other · 2026-03-05 · p-2\n    "please migrate the database to Postgres"')
  const both = await find($, 'e')
  expect(both.text.split('\n')[0]).toBe('Sessions matching "e":')
})

test('/find lists at most 15 sessions, and clips a long matching prompt to 120 characters', SLOW, async ($, on) => {
  const list = Array.from({ length: 20 }, (_, i) => entry(`s${i}`, `needle ${i}`))
  list[0] = entry('s0', 'x', { prompts: ['needle ' + 'z'.repeat(300)] })
  boot(on, { [INDEX]: list })
  await start($)
  const r = await find($, 'needle')
  const heads = r.text.split('\n').filter((l: string) => l.includes(' · '))
  expect(heads).toHaveLength(15)
  const snippet = r.text.split('\n').find((l: string) => l.startsWith('    "'))!
  expect(snippet).toBe('    "' + ('needle ' + 'z'.repeat(300)).slice(0, 120) + '"')
})

test('/find shows (untitled) for an entry with an empty title that matched through a prompt', SLOW, async ($, on) => {
  boot(on, { [INDEX]: [entry('u1', '', { prompts: ['find the bug'] })] })
  await start($)
  const r = await find($, 'bug')
  expect(r.text).toContain('(untitled) · C:/work/proj · ')
})

test('a damaged index is ignored entry by entry', SLOW, async ($, on) => {
  const { seen } = boot(on, { [INDEX]: [entry('ok1', 'Valid one'), { id: 5 }, null, 'x', { id: 'noprompts', title: 't' }] })
  await start($)
  expect((await find($, 'valid')).text).toContain('ok1')
  await $.command.run({ command: 'sessions', args: '' })
  const ui = await openPane($)
  expect(await labels(ui)).toHaveLength(1)
  await ui.unmount()
  void seen
})

test('/sessions opens the pane; empty it says nothing is indexed', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect((await $.command.run({ command: 'sessions', args: '' })).text).toBe('Sessions pane opened.')
  expect(seen.opened).toContainEqual({ id: 'session-finder', title: 'Sessions' })
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('the pane lists sessions with folder and age, and pressing one copies its id', SLOW, async ($, on) => {
  const { seen } = boot(on, {
    [INDEX]: [
      entry('id-now', 'Just now', { updatedAt: T0 - 10 * 60_000 }),
      entry('id-hours', 'Hours old', { cwd: 'C:\\work\\second', updatedAt: T0 - 3 * HOUR - 5 }),
      entry('id-days', '', { updatedAt: T0 - 50 * HOUR }),
    ],
  })
  await start($)
  const ui = await openPane($)
  expect(await labels(ui)).toEqual(['Just now · proj · today', 'Hours old · second · 3h ago', '(untitled) · proj · 2d ago'])
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['session-id-now', 'session-id-hours', 'session-id-days'])

  await ui.press({ key: 'session-id-hours' })
  expect(seen.copies).toEqual([{ text: 'id-hours', surface: 'desktop' }])
  expect(await noticeTexts($)).toContain('Id copied. Resume with: claude --resume id-hours')
  await ui.unmount()
})

test('a refused copy says it could not copy and still gives the command', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, { [INDEX]: [entry('id-x', 'Some work')] })
  await start($)
  plan.copy = false
  const ui = await openPane($, 'terminal')
  await ui.press({ key: 'session-id-x' })
  expect(seen.copies).toEqual([{ text: 'id-x', surface: 'terminal' }])
  expect(await noticeTexts($)).toContain('Could not copy. Resume with: claude --resume id-x')
  await ui.unmount()
})

test('the pane lists at most 30 sessions', SLOW, async ($, on) => {
  const many = Array.from({ length: 40 }, (_, i) => entry(`s${i}`, `Session ${i}`))
  boot(on, { [INDEX]: many })
  await start($)
  const ui = await openPane($)
  // 30 are listed at most, and the pane shows as many as its rows allow (25 - 3 = 22)
  const n = (await ui.findAll({ type: 'Button' })).length
  expect(n).toBeLessThanOrEqual(30)
  expect(n).toBeGreaterThanOrEqual(3)
  await ui.unmount()
})

test('a finished turn refreshes an open pane', SLOW, async ($, on) => {
  const { plan, seen } = boot(on)
  await start($)
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  plan.reply = 'Fresh title'
  await finish($)
  // the plugin asked the engine to redraw; the bottom hook swallows that call, so redraw by hand
  expect(seen.invalidated).toContain('ui.render')
  await ui.redraw()
  expect(await labels(ui)).toEqual(['Fresh title · proj · today'])
  await ui.unmount()
})

test('off switch: nothing is indexed or recorded, commands and pane say so', SLOW, async ($, on) => {
  const { seen, kv } = boot(on, { enabled: { 'session-finder': false }, [INDEX]: [entry('keep', 'Kept')] })
  await start($)
  const r = await say($, 'hello')
  expect(r.text).toBe('hello')
  await finish($)
  expect(seen.titlePrompts).toHaveLength(0)
  expect(idx(kv).map(x => x.id)).toEqual(['keep'])
  const off = 'Session finder is turned off in the Toolkitty pane.'
  expect((await find($, 'kept')).text).toBe(off)
  expect((await $.command.run({ command: 'sessions', args: '' })).text).toBe(off)
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(['Session finder is turned off.'])
  await ui.unmount()
})

test('Hebrew: texts, the title prompt language, ages and the copy toast are in Hebrew', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, {
    language: 'he',
    [INDEX]: [entry('h-1', 'ישן', { updatedAt: T0 - 72 * HOUR }), entry('h-2', '', { updatedAt: T0 - HOUR / 4 })],
  })
  await start($)
  expect((await $.command.run({ command: 'sessions', args: '' })).text).toBe('חלונית הסשנים נפתחה.')
  expect(seen.commands.find(c => c.name === 'find')?.argumentHint).toBe('<מונח>')
  expect((await find($, '')).text).toMatch(/[א-ת]/)
  expect((await find($, 'zzz')).text).toMatch(/[א-ת]/)
  const ui = await openPane($)
  expect(await labels(ui)).toEqual(['ישן · proj · לפני 3 ימים', '(ללא כותרת) · proj · היום'])
  await ui.press({ key: 'session-h-1' })
  expect((await noticeTexts($)).some(x => /[א-ת]/.test(x) && x.includes('claude --resume h-1'))).toBe(true)
  await ui.unmount()
  plan.reply = 'כותרת'
  await finish($)
  expect(seen.titlePrompts[0]).toContain('in Hebrew.')
})

test('a model call that throws is swallowed and nothing is indexed', SLOW, async ($, on) => {
  const { plan, kv, seen } = boot(on)
  await start($)
  plan.throws = true
  await finish($)
  expect(kv.get(INDEX)).toBeUndefined()
  expect((await noticeTexts($)).filter(x => /session-finder/.test(x))).toEqual([])
})

test('the pane header: the session count as status, a hint, and every row is one pressable line', SLOW, async ($, on) => {
  boot(on, { [INDEX]: [entry('id-a', 'Alpha', { updatedAt: T0 - 10 * 60_000 }), entry('id-b', 'Beta', { updatedAt: T0 - 3 * HOUR })] })
  await start($)
  const ui = await openPane($)
  expect((await texts(ui)).slice(0, 4)).toEqual(['›', 'Sessions', '2 sessions', 'Press a row to copy its id.'])
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['session-id-a', 'session-id-b'])
  await ui.unmount()
})
