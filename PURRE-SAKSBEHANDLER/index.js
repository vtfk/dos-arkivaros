// @ts-check

(async () => {
  const { getEnterprisesWithLeaders } = require('./get-leaders')
  const { getUnansweredDocuments } = require('./get-unanswered-documents')
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { writeFileSync, existsSync } = require('fs')
  const { PURRE, NODE_ENV } = require('../config')
  const { AxiosError, get } = require('axios')
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

  /**
   * @typedef {Object} PurreResponsibleEnterprise
   * @property {string | number} key
   * @property {string | number} recno
   * @property {string} name
   * @property {import('./get-leaders').LeaderBase[]} leaders
   * @property {Object} alerts
   */

  /**
   *
   * @param {string | number} enterpriseRecno
   * @param {string} name
   * @returns {PurreResponsibleEnterprise}
   */
  const getResponsibleEnterprise = (enterpriseRecno, name) => {
    if (!enterpriseRecno) throw new Error('EnterpriseRecno is required')
    if (isNaN(Number(enterpriseRecno))) throw new Error('EnterpriseRecno must be a number or numeric string')

    const enterpriseWithLeadersMatch = enterprisesWithLeadersResult.enterpriseWithLeaders[enterpriseRecno.toString()]
    
    return {
      key: enterpriseRecno,
      name: name || 'Ukjent virksomhet',
      recno: Number(enterpriseRecno),
      leaders: enterpriseWithLeadersMatch?.leaders || [],
      alerts: {}
    }
  }

  /**
   * @typedef {Object} GetUserResult
   * @property {import('./typeshit').ArchiveUser | undefined} user
   * @property {?string} email
   * @property {?string} name
   * @property {boolean} canSend
   * @property {string} reason
   */

  /**
   *
   * @param {string | number} loginOrContactRecno
   * @param {?string} email
   * @param {?string} name
   * @returns {GetUserResult}
   */
  const getUser = (loginOrContactRecno, email, name) => {
    if (!loginOrContactRecno) throw new Error('loginOrContactRecno is required')
    if (!email) throw new Error('email is required')
    const searchParam = loginOrContactRecno.toString().toLowerCase()
    const user = enterprisesWithLeadersResult.users.find(u => u.Login.toLowerCase() === searchParam || u.ContactRecno.toString() === searchParam)
    // Ugly override - sometimes users in contact array on documents have outdated email, so we prefer login if it is valid
    email = user?.Login && user.Login.endsWith(PURRE.VALID_EMAIL_SUFFIX) ? user.Login : email
    const result = {
      user,
      email,
      name,
      canSend: false,
      reason: ''
    }
    if (!user) {
      result.reason = `Fant ingen bruker med id ${loginOrContactRecno}`
      return result
    }
    if (!user.IsActive) {
      result.reason = `Bruker ${email} (${loginOrContactRecno}) er ikke aktiv`
      return result
    }
    const isInternal = email && email.toLowerCase().endsWith(PURRE.VALID_EMAIL_SUFFIX)
    if (!isInternal) {
      result.reason = `Bruker ${email} (${loginOrContactRecno}) har ikke gyldig epostadresse (${PURRE.VALID_EMAIL_SUFFIX})`
      return result
    }
    if (user.IsServiceUser) {
      result.reason = `Bruker ${email} (${loginOrContactRecno}) er en servicebruker`
      return result
    }
    if (!email) {
      result.reason = `Bruker ${loginOrContactRecno} har ikke epostadresse??`
      return result
    }
    if (!name) {
      result.reason = `Bruker ${loginOrContactRecno} har ikke navn??`
      return result
    }
    result.canSend = true
    return result
  }

  /**
   * Just internal helper shait
   * @typedef {Object} AlertDataInput
   * @property {PurreResponsibleEnterprise} responsibleEnterprise
   * @property {boolean} [sendToArchive]
   * @property {boolean} [sendToLeaders]
   * @property {GetUserResult} [responsibleForFollowUp]
   * @property {import('./typeshit').DocumentResults} documentResult
   */

  /**
   * Just internal helper shit
   * @typedef {Object} AlertData
   * @property {string | number} enterpriseKey
   * @property {PurreResponsibleEnterprise} responsibleEnterprise
   * @property {string} responsibleKey
   * @property {import('./typeshit').EmailToResult} emailToResult
   * @property {?GetUserResult} responsibleForFollowUp
   * @property {import('./typeshit').DocumentResults} documentResult
   */

  /**
   *
   * @param {AlertDataInput} alertData
   * @returns {AlertData}
   */
  const createDocumentAlert = (alertData) => {
    if (!alertData) throw new Error('alertData is required')
    if (!alertData.responsibleEnterprise) throw new Error('alertData.responsibleEnterprise is required')
    if (!alertData.documentResult) throw new Error('alertData.documentResult is required')

    if (alertData.sendToLeaders && alertData.responsibleEnterprise.leaders.length === 0) {
      throw new Error('Cannot send to leaders if there are no leaders, check your code')
    }
    if (alertData.sendToArchive && alertData.sendToLeaders) {
      throw new Error('Cannot send to both archive and leaders, check your code')
    }
    if (!alertData.sendToArchive && !alertData.sendToLeaders && !alertData.responsibleForFollowUp) {
      throw new Error('Cannot send to nobody, check your code')
    }
    if (alertData.responsibleForFollowUp && !alertData.responsibleForFollowUp.canSend) {
      throw new Error('Cannot send to responsibleForFollowUp if they cannot receive, check your code')
    }
    const documentAlert = {
      enterpriseKey: alertData.responsibleEnterprise.key,
      responsibleEnterprise: alertData.responsibleEnterprise,
      responsibleKey: '',
      emailToResult: {
        emailTo: ['bubu'],
        sendToLeaders: alertData.sendToLeaders || false,
        sendToArchive: alertData.sendToArchive || false
      },
      responsibleForFollowUp: alertData.responsibleForFollowUp || null,
      documentResult: alertData.documentResult
    }
    if (alertData.sendToArchive) {
      documentAlert.responsibleKey = 'archive'
      documentAlert.emailToResult.emailTo = [PURRE.ARCHIVE_EMAIL]
      return documentAlert
    }
    if (alertData.sendToLeaders) {
      documentAlert.responsibleKey = 'ledere'
      documentAlert.emailToResult.emailTo = alertData.responsibleEnterprise.leaders.map(l => l.login)
      return documentAlert
    }
    if (alertData.responsibleForFollowUp) {
      if (!alertData.responsibleForFollowUp.email) {
        throw new Error('responsibleForFollowUp must have email if we are to send to them, check your code')
      }
      documentAlert.responsibleKey = alertData.responsibleForFollowUp.email
      documentAlert.emailToResult.emailTo = [alertData.responsibleForFollowUp.email]
      return documentAlert
    }
    throw new Error('This should never happen, check your code')
  }

  /**
   * Constructs the email / alert
   * @param {import('./typeshit').ArchiveDocument} document
   */
  const constructDocumentAlert = (document) => {
    if (!document) throw new Error('Document is required')
        
    // Sett responsible enterprise (merk at den kan overrides dersom det er internal note)
    const unitName = document.ResponsibleEnterprise?.Name || 'Ukjent virksomhet'
    const unitRecno = document.ResponsibleEnterprise?.Recno || 'noEnterpriseRecno'
    const documentResponsibleUnit = getResponsibleEnterprise(unitRecno, unitName)

    const isInternalNoteWithFollowUp = document.Category?.Code === 'Internt notat med oppfølging'
    if (isInternalNoteWithFollowUp) {
      const recipient = document.Contacts.find(contact => contact.Role === 'Mottaker')
      if (recipient?.ContactType === 'Kontaktperson' && recipient?.ContactRecno) { // Her ønsker vi å bruke kontaktperson som mottaker, sjekk at vi kan
        const userResult = getUser(recipient.ContactRecno, recipient.Email, recipient.SearchName)
        if (userResult.canSend) {
          // Bruk mottaker og vi er fornøyd
          return createDocumentAlert({
            responsibleEnterprise: documentResponsibleUnit,
            responsibleForFollowUp: userResult,
            documentResult: {
              document,
              reason: {
                code: 'INTERNAL_NOTE_RECIPIENT',
                reportDescription: `${userResult.name} er mottaker for internt notat med oppfølging.`,
                purreDescription: 'Du står som mottaker på internt notat med oppfølging.',
                level: 'INFO'
              }
            }
          })
        }
        // Hvis ikke vi kan sende, så sender vi til arkiv i stedet med en begrunnelse på selve dokumentet
        return createDocumentAlert({
          responsibleEnterprise: documentResponsibleUnit,
          sendToArchive: true,
          documentResult: {
            document,
            reason: {
              code: 'INTERNAL_NOTE_RECIPIENT_INVALID',
              reportDescription: `Mottaker for internt notat kan ikke brukes: ${userResult.reason}. Må håndteres av arkiv`,
              purreDescription: `Mottaker for internt notat kan ikke brukes: ${userResult.reason}.`,
              level: 'WARNING'
            }
          }
        })
      } else if (recipient?.ContactType === 'Virksomhet' && recipient?.ContactRecno && recipient.SearchName) { // Her ønsker vi å bruke virksomhet som mottaker, sjekk at vi kan
        const recipientResponsibleEnterprise = getResponsibleEnterprise(recipient.ContactRecno, recipient.SearchName)
        // Hvis vi har noen ledere, så kan vi sende til de
        if (recipientResponsibleEnterprise.leaders.length > 0) {
          return createDocumentAlert({
            responsibleEnterprise: recipientResponsibleEnterprise,
            sendToLeaders: true,
            documentResult: {
              document,
              reason: {
                code: 'INTERNAL_NOTE_ENTERPRISE_RECIPIENT',
                reportDescription: `${recipientResponsibleEnterprise.name} er mottaker for internt notat med oppfølging. Sender til leder(e) for denne virksomheten.`,
                purreDescription: `${recipientResponsibleEnterprise.name} står som mottaker på internt notat med oppfølging.`,
                level: 'INFO'
              }
            }
          })
        }
        // Hvis ikke sier vi fra til arkiv at mottaker ikke kunne brukes
        return createDocumentAlert({
          responsibleEnterprise: documentResponsibleUnit,
          sendToArchive: true,
          documentResult: {
            document,
            reason: {
              code: 'INTERNAL_NOTE_ENTERPRISE_RECIPIENT_INVALID',
              reportDescription: `Ingen ledere funnet for virksomhet ${recipientResponsibleEnterprise.name} satt som mottaker`,
              purreDescription: `Ingen ledere funnet for virksomhet ${recipientResponsibleEnterprise.name} satt som mottaker`,
              level: 'WARNING'
            }
          }
        })
      }
    }
    // Da var det ikke internt notat med oppfølging, og vi sjekker om vi kan sende til ansvarlig person
    const responsiblePersonUserId = document.ResponsiblePerson?.UserId || 'nada'
    const responsiblePerson = getUser(responsiblePersonUserId, document.ResponsiblePerson?.Email || responsiblePersonUserId, document.ResponsiblePerson?.Name || 'Ukjent navn')
    if (responsiblePerson.canSend) {
      // Bruk ansvarlig person og vi er fornøyd
      return createDocumentAlert({
        responsibleEnterprise: documentResponsibleUnit,
        responsibleForFollowUp: responsiblePerson,
        documentResult: {
          document,
          reason: {
            code: 'RESPONSIBLE_PERSON',
            reportDescription: `${responsiblePerson.name} er ansvarlig person.`,
            purreDescription: 'Du står som ansvarlig person for dette dokumentet.',
            level: 'INFO'
          }
        }
      })
    }
    // Æsj, vi kunne ikke sende, legg til en reason på dokumentet
    const docReasonPrefix = `Dokumentansvarlig kan ikke brukes: ${responsiblePerson.reason}.`
    // Hvis brukeren er inaktiv eller servicebruker vil arkivet ha den (skreddersydd for arkiv)
    if (responsiblePerson.user && (!responsiblePerson.user.IsActive || responsiblePerson.user.IsServiceUser)) {
      return createDocumentAlert({
        responsibleEnterprise: documentResponsibleUnit,
        sendToArchive: true,
        documentResult: {
          document,
          reason: {
            code: 'RESPONSIBLE_PERSON_INACTIVE_OR_SERVICEUSER',
            reportDescription: `${docReasonPrefix} Må håndteres av arkiv`,
            purreDescription: docReasonPrefix,
            level: 'WARNING'
          }
        }
      })
    }
    // Ellers så sjekker vi om vi har noen ledere, og sender til de
    if (documentResponsibleUnit.leaders.length > 0) {
      /** @type {import('./typeshit').DocumentReason} */
      let yeyeReason
      if (!document.ResponsiblePerson || (!document.ResponsiblePerson.UserId && document.ResponsiblePerson.Recno.toString() === document.ResponsibleEnterprise?.Recno.toString())) {
        yeyeReason = {
          code: 'NO_RESPONSIBLE_PERSON',
          reportDescription: `Ingen ansvarlig person satt, sender til leder(e) for ansvarlig enhet i stedet.`,
          purreDescription: 'Ingen ansvarlig person satt på dokumentet.',
          level: 'INFO'
        }
      } else {
        yeyeReason = {
          code: 'RESPONSIBLE_PERSON_INVALID',
          reportDescription: `${docReasonPrefix} Sender til leder(e) for ansvarlig enhet i stedet.`,
          purreDescription: docReasonPrefix,
          level: 'WARNING'
        }
      }
      return createDocumentAlert({
        responsibleEnterprise: documentResponsibleUnit,
        sendToLeaders: true,
        documentResult: {
          document,
          reason: yeyeReason
        }
      })
    }
    // Hvis ikke har vi ikke noe annet valg enn å sende til arkiv
    return createDocumentAlert({
      responsibleEnterprise: documentResponsibleUnit,
      sendToArchive: true,
      documentResult: {
        document,
        reason: {
          code: 'NO_RESPONSIBLE_PERSON_OR_LEADERS',
          reportDescription: `${docReasonPrefix} Ingen ledere funnet for ansvarlig enhet, må håndteres av arkiv`,
          purreDescription: docReasonPrefix,
          level: 'WARNING'
        }
      }
    })
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
    const alertData = constructDocumentAlert(document)

    if (!unansweredDocumentsReport.enterprises[alertData.enterpriseKey]) {
      // unansweredDocumentsReport.enterprises[alertData.enterpriseKey] = JSON.parse(JSON.stringify(alertData.responsibleEnterprise))
      unansweredDocumentsReport.enterprises[alertData.enterpriseKey] = {
        name: alertData.responsibleEnterprise.name,
        recno: alertData.responsibleEnterprise.recno,
        leaders: alertData.responsibleEnterprise.leaders,
        alerts: {}
      }
    } else {
      // Compare and throw error if I did anything stupid
      if (unansweredDocumentsReport.enterprises[alertData.enterpriseKey].name !== alertData.responsibleEnterprise.name) {
        throw new Error(`Enterprise name mismatch for ${alertData.enterpriseKey}: ${unansweredDocumentsReport.enterprises[alertData.enterpriseKey].name} !== ${alertData.responsibleEnterprise.name}`)
      }
      if (unansweredDocumentsReport.enterprises[alertData.enterpriseKey].recno !== alertData.responsibleEnterprise.recno) {
        throw new Error(`Enterprise recno mismatch for ${alertData.enterpriseKey}: ${unansweredDocumentsReport.enterprises[alertData.enterpriseKey].recno} !== ${alertData.responsibleEnterprise.recno}`)
      }
      if (JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].leaders) !== JSON.stringify(alertData.responsibleEnterprise.leaders)) {
        throw new Error(`Enterprise leaders mismatch for ${alertData.enterpriseKey}: ${JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].leaders)} !== ${JSON.stringify(alertData.responsibleEnterprise.leaders)}`)
      }
    }
    if (!unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey]) {
      unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey] = {
        emailToResult: alertData.emailToResult,
        responsibleForFollowUp: alertData.responsibleForFollowUp,
        emailStatus: {
          code: 'notSent',
          message: 'Not sent yet'
        },
        documentResults: []
      }
    } else {
      // Compare and throw error if I did anything stupid
      if (JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey].emailToResult) !== JSON.stringify(alertData.emailToResult)) {
        throw new Error(`Alert emailToResult mismatch for ${alertData.enterpriseKey} / ${alertData.responsibleKey}: ${JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey].emailToResult)} !== ${JSON.stringify(alertData.emailToResult)}`)
      }
      if (JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey].responsibleForFollowUp) !== JSON.stringify(alertData.responsibleForFollowUp)) {
        throw new Error(`Alert responsibleForFollowUp mismatch for ${alertData.enterpriseKey} / ${alertData.responsibleKey}: ${JSON.stringify(unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey].responsibleForFollowUp)} !== ${JSON.stringify(alertData.responsibleForFollowUp)}`)
      }
    }
    // Så slenger vi på dokumentet (og grunnen for dokumentet) det gjelder også
    unansweredDocumentsReport.enterprises[alertData.enterpriseKey].alerts[alertData.responsibleKey].documentResults.push(alertData.documentResult)
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
      if (alertData.emailToResult.sendToArchive) sendToArchive += 1
      else if (alertData.emailToResult.sendToLeaders) sendToLeaders += 1
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