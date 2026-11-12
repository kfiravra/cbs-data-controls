<div dir="rtl">

# בקרות נתונים – מסמכי ההגשה

מבחן Fullstack: מערכת בקרות נתונים דינאמית (PYTHON, ‎.NET, Angular, SQL Server).

בתיקייה הזאת נמצאים מסמכי ההגשה בעברית, מסמך לכל תוצר שהמטלה מבקשת. המסמכים המפורטים נמצאים בתיקייה [`docs/`‎](../docs), והם כתובים באנגלית.

## מה המערכת

מערכת גנרית להגדרת בקרות איכות נתונים, להרצתן ולניתוח החריגות. משתמש עסקי מגדיר בקרה בממשק בעברית, מתוך מונחים עסקיים בלבד: בלי SQL, בלי שמות טבלאות ובלי שמות שדות. המערכת מתרגמת את ההגדרה לשאילתה אחת עם פרמטרים, מריצה אותה בהרשאת קריאה בלבד, ומציגה את הרשומות החריגות ואת הסיבה לכל חריגה.

בקרה חדשה היא נתון ולא קוד: אין שאילתה קבועה לבקרה ואין פיתוח ייעודי לבקרה. הוספת שדה, ישות או קשר היא עריכה של קובץ אחד, מילון המונחים העסקי.

![רשימת הבקרות, אחרי הרצה של שש הבקרות לדוגמה](../docs/screenshots/list.png)

## תוצרים להגשה

| | התוצר, בלשון המטלה | היכן |
|---|---|---|
| 1 | קוד מקור מלא של צד הלקוח וצד השרת | צד הלקוח: <span dir="ltr">[`web/`](../web)</span>, ב־Angular<br>צד השרת, ה־API: <span dir="ltr">[`api/`](../api)</span>, ב־‎.NET 10<br>צד השרת, מנוע הבקרות: <span dir="ltr">[`engine/`](../engine)</span>, ב־Python |
| 2 | סקריפטים להקמת בסיס הנתונים וטעינת נתוני דוגמה | התיקייה <span dir="ltr">[`sql/`](../sql)</span>. מה כל סקריפט יוצר ואיך מריצים אותו: [install.he.md](install.he.md), פרק ג |
| 3 | הוראות התקנה והרצה | [install.he.md](install.he.md) |
| 4 | מסמך קצר המתאר את הארכיטקטורה ואת מנגנון הבקרות | [summarize-architecture.he.md](summarize-architecture.he.md) |
| 5 | דוגמאות לבקרות שניתן להגדיר ולהריץ | [examples.he.md](examples.he.md) |
| 6 | פירוט קצר של הנחות העבודה, המגבלות והרחבות אפשריות | [assumptions-limitations-extensions.he.md](assumptions-limitations-extensions.he.md) |
| 7 | פירוט כלי ה־AI שבהם נעשה שימוש ומטרת השימוש בכל אחד מהם | [ai-usage.he.md](ai-usage.he.md) |
| + | המשימה המתקדמת (רשות): תכנון יכולת שבה AI מציע בקרות | [ai-suggestions.he.md](ai-suggestions.he.md) |

## הרצה מהירה

נדרש Docker בלבד. מתוך תיקיית המאגר:

| מערכת הפעלה | פקודה |
|---|---|
| Windows | <span dir="ltr">`start.cmd`</span> |
| Linux, macOS, WSL | <span dir="ltr">`scripts/start.sh`</span> |

בסיום המערכת זמינה בדפדפן בכתובת <span dir="ltr">http://localhost:5000</span>, וברשימה שש בקרות לדוגמה מוכנות להרצה. ההרצה הראשונה אורכת כמה דקות. הפירוט המלא, כולל התקנה בלי Docker, נמצא במסמך [install.he.md](install.he.md).

## המסמכים באנגלית

למי שרוצה את הגרסה המפורטת:

| נושא | מסמך |
|---|---|
| התקנה, הרצה, בדיקות ותפעול | [README.md](../README.md) |
| הארכיטקטורה המלאה | [docs/architecture.md](../docs/architecture.md) |
| הארכיטקטורה בקצרה | [docs/summarize-architecture.md](../docs/summarize-architecture.md) |
| מבנה הגדרת הבקרה | [docs/control-definition.md](../docs/control-definition.md) |
| מילון המונחים ואיך מרחיבים אותו | [docs/glossary.md](../docs/glossary.md) |
| שש הבקרות לדוגמה, עם כל הרשומות שהן מוצאות | [docs/examples.md](../docs/examples.md) |
| הנחות, מגבלות והרחבות | [docs/assumptions-limitations-extensions.md](../docs/assumptions-limitations-extensions.md) |
| כלי ה־AI | [docs/ai-usage.md](../docs/ai-usage.md) |

## איך העבודה נעשתה

הפיתוח נעשה בעזרת Claude Code ובעזרת הצ'אט של claude.ai, כמפורט ב־[ai-usage.he.md](ai-usage.he.md). במערכת עצמה אינו פועל שום רכיב AI.

העבודה חולקה לחמש משימות, ולכל אחת תוכנית עבודה, יומן החלטות ותוצאות בדיקה. הן שמורות במאגר, בתיקייה [`dev/`‎](../dev), כדי שאפשר יהיה לראות את התהליך ולא רק את התוצאה.

</div>
