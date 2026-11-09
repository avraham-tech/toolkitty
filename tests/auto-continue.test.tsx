import { expect, test } from 'claude-code/testing'

import { BAND, begin, bandLine, boot, done, HOUR, iso, measure, openBand, SLOW, T0 } from './world'

const ID = 'auto-continue'
const ON = { enabled: { [ID]: true, 'budget-guard': false } }
const full = (resetsInMs: number, kind = 'five_hour') => ({ kind, percentUsed: 100, resetsAt: iso(T0 + resetsInMs) })
const MIN = 60_000
const cmd = ($: any, args: string) => $.command.run({ command: 'auto-continue', args })
const limitError = (id: string, answer = 'You have hit your usage limit.') => done(id, { reason: 'error', answer })

/** The band row (a Box with the text and a cancel Button), or undefined when no row is drawn. */
async function row($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string).filter((x: string) => /limit hit|הגעת למגבלה/.test(x))
  const cancel = await ui.find({ key: 'auto-continue-cancel' })
  await ui.unmount()
  return texts.length === 0 ? undefined : { text: texts[0] as string, hasCancel: cancel !== undefined }
}

test('loads, registers /auto-continue, and is off by default', SLOW, async ($, on) => {
  const w = boot(on, { enabled: { 'budget-guard': false } })
  await begin($, w)
  expect(w.commands).toContain('auto-continue')
  expect((await cmd($, '')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect((await cmd($, 'cancel')).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  // a limit while it is off arms nothing
  await measure($, w, [full(2 * MIN)])
  await w.clock.advance(4 * MIN)
  expect(w.submitted).toEqual([])
  expect(w.toasts).toEqual([])
  expect(await row($)).toBeUndefined()
})

test('a limit hit arms a resume: toast, band row with a cancel Button, then the prompt is submitted at reset', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  expect(await row($)).toBeUndefined()
  await measure($, w, [full(2 * MIN)])
  // two minutes to the reset + a minute of slack
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 3:00.'])
  expect(await row($)).toEqual({ text: '⏸ limit hit · resumes in 3:00', hasCancel: true })
  expect(await row($, 'terminal')).toEqual({ text: '⏸ limit hit · resumes in 3:00', hasCancel: true })
  // the band counts down each second
  await w.clock.advance(10_000)
  expect((await row($))?.text).toBe('⏸ limit hit · resumes in 2:50')
  expect(w.submitted).toEqual([])
  await w.clock.advance(171_000)
  expect(w.submitted.length).toBe(1)
  const sent = w.submitted[0]
  expect(sent.text).toMatch(/^The usage limit has reset\. Continue the task you were working on from exactly where it stopped\./)
  expect(sent.text).toMatch(/Write your reply in English\.$/)
  expect(sent.origin.kind).toBe('plugin')
  // once fired, the band row is gone and nothing fires twice
  expect(await row($)).toBeUndefined()
  await w.clock.advance(10 * MIN)
  expect(w.submitted.length).toBe(1)
  expect((await cmd($, '')).text).toBe('Auto-continue is on and nothing is pending.')
})

test('the resume prompt names the language in use', SLOW, async ($, on) => {
  const w = boot(on, { ...ON, language: 'he' })
  await begin($, w)
  await measure($, w, [full(MIN)])
  expect(w.toasts[0]).toBe('הגעת למגבלת שימוש. המשימה תימשך אוטומטית בעוד 2:00.')
  expect((await row($))?.text).toBe('⏸ הגעת למגבלה · ממשיך בעוד 2:00')
  await w.clock.advance(2 * MIN + 1000)
  expect(w.submitted.length).toBe(1)
  expect(w.submitted[0].text).toMatch(/Write your reply in עברית\.$/)
})

test('/auto-continue: status armed, status idle, cancel, on/off hint, nothing to cancel', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  expect((await cmd($, '')).text).toBe('Auto-continue is on and nothing is pending.')
  expect((await cmd($, 'status')).text).toBe('Auto-continue is on and nothing is pending.')
  expect((await cmd($, 'cancel')).text).toBe('Nothing is pending.')
  expect((await cmd($, 'on')).text).toBe('Turn auto-continue on or off in the /toolkitty pane. Here you can use status or cancel.')
  expect((await cmd($, 'OFF')).text).toBe('Turn auto-continue on or off in the /toolkitty pane. Here you can use status or cancel.')
  await measure($, w, [full(2 * MIN)])
  expect((await cmd($, 'status')).text).toBe('Auto-continue is armed: resuming in 3:00 (attempt 1 of 3).')
  await w.clock.advance(30_000)
  expect((await cmd($, '')).text).toBe('Auto-continue is armed: resuming in 2:30 (attempt 1 of 3).')
  // an unknown word is the status
  expect((await cmd($, 'banana')).text).toBe('Auto-continue is armed: resuming in 2:30 (attempt 1 of 3).')
  expect((await cmd($, ' Cancel ')).text).toBe('Auto-continue cancelled.')
  expect((await cmd($, 'cancel')).text).toBe('Nothing is pending.')
  expect(await row($)).toBeUndefined()
  // cancelled: no prompt, ever
  await w.clock.advance(5 * MIN)
  expect(w.submitted).toEqual([])
})

test('the band cancel Button disarms the resume', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(ui)
  const btn = await ui.find({ key: 'auto-continue-cancel' })
  expect(btn?.props['label']).toBe('cancel')
  await ui.press({ key: 'auto-continue-cancel' })
  await ui.redraw()
  expect(await ui.find({ key: 'auto-continue-cancel' })).toBeUndefined()
  await ui.unmount()
  expect((await cmd($, '')).text).toBe('Auto-continue is on and nothing is pending.')
  await w.clock.advance(5 * MIN)
  expect(w.submitted).toEqual([])
})

test('hebrew command answers', SLOW, async ($, on) => {
  const w = boot(on, { ...ON, language: 'he' })
  await begin($, w)
  expect((await cmd($, '')).text).toBe('ההמשך האוטומטי פעיל ואין דבר ממתין.')
  expect((await cmd($, 'cancel')).text).toBe('אין דבר ממתין.')
  await measure($, w, [full(2 * MIN)])
  expect((await cmd($, '')).text).toBe('ההמשך האוטומטי דרוך: ממשיך בעוד 3:00 (ניסיון 1 מתוך 3).')
  expect((await cmd($, 'cancel')).text).toBe('ההמשך האוטומטי בוטל.')
})

test('a window below 100% arms nothing', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [{ kind: 'five_hour', percentUsed: 99.9, resetsAt: iso(T0 + 2 * MIN) }])
  await w.clock.advance(4 * MIN)
  expect(w.submitted).toEqual([])
  expect(w.toasts).toEqual([])
})

test('the soonest reset among the full windows is awaited; a reset in the past is ignored', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN, 'five_hour'), full(3 * HOUR, 'seven_day'), { kind: 'spend_limit', percentUsed: 10, resetsAt: iso(T0 + 30_000) }])
  // the spend window is not full: its sooner reset does not count
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 3:00.'])
  await w.clock.advance(3 * MIN + 1000)
  expect(w.submitted.length).toBe(1)
})

test('only the future reset counts when a full window already passed its reset time', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(-5 * MIN, 'five_hour'), full(2 * MIN, 'seven_day')])
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 3:00.'])
})

test('a second measure while armed does not stack a second resume', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  await measure($, w, [full(2 * MIN)])
  expect(w.toasts.length).toBe(1)
  await w.clock.advance(4 * MIN)
  expect(w.submitted.length).toBe(1)
  // and none while the resume's own turn is in flight
  await measure($, w, [full(2 * MIN)])
  expect(w.toasts.length).toBe(1)
})

test('no reset time known: a blind 15-minute retry', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [{ kind: 'five_hour', percentUsed: 100 }])
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 15:00.'])
  expect((await cmd($, '')).text).toBe('Auto-continue is armed: resuming in 15:00 (attempt 1 of 20).')
  await w.clock.advance(14 * MIN)
  expect(w.submitted).toEqual([])
  await w.clock.advance(MIN + 1000)
  expect(w.submitted.length).toBe(1)
})

test('a turn that ended in a limit error arms from the usage numbers', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  w.usage.rateLimits = [full(2 * MIN)]
  await $.turn.start({ text: 'work', turnId: 't1' })
  await $.turn.complete(limitError('t1', 'boom'))
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 3:00.'])
})

test('a turn that ended in an error naming the limit arms blind when the usage shows nothing', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await $.turn.start({ text: 'work', turnId: 't1' })
  await $.turn.complete(limitError('t1', 'API Error: usage limit reached'))
  expect(w.toasts).toEqual(['Usage limit hit. The task will resume automatically in 15:00.'])
})

test('other turn endings do not arm', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await $.turn.start({ text: 'a', turnId: 't1' })
  // an error without limit words and no full window
  await $.turn.complete(done('t1', { reason: 'error', answer: 'network down' }))
  // limit words in a normal answer
  await $.turn.start({ text: 'b', turnId: 't2' })
  await $.turn.complete(done('t2', { reason: 'answer', answer: 'the usage limit is documented here' }))
  // a refusal
  await $.turn.start({ text: 'c', turnId: 't3' })
  await $.turn.complete({ answer: 'usage limit', durationMs: 1, isAborted: false, turnId: 't3', reason: 'refusal', refusal: { category: null, explanation: null } })
  // a subagent's error
  await $.turn.start({ text: 'd', turnId: 't4', agentId: 'a1' })
  await $.turn.complete({ ...done('t4', { reason: 'error', answer: 'usage limit' }), agentId: 'a1' })
  expect(w.toasts).toEqual([])
  await w.clock.advance(20 * MIN)
  expect(w.submitted).toEqual([])
})

test('a turn the person starts by hand cancels the pending resume', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  // a subagent starting does not
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  expect(await row($)).toBeDefined()
  await $.turn.start({ text: 'mine', turnId: 't1' })
  expect(await row($)).toBeUndefined()
  await w.clock.advance(5 * MIN)
  expect(w.submitted).toEqual([])
})

test('it gives up after 3 resumes that each hit the limit again, with a toast', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  for (let i = 1; i <= 3; i++) {
    await w.clock.advance(3 * MIN + 1000)
    expect(w.submitted.length).toBe(i)
    // the resumed turn hits the limit once more
    w.usage.rateLimits = [{ kind: 'five_hour', percentUsed: 100, resetsAt: iso(w.clock.now() + 2 * MIN) }]
    await $.turn.start({ text: 'resume', turnId: `r${i}` })
    await $.turn.complete(limitError(`r${i}`))
    if (i < 3) expect((await cmd($, '')).text).toMatch(new RegExp(`attempt ${i + 1} of 3`))
  }
  expect(w.toasts[w.toasts.length - 1]).toBe('Auto-continue stopped: the limit was still hit after 3 attempts.')
  expect((await cmd($, '')).text).toBe('Auto-continue is on and nothing is pending.')
  await w.clock.advance(10 * MIN)
  expect(w.submitted.length).toBe(3)
})

test('a resumed turn that finishes cleanly ends the streak', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  await w.clock.advance(3 * MIN + 1000)
  await $.turn.start({ text: 'resume', turnId: 'r1' })
  await $.turn.complete(done('r1'))
  // a later limit starts again from attempt 1
  const again = [{ kind: 'five_hour', percentUsed: 100, resetsAt: iso(w.clock.now() + 2 * MIN) }]
  await measure($, w, again)
  expect((await cmd($, '')).text).toMatch(/attempt 1 of 3/)
})

test('a resume prompt a hook above drops is not retried and raises no toast', SLOW, async ($, on) => {
  // The kit's chain never rejects `$.prompt.submit` (a drop resolves), so the "could not send" toast
  // (its catch branch) is not reachable from a test; this pins the observable behaviour of a drop.
  const w = boot(on, ON)
  await begin($, w)
  w.submitFails = true
  await measure($, w, [full(2 * MIN)])
  w.toasts.length = 0
  await w.clock.advance(3 * MIN + 1000)
  expect(w.submitted).toEqual([])
  expect(w.toasts).toEqual([])
  await w.clock.advance(20 * MIN)
  expect(w.submitted).toEqual([])
})

test('switching the feature off while armed stops the resume', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  expect(await row($)).toBeDefined()
  // the switchboard pane toggles the feature
  const sw = await $.ui.mount({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'toolkitty',
    surface: 'desktop',
    props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  await sw.press({ key: `t-${ID}` })
  await sw.unmount()
  expect(await row($)).toBeUndefined()
  await w.clock.advance(5 * MIN)
  expect(w.submitted).toEqual([])
})

test('a survey hides the band row', SLOW, async ($, on) => {
  const w = boot(on, ON)
  await begin($, w)
  await measure($, w, [full(2 * MIN)])
  expect(await row($, 'desktop', { hasSurvey: true })).toBeUndefined()
  expect(await bandLine($, ID, 'desktop', { hasSurvey: true })).toBeUndefined()
})
