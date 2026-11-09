import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'

type Usage = {
  startedAt: number
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}

const FULL: Usage = {
  startedAt: 0,
  context: { tokens: 123456, window: 1000000, percent: 12 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-11-08T15:00:00.000Z' },
    { kind: 'seven_day', percentUsed: 7 },
    { kind: 'spend_limit', percentUsed: 90 },
    { kind: 'weird_kind', percentUsed: 1 },
  ],
  cost: { usd: 1.5 },
}

function boot(on: On, store: Record<string, unknown> = {}, usage: Usage = FULL) {
  refusal = null
  const seen = { registered: [] as string[], usageCalls: 0 }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => {
    if (refusal !== null && refusal.name === e.name) {
      if (refusal.how === 'throw') throw new Error('taken')
      return { deny: 'taken' }
    }
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.usage', () => {
    seen.usageCalls++
    return { value: usage as never }
  })
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })

test('registers /ctx at session start', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('ctx')
})

test('shows context, cost and every kind of usage window (no args)', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  const r = await $.command.run({ command: 'ctx', args: '' })
  const lines = (r.text as string).split('\n')
  expect(lines[0]).toBe('Session status:')
  expect(lines[1]).toBe('• Context: 12% (123,456 of 1,000,000 tokens)')
  expect(lines[2]).toBe('• Cost so far: $1.50')
  expect(lines[3]).toMatch(/^• 5-hour window: 41% \(resets .+\)$/)
  expect(lines[4]).toBe('• 7-day window: 7%')
  expect(lines[5]).toBe('• Spend limit: 90%')
  expect(lines[6]).toBe('• weird_kind: 1%')
})

test('arguments are ignored', { timeoutMs: 30000 }, async ($, on) => {
  boot(on)
  await start($)
  const a = await $.command.run({ command: 'ctx', args: '' })
  const b = await $.command.run({ command: 'ctx', args: 'extra words' })
  expect(b.text).toBe(a.text)
})

test('unknown context size and no cost, no limits', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { startedAt: 0, context: { window: 200000 }, rateLimits: [] })
  await start($)
  const r = await $.command.run({ command: 'ctx', args: '' })
  expect(r.text).toBe(
    ['Session status:', '• Context: not known yet (— of 200,000 tokens)', '• Usage limits: no data'].join('\n'),
  )
})

test('Hebrew output', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  const r = await $.command.run({ command: 'ctx', args: '' })
  const text = r.text as string
  expect(text).toContain('מצב הסשן:')
  expect(text).toContain('• הקשר: 12% (123,456 מתוך 1,000,000 טוקנים)')
  expect(text).toContain('• עלות עד כה: $1.50')
  expect(text).toContain('חלון 5 שעות')
  expect(text).toContain('חלון 7 ימים')
  expect(text).toContain('מגבלת הוצאה')
  expect(text).toContain('מתאפס')
})

test('Hebrew with nothing known', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { startedAt: 0, context: { window: 10 }, rateLimits: [] })
  await start($)
  const r = await $.command.run({ command: 'ctx', args: '' })
  expect(r.text).toContain('לא ידוע עדיין')
  expect(r.text).toContain('אין נתונים')
})

test('off switch: off text, usage never read', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { 'context-info': false } })
  await start($)
  expect(seen.registered).toContain('ctx')
  seen.usageCalls = 0
  const r = await $.command.run({ command: 'ctx', args: '' })
  expect(r.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(seen.usageCalls).toBe(0)
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he', enabled: { 'context-info': false } })
  await start($)
  const r = await $.command.run({ command: 'ctx', args: '' })
  expect(r.text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

/** The harness' command.register answer refuses this name (the engine: a built-in or another plugin owns it). */
let refusal: { name: string; how: 'deny' | 'throw' } | null = null

/** Everything Toolkitty noticed, as the notices pane draws it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'toolkitty', surface: 'desktop', component: 'Pane', requestId: 'toolkitty-notices', props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

test('renamed: /context is no longer registered, /ctx is', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('ctx')
  expect(seen.registered).not.toContain('context')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /ctx registration (${how}) warns and the rest of session start still runs`, { timeoutMs: 30000 }, async ($, on) => {
    const seen = boot(on)
    refusal = { name: 'ctx', how }
    await start($)
    expect(seen.registered).not.toContain('ctx')
    expect(seen.registered.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /ctx could not be registered: '))).toBe(true)
  })
}
