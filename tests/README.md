# Tests

Run from the plugin folder: `claude plugin test .` (a few minutes; run nothing else in parallel), or
`bash tools/run_tests.sh --cli <claude>`, which runs the same suite on a clean copy of the working tree.
Expected result: 1966 tests across 103 files, 1966 pass, 0 fail, no file failing to load.

**Two engines.** Claude Code 2.1.319 moved the backdrop from `ui.backdrop` to `theme.set` / `theme.clear`,
and the plugin speaks both (`hooks/backdrop.ts`). A test may only register mocks for events its engine
knows, so `engine.ts` holds `BACKDROP_API`: `'theme'` (the committed value) for 2.1.319 and later, `'ui'`
for a 2.1.317 CLI. `bash tools/run_tests.sh --cli <claude 2.1.317> --api ui` sets it in the copy for you.
The suite passes on both.
The shared helpers (`harness.tsx`, `world.tsx`, `_kit.tsx`, `about-kit.tsx`, `zkit.tsx`, `zids.ts`, `engine.ts`) live beside the tests and are imported as `./harness` and so on.
Each test file covers one feature; `harness.tsx` answers every engine call the plugin makes on `$`.
Tests carry a 30 s timeout because a full run on a busy machine makes the 5 s default flaky.
