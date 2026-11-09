import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_700_000_000_000
const SLOW = { timeoutMs: 30_000 }
const CWD = 'C:/tmp/project'

const BAND = {
  plugin: 'toolkitty',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const DETAIL = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

type Git = { exitCode: number; files: number; throws: boolean; stdout?: string }

const porcelain = (n: number) => Array.from({ length: n }, (_, i) => ` M src/file${i + 1}.ts`).join('\n') + (n > 0 ? '\n' : '')

const OWN_FAILURE = /feature (task-pulse|cost-meter|daily-total|model-indicator|error-counter|uncommitted-reminder|break-timer|long-turn-toast|done-notify) failed/

/** Toolkitty reports a feature handler that threw as a toast; for this feature that is a test failure. */
function noOwnFailure(text: string) {
  if (OWN_FAILURE.test(text)) throw new Error('a feature handler threw: ' + text)
}

// Every call the plugin makes on `$` is answered here, the engine's side.
function boot(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, { language: 'en', ...store })
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const git: Git = { exitCode: 0, files: 0, throws: false }
  const seen = { opened: [] as string[], checks: [] as { argv: readonly string[]; cwd: string | undefined }[], details: 0 }
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    noOwnFailure(e.text)
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: [] }))
  on('process.run', (_: any, e: any) => {
    const isMine = e.argv[0] === 'git' && e.argv[1] === 'status' && e.argv[2] === '--porcelain'
    if (isMine && e.init?.timeoutMs === 10000) seen.checks.push({ argv: e.argv, cwd: e.init?.cwd })
    if (isMine && e.init?.timeoutMs === 5000) seen.details++
    if (git.throws) throw new Error('spawn git ENOENT')
    // other features probe git too: for them this folder is not a repository, so only this feature's calls are counted
    if (!isMine) return { value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }
    return {
      value: {
        exitCode: git.exitCode,
        stdout: git.exitCode === 0 ? (git.stdout ?? porcelain(git.files)) : '',
        stderr: git.exitCode === 0 ? '' : 'fatal: not a git repository',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { clock, seen, git }
}

const start = async ($: any, clock: any) => {
  await $.session.start({ cwd: CWD, surface: 'desktop', isInteractive: true })
  await clock.settle()
}
const begin = ($: any, id = 't1') => $.turn.start({ text: 'hi', turnId: id })
const done = ($: any, id = 't1') => $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: id, reason: 'answer' })

// The band shows two lines and hides the rest behind a toggle: open it so every line is drawn.
async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

/** The chip Text the band draws for this feature in its compact row: its text and color, or undefined. */
async function chipOf($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  const button = await ui.find({ key: 'chip-uncommitted-reminder' })
  const text = await ui.find({ type: 'Text', text: button?.text ?? '\u0000' })
  await ui.unmount()
  return button === undefined ? undefined : { text: button.text as string, color: text?.props['color'] as string | undefined }
}

async function bandText($: any, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const text = (await ui.find({ key: 'band-uncommitted-reminder' }))?.text
  await ui.unmount()
  return text as string | undefined
}

async function openDetail($: any) {
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-uncommitted-reminder' })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface: 'desktop' })
}

test('loads, checks git at once in the project folder, and shows no band for a clean tree', SLOW, async ($, on) => {
  const { clock, seen } = boot(on)
  await start($, clock)
  expect(seen.checks).toHaveLength(1)
  expect(seen.checks[0]).toEqual({ argv: ['git', 'status', '--porcelain'], cwd: CWD })
  expect(await bandText($)).toBeUndefined()
})

test('the band appears at exactly ten uncommitted files, not at nine, on both surfaces', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 9
  await start($, clock)
  expect(await bandText($)).toBeUndefined()

  git.files = 10
  await clock.advance(30_000)
  expect(await bandText($)).toBe('⚠ 10 uncommitted files')
  expect(await bandText($, 'terminal')).toBe('⚠ 10 uncommitted files')
})

test('a large dirty tree at session start shows at once', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 42
  await start($, clock)
  expect(await bandText($)).toBe('⚠ 42 uncommitted files')
})

test('blank lines in the git output are not counted', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.stdout = porcelain(10) + '\n   \n\n'
  await start($, clock)
  expect(await bandText($)).toBe('⚠ 10 uncommitted files')
})

test('every 30 seconds it checks again: the count grows and the band goes when the tree is committed', SLOW, async ($, on) => {
  const { clock, git, seen } = boot(on)
  git.files = 11
  await start($, clock)
  expect(await bandText($)).toBe('⚠ 11 uncommitted files')

  git.files = 15
  await clock.advance(29_000)
  expect(await bandText($)).toBe('⚠ 11 uncommitted files')
  await clock.advance(1_000)
  expect(await bandText($)).toBe('⚠ 15 uncommitted files')
  expect(seen.checks).toHaveLength(2)

  git.files = 0
  await clock.advance(30_000)
  expect(await bandText($)).toBeUndefined()
})

test('while a turn runs the poll leaves the count alone; the end of the turn checks at once', SLOW, async ($, on) => {
  const { clock, git, seen } = boot(on)
  git.files = 12
  await start($, clock)
  await begin($)

  git.files = 20
  const before = seen.checks.length
  await clock.advance(60_000)
  expect(await bandText($)).toBe('⚠ 12 uncommitted files')
  expect(seen.checks.length).toBe(before)

  await done($)
  await clock.settle()
  expect(await bandText($)).toBe('⚠ 20 uncommitted files')
  expect(seen.checks.length).toBe(before + 1)
})

test('a subagent turn neither pauses nor resumes the poll', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 12
  await start($, clock)
  await $.turn.start({ text: 'sub', turnId: 's1', agentId: 'a1' })
  git.files = 14
  await clock.advance(30_000)
  expect(await bandText($)).toBe('⚠ 14 uncommitted files')
})

test('not a git repository (exit code 128): no band, no failure', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.exitCode = 128
  await start($, clock)
  expect(await bandText($)).toBeUndefined()
  await clock.advance(30_000)
  expect(await bandText($)).toBeUndefined()
})

test('git missing (the spawn throws): swallowed, no band', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.throws = true
  await start($, clock)
  await clock.advance(30_000)
  expect(await bandText($)).toBeUndefined()
})

test('restarting the session replaces the timer: one check per 30 seconds, not two', SLOW, async ($, on) => {
  const { clock, seen } = boot(on)
  await start($, clock)
  await start($, clock)
  const before = seen.checks.length
  await clock.advance(30_000)
  expect(seen.checks.length).toBe(before + 1)
})

test('the band is hidden while a survey holds it', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 30
  await start($, clock)
  expect(await bandText($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the detail pane lists the files from git now, 13 at most, with the rest counted, and its buttons work', SLOW, async ($, on) => {
  const { clock, git, seen } = boot(on)
  git.files = 16
  await start($, clock)

  const ui = await openDetail($)
  expect(seen.opened).toContain('toolkitty-detail')
  expect(seen.details).toBeGreaterThan(0)
  expect(await ui.find({ type: 'Text', text: 'Commit reminder' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Uncommitted files: 16' })).toBeDefined()
  const files = await ui.findAll({ type: 'Text', text: /^ ?M src\/file/ })
  expect(files).toHaveLength(13)
  expect(files[0]?.text).toContain('src/file1.ts')
  expect(await ui.find({ type: 'Text', text: '+3 more' })).toBeDefined()

  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(expect.arrayContaining(['detail-toggle', 'detail-close']))
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBeUndefined()
  await ui.redraw()
  expect((await ui.find({ key: 'detail-toggle' }))?.props['label']).toBe('Turn on')
  await ui.press({ key: 'detail-toggle' })
  expect(await bandText($)).toBe('⚠ 16 uncommitted files')
  await ui.press({ key: 'detail-close' })
  await ui.unmount()
})

test('the detail pane has no "more" line for 13 files or fewer', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 12
  await start($, clock)
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'Uncommitted files: 12' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /more$/ })).toBeUndefined()
  await ui.unmount()
})

test('the detail pane runs git fresh: it shows a clean tree after the band was drawn from an older count', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 12
  await start($, clock)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-uncommitted-reminder' })
  await band.unmount()
  git.files = 0
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'The working tree is clean.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Files Claude edits show up here/ })).toBeDefined()
  await ui.unmount()
})

test('the detail pane explains a git failure', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 12
  await start($, clock)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await openBand(band)
  await band.press({ key: 'band-uncommitted-reminder' })
  await band.unmount()
  git.exitCode = 128
  const ui = await $.ui.mount({ ...DETAIL, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Could not run git status (not a repository, or git is missing).' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Open the session in a folder that is a git repository/ })).toBeDefined()
  await ui.unmount()
})

test('off switch: no band, no git calls from the poll or the turn end', SLOW, async ($, on) => {
  const { clock, git, seen } = boot(on, { enabled: { 'uncommitted-reminder': false } })
  git.files = 30
  await start($, clock)
  await begin($)
  await done($)
  await clock.advance(90_000)
  expect(seen.checks).toHaveLength(0)
  expect(await bandText($)).toBeUndefined()
})

test('Hebrew: the band and the detail pane are in Hebrew', SLOW, async ($, on) => {
  const { clock, git } = boot(on, { language: 'he' })
  git.files = 14
  await start($, clock)
  expect(await bandText($)).toBe('⚠ 14 קבצים לא מקומטים')
  const ui = await openDetail($)
  expect(await ui.find({ type: 'Text', text: 'תזכורת קומיט' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'קבצים שלא נשמרו ב-commit: 14' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '+1 נוספים' })).toBeDefined()
  await ui.unmount()
})

test('the chip is quiet when nothing is uncommitted', SLOW, async ($, on) => {
  const { clock } = boot(on)
  await start($, clock)
  expect(await chipOf($)).toBeUndefined()
})

test('the chip counts uncommitted files, dim below ten, on both surfaces', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 3
  await start($, clock)
  expect(await chipOf($)).toEqual({ text: '⛨ 3 uncommitted', color: undefined })
  expect((await chipOf($, 'terminal'))?.text).toBe('⛨ 3 uncommitted')
  expect(await chipOf($, 'desktop', { hasSurvey: true })).toBeUndefined()
})

test('the chip turns amber from ten uncommitted files', SLOW, async ($, on) => {
  const { clock, git } = boot(on)
  git.files = 12
  await start($, clock)
  expect(await chipOf($)).toEqual({ text: '⛨ 12 uncommitted', color: 'warning' })
})
