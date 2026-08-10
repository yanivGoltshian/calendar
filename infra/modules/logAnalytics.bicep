// Log Analytics workspace — נדרש עבור סביבת Container Apps (יומני אפליקציה).
// עלות: נשאר בתוך מכסת החינם (5GB לחודש). מכסה יומית נמוכה מגינה מפני חריגה.

@description('שם ה-workspace')
param name string

@description('אזור Azure')
param location string

@description('ימי שמירת יומנים')
param retentionInDays int = 30

@description('מכסת קליטה יומית ב-GB (הגנת עלות). ‎-1 לביטול המכסה.')
param dailyQuotaGb string = '0.5'

@description('תגיות משאב')
param tags object = {}

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: json(dailyQuotaGb)
    }
  }
}

output id string = law.id
output name string = law.name
