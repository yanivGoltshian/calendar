# תשתית פרישה ועלויות — תור צ׳יק

מסמך זה מתאר את תשתית הפרישה כקוד (IaC) עבור פלטפורמת תור צ׳יק, ארכיטקטורת העלות, אומדני העלות החודשית, ה-runbook לפרישה מאושרת, ורשימת הסודות הנדרשים.

> **מצב נוכחי: הכנה בלבד.** כל התבניות פרמטריות ואינן מופעלות. שום משאב אינו מוקצה ב-Azure עד להרצת פריסה ידנית ומאושרת. אין טריגר אוטומטי, אין חיבור ל-Azure, ואפס משאבים שרצים כל הזמן.

---

## תוכן עניינים

1. [ארכיטקטורה](#ארכיטקטורה)
2. [רכיבי התשתית](#רכיבי-התשתית)
3. [טבלת עלויות](#טבלת-עלויות)
4. [מסד הנתונים: שתי אפשרויות ומסלול הגירה](#מסד-הנתונים)
5. [סודות ומשתני סביבה](#סודות-ומשתני-סביבה)
6. [Runbook לפרישה מאושרת](#runbook-לפרישה-מאושרת)
7. [שינוי קונפיג נדרש (שלב אינטגרציה)](#שינוי-קונפיג-נדרש)
8. [הערות ומגבלות](#הערות-ומגבלות)

---

## ארכיטקטורה

תור צ׳יק היא אפליקציית Next.js 15 אחת עם עיבוד בצד השרת, מסלולי API, אזור אדמין, ועמודי עסק ציבוריים הנשענים על מסד נתונים. לכן הליבה אינה יכולה להיות סטטית לחלוטין. הארכיטקטורה משלבת שתי שכבות:

```mermaid
flowchart TD
    U[משתמשים] -->|torchick.com| SWA[Static Web Apps - Free<br/>תוכן שיווקי סטטי + CDN + SSL]
    U -->|app.torchick.com / API| CA[Container Apps<br/>Next.js מלא, scale-to-zero]
    CA --> DB[(PostgreSQL<br/>חיצוני חינם או Azure Flexible)]
    CA --> LAW[Log Analytics<br/>מכסה יומית מוגבלת]
    GHCR[GitHub Container Registry<br/>אימג'ים - חינם] -->|pull| CA

    style SWA fill:#d4f7d4
    style CA fill:#d4e4f7
    style GHCR fill:#f7f0d4
    style DB fill:#f7d4d4
```

**עקרון מנחה:** כל רכיב שיכול להיות בשכבת חינם או במצב scale-to-zero נמצא שם. מנוף העלות היחיד שרץ תמיד הוא מסד נתונים מנוהל, ולכן הוא כבוי כברירת מחדל לטובת מסד חיצוני בשכבת חינם.

### חלוקת אחריות בין השכבות

| שכבה | מה מתארח | טכנולוגיה | מצב עלות |
|---|---|---|---|
| תוכן שיווקי סטטי | דף נחיתה, עמודים שיווקיים | Azure Static Web Apps (Free) | אפס |
| אפליקציה מלאה | אדמין, API, עמודי עסק דינמיים, OTP, הזמנות | Azure Container Apps (Consumption) | אפס במנוחה (scale-to-zero) |
| מסד נתונים | נתוני עסקים, תורים, לקוחות | PostgreSQL חיצוני חינם ← Azure Flexible | אפס בהתחלה |
| רישום אימג'ים | אימג'י הקונטיינר | GitHub Container Registry | אפס |
| יומנים | לוגים של Container Apps | Log Analytics (מכסה יומית) | אפס בתוך מכסת החינם |

---

## רכיבי התשתית

כל התבניות נמצאות תחת `infra/` והן מודולריות:

| קובץ | תפקיד |
|---|---|
| `infra/main.bicep` | ה-orchestrator הראשי. מקבל פרמטרים, קורא למודולים, מפעיל תנאים. |
| `infra/main.parameters.example.json` | קובץ פרמטרים לדוגמה עם placeholders. סודות מסומנים `REPLACE_ME`. |
| `infra/modules/logAnalytics.bicep` | workspace ליומנים, עם מכסת קליטה יומית להגנת עלות. |
| `infra/modules/containerAppsEnvironment.bicep` | סביבת Container Apps מנוהלת (Consumption). |
| `infra/modules/containerApp.bicep` | האפליקציה עצמה. scale-to-zero, סודות, משתני סביבה, אימות GHCR. |
| `infra/modules/staticWebApp.bicep` | Static Web App בשכבת Free לתוכן סטטי. |
| `infra/modules/postgresFlexible.bicep` | PostgreSQL Flexible Server. כבוי כברירת מחדל. |
| `Dockerfile` | בנייה רב-שלבית ל-Next.js standalone, משתמש לא-root. |
| `.dockerignore` | מונע כניסת סודות ותלויות מיותרות לאימג'. |
| `.github/workflows/deploy.yml` | פרישה ידנית בלבד (`workflow_dispatch`). ללא טריגר אוטומטי. |

### מתגי הפעלה מרכזיים (פרמטרים ב-`main.bicep`)

| פרמטר | ברירת מחדל | משמעות |
|---|---|---|
| `minReplicas` | `0` | אפס רפליקות במנוחה. אפס עלות מחשוב כשאין תעבורה. |
| `maxReplicas` | `3` | תקרת התרחבות בעומס. |
| `deployStaticWebApp` | `true` | פריסת שכבת התוכן הסטטי (חינם). |
| `deployPostgres` | `false` | כבוי. מונע הקצאת מסד נתונים מנוהל שרץ תמיד. |
| `containerCpu` | `0.25` | הקצאת CPU מינימלית. |
| `containerMemory` | `0.5Gi` | הקצאת זיכרון מינימלית. |

---

## טבלת עלויות

האומדנים מיועדים לאזור `westeurope` ומבוססים על מבנה התמחור הציבורי של Azure. אלה **אומדנים בלבד**, לאימות מול מחשבון העלויות הרשמי של Azure לפני קבלת החלטה. שער המרה משוער: דולר כפול 3.7 שקל.

### תרחיש נמוך (התחלה, תעבורה מועטה)

מסד חיצוני בשכבת חינם, Container Apps ב-scale-to-zero, Static Web Apps בשכבת Free.

| רכיב | תצורה | עלות חודשית (דולר) | עלות חודשית (שקל) |
|---|---|---|---|
| Container Apps | scale-to-zero, מענק חודשי חינמי | 0 עד 2 | 0 עד 7 |
| Static Web Apps | Free | 0 | 0 |
| PostgreSQL חיצוני | Neon / Supabase Free | 0 | 0 |
| GitHub Container Registry | ציבורי/פרטי במכסה | 0 | 0 |
| Log Analytics | בתוך מכסת 5GB חינם | 0 | 0 |
| **סה"כ** | | **0 עד 2** | **0 עד 7** |

המענק החודשי החינמי של Container Apps מכסה כ-180 אלף vCPU-שניות וכ-360 אלף GiB-שניות. בתעבורה נמוכה עם scale-to-zero, השימוש נשאר בתוך המענק והעלות היא אפס.

### תרחיש גדל (עומס עולה, מסד מנוהל ב-Azure)

מעבר ל-Azure PostgreSQL Flexible Server (Burstable B1ms), רפליקה אחת פעילה חלק מהזמן.

| רכיב | תצורה | עלות חודשית (דולר) | עלות חודשית (שקל) |
|---|---|---|---|
| Container Apps | מעבר למענק, שימוש מתון | 5 עד 15 | 18 עד 55 |
| Static Web Apps | Free (או Standard בעת הצורך) | 0 עד 9 | 0 עד 33 |
| PostgreSQL Flexible | B1ms Burstable, מחשוב | כ-13 עד 15 | כ-48 עד 55 |
| PostgreSQL אחסון | 32GB | כ-4 | כ-15 |
| גיבויים | בתוך האחסון המוקצה | 0 | 0 |
| GitHub Container Registry | פרטי | 0 | 0 |
| Log Analytics | מעבר קל למכסה | 0 עד 3 | 0 עד 11 |
| **סה"כ** | | **כ-22 עד 46** | **כ-80 עד 170** |

**מסקנה:** ההתחלה היא אפס עלות אמיתי. מנוף העלות המשמעותי היחיד הוא המעבר למסד נתונים מנוהל ב-Azure, ולכן הוא מופרד למתג `deployPostgres` שנשאר כבוי עד שיש הצדקה עסקית.

---

## מסד הנתונים

מסד הנתונים הוא הרכיב היחיד שדורש החלטת עלות. Prisma מפשט מעבר בין ספקים כי הוא ניגש למסד דרך `DATABASE_URL` בלבד, ללא תלות בספק.

### אפשרות א (מומלצת להתחלה): מסד חיצוני בשכבת חינם

ספקים כמו Neon או Supabase מציעים PostgreSQL בשכבת חינם עם scale-to-zero משלהם.

יתרונות:
- עלות אפס אמיתית בהתחלה.
- הקמה מהירה, ללא תלות בהקצאת Azure.
- מתאים לאפיון ולשלב MVP.

חסרונות:
- מגבלות אחסון וחיבורים בשכבת החינם.
- זמן השהיה מעט גבוה יותר אם המסד באזור מרוחק.

### אפשרות ב (יעד לטווח ארוך): Azure PostgreSQL Flexible Server

`Standard_B1ms` בשכבת `Burstable`, אחסון 32GB, גרסה 16.

יתרונות:
- קרבה גיאוגרפית ל-Container Apps (זמן השהיה נמוך).
- גיבויים מנוהלים, שדרוג גרסאות, ניטור מובנה.
- מתאים לעומס יציב וגדל.

חסרונות:
- משאב שרץ תמיד. עלות חודשית קבועה (ראו טבלה).

### מסלול הגירה בין השתיים

המעבר אינו דורש שינוי קוד, רק החלפת `DATABASE_URL` והרצת המיגרציות.

1. הקצו את המסד המנוהל: הריצו פריסה עם `deployPostgres=true` ו-`postgresAdminPassword` מאוכלס.
2. הריצו את סכימת Prisma מול המסד החדש:
   ```bash
   DATABASE_URL="postgresql://torchickadmin:<סיסמה>@torchick-pg-prod.postgres.database.azure.com:5432/torchick?sslmode=require" \
     npx prisma migrate deploy
   ```
3. העבירו נתונים קיימים (אם יש) עם `pg_dump` מהמסד הישן ו-`pg_restore` או `psql` אל החדש.
4. עדכנו את הסוד `DATABASE_URL` ב-repository/environment secrets לכתובת החדשה.
5. הריצו את ה-workflow מחדש (או רק את שלב עדכון האפליקציה) כדי שהאפליקציה תיקח את המחרוזת החדשה.
6. אמתו, ואז שחררו את המסד החיצוני הישן.

> שימו לב: מסלול ההגירה ההפוך (מ-Azure חזרה לחיצוני) זהה, רק בכיוון הנגדי.

---

## סודות ומשתני סביבה

### סודות (secrets) הנדרשים בפריסה

מוזרקים כ-secrets ב-Container App או כ-repository/environment secrets ב-GitHub. לעולם לא נכנסים לקוד או לאימג'.

| שם | תיאור | דוגמה |
|---|---|---|
| `DATABASE_URL` | מחרוזת חיבור מלאה ל-PostgreSQL | `postgresql://user:pass@host:5432/torchick?sslmode=require` |
| `SESSION_SECRET` | מפתח חתימת עוגיית התחברות | מחרוזת אקראית 32 בתים (hex) |
| `OTP_PEPPER` | פלפל להצפנת קודי OTP | מחרוזת אקראית 32 בתים (hex) |
| `CRON_SECRET` | אימות ה-cron של התזכורות (`/api/cron/reminders`) | מחרוזת אקראית 32 בתים (hex) |

> **‏`CRON_SECRET` — ערך כפול חובה:** אותו ערך בדיוק חייב להיות מוגדר בשני מקומות: (1) כ-repository secret בשם `CRON_SECRET` (ה-workflow `reminders.yml` שולח אותו ככותרת `x-cron-secret`), ו-(2) כמשתנה סביבה `CRON_SECRET` על ה-Container App‏ `torchick-app-prod` (מולו ה-endpoint משווה). אי-התאמה מחזירה 401 והתזכורות לא יישלחו. הגדרה על ה-Container App:
> ```bash
> az containerapp update --subscription 1c691a07-fdfe-4dfd-bb81-d95c8f9d4e6f \
>   -g torchick-prod-rg -n torchick-app-prod \
>   --set-env-vars CRON_SECRET=<same-value>
> ```

יצירת ערך אקראי בטוח:
```bash
openssl rand -hex 32
```

### סודות שליחת הודעות (רק כאשר עולים מ-console לספק אמיתי)

מוזרקים כ-secrets ב-Container App (`secretRef`) ומחווטים ב-`infra/modules/containerApp.bicep` באופן מותנה: כל עוד הערך ריק, לא נוצר סוד ולא מתווסף משתנה env, כך שפריסת `console` נשארת ללא שינוי.

מתאם Twilio (`SMS_PROVIDER=twilio`):

| שם | תיאור |
|---|---|
| `TWILIO_ACCOUNT_SID` | מזהה חשבון Twilio |
| `TWILIO_AUTH_TOKEN` | טוקן אימות Twilio |

מתאם שער ישראלי (`SMS_PROVIDER=httpgateway`):

| שם | תיאור |
|---|---|
| `SMS_GATEWAY_TOKEN` | טוקן אימות לשער (מצב `bearer`/`header`) |
| `SMS_GATEWAY_USERNAME` | שם משתמש לשער (מצב `basic`) |
| `SMS_GATEWAY_PASSWORD` | סיסמה לשער (מצב `basic`) |

הגדרת סוד ל-Container App בפרודקשן, למשל:
```bash
az containerapp secret set \
  --name torchick-app-prod \
  --resource-group torchick-prod-rg \
  --secrets twilio-account-sid=ACxxxx twilio-auth-token=xxxx
```

### סודות נוספים ל-GitHub Actions (שלב הפרישה המאושרת)

| שם | תיאור |
|---|---|
| `AZURE_CLIENT_ID` | זהות OIDC לפריסה ל-Azure |
| `AZURE_TENANT_ID` | מזהה ה-tenant |
| `AZURE_SUBSCRIPTION_ID` | מזהה המנוי |
| `APP_PUBLIC_URL` | כתובת ציבורית, למשל `https://torchick.com` |
| `CRON_SECRET` | סוד ה-cron של התזכורות; נשלח ככותרת `x-cron-secret` מ-`reminders.yml`. חייב להיות זהה לערך שעל ה-Container App |
| `GITHUB_TOKEN` | מסופק אוטומטית, לדחיפה ל-GHCR |

### תזכורות מתוזמנות (`reminders.yml`)

ה-workflow ‏`.github/workflows/reminders.yml` רץ כל 15 דקות (וניתן להריצו ידנית) ומפעיל‏ `POST /api/cron/reminders` בפרודקשן עם הכותרת `x-cron-secret`. ה-endpoint מוצא תורים פעילים בחלון ~24 שעות קדימה (±15 דק׳, תואם לתדירות ה-cron), שולח תזכורת דרך שכבת ההודעות ומסמן `reminderSentAt` באופן אידמפוטנטי (בטוח לריצה חוזרת). הדרישות: הסודות `APP_PUBLIC_URL` ו-`CRON_SECRET` ב-repository secrets, וערך `CRON_SECRET` זהה על ה-Container App. אם `SMS_PROVIDER=console` בפרודקשן, התזכורות מחושבות ומסומנות אך לא נשלחות בפועל (מודפסות ללוג).

### משתני סביבה לא-סודיים

| שם | ברירת מחדל | הערה |
|---|---|---|
| `BUSINESS_TIMEZONE` | `Asia/Jerusalem` | אזור זמן עסקי |
| `SMS_PROVIDER` | `console` | ספק ההודעות: `console` (פיתוח), `twilio`, `httpgateway`. בפרודקשן חובה ספק אמיתי |
| `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_FROM` | ריק | מקור שליחת SMS ב-Twilio (אחד מהם) |
| `TWILIO_WHATSAPP_FROM` | ריק | מספר שולח ל-WhatsApp ב-Twilio |
| `SMS_GATEWAY_PRESET` | ריק | preset לשער ישראלי: `019` או `inforu` |
| `SMS_GATEWAY_ENDPOINT` / `_METHOD` / `_AUTH_MODE` / `_AUTH_HEADER` / `_FROM` / `_TO_FIELD` / `_TEXT_FIELD` / `_FROM_FIELD` / `_EXTRA_JSON` | ריק | תצורת שער HTTP לא-סודית (ראו `.env.example`) |
| `OTP_COOLDOWN_SECONDS` | `60` | קול-דאון בין שליחות OTP לאותו טלפון |
| `OTP_MAX_PER_PHONE_PER_DAY` | `8` | תקרת OTP יומית לכל טלפון |
| `OTP_MAX_PER_IP_PER_DAY` | `30` | תקרת OTP יומית לכל IP |
| `NEXT_PUBLIC_APP_URL` | `https://torchick.com` | **מוטמע בזמן build.** ראו הערה למטה |
| `PORT` | `3000` | פורט האזנה |
| `HOSTNAME` | `0.0.0.0` | האזנה על כל הממשקים בקונטיינר |

> **חשוב:** `NEXT_PUBLIC_APP_URL` מוטמע לתוך חבילות ה-client בזמן build של Next.js. הגדרתו בזמן ריצה בלבד לא תשפיע על קוד צד-הלקוח. לכן הוא מוזרק כ-`ARG` בשלב ה-builder ב-`Dockerfile` וגם כ-secret בזמן הבנייה ב-workflow.

---

## Runbook לפרישה מאושרת

הצעדים הבאים מתבצעים **רק לאחר אישור מפורש**. עד אז, שום דבר אינו רץ.

### שלב 0: דרישות מוקדמות

- מנוי Azure פעיל עם הרשאות ליצירת קבוצת משאבים.
- Azure CLI מותקן מקומית (או שימוש ב-workflow).
- החלטה על מסד נתונים (חיצוני חינם או Azure Flexible).

### שלב 1: יצירת קבוצת משאבים

```bash
az group create --name torchick-prod-rg --location westeurope
```

### שלב 2: הכנת קובץ פרמטרים

העתיקו את `infra/main.parameters.example.json` ל-`infra/main.parameters.prod.json`, והחליפו כל `REPLACE_ME` בערך אמיתי. **אל תוסיפו קובץ זה ל-git** אם הוא מכיל סודות.

### שלב 3: אימות התבנית (ללא הקצאה)

```bash
az deployment group what-if \
  --resource-group torchick-prod-rg \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.json
```

`what-if` מציג מה ייווצר מבלי להקצות דבר.

### שלב 4: בניית האימג' ודחיפה ל-GHCR

```bash
docker build -t ghcr.io/yanivgoltshian/calendar:latest \
  --build-arg NEXT_PUBLIC_APP_URL=https://torchick.com .
echo "$GHCR_PAT" | docker login ghcr.io -u yanivGoltshian --password-stdin
docker push ghcr.io/yanivgoltshian/calendar:latest
```

או פשוט הריצו את ה-workflow הידני שמבצע זאת אוטומטית.

### שלב 5: פריסה

```bash
az deployment group create \
  --resource-group torchick-prod-rg \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.json
```

### שלב 6: הרצת מיגרציות מסד הנתונים

```bash
DATABASE_URL="<המחרוזת שלכם>" npx prisma migrate deploy
```

### שלב 7: אימות

- בדקו את `containerAppFqdn` מפלטי הפריסה.
- גשו לכתובת ובדקו שהאפליקציה מגיבה.
- בדקו יומנים ב-Log Analytics.

### שלב 8: דומיין מותאם (torchick.com)

- ב-Static Web App: הוסיפו את הדומיין השיווקי דרך הגדרות Custom Domains (SSL חינם).
- ב-Container App: הוסיפו דומיין מותאם ל-API/אדמין דרך `az containerapp hostname add` ואימות.

### עדכון אפליקציה בלבד (ללא שינוי תשתית)

לאחר שהתשתית קיימת, עדכון קוד דורש רק אימג' חדש:

```bash
az containerapp update \
  --name torchick-app-prod \
  --resource-group torchick-prod-rg \
  --image ghcr.io/yanivgoltshian/calendar:<תג-חדש>
```

או הריצו את ה-workflow עם `deployInfra=false`.

---

## שינוי קונפיג נדרש

> שינוי זה **אינו מבוצע במסגרת עבודת ההכנה** לפי תחום האחריות הנעול. הוא מתועד כאן לביצוע בשלב האינטגרציה.

ה-`Dockerfile` מסתמך על פלט `standalone` של Next.js (התיקייה `.next/standalone` ובתוכה `server.js`). כדי שהפלט ייווצר, יש להוסיף ל-`next.config.mjs`:

```js
const nextConfig = {
  output: 'standalone',
  // ...שאר ההגדרות הקיימות
};
```

ללא שינוי זה, שלב ה-runner ב-`Dockerfile` ייכשל כי `.next/standalone` לא קיים.

**הערת Prisma על alpha/musl:** אם מנוע Prisma אינו נטען בזמן ריצה על `node:20-alpine`, ייתכן שיידרש `binaryTargets` ב-`prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

גם שינוי זה שייך לשלב האינטגרציה ולא לעבודת ההכנה.

---

## הערות ומגבלות

- **אומדני עלות:** האומדנים מבוססים על מבנה התמחור הציבורי ואינם כוללים קריאה חיה למחירי Azure. אמתו מול מחשבון העלויות הרשמי לפני החלטה.
- **אזור:** ברירת המחדל היא `westeurope`. Static Web Apps אינו זמין באזור ישראל. לשיקולי מיקום נתונים ניתן לפרוס את Container Apps ואת PostgreSQL באזור `israelcentral` ולהשאיר את שכבת התוכן הסטטי ב-`westeurope`.
- **scale-to-zero וזמן התעוררות:** רפליקה ראשונה לאחר מנוחה עלולה להוסיף השהיית התעוררות (cold start) של שנייה עד כמה שניות. לתעבורה נמוכה זהו פשרה סבירה עבור עלות אפס.
- **GHCR פרטי:** אם האימג' פרטי, מלאו `registryUsername` ו-`registryPasswordToken` (טוקן GitHub עם הרשאת `read:packages`). לאימג' ציבורי השאירו ריק.
- **אין מיזוג ל-main:** עבודה זו נפרסת דרך PR שיעדו ענף האינטגרציה, לא `main`.
