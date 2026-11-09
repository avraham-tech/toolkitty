# Show HN (final copy, 2026-11-09)

**Asset needed:** none in the post itself (HN is text). The README must already show GIF 1 (companion),
GIF 2 (guardrail with DEMO chip) and GIF 3 (band and savings) because every reader clicks through to the
repo. Do not post before the GIFs are real.

**Numbers to re-check on the day:** feature count (91), test count (1,936), version (v0.1.0), Buddy issue
reactions (2,117 on 2026-11-09, issue #45596).

**Post as:** a Show HN with the repo URL as the link and the text below as the first comment, or as a text
post with the URL inside. The first form is what most Show HNs do; the title still begins "Show HN:".

**Rules (verified today):** be around for three hours, answer every question, never ask anyone to upvote or
comment, no exclamation marks, no praise in the title.

## Title (choose one; under 80 characters)

1. `Show HN: Toolkitty – guardrails, context meters and a cat for Claude Code`
2. `Show HN: Toolkitty – 91 switchable features for Claude Code, local-first`
3. `Show HN: I gave Claude Code a cat (and 90 other switches)`

Recommendation: 1. It names the three things people search for and keeps the cat as the hook without
making it the whole pitch. Option 3 is the most clickable and the most likely to be flagged as cute.

## Text

I use Claude Code all day and kept wanting the same small things: to know how full the context is
before it compacts, to stop it from running a broad `rm -rf` or force-pushing to main, to see what a turn
actually cost, and to be told when a "tests pass" claim had no test run behind it. Toolkitty is those
things as one plugin, plus a cat.

What it is: 91 features, each a switch in a pane. A status band above the prompt (context, cost, plan
usage, cache state, what Claude is doing now). Guards that block dangerous commands, writes to secret
files and pasted secrets, each with a receipt explaining what was blocked and why. A goal tracker that
marks a task verified only when a real test, build, lint or diff ran. Context hygiene: duplicate-read
detection, archiving of long tool output, a handoff draft you edit before compaction. And the pet: a
companion with a rarity roll that reacts to the session and grows by verified events, never by spending.

How it is built: it is a Claude Code plugin on the hooks runtime, a TypeScript module that subscribes to
engine events (tool calls, turn completion, prompt submission, session lifecycle). Each feature is one
file that exports its handlers; a signals bus lets features publish facts (context, failures, loops,
incidents) that an advisor turns into recommendations without any model call. Tests run against the
engine's test kit (`claude plugin test`): 1,936 at the time of posting. A self-test command exercises
every pane and capability live, and a self-profile shows what each feature costs per event.

Privacy: no server, no telemetry. The network calls are listed in the README: a daily GitHub release
check, an optional push URL you set yourself, share buttons that open your browser, and a few features
that ask Haiku through your own account (two of them automatic and on by default, disclosed and
switchable). Cards and receipts are rendered locally as SVG and redacted (paths to file names, secrets
masked) before they are copied anywhere.

Limits I know about: the guards are pattern rules, not a sandbox. Tested on Windows in the desktop app;
macOS and Linux reports welcome. Nine of the ten UI languages have not had a native review yet. It adds
about 500 tokens of context per turn for the features that inject information for the model; switch
those off if every token counts.

Install, inside Claude Code:

    /plugin marketplace add avraham-tech/toolkitty
    /plugin install toolkitty@avraham-tech

or in a terminal: `claude plugin install toolkitty --marketplace avraham-tech/toolkitty`. MIT.
Repo: https://github.com/avraham-tech/toolkitty

I am the only maintainer, so I am especially interested in: which guard rules you would add, whether the
advisor's recommendations are right or annoying, and anything that broke on first install.

## Comment answers to have ready

- **"Why a cat?"** The most-upvoted open Claude Code issue is "Bring Back Buddy" (over 2,000 reactions).
  People like a face on their tooling; the cat is also the thing that gets screenshotted, which is how a
  free project spreads. It is off in the Minimal profile.
- **"Isn't 91 features bloat?"** They are switches; three profiles set them. The band redraws in under
  10 ms after a concurrency fix (it was 500 ms when every chip awaited the store in series). The real
  cost is the ~500 tokens of injected context, which you can turn off feature by feature.
- **"Why Haiku calls on by default?"** Correction capture and session titles are the two that need a
  model; they go through your own account like a typed prompt, the README names them, and the Minimal
  profile or one switch turns them off. I chose disclosed-on over off because the correction rules are
  the feature people asked for most.
- **"How is this different from CLAUDE.md / hooks I can write myself?"** Nothing here is impossible by
  hand; it is the integration (one band, one advisor, one incident log, one off switch per feature) and
  the receipts that make the guards legible.
- **"Security of running a third-party plugin?"** Same permissions as Claude Code, no elevation, plain
  TypeScript you can read, `claude plugin validate` lists every event and API it touches. SECURITY.md has
  the private report path.
- **"Was this written by Claude?"** Largely, yes, with the architecture, the feature list, the test plan
  and every release decision mine; the tests are what I trust, not the author. (Say this before anyone
  asks; HN respects it and punishes evasion.)
- **"Does it work on macOS / Linux?"** Not tested by me yet. If you try it, the first thing that breaks
  is the most useful issue you can open.
