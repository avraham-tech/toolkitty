import { expect, test } from 'claude-code/testing'

import { allText, begin, boot, compose, done, finishTurn, paneOf, SLOW, submitPrompt, noticesOf } from './world'

const ID = 'correction-capture'
const KEY = 'correction-capture:rules:C:/tmp/project'
const SECTION = 'toolkitty:correction-capture'
const HEAD = "# Rules learned from the user's corrections"
const QUIET = { tldr: false, 'turn-summary': false, 'commit-msg': false, 'explain-error': false }
const store = (extra: Record<string, unknown> = {}, enabled: Record<string, boolean> = {}) => ({ enabled: { ...QUIET, ...enabled }, ...extra })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const EMPTY = 'No rules yet. When you correct me, a lasting rule appears here.'
/** A header action carries its words as `label`, a list row as its text. */
const words = (b: any): string => (b.props['label'] ?? b.text) as string
const learned = async ($: any) => (await noticesOf($, ID)).filter((x: string) => /^Rule learned: |^כלל נלמד: /.test(x))
/** Only the calls this feature makes to the cheap model. */
const asked = (w: any) => w.models.filter((p: string) => p.includes('looks like a correction'))
const pane = ($: any, surface: 'desktop' | 'terminal' = 'desktop', viewport?: { columns: number; rows: number }) =>
  $.ui.mount({ ...paneOf('correction-rules'), surface, ...(viewport === undefined ? {} : { viewport }) })

/** The model answers with `reply` to every correction. */
function answer(w: any, reply: string | ((prompt: string) => string)) {
  w.modelReply = (prompt: string) => ({ isAnswered: true, text: typeof reply === 'function' ? reply(prompt) : reply })
}

test('loads, registers /rules, no rules yet', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect(w.commands).toContain('rules')
  expect(await compose($)).toEqual([])
  expect(w.toasts).toEqual([])
})

test('/rules opens the pane', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect((await $.command.run({ command: 'rules', args: '' })).text).toBe('Opened the rules pane.')
  expect(w.opened).toContainEqual({ id: 'correction-rules', title: 'Learned rules' })
})

test('a correction becomes a rule at the end of the turn: model asked, toast, stored, in the prompt', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'Use tabs for indentation')
  const r = await submitPrompt($, "no, don't use spaces, use tabs")
  expect(r.drop).toBeUndefined()
  // nothing happens until the turn completes
  expect(asked(w)).toEqual([])
  await finishTurn($, 't1')
  expect(asked(w).length).toBe(1)
  const prompt = asked(w)[0] as string
  expect(prompt).toContain('Write the rule in English, imperative, at most 20 words')
  expect(prompt).toContain('answer exactly NONE')
  expect(prompt.endsWith("Message:\nno, don't use spaces, use tabs")).toBe(true)
  expect(await learned($)).toEqual(['Rule learned: Use tabs for indentation'])
  expect(w.stored[KEY]).toEqual(['Use tabs for indentation'])
  const sections = await compose($)
  expect(sections).toEqual([{ id: SECTION, text: `${HEAD}\n- Use tabs for indentation`, scope: 'session' }])
})

test('NONE, junk and no answer teach nothing', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  for (const reply of ['NONE', 'none', 'None.', 'none - this is a one-off', '', '   \n  ', 'ok', '""', '- ']) {
    answer(w, reply)
    await submitPrompt($, 'no, not that one')
    await finishTurn($, 't')
  }
  expect(asked(w).length).toBe(9)
  expect(w.stored[KEY]).toBeUndefined()
  expect(await learned($)).toEqual([])
  // the model does not answer, or throws
  w.modelReply = { isAnswered: false }
  await submitPrompt($, 'no, not that one')
  await finishTurn($, 't')
  w.modelReply = () => {
    throw new Error('model down')
  }
  await submitPrompt($, 'no, not that one')
  await finishTurn($, 't')
  expect(w.stored[KEY]).toBeUndefined()
  expect(await compose($)).toEqual([])
})

test('the reply is cleaned into one rule: prefixes, quotes, first line, 20 words', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const cases: [string, string][] = [
    ['Rule: Prefer const over let', 'Prefer const over let'],
    ['rule : Prefer let sparingly', 'Prefer let sparingly'],
    ['- Never commit .env files', 'Never commit .env files'],
    ['• Run the linter first', 'Run the linter first'],
    ['1. Keep functions short', 'Keep functions short'],
    ['2) Name tests after behaviour', 'Name tests after behaviour'],
    ['"Write docs in markdown"', 'Write docs in markdown'],
    ["'Avoid default exports'", 'Avoid default exports'],
    ['`Use pnpm`', 'Use pnpm'],
    ['\n\n  Answer in Hebrew only\nand also something else', 'Answer in Hebrew only'],
    [Array.from({ length: 30 }, (_, i) => `w${i + 1}`).join(' '), Array.from({ length: 20 }, (_, i) => `w${i + 1}`).join(' ')],
  ]
  for (const [reply, rule] of cases) {
    answer(w, reply)
    await submitPrompt($, 'wrong, redo it')
    await finishTurn($, 't')
    expect(w.stored[KEY].slice(-1)[0]).toBe(rule)
  }
  expect(w.stored[KEY].length).toBe(cases.length)
})

test('the same rule twice (any case) is kept once and announced once', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'Use tabs')
  await submitPrompt($, 'no, tabs')
  await finishTurn($, 't1')
  answer(w, '  use TABS ')
  await submitPrompt($, 'no, tabs please')
  await finishTurn($, 't2')
  expect(w.stored[KEY]).toEqual(['Use tabs'])
  expect((await learned($)).length).toBe(1)
})

test('corrections in every language are recognised; ordinary requests are not', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'NONE')
  const yes = [
    'no, use tabs',
    "don't add comments",
    'do not touch that file',
    'stop adding logs',
    'never use var',
    'not what I asked',
    'wrong file',
    "that's not right",
    'that is not what I meant',
    'use const instead',
    'I said use pnpm',
    'nope',
    'לא, תשתמש בטאבים',
    'אל תוסיף הערות',
    'תפסיק להוסיף לוגים',
    'במקום זה תשתמש ב-const',
    'אמרתי לך כבר',
    'no, así no',
    'nunca uses var',
    'deja de añadir comentarios',
    'eso no es lo que pedí',
    'usa const en vez de var',
    'ya dije que usaras pnpm',
    'non, pas comme ça',
    'arrête de commenter',
    'ne fais pas ça',
    'utilise const au lieu de var',
    "je t'ai dit pnpm",
    'нет, не так',
    'не надо комментариев',
    'перестань добавлять логи',
    'используй const вместо var',
    'я сказал pnpm',
  ]
  const no = [
    'please add a test',
    'now run the tests',
    'nothing else to change',
    'notice the failing case',
    'note that this is fine',
    'can you explain this function',
    'תוסיף בדיקה',
    'agrega una prueba',
    'ajoute un test',
    'добавь тест',
    'nonsense is not a command here',
    'great, thanks',
  ]
  // "nonsense" starts with "no": the word boundary check makes it a non-match
  for (const text of [...yes, ...no]) await submitPrompt($, text)
  await finishTurn($, 't1')
  const sent = asked(w).map((p: string) => p.split('Message:\n')[1])
  // only the last five corrections are kept (MAX_PENDING)
  expect(sent.length).toBe(5)
  expect(sent).toEqual(yes.slice(-5))
  w.models.length = 0
  for (const text of no) await submitPrompt($, text)
  await finishTurn($, 't2')
  expect(asked(w)).toEqual([])
})

test('each of the corrections is recognised on its own', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'NONE')
  const yes = ['no, use tabs', "don't add comments", 'nope', 'לא, תשתמש בטאבים', 'במקום זה', 'no, así no', 'en vez de eso', 'non, pas comme ça', 'au lieu de ça', 'нет, не так', 'вместо этого']
  for (const text of yes) {
    w.models.length = 0
    await submitPrompt($, text)
    await finishTurn($, 't')
    expect(asked(w).length, text).toBe(1)
  }
})

test('commands, meta prompts and slash text are not corrections', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'Use tabs')
  await submitPrompt($, 'no, wrong', { command: { name: 'foo', args: '' } })
  await submitPrompt($, 'no, wrong', { isMeta: true })
  await submitPrompt($, '/no that is wrong')
  await submitPrompt($, '   ')
  await finishTurn($, 't1')
  expect(asked(w)).toEqual([])
})

test('a long correction is cut to 800 characters before it goes to the model', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'NONE')
  await submitPrompt($, `no, ${'x'.repeat(2000)}`)
  await finishTurn($, 't1')
  const sent = asked(w)[0].split('Message:\n')[1] as string
  expect(sent.length).toBe(800)
})

test('several corrections in one turn are each distilled, oldest dropped past five', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, p => `Rule for ${p.split('Message:\n')[1]}`)
  for (let i = 1; i <= 7; i++) await submitPrompt($, `no, case ${i}`)
  await finishTurn($, 't1')
  expect(w.stored[KEY]).toEqual(['Rule for no, case 3', 'Rule for no, case 4', 'Rule for no, case 5', 'Rule for no, case 6', 'Rule for no, case 7'])
  // the rules are all kept, but "Rule learned" is an info notice: a feature's second one within a minute is dropped
  expect((await learned($)).length).toBe(1)
  // the queue is empty afterwards
  w.models.length = 0
  await finishTurn($, 't2')
  expect(asked(w)).toEqual([])
})

test('a subagent turn ending does not consume the pending corrections', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  answer(w, 'Use tabs')
  await submitPrompt($, 'no, tabs')
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  await $.turn.complete({ ...done('s1'), agentId: 'a1' })
  expect(asked(w)).toEqual([])
  await finishTurn($, 't1')
  expect(asked(w).length).toBe(1)
})

test('only the newest 30 rules are kept', SLOW, async ($, on) => {
  const seed = Array.from({ length: 30 }, (_, i) => `Old rule ${i + 1}`)
  const w = boot(on, store({ [KEY]: seed }))
  await begin($, w)
  answer(w, 'Brand new rule')
  await submitPrompt($, 'no, new')
  await finishTurn($, 't1')
  expect(w.stored[KEY].length).toBe(30)
  expect(w.stored[KEY][0]).toBe('Old rule 2')
  expect(w.stored[KEY][29]).toBe('Brand new rule')
})

test('rules are per project and reloaded when a turn starts', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['Use tabs'], 'correction-capture:rules:C:/other': ['Use spaces', 'Keep lines short'] }))
  await begin($, w)
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Use tabs`)
  w.cwd = 'C:/other'
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Use spaces\n- Keep lines short`)
  // the store changed under us (another window)
  w.stored['correction-capture:rules:C:/other'] = ['Only one']
  await $.turn.start({ text: 'hi', turnId: 't2' })
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Only one`)
  // a subagent's turn start does not reload
  w.stored['correction-capture:rules:C:/other'] = []
  await $.turn.start({ text: 'hi', turnId: 't3', agentId: 'a1' })
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Only one`)
  await $.turn.start({ text: 'hi', turnId: 't4' })
  expect(await compose($)).toEqual([])
})

test('the system prompt section lists every rule and is replaced, not duplicated', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['Use tabs', 'Keep functions short'] }))
  await begin($, w)
  const once = await compose($)
  expect(once).toEqual([{ id: SECTION, text: `${HEAD}\n- Use tabs\n- Keep functions short`, scope: 'session' }])
  // composing again does not stack a second section
  expect((await compose($)).length).toBe(1)
})

test('the pane lists the rules as Buttons; a press deletes one, and the prompt follows', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['Use tabs', 'Keep functions short', 'Avoid globals'] }))
  await begin($, w)
  const ui = await pane($)
  const text = await allText(ui)
  expect(text).toContain('Rules for this project (3). Press a rule to delete it.')
  expect(text).toContain('Learned rules')
  const labels = (await ui.findAll({ type: 'Button' })).map((b: any) => [b.key, words(b)])
  expect(labels).toEqual([
    ['rules-clear-all', 'clear all'],
    ['rule-0', '✕ Use tabs'],
    ['rule-1', '✕ Keep functions short'],
    ['rule-2', '✕ Avoid globals'],
  ])
  await ui.press({ key: 'rule-1' })
  expect(w.stored[KEY]).toEqual(['Use tabs', 'Avoid globals'])
  expect(await allText(ui)).toContain('Rules for this project (2).')
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => words(b))).toEqual(['clear all', '✕ Use tabs', '✕ Avoid globals'])
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Use tabs\n- Avoid globals`)
  await ui.press({ key: 'rule-0' })
  await ui.press({ key: 'rule-0' })
  expect(w.stored[KEY]).toEqual([])
  expect(await allText(ui)).toContain(EMPTY)
  expect(await compose($)).toEqual([])
  await ui.unmount()
})

test('"clear all" empties the rules', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['One rule', 'Two rule'] }))
  await begin($, w, 'terminal')
  const ui = await pane($, 'terminal')
  await ui.press({ key: 'rules-clear-all' })
  expect(w.stored[KEY]).toEqual([])
  expect(await allText(ui)).toContain(EMPTY)
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  await ui.unmount()
})

test('a pane on a short screen shows fewer rules', SLOW, async ($, on) => {
  const seed = Array.from({ length: 12 }, (_, i) => `Rule number ${i + 1}`)
  const w = boot(on, store({ [KEY]: seed }))
  await begin($, w)
  const ui = await pane($, 'desktop', { columns: 100, rows: 10 })
  // rows - 6, at least 3
  const rule = (await ui.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('rule-'))
  expect(rule.length).toBe(4)
  await ui.unmount()
})

test('a newly learned rule shows in an open pane', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const ui = await pane($)
  expect(await allText(ui)).toContain(EMPTY)
  answer(w, 'Prefer small commits')
  await submitPrompt($, 'no, commit smaller')
  await finishTurn($, 't1')
  await ui.redraw()
  expect(await allText(ui)).toContain('Rules for this project (1).')
  expect(words(await ui.find({ key: 'rule-0' }))).toBe('✕ Prefer small commits')
  await ui.unmount()
})

test('hebrew: the pane, the toast and the language named to the model', SLOW, async ($, on) => {
  const w = boot(on, store({ language: 'he', [KEY]: ['Use tabs'] }))
  await begin($, w)
  expect((await $.command.run({ command: 'rules', args: '' })).text).toBe('חלונית הכללים נפתחה.')
  const ui = await pane($)
  expect(await allText(ui)).toContain('כללים לפרויקט הזה (1). לחץ על כלל כדי למחוק אותו.')
  expect((await ui.find({ key: 'rules-clear-all' }))?.props['label']).toBe('נקה הכול')
  await ui.unmount()
  answer(w, 'להשתמש בטאבים')
  await submitPrompt($, 'לא, תשתמש בטאבים')
  await finishTurn($, 't1')
  expect(asked(w)[0]).toContain('Write the rule in Hebrew, imperative')
  expect(await learned($)).toEqual(['כלל נלמד: להשתמש בטאבים'])
})

test('off switch: nothing captured, no section, the command and the pane say it is off', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['Use tabs'] }, { [ID]: false }))
  await begin($, w)
  answer(w, 'Something')
  await submitPrompt($, 'no, wrong')
  await finishTurn($, 't1')
  expect(asked(w)).toEqual([])
  expect(await compose($)).toEqual([])
  expect((await $.command.run({ command: 'rules', args: '' })).text).toBe(OFF)
  const ui = await pane($)
  expect(await allText(ui)).toBe(`♻\nLearned rules\n${OFF}`)
  await ui.unmount()
  expect(w.stored[KEY]).toEqual(['Use tabs'])
})

test('switching the feature on mid-session loads the rules at the next turn', SLOW, async ($, on) => {
  const w = boot(on, store({ [KEY]: ['Use tabs'] }, { [ID]: false }))
  await begin($, w)
  expect(await compose($)).toEqual([])
  const sw = await $.ui.mount({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: 'toolkitty',
    surface: 'desktop',
    props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  await sw.press({ key: `t-${ID}` })
  await sw.unmount()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect((await compose($))[0]?.text).toBe(`${HEAD}\n- Use tabs`)
})
