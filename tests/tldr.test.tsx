import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'
const LONG = 'word '.repeat(400) // 2000 characters
const OK = { isAnswered: true, text: '- one\n- two\n- three', usage: {} }

function boot(on: On, store: Record<string, unknown> = {}, model: unknown = OK) {
  const seen = { prompts: [] as string[], models: [] as string[] }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('model.complete', (_, e) => {
    if (!e.prompt.startsWith('Summarize the following answer')) return { value: { isAnswered: false, reason: 'empty-reply', usage: {} } as never }
    seen.prompts.push(e.prompt)
    seen.models.push(e.model)
    if (model === 'throw') throw new Error('boom')
    return { value: model as never }
  })
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const done = (answer: string, extra: Record<string, unknown> = {}) => ({
  answer,
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer' as const,
  ...extra,
})
const ON = { enabled: { tldr: true } }

test('is off by default: no model call and the answer is untouched', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  const r = await $.turn.complete(done(LONG))
  expect(r.text).toBe(LONG)
  expect(seen.prompts).toHaveLength(0)
})

test('on: a long answer gets a TL;DR appended, prompt asks for English', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, ON)
  await start($)
  const r = await $.turn.complete(done(LONG))
  expect(r.text).toBe(LONG + '\n\n**TL;DR**\n- one\n- two\n- three')
  expect(seen.prompts).toHaveLength(1)
  expect(seen.prompts[0]).toContain('Summarize the following answer in English in at most 3 short bullet points')
  expect(seen.prompts[0]).toContain(LONG)
  expect(seen.models[0]).toBe('claude-haiku-5-5')
})

test('language he: the prompt names Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { ...ON, language: 'he' })
  await start($)
  await $.turn.complete(done(LONG))
  expect(seen.prompts[0]).toContain('in Hebrew in at most 3')
})

test('other languages: the prompt names them', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { ...ON, language: 'es' })
  await start($)
  await $.turn.complete(done(LONG))
  expect(seen.prompts[0]).toContain('in Spanish in at most 3')
})

test('a short answer (1500 characters or fewer) is not summarized', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, ON)
  await start($)
  const short = 'x'.repeat(1500)
  expect((await $.turn.complete(done(short))).text).toBe(short)
  expect(seen.prompts).toHaveLength(0)
  const over = 'x'.repeat(1501)
  expect((await $.turn.complete(done(over))).text).toContain('**TL;DR**')
  expect(seen.prompts).toHaveLength(1)
})

test('a subagent turn is not summarized', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, ON)
  await start($)
  const r = await $.turn.complete(done(LONG, { agentId: 'a1' }))
  expect(r.text).toBe(LONG)
  expect(seen.prompts).toHaveLength(0)
})

test('model not answering leaves the answer alone', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON, { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: {} })
  await start($)
  expect((await $.turn.complete(done(LONG))).text).toBe(LONG)
})

test('model answering blank leaves the answer alone', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON, { isAnswered: true, text: '  \n ', usage: {} })
  await start($)
  expect((await $.turn.complete(done(LONG))).text).toBe(LONG)
})

test('model throwing leaves the answer alone', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, ON, 'throw')
  await start($)
  expect((await $.turn.complete(done(LONG))).text).toBe(LONG)
})

test('switched off again explicitly: nothing is sent', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { tldr: false } })
  await start($)
  expect((await $.turn.complete(done(LONG))).text).toBe(LONG)
  expect(seen.prompts).toHaveLength(0)
})
