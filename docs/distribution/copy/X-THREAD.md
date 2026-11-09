# X thread (final copy, 2026-11-09)

Post within an hour of the Show HN. Do not tag Anthropic staff; do not link the HN thread in tweet 1 (a
link in the first tweet lowers reach; put links in tweet 6). Each tweet under 280 characters; counts
below are approximate, re-check in the composer.

**Assets:** tweet 1 = GIF 1 (companion reveal); tweet 3 = GIF 2 (guardrail, DEMO chip visible); tweet 4 =
GIF 3 (band and savings) or a still of the band; tweet 6 = README banner (docs/assets/banner.png).

---

**1/6** (GIF 1)

Your Claude Code has nine lives. Make them count.

I gave Claude Code a cat. It has a rarity roll, reacts to your session, and grows only from verified work:
a real test run, a blocked dangerous command. Never from spending tokens.

It is the front end of 91 switches. Thread.

---

**2/6**

Why a cat: the most-upvoted open Claude Code issue is "Bring Back Buddy", 2,000+ reactions. People want a
face on the tool. Fine. But the face should be attached to something that earns its place on screen.

---

**3/6** (GIF 2)

Guards. Broad rm -rf, force-push to main, reset --hard, curl | sh, writes to .env, secrets in pasted text.
Blocked, with a receipt: the rule, the matched text, what to do instead.

Pattern rules, not a sandbox; the README says so.

(Demo data in the clip, marked DEMO.)

---

**4/6** (GIF 3)

Meters. Context %, this turn's cost, plan usage, cache state, what Claude is doing right now, in a band
above the prompt. Duplicate-read detection, long outputs archived, a handoff draft you edit before
compaction.

Redraws in under 10 ms.

---

**5/6**

Verify. A goal is "done" only when a real test, build, lint or diff ran. "All tests pass" with no test
run stays unverified, visibly.

Free, MIT. No server, no telemetry. The README lists every network call, including two Haiku features
that are on by default and switchable.

---

**6/6** (banner)

Toolkitty: your coding companion for Claude Code. Monitor · Optimize · Protect · Verify.

Inside Claude Code:
/plugin marketplace add avraham-tech/toolkitty
/plugin install toolkitty@avraham-tech

https://github.com/avraham-tech/toolkitty
Windows-tested; Mac and Linux reports welcome.

---

## Replies to keep ready

- Someone posts their companion: reply with the rarity tier name and thank them. No "please star".
- "Is it safe to install?": "Same permissions as Claude Code, plain TypeScript, `claude plugin validate`
  lists every event and API it touches. SECURITY.md in the repo."
- "Does it work on Mac?": "Not tested by me yet. If you try it, the first thing that breaks is the
  issue I most want."
