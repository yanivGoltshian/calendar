// Azure Static Web Apps (Free) — אירוח תוכן סטטי שיווקי, SSL חינם, דומיין מותאם, CDN גלובלי.
// עלות: אפס בשכבת Free. חיבור מאגר/פריסה מתבצע בנפרד (טוקן פריסה או GitHub Action).

@description('שם ה-Static Web App')
param name string

@description('אזור Azure (SWA נתמך במספר אזורים בלבד, למשל westeurope, eastus2)')
param location string = 'westeurope'

@description('שכבת תמחור')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Free'

@description('תגיות משאב')
param tags object = {}

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // פריסה ידנית/CLI; אינטגרציית מאגר תוגדר בשלב הפריסה המאושרת.
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

output defaultHostname string = swa.properties.defaultHostname
output name string = swa.name
