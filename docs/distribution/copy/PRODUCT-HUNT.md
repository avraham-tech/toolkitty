# Product Hunt listing (final copy, 2026-11-09)

Launch last, after HN and Reddit, on a Tuesday–Thursday at 12:01 AM Pacific. Rules checked today against
Product Hunt's own launch guide: tagline at most 60 characters and plain, no gimmicks; the maker's first
comment matters most (PH cites that 70% of Product of the Day/Week/Month winners had one). Description:
write to 260 characters (the stricter of the two limits reported). No upvote requests anywhere, including
DMs; PH removes launches for it.

**Assets needed:**
- Thumbnail: `assets/icon-512.png` (PH wants a square at least 240×240; 512 is fine).
- Gallery, in this order: GIF 1 (companion), GIF 2 (guardrail, DEMO chip), GIF 3 (band and savings), a
  still of the switchboard pane, `docs/assets/banner.png`. PH gallery images 1270×760; export the GIFs at
  that size or let PH letterbox them.
- Optional video: the 30–45 s flagship cut from LAUNCH-PLAN section 6, as a YouTube link.

## Name

Toolkitty

## Tagline (≤ 60 characters)

Primary (52): `Your coding companion for Claude Code. Free, local.`

Alternatives:
- (56) `Guardrails, context meters and a cat for Claude Code`
- (45) `91 switchable features for Claude Code`

## Description (≤ 260 characters)

Primary (257):

`A free, MIT plugin for Claude Code: a status band with context and cost, guards that block dangerous commands with a receipt, a goal tracker that trusts only real test runs, and a companion cat. 91 features, each a switch. No server, no telemetry.`

## Topics

Developer Tools, Open Source, Artificial Intelligence, Productivity

## Links

- Website: https://github.com/avraham-tech/toolkitty
- Pricing: Free
- Support: https://ko-fi.com/toolkitty (optional field; PH allows a tip link)

## Maker's first comment (under 250 words)

Hi Product Hunt, I'm Avraham, the only maintainer of Toolkitty.

I use Claude Code all day. Four things kept biting me: compaction arriving before I expected it, a turn
costing far more than I thought, a command running that I would never have typed, and "all tests pass"
appearing with no test run behind it. Toolkitty is my answer to those four, packaged as one plugin with
91 features, each of them a switch.

Monitor: a status band above the prompt with context %, cost, plan usage and current activity.
Optimize: duplicate-read detection, archived long outputs, a handoff draft before compaction.
Protect: guards for broad rm -rf, force-push to main, reset --hard, pipe-to-shell, secret files and
pasted secrets, each with a receipt explaining what was blocked and why. Pattern rules, not a sandbox.
Verify: a goal is done only when a real test, build, lint or diff ran.

And the cat. The most-upvoted open Claude Code issue is "Bring Back Buddy" (2,000+ reactions). Mine has a
rarity roll and grows only from verified work.

Free and MIT. No server, no telemetry; every network call is listed in the README, including two Haiku
features that are on by default and switchable. Tested on Windows 11; macOS and Linux reports are the
feedback I want most.

Install inside Claude Code:
/plugin marketplace add avraham-tech/toolkitty
/plugin install toolkitty@avraham-tech

Repo: https://github.com/avraham-tech/toolkitty

What guard rule would you add? That is the question I'll be answering here all day.

## Replies to prepare

- "Why not on the Anthropic directory?" "Submitted / submitting this week; the directory reviews each
  version, and a hooks module gets a human review."
- "Does it send my code anywhere?" "To no server of mine. The README's traffic table lists everything:
  a daily GitHub release check and some features that ask Haiku through your own Claude account."
- "Mac?" "Untested by me; the first report is the one I want."
