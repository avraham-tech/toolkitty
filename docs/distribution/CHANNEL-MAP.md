# Channel map (checked 2026-11-09)

Four angles, one per channel, never all four in one post:

- **Cat**: the companion, the rarity roll, the "bring back Buddy" story. For screenshots and short video.
- **Safety**: guards with receipts, "potentially dangerous, blocked and explained". For engineers who
  have lost a folder to an agent.
- **Efficiency**: context meter, cost per turn, duplicate-read detection, handoff before compaction.
- **Engineering story**: one TypeScript module on the hooks runtime, 91 files, a signals bus, 1,936 tests,
  `claude plugin validate`. For HN and dev.to.

Rule check status: **verified** = the rule text was read today from the source named; **unverified** =
the page could not be fetched from this machine (Reddit blocks non-browser clients and the app's browser
pane refuses reddit.com), so the sidebar must be read in a normal browser on posting day and the finding
written into STATUS.md before the post goes up.

## Tier 1: communities that match the audience

| Channel | Audience | Rule found | Status | Angle | Copy | Gate |
|---|---|---|---|---|---|---|
| Hacker News, Show HN | Engineers, tool builders | Must be something people can run; be around to discuss; no upvote requests; plain title, no praise or gratuitous numbers; early-stage work welcome; a release ("1.3.1 is out") is not a Show HN, so there is exactly one shot. Source: news.ycombinator.com/showhn.html | verified | Engineering story, safety second | `copy/SHOW-HN.md` | Wave A exit + GIFs real |
| r/ClaudeAI | Claude users, many on Claude Code | Plugin posts exist in the feed (snapshots show third-party plugin launches). Exact self-promo rule: read sidebar. Reddit-wide: under ~10% of your activity promotional, so comment helpfully in the sub for a week before posting. | unverified | Cat first (image/GIF post), safety in body | `copy/REDDIT.md` A | Wave A exit |
| r/ClaudeCode | Claude Code users (~300–480k by third-party counts) | Self-promotion is a common post type there by third-party classification; exact rule: read sidebar, check for a required flair ("Showcase", "Resource") | unverified | Efficiency + safety; text post with one GIF | `copy/REDDIT.md` B | Wave A exit, 3 days after r/ClaudeAI |
| r/commandline | Terminal people | Meta post seen: largely unreviewed AI-generated projects are prohibited. Toolkitty is hand-architected and tested but built with Claude; say so plainly in the post or skip the sub. Read sidebar. | unverified | Engineering story, terminal-native UI, no mention of the cat in the title | `copy/REDDIT.md` C | Only if the sidebar allows tool posts |
| r/SideProject | Makers | Feedback-oriented; self-promo is the main post type; some reports of a flair or Saturday convention. Read sidebar. | unverified | Maker story: one person, 91 switches, what I learned | `copy/REDDIT.md` D | Wave A exit |
| Anthropic "Claude Developers" Discord, showcase channel | Builders on Claude | Channel exists for posting what you built; no public rule text found beyond Discord guidelines and the "Built with Claude" contest rules. Read pinned rules in the channel. | unverified | Engineering story, one GIF, install line | `copy/DISCORD-AND-LISTS.md` | Wave A exit |

## Tier 2: lists and directories (submit, do not post)

| Target | Rule found | Status | What to send | Gate |
|---|---|---|---|---|
| hesreallyhim/awesome-claude-code (57k stars) | Resource must be 14+ days old with commits after day one, OR 100+ stars; one recommendation at a time; web issue form only (no PR, no `gh`); description written as a description, one line, no emojis, no "you"; recommendations must be made by a human | verified (CONTRIBUTING.md read today) | One-line description, see `copy/DISCORD-AND-LISTS.md` | Repo ≥ 14 days old (2026-11-23) with follow-up commits, or 100 stars |
| karanb192/awesome-claude-code-mods (900 stars) | Automatic discovery: repositories with the GitHub topic `claude-code-mod` are scanned within hours of a push; Featured slots by nomination issue with install path, evidence and access details | verified (README read today) | Add topic `claude-code-mod` to the repo (builder session); nominate for Featured after Wave A | Topic: now. Nomination: after 10 installs |
| Anthropic plugin directory | Submit from the developer portal at claude.ai/directory/manage, "Plugin bundle"; GitHub account connected; a plan and role that can submit; repo public before listing; pre-submission checklist (README, license, no system files, every path inside the plugin folder, version bumped per release); a TSX hooks module may be "held for a reviewer", which is not a rejection | verified (claude.com/docs/plugins/submit.md and pre-submission-checklist.md read today) | The repo as is, after `claude plugin validate` | Last: after Product Hunt (task says PH and directory last) |
| Console.dev newsletter | Editorial selection, 2–3 tools a week; criteria: built for developers, self-service, part of the dev flow, works for power users | verified (console.dev selection page read today) | Short pitch email, see `copy/DISCORD-AND-LISTS.md` | After HN |
| TLDR Dev / TLDR AI | Editorial; only an Advertise page found, no free submission path | verified (no submission form) | Nothing to send; coverage happens if HN goes well | None |

## Tier 3: owned channels

| Channel | Rule | Angle | Copy |
|---|---|---|---|
| X / Twitter, Avraham's account | No rule beyond platform terms. Do not tag Anthropic staff in the thread; reply under Anthropic's Claude Code posts only when the reply adds something. | Cat in tweet 1, then one angle per tweet | `copy/X-THREAD.md` |
| LinkedIn, Avraham's profile | None | Engineering story + safety, for an audience that manages teams using agents | `copy/LINKEDIN.md` |
| Product Hunt | Tagline ≤ 60 characters, plain, no gimmicks; maker's first comment matters (PH's own launch guide). Description limit reported as 260 characters in the help article; write to 260. | Cat + safety; GIF as gallery media | `copy/PRODUCT-HUNT.md` |
| dev.to | Platform allows self-authored tool posts; use the `#claude` and `#showdev` tags | Engineering story, long form (the Show HN body expanded) | Reuse `copy/SHOW-HN.md` body |

## Skipped on purpose

| Channel | Why |
|---|---|
| r/opensource | Rules changed 2026-10-24: no AI projects or tools intended for AI, one year of maintenance, multiple contributors. Toolkitty fails all three. |
| r/programming | Current sidebar (per a 2026-10 snapshot) bans product promotion and "I made this" posts; LLM-coding discussion reportedly banned too. |
| Lobsters | Invite-only; self-promotion of your own project is frowned upon without a track record there. |
| Paid ads, upvote groups, "launch boost" services | Against the project's rules (LAUNCH-PLAN) and against every community's rules above. |
| Hebrew developer groups (Facebook / Telegram / WhatsApp) | Decision 9.5 in LAUNCH-PLAN recommends English-only first posts. Optional Hebrew post in `copy/REDDIT.md` E once the English wave is out, if Avraham wants it. |

## Order of operations (also in LAUNCH-CALENDAR.md)

1. Wave A until the exit criteria hold.
2. Add the `claude-code-mod` topic (free, automatic listing).
3. Show HN on a weekday morning US time, Tuesday to Thursday; stay online three hours.
4. r/ClaudeAI same day, evening; r/ClaudeCode three days later; Discord showcase the same week.
5. X thread and LinkedIn on HN day, within an hour of the HN post.
6. awesome-claude-code issue once the age or star criterion holds.
7. Console.dev pitch after HN, with the HN thread as evidence of interest.
8. Product Hunt, then the Anthropic directory, in the last week.

## Sources read today

- https://news.ycombinator.com/showhn.html
- https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/CONTRIBUTING.md
- https://github.com/karanb192/awesome-claude-code-mods (README, contributing section)
- https://claude.com/docs/plugins/submit.md and https://claude.com/docs/plugins/pre-submission-checklist.md
- https://console.dev/submit/ (selection criteria)
- https://tldr.tech/dev (no submission path, Advertise only)
- r/opensource rule change: coverage at letsdatascience.com, mezha.ua, runtimewire.com (2026-10-24 to 27)
- Anthropic Claude Code issue #45596 "Bring Back Buddy", 2,117 reactions, open (via `gh api`, today)
