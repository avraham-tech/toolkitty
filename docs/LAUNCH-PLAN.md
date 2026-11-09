# Launch plan (review of TOOLKITTY-LAUNCH-CONSULTATION.md against the repository)

Written 2026-11-09 by the launch think-tank session, from the dev copy at
`~/.claude/dev-mods/ee70e92c-…/toolkitty` (renamed from `toolkit` on 2026-11-09). Every claim below is tagged
**[verified]** (seen in code, files or a run in this session), **[inferred]**
(follows from code but not executed) or **[unknown]** (nobody has checked yet).
Section 9 collects the tags.

## תקציר בעברית (למי שקורא רק את זה)

- **המסקנה המרכזית של מסמך הייעוץ נכונה:** להפסיק ללטש באנר ולעבור להתקנה
  שעובדת + הדגמות אמיתיות. הרפו תומך בזה: `/demo`, כרטיסי שיתוף, Wrapped,
  קבלות בטיחות, אשף פתיחה, בדיקת עדכונים והתראות כבר קיימים (סעיף 3).
- **חמישה חוסמים אמיתיים** לפני GitHub: אין README, אין `marketplace.json`,
  אין ריפו גיט (התיקייה אינה repository), `OWNER/REPO` עדיין בארבעה מקומות
  (`credits.ts`, `plugin.json`, `update-check.tsx`, `SUPPORT.md`),
  **והטסטים לא ירוקים בריצה אחת מלאה**: 1,755 טסטים, 15 נכשלים, 5 קבצי
  טסט לא נטענים כלל (מייבאים `refusal` ו-`zkit` שלא קיימים בעותק הפיתוח).
  המספר 2,389 הגיע מסקריפט בסקראצ'פד של סשן אחר, לא מהרפו.
- **פקודת ההתקנה:** התיעוד הרשמי לא מתעד ש-`claude plugin install toolkitty`
  יעבוד גם אחרי רישום ב-directory. יש צורה של פקודה אחת שכן מתועדת:
  `claude plugin install toolkitty --marketplace avraham-tech/<repo>`.
  להחליף את השורה בבאנר, בכרטיסי השיתוף (`INSTALL_CMD` ב-`sharing.ts`)
  ובטקסטי הפוסטים.
- **ממצא פרטיות שחייבים לפתור לפני פרסום:** שני פיצ'רים שדלוקים כברירת מחדל
  שולחים טקסט ל-Haiku **אוטומטית**, בלי פעולה של המשתמש: `correction-capture`
  (הודעות תיקון של המשתמש) ו-`session-finder` (הפרומפטים הראשונים + תשובה).
  זה סותר את הניסוח "opt-in Haiku features" ב-GROWTH-STRATEGY.
  **הוחלט (2026-11-09): נשארים דלוקים, עם גילוי מפורש ב-README** (הניסוח
  בסעיף 7) ותיקון השורה ב-GROWTH-STRATEGY.
- **תשלום:** Ko-fi ו-GitHub Sponsors עדיין לא נפתחו, והוחלט שהם קורים
  **לפני** העלייה ל-GitHub (משימה 10). Sponsors דורש אישור של כמה ימים,
  אז להתחיל ביום הראשון; Ko-fi מוכן תוך דקות ומספיק לעלייה אם האישור
  מתעכב.
- **שני קבצי טסט מכילים נתיב מקומי עם שם המשתמש** (`tests/exports.test.tsx`,
  `tests/safety-receipt.test.tsx`). לנקות לפני הקומיט הראשון.
- התוכנית ל-30 יום סבירה; הייתי מזיז את Product Hunt והגשה ל-directory
  לסוף, ומוריד לגמרי מהתוכנית את "Kitty Evolution" ו-"9 Lives" (סעיף 2).

---

## 1. Agree / Disagree / Modify per phase

### Phase 0 — Release gate: **Agree, with four items reworded**

| Item in the consultation | Verdict | Repository evidence |
|---|---|---|
| License / ownership / dependency review | Agree | `LICENSE` is MIT, © 2026 Avraham Shemesh; `plugin.json` `license: MIT` **[verified]**. No third-party runtime dependencies: `hooks/` imports only `claude-code` (the engine) and its own files; there is no `package.json` and no `node_modules` **[verified]**. The only open legal item is the trademark line in RELEASE-CHECKLIST ("the name and logo are not covered by the license"); it is not yet in `LICENSE` or the README **[verified: absent]**. |
| Run all tests, record exact totals | Agree, **finding** | The last recorded count is 2,389 green (PRODUCT-ROADMAP, rename section). A fresh single run in this session (`claude.exe 2.1.317 plugin test <folder>`) gave **1,755 tests, 1,740 pass, 15 fail, 5 test files failing to load** because they import helpers (`tests/harness.tsx` `refusal`, `tests/zkit`) that are not in the dev copy **[verified]**. Details in section 8. The repo needs its own runner script and a green run before any public number is quoted. |
| Clean-profile install from the public source | Agree, **blocking** | Impossible today: there is no GitHub repository and no `.claude-plugin/marketplace.json` **[verified: both absent]**. Section 6 gives the commands to test once they exist. |
| Upgrade / uninstall without damaging settings | Agree | Toolkitty stores state through the engine's store and `.claude/toolkitty.json` per project **[verified in roadmap and code]**; nobody has run an uninstall and looked at what stays behind **[unknown]**. |
| Supported OS, desktop vs CLI | Modify | Everything so far ran on Windows 11 in the desktop app. The roadmap records that this desktop build draws no backdrops and no OS notifications (Aurora and the receipt fall back to panes) **[verified in docs]**. macOS and Linux: **[unknown]**. The README must say "tested on Windows desktop app; other platforms untested" until someone runs it elsewhere. |
| Performance with and without the plugin | Agree, mostly done | `/toolkitty perf` exists and was used live: band redraw 500 ms → 8 ms after the `Promise.all` fix; ~2.1k chars (~520 tokens) added to the system prompt per compose; 836 KB state in memory **[verified in roadmap, 2026-11-09]**. Plugin load ~1.2 s in the test harness, source ~2.2 MB (`hooks/` is 2.5 MB on disk) **[verified]**. Not measured: a user-visible latency comparison on/off **[unknown]**. |
| Secrets audit of tree **and Git history** | Modify | There is no Git history to audit: the dev copy is not a repository **[verified]**. That is good news (the first commit can be clean) and a task (init the repo). A grep for key-like literals found none in `hooks/`; the only hits are deliberately fake fixtures. Two test files hardcode a local path containing the author's Windows username (`tests/exports.test.tsx:190`, `tests/safety-receipt.test.tsx:8`) **[verified]**. Scrub before the first commit. |
| Verify the precise privacy claim against code | Agree, **finding** | Outbound calls, all of them **[verified by grep of `$.http.fetch` and `$.model`]**: (a) `update-check.tsx` GETs the GitHub releases API once a day, skipped while the URL has `OWNER/REPO`; default on. (b) `waiting-alert.tsx` POSTs a short status line to a push URL **only if the user set one** with `/push-url` (e.g. ntfy.sh); default on but inert without a URL. (c) `exports.tsx` builds share-intent URLs (X, LinkedIn, Reddit, Telegram, WhatsApp) with the card text, opened only when the user presses Share. (d) Haiku calls (`claude-haiku-5-5` through the engine, i.e. the user's own Anthropic account): `/commit-msg` (staged diff, on command), `/explain` (on command), `/enhance` (off by default), `/tldr` (off by default), decision ledger (off by default), `/toolkitty help` (on command), `/selftest` model probe, **and two that run automatically while on by default: `correction-capture` sends user messages that look like corrections at turn end, and `session-finder` sends the first three prompts plus an answer excerpt to title the session.** GROWTH-STRATEGY's "opt-in Haiku features" is therefore not accurate for those two. No Toolkitty server, no telemetry, no crash reports **[verified: nothing else calls out]**. |
| Guardrails not marketed as foolproof | Agree | `dangerous-commands.tsx` returns a `deny` from the tool-call hook; the message tells the person to run it manually or switch the feature off. There is no approve/override flow; a user can disable the guard, and rules are regex patterns (broad `rm -rf`, `push --force` without lease or to main, `curl \| sh`, `reset --hard`, …) **[verified]**. Wording in section 8. |
| Marketplace asset requirements from current docs | Agree | Icon 1024×1024 PNG at `.claude-plugin/icon.png` exists (403 KB) **[verified]**. The directory validator's only remaining refusal is README_MISSING (RELEASE-CHECKLIST) **[verified in docs]**. Doc check of the current requirements: section 6. |
| Dynamic feature count correct | Agree | `hooks/features/index.ts` lists 12 groups totalling **91** features (10+3+5+5+9+9+7+5+9+12+9+8) **[verified by reading the arrays]**. `demo`, `about`, `selftest`, `doctor`, `profiles`, `onboarding` are counted as features; that is defensible (each is a toggle in the switchboard) but say "91 switchable features" rather than "91 tools". |
| Demo mode cannot leak paths/secrets | Agree, nearly | `/demo` writes labelled synthetic data and backs up real keys **[verified in docs/DEMO.md and demo.tsx]**. Share cards pass through `redact()` in `hooks/sharing.ts` (paths → basename, secrets masked, project → "my project") **[verified]**. Not yet done: a live recording session that confirms no real project name leaks into the band's other chips (git-context, files-touched show real file names and are not part of the demo) **[unknown]**. Record demos in a throwaway project folder named for the demo. |

**Modify the deliverable:** instead of a new `RELEASE-READINESS.md`, keep one
file. Section 5 of this document is that checklist; RELEASE-CHECKLIST.md stays
the owner's to-do for accounts (Ko-fi, Sponsors).

### Phase 1 — GitHub page: **Agree**

The README does not exist **[verified]**. The consultation's above-the-fold
order is right. Two corrections from the repo:

- The banner line `claude plugin install toolkitty` (also baked into share
  cards as `INSTALL_CMD` in `hooks/sharing.ts` and into post texts) works
  only once the official directory lists Toolkitty **[verified in
  RELEASE-CHECKLIST and sharing.ts]**. Until then the README must show the
  two-step marketplace install, and the share-card footer should either show
  the GitHub URL or the two-step form. This is a one-constant change in
  `sharing.ts` when the time comes; it is listed, not done.
- A real `/toolkitty` screenshot: the preview harness (58 screens) exists per
  the roadmap, but the harness scripts live in another session's scratchpad,
  not in the repo **[verified: no `scratchpad/` in the dev copy]**. Take the
  screenshot live in the desktop app instead.

### Phase 2 — Demonstrations: **Agree; no new functionality needed**

Everything the storyboard needs exists: `/demo scene calm|busy|rescue`, the
band with the `🎬 DEMO` chip, `/notices`, `/savings`, `/advisor`, `/sessions`,
the safety receipt pane, `/trophies`, `/cards`, `/wrapped` **[verified in
index.ts and DEMO.md]**. Known gap: `/wrapped`, `/heatmap` and `/incidents`
load their store at session start, so they show demo data only after a reload
(DEMO.md). Plan the recording order around that (section 7). The
"mascot reacts to signals" poses are **planned, not built** (GROWTH-STRATEGY)
**[verified]**, so the flagship video shows the buddy pane and reveal, not a
cat raising a shield. Do not promise poses in the launch copy.

### Phase 3 — Organic distribution: **Agree, reorder**

Wave A (10–30 testers on a clean profile) is the single most valuable step
and is the only one that can find what this session cannot: macOS/Linux
behaviour and the first-install experience. Keep Show HN and Reddit after
Wave A. Move "Claude plugin directory" to the end: its only hard blocker is
the README, but a directory listing is permanent (the icon is fixed at first
submission, BRAND-ASSETS) so it should carry the post-tester version.

### Phase 4 — Built-in sharing: **Modify: mostly already built**

Of the five experiments, three exist: share cards with redaction preview
(`/cards`, four kinds, 1200×630 SVG), Wrapped (`/wrapped` in week-heatmap),
Safety Receipt (`/safety-receipt`, wording "potentially dangerous", never
"damage prevented") **[verified in roadmap and code]**. "First Session Card"
does not exist; the closest is the pet card after the reveal. "Kitty
Evolution" exists as pet stages by verified XP; the state poses are not built.
Recommendation: launch with what exists, drop "9 Lives Challenge" as a
product item (it is a content calendar, not a feature), and decide on the
First Session Card only after Wave A says whether people share anything.

### Phase 5 — Funding: **Agree**

`hooks/credits.ts`, `SUPPORT.md`, `.github/FUNDING.yml` (`github:
avraham-tech`), the `/about` pane and the 30-session footer are implemented
and self-hiding while the URLs are placeholders **[verified]**. Nothing to
build; the owner opens the Ko-fi page and fills two constants. The
illustrative 200k × 1% × $5 line should stay out of any public text.

### Phase 6 — Metrics: **Agree, with one correction**

The consultation's table includes "active use / retention". Toolkitty sends no
telemetry and GROWTH-STRATEGY promises none **[verified]**. The only metrics
available are GitHub's (traffic, clones, stars, issues) and what users
volunteer. Say so in the README; do not add tracking to reach a KPI.

### Phase 7 — 30-day sequence: **Modify the first week**

Days 1–4 cannot be "release audit" alone: the repository, README and
marketplace.json have to exist before anything can be tested from the public
source. Revised order in section 4.

### Questions 11.1–11.10, short answers

1. Already implemented: demo, Wrapped, share cards, safety receipts,
   trophies, pet stages, onboarding wizard, update check, done/waiting
   alerts, about/support, doctor, selftest, perf. Planned only: mascot
   poses, first-session card, Pro/Teams.
2. Shortest path today: none public. After repo + marketplace.json:
   two commands (section 6). Branded one-liner: only after directory listing.
3. 91 features, last suite 2,389 green (fresh run: section 9); live
   `/selftest` 43 checks ok on 2026-11-08, Phase 4 live selftest **not yet
   run** per the roadmap **[verified in docs]**. Cost: ~520 tokens per
   compose, band redraw ≤ 8 ms, load ~1.2 s.
4. Qualify: "Privacy by design" needs the two automatic Haiku features
   fixed or disclosed; "Protect" needs the "deny, not approve" limit;
   "Local-first" is fine; the install one-liner is not fine yet.
5. Yes, all three GIFs and the flagship video from existing UI (section 7).
6. Yes: cards are SVG generated locally, saved to the exports folder,
   nothing uploaded **[verified in sharing.ts header and exports.tsx]**.
7. Risks: placeholders leaking as real URLs (the update check would 404
   silently, not harmful); username in test fixtures; no trademark clause;
   `hooks.json` `modules` runtime means reviewers will read a 2.5 MB TSX
   plugin, so a short ARCHITECTURE pointer helps trust; the share-card
   install line points to a command that does not yet work.
8. This week with existing functionality: repo + README + marketplace +
   two-step install + three GIFs + Wave A invite. Wait: Show HN, Product
   Hunt, directory submission, mascot poses, First Session Card.
9. Packaging: public source repo with marketplace.json in the same repo
   (one place to star, read, install and file issues; the engine loads TSX
   directly so there is no build step to hide). A prebuilt bundle adds a
   release pipeline and hides nothing; skip it.
10. Remove: 9 Lives Challenge, Kitty Evolution redesign, First Session Card
    (defer). Reorder: repo creation to day 1; directory submission to the
    end; Product Hunt only if Wave A feedback is positive.

## 2. Matrix: existing / missing / risky

| Area | Existing (verified in repo) | Missing | Risky / needs a decision |
|---|---|---|---|
| Install | `plugin.json` (name `toolkitty`, 0.1.0, icon, MIT, author) | GitHub repository; `.claude-plugin/marketplace.json`; `repository` URL in plugin.json is `OWNER/REPO` | Banner and share cards print `claude plugin install toolkitty`, which needs directory listing |
| Docs | LICENSE, SUPPORT.md, FUNDING.yml, docs/ (10 files), DEMO.md | README.md (the directory validator's only refusal); CHANGELOG; SECURITY.md (private vulnerability report path) | Trademark line absent from LICENSE |
| Onboarding | Welcome wizard (language → profile → companion reveal), `/welcome`, `/home` | — | First-run on a profile that never had the plugin is untested |
| Demo | `/demo on/off/scene`, DEMO chip, 30 labelled notices, store backups | Heatmap/Wrapped/Incidents re-read on open (small change, optional) | Real file names from git-context / files-touched appear next to demo chips: record in a throwaway folder |
| Sharing | `/cards` (savings, safety, achievement, pet), `/wrapped`, `/safety-receipt`, `/receipt`, `/exports`, redaction layer, share intents | First Session Card | Footer install command (see Install) |
| Updates | `update-check` daily GitHub releases GET, skipped while placeholder | A tagged GitHub release for it to find | None |
| Notifications | done-notify, long-turn toast, waiting-alert (+ optional `/push-url`) | OS notifications (engine limitation on this desktop build) | Push URL is user-chosen: say "sent to the server you configured" |
| Guardrails | protect-secrets, dangerous-commands, secret-mask, safety-receipt (on by default); branch-lock (off); 9 more in "More guardrails" | — | Deny-only (no approve flow); regex rules; a user can switch them off. Wording in section 8 |
| AI calls | Haiku via the user's own account: commit-msg, explain, enhance, tldr, ledger, help, selftest | — | **correction-capture and session-finder call Haiku automatically while on by default** (privacy wording or default change needed) |
| Mascot | Buddy pane, reveal, rarity, stages by verified XP, pet share card | Signal-driven poses (GROWTH-STRATEGY table) | Launch copy must not show poses |
| Funding | credits.ts, /about, 30-session footer, SUPPORT.md, FUNDING.yml | Ko-fi page; Sponsors approval | None (self-hiding while placeholders) |
| Tests | 99 test files, kit in `tests/_kit.tsx`, bundled-CLI runner | Runner script in the repo (lives in another session's scratchpad) | Two fixtures contain the author's local path |
| Perf | `/toolkitty perf`, roadmap baseline | On/off latency comparison | 2.2 MB source; roadmap's Phase 5 idea to move 5 languages to JSON if load time is felt |
| Platforms | Windows 11 desktop app | macOS, Linux, CLI-only terminal | Say "tested on Windows desktop app" |

## 3. Top-10 prioritized launch tasks

Effort: S ≤ 1 h · M half a day · L a day or more. Owner A = Avraham (accounts,
decisions), C = Claude session (files), T = testers.

| # | Task | Effort | Owner | Depends on | Risk | Acceptance criteria |
|---|---|---|---|---|---|---|
| 1 | Create the public GitHub repository `avraham-tech/toolkitty` (empty), decide the final name | S | A | — | Name is permanent in install commands | Repo exists; URL known |
| 2 | Replace `OWNER/REPO` in `hooks/credits.ts`, `.claude-plugin/plugin.json` (`repository`), `hooks/features/update-check.tsx`, `SUPPORT.md`; scrub the local path from `tests/exports.test.tsx:190` and `tests/safety-receipt.test.tsx:8`; add a `.gitignore` | S | C | 1 | Missing one placeholder leaves a dead link | `grep -rn OWNER` returns only `isPlaceholder()` itself; a grep for the author's local username returns nothing; tests green |
| 3 | **Decided 2026-11-09: both stay on by default, disclosed.** Write the disclosure into the README traffic table (section 7 wording), extend the two features' `description` strings with "sends … to Haiku", and fix GROWTH-STRATEGY's "opt-in Haiku features" line | S | C | — | A reader finds the automatic call before reading the README | Every Haiku call is on-command, off-by-default, or named in the README's "On by default and automatic" line |
| 4 | Add `.claude-plugin/marketplace.json` listing the plugin with source `./` (schema from the current docs, section 6) | S | C | 1 | Schema drift | `claude plugin validate` (or the directory check) passes except README |
| 5 | Write README.md (banner, one line, two-step install, requirements, GIF placeholders, three links, feature table generated from `index.ts`, platforms, traffic table, guardrail limits, update/uninstall, license + trademark line, support) and SECURITY.md | M | C | 2, 3 | Over-claiming | Directory check reports no refusals; every claim maps to a row in section 8 |
| 6 | `git init`, first commit, push; tag `v0.1.0` and publish a GitHub release (the update check needs one) | S | A + C | 2, 4, 5 | Secrets in the first commit | `git log` has one clean commit; release visible; `/update-check` reports the version |
| 7 | Clean-profile install test on this machine (second Windows user or a fresh `CLAUDE_CONFIG_DIR`), then upgrade and uninstall; record the exact output | M | C with A | 6 | Finding install bugs late | Section 6 commands succeed verbatim; wizard appears; `/selftest` green; uninstall leaves no toolkitty settings |
| 8 | Record the flagship video and three GIFs with `/demo` in a throwaway project (section 7); add to README | M | C drives, A records | 7 | Leaking a real path | Every frame shows the DEMO chip where synthetic data appears; no real path or secret; captions present |
| 9 | Wave A: invite 10–30 Claude Code users (at least two on macOS, one on Linux) with the two-step install; collect the first problem each hits | L (calendar) | A | 7, 8 | Low response | ≥ 10 installs confirmed, ≥ 5 written reports, top-3 issues fixed |
| 10 | **Before going public (owner's decision 2026-11-09):** open the Ko-fi page (`ko-fi.com/avraham-tech`, PayPal or Stripe connected, $3 default), apply for GitHub Sponsors (waitlist + Stripe Connect identity and Israeli bank account); then C fills `SUPPORT_URL` in `hooks/credits.ts`, adds `ko_fi: avraham-tech` to `.github/FUNDING.yml`, and replaces the two OWNER links in `SUPPORT.md`. Sponsors approval takes days, so start it on day 1 and ship with Ko-fi if it is still pending | S (+ waiting) | A, then C | 1 | Sponsors approval not in time | `/about` shows the support button; `supportLink()` is non-null; README and SUPPORT.md have no OWNER; Sponsor button visible once approved |
| 0 | **(inserted, before everything)** Make the test tree self-contained and green: add the missing `refusal` export to `tests/harness.tsx` or fix the five imports, bring `zkit` into the repo (or point the two files at `_kit`), fix or mark the 10 handoff/context-doctor/task-eta failures, commit a `tests/README` line with the exact run command | M | C (cheap model) | — | Quoting a wrong number in public | One `claude plugin test .` run: 0 fail, 0 files failing to load; total recorded in CHANGELOG |

Deliberately not in the top ten: Show HN and Reddit posts (after 9), Product
Hunt and directory submission (after Wave A), mascot poses, First Session
Card, Fable-tier translation review (needed before announcing "10 languages"
loudly; English-only launch copy makes it non-blocking).

## 4. Minimal executable release checklist

Run in this order. Each line is a command or a check with a visible result.

```text
[ ] 1  grep -rn "OWNER" hooks .claude-plugin SUPPORT.md  → only credits.ts isPlaceholder()
[ ] 2  grep -rn for the local username in hooks tests docs  → no output
[ ] 3  claude.exe plugin test <dev copy>                  → all green; record the total in CHANGELOG
[ ] 4  claude plugin validate <dev copy> (or the directory check) → no refusals
[ ] 5  README.md: install block pasted from a terminal where it just worked
[ ] 6  Privacy table in README matches grep of $.http.fetch and $.model (section 8)
[ ] 7  git init; git add -A; git status → no .claude-plugin/types junk, no logs, no screenshots with paths
[ ] 8  Push; tag v0.1.0; GitHub release published
[ ] 9  Clean profile: section 6 commands verbatim → wizard opens; /selftest green; /update-check reads v0.1.0
[ ] 10 /plugin uninstall toolkitty@<marketplace> → Claude Code starts clean; no toolkitty commands remain
[ ] 11 Upload docs/assets/banner.png as the social preview; set topics and description
[ ] 12 Release to ~/.claude/skills/toolkit only on Avraham's explicit word (toolkit-dev-vs-release rule)
```

## 5. Install instructions (TESTED 2026-11-09 on a clean profile, CLI 2.1.317: both forms work; see RELEASE-CHECKLIST)

> Status: **NOT TESTED.** No public repository exists. These are the
> commands the README will show, checked this session against the current
> docs at code.claude.com/docs/en/plugins (publish, install,
> create-marketplace, marketplace-reference, loading, security) by a
> documentation subagent. Replace `<repo>` with the final repository name.

Facts from the docs that change the plan **[verified in docs by the subagent]**:
- The part after `@` is the marketplace's top-level `name` in
  `marketplace.json`, the part before it is the entry `name`, which must
  equal the `plugin.json` name (`toolkitty`). So the marketplace file needs
  `"name": "avraham-tech"` for `toolkitty@avraham-tech` to be right, and
  the docs recommend a name other authors will not reuse.
- A **one-command** form exists: `claude plugin install toolkitty
  --marketplace avraham-tech/<repo>` (CLI ≥ 2.1.292; in-session `/plugin
  install toolkitty --marketplace avraham-tech/<repo>` ≥ 2.1.275). This can
  replace the banner's incomplete line in the README while the directory
  listing is pending.
- Minimal `marketplace.json`: `name`, `owner.name`, `plugins[{name,
  source: "./"}]` at `.claude-plugin/marketplace.json`; validate with
  `claude plugin validate .`.
- Directory submission goes through claude.ai/directory/manage, needs a
  paid claude.ai plan and a GitHub repo; README ≥ 40 words (code blocks do
  not count) and LICENSE are blocking; a security scan runs on each commit;
  files above ~256 KiB and non-shell hook scripts are held for a human
  reviewer (Toolkitty's only files above that size are the two 403 KB
  icons; the TSX hooks module will likely be held for review, so expect a
  wait). The bare `claude plugin install toolkitty` is **not documented**
  as working for directory plugins (they arrive as `toolkitty@synced`), so
  retire that line from the banner, share cards and post texts.
- Plugins live under `~/.claude/plugins/` (`cache/`, `data/`,
  `marketplaces/`, `installed_plugins.json`, `known_marketplaces.json`);
  `enabledPlugins` and `extraKnownMarketplaces` are written to
  `settings.json`. Uninstall: `claude plugin uninstall
  toolkitty@avraham-tech` (`--keep-data` keeps the data dir); old versions
  are purged after 14 days.

Prerequisites: Claude Code (desktop app or CLI 2.1.3xx; Toolkitty's hooks
runtime needs the `modules` form of `hooks.json`, present in the bundled
2.1.317 **[verified: the dev copy loads there]**), Git on PATH (several
features shell out to `git`), a terminal at least ~100 columns wide for the
band.

```text
/plugin marketplace add avraham-tech/<repo>
/plugin install toolkitty@avraham-tech
```

CLI form, same two steps:

```bash
claude plugin marketplace add avraham-tech/<repo>
```

```bash
claude plugin install toolkitty@avraham-tech
```

Expected result: on the next session start the welcome wizard opens (language
→ profile → companion reveal); `/toolkitty` opens the switchboard; `/selftest`
runs the live checks. Update: `/plugin marketplace update avraham-tech` then
`/plugin update toolkitty@avraham-tech`. Uninstall: `/plugin uninstall
toolkitty@avraham-tech`.

Clean-profile procedure for the test (the docs describe none; this is the
session's inference from the storage layout above): start Claude Code with a
fresh config directory (`CLAUDE_CONFIG_DIR=%TEMP%\cc-clean`, so that
`plugins/` and `settings.json` start empty), sign in, run the two commands,
restart, and record the full terminal output into
`docs/INSTALL-TEST-<date>.md`. Only after that may the README say "tested".

## 6. Recording plan (flagship 30–45 s and three GIFs)

Setup once: a throwaway project folder named `demo-project` with a tiny git
repo (so git-context shows a harmless branch name); desktop app window
~100 columns; Playful profile; language English; `/demo scene busy` started
and its pane closed; wait 5 s for alert toasts to clear (DEMO.md). Reload the
session once after starting the demo so `/wrapped` and `/incidents` show the
demo stores (DEMO.md known limit). Captions burned in; no audio needed.

### Flagship video

| Time | Shot | Command / state | Caption |
|---|---|---|---|
| 0–4 s | Buddy pane with the companion (rarity line visible) | `/buddy` or the reveal via `/welcome` step 3 | "I gave Claude Code a cat." |
| 4–10 s | The band: red headline "3 repeated failures", DEMO chip, chips | press "more" once | "It also watches the session." |
| 10–18 s | `/advisor` recommendations, then `/context-doctor` | busy scene | "Context 83%. Here is what to do about it." |
| 18–28 s | `/demo scene rescue`, then the safety receipt pane | rescue scene | "A broad rm -rf, blocked and explained. (DEMO data)" |
| 28–36 s | `/goals` with verified/unverified rows, or `/receipt` | — | "Claims checked against real test runs." |
| 36–42 s | `/demo off` → "Demo mode is off; your data is back." then README install block | — | "Free. Local-first. Two commands." |

### GIF 1 — companion (6–8 s)
`/welcome` → step 3 reveal, or `/buddy` → pet card via `/cards pet`. Loop on
the reveal. No demo chip needed (nothing synthetic shown except the name
`Pixel` if the demo is on; prefer a real fresh reveal).

### GIF 2 — guardrail (8–12 s)
`/demo scene rescue` → band headline "blocked: rm -rf" → open the safety
receipt → press "Share redacted" to show the redaction preview → close. DEMO
chip in frame throughout.

### GIF 3 — smart bar and savings (8–12 s)
`/demo scene busy` → band → `/savings` 30-day card → `/notices` scroll once.
End on the band.

Rule for every capture: if a frame shows a number, the DEMO chip is in the
same frame or the number is real and the caption says "my own session".

## 7. Defensible wording (privacy, license, security)

**Privacy (README section "What leaves your machine").**
> Toolkitty has no server and sends no telemetry, analytics or crash reports.
> Four kinds of network traffic can happen, each listed here:
> 1. **Update check** (on by default, switchable): once a day, one GET to
>    GitHub's releases API for this repository. Nothing but the request.
> 2. **Push alerts** (only if you set a URL with `/push-url`): a one-line
>    status ("waiting for your approval") POSTed to the server you chose,
>    such as your own ntfy topic.
> 3. **Share buttons**: open your browser with the card text pre-filled on
>    the network you picked. Nothing is sent until you post it yourself.
> 4. **Small-model features**: some features ask Claude Haiku through your own
>    Claude Code account, exactly like a prompt you type. On command only:
>    `/commit-msg` (staged diff), `/explain`, `/toolkitty help`, `/selftest`.
>    Off by default: `/enhance`, `/tldr`, decision ledger.
>    **On by default and automatic** (switch either off in `/toolkitty`,
>    or pick the Minimal profile): *Correction capture* sends a message of
>    yours that looks like a correction ("no, use tabs") at the end of the
>    turn, to distil it into a project rule; *Session finder* sends your
>    first three prompts and an excerpt of one answer, a few times per
>    session, to give the session a title. Both go to Haiku through your own
>    account, like a prompt you type; Toolkitty never sees them.
>
> Everything else (savings, incidents, cards, receipts, trophies, exports)
> is computed and stored locally in Claude Code's plugin store and in
> `.claude/toolkitty.json` of the project. Exported cards never contain your
> name, paths, project name or prompt text; paths are reduced to file names
> and secret-like strings are masked before anything is copied.

Allowed short claims: "Free (MIT)", "Local-first", "Privacy by design", "No
telemetry". Not allowed: "Everything stays on your machine", "No network".

**Guardrails.**
> Guardrails block commands and edits that match known-dangerous patterns
> (broad `rm -rf`, force-push without lease or to main, `reset --hard`,
> piping a download into a shell, secret files, pasted secrets). They are
> pattern rules, not a sandbox: a command that does not match is not
> blocked, and you can switch any guard off. A blocked command is reported
> as "potentially dangerous"; Toolkitty never claims to know what damage it
> prevented.

**License and trademark.** Keep MIT. Add to README and LICENSE footer:
> The Toolkitty name, cat mascot and logo are trademarks of Avraham Shemesh
> and are not covered by the MIT license; forks must use a different name
> and mascot.
Not legal advice; a trademark search for "Toolkitty" before the first post
is a cheap A-owner task.

**Security reporting (SECURITY.md).**
> Report vulnerabilities privately through GitHub's "Report a vulnerability"
> on this repository (or by email to the address in the profile). Please do
> not open a public issue for a security bug. Toolkitty runs as a Claude
> Code plugin with the same permissions as Claude Code itself; it does not
> elevate them.

## 8. Verified / inferred / unknown

**Verified in this session (read or run):**
- 91 features in 12 groups in `hooks/features/index.ts`; `plugin.json`
  name `toolkitty`, version 0.1.0, MIT, author, icon path.
- Files present: LICENSE (MIT 2026), SUPPORT.md, `.github/FUNDING.yml`
  (github only), `.claude-plugin/icon.png` (1024², 403 KB),
  `docs/assets/banner.png` + `icon-128.png`, 10 docs, 99 test files.
- Files absent: README.md, `.claude-plugin/marketplace.json`, `.git`,
  CHANGELOG, SECURITY.md, any `package.json`/`node_modules`.
- Placeholders `OWNER/REPO`: `hooks/credits.ts` (REPO_URL, SUPPORT_URL),
  `plugin.json` repository, `update-check.tsx` RELEASES_URL, SUPPORT.md.
- Author username in `tests/exports.test.tsx:190` and
  `tests/safety-receipt.test.tsx:8`.
- Outbound calls: `$.http.fetch` in update-check and waiting-alert only;
  `$.model.complete/fork` in commit-msg, correction-capture,
  decision-ledger, explain-error, prompt-enhancer, selftest,
  session-finder, tldr, register.tsx (help). Default-on among the
  automatic ones: correction-capture, session-finder.
- Dangerous-commands returns `deny` with an explanatory message; no
  approve flow.
- Demo, share cards, Wrapped, safety receipt, trophies, onboarding,
  update check, about/support: implemented (code present, documented in
  roadmap with test counts).
- Fresh full test run (this session): see the line below, filled when the
  background run finished.
  - RESULT (2026-11-09, `claude.exe 2.1.317 plugin test <dev copy>`, one
    run of the whole tree, 200 s): **1,755 tests across 99 files: 1,740
    pass, 15 fail.** Not 2,389. Breakdown: 5 files do not load at all
    (`advisor`, `cmd-taken`, `goal-tracker` import `refusal` from
    `tests/harness.tsx`, which does not export it; `efficiency-score` and
    `safety-receipt` import `./zkit`, which does not exist in the dev copy),
    so their tests are not even counted; `handoff` 7 failures (the harness
    does not answer `session.id`, and the pane call lacks
    `focus/closeOnEscape`); `context-doctor` 2 (one assertion on token
    text, one 5 s timeout); `task-eta` 1 (5 s timeout). The 2,389 figure
    came from the per-group runner in the builder session's scratchpad,
    which is not in the repo. Either the helpers were never copied into the
    dev copy or the tests were edited after the last green run. **This is a
    release blocker for the sentence "all tests green"**, not necessarily
    for the product (the load failures are test-only files). Log:
    the session scratchpad `test-run.log`.

**Inferred (from code and docs, not executed here):**
- The two-step install form works for a marketplace.json in the repo
  (RELEASE-CHECKLIST, plugin-authoring reference; doc check in progress).
- Roadmap numbers (2,389 tests; perf 8 ms redraw; 43 live selftest checks)
  were measured by the builder session on 2026-11-08/09.
- Redaction covers the share-card path; the band's non-demo chips are not
  redacted (they show real file names by design).

**Unknown (nobody has checked):**
- Behaviour on macOS, Linux, and CLI-only terminals.
- Clean-profile install, upgrade and uninstall outcome.
- Live `/selftest` after Phase 4 and after the rename.
- Translation quality in the nine non-English languages (review pending).
- Whether "Toolkitty" is free of trademark conflicts.
- Current official directory requirements beyond icon and README.

## 9. Open decisions for Avraham

1. Repository name (`toolkitty`?) — fixes every install command.
2. ~~Privacy default for correction-capture and session-finder~~ Decided
   2026-11-09: on by default, disclosed in the README (section 7).
6. Decided 2026-11-09: Ko-fi and GitHub Sponsors are opened **before** the
   repository goes public (task 10), not after.
3. License stays MIT with the trademark line? (RELEASE-CHECKLIST's AGPL/BUSL
   alternatives would complicate the "Free" claim.)
4. Who records: the session can drive `/demo` and the panes; a human must run
   the screen recorder.
5. Launch language: English only for the first posts (recommended), or also
   Hebrew communities.

## 10. Drafts written 2026-11-09 (docs/drafts/, copy to the root when the builder session is ready)

| File | Goes to | Notes |
|---|---|---|
| `drafts/README.md` | `/README.md` | Full README: install (two-step + documented one-liner), three GIF placeholders, generated 91-row feature table, commands, platforms, traffic table with the disclosed automatic Haiku features, guardrail limits, security, FAQ, support, license + trademark. Replace `<repo>`, the GIFs and `<!-- SUPPORT_URL -->`. |
| `drafts/gen_readme_table.py` | `scratchpad/` or `tools/` | Regenerates the feature table from `hooks/features/index.ts` and the English `title`/`description` of each feature; run after any catalogue change. |
| `drafts/SECURITY.md` | `/SECURITY.md` | Private report path, what counts, supported versions, permissions model. |
| `drafts/TRADEMARK-AND-MANIFEST.md` | LICENSE footer, `plugin.json`, new `marketplace.json`, `sharing.ts` | Trademark notice text; plugin.json with the directory URL fields; marketplace.json with `name: avraham-tech`; the `INSTALL_CMD` replacement. |
| `drafts/SHOW-HN.md` | the post, on launch day | Title options, body, five prepared comment answers. Fill the real test count. |
| `drafts/BETA-INVITE.md` | DMs | English and Hebrew invitation, tracking sheet columns, Wave A exit criteria. |

Payments (Ko-fi, Sponsors) are being opened by the owner in a separate session; the drafts leave `<!-- SUPPORT_URL -->` and the OWNER links for that.

**Applied 2026-11-09:** the drafts were applied to the plugin root: `README.md` (feature table regenerated, privacy section verbatim from section 7), `SECURITY.md`, `CONTRIBUTING.md`, `.gitignore`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, trademark footer in `LICENSE`, URL fields in `plugin.json`. `SHOW-HN.md` and `BETA-INVITE.md` remain drafts; GIFs, the repository and the clean-profile install test are still open. The directory validator reports no refusals.
