// ============================================================================
// תור צ׳יק (torchick) — תבנית פרישה ל-Azure בעלות קרובה לאפס
// ----------------------------------------------------------------------------
// זוהי תבנית פרמטרית בלבד. שום משאב אינו מוקצה עד להרצת פריסה מאושרת ידנית.
// ארכיטקטורה: Container Apps (scale-to-zero) לאפליקציה המלאה + Static Web Apps
// (Free) לתוכן סטטי + PostgreSQL (חיצוני בשכבת חינם או Azure Flexible אופציונלי).
// היקף פריסה: קבוצת משאבים (resourceGroup). צרו את הקבוצה מראש בשלב הפריסה.
// ============================================================================

targetScope = 'resourceGroup'

@description('אזור Azure. ברירת מחדל: אזור קבוצת המשאבים.')
param location string = resourceGroup().location

@description('קידומת לשמות המשאבים')
param namePrefix string = 'torchick'

@description('שם הסביבה (prod/stg/dev)')
param environmentName string = 'prod'

@description('תגיות משותפות לכל המשאבים')
param tags object = {
  app: 'torchick'
  managedBy: 'bicep'
}

// ---------- Container App ----------
@description('כתובת אימג\' מלאה ב-GHCR, למשל ghcr.io/owner/repo:tag')
param containerImage string

@description('פורט האזנה של האפליקציה')
param containerTargetPort int = 3000

@description('רפליקות מינימום (0 = scale-to-zero, אפס עלות במנוחה)')
@minValue(0)
param minReplicas int = 0

@description('רפליקות מקסימום')
@minValue(1)
param maxReplicas int = 3

@description('הקצאת CPU (מחרוזת עשרונית)')
param containerCpu string = '0.25'

@description('הקצאת זיכרון')
param containerMemory string = '0.5Gi'

@description('שרת registry')
param registryServer string = 'ghcr.io'

@description('שם משתמש registry (ריק לאימג\' ציבורי)')
@secure()
param registryUsername string = ''

@description('טוקן registry (ריק לאימג\' ציבורי)')
@secure()
param registryPasswordToken string = ''

// ---------- סודות ומשתני סביבה של האפליקציה ----------
@description('מחרוזת חיבור למסד הנתונים (סוד)')
@secure()
param databaseUrl string

@description('מפתח חתימת עוגיית התחברות (סוד)')
@secure()
param sessionSecret string

@description('פלפל להצפנת קודי OTP (סוד)')
@secure()
param otpPepper string

@description('אזור זמן עסקי (IANA)')
param businessTimezone string = 'Asia/Jerusalem'

@description('ספק הודעות (console כברירת מחדל; whatsapp-cloud לפרודקשן)')
param messagingProvider string = 'console'

@description('WhatsApp Cloud API access token (סוד; ריק אם לא בשימוש)')
@secure()
param whatsAppAccessToken string = ''

@description('תצורת הודעות לא-סודית (זוגות שם/ערך של משתני סביבה, למשל WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OTP_TEMPLATE)')
param messagingConfig object = {}

@description('כתובת בסיס ציבורית של האפליקציה')
param appPublicUrl string

// ---------- Static Web App ----------
@description('האם לפרוס Static Web App')
param deployStaticWebApp bool = true

@description('אזור ל-SWA (נתמך במספר אזורים בלבד)')
param staticWebAppLocation string = 'westeurope'

@description('שכבת SWA')
param staticWebAppSku string = 'Free'

// ---------- PostgreSQL (אופציונלי; כבוי כברירת מחדל) ----------
@description('האם לפרוס Azure PostgreSQL Flexible Server. כבוי כברירת מחדל — התחילו עם מסד חיצוני בשכבת חינם.')
param deployPostgres bool = false

@description('שם משתמש מנהל ל-PostgreSQL')
param postgresAdminLogin string = 'torchickadmin'

@description('סיסמת מנהל ל-PostgreSQL (נדרש רק אם deployPostgres=true)')
@secure()
param postgresAdminPassword string = ''

@description('SKU מחשוב ל-PostgreSQL')
param postgresSkuName string = 'Standard_B1ms'

@description('גודל אחסון ל-PostgreSQL ב-GB')
param postgresStorageGB int = 32

@description('גרסת PostgreSQL')
param postgresVersion string = '16'

// ---------- Log Analytics ----------
@description('ימי שמירת יומנים')
param logAnalyticsRetentionDays int = 30

// ---------- שמות משאבים ----------
var lawName = '${namePrefix}-law-${environmentName}'
var caeName = '${namePrefix}-cae-${environmentName}'
var appName = '${namePrefix}-app-${environmentName}'
var swaName = '${namePrefix}-swa-${environmentName}'
var pgName = '${namePrefix}-pg-${environmentName}'

// ---------- מודולים ----------
module logAnalytics 'modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    name: lawName
    location: location
    retentionInDays: logAnalyticsRetentionDays
    tags: tags
  }
}

module containerEnv 'modules/containerAppsEnvironment.bicep' = {
  name: 'containerAppsEnvironment'
  params: {
    name: caeName
    location: location
    logAnalyticsWorkspaceName: logAnalytics.outputs.name
    tags: tags
  }
}

module containerApp 'modules/containerApp.bicep' = {
  name: 'containerApp'
  params: {
    name: appName
    location: location
    environmentId: containerEnv.outputs.id
    image: containerImage
    targetPort: containerTargetPort
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    cpu: containerCpu
    memory: containerMemory
    registryServer: registryServer
    registryUsername: registryUsername
    registryPasswordToken: registryPasswordToken
    databaseUrl: databaseUrl
    sessionSecret: sessionSecret
    otpPepper: otpPepper
    businessTimezone: businessTimezone
    messagingProvider: messagingProvider
    whatsAppAccessToken: whatsAppAccessToken
    messagingConfig: messagingConfig
    appPublicUrl: appPublicUrl
    tags: tags
  }
}

module staticWebApp 'modules/staticWebApp.bicep' = if (deployStaticWebApp) {
  name: 'staticWebApp'
  params: {
    name: swaName
    location: staticWebAppLocation
    sku: staticWebAppSku
    tags: tags
  }
}

module postgres 'modules/postgresFlexible.bicep' = if (deployPostgres) {
  name: 'postgresFlexible'
  params: {
    name: pgName
    location: location
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    skuName: postgresSkuName
    storageSizeGB: postgresStorageGB
    postgresVersion: postgresVersion
    tags: tags
  }
}

// ---------- פלטים ----------
output containerAppFqdn string = containerApp.outputs.fqdn
output containerAppName string = containerApp.outputs.name
output containerAppsEnvironmentId string = containerEnv.outputs.id
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name
output staticWebAppDefaultHostname string = staticWebApp.?outputs.defaultHostname ?? ''
output staticWebAppName string = staticWebApp.?outputs.name ?? ''
output postgresFqdn string = postgres.?outputs.fqdn ?? ''
output postgresServerName string = postgres.?outputs.serverName ?? ''
