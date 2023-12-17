require('dotenv').config()
const { existsSync, readFileSync, writeFileSync } = require('fs')

if (!existsSync('./ignore-units.txt')) writeFileSync('./ignore-units.txt', 'Legg til kortnavn eller organisasjonskode som skal ignoreres her, separeres med newline')
if (!existsSync('./ignore-unit-leaders.txt')) writeFileSync('./ignore-unit-leaders.txt', 'Legg til kortnavn eller organisasjonskode som skal ignoreres her, separeres med newline')
const IGNORE_UNITS = readFileSync('./ignore-units.txt').toString().replaceAll('\r', '').split('\n')
const IGNORE_UNIT_LEADERS = readFileSync('./ignore-unit-leaders.txt').toString().replaceAll('\r', '').split('\n')

module.exports = {
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
    EMAILS: (process.env.ORG_SYNC_EMAILS && (process.env.ORG_SYNC_EMAILS.split(','))) || [],
    IGNORE_UNITS,
    IGNORE_UNIT_LEADERS
  },
  TEAMS_STATUS_WEBHOOK_URLS: (process.env.TEAMS_STATUS_WEBHOOK_URLS && (process.env.TEAMS_STATUS_WEBHOOK_URLS.split(','))) || []
}
