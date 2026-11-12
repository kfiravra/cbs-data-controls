<div dir="rtl">

# התקנה והרצה

**תוצרים 2 ו־3 מתוך 7:** סקריפטים להקמת בסיס הנתונים וטעינת נתוני דוגמה, והוראות התקנה והרצה. [לכל התוצרים](README.he.md)

יש שתי דרכים להריץ את המערכת: עם Docker, בפקודה אחת, או בהתקנה רגילה מול SQL Server שכבר מותקן במחשב. בשתיהן בסיס הנתונים מוקם מאותם סקריפטים, שבתיקייה [`sql/`&lrm;](../sql). הם מפורטים בפרק ג.

## א. הרצה עם Docker

**מה נדרש:** Docker עם Compose v2. ב־Windows וב־macOS מתקינים את Docker Desktop. שום דבר אחר אינו מותקן על המחשב.

**מה מריצים**, מתוך תיקיית המאגר:

<table dir="rtl">
<thead>
<tr dir="rtl"><th dir="rtl" align="right">&rlm;מערכת הפעלה</th><th dir="rtl" align="right">&rlm;פקודה</th></tr>
</thead>
<tbody>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;Windows</td><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>start.cmd</code></span> (בלחיצה כפולה, או מחלון פקודה)</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;Linux, macOS, WSL</td><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>scripts/start.sh</code></span></td></tr>
</tbody>
</table>

**מה הסקריפט עושה**, לפי הסדר:

1. בודק ש־Docker פועל.
2. יוצר את קובץ ההגדרות &lrm;`.env` עם שלוש סיסמאות אקראיות. קובץ שכבר קיים אינו משתנה.
3. בונה ומפעיל את המכולות: SQL Server, מנוע הבקרות, וה־API יחד עם הלקוח.
4. מקים את בסיס הנתונים: מריץ את הסקריפטים שבתיקייה `sql/`&lrm; לפי הסדר, כולל נתוני הדוגמה.
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

<table dir="rtl">
<thead>
<tr dir="rtl"><th dir="rtl" align="right">&rlm;פקודה</th><th dir="rtl" align="right">&rlm;מה היא עושה</th></tr>
</thead>
<tbody>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>docker compose stop</code></span></td><td dir="rtl" align="right">&rlm;עוצרת את המכולות. הפקודה <span dir="ltr"><code>docker compose start</code></span> מפעילה אותן שוב</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>docker compose down</code></span></td><td dir="rtl" align="right">&rlm;מסירה את המכולות ושומרת את הנתונים</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>docker compose down -v</code></span></td><td dir="rtl" align="right">&rlm;מוחקת גם את הנתונים. ההרצה הבאה מקימה את בסיס הנתונים מחדש</td></tr>
</tbody>
</table>

**פורטים:** המערכת מאזינה במחשב המקומי בלבד (127.0.0.1). את הפורטים משנים בקובץ &lrm;`.env`, ואז מריצים שוב את סקריפט ההפעלה.

<table dir="rtl">
<thead>
<tr dir="rtl"><th dir="rtl" align="right">&rlm;משתנה</th><th dir="rtl" align="right">&rlm;ברירת מחדל</th><th dir="rtl" align="right">&rlm;מה מאזין שם</th></tr>
</thead>
<tbody>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<code>APP_PORT</code></td><td dir="rtl" align="right">&rlm;5000</td><td dir="rtl" align="right">&rlm;המערכת וה־API שלה</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<code>DB_PORT</code></td><td dir="rtl" align="right">&rlm;14330</td><td dir="rtl" align="right">&rlm;SQL Server, לחיבור מ־SSMS (שם השרת: <span dir="ltr"><code>127.0.0.1,14330</code></span>). לא 1433, כדי לא להתנגש ב־SQL Server שמותקן במחשב</td></tr>
</tbody>
</table>

**אם המערכת אינה עולה:**

- **פורט תפוס:** קובעים פורט פנוי ב־`APP_PORT` או ב־`DB_PORT` בקובץ &lrm;`.env`, ומריצים שוב.
- &rlm;**Docker אינו עונה:** מפעילים את Docker Desktop, ממתינים עד שהוא מודיע שהוא פועל, ומריצים שוב.
- **כל תקלה אחרת:** הסקריפט מדפיס את מצב המכולות ואת שורות הלוג האחרונות של המכולה שלא עלתה. את השאר מציגה הפקודה <span dir="ltr">`docker compose logs engine`</span>. במקום `engine` אפשר לכתוב גם `api`, וכן `db` או `db-init`.

## ב. התקנה בלי Docker

למחשב שיש בו SQL Server משלו.

**מה נדרש:**

- &rlm;SQL Server 2019 או 2022, שמאפשר הזדהות SQL (<span dir="ltr">"SQL Server and Windows Authentication mode"</span>). המערכת משתמשת בכוונה בשני משתמשי SQL: אחד יכול רק לקרוא את נתוני הארגון, והשני יכול לכתוב רק למאגר הבקרות.
- &rlm;ODBC Driver 18 for SQL Server (גם 17 מתאים)
- &rlm;Python 3.12 ומעלה
- &rlm;&lrm;.NET 10 SDK
- &rlm;Node 22.12 ומעלה

הפקודות כתובות ל־bash (Linux, macOS, WSL, Git Bash). במקום שבו PowerShell שונה, הצורה שלו מופיעה אחריהן.

### שלב 1: הגדרות

מעתיקים את קובץ הדוגמה:

</div>

```sh
cp .env.example .env
```

<div dir="rtl">

בקובץ &lrm;`.env` קובעים שלוש סיסמאות:

- &rlm;`DQ_APP_PASSWORD` ו־`DQ_ENGINE_RO_PASSWORD`: סיסמאות חדשות לבחירתכם, לשני המשתמשים ששלב 2 יוצר. לפחות 8 תווים, עם אות גדולה, אות קטנה וספרה, ובלי רווחים, מירכאות, `$`, `;` או לוכסן הפוך.
- &rlm;`MSSQL_SA_PASSWORD`: הסיסמה הקיימת של המשתמש `sa` בשרת שלכם. שלב 2 מתחבר איתה. אם `sa` מושבת, מריצים את הסקריפטים ב־SSMS עם משתמש מנהל של Windows, כמתואר בפרק ג.

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

המנוע קורא את הקובץ &lrm;`.env` בעצמו, בודק את מילון המונחים מול בסיס הנתונים, ומתחיל להאזין. משאירים אותו פועל.

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

מפעילים את ה־API. במקום הטקסט שבסוגריים המשולשים כותבים את הסיסמה של `dq_app` מהקובץ &lrm;`.env`:

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

הסקריפטים נמצאים בתיקייה [`sql/`&lrm;](../sql), והם רצים לפי סדר השמות. אפשר להריץ כל סקריפט שוב: הרצה חוזרת אינה משנה דבר.

<table dir="rtl">
<thead>
<tr dir="rtl"><th dir="rtl" align="right">&rlm;סקריפט</th><th dir="rtl" align="right">&rlm;מה הוא יוצר</th></tr>
</thead>
<tbody>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>00_database.sql</code></span></td><td dir="rtl" align="right">&rlm;בסיס הנתונים <code>DataControls</code>, עם collation עברי (<code>Hebrew_CI_AS</code>)</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>10_schemas.sql</code></span></td><td dir="rtl" align="right">&rlm;שתי סכמות: <code>hr</code> לנתוני הארגון, ו־<code>dq</code> למאגר הבקרות</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>20_hr_tables.sql</code></span></td><td dir="rtl" align="right">&rlm;טבלאות נתוני הארגון: משרדים, מחלקות ועובדים</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>30_dq_tables.sql</code></span></td><td dir="rtl" align="right">&rlm;טבלאות מאגר הבקרות: בקרות, גרסאות, הרצות ותוצאות</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>40_logins.sql</code></span></td><td dir="rtl" align="right">&rlm;שני המשתמשים וההרשאות שלהם</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>50_indexes.sql</code></span></td><td dir="rtl" align="right">&rlm;אינדקסים</td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<span dir="ltr"><code>60_seed_hr.sql</code></span></td><td dir="rtl" align="right">&rlm;נתוני הדוגמה: 5 משרדים, 16 מחלקות ו־85 עובדים. כולם בדויים, ובהם רשומות שגויות שנשתלו בכוונה, כדי שלכל בקרה לדוגמה יהיה מה למצוא</td></tr>
</tbody>
</table>

**שני המשתמשים:**

<table dir="rtl">
<thead>
<tr dir="rtl"><th dir="rtl" align="right">&rlm;משתמש</th><th dir="rtl" align="right">&rlm;מי משתמש בו</th><th dir="rtl" align="right">&rlm;מה מותר לו</th><th dir="rtl" align="right">&rlm;מה אסור לו</th></tr>
</thead>
<tbody>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<code>dq_app</code></td><td dir="rtl" align="right">&rlm;ה־API</td><td dir="rtl" align="right">&rlm;לקרוא ולכתוב בסכמה <code>dq</code></td><td dir="rtl" align="right">&rlm;כל גישה לסכמה <code>hr</code></td></tr>
<tr dir="rtl"><td dir="rtl" align="right">&rlm;<code>dq_engine_ro</code></td><td dir="rtl" align="right">&rlm;המנוע</td><td dir="rtl" align="right">&rlm;לקרוא מהסכמה <code>hr</code></td><td dir="rtl" align="right">&rlm;לכתוב לסכמה <code>hr</code>, וכל גישה לסכמה <code>dq</code></td></tr>
</tbody>
</table>

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
