import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const ON = { enabled: { 'decision-ledger': true } }
const LONG = 'The assistant wrote a long answer. '.repeat(12)
const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const PANE = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'decision-ledger',
  props: { title: 'Decisions', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const OWN_FAILURE = /feature decision-ledger failed/

function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = {
    commands: [] as string[],
    toasts: [] as string[],
    opened: [] as { id: string; title: string }[],
    prompts: [] as { model: string; prompt: string }[],
  }
  const plan = { reply: '[]', answered: true, fail: false, throws: false }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
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
  on('model.complete', (_: any, e: any) => {
    // session-finder asks the model for a title too; only this feature's review prompt is kept
    if (e.prompt.startsWith('You review one answer')) seen.prompts.push({ model: e.model, prompt: e.prompt })
    if (plan.throws && e.prompt.startsWith('You review one answer')) throw new Error('model down')
    if (!plan.answered) return { value: { isAnswered: false, reason: 'api-error', status: 500, error: 'server_error', usage: USAGE } }
    return { value: { isAnswered: true, text: plan.reply, usage: USAGE } }
  })
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/tmp/project' }))
  on('session.surfaces', () => ({ value: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => (plan.fail ? { isError: true, result: 'boom' } : { result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, plan }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const finish = ($: any, answer = LONG, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', ...extra })
const items = (xs: { kind: string; text: string }[]) => JSON.stringify(xs)

/** The pane's words in document order: Texts, plus each dismiss row (a Button) split into its kind and its text. */
async function texts(ui: any): Promise<string[]> {
  const out: string[] = []
  for (const f of await ui.findAll({})) {
    if (f.type === 'Text' && String(f.text).trim() !== '✕') out.push(String(f.text))
    if (f.type === 'Button' && String(f.key).startsWith('dismiss-')) {
      const m = /^(\S+) (.*?)\s*✕$/s.exec(String(f.text).trim())
      if (m !== null) out.push(m[1]!, m[2]!)
    }
  }
  return out
}

const EMPTY = ['◔', 'Decisions', 'Nothing recorded yet.', 'Choices Claude makes on its own are listed here after long answers.']

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

async function openPane($: any, surface: 'desktop' | 'terminal' = 'desktop') {
  return $.ui.mount({ ...PANE, surface })
}

test('loads and registers /decisions; it is off by default', SLOW, async ($, on) => {
  const { seen, plan } = boot(on)
  await start($)
  expect(seen.commands).toContain('decisions')
  expect((await $.command.run({ command: 'decisions', args: '' })).text).toBe('Decision ledger is turned off in the Toolkitty pane.')
  plan.reply = items([{ kind: 'decision', text: 'Chose X' }])
  await finish($)
  // off by default: no model call is made
  expect(seen.prompts).toHaveLength(0)
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(['Decision ledger is turned off.'])
  await ui.unmount()
})

test('/decisions opens the pane; empty pane says nothing is recorded', SLOW, async ($, on) => {
  const { seen } = boot(on, ON)
  await start($)
  const r = await $.command.run({ command: 'decisions', args: '' })
  expect(r.text).toBe('Decisions pane opened.')
  expect(seen.opened).toContainEqual({ id: 'decision-ledger', title: 'Decisions' })
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
  expect((await $.command.run({ command: 'decisions', args: 'anything' })).text).toBe('Decisions pane opened.')
})

test('a long answer is reviewed by the cheap model; decisions and assumptions are listed with a toast', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  plan.reply = items([
    { kind: 'decision', text: 'Used a Map instead of an object' },
    { kind: 'assumption', text: 'Node 20 is available' },
    { kind: 'decision', text: 'Named it helper' },
  ])
  await finish($)
  expect(seen.prompts).toHaveLength(1)
  expect(seen.prompts[0]!.model).toBe('claude-haiku-5-5')
  expect(seen.prompts[0]!.prompt).toContain('Write each "text" in English.')
  expect(seen.prompts[0]!.prompt).toContain('Files edited this turn: (none)')
  expect(seen.prompts[0]!.prompt).toContain(LONG.slice(0, 100))
  expect(await noticeTexts($)).toContain('📝 2 decisions, 1 assumption this turn')

  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('Turn 1')
  expect(out).toContain('Used a Map instead of an object')
  expect(out).toContain('Node 20 is available')
  // newest first within the turn
  expect(out.indexOf('Named it helper')).toBeLessThan(out.indexOf('Node 20 is available'))
  expect(out.indexOf('Node 20 is available')).toBeLessThan(out.indexOf('Used a Map instead of an object'))
  expect(out.filter(x => x === 'decision')).toHaveLength(2)
  expect(out.filter(x => x === 'assumption')).toHaveLength(1)
  await ui.unmount()
})

// These are info notices: a second one from the same feature within a minute is dropped, so each wording gets its own session.
test('notice wording: a decision only', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'decision', text: 'a' }])
  await finish($)
  expect(await noticeTexts($)).toContain('📝 1 decision this turn')
})

test('notice wording: assumptions only', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'assumption', text: 'b' }, { kind: 'assumption', text: 'c' }])
  await finish($)
  expect(await noticeTexts($)).toContain('📝 2 assumptions this turn')
})

test('the edited file names are passed to the model, edits that failed or were denied are not', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/src/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: 'C:\\p\\src\\b.ts', content: 'x' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/src/a.ts', old_string: 'b', new_string: 'c' })
  await $.tool.call({ tool: 'NotebookEdit', notebook_path: 'C:/p/n.ipynb', new_source: 'x' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/src/sub.ts', old_string: 'a', new_string: 'b', agentId: 'ag1' })
  plan.reply = '[]'
  await finish($)
  expect(seen.prompts[0]!.prompt).toContain('Files edited this turn: a.ts, b.ts, n.ipynb\n')
  // the list is per turn: cleared at the end
  await finish($)
  expect(seen.prompts[1]!.prompt).toContain('Files edited this turn: (none)')
})

test('a failed edit result is not listed as edited', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  plan.fail = true
  const r = await $.tool.call({ tool: 'Edit', file_path: 'C:/p/src/bad.ts', old_string: 'a', new_string: 'b' })
  expect(r.isError).toBe(true)
  plan.fail = false
  await finish($)
  expect(seen.prompts[0]!.prompt).toContain('Files edited this turn: (none)')
})

test('unusable replies add nothing: garbage, empty array, malformed json, an unanswered call', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  for (const reply of ['sorry I cannot', '[]', '[{"kind":"decision","text":"x"', '{"kind":"decision"}', ']['] ) {
    plan.reply = reply
    await finish($)
  }
  plan.answered = false
  await finish($)
  expect(seen.prompts).toHaveLength(6)
  expect((await noticeTexts($)).filter(x => x.startsWith('📝'))).toEqual([])
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('malformed items are dropped, text is trimmed and capped at 300, and at most five are kept', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  plan.reply =
    'Here you go:\n```json\n' +
    JSON.stringify([
      { kind: 'decision', text: '  padded  ' },
      { kind: 'opinion', text: 'bad kind' },
      { kind: 'decision', text: 42 },
      { kind: 'assumption', text: '   ' },
      null,
      'text',
      { kind: 'assumption', text: 'z'.repeat(400) },
      { kind: 'decision', text: 'd3' },
      { kind: 'decision', text: 'd4' },
      { kind: 'decision', text: 'd5' },
      { kind: 'decision', text: 'd6' },
      { kind: 'decision', text: 'd7' },
    ]) +
    '\n```'
  await finish($)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('padded')
  expect(out).not.toContain('bad kind')
  expect(out).toContain('z'.repeat(300))
  expect(out).not.toContain('z'.repeat(301))
  expect(out).toContain('d5')
  expect(out).not.toContain('d6')
  expect(await noticeTexts($)).toContain('📝 4 decisions, 1 assumption this turn')
  await ui.unmount()
})

test('answers of 300 characters or fewer skip the model but still count a turn; other reasons are ignored', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  await finish($, 'x'.repeat(300))
  expect(seen.prompts).toHaveLength(0)
  await finish($, 'x'.repeat(301))
  expect(seen.prompts).toHaveLength(1)
  await finish($, LONG, { reason: 'aborted', isAborted: true })
  await finish($, LONG, { reason: 'error' })
  await finish($, LONG, { agentId: 'ag1' })
  expect(seen.prompts).toHaveLength(1)
  plan.reply = items([{ kind: 'decision', text: 'third answer item' }])
  await finish($)
  const ui = await openPane($)
  // answers 1 and 2 counted turns 1 and 2, so this is turn 3
  expect(await texts(ui)).toContain('Turn 3')
  await ui.unmount()
})

test('very long answers are cut to 6000 characters in the prompt', SLOW, async ($, on) => {
  const { seen } = boot(on, ON)
  await start($)
  await finish($, 'a'.repeat(9000))
  const p = seen.prompts[0]!.prompt
  expect(p.endsWith('a'.repeat(6000))).toBe(true)
  expect(p.includes('a'.repeat(6001))).toBe(false)
})

test('the pane: dismiss removes one item, clear removes all, turns are headed newest first', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'decision', text: 'first A' }, { kind: 'assumption', text: 'first B' }])
  await finish($)
  plan.reply = items([{ kind: 'decision', text: 'second A' }])
  await finish($)

  const ui = await openPane($)
  let out = await texts(ui)
  expect(out.indexOf('Turn 2')).toBeLessThan(out.indexOf('second A'))
  expect(out.indexOf('second A')).toBeLessThan(out.indexOf('Turn 1'))
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string)
  expect(keys).toEqual(['clear-all', 'dismiss-d3', 'dismiss-d2', 'dismiss-d1'])

  await ui.press({ key: 'dismiss-d3' })
  out = await texts(ui)
  expect(out).not.toContain('second A')
  expect(out).not.toContain('Turn 2')
  expect(out).toContain('first A')

  await ui.press({ key: 'dismiss-d1' })
  out = await texts(ui)
  expect(out).not.toContain('first A')
  expect(out).toContain('first B')

  await ui.press({ key: 'clear-all' })
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('clear all empties a longer ledger and ids keep growing afterwards', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'decision', text: 'a' }, { kind: 'decision', text: 'b' }])
  await finish($)
  const ui = await openPane($)
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['clear-all', 'dismiss-d2', 'dismiss-d1'])
  await ui.press({ key: 'clear-all' })
  plan.reply = items([{ kind: 'assumption', text: 'c' }])
  await finish($)
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['clear-all', 'dismiss-d3'])
  await ui.unmount()
})

test('the ledger keeps the newest 100 items', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  for (let n = 0; n < 22; n++) {
    plan.reply = items([1, 2, 3, 4, 5].map(i => ({ kind: 'decision', text: `t${n}-${i}` })))
    await finish($)
  }
  const ui = await openPane($)
  const buttons = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string)
  // the header's clear button first, then the newest 19 rows (viewport rows 25 - 6)
  expect(buttons[0]).toBe('clear-all')
  expect(buttons[1]).toBe('dismiss-d110')
  expect(buttons).toHaveLength(20)
  await ui.unmount()
})

test('the pane draws on the terminal too', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'assumption', text: 'Terminal item' }])
  await finish($)
  const ui = await openPane($, 'terminal')
  const out = await texts(ui)
  expect(out).toContain('Terminal item')
  expect(out).toContain('assumption')
  await ui.press({ key: 'clear-all' })
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('turning the feature off later hides the ledger behind the off text', SLOW, async ($, on) => {
  const { seen } = boot(on, { enabled: { 'decision-ledger': false } })
  await start($)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/a.ts', old_string: 'a', new_string: 'b' })
  await finish($)
  expect(seen.prompts).toHaveLength(0)
  expect((await $.command.run({ command: 'decisions', args: '' })).text).toBe('Decision ledger is turned off in the Toolkitty pane.')
})

test('Hebrew: the prompt asks for Hebrew; command, toast and pane are in Hebrew', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, { ...ON, language: 'he' })
  await start($)
  expect((await $.command.run({ command: 'decisions', args: '' })).text).toMatch(/[א-ת]/)
  plan.reply = items([{ kind: 'decision', text: 'בחרתי מפה' }, { kind: 'assumption', text: 'הנחתי Node 20' }])
  await finish($)
  expect(seen.prompts[0]!.prompt).toContain('Write each "text" in Hebrew.')
  expect((await noticeTexts($)).some(x => x.startsWith('📝') && /[א-ת]/.test(x))).toBe(true)
  const ui = await openPane($)
  const out = await texts(ui)
  expect(out).toContain('תור 1')
  expect(out).toContain('החלטה')
  expect(out).toContain('הנחה')
  expect(out).toContain('בחרתי מפה')
  const clear = await ui.find({ key: 'clear-all' })
  expect(clear?.props['label']).toBe('נקה')
  await ui.unmount()
})

test('a model call that throws is swallowed and the ledger stays as it was', SLOW, async ($, on) => {
  const { seen, plan } = boot(on, ON)
  await start($)
  plan.throws = true
  await finish($)
  plan.throws = false
  expect((await noticeTexts($)).filter(x => /decision-ledger|📝/.test(x))).toEqual([])
  const ui = await openPane($)
  expect(await texts(ui)).toEqual(EMPTY)
  await ui.unmount()
})

test('the pane header: the count as status, and Clear is a header action ahead of the rows', SLOW, async ($, on) => {
  const { plan } = boot(on, ON)
  await start($)
  plan.reply = items([{ kind: 'decision', text: 'Chose X' }, { kind: 'assumption', text: 'Assumed Y' }])
  await finish($)
  const ui = await openPane($)
  expect((await texts(ui)).slice(0, 3)).toEqual(['◔', 'Decisions', '2 recorded'])
  const first = (await ui.findAll({ type: 'Button' }))[0]
  expect(first.key).toBe('clear-all')
  expect(first.props['label']).toBe('clear')
  // a row is pressable as a whole and colored by kind: decision info, assumption warn
  const rows = await ui.findAll({ type: 'Button' })
  expect(rows.map((b: any) => b.key)).toEqual(['clear-all', 'dismiss-d2', 'dismiss-d1'])
  await ui.unmount()
})
