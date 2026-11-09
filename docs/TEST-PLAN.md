# Test plan

## Harness
Engine test kit (`claude-code/testing`) run with the desktop app's bundled CLI 2.1.317 (`plugin test <folder>`); the npm `claude` on PATH is 2.1.209 and lacks it. Tests live in `tests/*.test.tsx` (one per feature, plus `register.test.tsx` for the main module and `smoke.test.tsx`). During development they are grouped A–H under `scratchpad/testmods/<G>/tests` and run one group at a time (`run_group_tests.sh`) so the machine stays usable; the preview harness (`testmods/P`) renders all 58 screens to HTML.

## Per feature (existing checklist, kept)
Load + command registration · every command argument form · every pane and every Button/Input · every hook with good and bad inputs · band line, chip and detail pane · off switch · timers via mock clock · English and Hebrew.

## Phase 1 additions
- Signals: publish/retract/ttl expiry; a feature off publishes nothing.
- Advisor: each rule fires on its signal set and not otherwise; priority order; cooldown and dismissal persistence; every action button calls its function (observable through the bottom hooks it triggers).
- Headline: one state at a time, priority table, 10 s decay of done/security states, chip limit per profile.
- Notices: dedupe count, cooldown, quiet mode, prefs, grouping; alerts still toast; nothing else toasts.
- Profiles: applying never turns guards off; overrides survive a profile change.
- Interaction tests: all features enabled at once (maximum configuration) through a long scripted session (turns, tools, denies, limits) asserting no skipped hooks.
- Performance: time of the maximum-configuration script before and after each phase (the kit reports per-test ms); a per-handler self-profile report asserted to exist.

## Later phases
Evidence layer: a claim without evidence is "unverified"; a failed test marks "failed"; verified requires a matching ok result. Time machine: restore refuses when the file changed since the snapshot. Mission control: heartbeat file written per turn and read back; missing files degrade to "no data". Share cards: redaction removes paths, secrets and project names unless allowed. Achievements: unlock exactly once; no unlock from unsafe behaviour.

## Done means
All groups green; type-check clean; engine-rule scan clean (`scan` in the generator pipeline); preview regenerated; limitations written into the feature's description.
