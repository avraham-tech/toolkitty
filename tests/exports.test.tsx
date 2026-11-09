import { expect, test } from 'claude-code/testing'
import { NOON, PANE, SHOWN, SHOWN_FLAT, joined, labels, lastNotice, noticeTexts, start, svgOf, turnDone, turnStart, world } from './harness'

/*
 * The shared export actions (hooks/exports.tsx), driven through the panes that use them:
 * the turn receipt (a Placed row and its pane) and the context aquarium.
 */

const PLACED = (n: number, surface: 'desktop' | 'terminal' = 'desktop') =>
  ({ plugin: 'toolkitty', component: 'Placed', requestId: `receipt-${n}`, surface, props: { id: `receipt-${n}`, plugin: 'toolkitty' } }) as const

const USAGE = { input_tokens: 1000, output_tokens: 234, cache_read_input_tokens: 5000, cache_creation_input_tokens: 100, model: 'claude-sonnet-5-5' }
const BS = String.fromCharCode(92)
const STAMP = '2026-11-08-1200'
const DIR = 'C:/proj/toolkitty-exports'

async function busyTurn($: any, w: any, reads = 5): Promise<void> {
  w.usage.usd = 1
  await turnStart($)
  for (let i = 0; i < reads; i++) await $.tool.call({ tool: 'Read', file_path: `C:/proj/f${i}.ts` })
  w.usage.usd = 1.5
  await turnDone($, 2000, { usage: USAGE })
}

test('Save SVG writes receipt-<date>-<HHMM>.svg under toolkitty-exports and says "Saved <name>"', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  await ui.press({ key: 'exp-save-receipt' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/receipt-${STAMP}.svg`])
  expect(w.written[0]!.text.startsWith('<svg')).toBe(true)
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}receipt-${STAMP}.svg`)
  await ui.unmount()
})

test('a name that exists is never overwritten: -2, -3, and a file that was already there is skipped', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { files: { [`${DIR}/receipt-${STAMP}.svg`]: 'precious' } })
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  await ui.press({ key: 'exp-save-receipt' })
  await ui.press({ key: 'exp-save-receipt' })
  await ui.press({ key: 'exp-save-receipt' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/receipt-${STAMP}-2.svg`, `${DIR}/receipt-${STAMP}-3.svg`, `${DIR}/receipt-${STAMP}-4.svg`])
  expect(w.files[`${DIR}/receipt-${STAMP}.svg`]).toBe('precious')
  await ui.unmount()
})

test('the folder cannot be made: the file lands beside the project as toolkitty-<kind>-<stamp>.svg', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.failFolder = true
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  await ui.press({ key: 'exp-save-receipt' })
  expect(w.written.map(x => x.path)).toEqual([`C:/proj/toolkitty-receipt-${STAMP}.svg`])
  expect(await lastNotice($)).toBe(`Saved ${SHOWN_FLAT}toolkitty-receipt-${STAMP}.svg`)
  await ui.unmount()
})

test('a failing disk is a warning, not a crash', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  w.failWrite = true
  await ui.press({ key: 'exp-save-receipt' })
  expect(w.written).toEqual([])
  expect(await lastNotice($)).toBe('Could not save the file')
  await ui.unmount()
})

test('Copy text copies the plain-text receipt and says "Copied"; a failed copy warns', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1))
  await ui.press({ key: 'exp-copy-receipt' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]!.surface).toBe('desktop')
  expect(w.copies[0]!.text).toContain('CLAUDE CODE · RECEIPT')
  expect(w.copies[0]!.text).toMatch(/READS \.+ 5/)
  expect(w.written).toEqual([])
  expect(await lastNotice($)).toBe('Copied')
  w.copyOk = false
  await ui.press({ key: 'exp-copy-receipt' })
  expect(await lastNotice($)).toBe('Could not copy')
  await ui.unmount()
})

test('Share copies the text and saves the picture; on the terminal Save writes the text as .txt and says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($, 'terminal')
  await busyTurn($, w)
  const ui = await $.ui.mount(PLACED(1, 'terminal'))
  expect(await labels(ui)).toEqual(['Save text', 'Copy text', 'Share', 'Print', 'Open folder', 'Copy path'])
  await ui.press({ key: 'exp-save-receipt' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/receipt-${STAMP}.txt`])
  expect(w.written[0]!.text).toContain('CLAUDE CODE · RECEIPT')
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}receipt-${STAMP}.txt as text (this surface cannot draw images)`)
  await ui.press({ key: 'exp-share-receipt' })
  expect(w.copies[0]!.surface).toBe('terminal')
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/receipt-${STAMP}.txt`, `${DIR}/receipt-${STAMP}.svg`])
  await ui.unmount()
})

test('the aquarium pane has Save + Copy on both surfaces; the copy is the summary', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: { percent: 42 } })
  await start($)
  const d = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect((await d.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['exp-save-aquarium', 'exp-copy-aquarium', 'exp-print-aquarium', 'exp-open-aquarium', 'exp-path-aquarium'])
  expect(await labels(d)).toEqual(['Save SVG', 'Copy text', 'Print', 'Open folder', 'Copy path'])
  await d.press({ key: 'exp-save-aquarium' })
  expect(w.written.length).toBe(1)
  expect(w.written[0]!.path).toBe(`${DIR}/aquarium-${STAMP}.svg`)
  expect(w.written[0]!.text).toBe((await svgOf(d)).source)
  await d.press({ key: 'exp-copy-aquarium' })
  expect(w.copies[0]!.text).toContain('Aquarium: 42%')
  await d.unmount()

  const t = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await labels(t)).toEqual(['Save text', 'Copy text', 'Print', 'Open folder', 'Copy path'])
  await t.press({ key: 'exp-save-aquarium' })
  expect(w.written[1]!.path).toBe(`${DIR}/aquarium-${STAMP}.txt`)
  expect(w.written[1]!.text).toContain('Aquarium: 42%')
  expect(await noticeTexts($)).toContain(`Saved ${SHOWN}aquarium-${STAMP}.txt as text (this surface cannot draw images)`)
  await t.unmount()
})

test('the labels follow the language: Hebrew and Japanese', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'he' }, usage: { percent: 10 } })
  await start($)
  const he = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await labels(he)).toEqual(['שמור SVG', 'העתק טקסט', 'הדפס', 'פתח תיקייה', 'העתק נתיב'])
  await he.press({ key: 'exp-copy-aquarium' })
  expect(await lastNotice($)).toBe('הועתק')
  await he.press({ key: 'exp-save-aquarium' })
  expect(await lastNotice($)).toBe(`נשמר ${SHOWN}aquarium-${STAMP}.svg`)
  await he.unmount()
  const heTerm = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await labels(heTerm)).toEqual(['שמור טקסט', 'העתק טקסט', 'הדפס', 'פתח תיקייה', 'העתק נתיב'])
  await heTerm.unmount()
})

test('Japanese labels and notices', { timeoutMs: 30_000 }, async ($, on) => {
  world(on, { store: { language: 'ja' }, usage: { percent: 10 } })
  await start($)
  const ja = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  expect(await labels(ja)).toEqual(['SVG を保存', 'テキストをコピー', '印刷', 'フォルダーを開く', 'パスをコピー'])
  await ja.press({ key: 'exp-copy-aquarium' })
  expect(await lastNotice($)).toBe('コピーしました')
  await ja.press({ key: 'exp-save-aquarium' })
  expect(await lastNotice($)).toBe(`${SHOWN}aquarium-${STAMP}.svg を保存しました`)
  await ja.unmount()
  const jaTerm = await $.ui.mount({ ...PANE('aquarium'), surface: 'terminal' })
  expect(await labels(jaTerm)).toEqual(['テキストを保存', 'テキストをコピー', '印刷', 'フォルダーを開く', 'パスをコピー'])
  expect(await joined(jaTerm)).toContain('コンテキスト')
  await jaTerm.unmount()
})

test('the buddy pane keeps its Share and adds Save: the card as an SVG on the desktop, as text on the terminal', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { 'buddy:seed': 424242, 'buddy:name': 'Pixel' } })
  await start($)
  const d = await $.ui.mount({ ...PANE('buddy'), surface: 'desktop' })
  expect((await d.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['share-buddy', 'exp-save-buddy', 'exp-print-buddy', 'exp-open-buddy', 'exp-path-buddy'])
  expect(await labels(d)).toEqual(['share', 'Save SVG', 'Print', 'Open folder', 'Copy path'])
  await d.press({ key: 'exp-save-buddy' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/buddy-${STAMP}.svg`])
  expect(w.written[0]!.text).toBe((await svgOf(d)).source)
  expect(await lastNotice($)).toBe(`Saved ${SHOWN}buddy-${STAMP}.svg`)
  // Share saves a second, new file instead of overwriting the first
  await d.press({ key: 'share-buddy' })
  expect(w.written.map(x => x.path)).toEqual([`${DIR}/buddy-${STAMP}.svg`, `${DIR}/buddy-${STAMP}-2.svg`])
  await d.unmount()

  const t = await $.ui.mount({ ...PANE('buddy'), surface: 'terminal' })
  expect(await labels(t)).toEqual(['share', 'Save text', 'Print', 'Open folder', 'Copy path'])
  await t.press({ key: 'exp-save-buddy' })
  const txt = w.written[2]!
  expect(txt.path).toBe(`${DIR}/buddy-${STAMP}.txt`)
  expect(txt.text).toContain('Pixel')
  await t.unmount()
})

// ---------------------------------------------------------------------------------------------
// Where exports go, the Open folder / Copy path buttons, and /exports
// ---------------------------------------------------------------------------------------------

const SCRATCH = 'C:/Users/someone/AppData/Local/Claude-Data/claude_x/scratch-workspaces/aa/bb/scratch-2026-11-08-f79b9c'
const AQ = { percent: 42 }
/** The programs Toolkitty ran for the folder (other features run git meanwhile). */
const ran = (w: { ran: string[][] }): string[][] => w.ran.filter(a => a[0] !== 'git')

async function saveAquarium($: any): Promise<void> {
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  await ui.press({ key: 'exp-save-aquarium' })
  await ui.unmount()
}

async function pressAquarium($: any, key: string): Promise<void> {
  const ui = await $.ui.mount({ ...PANE('aquarium'), surface: 'desktop' })
  await ui.press({ key })
  await ui.unmount()
}

test('dir choice: a project cwd keeps <cwd>/toolkitty-exports', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ })
  await start($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([`C:/proj/toolkitty-exports/aquarium-${STAMP}.svg`])
})

test('dir choice: a scratch workspace saves under <home>/Documents/Toolkitty/exports, and the notice shows that full path', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: SCRATCH })
  await start($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([`C:/Users/test/Documents/Toolkitty/exports/aquarium-${STAMP}.svg`])
  expect(await lastNotice($)).toBe(`Saved C:${BS}Users${BS}test${BS}Documents${BS}Toolkitty${BS}exports${BS}aquarium-${STAMP}.svg`)
})

test('dir choice: /tmp/ counts as scratch; HOME is used on Linux', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: '/tmp/claude-1/work', env: { HOME: '/home/ann' } })
  await start($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([`C:/home/ann/Documents/Toolkitty/exports/aquarium-${STAMP}.svg`])
  expect(await lastNotice($)).toBe(`Saved /home/ann/Documents/Toolkitty/exports/aquarium-${STAMP}.svg`)
})

test('dir choice: a Windows Temp cwd is scratch', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: 'C:/Users/test/AppData/Local/Temp/job1' })
  await start($)
  await saveAquarium($)
  expect(w.written[0]!.path).toBe(`C:/Users/test/Documents/Toolkitty/exports/aquarium-${STAMP}.svg`)
})

test('dir choice: no home in the environment asks the shell once, then remembers it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: SCRATCH, env: {} })
  await start($)
  await saveAquarium($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([
    `C:/Users/shell/Documents/Toolkitty/exports/aquarium-${STAMP}.svg`,
    `C:/Users/shell/Documents/Toolkitty/exports/aquarium-${STAMP}-2.svg`,
  ])
  expect(ran(w)).toEqual([['cmd.exe', '/c', 'echo %USERPROFILE%']])
})

test('dir choice: scratch with no home anywhere falls back to <cwd>/toolkitty-exports', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: '/tmp/zzz-no-home', env: {} })
  w.runFail = true
  await start($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([`C:/tmp/zzz-no-home/toolkitty-exports/aquarium-${STAMP}.svg`])
})

test('dir choice: a stored exports:dir wins, even in a project', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, store: { 'exports:dir': `D:${BS}out${BS}files${BS}` } })
  await start($)
  await saveAquarium($)
  expect(w.written.map(x => x.path)).toEqual([`D:/out/files/aquarium-${STAMP}.svg`])
  expect(await lastNotice($)).toBe(`Saved D:${BS}out${BS}files${BS}aquarium-${STAMP}.svg`)
})

test('Open folder on Windows runs cmd /c start on the folder and says so, with the exit code', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ })
  w.dirs['C:/proj/toolkitty-exports'] = []
  await start($)
  await pressAquarium($, 'exp-open-aquarium')
  expect(ran(w)).toEqual([['cmd.exe', '/c', 'start', '', `C:${BS}proj${BS}toolkitty-exports`]])
  expect(await lastNotice($)).toBe(`Opening C:${BS}proj${BS}toolkitty-exports (cmd.exe → 0)`)
})

test('Open folder runs open on macOS', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: '/Users/me/proj' })
  w.dirs['C:/Users/me/proj/toolkitty-exports'] = []
  await start($)
  await pressAquarium($, 'exp-open-aquarium')
  expect(ran(w)).toEqual([['open', '/Users/me/proj/toolkitty-exports']])
})

test('Open folder runs xdg-open on Linux', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: '/home/me/proj' })
  w.dirs['C:/home/me/proj/toolkitty-exports'] = []
  await start($)
  await pressAquarium($, 'exp-open-aquarium')
  expect(ran(w)).toEqual([['xdg-open', '/home/me/proj/toolkitty-exports']])
})

test('Open folder failing (non-zero exit, or the program cannot start) warns with the path to copy', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ, cwd: '/home/me/proj' })
  w.dirs['C:/home/me/proj/toolkitty-exports'] = []
  w.runExit = 3
  await start($)
  await pressAquarium($, 'exp-open-aquarium')
  expect(await lastNotice($)).toBe('Could not open the folder. Path: /home/me/proj/toolkitty-exports (xdg-open → 3)')
  w.runFail = true
  await pressAquarium($, 'exp-open-aquarium')
  expect(ran(w).length).toBe(2)
  // a program that cannot start: the warning carries the engine's reason instead of an exit code
  expect(await lastNotice($)).toBe('Could not open the folder. Path: /home/me/proj/toolkitty-exports (no implementation for process.run)')
})

test('Open folder before anything was saved says the first Save creates it, and runs nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ })
  await start($)
  await pressAquarium($, 'exp-open-aquarium')
  expect(ran(w)).toEqual([])
  expect(await lastNotice($)).toBe(`Nothing saved yet: the first Save creates C:${BS}proj${BS}toolkitty-exports`)
})

test('Copy path copies the folder path and says so; a failed copy warns', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { usage: AQ })
  await start($)
  await pressAquarium($, 'exp-path-aquarium')
  expect(w.copies.map(c => c.text)).toEqual([`C:${BS}proj${BS}toolkitty-exports`])
  expect(await lastNotice($)).toBe(`Copied C:${BS}proj${BS}toolkitty-exports`)
  w.copyOk = false
  await pressAquarium($, 'exp-path-aquarium')
  expect(await lastNotice($)).toBe('Could not copy')
})

const EXPORTS = () => PANE('toolkitty-exports')

test('/exports is registered; with no argument it opens the toolkitty-exports pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(w.cmds).toContain('exports')
  const r = await $.command.run({ command: 'exports', args: '' })
  expect(r.text).toBe('Exports pane opened.')
  expect(w.opened.map(o => o.id)).toContain('toolkitty-exports')
})

test('/exports pane: the empty state explains where files go and why the Documents fallback exists', { timeoutMs: 30_000 }, async ($, on) => {
  world(on)
  await start($)
  const ui = await $.ui.mount({ ...EXPORTS(), surface: 'desktop' })
  const text = await joined(ui)
  expect(text).toContain('Exports')
  expect(text).toContain('0 files')
  expect(text).toContain(`No exported files yet in C:${BS}proj${BS}toolkitty-exports`)
  expect(text).toContain('deleted with the session')
  expect(text).toContain('Documents/Toolkitty/exports')
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(['exports-open', 'exports-path', 'exports-change'])
  await ui.unmount()
})

test('/exports pane lists the newest 30 files with size and date, newest first', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  const files: { name: string; kind: string; size: number; mtimeMs: number }[] = []
  for (let i = 0; i < 35; i++) files.push({ name: `f${i}.svg`, kind: 'file', size: 1000 + i, mtimeMs: NOON - i * 60_000 })
  files.push({ name: 'sub', kind: 'dir', size: 0, mtimeMs: 0 })
  w.dirs['C:/proj/toolkitty-exports'] = files.reverse()
  await start($)
  const ui = await $.ui.mount({ ...EXPORTS(), surface: 'desktop' })
  const all = await joined(ui)
  expect(all).toContain('35 files')
  expect(all).toContain('Newest 30 of 35 shown')
  expect(all).toContain('f0.svg')
  expect(all).toContain('f29.svg')
  expect(all).not.toContain('f30.svg')
  expect(all).not.toContain('sub')
  expect(all.indexOf('f0.svg')).toBeLessThan(all.indexOf('f1.svg'))
  expect(all).toContain('1 KB')
  expect(all).toContain('2026-11-08 12:00')
  await ui.unmount()
})

test('/exports pane buttons: Open folder runs the file manager, Copy path copies, Change folder asks and stores', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.dirs['C:/proj/toolkitty-exports'] = []
  w.dirs['D:/out'] = []
  await start($)
  const ui = await $.ui.mount({ ...EXPORTS(), surface: 'desktop' })
  await ui.press({ key: 'exports-open' })
  expect(ran(w)).toEqual([['cmd.exe', '/c', 'start', '', `C:${BS}proj${BS}toolkitty-exports`]])
  await ui.press({ key: 'exports-path' })
  expect(w.copies.map(c => c.text)).toEqual([`C:${BS}proj${BS}toolkitty-exports`])
  w.askAnswer = 'D:/out'
  await ui.press({ key: 'exports-change' })
  expect(w.asked[0]).toContain('Where should exported files go?')
  expect(w.store.get('exports:dir')).toBe('D:/out')
  expect(await lastNotice($)).toBe(`Exports now go to D:${BS}out`)
  w.askAnswer = 'Use the default'
  await ui.press({ key: 'exports-change' })
  expect(w.store.get('exports:dir')).toBe('')
  w.askAnswer = 'Keep current'
  await ui.press({ key: 'exports-change' })
  expect(w.store.get('exports:dir')).toBe('')
  await ui.unmount()
})

test('/exports open, /exports dir (show, set, reject, reset)', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on)
  w.dirs['C:/proj/toolkitty-exports'] = []
  w.dirs['D:/out'] = []
  w.files['D:/a-file.txt'] = 'x'
  await start($)
  expect((await $.command.run({ command: 'exports', args: 'open' })).text).toBe(`Opening C:${BS}proj${BS}toolkitty-exports (cmd.exe → 0)`)
  expect(ran(w)).toEqual([['cmd.exe', '/c', 'start', '', `C:${BS}proj${BS}toolkitty-exports`]])
  const show = (await $.command.run({ command: 'exports', args: 'dir' })).text
  expect(show).toContain(`Exports go to C:${BS}proj${BS}toolkitty-exports`)
  expect(show).toContain('/exports dir <path>')
  expect((await $.command.run({ command: 'exports', args: 'dir D:/out' })).text).toBe(`Exports now go to D:${BS}out`)
  expect(w.store.get('exports:dir')).toBe('D:/out')
  expect((await $.command.run({ command: 'exports', args: 'dir D:/missing' })).text).toBe('Not an existing folder (give an absolute path): D:/missing')
  expect((await $.command.run({ command: 'exports', args: 'dir D:/a-file.txt' })).text).toContain('Not an existing folder')
  expect((await $.command.run({ command: 'exports', args: 'dir relative/path' })).text).toContain('Not an existing folder')
  expect(w.store.get('exports:dir')).toBe('D:/out')
  expect((await $.command.run({ command: 'exports', args: 'dir default' })).text).toBe(`Exports folder reset to the default: C:${BS}proj${BS}toolkitty-exports`)
  expect(w.store.get('exports:dir')).toBe('')
})

test('/exports in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'he' } })
  w.dirs['D:/out'] = []
  await start($)
  expect((await $.command.run({ command: 'exports', args: 'dir D:/out' })).text).toBe(`הייצואים נשמרים מעתה ב-D:${BS}out`)
  expect((await $.command.run({ command: 'exports', args: '' })).text).toBe('חלונית הייצואים נפתחה.')
  const ui = await $.ui.mount({ ...EXPORTS(), surface: 'desktop' })
  expect(await labels(ui)).toEqual(['פתח תיקייה', 'העתק נתיב', 'שנה תיקייה'])
  await ui.unmount()
})

test('/exports in Japanese', { timeoutMs: 30_000 }, async ($, on) => {
  const w = world(on, { store: { language: 'ja' } })
  w.dirs['C:/proj/toolkitty-exports'] = []
  await start($)
  const ui = await $.ui.mount({ ...EXPORTS(), surface: 'terminal' })
  expect(await labels(ui)).toEqual(['フォルダーを開く', 'パスをコピー', 'フォルダーを変更'])
  expect(await joined(ui)).toContain('エクスポート')
  await ui.unmount()
  expect((await $.command.run({ command: 'exports', args: 'dir D:/nope' })).text).toBe('既存のフォルダーではありません（絶対パスを指定してください）：D:/nope')
})
