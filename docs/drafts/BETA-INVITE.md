# Wave A: beta tester invitation (drafts, 2026-11-09)

Send to 10–30 people who already use Claude Code, individually, not as a broadcast. Aim for at least two
on macOS and one on Linux. Ask for the first thing that confused or broke, not for praise or stars.

## English (DM / email)

Subject: Would you try a Claude Code plugin I built, before I post it anywhere?

Hi <name>,

I built a Claude Code plugin called Toolkitty: a status band with context and cost, guards that block
dangerous commands and secret leaks, a goal tracker that only trusts real test runs, and a small
companion cat. It is free and MIT, sends no telemetry, and I have not announced it yet.

Before I do, I want ten honest first installs. If you have 20 minutes this week:

1. Install (two commands, in Claude Code or a terminal):
   ```
   /plugin marketplace add avraham-tech/<repo>
   /plugin install toolkitty@avraham-tech
   ```
   Then start a new session; a short wizard should open.
2. Use it on one real task of yours, the way you normally work.
3. Reply with three things: your OS and whether you use the desktop app or the CLI; the first thing that
   confused you or did not work; and the one feature you would keep if there were only one.

If anything blocks the install, send me the exact output and stop there; that is the most useful report
of all. Please do not star or post about it yet; I would rather fix what you find first.

Thank you,
Avraham
https://github.com/avraham-tech/<repo>

## עברית (הודעה פרטית)

היי <שם>,

בניתי פלאגין ל-Claude Code בשם Toolkitty: סרגל מצב עם קונטקסט ועלות, שומרי סף שחוסמים פקודות
מסוכנות ודליפת סודות, מעקב מטרות שסומך רק על ריצות טסט אמיתיות, וחתול קטן שמלווה את הסשן. חינמי,
MIT, בלי טלמטריה, ועוד לא פרסמתי אותו בשום מקום.

לפני שאפרסם אני מחפש עשר התקנות ראשונות כנות. אם יש לך 20 דקות השבוע:

1. התקנה (שתי פקודות, בתוך Claude Code או בטרמינל):
   ```
   /plugin marketplace add avraham-tech/<repo>
   /plugin install toolkitty@avraham-tech
   ```
   ואז לפתוח סשן חדש; אמור להיפתח אשף קצר.
2. לעבוד איתו על משימה אמיתית אחת, כמו שאת/ה עובד/ת בדרך כלל.
3. לענות לי בשלושה דברים: מערכת ההפעלה והאם זה האפליקציה או ה-CLI; הדבר הראשון שבלבל או לא עבד;
   והפיצ'ר האחד שהיית שומר/ת אם היה רק אחד.

אם משהו חוסם את ההתקנה, לשלוח לי את הפלט המדויק ולעצור שם; זה הדיווח הכי שימושי. בבקשה עוד לא
לתת כוכב ולא לפרסם; אני מעדיף קודם לתקן מה שתמצאו.

תודה,
אברהם

## Tracking sheet (keep locally, not in the repo)

| Tester | OS / surface | Install ok? | First problem | Keep-one feature | Fixed? |
|---|---|---|---|---|---|

Exit criteria for Wave A (from LAUNCH-PLAN task 9): at least 10 confirmed installs, at least 5 written
reports, the top three issues fixed and re-tested by the person who reported them.
