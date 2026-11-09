import { expect, mock, test } from 'claude-code/testing'

const CWD = 'C:/proj'
const HOME = 'C:/Users/test'
const T0 = 1_700_000_000_000
const OFF_TEXT = 'The feature is off; turn it on in the /toolkitty pane'

type Out = { exitCode: number; stdout: string; stderr: string }
const ok = (stdout = ''): Out => ({ exitCode: 0, stdout, stderr: '' })
const fail = (code = 1): Out => ({ exitCode: code, stdout: '', stderr: 'nope' })

const norm = (p: string): string => p.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '')

type World = {
  files: Record<string, string>
  written: { path: string; text: string }[]
  copies: string[]
  opened: { id: string; focus?: boolean }[]
  toasts: string[]
  regs: string[]
  store: Map<string, unknown>
  storeSets: { key: string; value: unknown }[]
  procs: { argv: string[]; cwd?: string; timeoutMs?: number }[]
  proc: (argv: string[]) => Out | 'throw'
  askAnswer: string | 'throw'
  asked: string[]
  copyOk: boolean
  pluginJson: string | undefined
  slots: Map<string, { value: unknown; version: number }>
  storeSets: { key: string; value: unknown }[]
}

/** What the real tools would answer: git by subcommand, `--version` per tool. */
function gitProc(o: { repo?: boolean; remote?: string; status?: string; branch?: string; tracked?: string; tools?: Record<string, string | null> } = {}): (argv: string[]) => Out | 'throw' {
  const tools: Record<string, string | null> = {
    node: 'v20.11.0',
    npm: '10.2.4',
    python: 'Python 3.12.1',
    git: 'git version 2.43.0',
    gh: 'gh version 2.40.1 (2024-01-01)',
    prettier: '3.1.0',
    eslint: 'v8.56.0',
    ruff: 'ruff 0.1.9',
    pytest: 'pytest 7.4.4',
    ...(o.tools ?? {}),
  }
  return argv => {
    const [cmd, a1] = argv
    if (a1 === '--version') {
      const v = tools[cmd ?? '']
      return v === null || v === undefined ? fail(127) : ok(v + '\n')
    }
    if (cmd !== 'git') return fail(127)
    if (o.repo === false) return fail(128)
    if (a1 === 'rev-parse') return ok('true\n')
    if (a1 === 'status') return ok(o.status ?? ' M src/a.ts\n?? notes.txt\n')
    if (a1 === 'branch') return ok((o.branch ?? 'main') + '\n')
    if (a1 === 'remote') return ok(o.remote === undefined ? 'origin\n' : o.remote === '' ? '' : o.remote + '\n')
    if (a1 === 'ls-files') return ok(o.tracked ?? '')
    return ok()
  }
}

const md = (bytes: number, text = '# Project\nRun npm test and eslint before every commit.\n'): string => text.padEnd(bytes, 'x')

const HEALTHY: Record<string, string> = {
  [`${CWD}/package.json`]: JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '^1.0.0' } }),
  [`${CWD}/vitest.config.ts`]: 'export default {}',
  [`${CWD}/CLAUDE.md`]: md(1000),
  [`${CWD}/.gitignore`]: '.env\nnode_modules\n',
  [`${CWD}/.claude/toolkitty.json`]: JSON.stringify({ enabled: {} }),
  [`${HOME}/.claude/settings.json`]: JSON.stringify({ hooks: { Stop: [] }, enabledPlugins: { 'toolkitty@local': true } }),
}

type Opts = {
  files?: Record<string, string>
  proc?: (argv: string[]) => Out | 'throw'
  store?: Record<string, unknown>
  lang?: string
  cwd?: string
}

/* The test `$` has no state noun: the plugin's atoms live in an in-memory state beneath it. Every call the plugin makes on `$` is answered here. */
function boot(on: any, o: Opts = {}): World {
  refusal = null
  const cwd = o.cwd ?? CWD
  mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: HOME, HOME })
  mock.session(on)
  const w: World = {
    files: { ...(o.files ?? {}) },
    written: [],
    copies: [],
    opened: [],
    toasts: [],
    regs: [],
    store: new Map(Object.entries({ language: o.lang ?? 'en', 'onboarding:done': true, ...(o.store ?? {}) })),
    storeSets: [],
    procs: [],
    proc: o.proc ?? gitProc(),
    askAnswer: 'Apply',
    asked: [],
    copyOk: true,
    pluginJson: undefined,
    slots: new Map(),
  }
  const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`
  on('state.get', (_: any, e: any) => {
    const s = w.slots.get(slotKey(e))
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const prev = w.slots.get(slotKey(e))
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    w.slots.set(slotKey(e), { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  on('store.get', (_: any, e: any) => ({ value: w.store.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    w.store.set(e.key, e.value)
    w.storeSets.push({ key: e.key, value: e.value })
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    w.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }))
  on('command.register', (_: any, e: any) => {
    if (refusal !== null && refusal.name === e.name) {
      if (refusal.how === 'throw') throw new Error('taken')
      return { deny: 'taken' }
    }
    w.regs.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    w.opened.push({ id: e.id, focus: e.focus })
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => {
    w.toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.copy', (_: any, e: any) => {
    w.copies.push(String(e.text))
    return { value: { isCopied: w.copyOk } } as any
  })
  on('audio.play', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0].question as string
      w.asked.push(q)
      if (w.askAnswer === 'throw') throw new Error('the person closed the dialog')
      return { result: { questions: e.questions, answers: { [q]: w.askAnswer } } } as any
    }
    return { result: {} } as any
  })
  on('process.run', (_: any, e: any) => {
    const argv = [...e.argv] as string[]
    w.procs.push({ argv, cwd: e.init?.cwd, timeoutMs: e.init?.timeoutMs })
    const out = w.proc(argv)
    if (out === 'throw') throw new Error('spawn failed')
    return { value: out } as any
  })
  on('fs.exists', (_: any, e: any) => ({ value: norm(e.path) in w.files }) as any)
  on('fs.read', (_: any, e: any) => {
    const p = norm(e.path)
    if (/\.claude-plugin\/plugin\.json$/.test(p) && w.pluginJson !== undefined) return { value: w.pluginJson } as any
    if (!(p in w.files)) return { deny: 'ENOENT ' + p } as any
    return { value: w.files[p] } as any
  })
  on('fs.stat', (_: any, e: any) => {
    const p = norm(e.path)
    if (!(p in w.files)) return { deny: 'ENOENT ' + p } as any
    return { value: { kind: 'file', size: (w.files[p] ?? '').length, mtimeMs: 5 } } as any
  })
  on('fs.list', () => ({ value: [] }) as any)
  on('fs.write', (_: any, e: any) => {
    const text = (e.content ?? e.text ?? e.data) as string
    const p = norm(e.path)
    w.written.push({ path: p, text })
    w.files[p] = text
    return { value: undefined } as any
  })
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }) as any)
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }) as any)
  on('prompt.compose', () => ({ sections: [] }) as any)
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('session.measure', () => ({ changed: [] }) as any)
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return w
}

const start = ($: any, cwd = CWD) => $.session.start({ cwd, surface: 'desktop', isInteractive: true })
const doctor = ($: any, args = '') => $.command.run({ command: 'envcheck', args })

const PANE = (surface: 'desktop' | 'terminal' = 'desktop') =>
  ({
    plugin: 'toolkitty',
    surface,
    component: 'Pane',
    requestId: 'doctor',
    props: { title: 'doctor', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const BAND = {
  plugin: 'toolkitty',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
const labels = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((x: any) => String(x.props.label ?? x.text))
const keys = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((x: any) => String(x.key))

/** Runs `/envcheck copy` and returns the report's lines (the first is the title, the second the formula). */
async function report($: any, w: World): Promise<string[]> {
  const before = w.copies.length
  await doctor($, 'copy')
  expect(w.copies.length).toBe(before + 1)
  return (w.copies[w.copies.length - 1] ?? '').split('\n')
}
const row = (lines: string[], title: string): string => lines.find(l => l.slice(2).startsWith(`${title}:`)) ?? ''

/** The band chip's text and colour, or undefined when none is drawn. */
async function chip($: any): Promise<{ text: string; color: unknown } | undefined> {
  const band = await $.ui.mount({ ...BAND, requestId: `band-${Math.random()}` })
  const c = await band.find({ key: 'chip-doctor' })
  let out: { text: string; color: unknown } | undefined
  if (c !== undefined) {
    const txt = await band.find({ type: 'Text', text: c.text.trim() })
    out = { text: c.text.trim().replace(/^⚙ /, ''), color: txt?.props['color'] }
  }
  await band.unmount()
  return out
}

const SETTINGS = (w: World): boolean => w.written.some(x => /settings\.json$/.test(x.path))

test('load: the command is registered and the feature is on by default', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  expect(w.regs).toContain('envcheck')
  // nothing runs on session start: no tool was probed, and the chip stays quiet
  expect(w.procs.filter(p => p.argv[1] === '--version').length).toBe(0)
  expect(await chip($)).toBeUndefined()
})

test('a healthy project: 100/100, every check ok, no fixes offered, no chip', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  const r = await doctor($)
  expect(r.text).toBe('Toolkitty Doctor: 100/100 (0 failed, 0 warnings). Details are in the Environment health pane.')
  expect(w.opened.filter(o => o.id === 'doctor')).toEqual([{ id: 'doctor', focus: true }])

  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Environment health')
  expect(await ui.find({ type: 'Text', text: '100/100' })).toBeDefined()
  expect(all).toContain('Score: 100 − 15 × 0 failed − 5 × 0 warnings = 100')
  expect(all).toContain('Git: branch main · 2 uncommitted · remote origin')
  expect(all).toMatch(/CLAUDE\.md: C:\/proj\/CLAUDE\.md · 1000 B · mentions test commands · mentions lint commands/)
  expect(all).toContain('Tools on PATH: found: node 20.11.0, npm 10.2.4, python 3.12.1, git 2.43.0, gh 2.40.1, prettier 3.1.0, eslint 8.56.0, ruff 0.1.9, pytest 7.4.4')
  expect(all).toContain('Tests: found: scripts.test, vitest')
  expect(all).toContain('Toolkitty config: .claude/toolkitty.json is valid')
  expect(all).toContain('Features: no conflicting or redundant features')
  expect(all).toContain('Hooks and plugins: classic hooks exist alongside Toolkitty · toolkitty is listed in enabledPlugins')
  expect(all).toContain('Version: no release info yet (the update check has not run)')
  expect(all).toContain('Secrets in git: no .env file is tracked by git')
  expect(all).toContain('.gitignore: .gitignore present and lists .env')
  expect((await keys(ui)).filter(k => k.startsWith('doctor-fix-') && k !== 'doctor-fix-all')).toEqual([])
  expect(await labels(ui)).toEqual(['Run again', 'Copy report', 'Fix recommended'])
  await ui.unmount()
  expect(await chip($)).toBeUndefined()
})

test('every process runs in the project with a 10 second timeout, and tools are probed by --version', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  await doctor($)
  const mine = w.procs.filter(p => p.argv[1] === '--version' || p.argv[0] === 'git')
  expect(mine.length).toBeGreaterThanOrEqual(13)
  for (const p of mine.filter(x => ['node', 'npm', 'python', 'gh', 'prettier', 'eslint', 'ruff', 'pytest'].includes(x.argv[0] ?? ''))) {
    expect(p.argv).toEqual([p.argv[0], '--version'])
    expect(p.timeoutMs).toBe(10000)
    expect(p.cwd).toBe(CWD)
  }
  const gitCalls = w.procs.filter(p => p.argv[0] === 'git' && p.argv[1] !== '--version').map(p => p.argv.slice(1).join(' '))
  expect(gitCalls).toContain('rev-parse --is-inside-work-tree')
  expect(gitCalls).toContain('status --porcelain')
  expect(gitCalls).toContain('branch --show-current')
  expect(gitCalls).toContain('remote')
  expect(gitCalls).toContain('ls-files .env .env.*')
  expect(w.procs.every(p => p.timeoutMs === 10000)).toBe(true)
})

test('a bare folder: warnings, skipped checks and a score of exactly 80 with no chip', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { proc: gitProc({ repo: false, tools: { node: null, npm: null, python: null, git: null, gh: null, prettier: null, eslint: null, ruff: null, pytest: null } }) })
  await start($)
  const lines = await report($, w)
  expect(lines[0]).toBe('Toolkitty Doctor: environment health 80/100')
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 4 warnings = 80')
  expect(row(lines, 'Git')).toBe('⚠ Git: not inside a git repository')
  expect(row(lines, 'CLAUDE.md')).toBe('⚠ CLAUDE.md: no CLAUDE.md in the folder, 3 parents or ~/.claude')
  expect(row(lines, 'Tools on PATH')).toBe('– Tools on PATH: none of the usual tools were found')
  expect(row(lines, 'Tests')).toBe('⚠ Tests: no test command found')
  expect(row(lines, 'Toolkitty config')).toBe('– Toolkitty config: no .claude/toolkitty.json (optional: it shares the setup with a team)')
  expect(row(lines, 'Features')).toBe('✓ Features: no conflicting or redundant features')
  expect(row(lines, 'Hooks and plugins')).toBe('– Hooks and plugins: ~/.claude/settings.json could not be read')
  expect(row(lines, 'Version')).toBe('– Version: no release info yet (the update check has not run)')
  expect(row(lines, 'Secrets in git')).toBe('– Secrets in git: not a git repository, nothing to check')
  expect(row(lines, '.gitignore')).toBe('⚠ .gitignore: no .gitignore')
  expect(await chip($)).toBeUndefined() // 80 is not below 80

  const ui = await $.ui.mount(PANE())
  expect(await ui.find({ type: 'Text', text: '80/100' })).toBeDefined()
  expect(await keys(ui)).toEqual(expect.arrayContaining(['doctor-fix-toolkitty-config', 'doctor-fix-gitignore']))
  await ui.unmount()
})

test('a project with .env tracked: an alert, the example file is not one', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ tracked: '.env\n.env.example\n.env.production\n' }) })
  await start($)
  const lines = await report($, w)
  expect(row(lines, 'Secrets in git')).toBe('✗ Secrets in git: tracked by git: .env, .env.production; secrets may be in history')
  expect(lines[1]).toBe('Score: 100 − 15 × 1 failed − 5 × 0 warnings = 85')

  await doctor($)
  const ui = await $.ui.mount(PANE())
  const text = await ui.find({ type: 'Text', text: /^Secrets in git:/ })
  expect(text.props['color']).toBe('error')
  expect((await ui.find({ type: 'Text', text: '85/100' })).props['color']).toBeUndefined()
  await ui.unmount()

  const only = boot as unknown // keep the helper referenced for readers
  void only
})

test('only .env.example tracked is fine', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ tracked: '.env.example\n.env.sample\n' }) })
  await start($)
  expect(row(await report($, w), 'Secrets in git')).toBe('✓ Secrets in git: no .env file is tracked by git')
})

test('git: no remote warns, a clean tree and a detached head are described', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ remote: '', status: '', branch: '' }) })
  await start($)
  const lines = await report($, w)
  expect(row(lines, 'Git')).toBe('⚠ Git: branch (none) · 0 uncommitted · no remote')
})

test('git: when no process can start the check is skipped and nothing crashes', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: () => 'throw' })
  await start($)
  const lines = await report($, w)
  expect(row(lines, 'Git')).toBe('– Git: git did not run')
  expect(row(lines, 'Secrets in git')).toBe('– Secrets in git: not a git repository, nothing to check')
  // node/npm are expected by package.json and could not be run
  expect(row(lines, 'Tools on PATH')).toBe('✗ Tools on PATH: not found: python, git, gh, prettier, eslint, ruff, pytest · missing but this project needs: node, npm')
})

test('CLAUDE.md: found in a parent (3 levels up), too large, too thin, and user level', { timeoutMs: 30_000 }, async ($, on) => {
  const deep = 'C:/work/app/sub'
  const w = boot(on, { cwd: deep, files: { 'C:/work/CLAUDE.md': md(500) } })
  await start($, deep)
  expect(row(await report($, w), 'CLAUDE.md')).toBe('✓ CLAUDE.md: C:/work/CLAUDE.md · 500 B · mentions test commands · mentions lint commands')

  w.files['C:/work/CLAUDE.md'] = md(13 * 1024)
  expect(row(await report($, w), 'CLAUDE.md')).toBe('⚠ CLAUDE.md: C:/work/CLAUDE.md · 13.0 KB · large: costs tokens every turn · mentions test commands · mentions lint commands')

  w.files['C:/work/CLAUDE.md'] = md(12 * 1024) // exactly the limit is not over it
  expect(row(await report($, w), 'CLAUDE.md').startsWith('✓')).toBe(true)

  w.files['C:/work/CLAUDE.md'] = '# Short\nBe nice.\n'
  expect(row(await report($, w), 'CLAUDE.md')).toBe('⚠ CLAUDE.md: C:/work/CLAUDE.md · 17 B · thin: little guidance for Claude · no test or lint commands mentioned')

  w.files['C:/work/CLAUDE.md'] = md(199)
  expect(row(await report($, w), 'CLAUDE.md').includes('thin')).toBe(true)
  w.files['C:/work/CLAUDE.md'] = md(200)
  expect(row(await report($, w), 'CLAUDE.md').includes('thin')).toBe(false)

  delete w.files['C:/work/CLAUDE.md']
  w.files[`${HOME}/.claude/CLAUDE.md`] = md(400, '# Me\nRun pytest.\n')
  expect(row(await report($, w), 'CLAUDE.md')).toBe(`✓ CLAUDE.md: ${HOME}/.claude/CLAUDE.md · 400 B · mentions test commands`)
})

test('CLAUDE.md four levels up is out of reach', { timeoutMs: 30_000 }, async ($, on) => {
  const deep = 'C:/a/b/c/d/e'
  const w = boot(on, { cwd: deep, files: { 'C:/a/CLAUDE.md': md(500) } })
  await start($, deep)
  expect(row(await report($, w), 'CLAUDE.md')).toContain('no CLAUDE.md')
})

test('tools: expected ones missing fail, optional ones are only listed', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ tools: { node: null, gh: null, ruff: null } }) })
  await start($)
  const lines = await report($, w)
  expect(row(lines, 'Tools on PATH')).toBe('✗ Tools on PATH: found: npm 10.2.4, python 3.12.1, git 2.43.0, prettier 3.1.0, eslint 8.56.0, pytest 7.4.4 · not found: gh, ruff · missing but this project needs: node')
  expect(lines[1]).toBe('Score: 100 − 15 × 1 failed − 5 × 0 warnings = 85')

})

test('tools: a python project expects python', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: { [`${CWD}/requirements.txt`]: 'pytest\n' }, proc: gitProc({ tools: { python: null } }) })
  await start($)
  const r = row(await report($, w), 'Tools on PATH')
  expect(r.startsWith('✗')).toBe(true)
  expect(r).toContain('missing but this project needs: python')
  expect(r).not.toContain('node,') // node is only optional here
})

test('tests: placeholder script warns; jest config, pytest config and a real script are found', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: { [`${CWD}/package.json`]: JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }) } })
  await start($)
  expect(row(await report($, w), 'Tests')).toBe('⚠ Tests: no test command found')

  w.files[`${CWD}/jest.config.js`] = 'module.exports = {}'
  expect(row(await report($, w), 'Tests')).toBe('✓ Tests: found: jest')

  delete w.files[`${CWD}/jest.config.js`]
  w.files[`${CWD}/package.json`] = JSON.stringify({ scripts: { test: 'node --test' }, jest: {} })
  expect(row(await report($, w), 'Tests')).toBe('✓ Tests: found: scripts.test, jest')

  w.files[`${CWD}/package.json`] = '{ not json'
  w.files[`${CWD}/pyproject.toml`] = '[tool.pytest.ini_options]\naddopts = "-q"\n'
  expect(row(await report($, w), 'Tests')).toBe('✓ Tests: found: pytest')
})

test('toolkitty config: missing is skipped with a fix; invalid, wrong shape and unknown profile warn; a known profile is ok', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on)
  await start($)
  expect(row(await report($, w), 'Toolkitty config')).toBe('– Toolkitty config: no .claude/toolkitty.json (optional: it shares the setup with a team)')

  // written after the session started, so the project-config feature does not apply it
  w.files[`${CWD}/.claude/toolkitty.json`] = '{ nope'
  expect(row(await report($, w), 'Toolkitty config')).toBe('⚠ Toolkitty config: .claude/toolkitty.json is not valid JSON')
  w.files[`${CWD}/.claude/toolkitty.json`] = '[1]'
  expect(row(await report($, w), 'Toolkitty config')).toBe('⚠ Toolkitty config: .claude/toolkitty.json must hold a JSON object')
  w.files[`${CWD}/.claude/toolkitty.json`] = JSON.stringify({ profile: 'turbo' })
  expect(row(await report($, w), 'Toolkitty config')).toBe('⚠ Toolkitty config: unknown profile "turbo" in .claude/toolkitty.json')
  w.files[`${CWD}/.claude/toolkitty.json`] = JSON.stringify({ profile: 'productive' })
  expect(row(await report($, w), 'Toolkitty config')).toBe('✓ Toolkitty config: .claude/toolkitty.json is valid, profile productive')
  w.files[`${CWD}/.claude/toolkitty.json`] = JSON.stringify({ profile: 'minimal' })
  expect(row(await report($, w), 'Toolkitty config')).toContain('profile minimal')
  w.files[`${CWD}/.claude/toolkitty.json`] = JSON.stringify({ profile: 'playful' })
  expect(row(await report($, w), 'Toolkitty config')).toContain('profile playful')
})

test('features: tldr with turn-summary is info only; scope-guard without a scope warns; with a scope it does not', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { enabled: { tldr: true, 'turn-summary': true, 'scope-guard': true } } })
  await start($)
  let lines = await report($, w)
  expect(row(lines, 'Features')).toBe('✓ Features: tldr and turn-summary are both on: they overlap')
  expect(lines.filter(l => l.slice(2).startsWith('Features:')).length).toBe(2)
  expect(lines.some(l => l === '⚠ Features: scope-guard is on but no scope is set: it has no effect')).toBe(true)
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 1 warnings = 95')

  // the scope is kept per folder in the store
  const set = await $.command.run({ command: 'scope', args: 'add src/**' })
  void set
  lines = await report($, w)
  expect(lines.some(l => l.includes('scope-guard is on but no scope is set'))).toBe(false)
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 0 warnings = 100')
})

test('features: budget-guard off warns and offers the fix; auto-continue on top of it warns again', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { enabled: { 'budget-guard': false } } })
  await start($)
  let lines = await report($, w)
  expect(lines).toContain('⚠ Features: budget-guard is off: nothing stops spending the last percent')
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 1 warnings = 95')

  // Toolkitty keeps the map in an atom as well; drive it the way the switchboard does
  w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false, 'auto-continue': true }, version: 50 })
  lines = await report($, w)
  expect(lines).toContain('⚠ Features: budget-guard is off: nothing stops spending the last percent')
  expect(lines).toContain('⚠ Features: auto-continue is on while budget-guard is off: it can keep spending past the limit')
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 2 warnings = 90')
})

test('hooks and plugins: settings read, invalid and absent', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: { ...HEALTHY, [`${HOME}/.claude/settings.json`]: JSON.stringify({ enabledPlugins: { other: true } }) } })
  await start($)
  expect(row(await report($, w), 'Hooks and plugins')).toBe('✓ Hooks and plugins: settings.json readable, no classic hooks · toolkitty is not in enabledPlugins')
  w.files[`${HOME}/.claude/settings.json`] = '{ broken'
  expect(row(await report($, w), 'Hooks and plugins')).toBe('⚠ Hooks and plugins: ~/.claude/settings.json is not valid JSON')
  delete w.files[`${HOME}/.claude/settings.json`]
  expect(row(await report($, w), 'Hooks and plugins')).toBe('– Hooks and plugins: ~/.claude/settings.json could not be read')
})

test('version: compared with the latest the update check stored', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { 'update-check:latest': { version: '2.0.0', name: 'Two' } } })
  w.pluginJson = JSON.stringify({ name: 'toolkitty', version: '1.4.0' })
  await start($)
  expect(row(await report($, w), 'Version')).toBe('⚠ Version: 2.0.0 is available (you have 1.4.0)')
  w.pluginJson = JSON.stringify({ version: '2.0.0' })
  expect(row(await report($, w), 'Version')).toBe('✓ Version: 2.0.0 is up to date (latest known 2.0.0)')
  w.pluginJson = JSON.stringify({ version: '2.1.0' })
  expect(row(await report($, w), 'Version')).toContain('up to date')
  w.pluginJson = '{}'
  expect(row(await report($, w), 'Version')).toBe('✓ Version: latest known 2.0.0; your version is unknown')
})

test('.gitignore present without .env is a note, not a warning', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: { ...HEALTHY, [`${CWD}/.gitignore`]: 'node_modules\n' } })
  await start($)
  expect(row(await report($, w), '.gitignore')).toBe('✓ .gitignore: .gitignore present but does not list .env')
})

test('fix: Create .gitignore writes exactly ".env" and only when none exists', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: { ...HEALTHY, [`${CWD}/.gitignore`]: undefined as any } })
  delete w.files[`${CWD}/.gitignore`]
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  expect(await keys(ui)).toContain('doctor-fix-gitignore')
  expect(w.written).toEqual([])
  await ui.press({ key: 'doctor-fix-gitignore' })
  expect(w.written).toEqual([{ path: `${CWD}/.gitignore`, text: '.env\n' }])
  // the checks ran again: the row is ok and the button is gone
  await ui.redraw()
  expect(await keys(ui)).not.toContain('doctor-fix-gitignore')
  expect(await joined(ui)).toContain('.gitignore: .gitignore present and lists .env')
  await ui.unmount()
  expect(SETTINGS(w)).toBe(false)
})

test('fix: an existing .gitignore is never overwritten', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  delete w.files[`${CWD}/.gitignore`]
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  w.files[`${CWD}/.gitignore`] = 'dist\n' // appears between the run and the press
  await ui.press({ key: 'doctor-fix-gitignore' })
  expect(w.written).toEqual([])
  expect(w.files[`${CWD}/.gitignore`]).toBe('dist\n')
  await ui.unmount()
})

test('fix: Create .claude/toolkitty.json writes the current setup in project-config shape', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { enabled: { buddy: false, tldr: true } } })
  delete w.files[`${CWD}/.claude/toolkitty.json`]
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  expect(await keys(ui)).toContain('doctor-fix-toolkitty-config')
  await ui.press({ key: 'doctor-fix-toolkitty-config' })
  expect(w.written.length).toBe(1)
  expect(w.written[0]?.path).toBe(`${CWD}/.claude/toolkitty.json`)
  const text = w.written[0]?.text ?? ''
  expect(text.endsWith('\n')).toBe(true)
  const parsed = JSON.parse(text)
  expect(Object.keys(parsed).sort()).toEqual(['enabled', 'language'])
  expect(parsed.language).toBe('en')
  expect(parsed.enabled.buddy).toBe(false)
  expect(parsed.enabled.tldr).toBe(true)
  expect(parsed.enabled['budget-guard']).toBe(true) // a default
  expect(parsed.enabled.doctor).toBe(true)
  expect(Object.keys(parsed.enabled).length).toBeGreaterThan(70)
  expect(text).toBe(JSON.stringify(parsed, null, 2) + '\n')
  await ui.redraw()
  expect(await keys(ui)).not.toContain('doctor-fix-toolkitty-config')
  expect(await joined(ui)).toContain('Toolkitty config: .claude/toolkitty.json is valid')
  await ui.unmount()
  expect(SETTINGS(w)).toBe(false)
})

test('fix: Create .claude/toolkitty.json never overwrites an existing file', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  delete w.files[`${CWD}/.claude/toolkitty.json`]
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  w.files[`${CWD}/.claude/toolkitty.json`] = '{"enabled":{"buddy":false}}'
  await ui.press({ key: 'doctor-fix-toolkitty-config' })
  expect(w.written).toEqual([])
  await ui.unmount()
})

test('fix: Turn budget guard on changes the enabled map and the store, nothing else', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { enabled: { 'budget-guard': false, buddy: false } } })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  expect(await keys(ui)).toContain('doctor-fix-features-budget')
  await ui.press({ key: 'doctor-fix-features-budget' })
  expect(w.written).toEqual([])
  expect(w.store.get('enabled')).toEqual({ 'budget-guard': true, buddy: false })
  await ui.redraw()
  expect(await joined(ui)).toContain('Features: no conflicting or redundant features')
  expect(await keys(ui)).not.toContain('doctor-fix-features-budget')
  await ui.unmount()
  expect(await chip($)).toBeUndefined()
  // the guard really is on now
  const lines = await report($, w)
  expect(lines).not.toContain('⚠ Features: budget-guard is off: nothing stops spending the last percent')
})

test('fix recommended: asks with the exact list; Cancel writes nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { store: { enabled: { 'budget-guard': false, buddy: false } }, proc: gitProc({ repo: false }) })
  await start($)
  await doctor($)
  w.askAnswer = 'Cancel'
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'doctor-fix-all' })
  expect(w.asked).toEqual(['Apply 3 reversible fixes? Create .claude/toolkitty.json from current settings; Turn budget guard on; Create .gitignore with .env'])
  expect(w.written).toEqual([])
  await ui.redraw()
  expect(await keys(ui)).toEqual(expect.arrayContaining(['doctor-fix-toolkitty-config', 'doctor-fix-features-budget', 'doctor-fix-gitignore']))
  await ui.unmount()
})

test('fix recommended: a refused or closed ask writes nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { proc: gitProc({ repo: false }) })
  await start($)
  await doctor($)
  w.askAnswer = 'throw'
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'doctor-fix-all' })
  expect(w.asked.length).toBe(1)
  expect(w.written).toEqual([])
  await ui.unmount()
})

test('fix recommended: Apply runs every reversible fix once and checks again', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { store: { enabled: { 'budget-guard': false, 'auto-continue': true } }, proc: gitProc({ repo: false }) })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'doctor-fix-all' })
  // two checks share the budget fix: it is listed and run once
  expect(w.asked).toEqual(['Apply 3 reversible fixes? Create .claude/toolkitty.json from current settings; Turn budget guard on; Create .gitignore with .env'])
  // the exported setup is written last, so it already holds the budget guard turned on
  expect(w.written.map(x => x.path)).toEqual([`${CWD}/.gitignore`, `${CWD}/.claude/toolkitty.json`])
  expect(w.written[0]?.text).toBe('.env\n')
  expect(JSON.parse(w.written[1]?.text ?? '{}').enabled['budget-guard']).toBe(true)
  expect(w.store.get('enabled')).toEqual({ 'budget-guard': true, 'auto-continue': true })
  await ui.redraw()
  const all = await joined(ui)
  expect(all).toContain('Toolkitty config: .claude/toolkitty.json is valid')
  expect(all).toContain('.gitignore: .gitignore present and lists .env')
  expect(all).not.toContain('budget-guard is off')
  expect((await keys(ui)).filter(k => k.startsWith('doctor-fix-') && k !== 'doctor-fix-all')).toEqual([])
  await ui.unmount()
  expect(SETTINGS(w)).toBe(false)
})

test('fix recommended: with nothing to fix it does not ask', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'doctor-fix-all' })
  expect(w.asked).toEqual([])
  expect(w.written).toEqual([])
  await ui.unmount()
})

test('chip: quiet before the first run, "doctor 75" amber, "doctor 35" red, none at 80 and above', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { store: { enabled: { 'budget-guard': false } }, proc: gitProc({ repo: false }) })
  await start($)
  expect(await chip($)).toBeUndefined() // not run yet
  await doctor($)
  expect(await chip($)).toEqual({ text: 'doctor 75', color: 'warning' })

  // a hostile project: node missing, .env tracked, no remote, nothing configured
  w.files[`${CWD}/package.json`] = '{}'
  w.proc = gitProc({ remote: '', tracked: '.env\n', tools: { node: null, npm: null } })
  w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false, 'auto-continue': true, 'scope-guard': true }, version: 70 })
  const lines = await report($, w)
  // fails: tools, env-tracked; warns: git remote, claude-md, tests, budget, continue, scope, gitignore
  expect(lines[1]).toBe('Score: 100 − 15 × 2 failed − 5 × 7 warnings = 35')
  expect(await chip($)).toEqual({ text: 'doctor 35', color: 'error' })
  const edge = await (async () => {
    w.proc = gitProc({ repo: false })
    w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false }, version: 80 })
    delete w.files[`${CWD}/package.json`]
    await doctor($)
    return chip($)
  })()
  expect(edge).toEqual({ text: 'doctor 75', color: 'warning' })
})

test('chip: exactly 49 is red and 79 is amber', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ tracked: '.env\n', tools: { node: null, npm: null, python: null } }) })
  await start($)
  // two failures (30) = 70; add four warnings (20) = 50 ... then one more makes 45
  await doctor($)
  expect(await chip($)).toEqual({ text: 'doctor 70', color: 'warning' })
  w.files[`${CWD}/.gitignore`] = undefined as any
  delete w.files[`${CWD}/.gitignore`]
  delete w.files[`${CWD}/CLAUDE.md`]
  delete w.files[`${CWD}/vitest.config.ts`]
  w.files[`${CWD}/package.json`] = '{}'
  await doctor($)
  expect(await chip($)).toEqual({ text: 'doctor 55', color: 'warning' })
  w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false }, version: 90 })
  await doctor($)
  expect(await chip($)).toEqual({ text: 'doctor 50', color: 'warning' })
  w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false, 'scope-guard': true }, version: 91 })
  await doctor($)
  expect(await chip($)).toEqual({ text: 'doctor 45', color: 'error' })
})

test('copy: /envcheck copy copies the report; a refused clipboard says so', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  const r = await doctor($, 'copy')
  expect(r.text).toBe('Doctor report copied')
  expect(w.copies.length).toBe(1)
  const lines = w.copies[0]!.split('\n')
  expect(lines[0]).toBe('Toolkitty Doctor: environment health 100/100')
  expect(lines[1]).toBe('Score: 100 − 15 × 0 failed − 5 × 0 warnings = 100')
  expect(lines.length).toBe(2 + 10)
  expect(lines[2]).toBe('✓ Git: branch main · 2 uncommitted · remote origin')
  expect(w.opened.filter(o => o.id === 'doctor')).toEqual([]) // copying does not open the pane

  w.copyOk = false
  expect((await doctor($, ' COPY ')).text).toBe('Could not copy the report')
})

test('copy: the pane button copies the same report', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  await ui.press({ key: 'doctor-copy' })
  expect(w.copies.length).toBe(1)
  expect(w.copies[0]).toContain('Toolkitty Doctor: environment health 100/100')
  await ui.unmount()
})

test('the pane before any run explains itself and Run again fills it', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('Environment health')
  expect(all).toContain('No check has run yet.')
  expect(all).toContain('Run /envcheck, or press Run again, to check this project.')
  expect(await labels(ui)).toEqual(['Run again'])
  await ui.press({ key: 'doctor-run' })
  await ui.redraw()
  expect(await joined(ui)).toContain('Git: branch main · 2 uncommitted · remote origin')
  expect(await labels(ui)).toEqual(['Run again', 'Copy report', 'Fix recommended'])
  await ui.unmount()
})

test('Run again checks the project afresh', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  expect(await ui.find({ type: 'Text', text: '100/100' })).toBeDefined()
  delete w.files[`${CWD}/CLAUDE.md`]
  await ui.press({ key: 'doctor-run' })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: '95/100' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: '95/100' })).props['color']).toBeUndefined()
  expect(await joined(ui)).toContain('Score: 100 − 15 × 0 failed − 5 × 1 warnings = 95')
  await ui.unmount()
})

test('the status colour follows the score: ok >= 80, amber >= 50, red below', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, proc: gitProc({ tracked: '.env\n', tools: { node: null, npm: null } }) })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE())
  expect((await ui.find({ type: 'Text', text: '70/100' })).props['color']).toBe('warning')
  delete w.files[`${CWD}/package.json`]
  delete w.files[`${CWD}/CLAUDE.md`]
  delete w.files[`${CWD}/.gitignore`]
  delete w.files[`${CWD}/vitest.config.ts`]
  w.slots.set('toolkitty/enabled/', { value: { 'budget-guard': false, 'scope-guard': true }, version: 20 })
  await ui.press({ key: 'doctor-run' })
  await ui.redraw()
  // env tracked (-15) + claude-md, tests, scope, budget, gitignore (-25) = 60 ... tools no longer expected
  expect(await ui.find({ type: 'Text', text: '60/100' })).toBeDefined()
  await ui.unmount()
})

test('the terminal surface draws the same pane', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  await doctor($)
  const ui = await $.ui.mount(PANE('terminal'))
  const all = await joined(ui)
  expect(all).toContain('Environment health')
  expect(all).toContain('Score: 100 − 15 × 0 failed − 5 × 0 warnings = 100')
  expect(await labels(ui)).toEqual(['Run again', 'Copy report', 'Fix recommended'])
  await ui.unmount()
  void w
})

test('Hebrew: the command, the pane and the report are in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, lang: 'he' })
  await start($)
  const r = await doctor($)
  expect(r.text).toBe('רופא ה-Toolkitty: 100/100 (0 נכשלו, 0 אזהרות). הפרטים בלוח בריאות הסביבה.')
  const ui = await $.ui.mount(PANE())
  const all = await joined(ui)
  expect(all).toContain('בריאות הסביבה')
  expect(all).toContain('ציון: 100 − 15 × 0 נכשלו − 5 × 0 אזהרות = 100')
  expect(all).toContain('ענף main · 2 לא נשמרו · מאגר מרוחק origin')
  expect(await labels(ui)).toEqual(['הרץ שוב', 'העתק דוח', 'תקן את המומלצים'])
  await ui.unmount()
  const lines = await report($, w)
  expect(lines[0]).toBe('רופא ה-Toolkitty: בריאות הסביבה 100/100')
  expect(row(lines, 'כלים ב-PATH')).toContain('נמצאו: node 20.11.0')
})

test('Hebrew: a failing project has the chip and the fix button in Hebrew', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { lang: 'he', store: { enabled: { 'budget-guard': false } }, proc: gitProc({ repo: false }) })
  await start($)
  await doctor($)
  expect(await chip($)).toEqual({ text: 'רופא 75', color: 'warning' })
  const ui = await $.ui.mount(PANE())
  const fix = await ui.find({ key: 'doctor-fix-gitignore' })
  expect(String(fix.props.label)).toBe('תקן')
  await ui.press({ key: 'doctor-fix-all' })
  expect(w.asked[0]).toContain('להחיל 3 תיקונים הפיכים?')
  expect(w.asked[0]).toContain('צור .gitignore עם .env')
  await ui.unmount()
})

const LANG_CASES: [string, string, string][] = [
  ['es', 'Salud del entorno', 'Puntuación: 100 − 15 × 0 fallidas − 5 × 0 avisos = 100'],
  ['fr', 'Santé de l’environnement', 'Score : 100 − 15 × 0 échecs − 5 × 0 avertissements = 100'],
  ['ru', 'Состояние окружения', 'Оценка: 100 − 15 × 0 сбоев − 5 × 0 предупреждений = 100'],
]
for (const [lang, title, formula] of LANG_CASES) {
  test(`${lang}: the pane has its title and the score formula`, { timeoutMs: 30_000 }, async ($, on) => {
    boot(on, { files: HEALTHY, lang })
    await start($)
    await doctor($)
    const ui = await $.ui.mount(PANE())
    const all = await joined(ui)
    expect(all).toContain(title)
    expect(all).toContain(formula)
    await ui.unmount()
  })
}

test('off switch: the command answers the off text, nothing runs, no pane, no chip', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY, store: { enabled: { doctor: false } } })
  await start($)
  expect(w.regs).toContain('envcheck') // still registered, so it can say it is off
  expect((await doctor($)).text).toBe(OFF_TEXT)
  expect((await doctor($, 'copy')).text).toBe(OFF_TEXT)
  expect(w.copies).toEqual([])
  expect(w.opened.filter(o => o.id === 'doctor')).toEqual([])
  expect(w.procs.filter(p => p.argv[1] === '--version')).toEqual([])
  expect(w.written).toEqual([])
  const ui = await $.ui.mount(PANE())
  expect(await joined(ui)).toBe('Toolkitty Doctor is off in the switchboard.')
  await ui.unmount()
  expect(await chip($)).toBeUndefined()
})

test('off switch: a score that was low no longer shows a chip once the feature is off', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { store: { enabled: { 'budget-guard': false } }, proc: gitProc({ repo: false }) })
  await start($)
  await doctor($)
  expect((await chip($))?.text).toBe('doctor 75')
  w.slots.set('toolkitty/enabled/', { value: { doctor: false, 'budget-guard': false }, version: 99 })
  expect(await chip($)).toBeUndefined()
})

/** The harness' command.register answer refuses this name (the engine: a built-in or another plugin owns it). */
let refusal: { name: string; how: 'deny' | 'throw' } | null = null

/** Everything Toolkitty noticed, as the notices pane draws it. */
async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'toolkitty', surface: 'desktop', component: 'Pane', requestId: 'toolkitty-notices', props: { title: 'Notices', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}

test('renamed: /doctor is no longer registered, /envcheck is', { timeoutMs: 30_000 }, async ($, on) => {
  const w = boot(on, { files: HEALTHY })
  await start($)
  expect(w.regs).toContain('envcheck')
  expect(w.regs).not.toContain('doctor')
})

for (const how of ['throw', 'deny'] as const) {
  test(`a refused /envcheck registration (${how}) warns and the rest of session start still runs`, { timeoutMs: 30_000 }, async ($, on) => {
    const w = boot(on, { files: HEALTHY })
    refusal = { name: 'envcheck', how }
    await start($)
    expect(w.regs).not.toContain('envcheck')
    expect(w.regs.length).toBeGreaterThan(0)
    expect((await noticeTexts($)).some(x => x.startsWith('The command /envcheck could not be registered: '))).toBe(true)
    expect(w.procs.filter(p => p.argv[1] === '--version').length).toBe(0)
    expect(await chip($)).toBeUndefined()
  })
}
