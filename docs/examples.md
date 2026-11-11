# Example controls

Six controls that can be defined and run in the system: the four the assignment names, and two more that show
what its examples do not (a rule about related records, and a rule that crosses two relationships). Each lives
in [`contracts/examples/`](../contracts/examples) as a file with the control's Hebrew name and description, its
definition, the run date, and the records it must flag in the sample data with the condition ids that match
per record. The first start loads the six into the list, ready to run and never run.

| # | Example | Shows |
|---|---|---|
| 1 | `minor-high-salary` | two conditions joined by "and"; a computed field (`age`, on the run date) |
| 2 | `termination-before-hire` | a comparison of two fields of the same record |
| 3 | `active-in-inactive-department` | a field of a related entity, reached through a relationship |
| 4 | `missing-mandatory-data` | nested groups ("and" inside "or"), and the operators that find missing data |
| 5 | `department-without-active-employees` | another root entity, and a "there is no related record with" node |
| 6 | `inactive-ministry-salary-out-of-range` | a path of two relationships (employee, department, ministry) and a nested "or" |

How to read a section below:

- **The rule in words** is the sentence the engine renders from the definition and the glossary. The editor
  shows the same sentence while the rule is built.
- **The definition** is the JSON the client builds and the api stores. It names business terms by their
  glossary keys; no table or column appears in it.
- **The table** lists every record the control flags in the sample data. "Matched" holds the ids of the
  conditions that are the reason for that record: a condition counts only when it is true and every group above
  it is true ([contracts/errors.md, Matched](../contracts/errors.md#matched)). "Reason" is the text the results
  screen shows, rendered by the engine from the record's own values.
- The planted rows and the boundary rows around them (a minor who turns 18 on the run date, a salary of exactly
  15,000) are listed per example in [sql/README.md](../sql/README.md).

The examples run on the date their file names, 2026-11-01, so that the age rule gives the same records on any
day. In the interface a run uses today's date; the six give the same records from 2026-11-01 to 2027-12-31.

Everything between the two markers below is written by `python3 scripts/examples.py docs` from real runs through
the api: the Hebrew sentences and reasons are the engine's own output, copied and never rendered again.
`python3 scripts/examples.py docs --check` fails when this file no longer matches a fresh run, and
`python3 scripts/examples.py verify` compares each run with the example's expected records.

<!-- generated:start (scripts/examples.py docs) -->

### 1. <span dir="rtl">קטינים בשכר גבוה</span>

`contracts/examples/minor-high-salary.json`

<p dir="rtl">איתור עובדים שגילם נמוך מ־18 ושכרם גבוה מ־15,000 ש"ח.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>גיל מתחת ל־18 וגם שכר מעל 15,000 ₪</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "id": "c1",
        "left": {
          "field": "age"
        },
        "operator": "lt",
        "value": 18
      },
      {
        "type": "condition",
        "id": "c2",
        "left": {
          "field": "salary"
        },
        "operator": "gt",
        "value": 15000
      }
    ]
  }
}
```

Run date 2026-11-01: **3** records of `employee` are flagged in the sample data. On 2026-10-31: 4.

| <span dir="rtl">שם פרטי</span> | <span dir="rtl">שם משפחה</span> | <span dir="rtl">מספר עובד</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|---|
| <span dir="rtl">אריאל</span> | <span dir="rtl">מור</span> | 1051 | `c1`, `c2` | <span dir="rtl">גיל: 16 (מתחת ל־18); שכר: 16,500 ₪ (מעל 15,000 ₪)</span> |
| <span dir="rtl">רותם</span> | <span dir="rtl">יוסף</span> | 1052 | `c1`, `c2` | <span dir="rtl">גיל: 15 (מתחת ל־18); שכר: 22,000 ₪ (מעל 15,000 ₪)</span> |
| <span dir="rtl">גל</span> | <span dir="rtl">עמר</span> | 1053 | `c1`, `c2` | <span dir="rtl">גיל: 16 (מתחת ל־18); שכר: 15,000.01 ₪ (מעל 15,000 ₪)</span> |


### 2. <span dir="rtl">סיום העסקה לפני תחילתה</span>

`contracts/examples/termination-before-hire.json` · also proposed by the suggestions

<p dir="rtl">איתור עובדים שתאריך סיום העסקתם מוקדם מתאריך תחילת העסקתם.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>תאריך סיום העסקה לפני תאריך תחילת העסקה</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "id": "c1",
        "left": {
          "field": "termination_date"
        },
        "operator": "lt",
        "right": {
          "field": "hire_date"
        }
      }
    ]
  }
}
```

Run date 2026-11-01: **3** records of `employee` are flagged in the sample data.

| <span dir="rtl">שם פרטי</span> | <span dir="rtl">שם משפחה</span> | <span dir="rtl">מספר עובד</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|---|
| <span dir="rtl">אסף</span> | <span dir="rtl">גרינברג</span> | 1061 | `c1` | <span dir="rtl">תאריך סיום העסקה: 01.06.2012 (לפני תאריך תחילת העסקה: 01.06.2015)</span> |
| <span dir="rtl">סיגל</span> | <span dir="rtl">חזן</span> | 1062 | `c1` | <span dir="rtl">תאריך סיום העסקה: 14.03.2020 (לפני תאריך תחילת העסקה: 15.03.2020)</span> |
| <span dir="rtl">אסתר</span> | <span dir="rtl">וקנין</span> | 1063 | `c1` | <span dir="rtl">תאריך סיום העסקה: 11.10.2019 (לפני תאריך תחילת העסקה: 10.11.2019)</span> |


### 3. <span dir="rtl">עובדים פעילים במחלקה לא פעילה</span>

`contracts/examples/active-in-inactive-department.json` · also proposed by the suggestions

<p dir="rtl">איתור עובדים פעילים המשויכים למחלקה שאינה פעילה.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>סטטוס: פעיל וגם סטטוס של המחלקה: לא פעיל</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "id": "c1",
        "left": {
          "field": "status"
        },
        "operator": "eq",
        "value": "active"
      },
      {
        "type": "condition",
        "id": "c2",
        "left": {
          "path": [
            "employee.department"
          ],
          "field": "is_active"
        },
        "operator": "eq",
        "value": false
      }
    ]
  }
}
```

Run date 2026-11-01: **6** records of `employee` are flagged in the sample data.

| <span dir="rtl">שם פרטי</span> | <span dir="rtl">שם משפחה</span> | <span dir="rtl">מספר עובד</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|---|
| <span dir="rtl">רנא</span> | <span dir="rtl">חורי</span> | 1071 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |
| <span dir="rtl">אלעד</span> | <span dir="rtl">ממן</span> | 1072 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |
| <span dir="rtl">מוחמד</span> | <span dir="rtl">אגבאריה</span> | 1076 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |
| <span dir="rtl">ליאור</span> | <span dir="rtl">בן שושן</span> | 1077 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |
| <span dir="rtl">עומרי</span> | <span dir="rtl">דאהר</span> | 1117 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |
| <span dir="rtl">הדס</span> | <span dir="rtl">עטיה</span> | 1118 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; סטטוס של המחלקה: לא פעיל</span> |


### 4. <span dir="rtl">נתוני חובה חסרים</span>

`contracts/examples/missing-mandatory-data.json` · also proposed by the suggestions

<p dir="rtl">איתור רשומות שבהן חסרים נתונים המחויבים לפי כללים עסקיים. עובד פעיל חייב בדואר אלקטרוני, בשכר ובשיוך למחלקה; עובד לא פעיל חייב בתאריך סיום העסקה.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>(סטטוס: פעיל וגם (דואר אלקטרוני: ריק או שכר: חסר או שיוך למחלקה: חסר)) או (סטטוס: לא פעיל וגם תאריך סיום העסקה: חסר)</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": {
    "type": "group",
    "op": "or",
    "children": [
      {
        "type": "group",
        "op": "and",
        "children": [
          {
            "type": "condition",
            "id": "c1",
            "left": {
              "field": "status"
            },
            "operator": "eq",
            "value": "active"
          },
          {
            "type": "group",
            "op": "or",
            "children": [
              {
                "type": "condition",
                "id": "c2",
                "left": {
                  "field": "email"
                },
                "operator": "is_empty"
              },
              {
                "type": "condition",
                "id": "c3",
                "left": {
                  "field": "salary"
                },
                "operator": "is_null"
              },
              {
                "type": "condition",
                "id": "c4",
                "left": {
                  "field": "department_assignment"
                },
                "operator": "is_null"
              }
            ]
          }
        ]
      },
      {
        "type": "group",
        "op": "and",
        "children": [
          {
            "type": "condition",
            "id": "c5",
            "left": {
              "field": "status"
            },
            "operator": "eq",
            "value": "inactive"
          },
          {
            "type": "condition",
            "id": "c6",
            "left": {
              "field": "termination_date"
            },
            "operator": "is_null"
          }
        ]
      }
    ]
  }
}
```

Run date 2026-11-01: **10** records of `employee` are flagged in the sample data.

| <span dir="rtl">שם פרטי</span> | <span dir="rtl">שם משפחה</span> | <span dir="rtl">מספר עובד</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|---|
| <span dir="rtl">לאה</span> | <span dir="rtl">בן דוד</span> | 1058 | `c1`, `c3` | <span dir="rtl">סטטוס: פעיל; שכר: חסר</span> |
| <span dir="rtl">יובל</span> | <span dir="rtl">שמש</span> | 1081 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; דואר אלקטרוני: ריק</span> |
| <span dir="rtl">מורן</span> | <span dir="rtl">אלבז</span> | 1082 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; דואר אלקטרוני: ריק</span> |
| <span dir="rtl">אופיר</span> | <span dir="rtl">דיין</span> | 1083 | `c1`, `c2` | <span dir="rtl">סטטוס: פעיל; דואר אלקטרוני: ריק</span> |
| <span dir="rtl">שני</span> | <span dir="rtl">וולך</span> | 1084 | `c1`, `c3` | <span dir="rtl">סטטוס: פעיל; שכר: חסר</span> |
| <span dir="rtl">ברק</span> | <span dir="rtl">יעקב</span> | 1085 | `c1`, `c4` | <span dir="rtl">סטטוס: פעיל; שיוך למחלקה: חסר</span> |
| <span dir="rtl">אחינועם</span> | <span dir="rtl">לביא</span> | 1086 | `c1`, `c2`, `c3` | <span dir="rtl">סטטוס: פעיל; דואר אלקטרוני: ריק; שכר: חסר</span> |
| <span dir="rtl">צחי</span> | <span dir="rtl">אפריים</span> | 1087 | `c5`, `c6` | <span dir="rtl">סטטוס: לא פעיל; תאריך סיום העסקה: חסר</span> |
| <span dir="rtl">רבקה</span> | <span dir="rtl">מימון</span> | 1088 | `c5`, `c6` | <span dir="rtl">סטטוס: לא פעיל; תאריך סיום העסקה: חסר</span> |
| <span dir="rtl">אביב</span> | <span dir="rtl">קדוש</span> | 1115 | `c1`, `c3` | <span dir="rtl">סטטוס: פעיל; שכר: חסר</span> |


### 5. <span dir="rtl">מחלקות פעילות ללא עובדים פעילים</span>

`contracts/examples/department-without-active-employees.json` · also proposed by the suggestions

<p dir="rtl">איתור מחלקות פעילות שאין בהן אף עובד פעיל.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>סטטוס: פעיל וגם אין עובד במחלקה עם (סטטוס: פעיל)</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "department",
  "where": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "id": "c1",
        "left": {
          "field": "is_active"
        },
        "operator": "eq",
        "value": true
      },
      {
        "type": "related",
        "id": "r1",
        "relationship": "department.employees",
        "quantifier": "none",
        "where": {
          "type": "group",
          "op": "and",
          "children": [
            {
              "type": "condition",
              "id": "c2",
              "left": {
                "field": "status"
              },
              "operator": "eq",
              "value": "active"
            }
          ]
        }
      }
    ]
  }
}
```

Run date 2026-11-01: **3** records of `department` are flagged in the sample data.

| <span dir="rtl">שם</span> | <span dir="rtl">מספר מחלקה</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|
| <span dir="rtl">מחלקת ארכיון רפואי</span> | 104 | `c1`, `r1` | <span dir="rtl">סטטוס: פעיל; אין עובד במחלקה עם סטטוס: פעיל</span> |
| <span dir="rtl">יחידת חינוך דיגיטלי</span> | 204 | `c1`, `r1` | <span dir="rtl">סטטוס: פעיל; אין עובד במחלקה עם סטטוס: פעיל</span> |
| <span dir="rtl">יחידת התחבורה הציבורית</span> | 403 | `c1`, `r1` | <span dir="rtl">סטטוס: פעיל; אין עובד במחלקה עם סטטוס: פעיל</span> |


### 6. <span dir="rtl">חריגות שכר במשרד לא פעיל</span>

`contracts/examples/inactive-ministry-salary-out-of-range.json`

<p dir="rtl">איתור עובדים פעילים במשרד שאינו פעיל ששכרם נמוך מ־6,000 ש"ח או גבוה מ־40,000 ש"ח.</p>

The rule in words, as the engine renders it:

<p dir="rtl"><strong>סטטוס: פעיל וגם סטטוס של המשרד: לא פעיל וגם (שכר מתחת ל־6,000 ₪ או שכר מעל 40,000 ₪)</strong></p>

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "id": "c1",
        "left": {
          "field": "status"
        },
        "operator": "eq",
        "value": "active"
      },
      {
        "type": "condition",
        "id": "c2",
        "left": {
          "path": [
            "employee.department",
            "department.ministry"
          ],
          "field": "is_active"
        },
        "operator": "eq",
        "value": false
      },
      {
        "type": "group",
        "op": "or",
        "children": [
          {
            "type": "condition",
            "id": "c3",
            "left": {
              "field": "salary"
            },
            "operator": "lt",
            "value": 6000
          },
          {
            "type": "condition",
            "id": "c4",
            "left": {
              "field": "salary"
            },
            "operator": "gt",
            "value": 40000
          }
        ]
      }
    ]
  }
}
```

Run date 2026-11-01: **3** records of `employee` are flagged in the sample data.

| <span dir="rtl">שם פרטי</span> | <span dir="rtl">שם משפחה</span> | <span dir="rtl">מספר עובד</span> | Matched | Reason, as the engine renders it |
|---|---|---|---|---|
| <span dir="rtl">עוז</span> | <span dir="rtl">ירושלמי</span> | 1111 | `c1`, `c2`, `c3` | <span dir="rtl">סטטוס: פעיל; סטטוס של המשרד: לא פעיל; שכר: 4,500 ₪ (מתחת ל־6,000 ₪)</span> |
| <span dir="rtl">בתיה</span> | <span dir="rtl">שוורץ</span> | 1112 | `c1`, `c2`, `c4` | <span dir="rtl">סטטוס: פעיל; סטטוס של המשרד: לא פעיל; שכר: 52,000 ₪ (מעל 40,000 ₪)</span> |
| <span dir="rtl">עומרי</span> | <span dir="rtl">דאהר</span> | 1117 | `c1`, `c2`, `c3` | <span dir="rtl">סטטוס: פעיל; סטטוס של המשרד: לא פעיל; שכר: 3,000 ₪ (מתחת ל־6,000 ₪)</span> |

<!-- generated:end -->
