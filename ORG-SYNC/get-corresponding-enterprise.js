const { logger } = require('@vtfk/logger')

const stripEnterpriseName = (name) => {
  let strippedName = name.toLowerCase()
  strippedName = strippedName.replace('seksjon ', '')
  strippedName = strippedName.replace('sektor ', '')
  strippedName = strippedName.replace('team ', '')
  strippedName = strippedName.replace('stabsavdeling ', '')
  return strippedName
}

const superStripEnterpriseName = (name) => {
  let strippedName = stripEnterpriseName(name)
  strippedName = strippedName.replace('-', '')
  strippedName = strippedName.replaceAll(' ', '')
  return strippedName
}

const getEnterpriseByName = (unit, archiveInternalEnterprises) => {
  const exactMatch = archiveInternalEnterprises.filter(enterprise => enterprise.Name.toLowerCase() === unit.navn.toLowerCase())
  if (exactMatch.length === 1) return exactMatch[0]
  logger('info', [`Could not find exact match for name "${unit.navn}", trying with strippedname`])
  const strippedMatch = archiveInternalEnterprises.filter(enterprise => stripEnterpriseName(enterprise.Name) === unit.navn.toLowerCase())
  if (strippedMatch.length === 1) return strippedMatch[0]
  logger('info', [`Could not find stripped match for name "${unit.navn}" heller... trying with SUPER stripped name`])
  const superStrippedMatch = archiveInternalEnterprises.filter(enterprise => superStripEnterpriseName(enterprise.Name) === superStripEnterpriseName(unit.navn))
  if (superStrippedMatch.length === 1) return strippedMatch[0]
  logger('info', [`Could not find stripped match for name "${unit.navn}" heller heller... returning undefined...`])
  return undefined
}

const getCorrespondingEnterprise = (unit, archiveInternalEnterprises) => {
  logger('info', [unit.navn, unit.organisasjonsKode, 'Looking for corresponding enterprise in archive by ExternalID'])
  let correspondingEnterprise = archiveInternalEnterprises.find(enterprise => enterprise.ExternalID === unit.organisasjonsKode)
  if (correspondingEnterprise) {
    logger('info', [unit.navn, unit.organisasjonsKode, 'Found corresponding enterprise in archive by ExternalID'])
    return {
      enterprise: correspondingEnterprise,
      foundBy: 'ExternalID'
    }
  }

  logger('info', [unit.navn, unit.organisasjonsKode, 'Could not find corresponding enterprise in archive by ExternalID, trying with Initials'])
  correspondingEnterprise = archiveInternalEnterprises.find(enterprise => enterprise.Initials === unit.kortnavn)
  if (correspondingEnterprise) {
    logger('info', [unit.navn, unit.organisasjonsKode, 'Found corresponding enterprise in archive by Initials'])
    return {
      enterprise: correspondingEnterprise,
      foundBy: 'Initials'
    }
  }

  logger('info', [unit.navn, unit.organisasjonsKode, 'Could not find corresponding enterprise in archive by Initials, trying with Name'])
  correspondingEnterprise = getEnterpriseByName(unit, archiveInternalEnterprises)
  if (correspondingEnterprise) {
    logger('info', [unit.navn, unit.organisasjonsKode, 'Found corresponding enterprise in archive by Name'])
    return {
      enterprise: correspondingEnterprise,
      foundBy: 'Name'
    }
  }
  logger('info', [unit.navn, unit.organisasjonsKode, 'Could not find corresponding enterprise in archive by Name returning disappointing object'])
  return {
    enterprise: null,
    foundBy: 'not found at all, aiai'
  }
}

module.exports = { getCorrespondingEnterprise }
