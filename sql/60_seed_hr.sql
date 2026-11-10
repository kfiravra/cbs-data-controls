-- 60_seed_hr.sql
-- The sample organization: 5 ministries, 16 departments and 85 employees, all invented.
--
-- Every row that an example control must flag has a comment "-- PLANTED <example-id>: ..." above
-- it, ending with the condition ids that match; every near miss has "-- BOUNDARY <example-id>: ...".
-- The example ids are the file names of contracts/examples/. scripts/db-check.sh compares the
-- records each example expects with a hand-written query per example (sql/checks/).
--
-- Dates are absolute. The examples run with the run date 2026-11-01 and flag the same records on
-- every run date up to 2027-12-31 (sql/README.md explains the window).
-- National ids fail the control-digit check on purpose, so none can belong to a real person.
-- The inserts are keyed: a second run inserts nothing. A changed row needs scripts/db-init.sh --reset.

USE DataControls;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO hr.Ministry (id, name, is_active)
SELECT v.id, v.name, v.is_active
FROM (VALUES
    (1, N'משרד הבריאות', 1),
    (2, N'משרד החינוך', 1),
    (3, N'משרד האוצר', 1),
    (4, N'משרד התחבורה והבטיחות בדרכים', 1),
    -- BOUNDARY inactive-ministry-salary-out-of-range: the only inactive ministry; c2 is true only under it
    (5, N'משרד הפיתוח', 0)
) AS v (id, name, is_active)
WHERE NOT EXISTS (SELECT 1 FROM hr.Ministry AS m WHERE m.id = v.id);

-- Managers are set after the employees exist: the two tables reference each other.
INSERT INTO hr.Department (id, ministry_id, name, is_active)
SELECT v.id, v.ministry_id, v.name, v.is_active
FROM (VALUES
    (101, 1, N'אגף בריאות הציבור', 1),
    (102, 1, N'אגף משאבי אנוש', 1),
    -- BOUNDARY department-without-active-employees: inactive, so c1 fails although it has employees
    -- (its two active employees are planted for active-in-inactive-department)
    (103, 1, N'מחלקת רישוי מוסדות', 0),
    -- PLANTED department-without-active-employees: active, both employees inactive [c1, r1]
    (104, 1, N'מחלקת ארכיון רפואי', 1),
    (201, 2, N'אגף כוח אדם בהוראה', 1),
    (202, 2, N'מינהל פדגוגי', 1),
    -- BOUNDARY department-without-active-employees: no active employee, but the department is inactive (c1 fails)
    (203, 2, N'מחלקת ספרי לימוד', 0),
    -- PLANTED department-without-active-employees: active, no employees at all [c1, r1]
    (204, 2, N'יחידת חינוך דיגיטלי', 1),
    (301, 3, N'אגף התקציבים', 1),
    (302, 3, N'אגף החשב הכללי', 1),
    -- BOUNDARY department-without-active-employees: one active employee (1103) is enough, r1 fails
    (303, 3, N'יחידת הביקורת הפנימית', 1),
    (401, 4, N'אגף הרישוי', 1),
    (402, 4, N'מחלקת תשתיות', 0),
    -- PLANTED department-without-active-employees: active, both employees inactive [c1, r1]
    (403, 4, N'יחידת התחבורה הציבורית', 1),
    (501, 5, N'אגף תכנון ופיתוח', 1),
    (502, 5, N'מחלקת פרויקטים אזוריים', 0)
) AS v (id, ministry_id, name, is_active)
WHERE NOT EXISTS (SELECT 1 FROM hr.Department AS d WHERE d.id = v.id);

INSERT INTO hr.Employee
    (id, department_id, national_id, first_name, last_name, email,
     birth_date, hire_date, termination_date, salary, status)
SELECT v.id, v.department_id, v.national_id, v.first_name, v.last_name, v.email,
       v.birth_date, v.hire_date, v.termination_date, v.salary, v.status
FROM (VALUES
    -- Baseline: adults in active departments of active ministries, complete data. No example flags them.
    (1001, 101, N'379269197', N'דוד', N'כהן', N'david.cohen@example.org', '1968-03-12', '1995-09-01', NULL, 31500.00, N'active'),
    (1002, 101, N'379348389', N'שרה', N'לוי', N'sara.levi@example.org', '1975-07-24', '2001-02-15', NULL, 24800.00, N'active'),
    (1003, 101, N'379427571', N'יוסף', N'מזרחי', N'yosef.mizrahi@example.org', '1982-11-05', '2008-06-01', NULL, 18200.00, N'active'),
    (1004, 101, N'379506762', N'נועה', N'פרץ', N'noa.peretz@example.org', '1990-01-19', '2015-10-11', NULL, 14500.00, N'active'),
    (1005, 101, N'379585956', N'אחמד', N'עבאס', N'ahmad.abbas@example.org', '1987-05-30', '2012-03-04', NULL, 16900.00, N'active'),
    (1006, 101, N'379665147', N'רחל', N'ביטון', N'rachel.biton@example.org', '1963-09-08', '1990-01-02', '2024-06-30', 27300.00, N'inactive'),
    (1007, 102, N'379744330', N'משה', N'דהן', N'moshe.dahan@example.org', '1971-12-14', '1999-04-18', NULL, 29100.00, N'active'),
    (1008, 102, N'379823522', N'מיכל', N'פרידמן', N'michal.friedman@example.org', '1985-02-27', '2010-08-22', NULL, 17600.00, N'active'),
    (1009, 102, N'379902714', N'אברהם', N'אזולאי', N'avraham.azulay@example.org', '1961-06-03', '1988-11-13', '2026-03-31', 38000.00, N'inactive'),
    (1010, 102, N'379981908', N'תמר', N'כץ', N'tamar.katz@example.org', '1994-08-16', '2019-01-06', NULL, 12300.00, N'active'),
    (1011, 102, N'380061096', N'דניאל', N'אוחיון', N'daniel.ohayon@example.org', '1979-04-09', '2005-05-08', NULL, 21400.00, N'active'),
    (1012, 102, N'380140288', N'פאטמה', N'נאסר', N'fatma.nasser@example.org', '1992-10-21', '2017-09-03', NULL, 13800.00, N'active'),
    (1013, 201, N'380219470', N'יעקב', N'גבאי', N'yaakov.gabay@example.org', '1966-01-28', '1993-03-07', NULL, 33700.00, N'active'),
    (1014, 201, N'380298664', N'יעל', N'שפירא', N'yael.shapira@example.org', '1988-06-17', '2013-12-01', NULL, 16100.00, N'active'),
    (1015, 201, N'380377856', N'איתי', N'רוזנברג', N'itay.rosenberg@example.org', '1997-03-03', '2022-02-13', NULL, 9800.00, N'active'),
    (1016, 201, N'380457047', N'מרים', N'חדד', N'miriam.hadad@example.org', '1973-09-22', '2000-07-16', '2025-12-31', 25600.00, N'inactive'),
    (1017, 201, N'380536238', N'נועם', N'גולדברג', N'noam.goldberg@example.org', '2001-05-11', '2023-08-20', NULL, 8200.00, N'active'),
    (1018, 201, N'380615420', N'שירה', N'מלכה', N'shira.malka@example.org', '1984-12-02', '2009-10-18', NULL, 19500.00, N'active'),
    (1019, 202, N'380694615', N'עומר', N'שטרן', N'omer.stern@example.org', '1991-07-07', '2016-04-03', NULL, 15200.00, N'active'),
    (1020, 202, N'380773807', N'מאיה', N'וייס', N'maya.weiss@example.org', '1999-02-14', '2023-01-08', NULL, 8900.00, N'active'),
    (1021, 202, N'380852999', N'אורי', N'סויסה', N'uri.suissa@example.org', '1977-10-29', '2003-06-15', NULL, 23900.00, N'active'),
    (1022, 202, N'380932189', N'רונית', N'קליין', N'ronit.klein@example.org', '1965-04-18', '1992-09-06', '2023-08-31', 28800.00, N'inactive'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: active below 6,000, but the ministry is active (c2 fails)
    (1023, 202, N'381011371', N'יונתן', N'ברק', N'yonatan.barak@example.org', '1986-08-25', '2011-11-27', NULL, 5500.00, N'active'),
    (1024, 202, N'381090565', N'אורית', N'שלום', N'orit.shalom@example.org', '1980-03-06', '2006-02-05', NULL, 20700.00, N'active'),
    (1025, 301, N'381169757', N'עידו', N'אדלר', N'ido.adler@example.org', '1983-01-15', '2008-03-09', NULL, 26400.00, N'active'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: active above 40,000, but the ministry is active (c2 fails)
    (1026, 301, N'381248940', N'ענת', N'נחום', N'anat.nahum@example.org', '1970-11-11', '1997-07-20', NULL, 45000.00, N'active'),
    (1027, 301, N'381328130', N'גיא', N'זכאי', N'guy.zakay@example.org', '1995-06-26', '2020-10-04', NULL, 11700.00, N'active'),
    (1028, 301, N'381407322', N'הילה', N'סעדה', N'hila.saada@example.org', '1989-09-13', '2014-05-11', NULL, 15900.00, N'active'),
    (1029, 301, N'381486516', N'רון', N'אשכנזי', N'ron.ashkenazi@example.org', '1962-02-20', '1989-06-04', '2022-02-28', 36200.00, N'inactive'),
    (1030, 301, N'381565707', N'סאמר', N'זועבי', N'samer.zoabi@example.org', '1993-12-08', '2018-07-01', NULL, 13100.00, N'active'),
    (1031, 302, N'381644890', N'אלון', N'בן חיים', N'alon.ben-haim@example.org', '1976-05-23', '2002-10-13', NULL, 24100.00, N'active'),
    (1032, 302, N'381724080', N'ליאת', N'אלמוג', N'liat.almog@example.org', '1998-10-10', '2022-11-06', NULL, 9400.00, N'active'),
    (1033, 302, N'381803272', N'תומר', N'רביבו', N'tomer.revivo@example.org', '1981-07-31', '2007-01-14', '2025-05-15', 21900.00, N'inactive'),
    (1034, 302, N'381882466', N'דנה', N'ששון', N'dana.sasson@example.org', '2004-04-04', '2024-09-01', NULL, 6500.00, N'active'),
    (1035, 302, N'381961658', N'ניר', N'נגר', N'nir.nagar@example.org', '1969-08-19', '1996-12-08', NULL, 32600.00, N'active'),
    (1036, 401, N'382040841', N'עדי', N'הראל', N'adi.harel@example.org', '1996-01-22', '2021-03-14', NULL, 10600.00, N'active'),
    (1037, 401, N'382120031', N'אמיר', N'גרוס', N'amir.gross@example.org', '1974-06-12', '2001-09-09', NULL, 27700.00, N'active'),
    (1038, 401, N'382199225', N'טל', N'לנדאו', N'tal.landau@example.org', '1990-11-27', '2016-06-19', '2024-11-30', 14900.00, N'inactive'),
    (1039, 401, N'382278417', N'לילה', N'מסארוה', N'layla.masarwa@example.org', '1985-03-17', '2010-04-25', NULL, 18800.00, N'active'),
    (1040, 401, N'382357609', N'איתן', N'סגל', N'eitan.segal@example.org', '1967-12-30', '1994-05-01', '2021-09-30', 34300.00, N'inactive'),

    -- minor-high-salary: under 18 on the run date AND salary above 15,000.
    -- PLANTED minor-high-salary: 16 on the run date, salary 16,500 [c1, c2]
    (1051, 101, N'383228692', N'אריאל', N'מור', N'ariel.mor@example.org', '2010-04-18', '2026-07-01', NULL, 16500.00, N'active'),
    -- PLANTED minor-high-salary: 15 on the run date, salary 22,000 [c1, c2]
    (1052, 201, N'383307884', N'רותם', N'יוסף', N'rotem.yosef@example.org', '2011-09-02', '2026-08-16', NULL, 22000.00, N'active'),
    -- PLANTED minor-high-salary: the oldest planted minor (18 on 2028-01-01), one agora above the threshold [c1, c2]
    (1053, 301, N'383387076', N'גל', N'עמר', N'gal.amar@example.org', '2010-01-01', '2026-06-01', NULL, 15000.01, N'active'),
    -- BOUNDARY minor-high-salary: turns 18 on the run date 2026-11-01, must not be flagged;
    -- flagged by the alternate run of 2026-10-31, when still 17 [c1, c2]
    (1054, 102, N'383466268', N'אביגיל', N'טל', N'avigail.tal@example.org', '2008-11-01', '2026-02-01', NULL, 18000.00, N'active'),
    -- BOUNDARY minor-high-salary: turned 18 one day before the run date, 18 on the alternate run date too
    (1055, 202, N'383545459', N'שי', N'אלון', N'shay.alon@example.org', '2008-10-31', '2026-03-01', NULL, 18000.00, N'active'),
    -- BOUNDARY minor-high-salary: a minor at exactly 15,000 (greater-than is strict)
    (1056, 302, N'383624643', N'קרן', N'חביב', N'keren.habib@example.org', '2010-06-15', '2026-07-15', NULL, 15000.00, N'active'),
    -- BOUNDARY minor-high-salary: a minor under the salary threshold
    (1057, 401, N'383703835', N'דור', N'סלאמה', N'dor.salama@example.org', '2011-02-20', '2026-09-01', NULL, 9000.00, N'active'),
    -- BOUNDARY minor-high-salary: a minor with no salary (a comparison with NULL never matches)
    -- PLANTED missing-mandatory-data: active with no salary [c1, c3]
    (1058, 101, N'383783027', N'לאה', N'בן דוד', N'lea.ben-david@example.org', '2010-12-05', '2026-08-02', NULL, NULL, N'active'),

    -- termination-before-hire: termination date earlier than the hire date.
    -- PLANTED termination-before-hire: terminated three years before the hire date [c1]
    (1061, 101, N'384020593', N'אסף', N'גרינברג', N'asaf.greenberg@example.org', '1978-02-10', '2015-06-01', '2012-06-01', 19800.00, N'inactive'),
    -- PLANTED termination-before-hire: terminated one day before the hire date [c1]
    (1062, 201, N'384099787', N'סיגל', N'חזן', N'sigal.hazan@example.org', '1983-08-05', '2020-03-15', '2020-03-14', 17300.00, N'inactive'),
    -- PLANTED termination-before-hire: day and month swapped (hired 10 November, terminated 11 October) [c1]
    (1063, 301, N'384178979', N'אסתר', N'וקנין', N'ester.vaknin@example.org', '1969-11-23', '2019-11-10', '2019-10-11', 30200.00, N'inactive'),
    -- BOUNDARY termination-before-hire: terminated on the hire date (earlier-than is strict)
    (1064, 102, N'384258169', N'חנה', N'בוזגלו', N'hana.buzaglo@example.org', '1990-05-14', '2021-09-01', '2021-09-01', 12900.00, N'inactive'),
    -- BOUNDARY termination-before-hire: terminated one day after the hire date
    (1065, 302, N'384337351', N'עמית', N'שרעבי', N'amit.sharabi@example.org', '1986-12-19', '2018-01-07', '2018-01-08', 15400.00, N'inactive'),

    -- active-in-inactive-department: the employees of the inactive departments 103, 203 and 402.
    -- PLANTED active-in-inactive-department: active in department 103, which is inactive [c1, c2]
    (1071, 103, N'384812494', N'רנא', N'חורי', N'rana.khoury@example.org', '1984-04-02', '2011-05-01', NULL, 17200.00, N'active'),
    -- PLANTED active-in-inactive-department: active in department 103, which is inactive [c1, c2]
    (1072, 103, N'384891688', N'אלעד', N'ממן', N'elad.maman@example.org', '1992-09-15', '2018-02-11', NULL, 13400.00, N'active'),
    -- BOUNDARY active-in-inactive-department: inactive employee in an inactive department (c1 fails)
    (1073, 103, N'384970870', N'גלית', N'אוחנה', N'galit.ohana@example.org', '1970-01-25', '1998-08-02', '2025-01-31', 26100.00, N'inactive'),
    -- BOUNDARY active-in-inactive-department: inactive employee in an inactive department (c1 fails)
    (1074, 203, N'385050060', N'צבי', N'הורוביץ', N'zvi.horowitz@example.org', '1975-06-08', '2003-03-02', '2024-12-31', 22500.00, N'inactive'),
    -- BOUNDARY active-in-inactive-department: inactive employee in an inactive department (c1 fails)
    (1075, 203, N'385129252', N'אילנה', N'טייב', N'ilana.tayeb@example.org', '1988-10-30', '2014-07-06', '2024-12-31', 15700.00, N'inactive'),
    -- PLANTED active-in-inactive-department: active in department 402, which is inactive [c1, c2]
    (1076, 402, N'385208445', N'מוחמד', N'אגבאריה', N'muhammad.agbaria@example.org', '1979-12-12', '2006-09-03', NULL, 20900.00, N'active'),
    -- PLANTED active-in-inactive-department: active in department 402, which is inactive [c1, c2]
    (1077, 402, N'385287639', N'ליאור', N'בן שושן', N'lior.ben-shushan@example.org', '1995-03-28', '2020-06-07', NULL, 11200.00, N'active'),
    -- BOUNDARY active-in-inactive-department: inactive employee in an inactive department (c1 fails)
    (1078, 402, N'385366821', N'דליה', N'רוזן', N'dalia.rosen@example.org', '1964-07-19', '1991-04-07', '2023-03-31', 31800.00, N'inactive'),

    -- missing-mandatory-data: active without email, salary or department; inactive without a termination date.
    -- PLANTED missing-mandatory-data: active with no email (NULL) [c1, c2]
    (1081, 102, N'385604395', N'יובל', N'שמש', NULL, '1987-01-09', '2012-10-14', NULL, 16300.00, N'active'),
    -- PLANTED missing-mandatory-data: active with an empty email [c1, c2]
    (1082, 202, N'385683589', N'מורן', N'אלבז', N'', '1993-05-21', '2018-11-04', NULL, 13600.00, N'active'),
    -- PLANTED missing-mandatory-data: active with an email of spaces only, which counts as empty [c1, c2]
    (1083, 301, N'385762771', N'אופיר', N'דיין', N'   ', '1981-09-27', '2007-08-12', NULL, 21200.00, N'active'),
    -- PLANTED missing-mandatory-data: active with no salary [c1, c3]
    (1084, 401, N'385841963', N'שני', N'וולך', N'shani.wallach@example.org', '1996-07-03', '2021-12-05', NULL, NULL, N'active'),
    -- PLANTED missing-mandatory-data: active with no department [c1, c4]
    -- BOUNDARY active-in-inactive-department, inactive-ministry-salary-out-of-range: no department, so the path yields NULL
    (1085, NULL, N'385921153', N'ברק', N'יעקב', N'barak.yaakov@example.org', '1978-10-16', '2004-01-11', NULL, 23300.00, N'active'),
    -- PLANTED missing-mandatory-data: active with no email and no salary [c1, c2, c3]
    (1086, 302, N'386000346', N'אחינועם', N'לביא', NULL, '1990-02-08', '2015-03-01', NULL, NULL, N'active'),
    -- PLANTED missing-mandatory-data: inactive with no termination date [c5, c6]
    (1087, 101, N'386079530', N'צחי', N'אפריים', N'tzachi.efraim@example.org', '1972-04-26', '1999-10-03', NULL, 25200.00, N'inactive'),
    -- PLANTED missing-mandatory-data: inactive with no termination date [c5, c6]; the empty email makes c2 true,
    -- but c2 sits under the active branch, which fails, so it is not a reason
    (1088, 201, N'386158722', N'רבקה', N'מימון', N'', '1985-11-18', '2010-12-12', NULL, 18100.00, N'inactive'),
    -- BOUNDARY missing-mandatory-data: inactive with an empty email and a termination date (email is required only while active)
    (1089, 102, N'386237914', N'אהרון', N'קורן', N'', '1976-08-13', '2002-05-05', '2025-07-31', 22800.00, N'inactive'),
    -- BOUNDARY missing-mandatory-data: inactive with no salary and a termination date (salary is required only while active)
    (1090, 301, N'386317104', N'זהבה', N'פולק', N'zehava.polak@example.org', '1968-06-29', '1995-02-12', '2024-04-30', NULL, N'inactive'),

    -- department-without-active-employees: the employees of departments 104, 303 and 403.
    (1101, 104, N'387188199', N'שמעון', N'בן עמי', N'shimon.ben-ami@example.org', '1967-03-04', '1994-06-05', '2025-09-30', 29600.00, N'inactive'),
    (1102, 104, N'387267381', N'אירית', N'גולן', N'irit.golan@example.org', '1982-12-22', '2009-02-01', '2025-09-30', 19200.00, N'inactive'),
    -- BOUNDARY department-without-active-employees: the one active employee that keeps department 303 out
    (1103, 303, N'387346573', N'נדב', N'שגיא', N'nadav.sagi@example.org', '1989-05-06', '2014-09-07', NULL, 16700.00, N'active'),
    (1104, 303, N'387425765', N'חיים', N'פישר', N'haim.fisher@example.org', '1973-02-11', '2000-11-05', '2026-01-31', 24400.00, N'inactive'),
    (1105, 403, N'387504957', N'עינב', N'צור', N'einav.tzur@example.org', '1980-08-01', '2006-04-02', '2024-08-31', 20300.00, N'inactive'),
    (1106, 403, N'387584140', N'אליאור', N'מנשה', N'elior.menashe@example.org', '1991-11-14', '2017-01-08', '2025-02-28', 14100.00, N'inactive'),

    -- inactive-ministry-salary-out-of-range: departments 501 and 502 of the inactive ministry 5.
    -- PLANTED inactive-ministry-salary-out-of-range: active, inactive ministry, below 6,000 [c1, c2, c3]
    (1111, 501, N'387980090', N'עוז', N'ירושלמי', N'oz.yerushalmi@example.org', '1994-04-12', '2019-08-04', NULL, 4500.00, N'active'),
    -- PLANTED inactive-ministry-salary-out-of-range: active, inactive ministry, above 40,000 [c1, c2, c4]
    (1112, 501, N'388059282', N'בתיה', N'שוורץ', N'batya.schwartz@example.org', '1966-10-07', '1993-01-03', NULL, 52000.00, N'active'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: exactly 6,000 (less-than is strict)
    (1113, 501, N'388138474', N'יאיר', N'נסים', N'yair.nissim@example.org', '1988-01-30', '2013-05-05', NULL, 6000.00, N'active'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: exactly 40,000 (greater-than is strict)
    (1114, 501, N'388217666', N'מלכה', N'אורן', N'malka.oren@example.org', '1971-07-15', '1998-03-01', NULL, 40000.00, N'active'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: no salary (a comparison with NULL never matches)
    -- PLANTED missing-mandatory-data: active with no salary [c1, c3]
    (1115, 501, N'388296850', N'אביב', N'קדוש', N'aviv.kadosh@example.org', '1983-06-19', '2009-09-06', NULL, NULL, N'active'),
    -- BOUNDARY inactive-ministry-salary-out-of-range: below 6,000 but inactive (c1 fails)
    (1116, 501, N'388376041', N'שושנה', N'ברגר', N'shoshana.berger@example.org', '1977-09-09', '2004-10-10', '2023-12-31', 3000.00, N'inactive'),
    -- PLANTED active-in-inactive-department: active in department 502, which is inactive [c1, c2]
    -- PLANTED inactive-ministry-salary-out-of-range: active, inactive ministry, below 6,000 [c1, c2, c3]
    (1117, 502, N'388455233', N'עומרי', N'דאהר', N'omri.daher@example.org', '1997-12-01', '2022-05-01', NULL, 3000.00, N'active'),
    -- PLANTED active-in-inactive-department: active in department 502, which is inactive [c1, c2]
    -- BOUNDARY inactive-ministry-salary-out-of-range: active, inactive ministry, salary within the range
    (1118, 502, N'388534425', N'הדס', N'עטיה', N'hadas.atia@example.org', '1985-08-08', '2011-02-06', NULL, 12000.00, N'active')
) AS v (id, department_id, national_id, first_name, last_name, email,
         birth_date, hire_date, termination_date, salary, status)
WHERE NOT EXISTS (SELECT 1 FROM hr.Employee AS e WHERE e.id = v.id);

-- Department 204 has no employees and stays without a manager.
UPDATE d
SET d.manager_employee_id = v.manager_employee_id
FROM hr.Department AS d
JOIN (VALUES
    (101, 1001),
    (102, 1007),
    (103, 1071),
    (104, 1101),
    (201, 1013),
    (202, 1021),
    (203, 1074),
    (301, 1026),
    (302, 1035),
    (303, 1103),
    (401, 1037),
    (402, 1076),
    (403, 1105),
    (501, 1112),
    (502, 1118)
) AS v (id, manager_employee_id) ON v.id = d.id
WHERE d.manager_employee_id IS NULL;

COMMIT TRANSACTION;
GO
