# Tests

Run from the plugin folder: `claude plugin test .` (a few minutes; run nothing else in parallel).
Use Claude Code 2.1.319: the backdrop and its mocks use `theme.set` / `theme.clear`, replacing the
older `ui.backdrop` API from 2.1.317.
Expected result: 1943 tests across 102 files, 1943 pass, 0 fail, no file failing to load.
The shared helpers (`harness.tsx`, `world.tsx`, `_kit.tsx`, `about-kit.tsx`, `zkit.tsx`, `zids.ts`) live beside the tests and are imported as `./harness` and so on.
Each test file covers one feature; `harness.tsx` answers every engine call the plugin makes on `$`.
Tests carry a 30 s timeout because a full run on a busy machine makes the 5 s default flaky.
