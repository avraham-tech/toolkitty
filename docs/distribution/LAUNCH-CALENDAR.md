# Launch calendar: 30 days from 2026-11-10

Dates assume Wave A invitations go out on Monday 2026-11-10. If Wave A slips, every later date slips with
it; the gates do not. Day 0 = 2026-11-10. Times in Israel time (IST, UTC+2); US-facing posts are timed for
US mornings.

## Gates (hard; each one written into STATUS.md when it opens)

| Gate | Opens when | Unlocks |
|---|---|---|
| **G0 Assets** | GIF 1, GIF 2, GIF 3 recorded with the DEMO chip rule, committed to README; banner uploaded as social preview; topics set | Any public post |
| **G1 Wave A** | ≥ 10 clean installs (wizard opened, `/toolkitty` lists features), ≥ 5 written reports, ≥ 2 macOS + 1 Linux among them, top 3 problems fixed and re-tested by their reporters, test suite green in one run with the number recorded | Show HN, Reddit, Discord, X, LinkedIn |
| **G2 First public week survived** | HN thread answered to the end, every issue opened in the first 72 h triaged, a patch release out if anything install-related broke | awesome-list issue, Console.dev pitch, dev.to |
| **G3 Stable** | No open install-blocking issue for 7 days, `claude plugin validate` clean, version bumped | Product Hunt, then Anthropic directory submission |

## Week 1 (Nov 10–16): Wave A

| Day | Date | Action | Owner | Gate |
|---|---|---|---|---|
| 0 | Mon 10 | Send 10 invitations (English and Hebrew, one at a time). Add `claude-code-mod` topic to the repo. Start the metrics log (METRICS.md routine). | A (sends), builder (topic) | — |
| 1 | Tue 11 | Send 10 more. Log replies in WAVE-A-TESTERS.csv. First follow-ups. | A | — |
| 2 | Wed 12 | Record GIF 1–3 and the flagship video per LAUNCH-PLAN section 6 (session drives, Avraham records). | builder + A | → G0 |
| 3 | Thu 13 | Triage Wave A reports; builder fixes top problems; patch release v0.1.x if needed. Send 10 more invitations if under 10 installs. | builder, A | — |
| 4 | Fri 14 | Re-test fixes with their reporters. GIFs into README; social preview uploaded. | A, builder | G0 opens |
| 5–6 | Sat–Sun 15–16 | No posting. Comment helpfully (no links) in r/ClaudeAI and r/ClaudeCode to establish the account. Read all four subreddit sidebars in a browser; write the rules into STATUS.md. | A | — |

## Week 2 (Nov 17–23): public launch

| Day | Date | Action | Owner | Gate |
|---|---|---|---|---|
| 7 | Mon 17 | Weekly metrics check. Go / no-go on G1. If no-go, this week repeats Week 1's Thu–Fri. | A + this session | G1 |
| 8 | Tue 18 | **Show HN** at 15:00–16:00 IST (08:00–09:00 US Eastern). X thread within the hour. Discord showcase. Stay online 3 hours; answer everything. Evening: **r/ClaudeAI** post A. | A posts, this session drafts replies | G1 |
| 9 | Wed 19 | LinkedIn post. Triage issues; builder patches. Reply to every remaining HN/Reddit comment. | A, builder | — |
| 10 | Thu 20 | Patch release if needed. Thank testers publicly only with permission. | builder, A | — |
| 11 | Fri 21 | **r/ClaudeCode** post B (3 days after A). r/SideProject post D if its sidebar allows; r/commandline post C only if its sidebar allows tool posts. | A | G1 |
| 12–13 | Sat–Sun 22–23 | Rest. Metrics snapshot Sunday. Repo turns 14 days old on Sun 23. | — | — |

## Week 3 (Nov 24–30): lists and press

| Day | Date | Action | Owner | Gate |
|---|---|---|---|---|
| 14 | Mon 24 | Weekly metrics check. Go / no-go on G2. awesome-claude-code issue (age criterion holds if commits landed after Nov 9). awesome-claude-code-mods Featured nomination. | A (forms are human-only) | G2 |
| 15 | Tue 25 | Console.dev pitch with the HN thread URL. dev.to article. | A sends, this session drafts | G2 |
| 16–18 | Wed–Fri 26–28 | Fix cycle. Translate the top three issues into README limits if they are by design. Optional Hebrew post E. | builder, A | — |
| 19–20 | Sat–Sun 29–30 | Metrics snapshot. Draft the v0.2.0 changelog from what Wave A and launch week asked for. | this session | — |

## Week 4 (Dec 1–7): Product Hunt and directory

| Day | Date | Action | Owner | Gate |
|---|---|---|---|---|
| 21 | Mon 1 | Weekly metrics check. Go / no-go on G3. Prepare the PH gallery (five images, order in copy/PRODUCT-HUNT.md). | A + this session | G3 |
| 22 | Tue 2 | **Product Hunt** goes live 12:01 AM Pacific (= 10:01 IST). Maker comment posted immediately. Answer all day. One tweet pointing to it (no upvote ask). | A | G3 |
| 23 | Wed 3 | PH follow-ups. Triage. | A, builder | — |
| 24 | Thu 4 | `claude plugin validate`; **Anthropic directory submission** from claude.ai/directory/manage (Plugin bundle, repo root, track tag `v0.1.x` or main). Expect a policy hold for the hooks module; that is review, not rejection. | A (needs the account) | G3 |
| 25–27 | Fri–Sun 5–7 | Respond to directory review findings if any. Metrics snapshot. | A, builder | — |

## Day 28–30 (Dec 8–10): review

| Day | Date | Action |
|---|---|---|
| 28 | Mon 8 | 30-day metrics review against LAUNCH-PLAN's targets. Write `docs/distribution/RETRO.md`: what each channel produced (installs, issues, quotes), what to repeat for v0.2.0. |
| 29–30 | Tue–Wed 9–10 | Decide the v0.2.0 announcement channel (a release is not a Show HN; it can be a Reddit or X post). Close Wave A: thank every tester individually. |

## Standing rules for every posting day

- Show Avraham the exact text and the exact target; post only after his yes. He posts; this session
  drafts and keeps STATUS.md current.
- Re-check the numbers (features, tests, version) the same morning.
- Never two communities with the same text on the same day.
- No post goes out while an install-blocking issue is open.
- Every asset that shows a number shows the DEMO chip or is the author's real session, captioned so.
