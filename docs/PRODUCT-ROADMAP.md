# Product roadmap

Status words: planned · in progress · implemented (code + tests green) · verified (seen working in the live app) · deferred.

## Phase 0 — Audit and architecture (done 2026-11-08)
- Feature matrix, architecture plan, UX spec, test plan, growth and monetization notes: **implemented** (this folder).
- Baseline: 72 features, 1,184 tests green, preview harness of 58 screens, design system applied.
- Performance baseline: full suite 2m05s; preview suite 58 drawings in ~25 s. A self-profile of Toolkitty's own handlers is part of Phase 1.

## Phase 1 — Core intelligence
| Item | Depends on | Status |
|---|---|---|
| Signals bus | — | implemented (15 publishers) |
| Advisor (rules, actions, cooldowns, `/advisor` pane) | signals | implemented (29 tests) |
| Smart bar headline + chip limit by profile | advisor | implemented |
| Notification center: dedupe, cooldown, prefs, quiet mode, immediate feedback | — | implemented (categories deferred to achievement work) |
| Profiles Minimal / Productive / Playful (guards never off) | — | implemented (`/profiles`, 28 tests) |
| Self-profile of toolkitty handlers (`/toolkitty perf`) | — | planned |

## Phase 2 — Productivity (implemented 2026-11-08, dev copy)
| Item | Status |
|---|---|
| Evidence layer (`hooks/evidence.ts`; recorded by test-on-change, lint-after-edit, claim-check, diff-review) | implemented |
| Goal Tracker + Proof of Work (`/goals`, `/goal add|na`; verified / unverified / failed / n-a / open) | implemented (22 tests) |
| Context Doctor (`/context-doctor`; transparent score, four labelled numbers, no compaction claims) | implemented (15 tests) |
| Error Detective (`/errors`; failure signatures, ineffective-fix cycles, nudge with cooldown) | implemented (26 tests) |
| Token Leak Detector (leak kinds in savings: dup-read, repeat-cmd, failed-attempt, agent-spend; four-way section) | implemented |
| One-click handoff with editable preview (`/handoff` → pane → Compact now) | implemented (22 tests) |
Known limits: Context Doctor's "reclaimable" is an estimate until a compaction result is read; Error Detective's loop detection reuses loop-detective's signal; the handoff draft is English.

## Phase 3 — Workflow (implemented 2026-11-08, dev copy)
| Item | Status |
|---|---|
| Live self-test `/selftest` (opens every pane, probes backdrop, notify, audio, clipboard, store, clock, processes; model opt-in) | implemented (17 tests) |
| Mission Control `/mission` (heartbeat files per session; read-only; prune) | implemented (23 tests) |
| Prompt Enhancer `/enhance` (heuristic clarity score, ask before send, optional Haiku rewrite; off by default) | implemented (35 tests) |
| Toolkitty Doctor `/doctor` (9 checks, transparent score, reversible fixes behind a confirmation) | implemented (43 tests) |
| Time Machine `/timeline` (per-turn checkpoints, inspect/compare/restore with conflict check, git restore per file) | implemented (21 tests) |
| Session Replay `/replay` (bounded event log, filters, masking, keep across sessions opt-in) | implemented (24 tests) |
| Task ETA `/eta` (ranges only, needs 5 finished tasks; off by default) | implemented (30 tests) |
| About & support `/about` (credits, links, FUNDING.yml, SUPPORT.md, gentle footer after 30 sessions) | implemented (16 tests; placeholders OWNER/REPO to fill) |
Known limits: no navigation between sessions (engine); time-machine, session-replay have no band chip, so their detail views are reachable only through their own panes; `/profiles` and `/context-doctor` names avoid collisions with `/profile` and `/context`.

## Live verification (2026-11-08)
`/selftest` in the real desktop app: 43 live checks ok. Found and fixed: 11 slash commands collided with Claude Code built-ins or another plugin and the refusal aborted the feature's session start (renamed: /smart, /subagents, /ctx, /copy-last, /diff-review, /envcheck, /edit-undo, /goals add|na, /daily-standup, /board, /themes; every registration now survives a refusal with a notice). Surface facts: this desktop build draws neither backdrops (Aurora reports it) nor placed transcript rows (receipt and incident card use panes) and has no OS-notification channel (alerts toast instead). 1,597 tests green.

## Phase 4 — Viral experience (implemented 2026-11-09, dev copy)
| Item | Status |
|---|---|
| Achievements `/trophies` (12 trophies from verified facts only; unlock once; shelf with hints; share) | implemented (49 tests) |
| Pet progression by verified events (XP: tests passed, incidents prevented, tokens saved, trophies, hours; stages 0/150/600) | implemented (buddy tests rewritten) |
| Share cards `/share` (savings, safety, achievement, pet; 1200×630 SVG; redaction layer `hooks/sharing.ts`; privacy line; never uploads) | implemented (19 tests) |
| Efficiency score `/efficiency` (five 0–20 dimensions with printed formulas, own history only; off by default) | implemented (60 tests) |
| Safety receipts `/safety-receipt` (receipt pane on each incident; "potentially dangerous", never "damage prevented"; Details / Share redacted / Dismiss) | implemented (31 tests) |
| Demo mode `/demo on|off|scene calm|busy|rescue` (synthetic data through the real channels, every text labelled DEMO, store backups restored on off) | implemented (19 tests; `docs/DEMO.md`) |
| Self-profile `/toolkitty perf` (ms per feature per event, chars added to system prompt and tool context, state size per slot) | implemented |
Known limits: panes that load their store once at session start (heatmap, wrapped, incidents, buddy name) show demo data only after a reload; demo notices and evidence stay in the session log, labelled; existing pets re-stage by XP (hours still count 1/h); Minimalist trophy unlocks only while Achievements is on; `/share` and `/demo` names still to be confirmed against built-ins in the live `/selftest`.

## Performance baseline (live app, 2026-11-09, before the parallel-render fix)
`/perf` after a few minutes: 2,635 handler calls, 29.2 s summed handler time; the band above the prompt was redrawn ~91 times, each redraw running ~58 render handlers one after another at ~10 ms each (every handler awaits the store or the clock), i.e. roughly half a second of handler time per redraw while live-ticker redraws every second. System prompt added by Toolkitty: 2,091 chars (~520 tokens) per compose. State in memory: 836 KB in 83 slots, 501 KB of it edit-undo's file snapshots (capped at 2 MB). Fix applied: band and chip handlers now run concurrently (`Promise.all`), so a redraw costs the slowest handler instead of the sum; the report now prints redraw count and wall time per redraw for the after-measurement. **After (live, same day):** 6 band redraws in 35 ms wall, worst 8 ms (from ~500 ms); band render handlers 2–4 ms each; the remaining summed time is one-off session-start work (prompt-enhancer, buddy, week-heatmap, about, ~0.2–0.3 s each). System prompt cost unchanged at ~2.1k chars per compose.

## Localization (2026-11-09)
Ten UI languages: en, he, es, fr, ru (core, required in every literal) + zh, ja, pt-BR, de, ko (optional in the type; `t()` and `pick()` fall back to English). 2,212 literals carry all ten, verified by `scratchpad/check_i18n.py` (placeholders must match). Language picker: 🌐 in the switchboard opens a row of ten; the welcome wizard lists all ten; `LOCALES` drives collation and dates, `LANG_ENGLISH_NAMES` tells models which language to answer in. Left intentionally en/he: the prompt-enhancer rewrite templates (they follow the prompt's own script). Source grew to ~2.2 MB; a plugin load takes ~1.2 s in the test harness. Before release: a Fable/Mythos-tier review of every translation for natural wording and double meanings (see RELEASE-CHECKLIST). Phase 5 candidate: move the five extra languages to per-language JSON loaded at session start if live load time is felt.

## Export layer (2026-11-09)
Every visual pane shares `hooks/exports.tsx`: Save SVG / Copy / Share / Open folder / Copy path; stable folder (project, Documents fallback for scratch sessions, or chosen); `/receipt` with persisted history; `/exports` pane. Validator run found two more built-in collisions (`/loops` → `/repeats`, `/share` → `/cards`) and a non-self-contained types contract (fixed); the only directory refusal left is the missing README (Phase 5).

## Release 2026-11-09 (shared copy)
The dev copy was released to `~/.claude/skills/toolkit` (every open session reloads once). Backup of the previous shared copy: `~/.claude/skills/toolkit-backup-20261109-1633`. Rollback: delete the folder and rename the backup.

## Rename (2026-11-09)
Product name Toolkitty: plugin id `toolkitty`, `/toolkitty` + `/tk`, Toolkitty in all ten languages, `toolkitty-exports`, `Documents/Toolkitty/exports`, `.claude/toolkitty.json`. 360 files, 2,389 tests green, validator passes. No fallback for state stored under the old name (nobody but the author had it). A generator bug surfaced on the way: `/toolkit perf` had never matched (a literal backspace in the regex); fixed.

## Phase 5 — Product readiness
- Mascot states (buddy reacts to signals; see GROWTH-STRATEGY) — planned next after the rename.
Performance pass with before/after numbers · UX polish from the preview harness · localization review · onboarding polish · README with GIFs, LICENSE, icon (the directory validator asks for all three) · release to `~/.claude/skills/toolkit` and GitHub · Free / Pro / Teams boundaries documented only.

## Acceptance criteria (every phase)
Existing tests green; new tests in the engine kit for every new handler, pane button and command; type-check and engine-rule scan clean; strings in five languages; feature off-switch honoured; no new network calls without opt-in; preview regenerated and reviewed.
