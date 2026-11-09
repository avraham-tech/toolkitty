# Discord showcase, awesome lists, Console.dev, dev.to (final copy, 2026-11-09)

## Anthropic "Claude Developers" Discord, showcase channel

Read the channel's pinned rules first (not fetchable from here). One message, one GIF, no follow-up bumps.

**Asset:** GIF 2 (guardrail with DEMO chip) or GIF 1 (companion).

**Message:**

Toolkitty, a plugin for Claude Code I just released: a status band above the prompt (context %, cost,
plan usage, activity), guards that block dangerous commands with a receipt (broad rm -rf, force-push to
main, reset --hard, pipe-to-shell, secret files), a goal tracker that only trusts real test, build, lint
or diff runs, and a companion cat that grows from verified work. 91 features, each a switch; 1,936 tests;
MIT; no server, no telemetry (network calls listed in the README). Built on the hooks runtime as one
TypeScript module, one file per feature, a signals bus feeding an advisor. Windows-tested; a macOS or
Linux report would help a lot.

Install: `/plugin marketplace add avraham-tech/toolkitty` then `/plugin install toolkitty@avraham-tech`
Repo: https://github.com/avraham-tech/toolkitty

---

## hesreallyhim/awesome-claude-code (issue form only, one resource, human-submitted)

Rules verified today: resource must be 14+ days old with commits after day one, OR have 100+ stars; the
web issue form, never a PR or `gh`; description as a description, one line, no emojis, no second person.
Earliest eligible date by age: 2026-11-23 (first commit 2026-11-09) provided there are later commits.

Form: https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml

- **Resource name:** Toolkitty
- **Category:** Tooling (or Plugins, whichever the form offers)
- **URL:** https://github.com/avraham-tech/toolkitty
- **Description (one line):** A Claude Code plugin with 91 switchable features: a status band with
  context and cost, command and secret guards with receipts, a goal tracker tied to real test runs,
  context hygiene tools and a companion cat. MIT, local-first.

---

## karanb192/awesome-claude-code-mods

Automatic: add the GitHub topic `claude-code-mod` to the repository (builder session or Avraham in repo
Settings → Topics). The scanner picks it up within hours of the next push and reports what the mod can
access. After Wave A, nominate for a Featured slot:

Form: https://github.com/karanb192/awesome-claude-code-mods/issues/new?template=featured-nomination.yml

- **Install path:** `claude plugin install toolkitty --marketplace avraham-tech/toolkitty`
- **Evidence of it working:** link to GIF 2 in the README and to the clean-profile install note in the
  README's install section (Claude Code 2.1.317, Windows 11).
- **Access details:** copy the README's "What leaves your machine" section verbatim.

---

## Console.dev pitch (email, after HN)

Criteria verified today: built for developers, self-service, part of the development flow, useful to
power users. Submit via the form at https://console.dev/submit/ (fields vary; this is the text).

**Subject:** Toolkitty: guardrails, context meters and a companion for Claude Code (free, MIT)

Hi, I'm Avraham, the maintainer of Toolkitty, a plugin for Anthropic's Claude Code released on
<date>. For developers who run a coding agent against real repositories it adds a status band (context %,
cost, plan usage), guards that block dangerous commands with an explanatory receipt, a goal tracker that
only trusts real test runs, and context hygiene tools. 91 features, each switchable; 1,936 tests; no
server, no telemetry. Install is two commands inside Claude Code, no sign-up. The Show HN thread from
<date> is at <HN URL>. Repo: https://github.com/avraham-tech/toolkitty. Happy to answer anything.

---

## dev.to article (after HN; reuse the Show HN body)

Title: `What I learned building 91 switchable features for Claude Code as one plugin`
Tags: `claude`, `showdev`, `opensource`, `typescript`
Cover: `docs/assets/banner.png`
Body: the Show HN text expanded with three sections (the signals bus, why receipts, the privacy table),
ending with the install block and the repo link. Canonical URL: none (dev.to is the origin).
