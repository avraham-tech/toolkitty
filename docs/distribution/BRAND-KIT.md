# Toolkitty brand kit

For anyone writing a post, a listing, a slide or a reply about Toolkitty. The brand is locked; this page
is the reference, `docs/BRAND-ASSETS.md` holds the file specs.

## Name

- **Toolkitty.** One word, capital T, lowercase everything else. Never "ToolKitty", "Tool Kitty",
  "toolkitty" in prose (fine in commands and URLs), never "the Toolkitty plugin" twice in a row.
- Pronounce it "tool-kitty". The pun (toolkit + kitty) is allowed once per piece, never explained.
- Install identifiers are exact and not brand-styled: `toolkitty@avraham-tech`,
  `avraham-tech/toolkitty`.
- Author credit: Avraham Shemesh, GitHub `avraham-tech`. Not affiliated with Anthropic; never imply it.
  "Claude" and "Claude Code" are Anthropic's marks; use them only to say what Toolkitty runs on.

## The lines

| Use | Exact wording |
|---|---|
| Tagline (always with the name) | Your coding companion for Claude Code |
| Four pillars (sub-line, centred, with middle dots) | Monitor · Optimize · Protect · Verify |
| Short pitch | 91 features. One tiny companion. |
| Campaign line (launch posts only, not the product tagline) | Your Claude Code has nine lives. Make them count. |

Do not invent a fifth line. Do not translate the tagline in English copy; Hebrew copy may translate the
pillars but keeps the name in Latin letters.

## Claims: exact wording

Allowed, in these words or a shorter true version:

- **Free.** "Free and open source (MIT)." There is no paid tier; Ko-fi and Sponsors are a thank-you.
- **Local-first.** "No server, no telemetry, no analytics, no crash reports. Everything is computed and
  stored on your machine."
- **Privacy by design.** "Every network call it can make is listed in the README." Then, when space
  allows, the list: a daily GitHub release check (switchable); an optional push URL you set yourself;
  share buttons that open your browser; features that ask Claude Haiku through your own account, two of
  them automatic and on by default (correction capture, session finder), disclosed and switchable.
- **Guards.** "Blocks commands and edits that match known-dangerous patterns" and "pattern rules, not a
  sandbox." A blocked command is "potentially dangerous."
- **Verify.** "A goal is marked verified only when a real test, build, lint or diff ran."
- **Numbers.** 91 features. 1,936 tests (re-check before each post with `claude plugin test`). 10 UI
  languages, with "the nine translations have not had a native-speaker review yet." Band redraw under
  10 ms. About 500 tokens of injected context per turn, switchable.
- **Platform.** "Tested on Windows 11 in the Claude Code desktop app; macOS and Linux untested by the
  author."

Forbidden:

- "Everything stays on your machine", "nothing ever leaves your machine", "zero network", "100% offline".
- "Prevents disasters", "saved you from", "stopped a catastrophe", any claim about damage that did not
  happen. Say "blocked a potentially dangerous command."
- "Secure", "sandboxed", "bulletproof", "guarantees".
- Any savings figure, incident count or usage number not from the author's own session and labelled as
  such, or from demo mode and labelled DEMO.
- "Official", "by Anthropic", "endorsed", "recommended by Anthropic".
- "Works on all platforms", "10 languages fully supported".
- Star counts, install counts, or testimonials that cannot be shown on request.

## Logo

Mark: a cream cat in an orange visor sitting on a dark terminal window, on a dark rounded square with
neutral four-point sparkles. No Anthropic asterisk, on purpose.

| Asset | File | Use |
|---|---|---|
| Source | `assets/icon-1024.png` | everything derives from this |
| Listing / app icon | `assets/icon-512.png`, `icon-256.png` | Product Hunt thumbnail, directories |
| Inline | `assets/icon-128.png`, `icon-64.png`, `icon-32.png` | README, docs, favicons |
| Avatar | `assets/avatar-400.png` | Ko-fi, GitHub Sponsors, social profiles |
| Banner | `docs/assets/banner.png` (1280×640) | README header, GitHub social preview, LinkedIn image, tweet 6 |

Do: keep the dark square; leave at least the sparkle's width of clear space around the mark; place it on
dark or cream backgrounds; scale proportionally.

Don't: recolour the cat; remove the terminal; add a speech bubble or text inside the square; rotate;
place on orange (the visor disappears); put it next to Anthropic's or Claude's logo as if co-branded;
redraw it in another style for "fun" variants.

## Colours

| Role | Hex | Use |
|---|---|---|
| Background | `#0E0C14` | the dark square, dark slides, code blocks |
| Cream | `#FFF4E6` | the cat, headline text on dark |
| Orange start | `#FF8C3C` | visor, accents, buttons; gradient start |
| Orange end | `#FFB347` | gradient end, highlights |
| Text grey | `#C8C4D2` | body text on dark |

Pairings: cream or grey text on background; orange only as an accent (one element per surface). Never
orange text on cream, never grey on orange. In terminal copy, the band uses the host theme; do not force
brand colours there.

## Typography

No brand font. Use the platform's default (GitHub, X, Reddit set their own). In slides or images: a
humanist sans (Inter, Source Sans) for text, a monospace (JetBrains Mono, Cascadia Code) for commands and
the band. Commands always in monospace, always copy-pasteable, never in an image alone.

## Tone of voice

Plain, specific, a little dry. Friendly because it is honest, not because it is cute. The cat is cute;
the copy is not. Short sentences. Limits stated before anyone asks. Numbers only when real.

| Instead of | Write |
|---|---|
| "Toolkitty supercharges your Claude Code workflow with 91 amazing features!" | "91 features, each a switch. Three profiles set them in bulk." |
| "Never lose a folder to an agent again!" | "A broad `rm -rf` is blocked and explained. Pattern rules, not a sandbox." |
| "100% private, your code never leaves your machine." | "No server, no telemetry. Every network call it can make is listed in the README." |
| "Saved me $400 this month!" | "The savings card shows what the context tools skipped, computed locally. Demo data is marked DEMO." |
| "The cutest coding companion ever 🐱✨" | "A companion with a rarity roll that grows only from verified work. Off in the Minimal profile." |
| "Works everywhere." | "Tested on Windows 11 in the desktop app. macOS and Linux reports welcome." |
| "Please star the repo!" | (nothing; or) "The first bug report from a Mac is worth more to me than a hundred stars." |

Emoji: none in prose. The cat emoji may appear once at the end of a tweet, never in a title, never on HN,
never in an awesome-list description.

Exclamation marks: none. Questions: real ones, addressed to the reader, at most one per piece.

Hebrew copy: same rules. Keep technical terms and commands in Latin letters; keep the name Toolkitty in
Latin letters; gender-neutral forms (את/ה, עובד/ת) in direct address.

## Legal footer (where a footer fits)

"Toolkitty is an independent open-source project by Avraham Shemesh, MIT licence. Claude and Claude Code
are trademarks of Anthropic, PBC; Toolkitty is not affiliated with or endorsed by Anthropic."
