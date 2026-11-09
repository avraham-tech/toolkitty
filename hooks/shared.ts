/** Types shared between feature files (types only: no atoms, no `$`). */

/** The `savings` slot: what Toolkitty estimates it kept out of the context. */
export type Savings = {
  /** Estimated tokens kept out of the context (Math.ceil(chars / 4)). */
  tokens: number
  /** Estimated dollars: tokens times the default rate of $0.000003 per input token. */
  usd: number
  /** Estimated tokens per feature id. 'dup-read-detector' is "flagged, not yet saved" and is not part of `tokens`. */
  byFeature: Record<string, number>
  /**
   * Hypothetical opportunities, "if avoided": estimated tokens per leak kind. Not part of `tokens`.
   * Kinds so far: 'dup-read', 'repeat-cmd' (dup-read-detector), 'failed-attempt' (error-detective),
   * 'agent-spend' (subagent-guard). Read it as `s.leaks ?? {}`: a file that initialises the slot without it leaves it unset.
   */
  leaks: Record<string, number>
}

/** One thing a guard feature stopped, redacted or flagged. `detail` carries kinds and file names, never a secret value. */
export type Incident = { at: number; feature: string; kind: string; detail: string }

/** The `incidents` slot: how many, the newest 100, and when the last one happened. */
export type Incidents = { count: number; items: Incident[]; lastAt: number | null }
