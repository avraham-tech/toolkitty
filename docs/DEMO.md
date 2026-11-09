# Demo mode (`/demo`)

Fills the band and the panes with clearly labelled synthetic data so a screenshot or a GIF shows a lively toolkitty, then puts your real data back. Every synthetic text carries the word **DEMO** (notices, evidence summaries, incident details, achievement and session titles), and the band shows a `🎬 DEMO` chip for as long as it runs, so no capture can pass as real usage.

## Commands

| Command | What it does |
|---|---|
| `/demo` | Opens the Demo mode pane: the three scenes as buttons, what is replaced, and the exact restore command. |
| `/demo on [scene]` | Starts the demo (scene `busy` unless you name one, or the one last used). |
| `/demo scene calm\|busy\|rescue` | Starts the demo in that scene, or switches the running one. |
| `/demo off` | Retracts the demo signals, restores every replaced key, posts "Demo mode ended". |

## What it does, exactly

- **Signals** (the same bus the real features use): context, quota, budget, failure, loop, waste, saving, incident (with a time to live), working (`npm test`, its seconds tick up every second), agents, evidence. All are published with feature `demo` and retracted by `/demo off`; other features' signals are never touched.
- **30 notices** through `notice()`, all starting with `[DEMO]`, levels spread through the list (busy: 18 info, 9 warn, 3 alert).
- **8 evidence records** (test, build, lint, typecheck, diff, git, run, test), all `[DEMO]`.
- **Stores** the read-only panes draw from, written under their real keys. Before any key is written its current value is copied to `demo:backup:<key>` (a key that did not exist is recorded as absent, and removed again on restore):
  `week-heatmap:days` (12 weeks), `savings:days` (30 days), `incidents:<folder>` (5 items), `achievements:unlocked` (3), `session-finder:index` (6 sessions), `buddy:name` (`Pixel`; the companion's seed is never touched).
- Starting twice, or switching scene, never backs up demo data over the real data. A demo that outlives its session is cleaned up at the next session start.

What stays after `/demo off`: the notices and evidence records the demo posted remain in the session's logs (they are labelled DEMO) until the session ends; there is no API to take a notice back.

## The scenes

| Scene | Headline | What it shows |
|---|---|---|
| `calm` | green / "working npm test" | Everything low: context 31%, weekly 12%, budget 18%, 41k tokens saved, one agent running, tests passed. 28 info notices and 2 warnings, no alerts. Activity halved. Use it for the "this is what a good day looks like" shot. |
| `busy` | red "3 repeated failures" | The mixed scene: context 83%, weekly quota 46% (warn), budget 91% (warn), 3 failures, a loop, 6 duplicate reads, 254k tokens saved, an older incident, `2 running · 1 denied`, tests passed. 30 notices of every level. Use it for the band, `/notices`, `/advisor`. |
| `rescue` | red "blocked: rm -rf" | An incident that was just blocked (the ticker keeps it fresh, so the headline stays red for the whole recording), one agent denied, moderate numbers, 4 alerts among the notices. Use it for the "it saved me" story. |

## Recording a 20-second GIF

Start the recording at an idle prompt with a quiet terminal or desktop window, ~100 columns wide.

1. **Before recording**: `/demo scene busy` (or `rescue`). Close the pane it may have opened. Notices raise toasts for alerts; wait about 5 seconds for them to clear.
2. **0-4 s, the band.** Show the band: the `🎬 DEMO` chip, the red headline, the chips beside it. Press "more" to expand the full lines for a moment.
3. **4-8 s, `/notices`.** Thirty notices with the bell count; scroll slowly once.
4. **8-12 s, `/savings`.** The savings card with 30 days of history.
5. **12-15 s, `/sessions`.** The six `[DEMO]` sessions.
6. **15-18 s, `/advisor`.** The recommendations the busy or rescue signals produce.
7. **18-20 s, `/demo off`.** The chip disappears and "Demo mode is off; your data is back." appears. Ending on the restore is honest and makes a good last frame.

Scene order for a longer take: `calm` (3 s) then `/demo scene busy` then `/demo scene rescue`; switching scenes replaces the signals instantly and adds one notice, not thirty.

## Known limits

- `/heatmap`, `/wrapped` and `/incidents` draw from state the features load into memory at session start, so they do not show the demo's store values until those features re-read their keys (the demo writes the real keys, as specified, and cannot reach another feature's state). `/savings`, `/sessions` and the buddy's evolution read their stores while drawing and do show the demo. If you need the heatmap in a shot, that is a small change in `week-heatmap.tsx` (re-read `week-heatmap:days` when the pane opens).
- `achievements:unlocked` has no reader yet; the demo writes it so the achievements pane will show it when it exists. Its item shape (`{ id, at, title }`) is the demo's own guess.
- Quiet mode (the notices preference) drops non-alert notices, so with quiet mode on, only the alerts of the demo are recorded.
- Signal texts (`npm test`, `2 running · 1 denied`) stay in English because the advisor matches on them; the DEMO label for signals is the band chip.
