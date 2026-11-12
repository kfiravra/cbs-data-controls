<div dir="rtl">

# התקנה והרצה

**תוצרים 2 ו־3 מתוך 7:** סקריפטים להקמת בסיס הנתונים וטעינת נתוני דוגמה, והוראות התקנה והרצה. [לכל התוצרים](README.he.md)

יש שתי דרכים להריץ את המערכת: עם Docker, בפקודה אחת, או בהתקנה רגילה מול SQL Server שכבר מותקן במחשב. בשתיהן בסיס הנתונים מוקם מאותם סקריפטים, שבתיקייה [`sql/`‎](../sql). הם מפורטים בפרק ג.

## א. הרצה עם Docker

**מה נדרש:** Docker עם Compose v2. ב־Windows וב־macOS מתקינים את Docker Desktop. שום דבר אחר אינו מותקן על המחשב.

**מה מריצים**, מתוך תיקיית המאגר:

| מערכת הפעלה | פקודה |
|---|---|
| Windows | <span dir="ltr">`start.cmd`</span> (בלחיצה כפולה, או מחלון פקודה) |
| Linux, macOS, WSL | <span dir="ltr">`scripts/start.sh`</span> |

**מה הסקריפט עושה**, לפי הסדר:

1. בודק ש־Docker פועל.
2. יוצר את קובץ ההגדרות ‎`.env` עם שלוש סיסמאות אקראיות. קובץ שכבר קיים אינו משתנה.
3. בונה ומפעיל את המכולות: SQL Server, מנוע הבקרות, וה־API יחד עם הלקוח.
4. מקים את בסיס הנתונים: מריץ את הסקריפטים שבתיקייה `sql/`‎ לפי הסדר, כולל נתוני הדוגמה.
5. טוען שש בקרות לדוגמה, מוכנות להרצה. בקרה שכבר קיימת אינה נטענת שוב.
6. ממתין עד שהמערכת עונה, ומדפיס את הכתובות:

</div>

```
Data Controls is running.

  The app            http://localhost:5000
  The api's pages    http://localhost:5000/api/docs
  The database       127.0.0.1,14330 (SQL Server; the logins and their passwords are in .env)
```

<div dir="rtl">

פותחים בדפדפן את הכתובת <span dir="ltr">http://localhost:5000</span>. ברשימה מופיעות שש הבקרות לדוגמה, וכל אחת מורצת בלחיצה על "הרצה".

**כמה זמן זה אורך:** ההרצה הראשונה מורידה את תמונת SQL Server (כ־2.2 ג'יגה) ובונה שתי תמונות, ולכן היא אורכת כמה דקות, לפי מהירות החיבור. הרצה חוזרת אורכת כחצי דקה.

**עצירה ומחיקה:**

| פקודה | מה היא עושה |
|---|---|
| <span dir="ltr">`docker compose stop`</span> | עוצרת את המכולות. הפקודה <span dir="ltr">`docker compose start`</span> מפעילה אותן שוב |
| <span dir="ltr">`docker compose down`</span> | מסירה את המכולות ושומרת את הנתונים |
| <span dir="ltr">`docker compose down -v`</span> | מוחקת גם את הנתונים. ההרצה הבאה מקימה את בסיס הנתונים מחדש |

**פורטים:** המערכת מאזינה במחשב המקומי בלבד (127.0.0.1). את הפורטים משנים בקובץ ‎`.env`, ואז מריצים שוב את סקריפט ההפעלה.

| משתנה | ברירת מחדל | מה מאזין שם |
|---|---|---|
| `APP_PORT` | 5000 | המערכת וה־API שלה |
| `DB_PORT` | 14330 | SQL Server, לחיבור מ־SSMS (שם השרת: <span dir="ltr">`127.0.0.1,14330`</span>). לא 1433, כדי לא להתנגש ב־SQL Server שמותקן במחשב |

**אם המערכת אינה עולה:**

- **פורט תפוס:** קובעים פורט פנוי ב־`APP_PORT` או ב־`DB_PORT` בקובץ ‎`.env`, ומריצים שוב.
- **Docker אינו עונה:** מפעילים את Docker Desktop, ממתינים עד שהוא מודיע שהוא פועל, ומריצים שוב.
- **כל תקלה אחרת:** הסקריפט מדפיס את מצב המכולות ואת שורות הלוג האחרונות של המכולה שלא עלתה. את השאר מציגה הפקודה <span dir="ltr">`docker compose logs engine`</span>. במקום `engine` אפשר לכתוב גם `api`, וכן `db` או `db-init`.

## ב. התקנה בלי Docker

למחשב שיש בו SQL Server משלו.

**מה נדרש:**

- SQL Server 2019 או 2022, שמאפשר הזדהות SQL (<span dir="ltr">"SQL Server and Windows Authentication mode"</span>). המערכת משתמשת בכוונה בשני משתמשי SQL: אחד יכול רק לקרוא את נתוני הארגון, והשני יכול לכתוב רק למאגר הבקרות.
- ODBC Driver 18 for SQL Server (גם 17 מתאים)
- Python 3.12 ומעלה
- ‎.NET 10 SDK
- Node 22.12 ומעלה

הפקודות כתובות ל־bash (Linux, macOS, WSL, Git Bash). במקום שבו PowerShell שונה, הצורה שלו מופיעה אחריהן.

### שלב 1: הגדרות

מעתיקים את קובץ הדוגמה:

</div>

```sh
cp .env.example .env
```

<div dir="rtl">

בקובץ ‎`.env` קובעים שלוש סיסמאות:

- `DQ_APP_PASSWORD` ו־`DQ_ENGINE_RO_PASSWORD`: סיסמאות חדשות לבחירתכם, לשני המשתמשים ששלב 2 יוצר. לפחות 8 תווים, עם אות גדולה, אות קטנה וספרה, ובלי רווחים, מירכאות, `$`, `;` או לוכסן הפוך.
- `MSSQL_SA_PASSWORD`: הסיסמה הקיימת של המשתמש `sa` בשרת שלכם. שלב 2 מתחבר איתה. אם `sa` מושבת, מריצים את הסקריפטים ב־SSMS עם משתמש מנהל של Windows, כמתואר בפרק ג.

באותו קובץ מכוונים את שתי שורות הפורט לשרת שלכם: <span dir="ltr">`DB_PORT=1433`</span> ו־<span dir="ltr">`ENGINE_DB_PORT=1433`</span>.

### שלב 2: בסיס הנתונים

פקודה אחת מקימה את בסיס הנתונים `DataControls`, שתי הסכמות, שני המשתמשים ונתוני הדוגמה. היא דורשת bash ו־sqlcmd במחשב:

</div>

```sh
DB_HOST=localhost DB_PORT=1433 scripts/db-init.sh
```

<div dir="rtl">

בלי bash או sqlcmd מריצים את הסקריפטים ידנית ב־SSMS, כמתואר בפרק ג.

### שלב 3: המנוע

</div>

```sh
cd engine
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

<div dir="rtl">

ב־Windows הפקודה הראשונה היא <span dir="ltr">`py -m venv .venv`</span>, והמפרש נמצא ב־<span dir="ltr">`.venv\Scripts\python`</span>.

המנוע קורא את הקובץ ‎`.env` בעצמו, בודק את מילון המונחים מול בסיס הנתונים, ומתחיל להאזין. משאירים אותו פועל.

### שלב 4: הלקוח וה־API

בחלון שני, מתוך תיקיית המאגר: בונים את הלקוח, בונים את ה־API, ומעתיקים את הלקוח לתיקייה שה־API מגיש ממנה.

</div>

```sh
(cd web && npm ci && npx ng build)
dotnet publish api/src/DataControls.Api -c Release -o publish -p:TreatWarningsAsErrors=false
cp -r web/dist/web/browser publish/wwwroot
```

<div dir="rtl">

המתג <span dir="ltr">`TreatWarningsAsErrors=false`</span> נועד רק למנוע עצירה בגלל אזהרה של גרסת SDK חדשה יותר.

מפעילים את ה־API. במקום הטקסט שבסוגריים המשולשים כותבים את הסיסמה של `dq_app` מהקובץ ‎`.env`:

</div>

```sh
DQ_APP_PASSWORD='<the dq_app password of .env>' DB_HOST=localhost DB_PORT=1433 \
Engine__BaseUrl=http://localhost:8000 ASPNETCORE_URLS=http://localhost:5000 \
dotnet publish/DataControls.Api.dll
```

<div dir="rtl">

וב־PowerShell:

</div>

```powershell
$env:DQ_APP_PASSWORD = '<the dq_app password of .env>'; $env:DB_HOST = 'localhost'; $env:DB_PORT = '1433'
$env:Engine__BaseUrl = 'http://localhost:8000'; $env:ASPNETCORE_URLS = 'http://localhost:5000'
dotnet publish\DataControls.Api.dll
```

<div dir="rtl">

### שלב 5: הבקרות לדוגמה

בחלון שלישי טוענים את שש הבקרות לדוגמה, ואז פותחים בדפדפן את הכתובת <span dir="ltr">http://localhost:5000</span>:

</div>

```sh
python3 scripts/examples.py load
```

<div dir="rtl">

**מה ההתקנה הזאת אינה עושה:** היא אינה יוצרת בשרת דבר מלבד בסיס הנתונים `DataControls` ושני המשתמשים, אינה משנה הגדרות של השרת, ואינה מתקינה דבר מחוץ לתיקיית המאגר. כדי להסיר הכול מוחקים את בסיס הנתונים, את שני המשתמשים ואת התיקייה.

פרטים נוספים, למשל שרת עם named instance, נמצאים ב־[README.md](../README.md), בפרק <span dir="ltr">"Run from source, without Docker"</span>.

## ג. סקריפטי בסיס הנתונים

הסקריפטים נמצאים בתיקייה [`sql/`‎](../sql), והם רצים לפי סדר השמות. אפשר להריץ כל סקריפט שוב: הרצה חוזרת אינה משנה דבר.

| סקריפט | מה הוא יוצר |
|---|---|
| <span dir="ltr">`00_database.sql`</span> | בסיס הנתונים `DataControls`, עם collation עברי (`Hebrew_CI_AS`) |
| <span dir="ltr">`10_schemas.sql`</span> | שתי סכמות: `hr` לנתוני הארגון, ו־`dq` למאגר הבקרות |
| <span dir="ltr">`20_hr_tables.sql`</span> | טבלאות נתוני הארגון: משרדים, מחלקות ועובדים |
| <span dir="ltr">`30_dq_tables.sql`</span> | טבלאות מאגר הבקרות: בקרות, גרסאות, הרצות ותוצאות |
| <span dir="ltr">`40_logins.sql`</span> | שני המשתמשים וההרשאות שלהם |
| <span dir="ltr">`50_indexes.sql`</span> | אינדקסים |
| <span dir="ltr">`60_seed_hr.sql`</span> | נתוני הדוגמה: 5 משרדים, 16 מחלקות ו־85 עובדים. כולם בדויים, ובהם רשומות שגויות שנשתלו בכוונה, כדי שלכל בקרה לדוגמה יהיה מה למצוא |

**שני המשתמשים:**

| משתמש | מי משתמש בו | מה מותר לו | מה אסור לו |
|---|---|---|---|
| `dq_app` | ה־API | לקרוא ולכתוב בסכמה `dq` | כל גישה לסכמה `hr` |
| `dq_engine_ro` | המנוע | לקרוא מהסכמה `hr` | לכתוב לסכמה `hr`, וכל גישה לסכמה `dq` |

**איך מריצים את הסקריפטים:**

- **עם Docker:** הם רצים לבד, כחלק מההפעלה.
- **בלי Docker, בפקודה אחת:** <span dir="ltr">`scripts/db-init.sh`</span>, כמו בשלב 2. התוספת <span dir="ltr">`--reset`</span> מוחקת את בסיס הנתונים ומקימה אותו מחדש.
- **ידנית, ב־SSMS:** בארבעת הצעדים שלהלן.

1. מתחברים לשרת כמנהל.
2. פותחים את הסקריפטים לפי הסדר, ומריצים כל אחד כשהאפשרות <span dir="ltr">Query > SQLCMD Mode</span> מופעלת.
3. בחלון של <span dir="ltr">`40_logins.sql`</span> מוסיפים בראש הקובץ, לפני ההרצה, את שתי השורות שלהלן, עם הסיסמאות שנקבעו בשלב 1. לא שומרים אותן בקובץ.
4. לפני הרצת <span dir="ltr">`60_seed_hr.sql`</span> בודקים שהעברית מוצגת נכון בעורך. אם לא, פותחים את הקובץ מחדש בקידוד UTF-8.

</div>

```
:setvar DQ_APP_PASSWORD <the dq_app password>
:setvar DQ_ENGINE_RO_PASSWORD <the dq_engine_ro password>
```

<div dir="rtl">

הפירוט המלא, באנגלית: [sql/README.md](../sql/README.md).

## מה נבדק

- **עם Docker:** על Linux (WSL 2) ועל Windows 10, ממאגר נקי.
- **בלי Docker:** על Linux (WSL) בלבד. שלבים 3 עד 5 הורצו כלשונם. הפקודה של שלב 2 רצה רק בתוך המכולה של Docker, כי במחשב הפיתוח אין sqlcmd.
- **לא נבדק:** התקנה בלי Docker על Windows, הרצת הסקריפטים ידנית ב־SSMS, ו־macOS.

</div>
