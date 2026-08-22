# SSL / HTTPS runbook — תור צ׳יק

מסמך זה מתאר איך התעודה (SSL/TLS) מונפקת ונקשרת לדומיין המותאם ב-Azure Container Apps, מהו סיפור החידוש, החלטת ה-HSTS, ופקודות האימות. הדומיין בפרודקשן הוא `torchick.duckdns.org`.

---

## תוכן עניינים

1. [תמונת מצב](#תמונת-מצב)
2. [הנפקה וקשירה של התעודה](#הנפקה-וקשירה-של-התעודה)
3. [חידוש התעודה](#חידוש-התעודה)
4. [הפניית HTTP ל-HTTPS](#הפניית-http-ל-https)
5. [החלטת HSTS](#החלטת-hsts)
6. [גרסאות TLS וצפנים](#גרסאות-tls-וצפנים)
7. [עוגיות מאובטחות](#עוגיות-מאובטחות)
8. [פקודות אימות](#פקודות-אימות)
9. [מגבלות ידועות](#מגבלות-ידועות)

---

## תמונת מצב

| רכיב | ערך |
| --- | --- |
| דומיין | `torchick.duckdns.org` |
| Container App | `torchick-app-prod` |
| Resource group | `torchick-prod-rg` |
| Managed environment | `torchick-cae-prod` |
| סוג התעודה | Azure Container Apps **managed certificate** |
| שם התעודה | `mc-torchick-cae-p-torchick-duckdns-0957` |
| מנפיק | DigiCert, ביניים `GeoTrust TLS RSA CA G1`, שורש `DigiCert Global Root G2` |
| קשירה | `SniEnabled` |
| חידוש | אוטומטי על ידי Azure |

---

## הנפקה וקשירה של התעודה

התעודה היא **תעודה מנוהלת של Azure Container Apps** (managed certificate), לא תעודה שהועלתה ידנית. Azure מנפיק אותה מול DigiCert ומאמת בעלות על הדומיין בשיטת `HTTP` (טוקן אימות שמוגש תחת הדומיין עצמו). זו הסיבה שהמנפיק בשרשרת הוא `GeoTrust TLS RSA CA G1` של DigiCert, ותוקף התעודה הוא כשישה חודשים.

הקשירה בין הדומיין המותאם לתעודה היא ברמת ה-managed environment, בשיטת `SniEnabled`. אפשר לראות זאת כך:

```bash
az containerapp hostname list \
  --name torchick-app-prod -g torchick-prod-rg -o table
# BindingType=SniEnabled, CertificateId=.../managedCertificates/mc-torchick-cae-p-torchick-duckdns-0957

az containerapp env certificate list \
  --name torchick-cae-prod -g torchick-prod-rg -o table
# provisioningState=Succeeded, validationMethod=HTTP, subjectName=torchick.duckdns.org
```

הקידומת `mc-` והנתיב `.../managedEnvironments/.../managedCertificates/` הם הסימן הוודאי שמדובר בתעודה מנוהלת.

---

## חידוש התעודה

התעודה המנוהלת מתחדשת **אוטומטית על ידי Azure** לפני פקיעתה. אין תלות בטוקן של DuckDNS ואין העלאה ידנית של תעודת DigiCert. כל עוד:

- הדומיין `torchick.duckdns.org` ממשיך להצביע (CNAME/A) על ה-FQDN של ה-Container App, וגם
- רשומת האימות של הדומיין המותאם נשארת במקומה,

Azure יחדש ויקשור את התעודה החדשה ללא התערבות. הרוטציה שקופה לאפליקציה: אין צורך לבנות מחדש את הקונטיינר ואין צורך לפרוס מחדש.

**מתי בכל זאת נדרשת פעולה ידנית:** רק אם האימות נשבר (למשל אם רשומת ה-DNS של DuckDNS השתנתה או פקעה). במקרה כזה החידוש ייכשל, יש לתקן את ה-DNS ולהריץ מחדש את הקשירה של הדומיין המותאם. אם צריך לשנות רשומת DuckDNS, זה טוקן רגיש: יש לעצור ולתאם, לא לנחש.

---

## הפניית HTTP ל-HTTPS

ההפניה `301` מ-HTTP ל-HTTPS נאכפת **בשכבת ה-ingress של Container Apps**, לא בקוד האפליקציה. היא נשלטת על ידי הדגל `allowInsecure`:

```bash
az containerapp ingress show \
  --name torchick-app-prod -g torchick-prod-rg \
  --query "{allowInsecure:allowInsecure, external:external, targetPort:targetPort}" -o jsonc
# allowInsecure=false  =>  ingress מחזיר 301 מ-http ל-https
```

מכיוון שההפניה מתבצעת ב-ingress לפני שהבקשה מגיעה ל-Next.js, אין ולא צריך קוד הפניה ב-`middleware.ts` (ה-middleware מטפל רק בשערי `/admin` ו-`/account`). **אין לשנות את `allowInsecure`**: כיבוי הדגל ישבור את ההפניה.

---

## החלטת HSTS

נוסף header גלובלי לכל תגובות ה-production דרך `next.config.mjs` בבלוק `headers()` הקיים. הבלוק פולט את ה-header רק כאשר `process.env.NODE_ENV === 'production'`, כדי להשאיר פיתוח מקומי מעל http ללא שינוי:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

- `max-age=63072000` (שנתיים): הדפדפן יזכור לגשת רק ב-HTTPS למשך שנתיים מכל ביקור.
- `includeSubDomains`: המדיניות חלה גם על תתי-דומיינים של `torchick.duckdns.org`. בטוח, כי איננו מחזיקים תת-תת-דומיינים וכולם ממילא מוגשים ב-HTTPS דרך אותו ingress.

**למה בלי `preload`:** `torchick.duckdns.org` הוא תת-דומיין של הסיומת הציבורית המשותפת `duckdns.org`, המשמשת אלפי משתמשים. הגשת מארח בסיומת משותפת לרשימת ה-preload (hstspreload.org) אינה נאותה, ובפועל בלתי הפיכה (הסרה מהרשימה איטית ומורכבת). לכן ההגנה נשענת על `max-age` בן השנתיים יחד עם `includeSubDomains`, שנותנים את מלוא ערך ה-HSTS בלי הסיכון של רשימת ה-preload.

**למה בקונפיג ולא ב-middleware:** ה-`headers()` של Next.js כבר קיים בפרויקט (עבור `/sw.js`), חל על כל המסלולים, ורץ בזמן הבנייה ללא עלות ריצה. ה-header מופיע על תגובות ה-HTTPS שהדפדפן מקבל אחרי הפניית ה-ingress, וזו ההתנהגות הנכונה. תגובת ה-301 עצמה מיוצרת על ידי ה-ingress ואינה נושאת HSTS, וזה תקין.

---

## גרסאות TLS וצפנים

ה-ingress של Container Apps אוכף מינימום **TLS 1.2**. אימות מהמעטפת:

```bash
# TLS 1.2 — עובר, צופן חזק
echo | openssl s_client -connect torchick.duckdns.org:443 \
  -servername torchick.duckdns.org -tls1_2 2>/dev/null | grep -E "Protocol|Cipher"
# Protocol: TLSv1.2, Cipher: ECDHE-RSA-CHACHA20-POLY1305

# TLS 1.3 — עובר, צופן חזק
echo | openssl s_client -connect torchick.duckdns.org:443 \
  -servername torchick.duckdns.org -tls1_3 2>/dev/null | grep -E "Protocol|Cipher"
# Protocol: TLSv1.3, Cipher: TLS_AES_256_GCM_SHA384
```

TLS 1.2 ו-TLS 1.3 מנהלים משא ומתן עם צפני ECDHE/AEAD חזקים. TLS 1.0/1.1 אינם נחשפים על ידי הפלטפורמה. הערה: בדיקה ישירה של 1.0/1.1 מ-macOS אינה חד-משמעית כי ה-LibreSSL המקומי כלל אינו מציע אותם. הקביעה נשענת על ברירת המחדל של הפלטפורמה (מינימום TLS 1.2).

---

## עוגיות מאובטחות

שתי מערכות העוגיות כבר מוקשחות, ללא צורך בשינוי:

- **עוגיית לקוח `client_session`** (`src/lib/session.ts`): מוגדרת `httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`, `path: '/'`. כלומר `Secure` בפרודקשן.
- **עוגיית בעלים (NextAuth / Auth.js v5)**: `src/auth.ts` מגדיר `trustHost: true` ואסטרטגיית JWT ללא override של עוגיות. מעל HTTPS, Auth.js משתמש אוטומטית בעוגייה בקידומת `__Secure-authjs.session-token` (מחייבת `Secure`) עם `SameSite=Lax` ו-`HttpOnly`. זה מאושש על ידי `OWNER_COOKIES` ב-`middleware.ts`.

---

## פקודות אימות

לאחר פריסה, לאמת שה-HSTS נוכח, שהתעודה עדיין תקפה, ושה-HTTP עדיין מפנה:

```bash
# 1) HSTS נוכח על תגובת ה-HTTPS
curl -sI https://torchick.duckdns.org | grep -i strict-transport-security
# strict-transport-security: max-age=63072000; includeSubDomains

# 2) התעודה עדיין מאומתת (שרשרת מלאה, verify=0)
echo | openssl s_client -connect torchick.duckdns.org:443 \
  -servername torchick.duckdns.org 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates

# 3) HTTP עדיין מפנה 301 ל-HTTPS
curl -sI http://torchick.duckdns.org | grep -iE "^HTTP|^location"
# HTTP/1.1 301 Moved Permanently ; location: https://torchick.duckdns.org/

# 4) אין אזהרת אמון בדפדפן: verify return code צריך להיות 0 (ok)
echo | openssl s_client -connect torchick.duckdns.org:443 \
  -servername torchick.duckdns.org 2>/dev/null | grep "Verify return code"
```

> הערה על cold start: הפרודקשן מתכווץ לאפס במצב סרק. הבקשה הראשונה עלולה לקחת כ-20 שניות. זו התנהגות תקינה של scale-to-zero, לא תקלת TLS.

---

## מגבלות ידועות

- **www לא נתמך:** DuckDNS מספק מארח יחיד. `www.torchick.duckdns.org` מאפס את החיבור ב-SNI כי הוא אינו קשור לתעודה. אין הפניית www לאפקס. תמיכה ב-www תדרוש מארח DuckDNS נוסף ותעודה מנוהלת נוספת.
- **אין preload בכוונה:** המארח יושב על הסיומת הציבורית המשותפת `duckdns.org`, ולכן הגשה לרשימת ה-preload אינה נאותה ובלתי הפיכה למעשה (ראו [החלטת HSTS](#החלטת-hsts)).
- **בדיקת TLS 1.0/1.1** אינה חד-משמעית מ-macOS עקב מגבלת ה-LibreSSL המקומי. הקביעה נשענת על מינימום TLS 1.2 של הפלטפורמה.
