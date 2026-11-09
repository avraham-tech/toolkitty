import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export const CWD = 'C:/proj'

export type ProcOut = { exitCode: number; stdout: string; stderr: string }

export type Rig = {
  regs: string[]
  toasts: string[]
  opened: string[]
  closed: string[]
  copied: string[]
  played: string[]
  clock: ReturnType<typeof mock.clock>
  /** What the engine answers a tool call with (the bottom of tool.call). */
  answer: (e: Record<string, unknown>) => Record<string, unknown>
  /** What the engine answers $.process.run with. */
  proc: (argv: string[]) => ProcOut | 'throw' | Promise<ProcOut | 'throw'>
  procs: string[][]
  reads: string[]
  /** fs: path -> text, or { dir: [names] }. */
  files: Record<string, string>
  dirs: Record<string, { name: string; kind: 'file' | 'dir' }[]>
  /** Whether $.ui.open reports the pane as placed on a surface. */
  placed: boolean
  /** Whether $.ui.copy succeeds. */
  copyOk: boolean
  /** Whether the plugin's sounds/shield.wav exists. */
  hasSound: boolean
  /** What entered the session through prompt.submit. */
  entered: { text: string; context?: readonly string[] }[]
  /** Every string the engine saw go by (toasts, copies, procs, opened ids): for "never appears anywhere". */
  seen: () => string
}

export function rig(
  on: On,
  o: { enabled?: Record<string, boolean>; lang?: string; store?: Record<string, unknown>; cwd?: string; now?: number; os?: string } = {},
): Rig {
  const cwd = o.cwd ?? CWD
  mock.store(on, { language: o.lang ?? 'en', ...(o.enabled === undefined ? {} : { enabled: o.enabled }), ...(o.store ?? {}) })
  const clock = mock.clock(on, { now: o.now ?? 1_000_000 })
  mock.env(on, { USERPROFILE: 'C:/Users/test', HOME: 'C:/Users/test', ...(o.os === '' ? {} : { OS: o.os ?? 'Windows_NT' }) })
  mock.session(on)
  const r: Rig = {
    regs: [],
    toasts: [],
    opened: [],
    closed: [],
    copied: [],
    played: [],
    clock,
    answer: () => ({}),
    proc: () => ({ exitCode: 0, stdout: '', stderr: '' }),
    procs: [],
    reads: [],
    files: {},
    dirs: {},
    entered: [],
    placed: true,
    copyOk: true,
    hasSound: false,
    seen: () => JSON.stringify([r.toasts, r.opened, r.copied, r.procs, r.played]),
  }
  on('command.register', (_, e) => {
    r.regs.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => {
    r.opened.push(String((e as unknown as { id: string }).id))
    return { value: { isPlaced: r.placed } }
  })
  on('ui.close', (_, e) => {
    r.closed.push(String((e as unknown as { id: string }).id))
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    r.toasts.push((e as unknown as { text: string }).text)
    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    r.copied.push((e as unknown as { text: string }).text)
    return { value: { isCopied: r.copyOk } } as never
  })
  on('audio.play', (_, e) => {
    r.played.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => {
    const a = r.answer(e as unknown as Record<string, unknown>)
    return (a['isError'] === true ? { result: a['text'] ?? 'error', ...a } : 'result' in a ? a : { result: a }) as never
  })
  on('process.run', async (_, e) => {
    const argv = [...(e as unknown as { argv: readonly string[] }).argv]
    r.procs.push(argv)
    const out = await r.proc(argv)
    if (out === 'throw') throw new Error('spawn failed')
    return { value: out } as never
  })
  on('fs.exists', (_, e) => ({ value: (r.hasSound && /sounds.shield\.wav$/.test((e as unknown as { path: string }).path)) || (e as unknown as { path: string }).path.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '') in r.files }) as never)
  on('fs.read', (_, e) => {
    const p = (e as unknown as { path: string }).path.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '')
    r.reads.push(p)
    if (!(p in r.files)) return { deny: 'ENOENT ' + p } as never
    return { value: r.files[p] } as never
  })
  on('fs.stat', (_, e) => {
    const p = (e as unknown as { path: string }).path.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '')
    if (p in r.dirs) return { value: { kind: 'dir', size: 0, mtimeMs: 0 } } as never
    if (p in r.files) return { value: { kind: 'file', size: (r.files[p] ?? '').length, mtimeMs: 0 } } as never
    return { deny: 'ENOENT ' + p } as never
  })
  on('fs.list', (_, e) => {
    const p = (e as unknown as { path: string }).path.split(String.fromCharCode(92)).join('/').replace(/\/+$/, '')
    return { value: r.dirs[p] ?? [] } as never
  })
  on('turn.start', (_, e) => ({ turnId: (e as unknown as { turnId: string }).turnId }) as never)
  on('turn.complete', (_, e) => ({ text: (e as unknown as { answer: string }).answer }) as never)
  on('prompt.compose', () => ({ sections: [] }) as never)
  on('prompt.submit', (_, e) => {
    const x = e as unknown as { text: string; context?: readonly string[] }
    r.entered.push({ text: x.text, context: x.context })
    return { text: x.text, context: x.context } as never
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return r
}

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} }
const PANE_PROPS = { title: 'Toolkitty', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} }

export function mountBand($: any, o: { surface?: string; hasSurvey?: boolean } = {}): Promise<any> {
  return $.ui.mount({ plugin: 'toolkitty', surface: o.surface ?? 'desktop', component: 'AbovePrompt', props: { ...BAND_PROPS, hasSurvey: o.hasSurvey ?? false } })
}

export function mountPane($: any, id: string, o: { surface?: string; rows?: number } = {}): Promise<any> {
  return $.ui.mount({
    plugin: 'toolkitty',
    surface: o.surface ?? 'desktop',
    component: 'Pane',
    requestId: id,
    props: PANE_PROPS,
    ...(o.rows === undefined ? {} : { viewport: { columns: 100, rows: o.rows } }),
  })
}

/** All Text strings drawn in a mount, joined. */
export async function texts(ui: any): Promise<string> {
  const all = await ui.findAll({ type: 'Text' })
  return all.map((x: { text: string }) => x.text).join('\n')
}

/** Expands the band so every feature line shows; returns whether a toggle was pressed. */
export async function expandBand(ui: any): Promise<boolean> {
  const toggle = await ui.find({ key: 'toolkitty-band-toggle' })
  if (toggle === undefined) return false
  if (/more|עוד/.test(String(toggle.props['label']))) {
    await ui.press({ key: 'toolkitty-band-toggle' })
    return true
  }
  return false
}

export const COMPOSE = { model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] }

/**
 * The notices one feature raised, oldest first. A toast is a notice now (only an alert still toasts): the notices
 * pane draws each row as [age, text, feature id], so the text before a feature-id Text is the notice.
 */
export async function noticesOf($: any, featureId: string, surface = 'desktop'): Promise<string[]> {
  const ui = await mountPane($, 'toolkitty-notices', { surface })
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: { text: string }) => x.text)
  await ui.unmount()
  const found: string[] = []
  all.forEach((x, i) => {
    if (x === featureId && i > 0) found.push(all[i - 1] as string)
  })
  return found.reverse()
}

/** The text of one feature's FULL band line (Button `band-<slug>`); call expandBand first. Chips share words with lines, so never search by text. */
export async function lineOf(ui: any, slug: string): Promise<string | undefined> {
  return (await ui.find({ key: `band-${slug}` }))?.text
}

/** The same notice inside five minutes is one row with a count (`text ×n`); this unfolds each row back to n copies of its text. */
export const unfold = (rows: string[]): string[] =>
  rows.flatMap(x => {
    const m = / ×(\d+)$/.exec(x)
    return m === null ? [x] : Array<string>(Number(m[1])).fill(x.slice(0, m.index))
  })

/** What happened between two unfolded lists: the entries whose count grew, as many times as they grew. */
export const added = (before: string[], after: string[]): string[] => {
  const left = before.slice()
  return after.filter(x => {
    const i = left.indexOf(x)
    if (i >= 0) left.splice(i, 1)
    return i < 0
  })
}
