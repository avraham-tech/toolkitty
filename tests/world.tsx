import { mock } from 'claude-code/testing'

export const T0 = 1_700_000_000_000

/** The engine hands paths over with backslashes on Windows; the tests key files by forward slashes. */
const slash = (path: unknown): string => String(path).split(String.fromCharCode(92)).join('/')
export const SLOW = { timeoutMs: 30_000 }

export const BAND = {
  plugin: 'toolkitty',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

export const DETAIL = {
  plugin: 'toolkitty',
  component: 'Pane',
  requestId: 'toolkitty-detail',
  props: { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

export const paneOf = (requestId: string, plugin = 'toolkitty') =>
  ({
    plugin,
    component: 'Pane',
    requestId,
    props: { title: 'Pane', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

const OWN_FAILURE = /Toolkitty: (feature|la funci|השכלול)/

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type World = {
  clock: ReturnType<typeof mock.clock>
  opened: { id: string; title?: string; focus?: boolean; closeOnEscape?: boolean }[]
  closed: string[]
  toasts: string[]
  commands: string[]
  /** every file the plugin wrote, by path */
  files: Record<string, string>
  usage: { startedAt: number; context: { window: number; tokens?: number; percent?: number }; rateLimits: Limit[] }
  agents: any[]
  /** the question the budget guard (or any ask) put, and what to answer */
  asks: { question: string; header?: string; options: string[] }[]
  ask: { answer?: string; fail?: boolean }
  /** every prompt the plugin submitted */
  submitted: any[]
  submitFails: boolean
  models: string[]
  modelIds: string[]
  modelReply: { isAnswered: boolean; text?: string } | ((prompt: string) => { isAnswered: boolean; text?: string })
  compact: any
  compactFails: boolean
  surfaces: string[]
  /** results of tool.call by tool name; default `{ result: {} }` */
  toolResult: (e: any) => any
  stat: (path: string) => any
  usageFails: boolean
  cwd: string
  /** every value the plugin wrote to the store, by key (the latest) */
  stored: Record<string, any>
  writeFails: boolean
  copyOk: boolean
  copied: any[]
  compactCalls: any[]
  /** prompts the test itself raised, as the engine would, seen at the bottom */
  promptCalls: any[]
}

/**
 * Every call the plugin makes on `$` is answered here, the engine's side. Returns the world the
 * test can steer (usage, agents, ask answers, files...) and read back (toasts, opened panes...).
 */
export function boot(on: any, store: Record<string, unknown> = {}, now = T0, env: Record<string, string> = { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' }): World {
  const clock = mock.clock(on, { now })
  mock.env(on, env)
  mock.session(on)
  const w: World = {
    clock,
    opened: [],
    closed: [],
    toasts: [],
    commands: [],
    files: {},
    usage: { startedAt: now, context: { window: 200_000, tokens: 0, percent: 0 }, rateLimits: [] },
    agents: [],
    asks: [],
    ask: {},
    submitted: [],
    submitFails: false,
    models: [],
    modelIds: [],
    modelReply: { isAnswered: true, text: 'NONE' },
    compact: { messages: [{ role: 'assistant', text: 'summary', toolUses: [] }], tokensBefore: 90_000, tokensAfter: 12_000 },
    compactFails: false,
    surfaces: ['desktop'],
    toolResult: () => ({ result: {} }),
    stat: () => {
      throw new Error('ENOENT')
    },
    usageFails: false,
    cwd: 'C:/tmp/project',
    stored: { language: 'en', ...store },
    writeFails: false,
    copyOk: true,
    copied: [],
    compactCalls: [],
    promptCalls: [],
  }
  // The store, in memory (the test reads back what the plugin kept in `w.stored`).
  on('store.get', (_: any, e: any) => ({ value: w.stored[e.key] }))
  on('store.set', (_: any, e: any) => {
    w.stored[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    delete w.stored[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(w.stored) }))
  on('command.register', (_: any, e: any) => {
    w.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    w.opened.push({ id: e.id, title: e.title, focus: e.focus, closeOnEscape: e.closeOnEscape })
    return { value: { isPlaced: true } }
  })
  on('ui.copy', (_: any, e: any) => {
    w.copied.push(e)
    return { value: { isCopied: w.copyOk } }
  })
  on('ui.close', (_: any, e: any) => {
    w.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: w.surfaces }))
  on('session.cwd', () => ({ value: w.cwd }))
  on('session.usage', () => {
    if (w.usageFails) throw new Error('no usage')
    return { value: w.usage }
  })
  on('session.compact', { trigger: 'plugin' }, (_: any, e: any) => {
    w.compactCalls.push(e)
    if (w.compactFails) throw new Error('compaction failed')
    return w.compact
  })
  on('session.messages', () => ({ value: [{ role: 'user', text: 'hi', toolUses: [] }] }))
  on('agent.list', () => ({ value: w.agents }))
  on('fs.write', (_: any, e: any) => {
    if (w.writeFails) throw new Error('disk full')
    w.files[slash(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.read', (_: any, e: any) => {
    const hit = w.files[slash(e.path)]
    if (hit === undefined) throw new Error('ENOENT ' + e.path)
    return { value: hit }
  })
  on('fs.stat', (_: any, e: any) => {
    try {
      return { value: w.stat(e.path) }
    } catch {
      return { value: { kind: 'file', size: 0, mtimeMs: 0, isLink: false } }
    }
  })
  on('model.complete', (_: any, e: any) => {
    w.models.push(e.prompt)
    w.modelIds.push(e.model)
    const r = typeof w.modelReply === 'function' ? w.modelReply(e.prompt) : w.modelReply
    return { value: r }
  })
  on('prompt.submit', (_: any, e: any) => {
    if (e.origin?.kind === 'plugin') {
      if (w.submitFails) return { drop: 'refused' }
      w.submitted.push(e)
      return { text: e.text }
    }
    w.promptCalls.push(e)
    return { text: e.text }
  })
  on('session.measure', (_: any, e: any) => ({ changed: e.changed }))
  on('prompt.compose', () => ({ sections: [] }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      const q = e.questions[0]
      w.asks.push({ question: q.question, header: q.header, options: q.options.map((o: any) => o.label) })
      if (w.ask.fail || w.ask.answer === undefined) return { deny: 'dismissed' }
      return { result: { questions: e.questions, answers: { [q.question]: w.ask.answer } } }
    }
    return w.toolResult(e)
  })
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return w
}

export const start = ($: any, surface: 'desktop' | 'terminal' = 'desktop') =>
  $.session.start({ cwd: 'C:/tmp/project', surface, isInteractive: true })

/** Starts the session and forgets the toasts the other features raise while loading. */
export async function begin($: any, w: World, surface: 'desktop' | 'terminal' = 'desktop') {
  await start($, surface)
  w.toasts.length = 0
}

export const done = (id = 't1', extra: Record<string, unknown> = {}) => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  turnId: id,
  reason: 'answer' as const,
  ...extra,
})

export async function finishTurn($: any, id = 't1', extra: Record<string, unknown> = {}) {
  await $.turn.start({ text: 'hi', turnId: id })
  return $.turn.complete(done(id, extra))
}

/** The band shows two lines and hides the rest behind a toggle: open it so every line is drawn. */
export async function openBand(ui: any) {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle !== undefined && /more|עוד/.test(String(toggle.props['label']))) await ui.press({ key: 'toolkitty-band-toggle' })
}

export async function bandLine($: any, slug: string, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) {
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface })
  await openBand(ui)
  const line = await ui.find({ key: `band-${slug}` })
  const row = line ?? (await ui.find({ key: `band-row-${slug}` }))
  const text = row?.text as string | undefined
  await ui.unmount()
  return text
}

/** Presses the band line's Button and returns the mounted detail pane (the caller unmounts it). */
export async function openDetail($: any, slug: string, surface: 'desktop' | 'terminal' = 'desktop') {
  const band = await $.ui.mount({ ...BAND, surface })
  await openBand(band)
  const direct = await band.find({ key: `band-${slug}` })
  await band.press({ key: direct !== undefined ? `band-${slug}` : `band-more-${slug}` })
  await band.unmount()
  return $.ui.mount({ ...DETAIL, surface })
}

export const textsOf = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
export const allText = async (ui: any): Promise<string> => (await textsOf(ui)).join('\n')

export const iso = (ms: number) => new Date(ms).toISOString()

/** The usage moved: the answer of `$.session.usage()` changes, then the measure event is raised as the engine does. */
export async function measure($: any, w: World, limits: Limit[], context?: { tokens?: number; percent?: number }) {
  w.usage.rateLimits = limits
  if (context !== undefined) w.usage.context = { window: 200_000, ...context }
  return $.session.measure({ context: w.usage.context, rateLimits: limits, changed: ['rateLimits'] })
}

export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Composes the system prompt as the engine does; returns the sections the plugin added. */
export async function compose($: any) {
  const r = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] })
  return r.sections as { id: string; text: string; scope: string }[]
}

/** A prompt as the person's Enter sends it. */
export const submitPrompt = ($: any, text: string, extra: Record<string, unknown> = {}) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...extra })

export const bashResult = (stdout: string, stderr = '') => ({
  result: { stdout, stderr, interrupted: false },
  text: [stdout, stderr].filter(x => x !== '').join(String.fromCharCode(10)),
})

/**
 * The notices one feature raised, oldest first. A toast is a notice now: the notices pane draws each row as
 * [age, text, feature id], so the text before a feature-id Text is the notice.
 */
export async function noticesOf($: any, featureId: string, surface: 'desktop' | 'terminal' = 'desktop'): Promise<string[]> {
  const ui = await $.ui.mount({ ...paneOf('toolkitty-notices'), surface })
  const texts = await textsOf(ui)
  await ui.unmount()
  const found: string[] = []
  texts.forEach((x, i) => {
    if (x === featureId && i > 0) found.push(texts[i - 1] as string)
  })
  return found.reverse()
}
