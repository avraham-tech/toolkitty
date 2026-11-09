# Changelog

All notable changes to Toolkitty are listed here.

## Unreleased

- Require Claude Code 2.1.319 and migrate the aurora backdrop, live self-test and test mocks from
  `ui.backdrop` to `theme.set` / `theme.clear`.
- Limit update-check attempts to one per 24 hours even after HTTP errors, malformed responses,
  connection failures or timeouts, while preserving the last successful check and release.
- Correct documented command names and model-call privacy details; replace placeholder demo text
  with working commands and remove a duplicate property in a test fixture.

## 0.1.0 — 2026-11-09

First public release: 91 switchable features. Tests: 1936 across 102 files, 1936 pass, 0 fail (`claude plugin test .`, claude 2.1.317); see `tests/README.md`. Install verified on a clean profile (Claude Code 2.1.317, Windows 11). Highlights: switchboard with search and A–Z, 10 UI languages, guardrails (dangerous commands, secrets, blast radius, merge gate), evidence-based goal tracker and achievements, export / share / print of every visual, `/demo` with labelled synthetic data, `/perf` self-profile.
