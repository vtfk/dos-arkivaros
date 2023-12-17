const { logger } = require('@vtfk/logger')
const { callArchive } = require('../lib/call-archive')
const { ORG_SYNC } = require('../config')

/*
- Henter alle users fra P360
- For hver enhet/virksomhet fra resultatlista
  - Sjekk at det finnes en bruker som har rollen "leder" (role: 3) for enterprisen sitt recno. Sjekk også om user sin contactRecno har samme navn som lederen for enheten i FINT

*/

const leaderCheck = async (unitsToCheck) => {
  logger('info', ['Fetching users from archive'])
  const enterprisePayload = {
    service: 'UserService',
    method: 'GetUsers',
    parameter: {}
  }
  const archiveUsers = await callArchive('archive', enterprisePayload)
  const archiveLeaderUsers = archiveUsers.filter(user => user.IsActive && user.Profiles.some(profile => profile.Role === '3')) // Active user and Profile with Role 3 (Leader)
  const archiveLeaders = archiveLeaderUsers.map(user => {
    const LeaderForEnterpriseRecnos = user.Profiles.filter(profile => profile.Role === '3').map(profile => profile.EnterpriseRecno)
    return {
      Login: user.Login,
      ContactRecno: user.ContactRecno,
      LeaderForEnterpriseRecnos
    }
  })
  logger('info', [`Got ${archiveLeaders.length} users with leader role from archive`])

  const leaderCheckResult = []

  for (const unitToCheck of unitsToCheck) {
    const { unit, enterprise } = unitToCheck
    const leaderResult = {
      fintLeader: null,
      archiveLeaders: null,
      archiveLeaderNames: [],
      matchFound: false
    }

    if (ORG_SYNC.IGNORE_UNIT_LEADERS.includes(unit.kortnavn) || ORG_SYNC.IGNORE_UNITS.includes(unit.organisasjonsKode)) {
      logger('info', [`${unit.navn} - ${unit.kortnavn} - is present in IGNORE_UNIT_LEADERS, skipping`])
      continue
    }

    if (unit.leder.ansattnummer) {
      leaderResult.fintLeader = unit.leder
    } else {
      logger('info', [`${unit.navn} - ${unit.kortnavn} - does not have leader in FINT`])
    }

    leaderResult.archiveLeaders = archiveLeaders.filter(leader => leader.LeaderForEnterpriseRecnos.includes(enterprise.Recno.toString()))

    logger('info', [`${unit.navn} - ${unit.kortnavn} - found ${leaderResult.archiveLeaders.length} leaders for unit in archive, checking leader-names`])
    try {
      for (const leader of leaderResult.archiveLeaders) {
        logger('info', [`${unit.navn} - ${unit.kortnavn} - Fetching ContactPerson from archive - Recno ${leader.Recno}`])
        const leaderPayload = {
          service: 'ContactService',
          method: 'GetContactPersons',
          parameter: {
            Recno: leader.ContactRecno
          }
        }
        const archiveLeaderResult = await callArchive('archive', leaderPayload)
        logger('info', [`${unit.navn} - ${unit.kortnavn} - Got ${archiveLeaders.length} contactPersons with Recno "${leader.Recno}" from archive`])
        const archiveLeader = archiveLeaderResult[0]
        leader.FirstName = archiveLeader.FirstName
        leader.LastName = archiveLeader.LastName
        leader.Name = `${archiveLeader.FirstName} ${archiveLeader.LastName}`
      }
    } catch (error) {
      logger('error', [`${unit.navn} - ${unit.kortnavn} - Failed when getting archiveLeader names from archive - will have to try again next run... Skipping unit for now`, error.response?.data || error.stack || error.toString()])
      continue
    }

    logger('info', [`${unit.navn} - ${unit.kortnavn} - Found ${leaderResult.archiveLeaderNames.length} archive leader names for unit, checking against fint unit leader name`])
    for (const archiveLeader of leaderResult.archiveLeaders) {
      logger('info', [`${unit.navn} - ${unit.kortnavn} - Checking archiveLeaderName "${archiveLeader.Name}" against FINT leader name "${unit.leder.navn}"`])
      if (archiveLeader.Name === unit.leder.navn) leaderResult.matchFound = true
      logger('info', [`${unit.navn} - ${unit.kortnavn} - Found match on archiveLeaderName "${archiveLeader.Name}" against FINT leader name "${unit.leder.navn}", NICE!`])
    }

    leaderCheckResult.push({
      leaderResult,
      unit,
      enterprise
    })
  }
  return leaderCheckResult
}

module.exports = { leaderCheck }
