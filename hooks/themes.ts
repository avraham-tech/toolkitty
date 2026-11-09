/**
 * Theme packs: the colors the eye-candy features read from the shared `theme`
 * slot. Types and pure helpers only: no atoms and no `$` live here, so every
 * file that needs a Theme can import it.
 */
export type Theme = {
  id: string
  name: string
  aurora: {
    idle: [string, string, string]
    working: [string, string, string]
    warn: [string, string, string]
    danger: [string, string, string]
  }
  receipt: { footer: string; accent: string }
  buddy: { frame: string; accent: string }
}

export const BUILTIN_THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    aurora: {
      idle: ['#0ea5e9', '#14b8a6', '#2563eb'],
      working: ['#8b5cf6', '#d946ef', '#6366f1'],
      warn: ['#f59e0b', '#fb923c', '#d97706'],
      danger: ['#ef4444', '#f43f5e', '#f97316'],
    },
    receipt: { footer: '', accent: '#d97757' },
    buddy: { frame: '', accent: '#e5484d' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    aurora: {
      idle: ['#fb7185', '#f97316', '#f59e0b'],
      working: ['#ec4899', '#f43f5e', '#fb923c'],
      warn: ['#fbbf24', '#f59e0b', '#ea580c'],
      danger: ['#dc2626', '#be123c', '#9f1239'],
    },
    receipt: { footer: 'SEE YOU AT DUSK', accent: '#f97316' },
    buddy: { frame: '#fb7185', accent: '#f97316' },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    aurora: {
      idle: ['#00ff66', '#00b34a', '#007a33'],
      working: ['#39ff14', '#00e676', '#00c853'],
      warn: ['#c6ff00', '#aeea00', '#76ff03'],
      danger: ['#ff3d3d', '#ff6e40', '#c6ff00'],
    },
    receipt: { footer: 'WAKE UP, NEO', accent: '#00ff66' },
    buddy: { frame: '#00ff66', accent: '#39ff14' },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    aurora: {
      idle: ['#a5d8ff', '#b2f2bb', '#d0bfff'],
      working: ['#d0bfff', '#fcc2d7', '#a5d8ff'],
      warn: ['#ffec99', '#ffd8a8', '#fcc2d7'],
      danger: ['#ffa8a8', '#fcc2d7', '#ffd8a8'],
    },
    receipt: { footer: 'STAY SOFT', accent: '#f783ac' },
    buddy: { frame: '#c4a7ff', accent: '#f783ac' },
  },
]

const HEX = /^#[0-9a-fA-F]{6}$/

const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

function triple(v: unknown): [string, string, string] | undefined {
  if (!Array.isArray(v) || v.length !== 3) return undefined
  const [a, b, c] = v as unknown[]
  return isHex(a) && isHex(b) && isHex(c) ? [a, b, c] : undefined
}

/** A Theme from parsed JSON, or undefined when any field is missing or not a plain #rrggbb color. */
export function parseTheme(raw: unknown): Theme | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const o = raw as Record<string, unknown>
  const aurora = o.aurora as Record<string, unknown> | undefined
  const receipt = o.receipt as Record<string, unknown> | undefined
  const buddy = o.buddy as Record<string, unknown> | undefined
  if (typeof o.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(o.id)) return undefined
  if (typeof o.name !== 'string' || o.name.trim() === '') return undefined
  if (typeof aurora !== 'object' || aurora === null) return undefined
  if (typeof receipt !== 'object' || receipt === null) return undefined
  if (typeof buddy !== 'object' || buddy === null) return undefined
  const idle = triple(aurora.idle)
  const working = triple(aurora.working)
  const warn = triple(aurora.warn)
  const danger = triple(aurora.danger)
  if (idle === undefined || working === undefined || warn === undefined || danger === undefined) return undefined
  if (typeof receipt.footer !== 'string' || !isHex(receipt.accent)) return undefined
  if (!(buddy.frame === '' || isHex(buddy.frame)) || !isHex(buddy.accent)) return undefined
  return {
    id: o.id,
    name: o.name.trim().slice(0, 24),
    aurora: { idle, working, warn, danger },
    receipt: { footer: receipt.footer.slice(0, 32), accent: receipt.accent },
    buddy: { frame: buddy.frame, accent: buddy.accent },
  }
}
