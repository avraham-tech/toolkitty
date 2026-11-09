# UX spec

## The band (above the prompt)

One row. First the **headline chip**, then up to N feature chips (N by profile: Minimal 2, Productive 5, Playful all), then the bell (unread notices) and the expand toggle (full lines). Attention first: alert > warn > info > ok. Quiet when quiet: an `ok` chip is dim; a feature with nothing to say returns no chip.

Headline states (one at a time, highest priority wins):

| State | Chip | Source signals |
|---|---|---|
| Error | `🔴 <n> repeated failures` | `failure` with repeats ≥ 3, `loop` |
| Security | `🔴 blocked: <kind>` (10 s after an incident) | `incident` |
| Waiting | `🟡 approval needed` | `waiting` |
| Resource | `🟠 context 87%` / `🟠 weekly 91%` | `context` ≥ 80, `quota`/`budget` above threshold |
| Working | `⚡ <action> · m:ss` | `working` |
| Done | `✅ done · <n> files · tests <passed/failed/not run>` (10 s) | `done` with evidence; never "passed" without a test result |
| Ready | `🟢 ready · ctx 34%` | none of the above |

Pressing the headline opens the Advisor pane; pressing any chip opens that feature's detail pane.

## Advisor pane (`/advisor`)
Header: "Advisor" + headline state. Body: up to 3 recommendations, each a card: title (bold), one line of reasoning naming the signals, action buttons (first = primary, with digit hotkeys), "Ignore" (cooldown 30 min per rule, "Ignore for today" on second press). Below: "Signals now" as a dim list. Empty state: "Nothing to recommend. Signals appear as the session runs."

## Notification center (`/notices`)
Categories: critical (toast + bell red), action (toast + bell), warning (bell), info (bell, dim), achievement (toast if Playful). Same feature + same text within 5 minutes collapses to one row with `×n`. Per feature cooldown 60 s for info. Header actions: Clear · Quiet mode (toggle: only critical toasts) · Prefs (min level that toasts). Rows newest first, grouped by feature when > 10.

## Panes (all)
`paneHeader` (title · status word · actions with digit hotkeys) → content → footnote. Lists use `listRow` (left time, text, right value). Empty state = fact + what fills it. Every action is a plain button; one primary per pane at most. Hebrew strings are direction-neutral (numbers and symbols at line ends work in both directions).

## Profiles
Minimal: headline + bell only; no visuals; notices quiet mode on. Productive: headline + 5 chips, advisor, context doctor, goal tracker, notices normal. Playful: everything, companion, aquarium, achievements, sounds optional. Guards are always on in every profile; a profile change shows what it will turn off before applying.

## Interaction patterns
- Destructive or costly actions (handoff/compaction, restore, allow) show a preview or a native question (`$.ui.ask`) first.
- Dismissals are remembered (store) with cooldowns; nothing nags.
- Hotkeys: digits for header actions in the focused pane; the band reacts to clicks only.

## Switching on shows the feature (2026-11-09)
A flag alone tells the user nothing. In the switchboard (`/toolkitty`) every row carries, while the feature is on, an `Open` button (features with a pane) or a `Show` button (features with only a band line, chip or detail), and a `★/☆` "open at start" star for pane features (store `autoOpen`; opened unfocused on `session.attach`). Switching a feature on opens its primary pane (or its detail) at once and posts an info notice "<title> is on · opened"; a background-only feature posts "<title> is on · works in the background: <description>" so the silence is explained. The home pane (`/home`) has a "Live now" section listing every feature currently drawing something, plus "N features work silently in the background". `All on` / `All off` only flip flags.

## Finding a feature (2026-11-09)
The switchboard has a live search field (desktop; terminal gets a Find button that asks) matching title, description, id and commands in the UI language and English, accent- and hyphen-insensitive, ranked title-starts-with → title/id contains → description/command. A header toggle switches Groups ↔ A–Z (remembered in `switchboard:view`); A–Z sorts by the UI language's locale with letter headings and, from 20 rows, letter chips that filter by initial.

## Every visual output can be kept (2026-11-09)
Receipts, the safety receipt, the buddy, the aquarium, the incident card, the budget gauge, the heatmap/Wrapped and the share cards all carry the same export bar (`hooks/exports.tsx`): Save SVG (text on terminals), Copy text, Share. Files go to `<cwd>/toolkitty-exports/<kind>-<date>-<HHMM>.svg` in a project, or to `~/Documents/Toolkitty/exports` when the session runs in an app-made scratch workspace (deleted with the session), or to the folder chosen with `/exports dir <path>`; never overwriting (suffix -2, -3); every notice carries the full path; the bar also has Open folder (file manager) and Copy path; `/exports` lists saved files with Open / Copy path / Change folder; the incident card's export leaves out details so paths and values never leak. `/receipt` reopens the last turn receipt with a 30-entry history kept across sessions (`turn-receipt:history`); `/receipt save` and `/receipt all` write the latest or the whole history.

## Share sheet and Print (2026-11-09)
Share on any visual saves the picture, copies the text and opens the `toolkitty-share` sheet: the text, "Picture saved: <path>" with Open folder / Copy path, and targets WhatsApp, Telegram, X, LinkedIn, Reddit, Email, Copy text, Print. Each target copies the text, then opens the prefilled link in the default browser (Windows via rundll32, macOS `open`, Linux `xdg-open`), with a toast naming the target and the exit code. Nothing is uploaded; the picture is attached by the person in the chosen app. Print writes a self-contained `<kind>-<stamp>.print.html` (picture + text, print stylesheet, `window.print()` on load) and opens it, so the browser shows the print dialog. Every button in the export bar answers with a toast whatever the toast-level preference (`notice(..., { toast: true })`).
