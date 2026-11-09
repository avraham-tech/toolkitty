import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

import type { Level } from './ui'

/*
 * The signals bus: the one place features say what is going on, and the one
 * input of the advisor and the smart bar's headline. A feature never reads
 * another feature's atom; it publishes a Signal here and the advisor reads
 * them all.
 *
 *   await publish($, { id: 'plan-pace:weekly', feature: 'plan-pace', kind: 'quota', level: 'warn',
 *                      value: 91, text: 'weekly 91%, resets in 2d 4h' })
 *   await retract($, 'plan-pace:weekly')
 *
 * `id` is stable per thing being described (publishing again replaces). A
 * signal with `ttlMs` expires on its own; without one it stays until retracted.
 * The value is a shared slot: every file that reads it declares the same ref.
 */

export type SignalKind =
  | 'context' // context window fill, value = percent
  | 'quota' // 5h / 7d window, value = percent used
  | 'budget' // budget guard state, value = percent of the worst window
  | 'cache' // prompt cache: warm/cold, value = seconds left
  | 'failure' // tool failures this turn, value = count
  | 'loop' // a loop pattern is active
  | 'waste' // duplicate reads / repeated commands, value = count
  | 'saving' // tokens kept out of the context, value = tokens
  | 'incident' // a guard blocked something, value = count this session
  | 'waiting' // the person is being asked for approval
  | 'working' // a tool is running, text = what
  | 'done' // a turn ended; value = files changed; text = evidence summary
  | 'evidence' // tests/build/lint results, value = 1 ok / 0 failed
  | 'agents' // subagents running/denied, value = running

export type Signal = {
  id: string
  feature: string
  kind: SignalKind
  level: Level
  text: string
  value?: number
  at: number
  ttlMs?: number
}

export type Signals = { items: Signal[] }

const signals = atom({ plugin: 'toolkitty', key: 'slot', id: 'signals' } as const, { items: [] } as Signals) as unknown as Atom<Signals>

/** Publishes (or replaces) one signal. */
export async function publish($: EngineInterface, signal: Omit<Signal, 'at'> & { at?: number }): Promise<void> {
  const at = signal.at ?? Date.now()
  const full: Signal = { ...signal, at }
  await update($, signals, s => ({ items: [...prune(s.items, at).filter(x => x.id !== signal.id), full] }))
}

/** Removes one signal (nothing happens when it is not there). */
export async function retract($: EngineInterface, id: string): Promise<void> {
  await update($, signals, s => (s.items.some(x => x.id === id) ? { items: s.items.filter(x => x.id !== id) } : s))
}

/** Removes every signal of a feature (when it is switched off or a turn resets it). */
export async function retractAll($: EngineInterface, feature: string): Promise<void> {
  await update($, signals, s => (s.items.some(x => x.feature === feature) ? { items: s.items.filter(x => x.feature !== feature) } : s))
}

/** The live signals, expired ones left out. Inside a render hook this subscribes the drawing. */
export async function current($: EngineInterface, now: number = Date.now()): Promise<Signal[]> {
  const s = await read($, signals)
  return prune(s.items, now)
}

function prune(items: Signal[], now: number): Signal[] {
  return items.filter(x => x.ttlMs === undefined || x.at + x.ttlMs > now)
}

const LEVEL_RANK: Record<Level, number> = { alert: 3, warn: 2, info: 1, ok: 0 }

/** The highest level among signals (ok when none). */
export function worstLevel(items: readonly Signal[]): Level {
  let worst: Level = 'ok'
  for (const s of items) if (LEVEL_RANK[s.level] > LEVEL_RANK[worst]) worst = s.level
  return worst
}

/** Signals of one kind, newest first. */
export function ofKind(items: readonly Signal[], kind: SignalKind): Signal[] {
  return items.filter(x => x.kind === kind).sort((a, b) => b.at - a.at)
}
