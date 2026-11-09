import { expect, test } from 'claude-code/testing'

import { BAND, SLOW, begin, boot, paneOf, submitPrompt, textsOf, allText } from './world'

const ID = 'prompt-enhancer'
const MIN = 60_000
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const QUIET = { 'context-aquarium': false, 'long-turn-toast': false, 'cost-meter': false, 'auto-continue': false }
const ON = { enabled: { ...QUIET, [ID]: true }, 'onboarding:done': true }

const LOW = 'fix the login bug please'
const LOW_PROPOSED =
  'Investigate the login bug, reproduce it, identify the root cause, implement the smallest safe fix, run the relevant tests, avoid unrelated changes.'
const OPTIONS = ['Send as is', 'Use suggestion', 'Edit', 'Stop asking']

const cmd = ($: any, args: string) => $.command.run({ command: 'enhance', args })

type Fill = { text: string; mode?: string }

/** Boots the world with the feature on, the bottom answers for prompt.fill, and the session started. */
async function setup($: any, on: any, store: Record<string, unknown> = {}, answer: string | undefined = 'Send as is') {
  const w = boot(on, { ...ON, ...store })
  const fills: Fill[] = []
  const fillState = { ok: true }
  on('prompt.fill', (_: any, e: any) => {
    fills.push({ text: e.text, mode: e.mode })
    return { isFilled: fillState.ok }
  })
  w.ask.answer = answer
  await begin($, w)
  return { w, fills, fillState }
}

const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...paneOf('prompt-enhancer'), surface })

// -----------------------------------------------------------------------------------------------
// The heuristic: twelve-plus prompts, English and Hebrew, good and bad.
// -----------------------------------------------------------------------------------------------

const SCORES: { text: string; score: number; missing: string[] }[] = [
  { text: 'Fix the null pointer crash in src/auth/login.ts so that the tests pass', score: 100, missing: [] },
  { text: 'Add a retry to the fetchUser function in api/users.ts when the request times out, it should back off exponentially', score: 100, missing: [] },
  { text: 'Please update the README.md with the new install steps', score: 80, missing: ['Say how you will know it worked'] },
  { text: 'refactor the payment module', score: 70, missing: ['Say how you will know it worked', 'Add a bit more detail'] },
  { text: 'investigate why the build is failing in CI and fix it so the pipeline passes', score: 60, missing: ['Name the place', 'Say how you will know it worked'] },
  { text: 'make the thing work better please', score: 50, missing: ['Name the place', 'Say how you will know it worked', 'Add a bit more detail'] },
  { text: 'write tests for the parser', score: 50, missing: ['Name the place', 'Say how you will know it worked', 'Add a bit more detail'] },
  { text: "it doesn't work, fix it", score: 35, missing: ['Name the place', 'Say how you will know it worked', 'Replace vague words', 'Add a bit more detail'] },
  { text: 'something is broken with the app', score: 10, missing: ['Start with what you want done', 'Name the place', 'Say how you will know it worked', 'Replace vague words', 'Add a bit more detail'] },
  { text: 'תקן את הבאג בפונקציה loginUser בקובץ src/auth.ts כך שהבדיקות יעברו', score: 100, missing: [] },
  { text: 'הוסף כפתור התנתקות לרכיב Navbar כך שהמשתמש יתנתק ויועבר לדף הבית', score: 100, missing: [] },
  { text: 'תסביר לי איך עובד המנגנון', score: 50, missing: ['Name the place', 'Say how you will know it worked', 'Add a bit more detail'] },
  { text: 'משהו לא עובד באתר', score: 10, missing: ['Start with what you want done', 'Name the place', 'Say how you will know it worked', 'Replace vague words', 'Add a bit more detail'] },
]

test('off by default: nothing asked, nothing rewritten, the command and the pane say it is off', SLOW, async ($, on) => {
  const w = boot(on, { 'onboarding:done': true, enabled: QUIET })
  w.ask.answer = 'Use suggestion'
  await begin($, w)
  expect(w.commands).toContain('enhance')

  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW)
  expect(w.asks).toEqual([])
  expect((await cmd($, '')).text).toBe(OFF)
  expect((await cmd($, 'ai on')).text).toBe(OFF)

  const ui = await pane($)
  expect(await allText(ui)).toContain(OFF)
  await ui.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await band.unmount()
})

test('switching it off explicitly does the same', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { ...QUIET, [ID]: false }, 'onboarding:done': true })
  w.ask.answer = 'Use suggestion'
  await begin($, w)
  expect((await submitPrompt($, LOW)).text).toBe(LOW)
  expect(w.asks).toEqual([])
  expect((await cmd($, 'mute')).text).toBe(OFF)
})

test('the clarity score of 13 prompts (English and Hebrew), with the missing parts as suggestions', SLOW, async ($, on) => {
  const { w } = await setup($, on)
  // Muted, so scoring never opens a question.
  await cmd($, 'mute')
  for (const row of SCORES) {
    const r = await submitPrompt($, row.text)
    expect(r.text).toBe(row.text)
    const out = (await cmd($, '')).text as string
    expect(out, row.text).toContain(`Last prompt: ${row.score}/100 (heuristic clarity score)`)
    for (const part of row.missing) expect(out, `${row.text} / ${part}`).toContain(part)
    if (row.missing.length === 0) expect(out).toContain('Nothing to improve.')
    expect(out.split(String.fromCharCode(10)).filter(l => l.startsWith('• ')).length, row.text).toBe(row.missing.length)
  }
  expect(w.asks).toEqual([])
})

test('the number of suggestion lines equals the number of deductions', SLOW, async ($, on) => {
  await setup($, on)
  await cmd($, 'mute')
  await submitPrompt($, 'something is broken with the app')
  const lines = ((await cmd($, '')).text as string).split('\n').filter(l => l.startsWith('• '))
  // verb, scope, accept, vague, short: all five are missing
  expect(lines.length).toBe(5)
})

test('too short, slash commands and bang snippets are not scored or asked about', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  for (const text of ['fix bug now', 'fix the bug', '/model sonnet please now', 'ok']) {
    const r = await submitPrompt($, text)
    expect(r.text, text).toBe(text)
  }
  // A "!snippet" is the prompt-snippets feature's; the enhancer (ahead of it in the chain) leaves it alone, so the
  // text that comes out is the snippet's own expansion, not a rewrite.
  const bang = await submitPrompt($, '!fix something is broken here')
  expect(bang.text).toBe('Find the root cause of the following problem and fix it with the smallest correct change; run the relevant tests after: something is broken here')
  expect(w.asks).toEqual([])
  expect((await cmd($, '')).text).toContain('No prompt has been scored yet')
})

test('a prompt that scores 60 or more is not asked about (boundary)', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const text = 'investigate why the build is failing in CI and fix it so the pipeline passes'
  expect((await submitPrompt($, text)).text).toBe(text)
  expect(w.asks).toEqual([])
  expect((await cmd($, '')).text).toContain('60/100')
})

test('prompts that are not typed by the person (or flagged as meta) are scored but never asked', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const r = await $.prompt.submit({ text: LOW, wait: false, origin: { kind: 'task-notification' } })
  expect(r.text).toBe(LOW)
  expect(w.asks).toEqual([])
  expect((await cmd($, '')).text).toContain('35/100')
})

// -----------------------------------------------------------------------------------------------
// The question and its four options.
// -----------------------------------------------------------------------------------------------

test('the question carries the heuristic score, the top 3 suggestions and the proposed rewrite', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  expect(w.asks.length).toBe(1)
  const ask = w.asks[0]!
  expect(ask.header).toBe('Clarity')
  expect(ask.options).toEqual(OPTIONS)
  expect(ask.question).toContain('Clarity (heuristic): 35/100')
  // fix the login bug please: scope, accept, vague, short are missing; only the top three are listed.
  expect(ask.question).toContain('Name the place')
  expect(ask.question).toContain('Say how you will know it worked')
  expect(ask.question).toContain('Replace vague words')
  expect(ask.question).not.toContain('Add a bit more detail')
  expect(ask.question).toContain('Suggested rewrite:')
  expect(ask.question).toContain(LOW_PROPOSED)
  expect(ask.question.trimEnd().endsWith('?')).toBe(true)
})

test('"Send as is": the prompt is untouched, the chip shows until the turn completes', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW)
  expect(r.drop).toBeUndefined()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const chip = await band.find({ key: 'chip-prompt-enhancer' })
  expect(chip).toBeDefined()
  expect(String(chip?.text ?? '')).toContain('prompt 35')
  await band.unmount()

  // survey in front: quiet
  const surveyed = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await surveyed.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await surveyed.unmount()

  await $.turn.start({ text: LOW, turnId: 't1' })
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await after.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await after.unmount()
  expect(w.asks.length).toBe(1)
})

test('the chip also works on the terminal surface and a clear prompt clears it', SLOW, async ($, on) => {
  await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ key: 'chip-prompt-enhancer' })).toBeDefined()
  await band.unmount()
  // A good prompt right after resets it (the flag is for the prompt just sent).
  await submitPrompt($, 'Fix the null pointer crash in src/auth/login.ts so that the tests pass')
  const again = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await again.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await again.unmount()
})

test('"Use suggestion": the prompt becomes the proposed rewrite', SLOW, async ($, on) => {
  const { w, fills } = await setup($, on, {}, 'Use suggestion')
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW_PROPOSED)
  expect(r.drop).toBeUndefined()
  expect(fills).toEqual([])
  // No chip: it was not sent as is.
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await band.unmount()
  expect(w.asks.length).toBe(1)
})

test('"Edit": the prompt is dropped and the proposal goes into the prompt box (replace)', SLOW, async ($, on) => {
  const { fills } = await setup($, on, {}, 'Edit')
  const r = await submitPrompt($, LOW)
  expect(r.drop).toContain('the suggestion is in the prompt box')
  expect(fills).toEqual([{ text: LOW_PROPOSED, mode: 'replace' }])
})

test('"Edit" when the prompt box cannot take the text: the prompt is sent as is, never lost', SLOW, async ($, on) => {
  const { fills, fillState } = await setup($, on, {}, 'Edit')
  fillState.ok = false
  const r = await submitPrompt($, LOW)
  expect(r.drop).toBeUndefined()
  expect(r.text).toBe(LOW)
  expect(fills.length).toBe(1)
  const ui = await pane($)
  expect(await allText(ui)).toContain('sent as is')
  await ui.unmount()
})

test('"Stop asking": sent as is, stored muted, no more questions; unmute asks again', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Stop asking')
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW)
  expect(w.stored['prompt-enhancer:muted']).toBe(true)
  expect((await cmd($, '')).text).toContain('muted this session')

  await w.clock.advance(6 * MIN)
  w.ask.answer = 'Use suggestion'
  expect((await submitPrompt($, LOW)).text).toBe(LOW)
  expect(w.asks.length).toBe(1)

  expect((await cmd($, 'unmute')).text).toContain('Unmuted')
  expect(w.stored['prompt-enhancer:muted']).toBe(false)
  expect((await submitPrompt($, LOW)).text).toBe(LOW_PROPOSED)
  expect(w.asks.length).toBe(2)
})

test('the mute lasts only until the next session', SLOW, async ($, on) => {
  const { w } = await setup($, on, { 'prompt-enhancer:muted': true }, 'Use suggestion')
  // The store says muted from the last session, but a new session starts unmuted.
  expect(w.stored['prompt-enhancer:muted']).toBe(false)
  expect((await submitPrompt($, LOW)).text).toBe(LOW_PROPOSED)
})

test('a dismissed or unanswerable question sends the prompt as is', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, undefined)
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW)
  expect(r.drop).toBeUndefined()
  expect(w.asks.length).toBe(1)
  // free text typed under "Other" is also "as is"
  await w.clock.advance(6 * MIN)
  w.ask.answer = 'whatever I typed'
  expect((await submitPrompt($, LOW)).text).toBe(LOW)
})

test('at most one question every 5 minutes', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  expect(w.asks.length).toBe(1)
  await w.clock.advance(MIN)
  await submitPrompt($, LOW)
  expect(w.asks.length).toBe(1)
  await w.clock.advance(3 * MIN)
  await submitPrompt($, LOW)
  expect(w.asks.length).toBe(1)
  await w.clock.advance(MIN + 1000)
  await submitPrompt($, LOW)
  expect(w.asks.length).toBe(2)
  // The capped prompts were still scored and kept: 4 rows.
  const ui = await pane($)
  const texts = await textsOf(ui)
  expect(texts.filter(x => x.includes('35 · fix the login bug please')).length).toBe(4)
  expect(texts.filter(x => x === 'not asked').length).toBe(2)
  await ui.unmount()
})

test('the template follows the intent: fix, add, refactor, explain', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const cases: [string, string][] = [
    [LOW, LOW_PROPOSED],
    [
      'add a login button please',
      'Implement a login button: follow the existing code conventions, keep the change small, cover it with tests, run the relevant tests, avoid unrelated changes.',
    ],
    [
      'refactor the payment code please',
      'Refactor the payment code without changing its behaviour: keep the diff small, run the relevant tests before and after, avoid unrelated changes.',
    ],
    [
      'explain how the cache works please',
      'Explain how the cache works in simple terms: what it does, how the parts fit together, with a short example. Do not change any files.',
    ],
  ]
  for (const [text, proposed] of cases) {
    const r = await submitPrompt($, text)
    expect(r.text, text).toBe(proposed)
    await w.clock.advance(6 * MIN)
  }
  expect(w.asks.length).toBe(4)
})

test('a prompt without a leading verb is quoted into the template', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const r = await submitPrompt($, "it doesn't work, fix it")
  expect(r.text).toBe(
    'Investigate "it doesn\'t work, fix it", reproduce it, identify the root cause, implement the smallest safe fix, run the relevant tests, avoid unrelated changes.',
  )
  expect(w.asks[0]?.question).toContain('35/100')
})

test('a Hebrew prompt gets a Hebrew template', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const r = await submitPrompt($, 'משהו לא עובד באתר')
  expect(r.text).toContain('חקור את')
  expect(r.text).toContain('שורש הבעיה')
  expect(r.text).toContain('משהו לא עובד באתר')
  // the UI stays English
  expect(w.asks[0]?.header).toBe('Clarity')
})

test('a Hebrew prompt with a verb: Hebrew intent templates', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  const r = await submitPrompt($, 'הוסף כפתור התנתקות בבקשה')
  expect(r.text.startsWith('ממש כפתור התנתקות:')).toBe(true)
  await w.clock.advance(6 * MIN)
  const r2 = await submitPrompt($, 'תסביר לי איך עובד המנגנון')
  expect(r2.text.startsWith('הסבר את איך עובד המנגנון')).toBe(true)
})

test('the question and the options come in the chosen language', SLOW, async ($, on) => {
  const { w } = await setup($, on, { language: 'he' }, 'שלח כמו שהוא')
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW)
  const ask = w.asks[0]!
  expect(ask.header).toBe('בהירות')
  expect(ask.options).toEqual(['שלח כמו שהוא', 'השתמש בהצעה', 'ערוך', 'הפסק לשאול'])
  expect(ask.question).toContain('היוריסטי')
  expect(ask.question).toContain('35/100')
  // the rewrite is in the prompt's language (English here), not the UI's
  expect(ask.question).toContain(LOW_PROPOSED)
  expect((await cmd($, '')).text).toContain('משפר פרומפטים')
})

// -----------------------------------------------------------------------------------------------
// AI mode.
// -----------------------------------------------------------------------------------------------

test('/enhance ai on|off: stored, reported, and a bare /enhance ai shows the state', SLOW, async ($, on) => {
  const { w } = await setup($, on)
  expect((await cmd($, 'ai')).text).toBe('AI rewrite is off. Use /enhance ai on or /enhance ai off.')
  expect((await cmd($, 'ai on')).text).toContain('AI rewrite is on')
  expect(w.stored['prompt-enhancer:ai']).toBe(true)
  expect((await cmd($, 'ai')).text).toBe('AI rewrite is on. Use /enhance ai on or /enhance ai off.')
  expect((await cmd($, 'ai maybe')).text).toBe('AI rewrite is on. Use /enhance ai on or /enhance ai off.')
  expect((await cmd($, 'ai off')).text).toContain('AI rewrite is off')
  expect(w.stored['prompt-enhancer:ai']).toBe(false)
})

test('AI mode answered: the rewrite comes from the model (cleaned, <= 80 words) and labelled', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  await cmd($, 'ai on')
  w.modelReply = { isAnswered: true, text: '  "Fix the login bug in the auth module so users can sign in again."  ' }
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe('Fix the login bug in the auth module so users can sign in again.')
  expect(w.models.length).toBe(1)
  expect(w.modelIds).toEqual(['claude-haiku-5-5'])
  expect(w.models[0]).toContain(LOW)
  expect(w.models[0]).toContain('At most 80 words')
  expect(w.models[0]).toContain('same language as the prompt')
  expect(w.asks[0]?.question).toContain('Suggested rewrite (AI):')
})

test('AI mode: a reply longer than 80 words is cut to 80', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  await cmd($, 'ai on')
  w.modelReply = { isAnswered: true, text: Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ') }
  const r = await submitPrompt($, LOW)
  expect(r.text.split(' ').length).toBe(80)
  expect(r.text.startsWith('w0 w1')).toBe(true)
})

test('AI mode unanswered (or empty): falls back to the template, labelled as such', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Use suggestion')
  await cmd($, 'ai on')
  w.modelReply = { isAnswered: false }
  const r = await submitPrompt($, LOW)
  expect(r.text).toBe(LOW_PROPOSED)
  expect(w.models.length).toBe(1)
  expect(w.asks[0]?.question).toContain('Suggested rewrite:')
  expect(w.asks[0]?.question).not.toContain('(AI)')

  await w.clock.advance(6 * MIN)
  w.modelReply = { isAnswered: true, text: '   ' }
  expect((await submitPrompt($, LOW)).text).toBe(LOW_PROPOSED)
  expect(w.models.length).toBe(2)
})

test('AI mode off: no model call at all; and it is not called when nothing is asked', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  expect(w.models).toEqual([])
  await cmd($, 'ai on')
  await w.clock.advance(6 * MIN)
  await submitPrompt($, 'Fix the null pointer crash in src/auth/login.ts so that the tests pass')
  expect(w.models).toEqual([])
  await cmd($, 'mute')
  await submitPrompt($, LOW)
  expect(w.models).toEqual([])
})

test('AI mode survives to the next session through the store', SLOW, async ($, on) => {
  const { w } = await setup($, on, { 'prompt-enhancer:ai': true }, 'Use suggestion')
  w.modelReply = { isAnswered: true, text: 'Repair the login bug.' }
  expect((await submitPrompt($, LOW)).text).toBe('Repair the login bug.')
  expect((await cmd($, '')).text).toContain('AI rewrite on')
})

// -----------------------------------------------------------------------------------------------
// Commands and the pane.
// -----------------------------------------------------------------------------------------------

test('/enhance, mute, unmute, pane and a bad argument', SLOW, async ($, on) => {
  const { w } = await setup($, on)
  const first = (await cmd($, '')).text as string
  expect(first).toBe(
    ['Prompt enhancer', 'Mode: asks when the score is below 60 · AI rewrite off · not muted', 'No prompt has been scored yet (only prompts of 4 words or more are scored).'].join('\n'),
  )
  expect((await cmd($, 'mute')).text).toContain('Muted until the next session')
  expect((await cmd($, '')).text).toContain('muted this session')
  expect((await cmd($, 'unmute')).text).toContain('Unmuted')
  expect((await cmd($, 'pane')).text).toBe('Opened the prompt enhancer pane.')
  expect(w.opened.map(o => o.id)).toContain('prompt-enhancer')
  expect((await cmd($, 'nonsense')).text).toBe('Usage: /enhance | /enhance ai on|off | /enhance mute|unmute | /enhance pane')
  expect((await cmd($, '  MUTE ')).text).toContain('Muted')
})

test('the pane: empty state, then the last prompts with score and choice, newest first', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  const empty = await pane($)
  const emptyText = await allText(empty)
  expect(emptyText).toContain('No prompt has been scored yet.')
  expect(emptyText).toContain('Prompts of 4 words or more are scored here')
  await empty.unmount()

  await submitPrompt($, LOW)
  await w.clock.advance(6 * MIN)
  w.ask.answer = 'Use suggestion'
  await submitPrompt($, 'make the thing work better please')
  await submitPrompt($, 'Fix the null pointer crash in src/auth/login.ts so that the tests pass')

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await pane($, surface)
    const texts = await textsOf(ui)
    const rows = texts.filter(x => x.includes(' · ') && /^\d+ · /.test(x))
    expect(rows[0]).toBe(`100 · ${'Fix the null pointer crash in src/auth/login.ts so that the tests pass'.slice(0, 60)}`)
    expect(rows[1]).toBe('50 · make the thing work better please')
    expect(rows[2]).toBe('35 · fix the login bug please')
    expect(texts).toContain('clear enough')
    expect(texts).toContain('suggestion used')
    expect(texts).toContain('sent as is')
    expect(texts.some(x => x.endsWith(' ago'))).toBe(true)
    await ui.unmount()
  }
})

test('the pane keeps only the last 10 prompts', SLOW, async ($, on) => {
  await setup($, on)
  for (let i = 0; i < 12; i++) await submitPrompt($, `Fix the null pointer crash number ${i} in src/auth/login.ts so that the tests pass`)
  const ui = await pane($)
  const rows = (await textsOf(ui)).filter(x => /^100 · Fix the null pointer crash number \d+/.test(x))
  expect(rows.length).toBe(10)
  expect(rows[0]).toContain('number 11')
  expect(rows[9]).toContain('number 2')
  await ui.unmount()
})

test('pane buttons: AI on/off, Mute/Unmute and Clear', SLOW, async ($, on) => {
  const { w } = await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await pane($, surface)
    const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(keys).toEqual(expect.arrayContaining(['pe-ai', 'pe-mute', 'pe-clear']))

    const labelOf = async (key: string) => String((await ui.find({ key }))?.props['label'])
    expect(await labelOf('pe-ai')).toBe('AI on')
    await ui.press({ key: 'pe-ai' })
    expect(await labelOf('pe-ai')).toBe('AI off')
    expect(w.stored['prompt-enhancer:ai']).toBe(true)
    await ui.press({ key: 'pe-ai' })
    expect(await labelOf('pe-ai')).toBe('AI on')
    expect(w.stored['prompt-enhancer:ai']).toBe(false)

    expect(await labelOf('pe-mute')).toBe('Mute')
    await ui.press({ key: 'pe-mute' })
    expect(await labelOf('pe-mute')).toBe('Unmute')
    expect(w.stored['prompt-enhancer:muted']).toBe(true)
    expect((await cmd($, '')).text).toContain('muted this session')
    await ui.press({ key: 'pe-mute' })
    expect(await labelOf('pe-mute')).toBe('Mute')
    expect(w.stored['prompt-enhancer:muted']).toBe(false)

    if (surface === 'desktop') {
      expect(await allText(ui)).toContain('35 · fix the login bug please')
      await ui.press({ key: 'pe-clear' })
      expect(await allText(ui)).toContain('No prompt has been scored yet.')
      expect((await cmd($, '')).text).toContain('No prompt has been scored yet')
    }
    await ui.unmount()
  }
})

test('Clear also drops the chip', SLOW, async ($, on) => {
  await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  const ui = await pane($)
  await ui.press({ key: 'pe-clear' })
  await ui.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: 'chip-prompt-enhancer' })).toBeUndefined()
  await band.unmount()
})

test('the pane in Hebrew', SLOW, async ($, on) => {
  await setup($, on, { language: 'he' }, 'שלח כמו שהוא')
  await submitPrompt($, LOW)
  const ui = await pane($)
  const text = await allText(ui)
  expect(text).toContain('משפר פרומפטים')
  expect(text).toContain('נשלח כמו שהוא')
  expect(String((await ui.find({ key: 'pe-clear' }))?.props['label'])).toBe('נקה')
  await ui.unmount()
})

test('a handler that only reads (no turn) leaves the chip alone, and a sub-agent turn does not clear it', SLOW, async ($, on) => {
  await setup($, on, {}, 'Send as is')
  await submitPrompt($, LOW)
  await $.turn.start({ text: LOW, turnId: 't2' })
  await $.turn.complete({ answer: 'ok', durationMs: 5, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'sub-1' })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ key: 'chip-prompt-enhancer' })).toBeDefined()
  await band.unmount()
})
