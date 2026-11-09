import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'

type Opts = { copy?: { isCopied: true } | { isCopied: false; reason: string } }

function boot(on: On, store: Record<string, unknown> = {}, opts: Opts = {}) {
  const seen = { registered: [] as string[], copied: [] as string[] }
  refusal = null
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
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.copy', (_, e) => {
    seen.copied.push(e.text)
    return { value: (opts.copy ?? { isCopied: true }) as never }
  })
  return seen
}

/** Everything Toolkitty noticed, as the notices pane draws it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'toolkitty', surface: 'desktop', component: 'Pane', requestId: 'toolkitty-notices', props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

/** The harness' command.register answer refuses this name (the engine: a built-in or another plugin owns it). */
let refusal: { name: string; how: 'deny' | 'throw' } | null = null

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const done = (answer: string, extra: Record<string, unknown> = {}) => ({
  answer,
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer' as const,
  ...extra,
})

const ANSWER = 'Here is code:\n```ts\nconst a = 1\n```\nand more:\n```sh\nnpm test\nnpm run build\n```\nbye'

test('registers /copy-last at session start', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('copy-last')
})

test('renamed: /copy is no longer registered, /copy-last is', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect(seen.registered).toContain('copy-last')
  expect(seen.registered).not.toContain('copy')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /copy-last registration (${how}) warns and the rest of session start still runs`, { timeoutMs: 30000 }, async ($, on) => {
    const seen = boot(on)
    refusal = { name: 'copy-last', how }
    await start($)
    expect(seen.registered).not.toContain('copy-last')
    expect(seen.registered.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /copy-last could not be registered: '))).toBe(true)
    await $.turn.complete(done('hello'))
    expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('Copied')
  })
}

test('nothing to copy before any answer, for both argument forms', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('No answer to copy yet.')
  expect((await $.command.run({ command: 'copy-last', args: 'code' })).text).toBe('No answer to copy yet.')
  expect(seen.copied).toHaveLength(0)
})

test('/copy-last copies the whole last answer', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done(ANSWER))
  const r = await $.command.run({ command: 'copy-last', args: '' })
  expect(r.text).toBe('Copied')
  expect(seen.copied).toEqual([ANSWER])
})

test('/copy-last code copies only the last code block, case and spaces insensitive', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done(ANSWER))
  expect((await $.command.run({ command: 'copy-last', args: 'code' })).text).toBe('Copied')
  expect((await $.command.run({ command: 'copy-last', args: '  CODE ' })).text).toBe('Copied')
  expect(seen.copied).toEqual(['npm test\nnpm run build', 'npm test\nnpm run build'])
})

test('an unknown argument copies the whole answer', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done(ANSWER))
  await $.command.run({ command: 'copy-last', args: 'banana' })
  expect(seen.copied).toEqual([ANSWER])
})

test('/copy-last code with no code block in the answer', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done('just prose'))
  expect((await $.command.run({ command: 'copy-last', args: 'code' })).text).toBe('No code block found in the last answer.')
  expect(seen.copied).toHaveLength(0)
})

test('the newest answer wins; blank answers and subagent answers are ignored', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done('first'))
  await $.turn.complete(done('   '))
  await $.turn.complete(done('from a subagent', { agentId: 'a1' }))
  await $.command.run({ command: 'copy-last', args: '' })
  expect(seen.copied).toEqual(['first'])
  await $.turn.complete(done('second'))
  await $.command.run({ command: 'copy-last', args: '' })
  expect(seen.copied).toEqual(['first', 'second'])
})

test('a very long answer is cut to 50000 characters', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on)
  await start($)
  await $.turn.complete(done('x'.repeat(60000)))
  await $.command.run({ command: 'copy-last', args: '' })
  expect(seen.copied[0]).toHaveLength(50000)
})

test('an unknown failure reason is shown raw', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { copy: { isCopied: false, reason: 'other' } })
  await start($)
  await $.turn.complete(done('hello'))
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('Copy failed: other')
})

test('no-surface failure text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { copy: { isCopied: false, reason: 'no-surface' } })
  await start($)
  await $.turn.complete(done('hello'))
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('Copy failed: no screen is showing the session')
})

test('no-clipboard failure text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { copy: { isCopied: false, reason: 'no-clipboard' } })
  await start($)
  await $.turn.complete(done('hello'))
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('Copy failed: no clipboard available')
})

test('refused failure text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, {}, { copy: { isCopied: false, reason: 'refused' } })
  await start($)
  await $.turn.complete(done('hello'))
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('Copy failed: the copy was refused')
})

test('Hebrew texts', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' })
  await start($)
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('אין עדיין תשובה להעתקה.')
  await $.turn.complete(done('no code'))
  expect((await $.command.run({ command: 'copy-last', args: 'code' })).text).toBe('לא נמצא בלוק קוד בתשובה האחרונה.')
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('הועתק')
})

test('Hebrew failure text', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he' }, { copy: { isCopied: false, reason: 'refused' } })
  await start($)
  await $.turn.complete(done('hi'))
  expect((await $.command.run({ command: 'copy-last', args: '' })).text).toBe('ההעתקה נכשלה: ההעתקה נדחתה')
})

test('off switch: answers are not remembered and the command says off', { timeoutMs: 30000 }, async ($, on) => {
  const seen = boot(on, { enabled: { 'copy-last': false } })
  await start($)
  expect(seen.registered).toContain('copy-last')
  await $.turn.complete(done('hello'))
  const r = await $.command.run({ command: 'copy-last', args: '' })
  expect(r.text).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(seen.copied).toHaveLength(0)
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  boot(on, { language: 'he', enabled: { 'copy-last': false } })
  await start($)
  expect((await $.command.run({ command: 'copy-last', args: 'code' })).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
