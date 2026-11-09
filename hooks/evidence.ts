import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface } from 'claude-code'

/*
 * The evidence layer: what actually happened, as opposed to what the model
 * says happened. Features that observe a verifiable result record it here
 * (a test run's exit code, a build, a lint, a typecheck, a file diff, a git
 * command); the Goal Tracker, the claim check and the handoff read it.
 *
 *   await recordEvidence($, { kind: 'test', ok: true, summary: 'npm test · 42 passed', ref: 'npm test' })
 *
 * A record is a fact about one action at one moment. It never contains file
 * contents or secrets: `summary` is one short line, `ref` names the command or
 * the file. The value is a shared slot (same ref in every reader); the last 200
 * records of the session are kept in the slot; the handoff pane reads them from there.
 */

export type EvidenceKind = 'test' | 'build' | 'lint' | 'typecheck' | 'diff' | 'git' | 'run'

export type Evidence = {
  at: number
  kind: EvidenceKind
  /** True when the action succeeded (tests passed, build ok, diff applied). */
  ok: boolean
  /** One short line a person can read: "npm test · 42 passed, 0 failed". */
  summary: string
  /** The command or file the record is about. */
  ref: string
  /** The turn it happened in, when known. */
  turnId?: string
  /** The feature that recorded it. */
  feature: string
}

export type EvidenceLog = { items: Evidence[] }

const MAX = 200

const evidence = atom({ plugin: 'toolkitty', key: 'slot', id: 'evidence' } as const, { items: [] } as EvidenceLog) as unknown as Atom<EvidenceLog>

/** Records one fact. */
export async function recordEvidence($: EngineInterface, item: Omit<Evidence, 'at'> & { at?: number }): Promise<void> {
  const at = item.at ?? (await $.clock.now())
  const full: Evidence = { ...item, at }
  await update($, evidence, log => ({ items: [...log.items.slice(-(MAX - 1)), full] }))
}

/** Every record of the session, oldest first. Inside a render hook this subscribes the drawing. */
export async function allEvidence($: EngineInterface): Promise<Evidence[]> {
  return (await read($, evidence)).items
}

/** The newest record of a kind, or undefined. */
export function latestOf(items: readonly Evidence[], kind: EvidenceKind): Evidence | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const x = items[i]
    if (x !== undefined && x.kind === kind) return x
  }
  return undefined
}

/** Records since a moment (a turn's start), oldest first. */
export function since(items: readonly Evidence[], at: number): Evidence[] {
  return items.filter(x => x.at >= at)
}

/** A one-line verdict for a kind: 'passed' | 'failed' | 'none'. */
export function verdictOf(items: readonly Evidence[], kind: EvidenceKind): 'passed' | 'failed' | 'none' {
  const last = latestOf(items, kind)
  return last === undefined ? 'none' : last.ok ? 'passed' : 'failed'
}
