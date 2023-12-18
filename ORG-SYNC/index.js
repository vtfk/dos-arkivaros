(async () => {
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { enterpriseSync } = require('./enterprise-sync')
  const { leaderCheck } = require('./leader-check')
  const { writeFileSync } = require('fs')
  const axios = require('../lib/axios-instance').getAxiosInstance()
  const { MAIL, ORG_SYNC, NODE_ENV } = require('../config')

  // Set up logging
  logConfig({
    prefix: 'ORG-SYNC',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('ORG-SYNC')
  })

  logger('info', ['Boom boom, starting new run'])

  let enterpriseResult
  try {
    enterpriseResult = await enterpriseSync()
    const { correspondingEnterprises, missingEnterprises, updateResult } = enterpriseResult
    logger('info', ['Successfully generated enterpriseResult', 'correspondingEnterprises', correspondingEnterprises.length, 'missingEnterprises', missingEnterprises.length, 'updatedEnterprises', updateResult.length])
  } catch (error) {
    logger('error', ['Failed when running enterprise-sync, shutting down for now', error.response?.data || error.stack || error.toString()])
    process.exit(1)
  }

  // Generer og send en e-post med enterpriseResultatet
  const now = new Date()
  const fancyDate = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`

  const levels = ['Fylkeskommune (0)', 'Fylkesdirektør (1)', 'Sektor (2)', 'Seksjon (3)', 'Team (4)', 'Faggruppe (5)']
  const missingEnterprisesEmailList = enterpriseResult.missingEnterprises.map(unit => {
    const leaderName = unit.leder?.ansattnummer ? unit.leder.navn : 'Ingen leder i HR'
    const overordnet = unit.overordnet.kortnavn ? `${unit.overordnet.navn} (${unit.overordnet.kortnavn})` : `${unit.overordnet.navn} (mangler kortnavn)`
    const level = levels[unit.level]
    return `<li><strong>${unit.navn}</strong> (Trenger oppretting/oppdatering med kortnavn)<ul><li>Kortnavn: ${unit.kortnavn || 'mangler kortnavn'}</li><li>Leder: ${leaderName}</li><li>Morselskap: ${overordnet}</li><li>Orgnivå: ${level}</li></ul></li>`
  })
  const updatedEnterprisesEmailList = enterpriseResult.updateResult.map(enterprise => {
    return `<li><strong>${enterprise.enterpriseName}</strong><ul><li>Kortnavn: ${enterprise.Initials}</li></ul></li>`
  })

  const mailBody = `<h2>P360-${NODE_ENV === 'production' ? 'PROD' : 'TEST'} interne virksomheter som enten mangler eller ikke matcher enhet i HR</h2>
    <i>Dersom en intern virksomhet IKKE skal opprettes / være i P360, send kortnavnet til ansvarlig utvikler - så legger vi virksomheten til i unntakslista</i>
    <br>
    Dersom den interne virksomheten allerede finnes i P360, sleng på det korrekte kortnavnet fra HR, og roboten vil finne match ved neste kjøring 👍
    <ul>
    ${missingEnterprisesEmailList.join('')}
    </ul>
    <br>
    <h2>Virksomheter som roboten oppdaterte med korrekt kortnavn og/eller organisasjonsKode fra HR</h2>
    <i>Disse er bare til info, trengs ikke gjøres noe</i>
    <ul>
    ${updatedEnterprisesEmailList.join('')}
    </ul>
    <br>
    `

  const mailPayload = {
    to: ORG_SYNC.MAIL_RECIPIENTS,
    from: 'noreply@vtfk.no',
    subject: `P360 - ${NODE_ENV === 'production' ? 'PROD' : 'TEST'} - Virksomhetsrapport - ${fancyDate}`,
    template: {
      templateName: ORG_SYNC.MAIL_TEMPLATE,
      templateData: {
        body: mailBody,
        signature: {
          name: 'Arkiveringsroboten',
          title: 'Robot',
          company: 'Robotavdelingen'
        }
      }
    }
  }
  try {
    logger('info', ['Calling mail-api with mapper payload'])
    await axios.post(MAIL.URL, mailPayload, { headers: { 'x-functions-key': MAIL.KEY } })
    logger('info', ['Succesfully called mail-api'])
  } catch (error) {
    logger('error', ['AAAH, failed when sending virksomhetsrapport email, will have to try again next time...', error.response?.data || error.stack || error.toString()])
  }

  let leaderCheckResult
  try {
    leaderCheckResult = await leaderCheck(enterpriseResult.correspondingEnterprises)
    logger('info', ['Successfully generated leaderCheckResult', 'succesfullyCheckedUnits', leaderCheckResult.length])
  } catch (error) {
    logger('error', ['Failed when running leaderCheck, shutting down for now', error.response?.data || error.stack || error.toString()])
    process.exit(1)
  }

  const missingLeaderInArchive = leaderCheckResult.filter(unit => unit.leaderResult.archiveLeaders.length === 0 && unit.leaderResult.fintLeader?.ansattnummer)
  const missingFintLeader = leaderCheckResult.filter(unit => !unit.leaderResult.fintLeader?.ansattnummer)
  const incorrectLeader = leaderCheckResult.filter(unit => unit.leaderResult.archiveLeaders.length > 0 && unit.leaderResult.fintLeader?.ansattnummer && !unit.leaderResult.matchFound)

  const missingLeaderInArchiveEmailList = missingLeaderInArchive.map(result => {
    const { unit, enterprise } = result
    const leaderName = unit.leder?.ansattnummer ? unit.leder.navn : 'Ingen leder i HR'
    const overordnet = unit.overordnet.kortnavn ? `${unit.overordnet.navn} (${unit.overordnet.kortnavn})` : `${unit.overordnet.navn} (mangler kortnavn)`
    const level = levels[unit.level]
    return `<li><strong>${enterprise.Name}</strong> (Mangler direkte leder i P360) <ul><li>Kortnavn: ${unit.kortnavn || 'mangler kortnavn'}</li><li>Leder i HR: ${leaderName}</li><li>Morselskap: ${overordnet}</li><li>Orgnivå: ${level}</li></ul></li>`
  })
  const missingFintLeaderEmailList = missingFintLeader.map(result => {
    const { leaderResult, enterprise } = result
    const archiveLeaderNames = leaderResult.archiveLeaders.length > 0 ? leaderResult.archiveLeaders.map(leader => leader.Name).join(', ') : 'Ingen'
    return `<li><strong>${enterprise.Name}</strong> (Mangler leder i HR)<ul><li>Kortnavn: ${enterprise.Initials}</li><li>Ledere i P360: ${archiveLeaderNames}</li></ul></li>`
  })
  const incorrectLeaderEmailList = incorrectLeader.map(result => {
    const { unit, leaderResult, enterprise } = result
    const archiveLeaderNames = leaderResult.archiveLeaders.length > 0 ? leaderResult.archiveLeaders.map(leader => leader.Name).join(', ') : 'Ingen'
    return `<li><strong>${enterprise.Name}</strong> (Har forskjellig leder fra HR)<ul><li>Kortnavn: ${enterprise.Initials}</li><li>Leder i HR: ${unit.leder.navn}</li><li>Ledere i P360: ${archiveLeaderNames}</li></ul></li>`
  })

  const leaderMailBody = `<h2>P360-${NODE_ENV === 'production' ? 'PROD' : 'TEST'} interne virksomheter som mangler direkte leder</h2>
    <i>Merk at det kan være leder i linje som er korrekt her - sjekk morselskap før det evt opprettes enda en lederprofil på brukeren</i>
    <ul>
    ${missingLeaderInArchiveEmailList.join('')}
    </ul>
    <h2>Organisasjons-enheter som mangler leder i HR</h2>
    <i>Vet ikke helt hva vi gjør med disse.. må vel sjekkes manuelt</i>
    <ul>
    ${missingFintLeaderEmailList.join('')}
    </ul>
    <h2>P360-${NODE_ENV === 'production' ? 'PROD' : 'TEST'} interne virksomheter som mangler korrekt leder</h2>
    <i>Disse bør vel bare sjekkes forsåvidt</i>
    <ul>
    ${incorrectLeaderEmailList.join('')}
    </ul>
    `

  const leaderMailPayload = {
    to: ORG_SYNC.MAIL_RECIPIENTS,
    from: 'noreply@vtfk.no',
    subject: `P360 - ${NODE_ENV === 'production' ? 'PROD' : 'TEST'} - Virksomhets-lederrapport - ${fancyDate}`,
    template: {
      templateName: ORG_SYNC.MAIL_TEMPLATE,
      templateData: {
        body: leaderMailBody,
        signature: {
          name: 'Arkiveringsroboten',
          title: 'Robot',
          company: 'Robotavdelingen'
        }
      }
    }
  }
  try {
    logger('info', ['Calling mail-api with mapper payload'])
    await axios.post(MAIL.URL, leaderMailPayload, { headers: { 'x-functions-key': MAIL.KEY } })
    logger('info', ['Succesfully called mail-api'])
  } catch (error) {
    logger('error', ['AAAH, failed when sending virksomhetsrapport email, will have to try again next time...', error.response?.data || error.stack || error.toString()])
  }
})()
