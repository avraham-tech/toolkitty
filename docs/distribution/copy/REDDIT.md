# Reddit posts (final copy, 2026-11-09)

Before each post: read the subreddit's sidebar rules in a normal browser (they could not be fetched from
this machine), pick the flair the sub requires, and write the rule you found into STATUS.md. Reddit-wide
norm: well under 10% of your activity should be your own links, so comment usefully in the sub for a few
days first. Answer every comment for the first two hours. Never post the same text in two subs on the
same day.

Every post ends with the same install block:

```
Install (inside Claude Code):
/plugin marketplace add avraham-tech/toolkitty
/plugin install toolkitty@avraham-tech
Repo: https://github.com/avraham-tech/toolkitty (MIT)
```

---

## A. r/ClaudeAI — image/GIF post, cat angle

**Asset needed:** GIF 1 (companion reveal, 6–8 s) as the post media. If the sub only allows one image,
use a still of the buddy pane with the rarity line visible.

**Title:** I missed Buddy, so I gave Claude Code a cat that also blocks `rm -rf`

**Body:**

The "Bring Back Buddy" issue has over 2,000 reactions, and I was one of the people who missed having a
face on the tool. So I built a plugin where the companion is the front end of something more useful.

The cat is a Claude Code plugin called Toolkitty. The companion has a rarity roll on first run and grows by
verified events (a real test run, a blocked dangerous command), never by spending tokens. Behind it:

- a status band above the prompt with context %, cost for this turn, plan usage and what Claude is
  doing now;
- guards that block broad `rm -rf`, force-push to main, `reset --hard`, pipe-to-shell downloads, writes
  to secret files and pasted secrets, each with a receipt that says what was blocked and why;
- a goal tracker that only marks a task "verified" when a real test, build, lint or diff ran;
- context hygiene: duplicate-read detection, archiving of long tool output, a handoff draft before
  compaction.

91 features in all, each one a switch. Three profiles (Minimal, Productive, Playful) set them in bulk; the
cat is off in Minimal.

Honest limits: the guards are pattern rules, not a sandbox. I tested on Windows 11 in the desktop app;
macOS and Linux reports are welcome. It is free and MIT, has no server and no telemetry; the README lists
the few network calls it can make (a daily release check, and some features that ask Haiku through your
own account, two of them on by default and switchable).

[install block]

---

## B. r/ClaudeCode — text post, efficiency + safety angle

**Asset needed:** GIF 3 (band and savings) or GIF 2 (guardrail with DEMO chip) as an inline image, if the
flair allows media. Text works without it.

**Title:** A plugin that shows context % and cost above the prompt, blocks dangerous commands with a
receipt, and only trusts real test runs

**Body:**

I built this because of four recurring moments in Claude Code: compaction hit before I expected it; a turn
cost far more than I thought; a command I would never have typed ran anyway; and "all tests pass"
appeared in a reply with no test run in the transcript.

Toolkitty is one plugin with 91 switchable features on the hooks runtime. The ones that address those
four moments:

1. **Status band**: context %, this turn's cost, plan usage, cache state, current activity. Redraws in
   under 10 ms.
2. **Guards**: `rm -rf` on broad paths, force-push without lease or to main, `reset --hard`,
   `curl | sh`, writes to `.env` and friends, secrets in pasted text or staged lines, pushes while CI is
   red. Each block produces a receipt: the rule, the matched text, what to do instead. Any guard can be
   switched off or given a one-time pass.
3. **Goal tracker**: a task is "verified" only when a real test, build, lint or diff ran in the session.
   A claim without evidence stays unverified, visibly.
4. **Context hygiene**: duplicate-read detection, archiving of long tool outputs (the hook that saved
   this post's research from a 40 KB dump), a handoff draft you edit before compaction, `/context-doctor`.

What it costs you: about 500 tokens of injected context per turn for the features that give the model
information (git context, pinned files, rules); each is switchable. What leaves your machine: nothing to
any server of mine; the README lists a daily GitHub release check and the features that call Haiku through
your own account (two automatic and on by default, both disclosed and switchable).

There is also a cat. It is off in the Minimal profile.

1,936 tests via `claude plugin test`. Tested on Windows 11 desktop app only so far; I would love a macOS or
Linux report, especially a failing one.

[install block]

---

## C. r/commandline — only if the sidebar allows tool posts

**Asset needed:** a still of the status band and one pane in a plain terminal (not the desktop app), no
cat in frame.

**Title:** Toolkitty: a terminal status band, command guards and context meters for Claude Code (TS, MIT)

**Body:**

A plugin for Anthropic's Claude Code CLI. It draws a status band above the prompt (context %, cost, plan
usage, activity), blocks command patterns you would not type by hand (`rm -rf` on broad paths, force-push
to main, `reset --hard`, pipe-to-shell), and shows what each turn did to the context window. Everything
renders as text in a terminal; panes are keyboard-driven.

Disclosure, since the sub asks: the code was written with Claude under my architecture and test plan,
and the 1,936-test suite is what I rely on. Windows-tested only; macOS and Linux reports welcome.

[install block]

---

## D. r/SideProject — maker story

**Asset needed:** GIF 1 or the README banner.

**Title:** I built a 91-feature companion plugin for Claude Code as one person; here is what I would do
differently

**Body:**

Toolkitty started as "I miss the Buddy pet" and became a plugin with 91 switchable features for Claude
Code: a status band, guards against dangerous commands, a goal tracker that only trusts real test runs,
and a cat that grows by verified work.

Three things I learned:

- **Switches beat opinions.** Every feature is a toggle; three profiles set them in bulk. People who hate
  pets pick Minimal and still get the guards.
- **Disclosure beats defaults.** Two features call Haiku automatically through the user's own account. I
  kept them on and wrote them into the README's traffic table instead of hiding them or turning them off.
- **Receipts make guards trustworthy.** A blocked command with no explanation feels like a bug. A receipt
  that quotes the rule and the matched text feels like a seatbelt.

Free, MIT, no telemetry. Windows-tested; I want the first macOS or Linux bug report.

[install block]

---

## E. Optional Hebrew post (after the English wave, only if Avraham wants it)

**Asset:** GIF 1.

בניתי פלאגין ל-Claude Code בשם Toolkitty: סרגל מצב עם קונטקסט ועלות מעל שורת הפקודה, שומרי סף
שחוסמים `rm -rf` רחב, force-push ל-main ודליפת סודות (עם קבלה שמסבירה מה נחסם ולמה), מעקב מטרות
שמסמן משימה כ"מאומתת" רק אחרי ריצת טסט אמיתית, וחתול קטן שגדל מאירועים מאומתים. 91 פיצ'רים, כל אחד
מתג. חינמי, MIT, בלי שרת ובלי טלמטריה. ממשק גם בעברית (התרגום עוד לא עבר ביקורת דובר שפה, אשמח לתיקונים).
נבדק בווינדוס; דיווחים ממק ולינוקס יתקבלו בשמחה.

[install block]
