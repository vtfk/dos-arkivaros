require('dotenv').config()
const { existsSync, readFileSync, writeFileSync } = require('fs')

if (!existsSync('./ORG-SYNC/ignore-units.txt')) writeFileSync('./ORG-SYNC/ignore-units.txt', 'Legg til kortnavn eller organisasjonskode som skal ignoreres her, separeres med newline')
if (!existsSync('./ORG-SYNC/ignore-unit-leaders.txt')) writeFileSync('./ORG-SYNC/ignore-unit-leaders.txt', 'Legg til kortnavn eller organisasjonskode som skal ignoreres her, separeres med newline')
const IGNORE_UNITS = readFileSync('./ORG-SYNC/ignore-units.txt').toString().replaceAll('\r', '').split('\n').filter(ele => ele && ele !== '' && ele.length > 1)
const IGNORE_UNIT_LEADERS = readFileSync('./ORG-SYNC/ignore-unit-leaders.txt').toString().replaceAll('\r', '').split('\n').filter(ele => ele && ele !== '' && ele.length > 1)

// Check if required environment variables are set
const requiredEnvVars = [
  'AZURE_CLIENT_ID', // Autmomatically used by AzureIdentity SDK
  'AZURE_TENANT_ID', // Autmomatically used by AzureIdentity SDK
  'AZURE_CLIENT_SECRET', // Autmomatically used by AzureIdentity SDK
  'ARCHIVE_URL',
  'ARCHIVE_SCOPE'
]

const missingEnvVars = []
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar)
  }
}

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}. See README.md for more information.`)
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'dev',
  APPREG: {
    CLIENT_ID: process.env.APPREG_CLIENT_ID,
    CLIENT_SECRET: process.env.APPREG_CLIENT_SECRET,
    TENANT_ID: process.env.APPREG_TENANT_ID
  },
  ARCHIVE: {
    URL: process.env.ARCHIVE_URL,
    SCOPE: process.env.ARCHIVE_SCOPE
  },
  FINTFOLK: {
    URL: process.env.FINTFOLK_URL,
    SCOPE: process.env.FINTFOLK_SCOPE
  },
  STATS: {
    URL: process.env.STATS_URL,
    KEY: process.env.STATS_KEY
  },
  MAIL: {
    URL: process.env.MAIL_URL,
    KEY: process.env.MAIL_KEY
  },
  ORG_SYNC: {
    MAIL_RECIPIENTS: (process.env.ORG_SYNC_MAIL_RECIPIENTS && (process.env.ORG_SYNC_MAIL_RECIPIENTS.split(','))),
    MAIL_SENDER: process.env.ORG_SYNC_MAIL_SENDER,
    MAIL_BCCS: (process.env.ORG_SYNC_MAIL_BCCS && (process.env.ORG_SYNC_MAIL_BCCS.split(','))) || null,
    MAIL_TEMPLATE: process.env.ORG_SYNC_MAIL_TEMPLATE,
    IGNORE_UNITS,
    IGNORE_UNIT_LEADERS
  },
  PURRE: {
    VALID_EMAIL_SUFFIX: process.env.PURRE_VALID_EMAIL_SUFFIX || '@vestfoldfylke.no',
    USE_CACHED_RESPONSE: process.env.PURRE_USE_CACHED_RESPONSE === 'true' || false,
    ARCHIVE_EMAIL: process.env.PURRE_ARCHIVE_EMAIL || 'arkiv@fylke.no',
    LOCATOR_BASE_URL: process.env.PURRE_LOCATOR_BASE_URL || 'https://haha-glemt-i-env.public360online.com',
    MAIL_SENDER: process.env.PURRE_MAIL_SENDER || 'noreply@fylke.no',
    MAIL_TEMPLATE: process.env.PURRE_MAIL_TEMPLATE || 'default-template',
    TEST_MAIL_RECEIVER: process.env.PURRE_TEST_MAIL_RECEIVER,
    IGNORE_LOGINS: (process.env.PURRE_IGNORE_LOGINS && (process.env.PURRE_IGNORE_LOGINS.split(','))) || [],
    REPORT_BCCS: (process.env.PURRE_REPORT_BCCS && (process.env.PURRE_REPORT_BCCS.split(','))) || []
  },
  TEAMS_STATUS_WEBHOOK_URLS: (process.env.TEAMS_STATUS_WEBHOOK_URLS && (process.env.TEAMS_STATUS_WEBHOOK_URLS.split(','))) || []
}
