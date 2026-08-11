// Azure Database for PostgreSQL Flexible Server — יעד לטווח ארוך (Burstable B1ms).
// כבוי כברירת מחדל (deployPostgres=false) כדי להתחיל עם מסד חיצוני בשכבת חינם.
// זהו משאב שרץ תמיד ולכן מנוף העלות היחיד. ראו docs/deployment-cost.md.

@description('שם השרת')
param name string

@description('אזור Azure')
param location string

@description('שם משתמש מנהל')
param administratorLogin string

@description('סיסמת מנהל')
@secure()
param administratorLoginPassword string

@description('שם SKU של המחשוב')
param skuName string = 'Standard_B1ms'

@description('שכבת SKU')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param skuTier string = 'Burstable'

@description('גודל אחסון ב-GB')
param storageSizeGB int = 32

@description('גרסת PostgreSQL')
param postgresVersion string = '16'

@description('שם מסד הנתונים שייווצר')
param databaseName string = 'torchick'

@description('ימי שמירת גיבוי')
param backupRetentionDays int = 7

@description('אפשר גישה משירותי Azure (כלל firewall 0.0.0.0)')
param allowAzureServices bool = true

@description('תגיות משאב')
param tags object = {}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pg
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (allowAzureServices) {
  parent: pg
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output fqdn string = pg.properties.fullyQualifiedDomainName
output serverName string = pg.name
output databaseName string = databaseName
