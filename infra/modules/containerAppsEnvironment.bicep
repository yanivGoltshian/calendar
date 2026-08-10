// סביבת Azure Container Apps (Consumption). הסביבה עצמה אינה מחויבת;
// החיוב הוא רק על רפליקות שרצות. עם scale-to-zero העלות במנוחה היא אפס.

@description('שם הסביבה המנוהלת')
param name string

@description('אזור Azure')
param location string

@description('שם workspace של Log Analytics (קיים באותה קבוצת משאבים)')
param logAnalyticsWorkspaceName string

@description('תגיות משאב')
param tags object = {}

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

output id string = env.id
output name string = env.name
output defaultDomain string = env.properties.defaultDomain
