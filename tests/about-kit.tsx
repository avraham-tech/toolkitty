import { mock } from 'claude-code/testing'

export const SLOW = { timeoutMs: 30_000 }
// Monday 9 Nov 2026, local noon: ISO week 2026-W46 whatever the machine's time zone
export const NOW = new Date(2026, 10, 9, 12).getTime()
export const WEEK = '2026-W46'
export const CWD = 'C:/work/proj'
const HOUR = 3_600_000
const OWN_FAILURE = /feature (about|monday-report) failed/

const pad2 = (n: number) => String(n).padStart(2, '0')
/** The local day key the report uses, `back` days before NOW. */
export const dayKey = (back: number) => {
  const d = new Date(2026, 10, 9 - back, 12)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** A little activity this week, so the weekly report has something to show. */
export const activity = (): Record<string, unknown> => ({
  'week-heatmap:days': {
    [dayKey(4)]: { turns: 10, ms: 2 * HOUR, tokens: 250_000, cost: 4.25 },
    [dayKey(0)]: { turns: 3, ms: HOUR / 2, tokens: 1_500_000, cost: 1.5 },
  },
})

export const PANE = (requestId: string, title = 'Pane') =>
  ({
    plugin: 'toolkitty',
    component: 'Pane',
    requestId,
    props: { title, isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

export type Plan = { copy: 'ok' | 'refused' | 'throw'; manifest: string | null }

export function boot(on: any, store: Record<string, unknown> = {}, surfaces: string[] = ['desktop']) {
  const kv = new Map<string, unknown>(Object.entries({ language: 'en', 'onboarding:done': true, ...store }))
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    kv.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    kv.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...kv.keys()] }))
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:/Users/test', TEMP: 'C:/tmp' })
  mock.session(on)
  const seen = {
    commands: [] as string[],
    toasts: [] as string[],
    opened: [] as any[],
    copies: [] as { text: string; surface?: string }[],
    reads: [] as string[],
  }
  const plan: Plan = { copy: 'ok', manifest: JSON.stringify({ name: 'toolkitty', version: '0.1.0' }) }
  on('command.register', (_: any, e: any) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', (_: any, e: any) => {
    if (OWN_FAILURE.test(e.text)) throw new Error('a feature handler threw: ' + e.text)
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', (_: any, e: any) => {
    seen.copies.push({ text: e.text, surface: e.surface })
    if (plan.copy === 'throw') throw new Error('clipboard')
    return { value: plan.copy === 'ok' ? { isCopied: true } : { isCopied: false, reason: 'refused' } }
  })
  on('fs.read', (_: any, e: any) => {
    seen.reads.push(String(e.path))
    if (String(e.path).replace(/\\/g, '/').endsWith('/.claude-plugin/plugin.json') && plan.manifest !== null) return { value: plan.manifest }
    throw new Error('ENOENT ' + e.path)
  })
  on('session.cwd', () => ({ value: CWD }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { used: 0, total: 1, percent: 0, window: 200000 }, rateLimits: [], cost: { totalUsd: 0 } },
  }))
  on('agent.list', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'fatal', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const opens = (id: string) => seen.opened.filter(o => o.id === id)
  return { clock, seen, plan, kv, opens }
}

export const start = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.session.start({ cwd: CWD, surface, isInteractive: true })

export const texts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((f: any) => String(f.text))
export const buttonKeys = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key))
export const buttonLabels = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.props.label ?? b.text))

/** Everything Toolkitty noticed, as the notices pane shows it. */
export async function noticeTexts($: any): Promise<string[]> {
  const ui = await $.ui.mount({ ...PANE('toolkitty-notices', 'Notices'), surface: 'desktop' })
  const out = await texts(ui)
  await ui.unmount()
  return out
}

export const aboutPane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('about', 'About Toolkitty'), surface })
export const reportPane = ($: any, surface: 'desktop' | 'terminal' = 'desktop') => $.ui.mount({ ...PANE('monday-report', 'Your week with Toolkitty'), surface })
