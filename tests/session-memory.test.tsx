import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = 'C:/tmp/project'
const ID = 'toolkitty:session-memory'
const PROMPTS_KEY = `session-memory:${CWD}`
const NOTES_KEY = `session-memory:notes:${CWD}`

function boot(on: On, store: Record<string, unknown> = {}) {
  const seen = { registered: [] as string[], invalidated: [] as string[], mem: null as unknown as Map<string, unknown> }
  const mem = new Map<string, unknown>(Object.entries(store))
  seen.mem = mem
  on('store.get', (_, e) => ({ value: mem.get(e.key) }))
  on('store.set', (_, e) => {
    mem.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    mem.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...mem.keys()] }))
  mock.clock(on, { now: 1000 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  on('command.register', (_, e) => {
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', (_, e) => {
    seen.invalidated.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.compose', () => ({ sections: [{ id: 'base', text: 'base', scope: 'shared' }] }))
  return seen
}

const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const compose = ($: any) =>
  $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] }) as Promise<{
    sections: { id: string; text: string; scope: string }[]
  }>
const memorySection = async ($: any) => (await compose($)).sections.find(s => s.id === ID)
const say = ($: any, text: string, extra: Record<string, unknown> = {}) => $.turn.start({ text, turnId: 't' + Math.random(), ...extra })
const remember = ($: any, args: string) => $.command.run({ command: 'remember', args })
let current: { mem: Map<string, unknown> }
const stored = async (_$: any, key: string) => current.mem.get(key) as { at: number; text: string }[] | undefined

test('registers /remember and adds no section when nothing is remembered', { timeoutMs: 30000 }, async ($, on) => {
  const seen = (current = boot(on))
  await start($)
  expect(seen.registered).toContain('remember')
  const sections = (await compose($)).sections
  expect(sections.map(s => s.id)).toEqual(['base'])
})

test('/remember without text shows the usage', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on)
  await start($)
  expect((await remember($, '')).text).toBe('Usage: /remember <note>')
  expect((await remember($, '   ')).text).toBe('Usage: /remember <note>')
  expect(await stored($, NOTES_KEY)).toBeUndefined()
})

test('/remember saves a note, counts, persists, and shows it to the model', { timeoutMs: 30000 }, async ($, on) => {
  const seen = (current = boot(on))
  await start($)
  expect((await remember($, '  use pnpm, not npm  ')).text).toBe('Saved (1 note in this folder).')
  expect((await remember($, 'tests live in /spec')).text).toBe('Saved (2 notes in this folder).')
  expect(await stored($, NOTES_KEY)).toEqual([
    { at: 1000, text: 'use pnpm, not npm' },
    { at: 1000, text: 'tests live in /spec' },
  ])
  const section = await memorySection($)
  expect(section?.scope).toBe('session')
  expect(section?.text).toBe(
    '# Earlier work in this folder\nNotes the user asked to remember:\n- use pnpm, not npm\n- tests live in /spec',
  )
  expect(seen.invalidated.some(s => s.includes('prompt.section'))).toBe(true)
})

test('a long note is cut to 400 characters; only the last 30 notes are kept', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on)
  await start($)
  await remember($, 'n'.repeat(500))
  expect((await stored($, NOTES_KEY))?.[0]?.text).toHaveLength(400)
  for (let i = 0; i < 35; i++) await remember($, `note ${i}`)
  const notes = await stored($, NOTES_KEY)
  expect(notes).toHaveLength(30)
  expect(notes?.[0]?.text).toBe('note 5')
  expect(notes?.[29]?.text).toBe('note 34')
})

test('prompts of this session are stored, but only shown from the next session', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on)
  await start($)
  await say($, 'first prompt')
  await say($, 'second prompt')
  expect((await stored($, PROMPTS_KEY))?.map(p => p.text)).toEqual(['first prompt', 'second prompt'])
  expect(await memorySection($)).toBeUndefined()

  // a new session in the same folder
  await start($)
  const section = await memorySection($)
  expect(section?.text).toBe(
    '# Earlier work in this folder\nRecent prompts from previous sessions (oldest first):\n- first prompt\n- second prompt',
  )
  await say($, 'third prompt')
  // the third belongs to this session: not shown yet
  expect((await memorySection($))?.text).not.toContain('third prompt')
})

test('earlier sessions are read from the store: notes first, then the last 10 prompts', { timeoutMs: 30000 }, async ($, on) => {
  const prompts = Array.from({ length: 14 }, (_, i) => ({ at: i, text: `p${i}` }))
  current = boot(on, { [PROMPTS_KEY]: prompts, [NOTES_KEY]: [{ at: 1, text: 'remember me' }] })
  await start($)
  const text = (await memorySection($))?.text ?? ''
  const lines = text.split('\n')
  expect(lines[0]).toBe('# Earlier work in this folder')
  expect(lines[1]).toBe('Notes the user asked to remember:')
  expect(lines[2]).toBe('- remember me')
  expect(lines[3]).toBe('Recent prompts from previous sessions (oldest first):')
  expect(lines.slice(4)).toEqual(['- p4', '- p5', '- p6', '- p7', '- p8', '- p9', '- p10', '- p11', '- p12', '- p13'])
})

test('another folder is not mixed in', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on, { 'session-memory:C:/other': [{ at: 1, text: 'elsewhere' }] })
  await start($)
  expect(await memorySection($)).toBeUndefined()
})

test('a long prompt is cut to 200 characters; blank prompts and subagent prompts are not stored', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on)
  await start($)
  await say($, 'x'.repeat(300))
  await say($, '   ')
  await say($, 'from a subagent', { agentId: 'a1' })
  const list = await stored($, PROMPTS_KEY)
  expect(list).toHaveLength(1)
  expect(list?.[0]?.text).toHaveLength(200)
})

test('only the last 30 prompts are kept and the "this session" boundary moves with them', { timeoutMs: 30000 }, async ($, on) => {
  const old = Array.from({ length: 29 }, (_, i) => ({ at: i, text: `old${i}` }))
  current = boot(on, { [PROMPTS_KEY]: old })
  await start($)
  for (let i = 0; i < 4; i++) await say($, `new${i}`)
  const list = await stored($, PROMPTS_KEY)
  expect(list).toHaveLength(30)
  expect(list?.[0]?.text).toBe('old3')
  expect(list?.[29]?.text).toBe('new3')
  // only previous-session prompts show (last ten of the 26 old ones that remain)
  const text = (await memorySection($))?.text ?? ''
  expect(text).toContain('- old28')
  expect(text).not.toContain('new')
})

test('the section is replaced, not duplicated, when compose runs again', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on, { [NOTES_KEY]: [{ at: 1, text: 'n1' }] })
  await start($)
  await compose($)
  const sections = (await compose($)).sections.filter(s => s.id === ID)
  expect(sections).toHaveLength(1)
})

test('Hebrew command texts', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on, { language: 'he' })
  await start($)
  expect((await remember($, '')).text).toBe('שימוש: /remember <הערה>')
  expect((await remember($, 'חשוב')).text).toBe('נשמרה הערה אחת בתיקייה הזו.')
})

test('off switch: command says off, nothing stored, no section', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on, { enabled: { 'session-memory': false }, [NOTES_KEY]: [{ at: 1, text: 'n1' }] })
  await start($)
  expect((await remember($, 'x')).text).toBe('This feature is off; turn it on in the /toolkitty panel')
  await say($, 'a prompt')
  expect(await stored($, PROMPTS_KEY)).toBeUndefined()
  expect(await memorySection($)).toBeUndefined()
})

test('off switch in Hebrew', { timeoutMs: 30000 }, async ($, on) => {
  current = boot(on, { language: 'he', enabled: { 'session-memory': false } })
  await start($)
  expect((await remember($, 'x')).text).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})
