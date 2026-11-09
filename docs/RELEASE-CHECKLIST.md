# Release checklist (before the repository goes public)

Credit everywhere: **Avraham Shemesh (@avraham-tech)**. Done so far: `plugin.json` has `author`, `license: MIT`; `LICENSE` is MIT, copyright 2026 Avraham Shemesh.

## OPEN — support links (must be done by Avraham before going public)

Toolkitty's `/about`, the README and the repository's Sponsor button all point at a support page. None exists yet. Pick at least Ko-fi (fast) and, when approved, GitHub Sponsors.

### Ko-fi (about 5 minutes, no approval wait)
1. Go to https://ko-fi.com and sign up with the GitHub account or an email.
2. Choose the page name `avraham-tech` (so the link is `https://ko-fi.com/avraham-tech`).
3. Settings › Payment options: connect PayPal (works for Israel) or Stripe. Ko-fi takes no fee on donations; PayPal takes its own.
4. Page settings: set "Support me" amount to $3 (people can change it; 1–5 dollars is the usual range), write one line ("If Toolkitty saved you time, a symbolic coffee helps keep it going").
5. Copy the page URL and give it to Claude: it goes into `/about`, the README, the weekly report's quiet line, and `.github/FUNDING.yml` (`ko_fi: avraham-tech`).

### GitHub Sponsors (shows the pink Sponsor button; a few days for approval)
1. Go to https://github.com/sponsors and press "Join the waitlist / Get sponsored" for the `avraham-tech` account.
2. Fill the profile: short bio, what the money supports (Toolkitty), one or two one-time tiers ($1 and $5) and optionally a $3/month tier.
3. Connect payouts through Stripe Connect (identity document, bank account in Israel; Stripe supports it). Wait for GitHub's approval email.
4. After approval, tell Claude: `github: [avraham-tech]` is added to `.github/FUNDING.yml`.

### Optional: Buy Me a Coffee
Same as Ko-fi but charges 5%. Skip unless you prefer the brand.

## OPEN — license decision (Avraham decides before the first push)
Current: MIT (max adoption; copying allowed, credit required). Alternatives: AGPL-3.0 (modified redistributions must stay open; blocks closed commercial forks; some companies avoid it), BUSL-1.1 (source visible, no competing commercial use for N years, then open; protects a future Pro). Whatever the choice: add a trademark clause ("the name and logo are not covered by the license"), register the product name as a trademark once chosen, keep any future Pro pack as a separate non-public plugin. Decision: ______

## Rest of the checklist (Claude does these once the above is decided)
- `.github/FUNDING.yml` with the chosen platforms.
- README.md in English: what it is, the 60-second install, three GIFs (companion reveal, aurora, receipt), the feature table generated from the catalogue, "Made by Avraham Shemesh (@avraham-tech)", the support line, privacy line (local-first, no telemetry), license.
- `/about` command inside Toolkitty: version, credit, support link, repository link.
- `.claude-plugin/icon.png` (512–2048 px square) — the directory validator asks for it.
- `.claude-plugin/marketplace.json` for one-line install.
- Secret scan of the folder before the first push; `.claude-plugin/types/` excluded.
- Final live `/selftest` and `/doctor` runs green in the desktop app.
- Release to `~/.claude/skills/toolkit` only on Avraham's word; GitHub only after the checklist is complete.

## Translation review (before the first public release)
- [ ] A strong model (Fable / Mythos tier, not Sonnet) reads every non-English string per language, one language per pass, with the English beside it, and fixes: double meanings, literal renderings that no native speaker would write, wrong register (formal/informal mismatch), gendered or inflected forms that break with placeholders, chip/band strings longer than the English. Scope: ~2,200 strings × 9 languages; do the five new languages first (zh, ja, pt, de, ko), then he/es/fr/ru which were written earlier.
- [ ] Extract the strings with `scratchpad/check_i18n.py`-style parsing into a per-language table so the reviewer reads text, not code, and writes back only changed values.
- [ ] Known hot spots from the translators: "switchboard", "Craftsperson", "THANK YOU FOR VIBING", "Disasters prevented", receipt width in CJK, German chip abbreviations (`T.`, `Std.`, `Wdh.-Bef.`).
- [ ] After the pass: `check_i18n.py` 0 problems, full test suite green, and a live switch through all ten languages in the app.

## Icon and images (done 2026-11-09)
- [x] `.claude-plugin/icon.png` 1024×1024 PNG, `icon` in plugin.json (`./.claude-plugin/icon.png`, relative to the plugin root). Directory check: ICON ok. Remember: the listing icon is fixed at the first submission.
- [x] `docs/assets/banner.png` 1280×640 and `icon-128.png`; `assets/icon-{1024,512,256,128,64,32}.png`, `avatar-400.png`. Regenerate: `scratchpad/make_assets.py <toolkitty>`.
- [ ] Upload the banner as the GitHub social preview; use `avatar-400.png` on Ko-fi / Sponsors.
- [x] README written 2026-11-09; the directory profile now validates with no refusals (README_MISSING gone).

## Install command (verify before publishing)
- `claude plugin install <plugin>` exists in CLI 2.1.317 and installs from the AVAILABLE marketplaces; `plugin@marketplace` picks one. Until Toolkitty is listed in the official directory, the README must show the GitHub form: `/plugin marketplace add avraham-tech/<repo>` then `/plugin install toolkitty@avraham-tech`, exactly as the plugin-authoring reference describes for a marketplace.json in the repo. The banner's short line (`claude plugin install toolkitty`) is the goal state once the directory lists it.
- [ ] Test the real install on a clean machine or a second user profile before the launch post.
- The banner's feature count is read from `hooks/features/index.ts` by `scratchpad/make_assets.py`; regenerate assets after adding or removing a feature.
- Brand rule: the cat stays as drawn (cream + orange, dark face, pointed ears, paws on a terminal). No new accessories, glows or badges in future illustrations; poses may change (mascot states), the character does not.

## Launch files applied (2026-11-09)
- [x] `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.gitignore`, `CHANGELOG.md` header, `.claude-plugin/marketplace.json` (`avraham-tech` / `toolkitty`), trademark footer in `LICENSE`, directory URL fields in `plugin.json`; `SUPPORT.md` Sponsors link filled.
- [x] Ko-fi `https://ko-fi.com/toolkitty` is live; GitHub Sponsors submitted, pending approval (README and SUPPORT.md say "pending").
- [ ] Three README GIFs are commented placeholders: `docs/assets/gif-companion.gif`, `gif-guardrail.gif`, `gif-smart-bar.gif` (LAUNCH-PLAN section 6).
- [ ] Create the GitHub repository `avraham-tech/toolkitty`; verify both install forms on a clean profile (comment in README source).
- [ ] Record the test total in CHANGELOG.md; `INSTALL_CMD` in `hooks/sharing.ts` still to be replaced.

## Repository (done 2026-11-09)
- [x] Public repo https://github.com/avraham-tech/toolkitty, branch main, first commit clean (secrets grep + username grep empty), `.gitattributes` LF.
- [x] Topics, Ko-fi homepage, Discussions on.
- [ ] Upload `docs/assets/banner.png` as Social preview (GitHub web UI only).
- [ ] Tag `v0.1.0` + GitHub release after the clean-profile install test (the update check reads releases).
