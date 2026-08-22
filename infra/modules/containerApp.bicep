// אפליקציית Container App — אפליקציית Next.js המלאה (SSR/ISR, API, אדמין).
// scale-to-zero: minReplicas=0 → אפס עלות מחשוב במנוחה.
// האימג' נמשך מ-GHCR (חינם). אימות ל-registry נדרש רק לאימג' פרטי.

@description('שם האפליקציה')
param name string

@description('אזור Azure')
param location string

@description('מזהה סביבת Container Apps')
param environmentId string

@description('כתובת אימג\' מלאה, למשל ghcr.io/owner/repo:tag')
param image string

@description('פורט האזנה בקונטיינר')
param targetPort int = 3000

@description('מספר רפליקות מינימלי (0 = scale-to-zero)')
@minValue(0)
param minReplicas int = 0

@description('מספר רפליקות מקסימלי')
@minValue(1)
param maxReplicas int = 3

@description('הקצאת CPU (ליבות, כמחרוזת עשרונית, למשל 0.25)')
param cpu string = '0.25'

@description('הקצאת זיכרון, למשל 0.5Gi')
param memory string = '0.5Gi'

@description('שרת ה-registry (ברירת מחדל GHCR)')
param registryServer string = 'ghcr.io'

@description('שם משתמש ל-registry (ריק לאימג\' ציבורי)')
@secure()
param registryUsername string = ''

@description('טוקן/סיסמה ל-registry (ריק לאימג\' ציבורי)')
@secure()
param registryPasswordToken string = ''

@description('מחרוזת חיבור למסד הנתונים')
@secure()
param databaseUrl string

@description('מפתח חתימת עוגיית התחברות')
@secure()
param sessionSecret string

@description('פלפל להצפנת קודי OTP')
@secure()
param otpPepper string

@description('WhatsApp Cloud API access token (סוד; ריק אם לא בשימוש)')
@secure()
param whatsAppAccessToken string = ''

@description('תצורת הודעות לא-סודית (זוגות שם/ערך של משתני סביבה, למשל WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OTP_TEMPLATE). ריק כברירת מחדל.')
param messagingConfig object = {}

@description('אזור זמן עסקי (IANA)')
param businessTimezone string = 'Asia/Jerusalem'

@description('ספק הודעות (console כברירת מחדל; whatsapp-cloud לפרודקשן)')
param messagingProvider string = 'console'

@description('כתובת בסיס ציבורית של האפליקציה')
param appPublicUrl string

@description('סוד לחתימת ה-JWT של NextAuth (כניסת בעלים). ריק = לא מוגדר')
@secure()
param nextAuthSecret string = ''

@description('כתובת בסיס ל-callbacks של NextAuth (ריק = נגזר מ-appPublicUrl)')
param nextAuthUrl string = ''

@description('מזהה לקוח Google OAuth (ריק = כפתור Google מוסתר)')
param googleClientId string = ''

@description('סוד לקוח Google OAuth (ריק = כפתור Google מוסתר)')
@secure()
param googleClientSecret string = ''

@description('חיבור SMTP ל-magic-link (אופציונלי, ריק = מושבת)')
@secure()
param emailServer string = ''

@description('כתובת שולח ל-magic-link (אופציונלי)')
param emailFrom string = ''

@description('Firebase Admin — מזהה פרויקט (ריק = אימות טלפון-Firebase מושבת בצד השרת)')
param firebaseProjectId string = ''

@description('Firebase Admin — client_email של חשבון השירות (ריק = מושבת)')
param firebaseClientEmail string = ''

@description('Firebase Admin — private_key של חשבון השירות (עשוי לכלול \\n מילוליים; קוד האפליקציה ממיר). ריק = מושבת')
@secure()
param firebasePrivateKey string = ''

@description('Firebase Web — apiKey ציבורי (NEXT_PUBLIC). ריק = אימות טלפון בצד הלקוח מושבת')
param firebaseWebApiKey string = ''

@description('Firebase Web — authDomain ציבורי (NEXT_PUBLIC)')
param firebaseWebAuthDomain string = ''

@description('Firebase Web — projectId ציבורי (NEXT_PUBLIC)')
param firebaseWebProjectId string = ''

@description('Firebase Web — appId ציבורי (NEXT_PUBLIC)')
param firebaseWebAppId string = ''

@description('Firebase Web — messagingSenderId ציבורי (NEXT_PUBLIC)')
param firebaseWebMessagingSenderId string = ''

@description('תגיות משאב')
param tags object = {}

var useRegistryAuth = !empty(registryPasswordToken)

var baseSecrets = [
  {
    name: 'database-url'
    value: databaseUrl
  }
  {
    name: 'session-secret'
    value: sessionSecret
  }
  {
    name: 'otp-pepper'
    value: otpPepper
  }
]

// סוד ההודעות מתווסף רק כאשר סופק ערך, כדי לשמור על אפס שינוי כאשר
// MESSAGING_PROVIDER=console (כל הערכים ריקים → אין סודות ואין env חדשים).
var messagingSecrets = concat(
  empty(whatsAppAccessToken) ? [] : [ { name: 'whatsapp-access-token', value: whatsAppAccessToken } ]
)

// כניסות env של הסודות (secretRef), מותנות באותו אופן.
var messagingSecretEnv = concat(
  empty(whatsAppAccessToken) ? [] : [ { name: 'WHATSAPP_ACCESS_TOKEN', secretRef: 'whatsapp-access-token' } ]
)

// תצורת הודעות לא-סודית → env רגיל. מתועד ב-.env.example ו-docs.
var messagingConfigEnv = [for item in items(messagingConfig): {
  name: item.key
  value: string(item.value)
}]

var registrySecret = [
  {
    name: 'registry-token'
    value: registryPasswordToken
  }
]

// סודות NextAuth — נוספים רק כשהערך קיים (אדיטיבי, לא שובר פריסות קיימות).
var authSecrets = concat(
  empty(nextAuthSecret) ? [] : [
    {
      name: 'nextauth-secret'
      value: nextAuthSecret
    }
  ],
  empty(googleClientSecret) ? [] : [
    {
      name: 'google-client-secret'
      value: googleClientSecret
    }
  ],
  empty(emailServer) ? [] : [
    {
      name: 'email-server'
      value: emailServer
    }
  ]
)

// משתני סביבה של NextAuth — נפלטים רק כשהערך קיים (degrade gracefully).
var authEnv = concat(
  empty(nextAuthSecret) ? [] : [
    {
      name: 'NEXTAUTH_SECRET'
      secretRef: 'nextauth-secret'
    }
  ],
  [
    {
      name: 'NEXTAUTH_URL'
      value: empty(nextAuthUrl) ? appPublicUrl : nextAuthUrl
    }
  ],
  empty(googleClientId) ? [] : [
    {
      name: 'GOOGLE_CLIENT_ID'
      value: googleClientId
    }
  ],
  empty(googleClientSecret) ? [] : [
    {
      name: 'GOOGLE_CLIENT_SECRET'
      secretRef: 'google-client-secret'
    }
  ],
  empty(emailServer) ? [] : [
    {
      name: 'EMAIL_SERVER'
      secretRef: 'email-server'
    }
  ],
  empty(emailFrom) ? [] : [
    {
      name: 'EMAIL_FROM'
      value: emailFrom
    }
  ]
)

// סודות Firebase Admin — נוספים רק כאשר כל שלושת הערכים קיימים (אדיטיבי, לא שובר
// פריסות קיימות). רק private_key נחשב סוד; project_id ו-client_email נפלטים כ-env רגיל.
var firebaseConfigured = !empty(firebaseProjectId) && !empty(firebaseClientEmail) && !empty(firebasePrivateKey)

var firebaseSecrets = firebaseConfigured ? [
  {
    name: 'firebase-private-key'
    value: firebasePrivateKey
  }
] : []

// משתני סביבה של Firebase Admin — נפלטים רק כשהתצורה מלאה (degrade gracefully).
var firebaseEnv = firebaseConfigured ? [
  {
    name: 'FIREBASE_PROJECT_ID'
    value: firebaseProjectId
  }
  {
    name: 'FIREBASE_CLIENT_EMAIL'
    value: firebaseClientEmail
  }
  {
    name: 'FIREBASE_PRIVATE_KEY'
    secretRef: 'firebase-private-key'
  }
] : []

// תצורת Firebase Web ציבורית (NEXT_PUBLIC_*) — ערכים ציבוריים לא סודיים הנצרכים
// בצד הלקוח לאימות טלפון. נפלטים רק כאשר apiKey ו-appId קיימים (אדיטיבי, degrade
// gracefully). קיבוע כאן מבטיח שפריסת תשתית (deployInfra) לא תמחק אותם.
var firebaseWebConfigured = !empty(firebaseWebApiKey) && !empty(firebaseWebAppId)

var firebasePublicEnv = firebaseWebConfigured ? [
  {
    name: 'NEXT_PUBLIC_FIREBASE_API_KEY'
    value: firebaseWebApiKey
  }
  {
    name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    value: firebaseWebAuthDomain
  }
  {
    name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    value: firebaseWebProjectId
  }
  {
    name: 'NEXT_PUBLIC_FIREBASE_APP_ID'
    value: firebaseWebAppId
  }
  {
    name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
    value: firebaseWebMessagingSenderId
  }
] : []

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      secrets: concat(baseSecrets, messagingSecrets, authSecrets, firebaseSecrets, useRegistryAuth ? registrySecret : [])
      registries: useRegistryAuth ? [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-token'
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat([
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'SESSION_SECRET'
              secretRef: 'session-secret'
            }
            {
              name: 'OTP_PEPPER'
              secretRef: 'otp-pepper'
            }
            {
              name: 'BUSINESS_TIMEZONE'
              value: businessTimezone
            }
            {
              name: 'MESSAGING_PROVIDER'
              value: messagingProvider
            }
            {
              name: 'NEXT_PUBLIC_APP_URL'
              value: appPublicUrl
            }
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'HOSTNAME'
              value: '0.0.0.0'
            }
          ], messagingSecretEnv, messagingConfigEnv, authEnv, firebaseEnv, firebasePublicEnv)
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output name string = app.name
output principalId string = app.identity.principalId
