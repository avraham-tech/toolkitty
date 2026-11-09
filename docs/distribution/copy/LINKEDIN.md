# LinkedIn post (final copy, 2026-11-09)

Post on HN day or the day after. LinkedIn truncates after about three lines, so the first sentence has to
carry it. One image: GIF 2 (the guardrail with the DEMO chip) if LinkedIn keeps the animation, otherwise
the README banner. Put the links in the first comment, not the body (LinkedIn down-ranks posts with
external links in the body).

**Asset needed:** GIF 2 or docs/assets/banner.png. First comment: repo link + install commands.

---

I spent a year watching coding agents run commands I would never have typed. So I built the seatbelt, and
gave it a cat.

Toolkitty is a free, open-source plugin for Claude Code that I released this week. It does four things for
a team that lets agents touch real repositories:

Monitor. A status band above the prompt shows how full the context window is, what this turn cost, plan
usage, and what the agent is doing right now. No more surprise compaction mid-task.

Optimize. Duplicate reads are flagged, long tool outputs are archived instead of filling the window, and a
handoff draft is written before compaction so the next session starts informed.

Protect. Guards block the command patterns that end careers: broad rm -rf, force-push to main,
reset --hard, piping a download into a shell, writes to secret files, secrets in pasted text. Each block
comes with a receipt that quotes the rule and the matched text. They are pattern rules, not a sandbox, and
the README says so.

Verify. A task is marked done only when a real test, build, lint or diff ran in the session. "All tests
pass" with no test run behind it stays visibly unverified.

91 features, each a switch, three profiles to set them in bulk. 1,936 tests. No server, no telemetry;
every network call it can make is listed in the README. MIT licence.

And yes, the companion cat. It has a rarity roll and grows only from verified work. The most-upvoted open
Claude Code issue is "Bring Back Buddy", with over 2,000 reactions. People want a face on their tools. I
made sure the face is attached to something that earns its place.

Tested on Windows 11 so far. If you run Claude Code on macOS or Linux and have twenty minutes, your first
bug report is worth more to me than a hundred likes.

Links in the first comment.

---

**First comment:**

Repo (MIT): https://github.com/avraham-tech/toolkitty

Install, inside Claude Code:
/plugin marketplace add avraham-tech/toolkitty
/plugin install toolkitty@avraham-tech

Or in a terminal: claude plugin install toolkitty --marketplace avraham-tech/toolkitty
