# Architecture plan

## As it is (2026-11-08)

- **One plugin, one hooks module.** `hooks/register.tsx` is *generated* (`scratchpad/gen_register.py`) from what each feature file exports. The engine allows each event without a matcher to be registered once per module, so register.tsx registers each shared event once and calls every feature's handler in turn (`onSessionStart`, `onTurnStart`, `onTurnComplete`, `onMeasure`, `afterToolCheck`, `beforeToolCall` / `afterToolCall`, `beforeBashCall` / `afterBashCall`, `beforeEditCall` / `afterEditCall`, `onPromptSubmit` (rewrite or drop), `onPromptCompose`, `renderBand`, `renderChip`, `renderDetail`). A feature's own `register(on)` holds only hooks unique to it (its commands, its panes, single-tool matchers). Every handler is wrapped by a guard: a failing feature is reported once and never stops the others.
- **State.** Engine atoms (`atom({ plugin:'toolkitty', key:'slot', id })`), one per feature, written in the file that uses it (engine rule). Shared values are the *same ref* declared in several files: `enabled`, `savings`, `incidents`, `theme`, `notices`. Cross-session persistence in `$.store` (keys prefixed by feature id).
- **UI.** `hooks/ui.tsx`: levels (ok / info / warn / alert), chips, `paneHeader`, `emptyState`, `listRow`, `sectionTitle`. Band = chip row (attention first) + expandable full lines + bell. Panes: `toolkitty` (switchboard), `toolkitty-detail`, `toolkitty-notices`, `toolkitty-home`, and one per feature.
- **Language.** `core.ts` `t()` over five languages; model-facing prompts English, model output in the user's language; commit messages English.
- **Tests.** 1,184 tests on `claude-code/testing`, run with the desktop app's bundled 2.1.317 CLI; grouped runner to keep the machine usable.
- **Engine rules learned** (all enforced at load): no identifier named `on`/`next`/`$`/`h`; `$` passed only to function declarations or imports; one registration per unmatched event; atoms literal and in-file; no circular import into `features/index.ts`; `$.ui.open` fails before a surface attaches; `session.compact` cannot run inside a `command.run` hook.

## What changes for the Intelligence phases

### Signals bus (`hooks/signals.ts`, shared slot `signals`)
`type Signal = { id: string; feature: string; kind: SignalKind; level: Level; value?: number; text: string; at: number; ttlMs?: number }`. Features publish with `publish($, signal)` (replace by id) and `retract($, id)`. Kinds: `context`, `quota`, `budget`, `failure`, `loop`, `waste`, `saving`, `incident`, `waiting`, `working`, `done`, `cache`. The bus is the *only* input of the advisor and of the smart bar headline, so no feature reads another feature's atom.

### Advisor (`hooks/features/advisor.tsx`)
Deterministic rules over the signal set → `Recommendation { id, level, title, body, actions: ActionRef[], cooldownMs }`. Actions are a registry of named, top-level functions exported by features (`openPane(id)`, `handoffPreview`, `budgetAllow`, `budgetLock`, `blastAllow`, `openDetail(feature)`), referenced by name so the advisor imports only functions (engine rule). Dismissal and cooldown per rule in store. No model calls.

### Smart bar headline
Computed from signals by priority (security > waiting > destructive > resource exhaustion > repeated failures > recommendations > progress > stats > decoration). One headline chip first in the row; other chips limited by the display profile (Minimal 2, Productive 5, Playful all). `renderChip` stays per feature; the headline is the advisor's chip.

### Notification center upgrades (`core.ts`)
`notice()` gains: dedupe (same feature+text within 5 min increments a count), per-feature cooldown, categories (`critical | action | warning | info | achievement`), preferences in store (`notices:prefs`: min level to toast, quiet mode), grouping by feature in the pane.

### Profiles (`project-config` + onboarding)
Minimal / Productive / Playful as named sets; guards (dangerous-commands, protect-secrets, pasted-secret-scan, secret-mask, budget-guard, incidents) are never switched off by a profile; granular overrides persist on top.

### Evidence layer (Phase 2)
`hooks/evidence.ts`: `Evidence { at, kind: 'test'|'build'|'lint'|'typecheck'|'diff'|'git', ok, summary, ref }` appended by test-on-change, lint-after-edit, claim-check, diff-review; consumed by Goal Tracker and claim-check.

### Later layers
Event timeline (Phase 3: turn-history + bash-log + files-touched + incidents → one bounded log), sharing layer (Phase 4: redaction + SVG cards + copy), achievements (Phase 4).

## Integration rules for every phase
1. New shared types live in a `.ts` file with no `$` and no atoms; atoms are declared in each consumer.
2. New handlers are added to the generator's HANDLERS list, never by hand in register.tsx.
3. Every new feature: `T` table ×5, `isOn` first, `renderChip` if it has a band line, tests in its group folder, type-check, rule scan.
4. Development happens in the session's dev copy; release = copy to `~/.claude/skills/toolkit` on the user's word.
