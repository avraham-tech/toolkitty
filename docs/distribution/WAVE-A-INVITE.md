# Wave A: beta invitation (final, 2026-11-09)

Send one at a time, by DM or email, to 10–30 people who already use Claude Code. Aim for at least two on
macOS and one on Linux (the plugin is tested on Windows only). Ask for the first thing that confused or
broke, not for praise. Do not ask for stars or posts: the gate for every public post is ten clean installs
from this wave, and a premature star or post burns the "I have not announced it yet" line.

One link, two commands, in every message:

```text
https://github.com/avraham-tech/toolkitty
/plugin marketplace add avraham-tech/toolkitty
/plugin install toolkitty@avraham-tech
```

Log every reply in `WAVE-A-TESTERS.csv`. Reply within a day; a tester who hit a wall and heard nothing
back will not install the fix.

---

## English (DM or email)

**Subject:** Would you try a Claude Code plugin I built, before I post it anywhere?

Hi <name>,

I built a Claude Code plugin called Toolkitty: a status band with context and cost, guards that block
dangerous commands and secret leaks, a goal tracker that only trusts real test runs, and a small
companion cat. Free, MIT, no telemetry. I have not announced it anywhere yet.

Before I do, I want ten honest first installs. If you have 20 minutes this week:

1. Install. Two commands, inside Claude Code (or `claude plugin ...` in a terminal):
   ```
   /plugin marketplace add avraham-tech/toolkitty
   /plugin install toolkitty@avraham-tech
   ```
   Then start a new session. A short welcome wizard should open.
2. Use it on one real task of yours, the way you normally work.
3. Reply with three things: your OS and whether you use the desktop app or the CLI; the first thing that
   confused you or did not work; and the one feature you would keep if there were only one.

If the install itself fails, send me the exact output and stop there. That is the most useful report of
all. Please do not star or post about it yet; I would rather fix what you find first.

Thank you,
Avraham
https://github.com/avraham-tech/toolkitty

---

## English, short form (X DM / Discord DM, under 500 characters)

Hi <name>. I built a Claude Code plugin (status band, guards against rm -rf and secret leaks, a goal
tracker that trusts only real test runs, and a cat). Free, MIT, no telemetry, not announced yet. Would
you give it one real session this week and tell me the first thing that broke or confused you? Install:
`/plugin marketplace add avraham-tech/toolkitty` then `/plugin install toolkitty@avraham-tech`. Repo:
https://github.com/avraham-tech/toolkitty. No stars or posts yet please; fixes first.

---

## עברית (הודעה פרטית או מייל)

**נושא:** תנסה פלאגין ל-Claude Code שבניתי, לפני שאני מפרסם אותו?

היי <שם>,

בניתי פלאגין ל-Claude Code בשם Toolkitty: סרגל מצב עם קונטקסט ועלות, שומרי סף שחוסמים פקודות
מסוכנות ודליפת סודות, מעקב מטרות שסומך רק על ריצות טסט אמיתיות, וחתול קטן שמלווה את הסשן.
חינמי, MIT, בלי טלמטריה. עוד לא פרסמתי אותו בשום מקום.

לפני שאפרסם אני מחפש עשר התקנות ראשונות כנות. אם יש לך 20 דקות השבוע:

1. התקנה. שתי פקודות, בתוך Claude Code (או `claude plugin ...` בטרמינל):
   ```
   /plugin marketplace add avraham-tech/toolkitty
   /plugin install toolkitty@avraham-tech
   ```
   ואז לפתוח סשן חדש. אמור להיפתח אשף פתיחה קצר.
2. לעבוד איתו על משימה אמיתית אחת, כמו שאת/ה עובד/ת בדרך כלל.
3. לענות לי בשלושה דברים: מערכת ההפעלה והאם זה האפליקציה או ה-CLI; הדבר הראשון שבלבל או לא עבד;
   והפיצ'ר האחד שהיית שומר/ת אם היה רק אחד.

אם ההתקנה עצמה נכשלת, לשלוח לי את הפלט המדויק ולעצור שם. זה הדיווח הכי שימושי. בבקשה עוד לא
לתת כוכב ולא לפרסם; אני מעדיף קודם לתקן מה שתמצאו.

תודה,
אברהם
https://github.com/avraham-tech/toolkitty

---

## עברית, גרסה קצרה (וואטסאפ / DM)

היי <שם>, בניתי פלאגין ל-Claude Code (סרגל מצב, חסימת rm -rf ודליפת סודות, מעקב מטרות שסומך רק
על טסטים אמיתיים, וחתול). חינמי, MIT, בלי טלמטריה, עוד לא פורסם. תוכל/י לתת לו סשן אמיתי אחד
השבוע ולהגיד לי מה הדבר הראשון שנשבר או בלבל? התקנה: `/plugin marketplace add avraham-tech/toolkitty`
ואז `/plugin install toolkitty@avraham-tech`. ריפו: https://github.com/avraham-tech/toolkitty.
בלי כוכבים ופוסטים בינתיים בבקשה; קודם תיקונים.

---

## Follow-up after a report (English)

Thanks, <name>. Logged. <One sentence: what I will do about the thing you hit, or why it is by design.>
If you have one more minute: did the welcome wizard open on the first new session, and did `/toolkitty`
show the feature list? That tells me the install is fully clean on <OS>.

## Follow-up after a fix shipped

<name>, the <problem> you hit is fixed in <version>. Update with
`claude plugin marketplace update avraham-tech` then `claude plugin update toolkitty@avraham-tech`, or
reinstall. If it still happens, the exact output again please; if it is gone, a one-word "gone" is
enough and I will mark it closed.

## Exit criteria for Wave A (gate for every public post)

- At least 10 installs confirmed clean (wizard opened, `/toolkitty` lists features, no error output).
- At least 5 written reports; at least two macOS and one Linux among the installs.
- The top three reported problems fixed, released, and re-tested by the person who reported each.
- Every quote used in public copy has the tester's written permission (CSV column `quote_ok`).
