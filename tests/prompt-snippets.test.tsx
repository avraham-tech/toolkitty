import { expect, mock, test } from 'claude-code/testing'

let DATA = new Map<string, unknown>()
function memStore(on: any, entries: Record<string, unknown> = {}) {
  DATA = new Map(Object.entries(entries))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: DATA.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    DATA.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: unknown, e: { key: string }) => {
    DATA.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...DATA.keys()] }))
}
const readStore = async (key: string): Promise<unknown> => DATA.get(key)

const KEY = 'prompt-snippets:custom'

const FIX =
  'Find the root cause of the following problem and fix it with the smallest correct change; run the relevant tests after:'
const REVIEW =
  'Review the current diff for bugs, missing edge cases and security problems; list findings by severity before changing anything:'
const TEST = 'Write tests for the following, covering the happy path and the edge cases, then run them:'
const EXPLAIN = 'Explain the following in simple terms, with a short example:'
const REFACTOR = 'Refactor the following without changing behaviour; keep the diff small and run the tests:'

function setup(on: any, store?: Record<string, unknown>) {
  const registered: { name: string; argumentHint?: string; description?: string }[] = []
  memStore(on, store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string; argumentHint?: string; description?: string }) => {
    registered.push({ name: e.name, argumentHint: e.argumentHint, description: e.description })
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  return { registered }
}

const start = ($: any) => $.session.start({ cwd: 'C:/tmp/project', surface: 'desktop', isInteractive: true })
const snip = async ($: any, args: string): Promise<string> => ((await $.command.run({ command: 'snippet', args })) as any).text
const submit = async ($: any, text: string, extra: Record<string, unknown> = {}): Promise<string> =>
  ((await $.prompt.submit({ text, ...extra })) as any).text

test('loads and registers /snippet with a hint', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  const reg = s.registered.find(r => r.name === 'snippet')
  expect(reg).toBeTruthy()
  expect(reg!.argumentHint).toBe('add|list|remove')
  expect(reg!.description).toBe('Manage prompt snippets: add <name> <text> | list | remove <name>')
})

test('/snippet with no args lists built-ins, says no custom, and shows usage', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const out = await snip($, '')
  expect(out).toContain('Built-in snippets:')
  expect(out).toContain(`• !fix — ${FIX}`)
  expect(out).toContain(`• !review — ${REVIEW}`)
  expect(out).toContain(`• !test — ${TEST}`)
  expect(out).toContain(`• !explain — ${EXPLAIN}`)
  expect(out).toContain(`• !refactor — ${REFACTOR}`)
  expect(out).toContain('No custom snippets.')
  expect(out).toContain('Usage: /snippet add <name> <text> | list | remove <name>')
})

test('/snippet list is the same without the usage line', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  const out = await snip($, 'list')
  expect(out).toContain('Built-in snippets:')
  expect(out).toContain('No custom snippets.')
  expect(out).not.toContain('Usage:')
})

test('/snippet add saves, list shows it, a bad form shows usage', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await snip($, 'add hi say hello to the user')).toBe('Snippet !hi saved.')
  expect(await readStore(KEY)).toEqual({ hi: 'say hello to the user' })
  const out = await snip($, 'list')
  expect(out).toContain('Custom snippets:')
  expect(out).toContain('• !hi — say hello to the user')
  expect(out).not.toContain('No custom snippets.')
  const usageAdd = 'Usage: /snippet add <name> <text>'
  expect(await snip($, 'add')).toBe(usageAdd)
  expect(await snip($, 'add onlyname')).toBe(usageAdd)
  expect(await snip($, 'add onlyname    ')).toBe(usageAdd)
  expect(await snip($, 'add bad.name some text')).toBe(usageAdd)
  expect(await snip($, 'add !!x text')).toBe(usageAdd)
})

test('/snippet add normalises the name (leading !, case) and keeps the text spacing after the name', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await snip($, 'add !MyThing  keep   inner   spaces ')).toBe('Snippet !mything saved.')
  expect(await readStore(KEY)).toEqual({ mything: 'keep   inner   spaces' })
})

test('/snippet add overwrites a custom snippet and can shadow a built-in', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await snip($, 'add x one')
  await snip($, 'add x two')
  expect(await readStore(KEY)).toEqual({ x: 'two' })
  expect(await snip($, 'add fix my own fix')).toBe('Snippet !fix saved.')
  expect(await submit($, '!fix thing')).toBe('my own fix thing')
  // removing the custom one brings the built-in back
  expect(await snip($, 'remove fix')).toBe('Snippet !fix deleted.')
  expect(await submit($, '!fix thing')).toBe(`${FIX} thing`)
})

test('/snippet add cuts the text at 2000 characters', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await snip($, `add long ${'a'.repeat(2500)}`)
  const saved = (await readStore(KEY)) as Record<string, string>
  expect(saved['long']!.length).toBe(2000)
})

test('at most 50 custom snippets; overwriting an existing one is still allowed at the limit', { timeoutMs: 30_000 }, async ($, on) => {
  const many: Record<string, string> = {}
  for (let i = 1; i <= 50; i++) many[`s${i}`] = `text ${i}`
  setup(on, { [KEY]: many })
  await start($)
  expect(await snip($, 'add extra more')).toBe('You have reached the limit of 50 snippets; delete one first.')
  expect(await snip($, 'add s7 changed')).toBe('Snippet !s7 saved.')
  expect(((await readStore(KEY)) as Record<string, string>)['s7']).toBe('changed')
})

test('/snippet remove: custom is deleted, built-in refused, unknown reported, empty name reported', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await snip($, 'add gone bye')
  expect(await snip($, 'remove !GONE')).toBe('Snippet !gone deleted.')
  expect(await readStore(KEY)).toEqual({})
  expect(await snip($, 'remove gone')).toBe('There is no snippet named !gone.')
  expect(await snip($, 'remove fix')).toBe('A built-in snippet cannot be deleted.')
  expect(await snip($, 'remove')).toBe('There is no snippet named !.')
})

test('an unknown subcommand shows usage (case matters)', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await snip($, 'wat')).toBe('Usage: /snippet add <name> <text> | list | remove <name>')
  expect(await snip($, 'ADD x y')).toBe('Usage: /snippet add <name> <text> | list | remove <name>')
})

test('a built-in snippet expands at the start of a prompt with and without trailing text', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await submit($, '!fix')).toBe(FIX)
  expect(await submit($, '!fix the login crash')).toBe(`${FIX} the login crash`)
  expect(await submit($, '   !review')).toBe(REVIEW)
  expect(await submit($, '!test the parser')).toBe(`${TEST} the parser`)
  expect(await submit($, '!explain closures')).toBe(`${EXPLAIN} closures`)
  expect(await submit($, '!refactor utils')).toBe(`${REFACTOR} utils`)
  expect(await submit($, '!FIX loud')).toBe(`${FIX} loud`)
  expect(await submit($, '!fix   spaced   out  ')).toBe(`${FIX} spaced   out`)
  expect(await submit($, '!fix line one\nline two')).toBe(`${FIX} line one\nline two`)
})

test('prompts that are not snippets pass unchanged', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  for (const text of ['hello', 'please !fix this', '!nosuch thing', '!', '! fix', '!fix.', 'a!fix', '']) {
    expect(await submit($, text)).toBe(text)
  }
})

test('a custom snippet expands, also with a Hebrew name', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  await snip($, 'add greet Say hi to')
  await snip($, 'add תיקון תקן את')
  expect(await submit($, '!greet Dana')).toBe('Say hi to Dana')
  expect(await submit($, '!תיקון הבאג')).toBe('תקן את הבאג')
  expect(await submit($, '!greet')).toBe('Say hi to')
})

test('a prompt that came from a slash command is not expanded', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await submit($, '!fix thing', { command: { name: 'foo', args: '!fix thing' } })).toBe('!fix thing')
})

test('Hebrew answers', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he' })
  await start($)
  const list = await snip($, 'list')
  expect(list).toContain('קיצורים מובנים:')
  expect(list).toContain('אין קיצורים מותאמים אישית.')
  expect(await snip($, 'add a b')).toBe('הקיצור !a נשמר.')
  expect(await snip($, 'list')).toContain('קיצורים מותאמים אישית:')
  expect(await snip($, 'add a')).toBe('שימוש: /snippet add <שם> <טקסט>')
  expect(await snip($, 'remove zz')).toBe('אין קיצור בשם !zz.')
  expect(await snip($, 'remove fix')).toBe('אי אפשר למחוק קיצור מובנה.')
  expect(await snip($, 'remove a')).toBe('הקיצור !a נמחק.')
  expect(await snip($, 'huh')).toBe('שימוש: /snippet add <שם> <טקסט> | list | remove <שם>')
})

test('off switch: command answers off, prompts pass through unexpanded', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { enabled: { 'prompt-snippets': false }, [KEY]: { hi: 'hello there' } })
  await start($)
  expect(s.registered.map(r => r.name)).toContain('snippet')
  expect(await snip($, 'list')).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(await snip($, 'add x y')).toBe('The feature is off; turn it on in the /toolkitty pane')
  expect(await readStore(KEY)).toEqual({ hi: 'hello there' })
  expect(await submit($, '!fix thing')).toBe('!fix thing')
  expect(await submit($, '!hi')).toBe('!hi')
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { language: 'he', enabled: { 'prompt-snippets': false } })
  await start($)
  expect(await snip($, '')).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
