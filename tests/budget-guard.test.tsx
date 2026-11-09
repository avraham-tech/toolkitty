import { expect, test } from 'claude-code/testing'

import { allText, BAND, bandLine, begin, boot, compose, DAY, finishTurn, HOUR, iso, measure, noticesOf, openBand, openDetail, paneOf, SLOW, start, submitPrompt, T0 } from './world'

const ID = 'budget-guard'

const stampOf = (ms: number): string => {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
const MIN = 60_000
const wk = (percentUsed: number, resetsInMs = 2 * DAY) => ({ kind: 'seven_day', percentUsed, resetsAt: iso(T0 + resetsInMs) })
const fh = (percentUsed: number, resetsInMs = HOUR) => ({ kind: 'five_hour', percentUsed, resetsAt: iso(T0 + resetsInMs) })
const cmd = ($: any, args: string) => $.command.run({ command: 'budget', args })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const NO_WINDOWS = 'No usage windows are reported (API-key use has none), so there is nothing to guard.'
const BADN = 'Give a whole number from 1 to 100, for example /budget weekly 85.'
const DENY_PART = 'Budget guard has paused tool use'
const FIVE_THRESHOLD = 95

// Other features that react to a full usage window or a busy context are switched off so the toasts are only ours.
const QUIET = { 'context-aquarium': false, 'long-turn-toast': false, 'cost-meter': false, 'auto-continue': false }
const BS = String.fromCharCode(92)
const store = (extra: Record<string, unknown> = {}, enabled: Record<string, boolean> = {}) => ({ enabled: { ...QUIET, ...enabled }, ...extra })

async function pane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  return $.ui.mount({ ...paneOf('budget-guard'), surface })
}

test('loads, registers /budget, draws nothing while under the thresholds', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(40), fh(50)]
  await begin($, w)
  expect(w.commands).toContain('budget')
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('/budget with no windows reports that there is nothing to guard and opens the pane', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const out = await cmd($, '')
  expect(out.text).toBe(
    ['Budget guard', 'Weekly: — (threshold 85% · ceiling 97%)', '5-hour: — (threshold 95%)', 'Approval: locked', NO_WINDOWS].join('\n'),
  )
  expect(w.opened.map(o => o.id)).toContain('budget-guard')
})

test('/budget with windows lists both with thresholds and reset times', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(40.4), fh(50)]
  await begin($, w)
  const out = await cmd($, '')
  expect(out.text).toBe(
    [
      'Budget guard',
      'Weekly: 40% (threshold 85% · ceiling 97%) · resets in 2d 0h',
      '5-hour: 50% (threshold 95%) · resets in 1h 0m',
      'Approval: locked',
    ].join('\n'),
  )
  // an unknown subcommand is the summary too
  expect((await cmd($, 'whatever')).text).toBe(out.text)
})

test('a window alone: the missing one shows a dash', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [fh(10)]
  await begin($, w)
  const out = await cmd($, '')
  expect(out.text).toContain('Weekly: — (threshold 85% · ceiling 97%)')
  expect(out.text).toContain('5-hour: 10% (threshold 95%) · resets in 1h 0m')
})

test('/budget weekly | 5h | ceiling: every alias, validation and cross-checks', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect((await cmd($, 'weekly 90')).text).toBe('Weekly threshold set to 90%.')
  expect((await cmd($, 'week 80%')).text).toBe('Weekly threshold set to 80%.')
  expect((await cmd($, '7d 70')).text).toBe('Weekly threshold set to 70%.')
  expect((await cmd($, 'WEEKLY 60')).text).toBe('Weekly threshold set to 60%.')
  expect((await cmd($, '5h 50')).text).toBe('5-hour threshold set to 50%.')
  expect((await cmd($, 'five 60')).text).toBe('5-hour threshold set to 60%.')
  expect((await cmd($, '5hour 70')).text).toBe('5-hour threshold set to 70%.')
  expect((await cmd($, 'fivehour 100')).text).toBe('5-hour threshold set to 100%.')
  expect((await cmd($, 'ceiling 99')).text).toBe('Weekly ceiling set to 99%.')
  expect((await cmd($, 'ceil 98')).text).toBe('Weekly ceiling set to 98%.')
  expect((await cmd($, 'max 97')).text).toBe('Weekly ceiling set to 97%.')
  // bad numbers
  for (const bad of ['weekly', 'weekly 0', 'weekly 101', 'weekly abc', 'weekly 1.5', '5h -3', 'ceiling', 'ceiling 0', '5h x%']) {
    expect((await cmd($, bad)).text).toBe(BADN)
  }
  // the weekly threshold cannot pass the ceiling, nor the ceiling fall under the threshold
  expect((await cmd($, 'weekly 98')).text).toBe('The weekly threshold cannot be above the ceiling (97%).')
  expect((await cmd($, 'weekly 97')).text).toBe('Weekly threshold set to 97%.')
  expect((await cmd($, 'ceiling 96')).text).toBe('The ceiling cannot be lower than the weekly threshold (97%).')
  // the summary shows the new numbers
  const s = (await cmd($, '')).text
  expect(s).toContain('(threshold 97% · ceiling 97%)')
  expect(s).toContain('(threshold 100%)')
  expect(w.toasts).toEqual([])
})

test('thresholds are kept in the store and read back next session; corrupt values fall back', SLOW, async ($, on) => {
  const w = boot(on, store({ 'budget-guard:settings': { weekly: 50, fiveHour: 'x', hardCeiling: 500 } }))
  await begin($, w)
  const s = (await cmd($, '')).text
  expect(s).toContain('(threshold 50% · ceiling 97%)')
  expect(s).toContain('(threshold 95%)')
})

test('a threshold crossed on a measure is announced once; a reset re-arms the announcement', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  await measure($, w, [wk(60), fh(50)])
  expect(await noticesOf($, ID)).toEqual([])
  await measure($, w, [wk(86), fh(50)])
  expect(await noticesOf($, ID)).toEqual(['Budget guard: weekly usage reached 86% (threshold 85%). Prompts will now ask first.'])
  await measure($, w, [wk(90), fh(96)])
  expect((await noticesOf($, ID))[1]).toBe('Budget guard: 5-hour usage reached 96% (threshold 95%). Prompts will now ask first.')
  expect((await noticesOf($, ID)).length).toBe(2)
  // nothing again while they stay over
  await measure($, w, [wk(91), fh(97)])
  expect((await noticesOf($, ID)).length).toBe(2)
  // the 5-hour window resets (a big drop), then climbs again
  await measure($, w, [wk(91), fh(5)])
  await measure($, w, [wk(91), fh(96)])
  // the re-armed announcement is the same text from the same feature within five minutes: it folds into the earlier row as a count
  expect((await noticesOf($, ID)).length).toBe(2)
  expect((await noticesOf($, ID))[1]).toBe('Budget guard: 5-hour usage reached 96% (threshold 95%). Prompts will now ask first. ×2')
})

test('a window already over at session start is announced at start', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(92), fh(10)]
  await start($)
  expect(await noticesOf($, ID)).toContain('Budget guard: weekly usage reached 92% (threshold 85%). Prompts will now ask first.')
})

test('a finished turn refreshes the windows and announces too', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.usage.rateLimits = [wk(10), fh(96)]
  await finishTurn($, 't1')
  expect(await noticesOf($, ID)).toEqual(['Budget guard: 5-hour usage reached 96% (threshold 95%). Prompts will now ask first.'])
})

test('a reset time that passed with a new reset time clears the asked memory even without a big drop', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  await measure($, w, [wk(86, 10 * MIN)])
  expect((await noticesOf($, ID)).length).toBe(1)
  await w.clock.advance(11 * MIN)
  // the window rolled over to a new period at a similar level
  await measure($, w, [wk(86, 7 * DAY)])
  // announced again (the asked memory was cleared); the notice time follows the mock clock, so the 11 minutes
  // are past the five-minute fold and the second announcement is its own row, not a count
  const rows = await noticesOf($, ID)
  expect(rows.length).toBe(2)
  expect(rows[0]).toBe(rows[1])
  expect(rows[1]).not.toMatch(/×\d+$/)
})

test('the band shows the windows over their thresholds with the approval state', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  await measure($, w, [wk(60), fh(50)])
  expect(await bandLine($, ID)).toBeUndefined()
  await measure($, w, [wk(86.4), fh(50)])
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 86% · locked')
  expect(await bandLine($, ID, 'terminal')).toBe('🧯 budget: weekly 86% · locked')
  await measure($, w, [wk(86), fh(96)])
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 86% · 5h 96% · locked')
})

test('the band is amber below the ceiling and red at it', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const colour = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    await openBand(ui)
    const t = (await ui.findAll({ type: 'Text' })).find((x: any) => /budget:/.test(x.text))
    await ui.unmount()
    return t?.props['color']
  }
  await measure($, w, [wk(90)])
  expect(await colour()).toBe('warning')
  await measure($, w, [wk(97)])
  expect(await colour()).toBe('error')
})

test('a survey hides the band', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  await measure($, w, [wk(90)])
  expect(await bandLine($, ID, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('prompts under the thresholds pass untouched; no windows (API key) means nothing to guard', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(50), fh(50)]
  await begin($, w)
  const r = await submitPrompt($, 'hello')
  expect(r.drop).toBeUndefined()
  expect(w.asks).toEqual([])
  w.usage.rateLimits = []
  await submitPrompt($, 'again')
  expect(w.asks).toEqual([])
  expect(w.promptCalls.length).toBe(2)
})

test('over the threshold the person is asked, with the exact question, header and options', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90), fh(10)]
  w.usage.context = { window: 200_000, tokens: 120_400, percent: 60 }
  await begin($, w)
  w.ask.answer = 'Once'
  await submitPrompt($, 'go on')
  expect(w.asks).toEqual([
    {
      question: "Weekly usage is at 90% (resets in 2d 0h). Send this prompt anyway? This session's context is about 120k tokens, so each prompt re-reads all of it.",
      header: 'Budget',
      options: ['Once', 'Until reset', 'Cancel'],
    },
  ])
})

test('the context note is left out when the size is unknown, shows plain tokens under 1000', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [fh(96, 90 * MIN)]
  w.usage.context = { window: 200_000 }
  await begin($, w)
  w.ask.answer = 'Once'
  await submitPrompt($, 'a')
  expect(w.asks[0]?.question).toBe('5-hour usage is at 96% (resets in 1h 30m). Send this prompt anyway?')
  await finishTurn($, 't1')
  w.usage.context = { window: 200_000, tokens: 800 }
  await submitPrompt($, 'b')
  expect(w.asks[1]?.question).toBe(
    "5-hour usage is at 96% (resets in 1h 30m). Send this prompt anyway? This session's context is about 800 tokens, so each prompt re-reads all of it.",
  )
})

test('without a reset time the question says an unknown time', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [{ kind: 'seven_day', percentUsed: 90 }]
  await begin($, w)
  w.ask.answer = 'Once'
  await submitPrompt($, 'go')
  expect(w.asks[0]?.question).toContain('(resets in an unknown time)')
})

test('"Once" lets this prompt through, covers its tool calls, and ends with the turn', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(98)]
  await begin($, w)
  // at the ceiling the model's tools are paused
  const blocked = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(blocked.deny).toContain(DENY_PART)
  w.ask.answer = 'Once'
  const r = await submitPrompt($, 'please continue')
  expect(r.drop).toBeUndefined()
  expect(w.promptCalls.map(p => p.text)).toEqual(['please continue'])
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 98% · approved once')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
  await finishTurn($, 't1')
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 98% · locked')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toContain(DENY_PART)
})

test('"Until reset" approves the windows that are over; the next prompts are not asked', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90), fh(50)]
  await begin($, w)
  w.ask.answer = 'Until reset'
  const r = await submitPrompt($, 'one')
  expect(r.drop).toBeUndefined()
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 90% · approved until reset')
  await submitPrompt($, 'two')
  await submitPrompt($, 'three')
  expect(w.asks.length).toBe(1)
  expect(w.promptCalls.length).toBe(3)
})

test('the approval ends at the reset: the next prompt asks again', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90, 2 * MIN)]
  await begin($, w)
  w.ask.answer = 'Until reset'
  await submitPrompt($, 'one')
  await w.clock.advance(MIN)
  await submitPrompt($, 'two')
  expect(w.asks.length).toBe(1)
  await w.clock.advance(2 * MIN)
  // the usage still reads over the threshold with the same (stale) reset time: asked again
  await submitPrompt($, 'three')
  expect(w.asks.length).toBe(2)
})

test('a window that really reset (new reset time, low usage) lets prompts pass again', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90, 2 * MIN)]
  await begin($, w)
  w.ask.answer = 'Until reset'
  await submitPrompt($, 'one')
  await w.clock.advance(3 * MIN)
  w.usage.rateLimits = [wk(2, 7 * DAY)]
  const r = await submitPrompt($, 'two')
  expect(r.drop).toBeUndefined()
  expect(w.asks.length).toBe(1)
  expect(await bandLine($, ID)).toBeUndefined()
})

test('"Cancel" drops the prompt with the reason and logs it', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(91), fh(10)]
  await begin($, w)
  w.ask.answer = 'Cancel'
  const r = await submitPrompt($, 'expensive')
  expect(r.drop).toBe('Budget guard: prompt not sent, weekly usage is at 91%. Run /budget allow to approve until reset.')
  expect(w.promptCalls).toEqual([])
  // and asked again next time
  await submitPrompt($, 'again')
  expect(w.asks.length).toBe(2)
})

test('a dismissed or unanswerable dialog drops the prompt with a toast', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [fh(97)]
  await begin($, w)
  w.ask.fail = true
  const r = await submitPrompt($, 'x')
  expect(r.drop).toBe('Budget guard: prompt not sent, 5-hour usage is at 97%. Run /budget allow to approve until reset.')
  expect(w.toasts).toContain('Budget guard: usage is at 97% and there is no screen to ask on. Prompt not sent; run /budget allow to approve.')
})

test('the fuller window is the one asked about when both are over', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(88), fh(99)]
  await begin($, w)
  w.ask.answer = 'Until reset'
  await submitPrompt($, 'x')
  expect(w.asks[0]?.question).toMatch(/^5-hour usage is at 99%/)
  // "Until reset" approved both windows that were over
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 88% · 5h 99% · approved until reset')
})

test('prompts that nobody typed are dropped without a dialog; commands and the plugin\'s own pass', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90)]
  await begin($, w)
  const sched = await submitPrompt($, 'cron tick', { origin: { kind: 'scheduled-trigger' } })
  expect(sched.drop).toBe('Budget guard: prompt not sent, weekly usage is at 90%. Run /budget allow to approve until reset.')
  const note = await submitPrompt($, 'bg done', { origin: { kind: 'task-notification' } })
  expect(note.drop).toBeDefined()
  expect(w.asks).toEqual([])
  const viaBridge = await submitPrompt($, 'from the phone', { origin: { kind: 'bridge' } })
  void viaBridge
  expect(w.asks.length).toBe(1)
  // a command, and a prompt another plugin sent, are not gated
  w.ask.answer = 'Cancel'
  const c = await submitPrompt($, '/help', { command: { name: 'help', args: '' } })
  expect(c.drop).toBeUndefined()
  const p = await submitPrompt($, 'from a plugin', { origin: { kind: 'plugin', name: 'other' } })
  expect(p.drop).toBeUndefined()
  expect(w.asks.length).toBe(1)
})

test('/budget allow approves until the reset, /budget lock takes it back', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(98), fh(50)]
  await begin($, w)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toContain(DENY_PART)
  expect((await cmd($, 'allow')).text).toBe('Approved until the usage windows reset. Nothing will be asked or blocked until then.')
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 98% · approved until reset')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
  await submitPrompt($, 'free')
  expect(w.asks).toEqual([])
  expect((await cmd($, 'lock')).text).toBe('Approval revoked. Budget guard will ask again above the thresholds.')
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 98% · locked')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toContain(DENY_PART)
})

test('/budget allow with no windows says there is nothing to guard', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect((await cmd($, 'allow')).text).toBe(NO_WINDOWS)
})

test('/budget allow with an unknown reset time lasts a day-scale fallback span', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [{ kind: 'five_hour', percentUsed: 97 }]
  await begin($, w)
  await cmd($, 'allow')
  expect(await bandLine($, ID)).toBe('🧯 budget: 5h 97% · approved until reset')
  // five hours from now is the fallback span; ten minutes later it still holds
  await w.clock.advance(10 * MIN)
  expect(await bandLine($, ID)).toBe('🧯 budget: 5h 97% · approved until reset')
})

test('the stored approval is honoured in the next session; an expired one is dropped', SLOW, async ($, on) => {
  const w = boot(on, store({ 'budget-guard:approval': { weekly: T0 + HOUR, fiveHour: T0 - HOUR } }))
  w.usage.rateLimits = [wk(90, 2 * HOUR), fh(97)]
  await begin($, w)
  // weekly approved, five-hour (expired) not: the band is locked because the 5-hour window is over and unapproved
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 90% · 5h 97% · locked')
  w.ask.answer = 'Cancel'
  await submitPrompt($, 'x')
  expect(w.asks[0]?.question).toMatch(/^5-hour usage is at 97%/)
})

test('tool calls: only the main loop is paused, and only at the weekly ceiling', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(96.9), fh(99)]
  await begin($, w)
  // under the ceiling (97): tools run even though prompts would ask
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
  await measure($, w, [wk(97)])
  const denied = await $.tool.call({ tool: 'Read', file_path: 'C:/x.txt' })
  expect(denied.deny).toMatch(/^The user's weekly usage budget is nearly exhausted and Budget guard has paused tool use\. Stop now/)
  expect(denied.deny).toContain('/budget allow')
  // a subagent's tool calls are not paused
  expect((await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' })).deny).toBeUndefined()
})

test('the ceiling can be raised: /budget ceiling lets tools run again below it', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(98)]
  await begin($, w)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()
  await cmd($, 'ceiling 100')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
})

test('the system prompt gets a nudge naming the windows over, and nothing otherwise', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect(await compose($)).toEqual([])
  await measure($, w, [wk(90), fh(50)])
  let sections = await compose($)
  expect(sections.length).toBe(1)
  expect(sections[0]?.id).toBe('toolkitty:budget-guard')
  expect(sections[0]?.scope).toBe('session')
  expect(sections[0]?.text).toMatch(/^The user's usage budget is nearly exhausted \(weekly\)\. Be terse\./)
  await measure($, w, [wk(90), fh(96)])
  sections = await compose($)
  expect(sections.length).toBe(1)
  expect(sections[0]?.text).toContain('(weekly and 5-hour)')
  await measure($, w, [wk(10), fh(10)])
  expect(await compose($)).toEqual([])
})

test('desktop pane: gauges as an Svg with its alt text, and the three Buttons', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90), fh(50)]
  await begin($, w)
  const ui = await pane($)
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props['alt']).toBe('Usage gauges: weekly 90%, 5-hour 50%. Approval: locked.')
  expect(String(svg?.props['source'])).toContain('<svg')
  expect(String(svg?.props['source'])).toContain('Weekly')
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key).sort()
  expect(keys).toEqual(['budget-allow', 'budget-ceiling', 'budget-lock', 'exp-copy-budget', 'exp-open-budget', 'exp-path-budget', 'exp-print-budget', 'exp-save-budget'])
  const labels = Object.fromEntries((await ui.findAll({ type: 'Button' })).map((b: any) => [b.key, b.props['label']]))
  expect(labels).toEqual({ 'budget-allow': 'allow until reset', 'budget-lock': 'lock', 'budget-ceiling': '+5% ceiling', 'exp-save-budget': 'Save SVG', 'exp-copy-budget': 'Copy text', 'exp-print-budget': 'Print', 'exp-open-budget': 'Open folder', 'exp-path-budget': 'Copy path' })

  // allow
  await ui.press({ key: 'budget-allow' })
  expect((await ui.find({ type: 'Svg' }))?.props['alt']).toBe('Usage gauges: weekly 90%, 5-hour 50%. Approval: approved until reset.')
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 90% · approved until reset')
  // lock
  await ui.press({ key: 'budget-lock' })
  expect((await ui.find({ type: 'Svg' }))?.props['alt']).toContain('Approval: locked.')
  // +5% ceiling: 97 -> 100, then stays at 100
  await ui.press({ key: 'budget-ceiling' })
  expect((await cmd($, '')).text).toContain('ceiling 100%')
  await ui.press({ key: 'budget-ceiling' })
  expect((await cmd($, '')).text).toContain('ceiling 100%')
  await ui.unmount()
})

test('terminal pane: bars, percentages and the same Buttons', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90), fh(50)]
  await begin($, w, 'terminal')
  const ui = await pane($, 'terminal')
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  const text = await allText(ui)
  expect(text).toContain('Weekly')
  expect(text).toContain('5-hour')
  expect(text).toContain('██████████████████░░ 90%')
  expect(text).toContain('██████████░░░░░░░░░░ 50%')
  expect(text).toContain('threshold 85% · ceiling 97% · resets in 2d 0h')
  expect(text).toContain('threshold 95% · resets in 1h 0m')
  expect(text).toContain('Approval: locked')
  await ui.press({ key: 'budget-allow' })
  expect(await allText(ui)).toContain('Approval: approved until reset')
  await ui.press({ key: 'budget-lock' })
  expect(await allText(ui)).toContain('Approval: locked')
  await ui.press({ key: 'budget-ceiling' })
  expect(await allText(ui)).toContain('ceiling 100%')
  await ui.unmount()
})

test('the pane colours follow the thresholds on the terminal', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(40), fh(90)]
  await begin($, w, 'terminal')
  const ui = await pane($, 'terminal')
  const bars = (await ui.findAll({ type: 'Text' })).filter((x: any) => /[█░]/.test(x.text))
  expect(bars.map((b: any) => b.props['color'])).toEqual(['success', 'warning'])
  await ui.unmount()
  await measure($, w, [wk(86), fh(FIVE_THRESHOLD)])
  const again = await pane($, 'terminal')
  const bars2 = (await again.findAll({ type: 'Text' })).filter((x: any) => /[█░]/.test(x.text))
  expect(bars2.map((b: any) => b.props['color'])).toEqual(['error', 'error'])
  await again.unmount()
})

test('the pane with no windows says so, with no Buttons; off, it says it is off', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const ui = await pane($)
  expect(await allText(ui)).toBe(`◐\nBudget guard\n${NO_WINDOWS}\nWindows show up once you use a subscription plan; run /budget to look again.`)
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  await ui.unmount()
})

test('detail pane: limits, approval, and the prompts held back with the choice made', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90, 2 * DAY), fh(50)]
  await begin($, w)
  w.ask.answer = 'Cancel'
  await submitPrompt($, 'a')
  await w.clock.advance(65_000)
  w.ask.answer = 'Once'
  await submitPrompt($, 'b')
  await finishTurn($, 't1')
  await w.clock.advance(5_000)
  await submitPrompt($, 'd', { origin: { kind: 'scheduled-trigger' } })
  await w.clock.advance(1_000)
  w.ask.answer = 'Until reset'
  await submitPrompt($, 'c')
  await w.clock.advance(1_000)
  const ui = await openDetail($, ID)
  const lines = (await allText(ui)).split(/\n/)
  expect(lines).toContain('Weekly: 90% (threshold 85% · ceiling 97%) · resets in 1d 23h')
  expect(lines).toContain('5-hour: 50% (threshold 95%) · resets in 58m')
  expect(lines).toContain('Approval: approved until reset')
  expect(lines.some(l => /^Weekly approved until /.test(l))).toBe(true)
  expect(lines).toContain('Prompts held back at the threshold (newest first)')
  const held = lines.filter(l => /ago · weekly 90% · /.test(l))
  expect(held).toEqual([
    '0:01 ago · weekly 90% · Until reset',
    '0:02 ago · weekly 90% · dropped (nobody to ask)',
    '0:07 ago · weekly 90% · Once',
    '1:12 ago · weekly 90% · Cancel',
  ])
  await ui.unmount()
})

test('the detail pane with nothing held back and no approval', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  await measure($, w, [wk(90)])
  const ui = await openDetail($, ID)
  const text = await allText(ui)
  expect(text).toContain('No approval is active.')
  expect(text).toContain('No prompt was held back this session.')
  await ui.unmount()
})

test('detail pane buttons: the switch turns the feature off and on', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90)]
  await begin($, w)
  await measure($, w, [wk(90)])
  const ui = await openDetail($, ID)
  await ui.press({ key: 'detail-toggle' })
  expect(await bandLine($, ID)).toBeUndefined()
  w.ask.answer = 'Cancel'
  expect((await submitPrompt($, 'free')).drop).toBeUndefined()
  await ui.press({ key: 'detail-toggle' })
  expect(await bandLine($, ID)).toBe('🧯 budget: weekly 90% · locked')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('hebrew: summary, question, options, drop reason, band, pane', SLOW, async ($, on) => {
  const w = boot(on, store({ language: 'he' }))
  w.usage.rateLimits = [wk(90), fh(50)]
  w.usage.context = { window: 200_000, tokens: 50_000, percent: 25 }
  await begin($, w)
  expect((await cmd($, 'weekly 80')).text).toBe('סף השבוע נקבע ל-80%.')
  expect((await cmd($, 'weekly x')).text).toBe('ציין מספר שלם בין 1 ל-100, למשל /budget weekly 85.')
  w.ask.answer = 'ביטול'
  const r = await submitPrompt($, 'x')
  expect(w.asks[0]?.question).toBe(
    'הצריכה השבועית היא 90% (איפוס בעוד 2י׳ 0ש׳). לשלוח את הבקשה בכל זאת? ההקשר של השיחה הוא כ-50k טוקנים, ולכן כל בקשה קוראת אותו מחדש.',
  )
  expect(w.asks[0]?.header).toBe('תקציב')
  expect(w.asks[0]?.options).toEqual(['פעם אחת', 'עד האיפוס', 'ביטול'])
  expect(r.drop).toBe('שומר התקציב: הבקשה לא נשלחה, הצריכה השבועית היא 90%. הרץ /budget allow לאישור עד האיפוס.')
  expect(await bandLine($, ID)).toContain('שבועי 90%')
  expect(await bandLine($, ID)).toContain('נעול')
  const ui = await pane($)
  expect(String((await ui.find({ type: 'Svg' }))?.props['alt'])).toContain('90%')
  const labels = Object.fromEntries((await ui.findAll({ type: 'Button' })).map((b: any) => [b.key, b.props['label']]))
  expect(labels['budget-allow']).toBe('אשר עד האיפוס')
  expect(labels['budget-lock']).toBe('נעל')
  expect(labels['budget-ceiling']).toBe('+5% תקרה')
  await ui.unmount()
})

test('off switch: nothing asked, nothing denied, no band, no nudge, the command says it is off', SLOW, async ($, on) => {
  const w = boot(on, store({}, { [ID]: false }))
  w.usage.rateLimits = [wk(99), fh(99)]
  await begin($, w)
  for (const a of ['', 'allow', 'lock', 'weekly 50', '5h 50', 'ceiling 99']) expect((await cmd($, a)).text).toBe(OFF)
  const r = await submitPrompt($, 'hello')
  expect(r.drop).toBeUndefined()
  expect(w.asks).toEqual([])
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
  expect(await bandLine($, ID)).toBeUndefined()
  expect(await compose($)).toEqual([])
  await measure($, w, [wk(99)])
  expect(w.toasts).toEqual([])
  const ui = await pane($)
  expect(await allText(ui)).toBe(`◐\nBudget guard\n${OFF}`)
  await ui.unmount()
})

test('thresholds and approvals are written to the store; lock clears the approval', SLOW, async ($, on) => {
  const w = boot(on, store())
  w.usage.rateLimits = [wk(90, 2 * DAY), fh(50)]
  await begin($, w)
  await cmd($, 'weekly 80')
  await cmd($, '5h 70')
  await cmd($, 'ceiling 99')
  expect(w.stored['budget-guard:settings']).toEqual({ weekly: 80, fiveHour: 70, hardCeiling: 99 })
  // a refused value is not written
  await cmd($, 'weekly 100')
  expect(w.stored['budget-guard:settings']).toEqual({ weekly: 80, fiveHour: 70, hardCeiling: 99 })
  await cmd($, 'allow')
  expect(w.stored['budget-guard:approval']).toEqual({ weekly: T0 + 2 * DAY, fiveHour: T0 + HOUR })
  await cmd($, 'lock')
  expect(w.stored['budget-guard:approval']).toEqual({ weekly: 0, fiveHour: 0 })
  // "Until reset" writes the approval of the windows that were over (only the weekly one here, 5h at 50% < 70)
  w.ask.answer = 'Until reset'
  await submitPrompt($, 'go')
  expect(w.stored['budget-guard:approval']).toEqual({ weekly: T0 + 2 * DAY, fiveHour: 0 })
})

test('a measure that finds an approval expired writes the cleared approval', SLOW, async ($, on) => {
  const w = boot(on, store({ 'budget-guard:approval': { weekly: T0 + 5 * MIN, fiveHour: 0 } }))
  w.usage.rateLimits = [wk(50, 2 * DAY)]
  await begin($, w)
  await w.clock.advance(6 * MIN)
  await measure($, w, [wk(50, 2 * DAY)])
  expect(w.stored['budget-guard:approval']).toEqual({ weekly: 0, fiveHour: 0 })
})

test('the export bar: Save SVG writes the gauge under toolkitty-exports (never overwriting), Copy puts the summary on the clipboard', SLOW, async ($, on) => {
  const w = boot(on, store({ 'exports:dir': 'C:/tmp/project/toolkitty-exports' }))
  w.usage.rateLimits = [wk(90), fh(50)]
  on('fs.exists', (_: any, e: any) => ({ value: String(e.path).split(String.fromCharCode(92)).join('/') in w.files }))
  await begin($, w)
  const ui = await pane($)
  const base = `C:/tmp/project/toolkitty-exports/budget-${stampOf(T0)}`
  await ui.press({ key: 'exp-save-budget' })
  await ui.press({ key: 'exp-save-budget' })
  const written = Object.keys(w.files).filter(x => x.includes('/toolkitty-exports/'))
  expect(written.sort()).toEqual([`${base}-2.svg`, `${base}.svg`])
  expect(w.files[`${base}.svg`]!.startsWith('<svg')).toBe(true)
  expect(w.files[`${base}.svg`]).toBe(String((await ui.find({ type: 'Svg' }))?.props['source']))
  await ui.press({ key: 'exp-copy-budget' })
  expect(String(w.copied[0]!.text)).toContain('Weekly: 90%')
  expect(w.copied[0]!.surface).toBe('desktop')
  expect(await noticesOf($, ID)).toEqual(expect.arrayContaining([`Saved C:${BS}tmp${BS}project${BS}toolkitty-exports${BS}budget-${stampOf(T0)}.svg`, `Saved C:${BS}tmp${BS}project${BS}toolkitty-exports${BS}budget-${stampOf(T0)}-2.svg`]))
  await ui.unmount()
})

test('the export bar on the terminal: Save writes the summary as .txt, Copy the same text', SLOW, async ($, on) => {
  const w = boot(on, store({ 'exports:dir': 'C:/tmp/project/toolkitty-exports' }))
  w.usage.rateLimits = [wk(90), fh(50)]
  await begin($, w, 'terminal')
  const ui = await pane($, 'terminal')
  const labels = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('exp-')).map((b: any) => b.props['label'])
  expect(labels).toEqual(['Save text', 'Copy text', 'Print', 'Open folder', 'Copy path'])
  await ui.press({ key: 'exp-save-budget' })
  const file = `C:/tmp/project/toolkitty-exports/budget-${stampOf(T0)}.txt`
  expect(w.files[file]).toContain('Weekly: 90%')
  await ui.press({ key: 'exp-copy-budget' })
  expect(w.copied[0]!.text).toBe(w.files[file])
  expect(w.copied[0]!.surface).toBe('terminal')
  await ui.unmount()
})
