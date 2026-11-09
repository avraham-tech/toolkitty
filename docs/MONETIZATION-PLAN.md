# Monetization plan (documentation only; no licensing code)

## Principles
Core stays useful and trustworthy for free; safety is never behind a paywall; no telemetry; validate demand before building payment infrastructure.

## Boundaries (proposed)

| Tier | Includes | Why |
|---|---|---|
| Free | Smart bar, advisor basics, all guardrails, savings meter, incidents, notification center, companion, aquarium, Wrapped, share cards, onboarding, profiles | The viral surface and the trust surface must be free. |
| Pro (individual) | Context Doctor full report, Goal Tracker + Proof of Work report export, Time Machine with git integration, Session Replay with retention, Mission Control, Efficiency score history, extended weekly report, personalized advisor rules | Depth features for people who live in Claude Code all day. |
| Teams | Shared `.claude/toolkitty.json` policies, locked guard settings, team weekly report (aggregated locally and shared by the team's own means), admin profile, enterprise deployment notes | Companies pay for policy and visibility. |

## Validation experiments (before any payment code)
1. GitHub Sponsors link in the README; count sponsors after 60 days.
2. A "Pro waitlist" command (`/pro`) that only copies a mailto/URL; count presses locally and ask users to opt in to tell us.
3. Two or three team pilots using the project config file; interview them.

## Technical note
Features stay in one plugin; a future Pro pack would be a second plugin that depends on this one (the engine supports plugin dependencies and contracts), so the core never checks licenses.
