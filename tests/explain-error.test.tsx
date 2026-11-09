import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'

function boot(on: On, store: Record<string, unknown> = {}, fork: unknown = { isAnswered: true, text: 'It failed because X; fix Y.', usage: {} }) {
  const seen = { registered: [] as string[], prompts: [] as string[] }
  mock.store(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => {
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('model.fork', (_, e) => {
    seen.prompts.push(e.prompt)
    if (fork === 'throw') throw new Error('boom')
    return { value: fork as never }
  })
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const run = ($: any, args = '') => $.command.run({ command: 'explain', args })

test('registers /explain at session start', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('explain')
})

test('forks the conversation and returns the answer; the prompt names English by default', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  const r = await run($)
  expect(r.text).toBe('It failed because X; fix Y.')
  expect(seen.prompts).toHaveLength(1)
  expect(seen.prompts[0]).toContain('Explain in English')
  expect(seen.prompts[0]).toContain('most recent error')
})

test('arguments make no difference', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  const r = await run($, 'the npm one please')
  expect(r.text).toBe('It failed because X; fix Y.')
  expect(seen.prompts).toHaveLength(1)
})

test('with language he the prompt asks for Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { language: 'he' })
  await start($)
  await run($)
  expect(seen.prompts[0]).toContain('Explain in Hebrew')
  expect(seen.prompts[0]).not.toContain('Explain in English')
})

test('with other languages the prompt names them', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { language: 'ru' })
  await start($)
  await run($)
  expect(seen.prompts[0]).toContain('Explain in Russian')
})

test('not answered: nothing to fork', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { isAnswered: false, reason: 'nothing-to-fork' })
  await start($)
  expect((await run($)).text).toBe('There is no conversation to explain from yet.')
})

test('not answered: other reasons are shown', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { isAnswered: false, reason: 'empty-reply', usage: {} })
  await start($)
  expect((await run($)).text).toBe('No answer was received from the model (empty-reply).')
})

test('not answered in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { isAnswered: false, reason: 'nothing-to-fork' })
  await start($)
  expect((await run($)).text).toBe('אין עדיין שיחה להסביר ממנה.')
})

test('a fork that throws answers the failure text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, 'throw')
  await start($)
  expect((await run($)).text).toBe('The explanation failed; try again.')
})

test('off switch: off text, no fork', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { 'explain-error': false } })
  await start($)
  expect(seen.registered).toContain('explain')
  expect((await run($)).text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(seen.prompts).toHaveLength(0)
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he', enabled: { 'explain-error': false } })
  await start($)
  expect((await run($)).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
