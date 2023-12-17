const { logger } = require('@vtfk/logger')
const { callFintfolk } = require('../lib/call-fintfolk')
const { callArchive } = require('../lib/call-archive')
const { writeFileSync } = require('fs')
const { ORG_SYNC } = require('../config')
const { getCorrespondingEnterprise } = require('./get-corresponding-enterprise')

/*
- Henter hele orgstruktur fra FINT
- Henter alle interne virksomheter fra P360
- For hver enhet fra FINT
  - Sjekk om vi har tilsvarende enhet i P360
    - Basert på ExternalID
    - Basert på Kortnavn
    - Basert på displayName
      - Dersom flere enheter funnet på navnet - legg til i liste over ikke-entydig match
  - Om det ikke finnes tilsvarende enhet - legg til i liste over manglende enheter
  - Om vi har tilsvarende enhet - sjekk om externId og kortnavn er korrekt, om ikke oppdater
    - Legg til både FINT-enhet og virksomhet i en resultatliste
    - Legg til status på hva roboten har gjort (kortnavn externalID, evt navn?)
*/

const enterpriseSync = async () => {
  logger('info', ['Fetching organization from FINTFOLK'])
  const fintOrganization = await callFintfolk('organization/flat')
  logger('info', ['Got organization from FINTFOLK'])

  logger('info', ['Fetching internal enterprises from archive'])
  const enterprisePayload = {
    service: 'ContactService',
    method: 'GetEnterprises',
    parameter: {
      Active: true,
      Categories: ['Intern']
    }
  }
  const archiveInternalEnterprises = await callArchive('archive', enterprisePayload)
  logger('info', ['Got internal enterprises from archive'])

  writeFileSync('./ignore/fintOrganization.json', JSON.stringify(fintOrganization, null, 2))
  writeFileSync('./ignore/archiveInternalEnterprises.json', JSON.stringify(archiveInternalEnterprises, null, 2))

  const result = {
    correspondingEnterprises: [],
    missingEnterprises: [],
    updateResult: [],
    checkLeader: []
  }

  for (const unit of fintOrganization) {
    if (ORG_SYNC.IGNORE_UNITS.includes(unit.kortnavn) || ORG_SYNC.IGNORE_UNITS.includes(unit.organisasjonsKode)) {
      logger('info', [`${unit.navn} - ${unit.kortnavn} - is present in IGNORE_UNITS, skipping`])
      continue
    }
    logger('info', [unit.navn, unit.organisasjonsKode, 'Handling unit'])
    const { enterprise, foundBy } = getCorrespondingEnterprise(unit, archiveInternalEnterprises)
    if (!enterprise) {
      result.missingEnterprises.push(unit)
      logger('info', [unit.navn, unit.organisasjonsKode, 'No corresponding enterprise found, adding to missingEnterprises'])
      continue
    }
    logger('info', [unit.navn, unit.organisasjonsKode, `Corresponding enterprise found by match on "${foundBy}", checking if needs update`])

    let needsUpdate = false
    if (enterprise.ExternalID !== unit.organisasjonsKode) needsUpdate = true
    else if (enterprise.Initials !== unit.kortnavn) needsUpdate = true

    if (needsUpdate) {
      logger('info', [unit.navn, unit.organisasjonsKode, 'Corresponding enterprise did not match FINT unit, updating with correct Initials and ExternalID'])
      // Update the stuff (keep the name - let archive decide)
      result.updateResult.push({ enterpriseName: enterprise.Name, Initials: unit.kortnavn, ExternalID: unit.organisasjonsKode }) // Send rapport på hvilke enheter som er oppdatert
    }
    result.correspondingEnterprises.push({ enterprise, unit })
  }
  return result
}

module.exports = { enterpriseSync }
