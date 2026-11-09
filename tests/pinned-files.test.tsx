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

const CWD = 'C:/tmp/project'
const PROMPT_SECTION = { event: 'prompt.section' }
const SECTION = 'toolkitty:pinned-files'

type Files = Record<string, string>

function setup(on: any, opts: { store?: Record<string, unknown>; files?: Files; cwd?: { value: string }; refuse?: 'throw' | 'deny' } = {}) {
  const registered: { name: string; argumentHint?: string }[] = []
  const reads: string[] = []
  const invalidated: string[] = []
  const norm = (q: string) => q.split(String.fromCharCode(92)).join('/').replace(/^[A-Za-z]:/, '').toLowerCase()
  const files: Files = opts.files ?? {}
  const cwd = opts.cwd ?? { value: CWD }
  memStore(on, opts.store)
  mock.clock(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mock.session(on)
  on('command.register', (_: unknown, e: { name: string; argumentHint?: string }) => {
    registered.push({ name: e.name, argumentHint: e.argumentHint })
    const mine = ['pin', 'unpin', 'pins'].includes(e.name)
    if (mine && opts.refuse === 'throw') throw new Error('taken by the built-in')
    if (mine && opts.refuse === 'deny') return { deny: 'taken' }
    return { value: { command: e.name } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.invalidate', (_: unknown, e: unknown) => {
    invalidated.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: cwd.value }))
  on('fs.read', (_: unknown, e: { path: string }) => {
    reads.push(norm(e.path))
    const k = Object.keys(files).find(f => norm(f) === norm(e.path))
    const hit = k === undefined ? undefined : files[k]
    if (hit === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: hit }
  })
  on('turn.start', (_: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'other', text: 'other section', scope: 'shared' }] }))
  return { registered, reads, files, cwd, invalidated }
}

const compose = ($: any) => $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] })
const start = ($: any) => $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
const run = async ($: any, command: string, args: string): Promise<string> => ((await $.command.run({ command, args })) as any).text
const sectionOf = async ($: any) => {
  const r = (await compose($)) as any
  return (r.sections as { id: string; text: string; scope: string }[]).find(s => s.id === SECTION)
}

test('loads and registers /pin /unpin /pins with their hints', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on)
  await start($)
  const names = s.registered.map(r => r.name)
  expect(names).toContain('pin')
  expect(names).toContain('unpin')
  expect(names).toContain('pins')
  expect(s.registered.find(r => r.name === 'pin')?.argumentHint).toBe('<path>')
  expect(s.registered.find(r => r.name === 'unpin')?.argumentHint).toBe('<path>')
})

test('hints are localized', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { store: { language: 'he' } })
  await start($)
  expect(s.registered.find(r => r.name === 'pin')?.argumentHint).toBe('<נתיב>')
})

test('/pin with no path shows usage; /unpin and /pins too', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await run($, 'pin', '')).toBe('Usage: /pin <path>')
  expect(await run($, 'pin', '   ')).toBe('Usage: /pin <path>')
  expect(await run($, 'pin', '""')).toBe('Usage: /pin <path>')
  expect(await run($, 'unpin', '')).toBe('Usage: /unpin <path>')
  expect(await run($, 'pins', '')).toBe('No pinned files. Add one with /pin <path>.')
})

test('/pin a relative file resolves against the folder, pins it, and /pins lists it', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { files: { [`${CWD}/README.md`]: '# hello' } })
  await start($)
  expect(await run($, 'pin', 'README.md')).toBe('Pinned: README.md')
  expect(s.reads).toContain('/tmp/project/readme.md')
  expect(await run($, 'pins', '')).toBe('Pinned files:\n1. README.md')
  expect(await readStore(`pinned-files:${CWD}`)).toEqual(['README.md'])
  expect(s.invalidated).toContain(JSON.stringify(PROMPT_SECTION))
})

test('/pin an absolute path (windows and posix) is read as given', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { files: { 'C:\\w\\a.txt': 'A', '/etc/b.txt': 'B' } })
  await start($)
  expect(await run($, 'pin', 'C:\\w\\a.txt')).toBe('Pinned: C:\\w\\a.txt')
  expect(await run($, 'pin', '/etc/b.txt')).toBe('Pinned: /etc/b.txt')
  expect(s.reads).toContain('/w/a.txt')
  expect(s.reads).toContain('/etc/b.txt')
})

test('/pin strips surrounding quotes and tolerates spaces in the path', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { files: { [`${CWD}/my notes.md`]: 'x', [`${CWD}/q.md`]: 'q' } })
  await start($)
  expect(await run($, 'pin', '"my notes.md"')).toBe('Pinned: my notes.md')
  expect(await run($, 'pin', "'q.md'")).toBe('Pinned: q.md')
})

test('/pin a missing file is refused and not stored', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await run($, 'pin', 'nope.txt')).toBe('Cannot read nope.txt.')
  expect(await run($, 'pins', '')).toBe('No pinned files. Add one with /pin <path>.')
})

test('/pin the same file twice (any case or slash style) says already pinned', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { files: { [`${CWD}/Src/A.ts`]: 'x' } })
  await start($)
  expect(await run($, 'pin', 'Src/A.ts')).toBe('Pinned: Src/A.ts')
  expect(await run($, 'pin', 'Src/A.ts')).toBe('The file is already pinned.')
  expect(await run($, 'pin', 'src\\a.ts')).toBe('The file is already pinned.')
})

test('at most 5 files can be pinned', { timeoutMs: 30_000 }, async ($, on) => {
  const files: Files = {}
  for (let i = 1; i <= 6; i++) files[`${CWD}/f${i}.txt`] = `file ${i}`
  setup(on, { files })
  await start($)
  for (let i = 1; i <= 5; i++) expect(await run($, 'pin', `f${i}.txt`)).toBe(`Pinned: f${i}.txt`)
  expect(await run($, 'pin', 'f6.txt')).toBe('You can pin up to 5 files; remove one with /unpin.')
  expect((await run($, 'pins', '')).split('\n').length).toBe(6)
})

test('/unpin removes a pin (case/slash tolerant); unknown path says not pinned', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { files: { [`${CWD}/a.txt`]: 'a', [`${CWD}/b.txt`]: 'b' } })
  await start($)
  await run($, 'pin', 'a.txt')
  await run($, 'pin', 'b.txt')
  expect(await run($, 'unpin', 'zzz.txt')).toBe('zzz.txt is not pinned.')
  expect(await run($, 'unpin', '"A.TXT"')).toBe('Removed: A.TXT')
  expect(await run($, 'pins', '')).toBe('Pinned files:\n1. b.txt')
  expect(await readStore(`pinned-files:${CWD}`)).toEqual(['b.txt'])
  expect((await sectionOf($))?.text).not.toMatch(/a\.txt/)
})

test('pins are per folder', { timeoutMs: 30_000 }, async ($, on) => {
  const cwd = { value: CWD }
  setup(on, { files: { [`${CWD}/a.txt`]: 'a' }, cwd })
  await start($)
  await run($, 'pin', 'a.txt')
  cwd.value = 'C:/tmp/other'
  expect(await run($, 'pins', '')).toBe('No pinned files. Add one with /pin <path>.')
  cwd.value = CWD
  expect(await run($, 'pins', '')).toBe('Pinned files:\n1. a.txt')
})

test('the pinned files are injected into the prompt as a session section, beside the others', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { files: { [`${CWD}/a.txt`]: 'AAA content', [`${CWD}/b.txt`]: 'BBB content' } })
  await start($)
  await run($, 'pin', 'a.txt')
  await run($, 'pin', 'b.txt')
  const r = (await compose($)) as any
  const ids = r.sections.map((s: any) => s.id)
  expect(ids).toContain('other')
  expect(ids).toContain(SECTION)
  const sec = r.sections.find((s: any) => s.id === SECTION)
  expect(sec.scope).toBe('session')
  expect(sec.text.startsWith('# Pinned files')).toBe(true)
  expect(sec.text).toContain('## a.txt\nAAA content')
  expect(sec.text).toContain('## b.txt\nBBB content')
  // composing twice never duplicates the section
  const r2 = (await compose($)) as any
  expect(r2.sections.filter((s: any) => s.id === SECTION).length).toBe(1)
})

test('no pins: the prompt gets no section', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on)
  await start($)
  expect(await sectionOf($)).toBeUndefined()
})

test('the budget is shared: a huge file is cut, the section stays under 4000 characters, every file shows', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { files: { [`${CWD}/big.txt`]: 'x'.repeat(10_000), [`${CWD}/small.txt`]: 'tiny' } })
  await start($)
  await run($, 'pin', 'big.txt')
  await run($, 'pin', 'small.txt')
  const sec = await sectionOf($)
  expect(sec!.text.length).toBeLessThanOrEqual(3990)
  expect(sec!.text).toContain('## small.txt\ntiny')
  // 2 files: 1800 chars each at most
  const bigPart = sec!.text.split('## small.txt')[0]!
  expect(bigPart.length).toBeLessThan(1900)
})

test('five large files together stay under the cap', { timeoutMs: 30_000 }, async ($, on) => {
  const files: Files = {}
  for (let i = 1; i <= 5; i++) files[`${CWD}/f${i}.txt`] = String(i).repeat(5000)
  setup(on, { files })
  await start($)
  for (let i = 1; i <= 5; i++) await run($, 'pin', `f${i}.txt`)
  const sec = await sectionOf($)
  expect(sec!.text.length).toBeLessThanOrEqual(3990)
  for (let i = 1; i <= 5; i++) expect(sec!.text).toContain(`## f${i}.txt`)
})

test('a new turn re-reads the files so the model sees current contents', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { files: { [`${CWD}/a.txt`]: 'version one' } })
  await start($)
  await run($, 'pin', 'a.txt')
  expect((await sectionOf($))?.text).toContain('version one')
  s.files[`${CWD}/a.txt`] = 'version two'
  s.invalidated.length = 0
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect((await sectionOf($))?.text).toContain('version two')
  expect(s.invalidated).toContain(JSON.stringify(PROMPT_SECTION))
})

test('a subagent turn does not re-read', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { files: { [`${CWD}/a.txt`]: 'one' } })
  await start($)
  await run($, 'pin', 'a.txt')
  s.files[`${CWD}/a.txt`] = 'two'
  await $.turn.start({ text: 'go', turnId: 't2', agentId: 'ag' })
  expect((await sectionOf($))?.text).toContain('one')
})

test('a file that disappears is shown as unreadable instead of failing', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, { files: { [`${CWD}/a.txt`]: 'here' } })
  await start($)
  await run($, 'pin', 'a.txt')
  delete s.files[`${CWD}/a.txt`]
  await $.turn.start({ text: 'go', turnId: 't3' })
  expect((await sectionOf($))?.text).toContain('(file could not be read)')
})

test('pins stored by an earlier session are loaded when the session starts', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { [`pinned-files:${CWD}`]: ['old.txt'] }, files: { [`${CWD}/old.txt`]: 'from before' } })
  await start($)
  expect((await sectionOf($))?.text).toContain('from before')
})

test('Hebrew answers', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he' }, files: { [`${CWD}/a.txt`]: 'a' } })
  await start($)
  expect(await run($, 'pin', '')).toBe('שימוש: /pin <נתיב>')
  expect(await run($, 'pin', 'a.txt')).toBe('הוצמד: a.txt')
  expect(await run($, 'pin', 'a.txt')).toBe('הקובץ כבר מוצמד.')
  expect(await run($, 'pin', 'q.txt')).toBe('לא ניתן לקרוא את q.txt.')
  expect(await run($, 'pins', '')).toBe('קבצים מוצמדים:\n1. a.txt')
  expect(await run($, 'unpin', 'z')).toBe('z אינו מוצמד.')
  expect(await run($, 'unpin', 'a.txt')).toBe('הוסר: a.txt')
  expect(await run($, 'pins', '')).toBe('אין קבצים מוצמדים. הוסף עם /pin <נתיב>.')
  expect(await run($, 'unpin', '')).toBe('שימוש: /unpin <נתיב>')
})

test('off switch: commands answer off, the prompt is untouched, nothing is read', { timeoutMs: 30_000 }, async ($, on) => {
  const s = setup(on, {
    store: { enabled: { 'pinned-files': false }, [`pinned-files:${CWD}`]: ['a.txt'] },
    files: { [`${CWD}/a.txt`]: 'secret' },
  })
  await start($)
  const names = s.registered.map(r => r.name)
  for (const n of ['pin', 'unpin', 'pins']) expect(names).toContain(n)
  const off = 'The feature is off; turn it on in the /toolkitty pane'
  expect(await run($, 'pin', 'a.txt')).toBe(off)
  expect(await run($, 'unpin', 'a.txt')).toBe(off)
  expect(await run($, 'pins', '')).toBe(off)
  await $.turn.start({ text: 'go', turnId: 't1' })
  expect(await sectionOf($)).toBeUndefined()
  expect(s.reads.length).toBe(0)
})

test('off switch in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  setup(on, { store: { language: 'he', enabled: { 'pinned-files': false } } })
  await start($)
  expect(await run($, 'pins', '')).toBe('השכלול כבוי; הפעל אותו בלוח /toolkitty')
})

const noticeTexts = async ($: any): Promise<string[]> => {
  const ui = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'toolkitty-notices',
    props: { title: 'n', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

for (const refuse of ['throw', 'deny'] as const) {
  test(`a refused command registration (${refuse}) posts a warn notice per command and does not abort session start`, { timeoutMs: 30_000 }, async ($, on) => {
    const s = setup(on, {
      refuse,
      store: { [`pinned-files:${CWD}`]: ['old.txt'] },
      files: { [`${CWD}/old.txt`]: 'from before' },
    })
    await start($)
    expect(s.registered.map(r => r.name)).toEqual(expect.arrayContaining(['pin', 'unpin', 'pins']))
    const all = (await noticeTexts($)).join(' | ')
    for (const name of ['pin', 'unpin', 'pins']) expect(all).toContain(`The command /${name} could not be registered:`)
    // the rest of onSessionStart still ran: the earlier pins were loaded
    expect((await sectionOf($))?.text).toContain('from before')
  })
}
