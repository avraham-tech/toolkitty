# Metrics sheet and weekly check routine

Nothing here is uploaded anywhere; the numbers come from GitHub's API (repo owner view), Ko-fi's
dashboard, and the issue tracker. Append one row per check to `metrics/log.csv`. Run the check every
Monday morning before the go / no-go in LAUNCH-CALENDAR.md, plus a snapshot on each posting day and the
day after.

## Baseline (2026-11-09, day of publication)

| Metric | Value |
|---|---|
| Stars | 0 |
| Forks | 0 |
| Watchers | 0 |
| Open issues | 0 |
| Unique clones, 14 days | 0 |
| Unique visitors, 14 days | 0 |
| Release | v0.1.0 (2026-11-09) |
| Ko-fi supporters | 0 |
| GitHub Sponsors | pending approval |
| Wave A installs confirmed | 0 |

## What each number means for the plan

| Metric | Source | Why it matters | 30-day target (LAUNCH-PLAN) |
|---|---|---|---|
| Unique clones | `traffic/clones` | Closest proxy for installs: every `plugin install` clones the repo | ≥ 100 |
| Unique visitors + referrers | `traffic/views`, `traffic/popular/referrers` | Which channel sent people; referrer tells you if HN or Reddit worked | — |
| Stars | repo | Social proof; unlocks awesome-claude-code at 100 | ≥ 100 |
| Issues opened / closed, by label | issues API | Real usage leaves bugs; time-to-close is the trust metric | every install issue closed ≤ 72 h |
| Release downloads | releases API | Only meaningful if people fetch the tarball directly | — |
| Ko-fi one-time / monthly | ko-fi.com dashboard (manual) | Thank-you signal, not revenue | — |
| Wave A installs / reports | WAVE-A-TESTERS.csv | Gate G1 | 10 / 5 |

GitHub traffic data only covers the last 14 days and only the repo owner can read it, so the weekly
check must not be skipped; a missed week is lost for good.

## The weekly routine (15 minutes, Mondays)

1. Run the script below (PowerShell, from the repo root). It appends a row to `metrics/log.csv` and
   prints the referrers.
2. Open https://ko-fi.com/manage and copy the supporter count into the row (manual column).
3. Count Wave A installs from `WAVE-A-TESTERS.csv` (`clean_install = yes`) into the row.
4. In STATUS.md, update the "Numbers" block and the gate line (G1/G2/G3 open or not).
5. Read the referrers: a channel that sent visitors but no clones means the post reached people who did
   not install; look at what the post promised versus what the README shows first.

```powershell
powershell -ExecutionPolicy Bypass -File docs/distribution/metrics/check.ps1
```

## Posting-day snapshot

Run the same script in the morning before the post and again 24 hours later; the difference is the
channel's effect. Write both rows with the `note` column set to the channel name.

## Script

`docs/distribution/metrics/check.ps1` (uses `gh`, which is already authenticated on this machine):

- repo: stars, forks, watchers, open issues
- traffic: clones and views (count and uniques, 14-day totals)
- referrers: top 10 with count and uniques
- issues: opened in the last 7 days, closed in the last 7 days
- latest release tag and its asset download counts

Columns in `metrics/log.csv`:

`date,stars,forks,watchers,open_issues,clones_14d,clones_uniques_14d,views_14d,views_uniques_14d,issues_opened_7d,issues_closed_7d,release,kofi_supporters,wave_a_installs,note`

`kofi_supporters` and `wave_a_installs` are left empty by the script; fill them by hand.
