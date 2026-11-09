import { mock } from 'claude-code/testing'

export const norm = (p: string): string => p.split(String.fromCharCode(92)).join("/")

// The engine side of a toolkitty test: every call the plugin makes on `$` is answered here.
export type World = {
  cmds: string[]
  opened: { id: string; title?: string; focus?: boolean }[]
  closed: string[]
  toasts: string[]
  placed: string[]
  copies: { text: string; surface?: string }[]
  written: { path: string; text: string }[]
  backdrops: unknown[]
  files: Record<string, string>
  mtime: Record<string, number>
  surfaces: string[]
  cwd: string
  usage: { percent?: number; usd?: number; tokens?: number }
  failWrite: boolean
  /** Writes under toolkitty-exports/ fail (the folder cannot be made), flat files still work. */
  failFolder: boolean
  /** Overrides the answer of fs.exists (the harness registers it, so a test must not). */
  exists?: (path: string) => boolean
  /** Overrides the answer of process.run (the harness registers it, so a test must not). */
  run?: (e: any) => any
  failBackdrop: boolean
  copyOk: boolean
  placeOk: boolean
  modelText: string | undefined
  modelPrompts: string[]
  dirs: Record<string, { name: string; kind: string }[]>
  clock: ReturnType<typeof mock.clock>
  toolResult: Record<string, unknown>
  limits: { kind: string; percentUsed: number; resetsAt?: string }[]
  asked: string[]
  askAnswer: string
  failUsage: boolean
  failOpen: boolean
  openPlaced: boolean | undefined
  store: Map<string, unknown>
  storeSets: { key: string; value: unknown }[]
  invalidated: number
  /** Every `$.process.run` argv. */
  ran: string[][]
  runExit: number
  runFail: boolean
  /** What `echo $HOME` / `echo %USERPROFILE%` answers. */
  homeOut: string
}

export type Opts = {
  store?: Record<string, unknown>
  env?: Record<string, string>
  surfaces?: string[]
  cwd?: string
  now?: number
  files?: Record<string, string>
  usage?: { percent?: number; usd?: number; tokens?: number }
}

/** command.register answers refuse these names (the engine: a built-in or another plugin owns them). `names` (several) or `name` (one). Reset by world(). */
export const refusal: { names: Set<string>; name?: string; how: 'deny' | 'throw' } = { names: new Set(), how: 'deny' }

export const NOON = new Date(2026, 10, 8, 12, 0, 0).getTime()

export function world(on: any, o: Opts = {}): World {
  refusal.names.clear()
  delete refusal.name
  refusal.how = 'deny'
  const clock = mock.clock(on, { now: o.now ?? NOON })
  mock.env(on, o.env ?? { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const w: World = {
    cmds: [],
    opened: [],
    closed: [],
    toasts: [],
    placed: [],
    copies: [],
    written: [],
    backdrops: [],
    files: { ...(o.files ?? {}) },
    mtime: {},
    surfaces: o.surfaces ?? ['desktop'],
    cwd: o.cwd ?? 'C:/proj',
    usage: o.usage ?? { percent: 10, usd: 1 },
    failWrite: false,
    failFolder: false,
    failBackdrop: false,
    copyOk: true,
    placeOk: true,
    modelText: 'model says hi',
    modelPrompts: [],
    dirs: {},
    clock,
    toolResult: { result: {} },
    limits: [],
    asked: [],
    askAnswer: 'Cancel',
    failUsage: false,
    failOpen: false,
    openPlaced: undefined,
    store: new Map(Object.entries({ 'onboarding:done': true, ...(o.store ?? {}) })),
    storeSets: [],
    invalidated: 0,
    ran: [],
    runExit: 0,
    runFail: false,
    homeOut: 'C:/Users/shell',
  }
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
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('command.register', (_: any, e: any) => {
    if (refusal.names.has(e.name) || refusal.name === e.name) {
      if (refusal.how === 'throw') throw new Error('taken')
      return { deny: 'taken' }
    }
    w.cmds.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    if (w.failOpen) throw new Error('no surface')
    w.opened.push({ id: e.id, title: e.title, focus: e.focus, closeOnEscape: e.closeOnEscape } as any)
    return { value: { isPlaced: w.openPlaced ?? w.surfaces.length > 0 } }
  })
  on('ui.close', (_: any, e: any) => {
    w.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.toast', (_: any, e: any) => {
    w.toasts.push(typeof e === 'string' ? e : (e.text ?? e.message ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('ui.place', (_: any, e: any) => {
    w.placed.push(e.id)
    return { value: { isPlaced: w.placeOk } }
  })
  on('ui.copy', (_: any, e: any) => {
    w.copies.push({ text: e.text, surface: e.surface })
    return { value: { isCopied: w.copyOk } }
  })
  on('ui.backdrop', (_: any, e: any) => {
    if (w.failBackdrop) throw new Error('no surface')
    w.backdrops.push(e.backdrop)
    return { value: e.backdrop === undefined ? undefined : { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.surfaces', () => ({ value: w.surfaces }))
  on('session.cwd', () => ({ value: w.cwd }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.usage', () => {
    if (w.failUsage) throw new Error('usage gone')
    return {
    value: {
      startedAt: 0,
      context: { window: 200000, percent: w.usage.percent, tokens: w.usage.tokens },
      rateLimits: w.limits,
      cost: w.usage.usd === undefined ? undefined : { usd: w.usage.usd },
    },
    }
  })
  on('fs.write', (_: any, e: any) => {
    if (w.failWrite) throw new Error('disk full')
    if (w.failFolder && norm(e.path).includes('/toolkitty-exports/')) throw new Error('cannot make the folder')
    const text = e.content ?? e.text ?? e.data
    const path = norm(e.path)
    if (!path.includes('toolkitty-sessions')) w.written.push({ path, text })
    w.files[path] = text
    w.mtime[path] = (w.mtime[path] ?? 0) + 1
    return { value: undefined }
  })
  on('fs.exists', (_: any, e: any) => ({ value: w.exists ? w.exists(e.path) : norm(e.path) in w.files || norm(e.path) in w.dirs }))
  on('fs.read', (_: any, e: any) => {
    const f = w.files[norm(e.path)]
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: f }
  })
  on('process.run', (_: any, e: any) => {
    w.ran.push(e.argv)
    if (w.run) return w.run(e)
    if (w.runFail) throw new Error('spawn failed')
    const isHome = e.argv[0] === 'cmd.exe' || e.argv[0] === 'sh'
    return { value: { exitCode: isHome ? 0 : w.runExit, stdout: isHome ? w.homeOut : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.stat', (_: any, e: any) => {
    const f = w.files[norm(e.path)]
    if (f === undefined && norm(e.path) in w.dirs) return { value: { mtimeMs: 1, size: 0, kind: 'dir', isLink: false } }
    if (f === undefined) throw new Error('ENOENT ' + e.path)
    return { value: { mtimeMs: w.mtime[norm(e.path)] ?? 1, size: f.length, kind: 'file' } }
  })
  on('fs.list', (_: any, e: any) => {
    const d = w.dirs[norm(e.path)]
    if (d === undefined) throw new Error('ENOENT ' + e.path)
    return { value: d }
  })
  on('model.complete', (_: any, e: any) => {
    w.modelPrompts.push(e.prompt)
    return { value: { isAnswered: w.modelText !== undefined, text: w.modelText } }
  })
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.attach', (_: any, e: any) => ({ clientId: e.clientId }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0].question as string
      w.asked.push(q)
      return { result: { questions: e.questions, answers: { [q]: w.askAnswer } } } as any
    }
    return w.toolResult as any
  })
  on('session.measure', () => ({ changed: [] }))
  return w
}

export const PANE = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId: id,
    props: { title: id, isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {}, ...extra },
  }) as const

export const BAND = (surface: 'desktop' | 'terminal' = 'desktop', extra: Record<string, unknown> = {}) =>
  ({ plugin: 'toolkitty', component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, ...extra } }) as const

export const start = ($: any, surface = 'desktop') => $.session.start({ cwd: 'C:/proj', surface, isInteractive: true })

let turn = 0
export const turnStart = ($: any, extra: Record<string, unknown> = {}) => $.turn.start({ text: 'hi', turnId: `t${++turn}`, ...extra })
export const turnDone = ($: any, ms = 1000, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: ms, isAborted: false, turnId: `t${turn}`, reason: 'answer', ...extra })

export const texts = async (ui: any, query: Record<string, unknown> = { type: 'Text' }): Promise<string[]> =>
  (await ui.findAll(query)).map((x: any) => x.text as string)
export const joined = async (ui: any): Promise<string> => (await texts(ui)).join('\n')
export const labels = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((x: any) => (x.props.label ?? x.text) as string)
/** Everything Toolkitty noticed (info, warn and alert), newest first, as the notices pane shows it. */
export const noticeTexts = async ($: any): Promise<string[]> => {
  const ui = await $.ui.mount({ ...PANE('toolkitty-notices'), surface: 'desktop' })
  const out = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  await ui.unmount()
  return out
}
/** The newest notice's text: the pane lists a time, the text and the feature per row, after its title and count. */
export const lastNotice = async ($: any): Promise<string | undefined> => (await noticeTexts($))[3]
export const svgOf = async (ui: any) => (await ui.find({ type: 'Svg' }))?.props as { source: string; alt: string; isInteractive?: boolean }

// The buddy roll, as buddy.tsx makes it.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
export const SPECIES = ['cat', 'fox', 'owl', 'octopus', 'dragon', 'axolotl', 'penguin', 'capybara', 'raccoon', 'robot', 'ghost', 'slime']
export function roll(seed: number) {
  const r = rng(seed)
  const species = SPECIES[Math.floor(r() * SPECIES.length)] ?? 'cat'
  const q = r() * 100
  const rarity = q < 60 ? 'common' : q < 85 ? 'uncommon' : q < 95 ? 'rare' : q < 99 ? 'epic' : 'legendary'
  const shiny = r() < 0.01
  return { species, rarity, shiny }
}
export const DAY = 86_400_000
export const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A path as a Windows user sees it in a notice (backslashes). */
export const shownPath = (p: string): string => p.split("/").join(String.fromCharCode(92))

/** The export folder as a Windows person sees it for the test project C:/proj. */
export const SHOWN = ['C:', 'proj', 'toolkitty-exports', ''].join(String.fromCharCode(92))
/** The project folder itself (the flat fallback). */
export const SHOWN_FLAT = ['C:', 'proj', ''].join(String.fromCharCode(92))
