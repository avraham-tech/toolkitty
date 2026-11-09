<!--
DRAFT README for the repository root. Written 2026-11-09 by the launch
think-tank session. Before copying to the root:
  - replace every <repo> with the final repository name
  - replace the three GIF placeholders with real files under docs/assets/
  - keep the feature table generated: it is produced from hooks/features/index.ts
    (regenerate when a feature is added, removed or renamed)
  - the "Tested on" line must describe a real clean-profile run (see docs/LAUNCH-PLAN.md, section 5)
-->

<p align="center">
  <img src="docs/assets/banner.png" alt="Toolkitty: your coding companion for Claude Code" width="800">
</p>

<h3 align="center">Monitor · Optimize · Protect · Verify</h3>

<p align="center">
  91 switchable features for Claude Code, each one a toggle in a pane. A tiny cat watches your session,
  guards block the dangerous commands, meters show where context and money go, and nothing leaves your
  machine that you did not ask to send.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#see-it-in-action">See it in action</a> ·
  <a href="https://github.com/avraham-tech/<repo>/issues">Report an issue</a> ·
  <a href="#what-leaves-your-machine">Privacy</a>
</p>

---

## Install

Toolkitty is a Claude Code plugin. Two commands, inside Claude Code or in a terminal:

```text
/plugin marketplace add avraham-tech/<repo>
/plugin install toolkitty@avraham-tech
```

```bash
claude plugin marketplace add avraham-tech/<repo>
```

```bash
claude plugin install toolkitty@avraham-tech
```

One command on Claude Code 2.1.292 or newer:

```bash
claude plugin install toolkitty --marketplace avraham-tech/<repo>
```

Then start a new session. The welcome wizard opens: pick a language, pick how much you want to see
(Minimal, Productive or Playful), meet your companion. `/toolkitty` (or `/tk`) opens the switchboard with
every feature and its switch.

**Requirements.** Claude Code 2.1.3xx (desktop app or CLI). Git on your PATH for the git-aware features.
A terminal at least ~100 columns wide for the status band. Tested on: *Windows 11, Claude Code desktop
app* (other platforms: see [Platforms](#platforms-and-known-limits)).

**Update.** `claude plugin marketplace update avraham-tech` then `claude plugin update toolkitty@avraham-tech`.
Toolkitty also checks GitHub once a day for a newer release and tells you with a toast.

**Uninstall.** `claude plugin uninstall toolkitty@avraham-tech`. Your projects keep their own
`.claude/toolkitty.json` only if you created one with `/toolkitty-export`.

## See it in action

<!-- GIF 1: companion reveal, 6-8 s -->
![The welcome wizard reveals your companion](docs/assets/gif-companion.gif)

<!-- GIF 2: guardrail, 8-12 s, recorded in /demo scene rescue -->
![A broad rm -rf is blocked and a safety receipt explains why](docs/assets/gif-guardrail.gif)

<!-- GIF 3: smart bar and savings, 8-12 s, recorded in /demo scene busy -->
![The status band, the advisor and the savings card](docs/assets/gif-smart-bar.gif)

The clips above were recorded with `/demo`, which fills the panes with synthetic data; every synthetic
number carries a **DEMO** label in the recording. Nothing in them is a measurement of a real project.

## What it does

Three things you will notice in the first hour:

- **Monitor and optimize.** A status band above the prompt: context fill, cost, plan usage, cache state,
  what Claude is doing right now. The advisor turns those into two or three recommendations. The
  duplicate-read detector, output archive and output trimmer keep wasted context out of the conversation
  and `/savings` adds up what they kept out, as an estimate.
- **Protect and verify.** Guards block broad `rm -rf`, force-push, `reset --hard`, piping downloads into a
  shell, writes to `.env` and key files, and secrets pasted into prompts. Every block produces a safety
  receipt that says what kind of action it was and that your review is required. The goal tracker marks a
  task verified only when a real test, build, lint or diff says so, never because the model said so.
- **A companion.** A pet with a rarity roll that sleeps when you are idle, works beside you, celebrates
  green builds and worries about errors. It grows by verified events (tests passed, incidents prevented,
  tokens saved), never by spending.

Everything is a switch. Three profiles set sensible defaults; the guards stay on in all of them.

## Features

91 features in 12 groups, generated from the catalogue in `hooks/features/index.ts`. "Default" is the
state after a fresh install in the Productive profile.

<details>
<summary>Full feature list</summary>


<!-- FEATURE_TABLE_START -->

#### Insight & tracking

| Feature | Default | What it does |
|---|---|---|
| Smart Advisor | on | The band headline and a few recommendations, worked out from what the other features see. No model calls. |
| Task pulse | on | A line above the prompt box: current turn time, actions in it, and total actions in the session. |
| Cost meter | on | A line above the prompt box: the session cost so far and how full the context window is. |
| Model indicator | on | A line above the prompt box: which model and effort level the current turn is running on. |
| Failure counter | on | A line above the input box when actions failed in the current turn, with a session summary. |
| Turn summary | on | A short line under the answer: how many files were edited and how many actions ran in the turn. |
| Files this turn | on | A pane with the files read and edited in the current turn (the /files-touched command). |
| Command log | on | A pane with the Bash commands run in the session, their duration, success and a re-run button (/bash-log). |
| Turn history | on | A pane with the last 20 turns: duration, actions and a small chart (/turn-history). |
| Efficiency score | off | A transparent 0-100 score per session and per week from five dimensions, each with its formula shown. Based on your own history only; there is no global ranking. Off by default. |

#### Alerts

| Feature | Default | What it does |
|---|---|---|
| Done notification | on | A system notification when a long turn finishes or a permission approval is needed. |
| Long turn | on | A toast every 5 minutes while a turn runs for a long time. |
| Break reminder | on | After an hour of continuous work: a toast suggesting a break. |

#### Guardrails

| Feature | Default | What it does |
|---|---|---|
| Secret protection | on | Blocks writes to secret files (.env, keys, credentials); reading is allowed. |
| Dangerous commands | on | Blocks destructive commands: broad rm -rf, force push, reset --hard and more. |
| Branch lock | off | Blocks file edits while on main or master. |
| Secret masking | on | Hides keys and passwords in command output before the model sees it. |
| Safety receipts | on | When a guard blocks or redacts something, a small receipt shows what kind of action it was, what was done and that your review is required. The share text names the kind only, never paths or values. |

#### Automation after actions

| Feature | Default | What it does |
|---|---|---|
| Auto-format | on | Runs prettier / ruff / gofmt / rustfmt on an edited file, when the tool exists in the project. |
| Lint after edit | on | Runs ESLint / ruff on an edited file and passes the problems to the model so it fixes them. |
| Tests on change | off | Runs the test file next to the edited file and reports to the model only on failure (may be slow). |
| Output trimming | on | Shortens long Bash output (over 200 lines) and keeps the beginning and the end. |
| Undo edits | on | Saves a version before every edit; /edit-undo restores the last one, /edit-undo list shows the list. |

#### Workflow & commands

| Feature | Default | What it does |
|---|---|---|
| Standup | on | /daily-standup: what was done today, based on commits and change stats. |
| Commit message | on | /commitmsg: suggests a commit message from the staged changes and puts it in the prompt box. |
| Context info | on | /ctx: context fill percentage, tokens, cost and usage limits. |
| Prompt snippets | on | Type !fix or !review at the start of a message and it expands into a full prompt; /snippet manages them. |
| Git context | on | Injects the branch, changed files and latest commits into the model, refreshed every turn. |
| Memory across sessions | on | Remembers prompts and notes (/remember) per folder and reminds the model of them in later sessions. |
| Pinned files | on | /pin pins files; their current contents are injected into the model every turn. |
| Prompt history | on | /history shows the last 50 messages in the session; /history <number> puts one back in the box. |
| Prompt enhancer | off | Scores each prompt for clarity with a simple heuristic and, when it is vague, asks whether to send it as is, use a clearer rewrite, or edit it first. Never rewrites silently. |

#### Panes & comfort

| Feature | Default | What it does |
|---|---|---|
| Explain error | on | The /explain command explains the latest error and what to fix. |
| Summary | off | Adds a short summary in English to long answers (costs tokens). |
| Focus mode | off | Shortens long tool results (over 30 lines) to 10 lines; ctrl+o shows everything. |
| Task board | on | A pane with the session task list (/board): ✔ done, ▸ in progress, ○ pending. |
| Agents monitor | on | A pane with the sub-agents running now and for how long (/subagents). |
| Notes | on | A notepad per folder, kept across sessions (/notes). |
| Commit reminder | on | A line above the prompt box when 10 or more files are uncommitted. |
| Daily total | on | A line showing how many hours you worked with Claude today, across all sessions. |
| Copy answer | on | /copy-last copies the last answer; /copy-last code copies only the last code block. |

#### Quotas & cache

| Feature | Default | What it does |
|---|---|---|
| Plan pace | on | Shows your 5-hour and weekly plan usage, the time to reset, and whether you are burning through it faster than the window allows. |
| Cache countdown | on | Shows how long the prompt cache stays warm after the last turn, and warns before a cold-cache send of a large context. |
| Auto-continue after limit | off | When a usage limit is hit, waits for the window to reset and then resumes the task automatically. |
| Subagent guard | on | Caps how many subagents run at once, how many a session may spawn, and how many tokens they may use. |
| Idle handoff | off | After a long idle, when the context is large and the cache is cold, suggests /handoff to compact the session cheaply. |
| Budget guard | on | When your weekly or 5-hour usage gets close to the limit, asks for your approval before each prompt, so the last percent is not burned on something unimportant. |
| Savings meter | on | Adds up the context Toolkitty kept out of the conversation (trimmed and archived output), as an estimate in tokens and dollars. /savings shows the totals. |

#### Context hygiene

| Feature | Default | What it does |
|---|---|---|
| Handoff preview | on | /handoff shows a draft of the goal, what is done, decisions, files, failures and next step, lets you add notes, and compacts the session with exactly that draft when you press Compact now. |
| Context Doctor | on | A transparent 0-100 health score for the conversation (context fill, duplicate reads, cold cache, repeated failures) and four clearly separated token numbers. /context-doctor opens it; it never compacts anything by itself. |
| Duplicate read detector | on | Spots wasted context: files read again unchanged and commands repeated needlessly. /waste lists the top offenders. |
| Output archive | on | Moves long tool output (over 8,000 characters) into a file and keeps only the start in the context. /recall searches it, /archive lists it. |
| Correction capture | on | Learns from your corrections: turns "no, not like that" into a lasting rule for this project and gives it to the model every turn. /rules manages them. |

#### More guardrails

| Feature | Default | What it does |
|---|---|---|
| Error detective | on | Groups repeated failures by signature (same command, same error), spots fixes that change nothing and loops, warns you and nudges the model to investigate the cause before editing again. /errors lists the patterns. |
| Loop detective | on | Notices when Claude goes in circles (the same failing command, edit-then-fail cycles, repeated calls), warns you and nudges the model to change approach. |
| Scope guard | off | /scope limits file edits to the paths you declare; edits outside them are blocked. |
| Claim check | off | Warns when the answer claims tests pass, the build is green or something was verified, but no matching command ran this turn. |
| Pasted secret scan | on | Redacts API keys and tokens from your prompts before they reach the model, and blocks git add / git commit when added lines contain a secret. |
| Merge gate | on | Holds git push and gh pr merge until the pull request's CI checks are green. /merge-gate allow grants a one-time pass. |
| Injection tripwire | on | Flags instruction-like text (prompt injection) in fetched web pages and MCP results, and tells Claude to treat it as data. |
| Blast radius | on | Before rm -r, git clean, git reset --hard, find -delete and similar, checks what would really be touched and blocks large ones until you allow them. |
| Disasters prevented | on | Counts every time a guard stopped something (secrets, destructive commands, red CI...) and shows a card when it saved the turn. |

#### Visibility

| Feature | Default | What it does |
|---|---|---|
| Goal tracker | on | Turns the task list and your acceptance criteria into goals and marks each verified only by real evidence (a passing test, build, lint, typecheck or a diff), never by the model's word. |
| Live ticker | on | One live line above the prompt with what Claude is doing right now, and for how long. |
| Waiting alert | on | Reminds you if Claude has waited a minute for your approval, and can push to your phone (ntfy.sh) when you are waiting or a long turn is done. |
| Agent profiler | on | Where the time goes: model wait vs tools vs subagents, per turn and for the session (/profile). |
| Decision ledger | off | After each answer, a cheap model lists choices and assumptions Claude made without asking; /decisions shows them. Calls a model every turn. |
| Diff review | on | After a turn, /diff-review lists the files it changed with +added −removed lines and lets you revert each one. |
| Session finder | on | Titles each session with a cheap model and keeps an index; /find <term> searches it, /sessions lists the latest. |
| Weekly report | on | A weekly recap that reads like a letter: hours, turns, cost, what Toolkitty saved and stopped. Opens once a week; /report shows it any time. |
| Mission Control | on | A pane listing every running Claude Code session on this machine and which ones need you (/mission). |
| Time machine | on | Keeps a file-level checkpoint after every turn that changed files; /timeline lets you inspect, compare and restore them. |
| Session replay | on | One readable, filterable timeline of the session: turns, tools, edits, errors, checks, incidents and approvals (/replay). |
| Task ETA | off | An honest estimate of the time left on the open task: a range from your own past tasks, shown only after 5 finished ones (/eta). |

#### Eye candy

| Feature | Default | What it does |
|---|---|---|
| Buddy | on | A companion pet that reacts to your session: sleeps when idle, works with you, celebrates green builds, worries about errors. |
| Turn receipt | on | After a long or busy turn, prints a thermal-printer receipt: tool counts, time, tokens and cost. |
| Week heatmap & Wrapped | on | A contributions-style heatmap of your last 12 weeks (/heatmap) and a shareable Wrapped card (/wrapped). |
| Aurora backdrop | off | Desktop only: a slowly drifting aurora behind the window. Blue and teal when idle, violet while working, amber past 70% context, red past 90%. |
| Context aquarium | on | The context window as a fish tank: the water rises with usage and turns murky, each tool call in a turn is a fish, bubbles rise while Claude works. |
| Theme packs | on | Colors for the aurora backdrop, the turn receipt and the buddy. Four built-in themes (/themes); add your own as JSON in ~/.claude/toolkitty-themes/. |
| Sounds | off | Plays a soft chime when a long turn (over 30 seconds) finishes. Off by default; try the four sounds with /sounds test. |
| Achievements | on | Trophies earned by verified results: passing tests, disasters prevented, tokens saved, days of use. Never for spending or risky behaviour. |
| Share cards | on | A gallery of four share cards (savings, safety, achievement, companion) with a privacy preview. Cards are made on this machine; nothing is ever uploaded (/cards). |

#### Setup & maintenance

| Feature | Default | What it does |
|---|---|---|
| Display profiles | on | Three ready-made setups (Minimal, Productive, Playful) for how much Toolkitty shows; safety guards stay on in all of them. /profiles shows and switches |
| Welcome wizard | on | A short first-run wizard: pick a language and a profile, then meet your companion. /welcome reopens it |
| Project profiles | on | Reads .claude/toolkitty.json from the repo so a team shares one setup; /toolkitty-export writes it, /toolkitty-profile shows it |
| Update check | on | Once a day, looks for a newer Toolkitty release on GitHub and tells you with a toast. Nothing is sent but the request itself. |
| Self-test | on | Runs every capability of the plugin live inside the real app (panes, backdrop, sound, clipboard, store, clock, processes, feature health) and shows what actually worked. /selftest runs it; /selftest model adds one paid model call. |
| Toolkitty Doctor | on | /envcheck checks git, CLAUDE.md, tools, tests, Toolkitty setup and secrets, scores the environment, and offers reversible fixes on a button press |
| About & support | on | Version, credits and links; /about opens it. After many sessions the weekly report may mention an optional symbolic coffee, once, and never again if you dismiss it. |
| Demo mode | on | Fills the panes and the band with clearly labelled synthetic data for screenshots and GIFs, then restores your real data. /demo on, /demo off, /demo scene calm\|busy\|rescue. |
<!-- FEATURE_TABLE_END -->

</details>

## Commands you will use most

| Command | What it opens |
|---|---|
| `/toolkitty`, `/tk` | The switchboard: every feature, its switch, search, language picker |
| `/home` | The hub: what is live now, the band, quick links |
| `/advisor` | Recommendations worked out from what the other features see |
| `/context-doctor` | Context health score and four separate token numbers |
| `/savings` | What Toolkitty kept out of the conversation, estimated |
| `/incidents` | Everything a guard stopped |
| `/goals` | Goals and their evidence |
| `/handoff` | A draft handoff you can edit, then compact with exactly that text |
| `/wrapped`, `/cards` | The weekly Wrapped card and four share cards, made locally |
| `/selftest`, `/envcheck` | Live self-test of the plugin; environment check with reversible fixes |
| `/demo on`, `/demo off` | Synthetic data for screenshots, then your data back |
| `/toolkitty help <question>` | Asks a small model which feature does what |

## Platforms and known limits

- Developed and tested on Windows 11 in the Claude Code desktop app. macOS and Linux have not been
  tested by the author yet; reports are welcome in the issues.
- The desktop build used for development draws no window backdrops and has no OS notification channel,
  so the Aurora backdrop reports itself unavailable there and alerts arrive as toasts. Terminal sessions
  render the band and panes as text.
- Ten UI languages (English, Hebrew, Spanish, French, Russian, Chinese, Japanese, Portuguese, German,
  Korean). The nine translations have not yet had a native-speaker review; English is the reference.
- Toolkitty adds roughly 2,000 characters (about 500 tokens) of context per turn for the features that
  inject information for the model (git context, pinned files, rules). Switch those off if every token
  counts. The status band redraws in under 10 ms.

## What leaves your machine

Toolkitty has no server and sends no telemetry, analytics or crash reports. Four kinds of network traffic
can happen, each listed here:

1. **Update check** (on by default, switchable): once a day, one GET to GitHub's releases API for this
   repository. Nothing but the request.
2. **Push alerts** (only if you set a URL with `/push-url`): a one-line status such as "waiting for your
   approval" POSTed to the server you chose, for example your own ntfy topic.
3. **Share buttons**: open your browser with the card text pre-filled on the network you picked. Nothing
   is sent until you post it yourself.
4. **Small-model features**: some features ask Claude Haiku through your own Claude Code account, exactly
   like a prompt you type. Toolkitty never sees the text.
   - On command only: `/commitmsg` (staged diff), `/explain` (latest error), `/toolkitty help`,
     `/selftest model`.
   - Off by default: prompt enhancer, summary, decision ledger.
   - **On by default and automatic** (switch either off in `/toolkitty`, or pick the Minimal profile):
     *Correction capture* sends a message of yours that looks like a correction ("no, use tabs") at the end
     of the turn, to distil it into a project rule. *Session finder* sends your first three prompts and an
     excerpt of one answer, a few times per session, to give the session a title.

Everything else (savings, incidents, cards, receipts, trophies, exports, notes, rules) is computed and
stored locally in Claude Code's plugin store and, if you export it, in `.claude/toolkitty.json` of the
project. Exported cards and share texts never contain your name, paths, project name or prompt text:
paths are reduced to file names and secret-like strings are masked before anything is copied.

## Guardrails: what they are and are not

Guards block commands and edits that match known-dangerous patterns: broad `rm -rf`, force-push without
lease or to main, `reset --hard`, piping a download into a shell, writes to secret files, secrets in
pasted text or staged lines, pushes while CI is red, edits outside a declared scope. They are pattern
rules, not a sandbox. A command that does not match is not blocked, and you can switch any guard off or
grant a one-time pass where the guard offers one. A blocked command is reported as "potentially
dangerous"; Toolkitty never claims to know what damage it prevented.

Found a way past a guard that should have caught something? That is a bug: please report it.

## Security

Toolkitty runs as a Claude Code plugin with the same permissions as Claude Code itself and does not
elevate them. Its hooks are plain TypeScript in `hooks/`, readable before you install. To report a
vulnerability privately, use GitHub's "Report a vulnerability" on this repository; see
[SECURITY.md](SECURITY.md).

## FAQ

**Does it slow Claude down?** The band redraws in under 10 ms. Features that run a tool after an edit
(format, lint, tests) take as long as that tool takes; tests-on-change is off by default for that reason.

**Can I use it in a team?** `/toolkitty-export` writes `.claude/toolkitty.json` into the repo so everyone
gets the same switches. Guard settings follow it too.

**Where are my cards and receipts saved?** In a `toolkitty-exports` folder in the project, or in
`Documents/Toolkitty/exports` for sessions without a folder. `/exports` lists them.

**Is it free?** Yes, MIT. There is no paid tier and nothing is locked. If it saved you time, a symbolic
coffee is welcome (see below), and nothing changes if you never give one.

## Support the project

Made by [Avraham Shemesh](https://github.com/avraham-tech) in spare time. Star the repository, tell a
colleague, open an issue, or buy a symbolic coffee: <!-- SUPPORT_URL --> · GitHub Sponsors. See
[SUPPORT.md](SUPPORT.md).

## License

MIT, see [LICENSE](LICENSE). The Toolkitty name, the cat mascot and the logo are trademarks of Avraham
Shemesh and are not covered by the MIT license; forks are welcome under a different name and mascot.
