// @ts-check

(async () => {
  const { getEnterprisesWithLeaders } = require('./get-leaders')
  const { getUnansweredDocuments } = require('./get-unanswered-documents')
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { writeFileSync, existsSync } = require('fs')
  const { PURRE, NODE_ENV } = require('../config')
  const { AxiosError } = require('axios')
  const { reportMailToArchive, purreToSaksbehandler } = require('./emails')


  // Først setter vi opp litt logging
  // Set up logging
  logConfig({
    prefix: 'PURRE',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('PURRE')
  })

  /**
   * 
   * @param {string} msg 
   * @param {*} error 
   */
  const logError = (msg, error) => {
    if (error instanceof AxiosError) {
      logger('error', [msg, error?.response?.data || error.stack || error.toString()])
    } else if (error instanceof Error) {
      logger('error', [msg, error.stack || error.toString()])
    } else {
      logger('error', [msg, 'Unknown error type', error])
    }
  }

  logger('info', ['Boom boom, starting new run'])

  const fromDate = '2024-01-01'
  const toDate = '2025-01-01'

  // Først henter vi lederne
  /** @type {import('./get-leaders').EnterprisesWithLeadersResult} */
  let enterprisesWithLeadersResult
  try {
    if (PURRE.USE_CACHED_RESPONSE && existsSync(`./PURRE-SAKSBEHANDLER/ignore/enterprises-with-leaders-${NODE_ENV}.json`)) {
      logger('info', ['Found existing enterprises with leaders file, using that instead of fetching new'])
      // @ts-ignore
      enterprisesWithLeadersResult = require(`./ignore/enterprises-with-leaders-${NODE_ENV}.json`)
    } else {
      logger('info', ['Fetching leaders and users from archive'])
      enterprisesWithLeadersResult = await getEnterprisesWithLeaders()
    }
    logger('info', [`Got ${Object.keys(enterprisesWithLeadersResult.enterpriseWithLeaders).length} enterprises with leaders from archive`])
  } catch (error) {
    logError('Failed fetching enterprises with leaders, shutting down for now', error)
    process.exit(1)
  }
  if (PURRE.USE_CACHED_RESPONSE) writeFileSync(`./PURRE-SAKSBEHANDLER/ignore/enterprises-with-leaders-${NODE_ENV}.json`, JSON.stringify(enterprisesWithLeadersResult, null, 2))
  // Så henter vi dokumentene
  /** @type {import('./typeshit').ArchiveDocument[]} */
  let unansweredDocuments
  try {
    if (PURRE.USE_CACHED_RESPONSE && existsSync(`./PURRE-SAKSBEHANDLER/ignore/ubesvarte-dokumenter-${NODE_ENV}.json`)) {
      logger('info', ['Found existing unanswered documents file, using that instead of fetching new'])
      // @ts-ignore
      unansweredDocuments = require(`./ignore/ubesvarte-dokumenter-${NODE_ENV}.json`)
    } else {
      logger('info', ['Fetching unanswered documents from archive'])
      unansweredDocuments = await getUnansweredDocuments(fromDate, toDate)
    }
    logger('info', [`Got ${unansweredDocuments.length} unanswered documents from archive`])
  } catch (error) {
    logError('Failed fetching unanswered documents, shutting down for now', error)
    process.exit(1)
  }
  if (PURRE.USE_CACHED_RESPONSE) writeFileSync(`./PURRE-SAKSBEHANDLER/ignore/ubesvarte-dokumenter-${NODE_ENV}.json`, JSON.stringify(unansweredDocuments, null, 2))

  /*
  Hva vil jeg ha?
  - Sorter per ansvar enhet først
  - Deretter per ansvarlig person

  - Hvem skal man sende purre til? (ansvarlig person, eller leder for ansvarlig enhet hvis ansvarlig person mangler) ansvarlig leder skal på kopi også...
    - For hver purre,
    - Hvilke dokumenter gjelder det?

    recno: {
      name: "Ansvarlig Enhet",
      recno: 12345,
      leaders: [ // De som skal på kopi (pass på at det ikke er samme som ansvarligepost da)
        { login: "leder1", contactRecno: 1234 },
        { login: "leder2", contactRecno: 5678 }
      ]
      alerts: {
        "ansvarligepost": { // Den som skal få eposten
          name: "Ansvarlig Navn",
          recno: 12345,
          documents: [
            {
              ...blablabla,
            }
          ]
        }
      }
    }

  */

  /**
   * 
   * @param {import('./typeshit').ArchiveDocument} document 
   * @returns 
   */
  const getResponsibleUnit = (document) => {
    if (!document) throw new Error('Document is required')
    
    if (!document.ResponsibleEnterprise || !document.ResponsibleEnterprise.Recno) {
      throw new Error('Document is missing ResponsibleEnterprise')
    }
    const enterpriseWithLeadersMatch = enterprisesWithLeadersResult.enterpriseWithLeaders[document.ResponsibleEnterprise.Recno]
    return {
      key: document.ResponsibleEnterprise.Recno,
      name: document.ResponsibleEnterprise.Name || 'Unknown Enterprise Name',
      recno: Number(document.ResponsibleEnterprise.Recno),
      leaders: enterpriseWithLeadersMatch?.leaders || [],
      alerts: {}
    }
  }

  /**
   * Constructs the email / alert
   * @param {string} unitName
   * @param {import('./get-leaders').LeaderBase[]} unitLeaders
   * @param {import('./typeshit').ArchiveDocument} document
   */
  const constructAlert = (unitName, unitLeaders, document) => {
    if (!document) throw new Error('Document is required')
    

    /*
    */
    
    const responsiblePersonEmail = document.ResponsiblePerson?.Email || document.ResponsiblePerson?.UserId || 'Mangler ansvarlig person'
    const responsiblePersonUserId = document.ResponsiblePerson?.UserId || 'noResponsiblePersonAtAll'
    const responsibleUser = enterprisesWithLeadersResult.users.find(u => u.Login.toLowerCase() === responsiblePersonUserId.toLowerCase())

    const responsiblePerson = {
      email: responsiblePersonEmail.toLowerCase(),
      userId: responsiblePersonUserId,
      isActive: responsibleUser ? responsibleUser.IsActive : false,
      isInternal: Boolean(responsibleUser && responsiblePersonEmail.toLowerCase().endsWith(PURRE.VALID_EMAIL_SUFFIX)),
      isServiceUser: responsibleUser ? responsibleUser.IsServiceUser : false,
      name: document.ResponsiblePerson?.Name || 'Mangler ansvarlig person',
      recno: document.ResponsiblePerson?.Recno || null,
    }

    // Så finner vi hvem vi faktisk skal sende til
    const emailToResult = {
      emailTo: [],
      sendToLeaders: false,
      sendToArchive: false,
      reason: ''
    }

    // Sjekk om vi må sende til arkiv
    const canSendToResponsiblePerson = responsiblePerson.isActive && responsiblePerson.isInternal && !responsiblePerson.isServiceUser
    const hasLeaders = unitLeaders && unitLeaders.length > 0
    if (!canSendToResponsiblePerson) {
      if (responsiblePerson.userId === 'noResponsiblePersonAtAll') {
        emailToResult.reason = 'Ingen ansvarlig person'
      } else if (!responsiblePerson.isActive) {
        emailToResult.reason = 'Ansvarlig person har ikke aktiv bruker'
      } else if (!responsiblePerson.isInternal) {
        emailToResult.reason = `Ansvarlig person har ikke ${PURRE.VALID_EMAIL_SUFFIX}-epostadresse`
      } else if (responsiblePerson.isServiceUser) {
        emailToResult.reason = 'Ansvarlig person er en servicebruker'
      } else {
        emailToResult.reason = 'Ukjent grunn'
      }
      if (hasLeaders) {
        // Send til ledere
        // @ts-ignore
        emailToResult.emailTo = unitLeaders.map(l => l.login)
        emailToResult.reason += `, sender til leder(e) for ${unitName} i stedet`
        emailToResult.sendToLeaders = true
      } else {
        // Send til arkiv
        // @ts-ignore
        emailToResult.emailTo = [PURRE.ARCHIVE_EMAIL]
        emailToResult.reason += `, ingen ledere funnet for ${unitName}, sender til arkiv i stedet`
        emailToResult.sendToArchive = true
      }
    } else {
      // Send til ansvarlig person
      // @ts-ignore
      emailToResult.emailTo = [responsiblePerson.email]
      emailToResult.reason = ''
    }

    return {
      key: emailToResult.sendToLeaders ? 'ledere' : responsiblePerson.email,
      ...emailToResult,
      responsiblePerson,
      emailStatus: {
        code: 'notSent',
        message: 'Not sent yet'
      },
      documents: []
    }
  }

  /** @type {import('./typeshit').UnansweredDocumentsReport} */
  const unansweredDocumentsReport = {
    fromDate,
    toDate,
    totalDocuments: unansweredDocuments.length,
    enterprises: {}
  }
  
  // Så matcher vi dokumentene med ansvarlig enhet, og deretter ansvarlig person (eller mottaker dersom det er internt notat med oppfølging)
  for (const document of unansweredDocuments) {
    const responsibleUnit = getResponsibleUnit(document)
    if (!unansweredDocumentsReport.enterprises[responsibleUnit.key]) {
      unansweredDocumentsReport.enterprises[responsibleUnit.key] = responsibleUnit
    }
    // Da er unit på plass (og vi kan tilogmed bruke responsibleUnit, siden den er referert til i documentResponsibleMatch)
    const alertData = constructAlert(responsibleUnit.name, responsibleUnit.leaders, document)
    if (!unansweredDocumentsReport.enterprises[responsibleUnit.key].alerts[alertData.key]) {
      unansweredDocumentsReport.enterprises[responsibleUnit.key].alerts[alertData.key] = alertData
    }
    // Så slenger vi på dokumentet det gjelder også
    unansweredDocumentsReport.enterprises[responsibleUnit.key].alerts[alertData.key].documents.push(document)
  }

  writeFileSync('./PURRE-SAKSBEHANDLER/ignore/document-leader-match.json', JSON.stringify(unansweredDocumentsReport, null, 2))

  let sendToArchive = 0
  let sendToLeaders = 0
  let sendToResponsiblePerson = 0
  // Så mekker vi opp rapporter og eposter og sender shaiten
  for (const [enterpriseRecno, enterpriseData] of Object.entries(unansweredDocumentsReport.enterprises)) {
    for (const [emailAddress, alertData] of Object.entries(enterpriseData.alerts)) {
      // Her kan vi bruke emailAddress og alertData til å lage rapporter og sende eposter
      // bare send i vei
      if (alertData.sendToArchive) sendToArchive += 1
      else if (alertData.sendToLeaders) sendToLeaders += 1
      else sendToResponsiblePerson += 1
      const purreMail = purreToSaksbehandler(alertData)
      writeFileSync(`./PURRE-SAKSBEHANDLER/ignore/purre-to-${emailAddress.replaceAll('@', '-at-').replaceAll('.', '-')}.html`, purreMail)
      break
    }
    break
  }

  console.log(`Emails to send to archive (no responsible person or leader found): ${sendToArchive}`)
  console.log(`Emails to send to leaders (no responsible person, but leaders found): ${sendToLeaders}`)
  console.log(`Emails to send to responsible person: ${sendToResponsiblePerson}`)

  const balls = reportMailToArchive(unansweredDocumentsReport)
  writeFileSync('./PURRE-SAKSBEHANDLER/ignore/report-to-archive.html', balls)
})()