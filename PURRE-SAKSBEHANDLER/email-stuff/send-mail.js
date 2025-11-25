// @ts-check

const { default: axios } = require('axios')
const { MAIL, PURRE } = require('../../config')
const { logger } = require('@vtfk/logger')
const { PurreDocumentsReport } = require('../purre-types')
const { unansweredPurreToSaksbehandler, unansweredPurreToLedere, reservedPurreToSaksbehandler, reservedPurreToLedere, reservedDocumentsReportMailToArchive, unansweredDocumentsReportMailToArchive } = require('./email-templates')

/**
 * @param {PurreDocumentsReport} purreReport
 * @param {"unanswered-documents" | "reserved-documents"} type
 * @return {Promise<PurreDocumentsReport>}
 */
const sendReportMails = async (purreReport, type) => {
  if (!type || (type !== 'unanswered-documents' && type !== 'reserved-documents')) {
    throw new Error('Invalid type, must be "unanswered-documents" or "reserved-documents"')
  }

  let saksbehandlerTemplate = null
  let lederTemplate = null
  let saksbehandlerSubject = null
  let lederSubject = null
  let archiveTemplate = null
  let archiveSubject = null
  switch (type) {
    case 'unanswered-documents':
      saksbehandlerTemplate = unansweredPurreToSaksbehandler
      lederTemplate = unansweredPurreToLedere
      archiveTemplate = unansweredDocumentsReportMailToArchive
      saksbehandlerSubject = 'Dine ubesvarte dokumenter'
      lederSubject = 'Ubesvarte dokumenter i din avdeling'
      archiveSubject = 'Rapport: Ubesvarte dokumenter'
      break
    case 'reserved-documents':
      saksbehandlerTemplate = reservedPurreToSaksbehandler
      lederTemplate = reservedPurreToLedere
      archiveTemplate = reservedDocumentsReportMailToArchive
      saksbehandlerSubject = 'Dine dokumenter under arbeid'
      lederSubject = 'Dokumenter under arbeid i din avdeling'
      archiveSubject = 'Rapport: Reserverte dokumenter'
      break
    default:
      throw new Error('Invalid type, must be "unanswered-documents" or "reserved-documents"') 
  }

  purreReport = PurreDocumentsReport.parse(purreReport, { reportInput: true }) // Vi skal være så freidige å redigere i rapporten her, men vi kan vel strengt tatt bare returnere den da...

  let receivers = null
  if (PURRE.TEST_MAIL_RECEIVER) {
    receivers = []
    const exampleToSaksbehandler = purreReport.purreReceivers.find(receiver => receiver.purreResult === 'send_to_responsible')
    if (exampleToSaksbehandler) {
      receivers.push(exampleToSaksbehandler)
    }
    const exampleToLeaders = purreReport.purreReceivers.find(receiver => receiver.purreResult === 'send_to_leaders')
    if (exampleToLeaders) {
      receivers.push(exampleToLeaders)
    }
  } else {
    receivers = purreReport.purreReceivers
  }

  for (const purreReceiver of receivers) {
    const mailSubject = purreReceiver.purreResult === 'send_to_responsible' ? saksbehandlerSubject : purreReceiver.purreResult === 'send_to_leaders' ? lederSubject : null
    if (!mailSubject) {
      logger('warn', ['No mail subject generated for receiver', purreReceiver.receiverId, 'with purreResult', purreReceiver.purreResult])
      continue
    }
    const mailBody = purreReceiver.purreResult === 'send_to_responsible' ? saksbehandlerTemplate(purreReceiver) : purreReceiver.purreResult === 'send_to_leaders' ? lederTemplate(purreReceiver) : null
    if (!mailBody) {
      logger('warn', ['No mail body generated for receiver', purreReceiver.receiverId, 'with purreResult', purreReceiver.purreResult])
      continue
    }

    if (PURRE.TEST_MAIL_RECEIVER) {
      logger('info', [`TEST MAIL RECEIVER IS SET TO ${PURRE.TEST_MAIL_RECEIVER}, overriding to-addresses ${purreReceiver.toAddresses.join(', ')} and cc-addresses ${purreReceiver.ccAddresses.join(', ')}`])
    }

    const toAddresses = PURRE.TEST_MAIL_RECEIVER ? [PURRE.TEST_MAIL_RECEIVER] : purreReceiver.toAddresses
    const ccAddresses = PURRE.TEST_MAIL_RECEIVER ? [PURRE.TEST_MAIL_RECEIVER] : purreReceiver.ccAddresses

    try {
      logger('info', [`Sending ${type} purre-mail to ${toAddresses.join(', ')} (${purreReceiver.purreResult})`])
      const mailResult = await sendPurreMail(toAddresses, mailSubject, mailBody, [], ccAddresses, [])
      purreReceiver.emailResult.status = 'SENDT'
      purreReceiver.emailResult.emailResponse = mailResult
      logger('info', [`Sucessfully sent ${type} purre-mail to ${toAddresses.join(', ')} (${purreReceiver.purreResult})`])
    } catch (error) {
      purreReceiver.emailResult.status = 'FEILET'
      // @ts-expect-error gidder ikke
      purreReceiver.emailResult.error = error.response?.data || error.toString()
      // @ts-expect-error gidder ikke
      logger('error', [`Failed to send purre mail to ${toAddresses.join(', ')}`, error.response?.data || error.stack || error.toString()])
    }
  }

  // Og så lager vi en rapport til arkiv, og sender den og. Den er så stor, så vi lager en fil av den og legger den som attachment i en mail til arkiv
  const reportHtml = archiveTemplate(purreReport)
  const archiveMailSubject = archiveSubject
  const archiveMailBody = `Hei arkiv!\n\nVedlagt ligger rapport for ${type === 'unanswered-documents' ? 'ubesvarte dokumenter' : 'reserverte dokumenter'}`
  const b64 = Buffer.from(reportHtml).toString('base64')
  const attachments = [
    {
      data: b64,
      name: `purre-report-${type}.html`,
      type: 'text/html',
    }
  ]
  const reportReceivers = PURRE.TEST_MAIL_RECEIVER ? [PURRE.TEST_MAIL_RECEIVER] : [PURRE.ARCHIVE_EMAIL]
  try {
    logger('info', [`Sending archive report mail for ${type} to ${reportReceivers.join(', ')}`])
    await sendPurreMail(
      reportReceivers,
      archiveMailSubject,
      archiveMailBody,
      attachments,
      [],
      PURRE.REPORT_BCCS
    )
    logger('info', [`Sucessfully sent archive report mail for ${type} to ${reportReceivers.join(', ')}`])
  } catch (error) {
    // @ts-expect-error gidder ikke
    logger('error', [`Failed to send archive report mail for ${type} to ${reportReceivers.join(', ')}`, error.response?.data || error.stack || error.toString()])
  }

  return purreReport
}

/**
 * 
 * @param {string[]} to 
 * @param {string} subject 
 * @param {string} body 
 * @param {Object[]} attachments 
 * @param {string[]} cc 
 * @param {string[]} bcc 
 * @returns {Promise<{[key: string]: string}>} Response data from mail function
 */
const sendPurreMail = async (to, subject, body, attachments = [], cc, bcc) => {
  if (!to || !subject || !body) {
    throw new Error('Missing to, subject or body when sending purre mail')
  }
  if (PURRE.TEST_MAIL_RECEIVER && to.length !== 1 && to[0] !== PURRE.TEST_MAIL_RECEIVER) {
    throw new Error('Multiple to-addresses when TEST_MAIL_RECEIVER is set, something wrong with code cannot send mail')
  }
  const mailPayload = {
    to,
    from: PURRE.MAIL_SENDER,
    subject,
    attachments,
    template: {
      templateName: PURRE.MAIL_TEMPLATE,
      templateData: {
        body,
        signature: {
          name: 'Seksjon dokumentasjon og politisk støtte',
          title: 'Fagenhet dokumentasjon',
          company: `Brukerstøtte: 33 34 40 07 (betjent kl 10.00 - 14.00) \n E-post: arkiv${PURRE.VALID_EMAIL_SUFFIX}`
        }
      }
    }
  }
  if (Array.isArray(cc) && cc.length > 0) {
    // @ts-ignore
    mailPayload.cc = cc
  }
  if (Array.isArray(bcc) && bcc.length > 0) {
    // @ts-ignore
    mailPayload.bcc = bcc
  }
  if (!MAIL.URL || !MAIL.KEY) {
    throw new Error('Missing MAIL.URL or MAIL.KEY in config, cannot send mail')
  }
  const { data } = await axios.post(MAIL.URL, mailPayload, { headers: { 'x-functions-key': MAIL.KEY } })
  return data
}

module.exports = { sendReportMails }