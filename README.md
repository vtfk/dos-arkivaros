# dos-arkivaros
En samling script som gjør ulike praktiske arkiv-jobber (send to arkivarer for handling)

# Scripts
## ORG-SYNC
```bash
node ./ORG-SYNC/index.js
```
Script for å vedlikeholde at org-struktur i P360 matcher ORG-struktur i HR

Sørger for at p360 interne virksomheter har korrekt kortkode, og ExternalID lik organisasjonsKode fra FINT

[Mer informasjon](./ORG-SYNC/README.md)

## PURRE-SAKSBEHANDLER
```bash
node ./PURRE-SAKSBEHANDLER/index.js
```
Script for å sende ut purre-mail om ubesvarte og reserverte til P360-brukere og ledere

[Mer informasjon](./PURRE-SAKSBEHANDLER/README.md)

# Setup
Lag deg en .env fil med følgende verdier (du skjønner hvilke du trenger for hvilket script ved å se på prefix...)

```bash
AZURE_CLIENT_ID="app reg for dette repoet"
AZURE_TENANT_ID="app reg for dette repoet"
AZURE_CLIENT_SECRET="app reg for dette repoet"
ARCHIVE_URL="url til azf-archive-v2"
ARCHIVE_SCOPE="scope for azf-archive-v2"
FINTFOLK_URL="url til azf-fintfolk api"
FINTFOLK_SCOPE="scope for azf-fintfolk-api"
MAIL_URL="url til mail api"
MAIL_KEY="nøkkel for mail api"
STATS_URL="url til stats-api"
STATS_KEY="nøkkel til stats-api"
ORG_SYNC_MAIL_RECIPIENTS="hvem skal få org-sync rapport på epost (kommaseparert)"
ORG_SYNC_MAIL_BCCS="hvem skal få org-sync rapport på epost som blind carbon copy (kommaseparert)"
ORG_SYNC_MAIL_SENDER="hvem sender orgrapporten"
ORG_SYNC_MAIL_TEMPLATE="hvilken epost template"
PURRE_USE_CACHED_RESPONSE="true" # bare hvis du tester
PURRE_LOCATOR_BASE_URL="base url til 360 frontend"
PURRE_MAIL_SENDER="avsender-adresse på epostene"
PURRE_MAIL_TEMPLATE="template (fra mail api) for epostene"
PURRE_TEST_MAIL_RECEIVER="en mailadresse" # bare hvis du tester, og ikke vil at mail skal gå ut til noen andre enn denne eposten
PURRE_IGNORE_LOGINS="comma separated list of usernames (login property) which doesnt need warning if contact doesnt exist (typically system users)"
NODE_ENV="dev || test || production"
```