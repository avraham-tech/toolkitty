import { expect, mock, test } from 'claude-code/testing'

function setup(on: any, opts: { store?: Record<string, unknown>; fillOk?: () => boolean } = {}) {
  const registered: { name: string; argumentHint?: string }[] = []
  const filled: { text: string; mode?: string }[] = []
  mock.store(on, opts.store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string; argumentHint?: string }) => {
    registered.push({ name: e.name, argumentHint: e.argumentHint })
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('prompt.fill', (_: unknown, e: { text: string; mode?: string }) => {
    filled.push({ text: e.text, mode: e.mode })
    return (opts.fillOk?.() ?? true) ? { isFilled: true } : { isFilled: false, refusal: 'no_composer' }
  })
  return { registered, filled }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const hist = async ($: any, args = ''): Promise<string> => ((await $.command.run({ command: 'history', args })) as any).text
const send = ($: any, text: string, extra: Record<string, unknown> = {}) => $.prompt.submit({ text, ...extra })

test('loads and registers /history with its hint', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  const reg = s.registered.find(r => r.name === 'history')
  expect(reg).toBeTruthy()
  expect(reg!.argumentHint).toBe('[number]')
})

test('the hint is localized', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { language: 'he' } })
  await start($)
  expect(s.registered.find(r => r.name === 'history')?.argumentHint).toBe('[מספר]')
})

test('before any message: empty text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await hist($)).toBe('No messages have been sent in this session yet.')
  expect(await hist($, '   ')).toBe('No messages have been sent in this session yet.')
})

test('messages are listed newest first, numbered, with the restore hint', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await send($, 'first question')
  await send($, '  second question  ')
  await send($, 'third')
  expect(await hist($)).toBe(
    ['Latest messages (newest first):', '1. third', '2. second question', '3. first question', '', 'To put one back in the box: /history <number>'].join('\n'),
  )
})

test('long messages are cut at 60 characters with an ellipsis; whitespace and newlines are flattened', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await send($, 'x'.repeat(61))
  await send($, 'y'.repeat(60))
  await send($, 'line one\n\n   line   two\tend')
  const lines = (await hist($)).split('\n')
  expect(lines[1]).toBe('1. line one line two end')
  expect(lines[2]).toBe(`2. ${'y'.repeat(60)}`)
  expect(lines[3]).toBe(`3. ${'x'.repeat(60)}…`)
})

test('slash-prefixed, blank, command and meta prompts are not recorded', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await send($, '/clear')
  await send($, '/history 1')
  await send($, '   ')
  await send($, 'from a command', { command: { name: 'foo', args: 'x' } })
  await send($, 'meta text', { isMeta: true })
  expect(await hist($)).toBe('No messages have been sent in this session yet.')
  await send($, 'real one')
  expect((await hist($)).split('\n')[1]).toBe('1. real one')
})

test('only the last 50 are kept', { timeoutMs: 20000 }, async ($, on) => {
  setup(on)
  await start($)
  for (let i = 1; i <= 55; i++) await send($, `msg ${i}`)
  const lines = (await hist($)).split('\n')
  // header + 50 + blank + hint
  expect(lines.length).toBe(53)
  expect(lines[1]).toBe('1. msg 55')
  expect(lines[50]).toBe('50. msg 6')
})

test('/history N puts message N back in the box (replace mode)', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await send($, 'alpha')
  await send($, 'beta')
  expect(await hist($, '2')).toBe('Message 2 was put back in the box.')
  expect(s.filled).toEqual([{ text: 'alpha', mode: 'replace' }])
  expect(await hist($, ' 1 ')).toBe('Message 1 was put back in the box.')
  expect(s.filled[1]).toEqual({ text: 'beta', mode: 'replace' })
})

test('the full original text (with newlines, past 60 chars) is what goes back', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  const long = `line one\nline two ${'z'.repeat(80)}`
  await send($, long)
  await hist($, '1')
  expect(s.filled[0]!.text).toBe(long)
})

test('a message over 4000 characters is stored cut at 4000', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await send($, 'q'.repeat(5000))
  await hist($, '1')
  expect(s.filled[0]!.text.length).toBe(4000)
})

test('bad numbers say there is no such message', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await send($, 'only')
  expect(await hist($, '2')).toBe('There is no message number 2.')
  expect(await hist($, '0')).toBe('There is no message number 0.')
  expect(await hist($, '-1')).toBe('There is no message number -1.')
  expect(await hist($, 'abc')).toBe('There is no message number abc.')
  expect(await hist($, 'x1')).toBe('There is no message number x1.')
  expect(s.filled.length).toBe(0)
})

test('a number with trailing text is read leniently (current behaviour)', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  await send($, 'one')
  expect(await hist($, '1 please')).toBe('Message 1 was put back in the box.')
  expect(await hist($, '1.9')).toBe('Message 1 was put back in the box.')
  expect(s.filled.length).toBe(2)
})

test('when the box cannot be filled it says so', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { fillOk: () => false })
  await start($)
  await send($, 'one')
  expect(await hist($, '1')).toBe('The prompt box cannot be filled right now.')
})

test('Hebrew answers', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' } })
  await start($)
  expect(await hist($)).toBe('עוד לא נשלחו הודעות בסשן הזה.')
  await send($, 'שלום')
  expect(await hist($)).toBe(['ההודעות האחרונות (החדשה ראשונה):', '1. שלום', '', 'להחזרה לתיבה: /history <מספר>'].join('\n'))
  expect(await hist($, '1')).toBe('הודעה 1 הוחזרה לתיבה.')
  expect(await hist($, '4')).toBe('אין הודעה מספר 4.')
})

test('Hebrew: box cannot be filled', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' }, fillOk: () => false })
  await start($)
  await send($, 'a')
  expect(await hist($, '1')).toBe('לא ניתן למלא את תיבת הכתיבה כרגע.')
})

test('a snippet is recorded in its expanded form (the history hook runs after the snippets hook)', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await send($, '!explain closures')
  const out = await hist($)
  expect(out).toContain('1. Explain the following in simple terms, with a short example:')
})

test('off switch: command answers off, nothing recorded, prompts pass through', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { enabled: { 'prompt-history': false } } })
  await start($)
  expect(s.registered.map(r => r.name)).toContain('history')
  const r = (await send($, 'hello')) as any
  expect(r.text).toBe('hello')
  expect(await hist($)).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(await hist($, '1')).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(s.filled.length).toBe(0)
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he', enabled: { 'prompt-history': false } } })
  await start($)
  expect(await hist($)).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
