import { expect, mock, test } from 'claude-code/testing'

const SLOW = { timeoutMs: 30_000 }
// Monday 9 Nov 2026, local noon: ISO week 2026-W46 whatever the machine's time zone
const NOW = new Date(2026, 10, 9, 12).getTime()
const WEEK = '2026-W46'
const HOUR = 3_600_000
const CWD = 'C:/work/proj'

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'monday-report',
  props: { title: 'Your week with Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature monday-report failed/

const pad2 = (n: number) => String(n).padStart(2, '0')
/** The local day key the feature uses, `back` days before NOW. */
const dayKey = (back: number) => {
  const d = new Date(2026, 10, 9 - back, 12)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Seven days of activity: Tue 3 Nov .. Mon 9 Nov. */
function week(): Record<string, unknown> {
  return {
    'week-heatmap:days': {
      [dayKey(6)]: { turns: 2, ms: HOUR, tokens: 1000, cost: 0.5 },
      [dayKey(4)]: { turns: 10, ms: 2 * HOUR, tokens: 250_000, cost: 4.25 },
      [dayKey(0)]: { turns: 3, ms: HOUR / 2, tokens: 1_500_000, cost: 1.5 },
      // outside the seven days: must not count
      [dayKey(8)]: { turns: 99, ms: 99 * HOUR, tokens: 99_000_000, cost: 999 },
    },
    'week-heatmap:tools': { Bash: 100, Read: 50, Edit: 20, Grep: 5 },
    'savings:days': {
      [dayKey(4)]: { tokens: 12_000, usd: 0.04 },
      [dayKey(0)]: { tokens: 3000, usd: 0.01 },
      [dayKey(9)]: { tokens: 777_000, usd: 77 },
    },
    'monday-report:extra': {
      loops: { [dayKey(3)]: 2, [dayKey(0)]: 1, [dayKey(10)]: 50 },
      longest: { [dayKey(4)]: 125_000, [dayKey(9)]: 9_000_000 },
      tools: { [dayKey(7)]: { Bash: 60, Read: 50 } },
      loopsAt: 0,
    },
    [`incidents:${CWD}`]: {
      count: 8,
      items: [
        { at: NOW - HOUR, feature: 'protect-secrets', kind: 'secret-file', detail: '.env' },
        { at: NOW - 2 * HOUR, feature: 'pasted-secret-scan', kind: 'pasted-secret', detail: 'token' },
        { at: NOW - 3 * HOUR, feature: 'dangerous-commands', kind: 'dangerous-command', detail: 'rm -rf' },
        { at: NOW - 4 * HOUR, feature: 'branch-lock', kind: 'branch-lock', detail: 'main' },
        { at: NOW - 5 * HOUR, feature: 'merge-gate', kind: 'ci-red', detail: 'pr 1' },
        { at: NOW - 6 * HOUR, feature: 'injection-tripwire', kind: 'injection', detail: 'page' },
        { at: NOW - 7 * HOUR, feature: 'x', kind: 'something-else', detail: '' },
        { at: NOW - 8 * 86_400_000, feature: 'protect-secrets', kind: 'secret-file', detail: 'old' },
      ],
    },
  }
}

const LETTER_EN =
  'Hi,\n\nHere is your week with Toolkitty (' +
  dayKey(6) +
  ' to ' +
  dayKey(0) +
  ').\n\nYou worked about 3.5 hours across 15 turns, using 1.8M tokens ($6.25). Your busiest day was Thu, 10 turns, and your longest turn took 2:05. Most used tools: Bash (40), Edit (20), Grep (5).\n\nWhat Toolkitty did for you:\n- Kept about 15K tokens ($0.05) out of the context\n- Stopped 7 incidents: 2 secrets, 1 destructive commands, 1 risky edits, 1 merges on red CI, 1 prompt injections, 1 other\n- Caught 3 loops before they ate your budget\n\nclaude plugin install toolkitty --marketplace avraham-tech/toolkitty'

function boot(on: any, store: Record<string, unknown> = {}, surfaces: string[] = ['desktop']) {
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
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = {
    commands: [] as string[],
    toasts: [] as string[],
    opened: [] as any[],
    copies: [] as { text: string; surface?: string }[],
  }
  const plan = { copy: 'ok' as 'ok' | 'refused' | 'throw', openFails: false, cwdFails: false }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e)
    if (plan.openFails && e.id === 'monday-report') throw new Error('no surface')
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', (_: any, e: any) => {
    seen.copies.push({ text: e.text, surface: e.surface })
    if (plan.copy === 'throw') throw new Error('clipboard')
    return { value: plan.copy === 'ok' ? { isCopied: true } : { isCopied: false, reason: 'refused' } }
  })
  on('session.cwd', () => {
    if (plan.cwdFails) throw new Error('no cwd')
    return { value: CWD }
  })
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { used: 0, total: 1, percent: 0, window: 200000 }, rateLimits: [], cost: { totalUsd: 0 } },
  }))
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  /** What opened the report pane (the switchboard pane is opened too, with another id). */
  const reportOpens = () => seen.opened.filter(o => o.id === 'monday-report')
  return { clock, seen, plan, kv, reportOpens }
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const finish = ($: any, durationMs = 1000, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs, isAborted: false, turnId: 't1', reason: 'answer', ...extra })

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

async function texts(ui: any): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
}
async function openPane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  return $.ui.mount({ ...PANE, surface })
}

test('loads and registers /report', SLOW, async ($, on) => {
  const { seen } = boot(on)
  await start($)
  expect(seen.commands).toContain('report')
})

test('/report opens the pane focused and closable, with any argument', SLOW, async ($, on) => {
  const { reportOpens } = boot(on, week(), [])
  await start($)
  expect(reportOpens()).toHaveLength(0)
  const r = await $.command.run({ command: 'report', args: '' })
  expect(r.text).toBe('Opened your weekly report.')
  expect(reportOpens()).toEqual([{ id: 'monday-report', title: 'Your week with Toolkitty', focus: true, closeOnEscape: true }])
  expect((await $.command.run({ command: 'report', args: 'last week' })).text).toBe('Opened your weekly report.')
  expect(reportOpens()).toHaveLength(2)
})

test('the desktop pane shows the week: numbers, what Toolkitty did, the bar chart, busiest day, tools and longest turn', SLOW, async ($, on) => {
  boot(on, week())
  await start($)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain(`${dayKey(6)} - ${dayKey(0)}`)
  for (const v of ['3.5', 'hours', '15', 'turns', '1.8M', 'tokens', '$6.25', 'spent']) expect(out).toContain(v)
  expect(out).toContain('What Toolkitty did for you')
  expect(out).toContain('+ Kept about 15K tokens ($0.05) out of the context')
  expect(out).toContain('+ Stopped 7 incidents: 2 secrets, 1 destructive commands, 1 risky edits, 1 merges on red CI, 1 prompt injections, 1 other')
  expect(out).toContain('+ Caught 3 loops before they ate your budget')
  expect(out).toContain('Turns per day')
  // bar labels: counts above the bars, weekday names below them (Tue .. Mon)
  expect(out.filter(x => x === '2' || x === '10' || x === '3').sort()).toEqual(['10', '2', '3'])
  for (const d of ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']) expect(out).toContain(d)
  expect(out).toContain('Busiest day: ')
  expect(out).toContain('Thu, 10 turns')
  expect(out).toContain('Top tools: ')
  expect(out).toContain('Bash (40), Edit (20), Grep (5)')
  expect(out).toContain('Longest turn: ')
  expect(out).toContain('2:05')
  await ui.unmount()
})

test('the Copy button copies the whole plain-text letter and confirms with a notice', SLOW, async ($, on) => {
  // this week's report was already shown, so no "ready" info notice puts the feature on its one-minute info cooldown
  const { seen } = boot(on, { ...week(), 'monday-report:lastShown': WEEK })
  await start($)
  const ui = await openPane($)
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map((b: any) => b.key)).toEqual(['report-copy'])
  expect(buttons[0].props['label']).toBe('Copy')
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  expect(seen.copies).toEqual([{ text: LETTER_EN, surface: 'desktop' }])
  expect(await noticeTexts($)).toContain('Report copied')
  await ui.unmount()
})

test('a copy that is refused or throws says it could not copy the report', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, week())
  await start($)
  const ui = await openPane($)
  plan.copy = 'refused'
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  expect((await noticeTexts($)).filter(x => x.startsWith('Could not copy the report'))).toEqual(['Could not copy the report'])
  plan.copy = 'throw'
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  // the same warning again inside five minutes folds into the same row with a count
  expect((await noticeTexts($)).filter(x => x.startsWith('Could not copy the report'))).toEqual(['Could not copy the report ×2'])
  await ui.unmount()
})

test('the terminal pane is the letter in a box with the same Copy button', SLOW, async ($, on) => {
  const { seen } = boot(on, week())
  await start($)
  const ui = await openPane($, 'terminal')
  const out = await texts(ui)
  expect(out).toContain(LETTER_EN)
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  expect(seen.copies).toEqual([{ text: LETTER_EN, surface: 'terminal' }])
  await ui.unmount()
})

test('with no activity the pane says so and offers no Copy', SLOW, async ($, on) => {
  boot(on)
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await openPane($, surface)
    expect(await texts(ui)).toEqual(['◔', 'Your week with Toolkitty', 'No activity recorded in the last 7 days yet. Come back after a few sessions.', 'Work in a few sessions and the report fills in; /report opens it any time.'])
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
    await ui.unmount()
  }
})

test('a week with turns but nothing Toolkitty did says that is fine, in the pane and in the letter', SLOW, async ($, on) => {
  const { seen } = boot(on, { 'week-heatmap:days': { [dayKey(1)]: { turns: 4, ms: HOUR, tokens: 500, cost: 0.1 } } })
  await start($)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('Nothing to report yet, which is also fine.')
  expect(out).toContain('Busiest day: ')
  expect(out).toContain('none')
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  const letter = seen.copies[0]!.text
  expect(letter).toContain('- Nothing to report yet, which is also fine.')
  expect(letter).toContain('Most used tools: none.')
  expect(letter).toContain('your longest turn took none.')
  await ui.unmount()
})

test('an unavailable working directory leaves the incident count at zero without breaking the report', SLOW, async ($, on) => {
  const { plan } = boot(on, week())
  await start($)
  plan.cwdFails = true
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out.some(x => x.includes('incidents'))).toBe(false)
  expect(out).toContain('+ Kept about 15K tokens ($0.05) out of the context')
  await ui.unmount()
})

test('a session start opens the report once per ISO week and remembers the week', SLOW, async ($, on) => {
  const { reportOpens, seen, kv } = boot(on, week())
  await start($)
  expect(reportOpens()).toEqual([{ id: 'monday-report', title: 'Your week with Toolkitty', focus: true, closeOnEscape: true }])
  expect(kv.get('monday-report:lastShown')).toBe(WEEK)
  expect(await noticeTexts($)).toContain('Your weekly Toolkitty report is ready: /report')
  // same week again: nothing more, on session start or on a turn
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(reportOpens()).toHaveLength(1)
})

test('a new week opens it again; this week already shown does not', SLOW, async ($, on) => {
  const prev = boot(on, { ...week(), 'monday-report:lastShown': '2026-W45' })
  await start($)
  expect(prev.reportOpens()).toHaveLength(1)
  expect(prev.kv.get('monday-report:lastShown')).toBe(WEEK)
})

test('already shown this week: session start opens nothing', SLOW, async ($, on) => {
  const { reportOpens, seen } = boot(on, { ...week(), 'monday-report:lastShown': WEEK })
  await start($)
  expect(reportOpens()).toHaveLength(0)
  expect(await noticeTexts($)).not.toContain('Your weekly Toolkitty report is ready: /report')
})

test('with no surface yet, session start waits and the first turn opens it; subagent turns do not', SLOW, async ($, on) => {
  const { reportOpens, kv } = boot(on, week(), [])
  await start($)
  expect(reportOpens()).toHaveLength(0)
  await $.turn.start({ text: 's', turnId: 'sub', agentId: 'ag1' })
  expect(reportOpens()).toHaveLength(0)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(reportOpens()).toHaveLength(1)
  expect(kv.get('monday-report:lastShown')).toBe(WEEK)
})

test('if the pane cannot be opened the week is not marked shown and no toast is made', SLOW, async ($, on) => {
  const { plan, kv, seen } = boot(on, week())
  plan.openFails = true
  await start($)
  expect(kv.get('monday-report:lastShown')).toBeUndefined()
  expect(await noticeTexts($)).not.toContain('Your weekly Toolkitty report is ready: /report')
})

test('a finished turn records the day: longest turn kept as the maximum, tool snapshot saved, old days pruned', SLOW, async ($, on) => {
  const old = dayKey(30)
  const { kv } = boot(on, {
    'week-heatmap:tools': { Bash: 7, Read: 2 },
    'monday-report:lastShown': WEEK,
    'monday-report:extra': {
      loops: { [old]: 3, [dayKey(2)]: 1 },
      longest: { [old]: 5000, [dayKey(0)]: 200_000 },
      tools: { [old]: { Bash: 1 } },
      loopsAt: 0,
    },
  })
  await start($)
  await finish($, 90_000)
  const extra = kv.get('monday-report:extra') as any
  expect(extra.longest).toEqual({ [dayKey(0)]: 200_000 })
  expect(extra.loops).toEqual({ [dayKey(2)]: 1, [dayKey(0)]: 0 })
  expect(extra.tools).toEqual({ [dayKey(0)]: { Bash: 7, Read: 2 } })

  await finish($, 300_000)
  expect((kv.get('monday-report:extra') as any).longest[dayKey(0)]).toBe(300_000)
  // a subagent turn is not recorded
  await finish($, 900_000, { agentId: 'ag1' })
  expect((kv.get('monday-report:extra') as any).longest[dayKey(0)]).toBe(300_000)
})

test('the first finished turn creates the extra record from nothing', SLOW, async ($, on) => {
  const { kv } = boot(on, { 'monday-report:lastShown': WEEK })
  await start($)
  await finish($, 42_000)
  const extra = kv.get('monday-report:extra') as any
  expect(extra.longest).toEqual({ [dayKey(0)]: 42_000 })
  expect(extra.loops).toEqual({ [dayKey(0)]: 0 })
})

test('off switch: nothing opens, nothing is recorded, the command and the pane say so', SLOW, async ($, on) => {
  const { reportOpens, kv } = boot(on, { ...week(), enabled: { 'monday-report': false } })
  await start($)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await finish($, 99_000)
  expect(reportOpens()).toHaveLength(0)
  expect(kv.get('monday-report:lastShown')).toBeUndefined()
  expect(((kv.get('monday-report:extra') as any).longest as Record<string, number>)[dayKey(0)]).toBeUndefined()
  expect((await $.command.run({ command: 'report', args: '' })).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(['The weekly report is off.'])
  await ui.unmount()
})

test('Hebrew: command, pane headings, weekday names, Copy and the copied letter are in Hebrew', SLOW, async ($, on) => {
  const { seen } = boot(on, { ...week(), 'monday-report:lastShown': WEEK, language: 'he' })
  await start($)
  expect((await $.command.run({ command: 'report', args: '' })).text).toBe('הדוח השבועי נפתח.')
  const ui = await openPane($)
  const out = await texts(ui)
  for (const v of ['שעות', 'תורים', 'טוקנים', 'עלות', 'מה Toolkitty עשה בשבילך', 'תורים ליום', 'ג׳', 'ה׳', 'ב׳']) expect(out).toContain(v)
  expect(out).toContain('הכלים המובילים: ')
  const copy = await ui.find({ key: 'report-copy' })
  expect(copy?.props['label']).toBe('העתק')
  await ui.press({ key: 'report-copy' })
  await new Promise(r => setTimeout(r, 20))
  const letter = seen.copies[0]!.text
  expect(letter).toMatch(/[א-ת]/)
  expect(letter).toContain(`${dayKey(6)}`)
  expect(letter).toContain('Bash (40), Edit (20), Grep (5)')
  expect(letter.endsWith('claude plugin install toolkitty --marketplace avraham-tech/toolkitty')).toBe(true)
  expect(await noticeTexts($)).toContain('הדוח הועתק')
  await ui.unmount()
})

test('the pane header: the title, the week as status and Copy as its action, on both surfaces', SLOW, async ($, on) => {
  boot(on, week())
  await start($)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await openPane($, surface)
    expect((await texts(ui)).slice(0, 3)).toEqual(['◔', 'Your week with Toolkitty', `${dayKey(6)} - ${dayKey(0)}`])
    expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['report-copy'])
    await ui.unmount()
  }
})
