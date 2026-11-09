# Growth strategy

## What spreads (from the research of 2026-11-08)
Rarity or luck (the companion's rarity roll), a number about yourself (savings, hours, efficiency), a rescue story (prevented disasters), motion that reads in a 5-second clip (aurora, aquarium), and a card already cropped for a post (Wrapped, receipt). The most-upvoted open Claude Code issue is "bring back Buddy" (1,196).

## Shareable surfaces (built / planned)
Built: Wrapped card + save SVG + share text; buddy share; receipt share; `/savings` copy; `/incidents` copy; `/report` copy. Planned (Phase 4): savings card, safety card, achievement card, pet card; redaction preview before any copy; `/demo` with clearly labelled synthetic data for screenshots and GIFs.

## Activation
Onboarding wizard (language → profile → companion reveal) on first run; `/home` as the hub; `/toolkitty help <question>`. Target: a first "wow" within 60 seconds (the reveal) and a first "it saved me" within the first day (savings chip, first blocked command).

## Retention
Weekly report on Monday; streaks and companion stages; notification center that stays quiet when nothing matters; advisor that recommends instead of nags.

## Launch plan
Name the product (candidates: Cockpit, Habitat, Sidecar). README in English with three GIFs (reveal, aurora, receipt) and the one-line install. Same day: Show HN, r/ClaudeAI + r/ClaudeCode, X thread, Product Hunt, PRs to awesome-claude-code and awesome-claude-code-mods, Anthropic Discord. Trust line in every post: local-first, no telemetry, open source.

## Metrics (local, never uploaded)
Installs (GitHub clones/stars), activation (wizard completed), weekly active (report opened), shares (share button presses counted locally), retention (sessions per week). No analytics are sent anywhere; the numbers are what users choose to tell us.

## Rules
Never fabricate savings or incidents in marketing material; demos are labelled DEMO; nothing is uploaded automatically; no user data in cards without consent.

## Mascot as system state (implemented 2026-11-09)
The cat is the official mascot, not just an icon. The buddy pane and chip react to the signals bus with a static pose per state (no animation needed; off in the Minimal profile):

| State (signal) | Cat |
|---|---|
| all clear | calm, smiling |
| `working` | typing |
| `context` ≥ 70 | worried |
| `incident` (dangerous command blocked) | raises a shield |
| `evidence` passed | celebrates |
| `loop` | chases its tail |
| `quota` ≥ 90 | falls asleep |

People share a cat stopping Claude from deleting a folder; nobody shares a token meter. Poses as inline SVG in buddy.tsx (the shield and the tail-chase keep a light animation in the pane, like the five older moods); the pet share card draws the same pose as a static emblem plus the pose word. Priority when several signals are live: shield, loop, quota, evidence, context, working. The Minimal profile does not react to the bus.

## Launch line
"Your Claude Code has nine lives. Make them count." (nine lives ↔ guardrails against fatal mistakes). Campaign line only; the product tagline stays "Your coding companion for Claude Code".

## Claims we may make (checked 2026-11-09)
Free (MIT, no paid tier). Local-first: nothing is sent to any Toolkitty server; the only network calls are the daily release check (GitHub) and the Haiku features, which send text to Anthropic through your own account exactly as Claude Code does: two are on by default and automatic (correction capture sends the correction text; session finder sends the first prompts to title the session), the others run only on your command or are off by default (prompt enhancer, help, tldr, decision ledger). Never claim "everything stays on your machine".
