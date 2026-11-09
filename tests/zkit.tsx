import { NOON, world } from './harness'
import { ALL_IDS } from './zids'

/*
 * The test `$` has no state noun, so the atoms (signals, evidence, context-health, the features' own slots)
 * live in an in-memory map beneath the plugin, which the tests also seed directly.
 */
type Slot = { value: unknown; version: number }
export let slots = new Map<string, Slot>()
const slotKey = (e: any): string => `${e.plugin}/${e.key}/${e.id ?? ''}`

/** Every feature off except `ids`; the efficiency/receipt tests drive the signals themselves. */
export const only = (...ids: string[]): Record<string, boolean> => Object.fromEntries(ALL_IDS.map(id => [id, ids.includes(id)]))

export function setup(on: any, ids: string[], o: Parameters<typeof world>[1] = {}) {
  slots = new Map()
  items = []
  evidence = []
  const w = world(on, { ...o, store: { enabled: only(...ids), ...(o.store ?? {}) } })
  on('state.get', (_: any, e: any) => {
    const s = slots.get(slotKey(e))
    return { value: { value: s?.value, version: s?.version ?? 0 } }
  })
  on('state.set', (_: any, e: any) => {
    const prev = slots.get(slotKey(e))
    const version = prev?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    slots.set(slotKey(e), { value: e.value, version: version + 1 })
    return { value: { isSet: true, version: version + 1 } }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  return w
}

export const slotValue = (id: string): any => slots.get(`toolkitty/slot/${id}`)?.value
const bump = (id: string, value: unknown): void => {
  const k = `toolkitty/slot/${id}`
  slots.set(k, { value, version: (slots.get(k)?.version ?? 0) + 1 })
}

let items: Record<string, unknown>[] = []
export const resetSignals = (): void => {
  items = []
}

/** Puts one signal on the bus (replacing its id); `ageMs` old by the mock clock. */
export const put = (id: string, kind: string, extra: Record<string, unknown> = {}, ageMs = 0): void => {
  const signal = { id, feature: id.split(':')[0] ?? 'x', kind, level: 'info', text: id, at: NOON - ageMs, ...extra }
  items = [...items.filter(x => x['id'] !== id), signal]
  bump('signals', { items })
}

let evidence: Record<string, unknown>[] = []
export const resetEvidence = (): void => {
  evidence = []
}
/** An evidence record at the mock now. */
export const putEvidence = (kind: string, ok: boolean, at: number = NOON): void => {
  evidence = [...evidence, { at, kind, ok, summary: `${kind} ${ok ? 'ok' : 'failed'}`, ref: kind, feature: 'seed' }]
  bump('evidence', { items: evidence })
}

export const setHealth = (score: number, at: number = NOON): void => bump('context-health', { score, at })

/** The points of one dimension as the pane draws them: the "n/20" after its label. */
export async function pointsOf(ui: any, label: string): Promise<number | undefined> {
  const all: string[] = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  const i = all.indexOf(label)
  if (i < 0) return undefined
  for (let j = i + 1; j < all.length; j++) {
    const m = /^(\d+)\/20$/.exec(all[j] ?? '')
    if (m !== null) return Number(m[1])
  }
  return undefined
}
