import { expect, test } from 'claude-code/testing'

import { allText, bandLine, begin, boot, openDetail, SLOW } from './world'

const ID = 'dup-read-detector'
const QUIET = { 'loop-detective': false, 'output-archive': false, 'output-trimmer': false, 'injection-tripwire': false }
const store = (extra: Record<string, unknown> = {}, enabled: Record<string, boolean> = {}) => ({ enabled: { ...QUIET, ...enabled }, ...extra })
const OFF = 'The feature is off; turn it on in the /toolkitty pane'
const waste = ($: any) => $.command.run({ command: 'waste', args: '' })
const note = (path: string) =>
  `Toolkitty note: ${path} is unchanged since it was last read in this session, so it did not need to be read again. Rely on the earlier contents instead of re-reading it.`

const fileResult = (path: string) => ({
  result: { type: 'text', file: { filePath: path, content: 'hello', numLines: 1, startLine: 1, totalLines: 1 } },
  text: 'hello',
})

type Stat = { size?: number; mtimeMs?: number }
/** Steers the world: `mtimes[path]` is the file's modification time (0 = the stat gives none, so a content hash is used). */
function files(w: any, mtimes: Record<string, number> = {}, size = 4000) {
  w.toolResult = (e: any) => (e.tool === 'Read' ? fileResult(e.file_path) : { result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' })
  w.stat = (path: string) => {
    const key = path.split(String.fromCharCode(92)).join('/')
    return { kind: 'file', size, mtimeMs: mtimes[key] ?? 1000, isLink: false } satisfies Record<string, unknown> & Stat
  }
}

const read = ($: any, path: string, extra: Record<string, unknown> = {}) => $.tool.call({ tool: 'Read', file_path: path, ...extra })
const sh = ($: any, command: string, extra: Record<string, unknown> = {}) => $.tool.call({ tool: 'Bash', command, ...extra })

test('loads, registers /waste, shows nothing yet', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  expect(w.commands).toContain('waste')
  expect((await waste($)).text).toBe('No wasted context so far.')
  expect(await bandLine($, ID)).toBeUndefined()
  expect(w.toasts).toEqual([])
})

test('the first read passes silently; the same file read again unchanged gets a note and shows in the band', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  const first = await read($, 'C:/p/a.ts')
  expect(first.context).toBeUndefined()
  expect(await bandLine($, ID)).toBeUndefined()
  const second = await read($, 'C:/p/a.ts')
  expect(second.context).toEqual([note('C:/p/a.ts')])
  expect(second.result.file.content).toBe('hello')
  expect(await bandLine($, ID)).toBe('♻ 1 duplicate read')
  expect(await bandLine($, ID, 'terminal')).toBe('♻ 1 duplicate read')
  const third = await read($, 'C:/p/a.ts')
  expect(third.context).toEqual([note('C:/p/a.ts')])
  expect(await bandLine($, ID)).toBe('♻ 2 duplicate reads')
})

test('a read of a changed file (new modification time) is not a duplicate', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  const mt: Record<string, number> = { 'C:/p/a.ts': 1000 }
  files(w, mt)
  await read($, 'C:/p/a.ts')
  mt['C:/p/a.ts'] = 2000
  const second = await read($, 'C:/p/a.ts')
  expect(second.context).toBeUndefined()
  // and now the new version is the one remembered
  expect((await read($, 'C:/p/a.ts')).context).toEqual([note('C:/p/a.ts')])
})

test('a different range of the same file is a different read', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts', { offset: 1, limit: 50 })
  expect((await read($, 'C:/p/a.ts', { offset: 51, limit: 50 })).context).toBeUndefined()
  expect((await read($, 'C:/p/a.ts')).context).toBeUndefined()
  expect((await read($, 'C:/p/a.ts', { offset: 1, limit: 50 })).context).toEqual([note('C:/p/a.ts')])
})

test('when stat gives no time the content is hashed instead', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = (e: any) => fileResult(e.file_path)
  w.files['C:/p/b.ts'] = 'version one'
  w.stat = () => ({ kind: 'file', size: 11, mtimeMs: 0, isLink: false })
  await read($, 'C:/p/b.ts')
  expect((await read($, 'C:/p/b.ts')).context).toEqual([note('C:/p/b.ts')])
  w.files['C:/p/b.ts'] = 'version two!'
  expect((await read($, 'C:/p/b.ts')).context).toBeUndefined()
  expect((await read($, 'C:/p/b.ts')).context).toEqual([note('C:/p/b.ts')])
})

test('a file that cannot be stat-ed or read is never counted', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = (e: any) => fileResult(e.file_path)
  w.stat = () => {
    throw new Error('ENOENT')
  }
  await read($, 'C:/p/missing.ts')
  expect((await read($, 'C:/p/missing.ts')).context).toBeUndefined()
  expect(await bandLine($, ID)).toBeUndefined()
})

test('an errored or denied duplicate read gets no note', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  w.toolResult = () => ({ result: { type: 'text', file: { filePath: 'C:/p/a.ts', content: '', numLines: 0, startLine: 1, totalLines: 0 } }, text: '', isError: true })
  expect((await read($, 'C:/p/a.ts')).context).toBeUndefined()
  w.toolResult = () => ({ deny: 'nope' })
  expect((await read($, 'C:/p/a.ts')).deny).toBe('nope')
})

test('a repeated Bash command inside ten calls is counted; spacing variants are the same command', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await sh($, 'echo hello')
  expect(await bandLine($, ID)).toBeUndefined()
  await sh($, 'echo   hello ')
  expect(await bandLine($, ID)).toBe('♻ 1 repeated command')
  await sh($, 'echo hello')
  expect(await bandLine($, ID)).toBe('♻ 2 repeated commands')
  expect((await waste($)).text).toBe(['Commands repeated:', '  2× echo hello'].join('\n'))
})

test('a command repeated after more than ten other calls is not a repeat', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await sh($, 'echo far')
  for (let i = 0; i < 10; i++) await sh($, `echo filler ${i}`)
  // exactly ten calls between: 11 calls later -> outside the window
  await sh($, 'echo far')
  expect(await bandLine($, ID)).toBeUndefined()
  // but inside it, yes
  await sh($, 'echo near')
  await sh($, 'echo near')
  expect(await bandLine($, ID)).toBe('♻ 1 repeated command')
})

test('commands that are naturally repeated (git status, ls, tests, builds) are not counted', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  for (const c of ['git status', 'git status', 'git diff HEAD', 'git diff HEAD', 'ls -la', 'ls -la', 'pwd', 'pwd', 'npm test', 'npm test', 'pytest -q', 'pytest -q', 'tsc --noEmit', 'tsc --noEmit', 'npm run build', 'npm run build', 'eslint .', 'eslint .']) {
    await sh($, c)
  }
  expect(await bandLine($, ID)).toBeUndefined()
  // but git log is not natural
  await sh($, 'git log --oneline')
  await sh($, 'git log --oneline')
  expect(await bandLine($, ID)).toBe('♻ 1 repeated command')
})

test('reads and commands together in the band, and subagent calls are ignored', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts', { agentId: 'a1' })
  await read($, 'C:/p/a.ts', { agentId: 'a1' })
  await sh($, 'echo x', { agentId: 'a1' })
  await sh($, 'echo x', { agentId: 'a1' })
  expect(await bandLine($, ID)).toBeUndefined()
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  await sh($, 'echo y')
  await sh($, 'echo y')
  expect(await bandLine($, ID)).toBe('♻ 1 duplicate read · 1 repeated command')
})

test('/waste lists the top offenders, most repeated first, both kinds', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/b.ts')
  await read($, 'C:/p/b.ts')
  await read($, 'C:/p/b.ts')
  await sh($, 'cat notes.txt')
  await sh($, 'cat notes.txt')
  const text = (await waste($)).text
  expect(text.split('\n')).toEqual(['Files read again unchanged:', '  2× C:/p/b.ts', '  1× C:/p/a.ts', 'Commands repeated:', '  1× cat notes.txt'])
})

test('/waste shows at most five of each, and a long command is clipped', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  for (let i = 0; i < 7; i++) {
    await read($, `C:/p/f${i}.ts`)
    await read($, `C:/p/f${i}.ts`)
  }
  const long = `echo ${'z'.repeat(200)}`
  await sh($, long)
  await sh($, long)
  const lines = (await waste($)).text.split('\n')
  expect(lines.filter(l => /^ {2}1× C:\/p\//.test(l)).length).toBe(5)
  const cmdLine = lines[lines.length - 1] as string
  expect(cmdLine.startsWith('  1× echo zzz')).toBe(true)
  expect(cmdLine.endsWith('…')).toBe(true)
  expect(cmdLine.length).toBe('  1× '.length + 100)
})

test('a duplicate read is flagged in the savings meter, not counted as saved', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w, {}, 4000)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  const sv = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'savings',
    props: { title: 'Savings', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  const text = await allText(sv)
  // 4000 bytes / 4 = 1000 tokens flagged; the session total stays at zero
  expect(text).toContain('Duplicate read detector')
  expect(text).toContain('1.0k (flagged, not yet saved)')
  await sv.unmount()
})

test('a duplicate read of an unknown size is flagged at 2000 tokens', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  w.toolResult = (e: any) => fileResult(e.file_path)
  w.files['C:/p/c.ts'] = 'same'
  w.stat = () => ({ kind: 'file', size: 4, mtimeMs: 0, isLink: false })
  await read($, 'C:/p/c.ts')
  await read($, 'C:/p/c.ts')
  const sv = await $.ui.mount({
    plugin: 'toolkitty',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'savings',
    props: { title: 'Savings', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  })
  expect(await allText(sv)).toContain('2.0k (flagged, not yet saved)')
  await sv.unmount()
})

test('the detail pane lists the duplicate paths and repeated commands, most repeated first', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  await sh($, 'cat x.txt')
  await sh($, 'cat x.txt')
  const ui = await openDetail($, ID)
  const lines = (await allText(ui)).split('\n')
  const at = lines.indexOf('Files read again unchanged:')
  expect(lines.slice(at, at + 4)).toEqual(['Files read again unchanged:', '2× C:/p/a.ts', 'Commands repeated:', '1× cat x.txt'])
  await ui.unmount()
})

test('the detail pane with nothing to report', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  const ui = await openDetail($, ID)
  // wipe the state with a new session: the pane then has no rows
  await begin($, w)
  await ui.redraw()
  expect(await allText(ui)).toContain('No wasted context so far.')
  await ui.unmount()
})

test('a new session starts the count from zero', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  expect(await bandLine($, ID)).toBeDefined()
  await begin($, w)
  expect(await bandLine($, ID)).toBeUndefined()
  // and the file is "new" again
  expect((await read($, 'C:/p/a.ts')).context).toBeUndefined()
})

test('hebrew: band, command and headings', SLOW, async ($, on) => {
  const w = boot(on, store({ language: 'he' }))
  await begin($, w)
  files(w)
  expect((await waste($)).text).toBe('עדיין אין בזבוז הקשר.')
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  await sh($, 'echo q')
  await sh($, 'echo q')
  await sh($, 'echo q')
  expect(await bandLine($, ID)).toBe('♻ 1 קריאה כפולה · 2 פקודות חוזרות')
  expect((await waste($)).text.split('\n')[0]).toBe('קבצים שנקראו שוב ללא שינוי:')
  expect((await waste($)).text).toContain('פקודות שחזרו:')
})

test('off switch: reads and commands pass untouched, no band, the command says it is off', SLOW, async ($, on) => {
  const w = boot(on, store({}, { [ID]: false }))
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  expect((await read($, 'C:/p/a.ts')).context).toBeUndefined()
  await sh($, 'echo z')
  await sh($, 'echo z')
  expect(await bandLine($, ID)).toBeUndefined()
  expect((await waste($)).text).toBe(OFF)
})

test('detail pane buttons: the switch turns detection off and on, close dismisses', SLOW, async ($, on) => {
  const w = boot(on, store())
  await begin($, w)
  files(w)
  await read($, 'C:/p/a.ts')
  await read($, 'C:/p/a.ts')
  const ui = await openDetail($, ID)
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn off')
  await ui.press({ key: 'detail-toggle' })
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  expect(await bandLine($, ID)).toBeUndefined()
  await ui.press({ key: 'detail-toggle' })
  expect(await bandLine($, ID)).toBe('♻ 1 duplicate read')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})
