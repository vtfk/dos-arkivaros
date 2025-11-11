const { default: axios } = require('axios')
const { MAIL, PURRE } = require('../../config')
const { logger } = require('@vtfk/logger')
const { PurreDocumentsReport } = require('../purre-types')
const { unansweredPurreToSaksbehandler, unansweredPurreToLedere, reservedPurreToSaksbehandler, reservedPurreToLedere } = require('./email-templates')

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
  switch (type) {
    case 'unanswered-documents':
      saksbehandlerTemplate = unansweredPurreToSaksbehandler
      lederTemplate = unansweredPurreToLedere
      saksbehandlerSubject = 'Dine ubesvarte dokumenter'
      lederSubject = 'Ubesvarte dokumenter i din avdeling'
      break
    case 'reserved-documents':
      saksbehandlerTemplate = reservedPurreToSaksbehandler
      lederTemplate = reservedPurreToLedere
      saksbehandlerSubject = 'Dine dokumenter under arbeid'
      lederSubject = 'Dokumenter under arbeid i din avdeling'
      break
    default:
      throw new Error('Invalid type, must be "unanswered-documents" or "reserved-documents"') 
  }

  purreReport = PurreDocumentsReport.parse(purreReport, { reportInput: true }) // Vi skal være så freidige å redigere i rapporten her, men vi kan vel strengt tatt bare returnere den da...

  let receivers = null
  if (PURRE.TEST_MAIL_RECEIVER) {
    const exampleToSaksbehandler = purreReport.purreReceivers.find(receiver => receiver.purreResult === 'send_to_responsible')
    if (!exampleToSaksbehandler) {
      throw new Error('Could not find example receiver with purreResult "send_to_responsible"')
    }
    const exampleToLeaders = purreReport.purreReceivers.find(receiver => receiver.purreResult === 'send_to_leaders')
    if (!exampleToLeaders) {
      throw new Error('Could not find example receiver with purreResult "send_to_leaders"')
    }
    receivers = [exampleToSaksbehandler, exampleToLeaders]
  } else {
    throw new Error('NOT READY DO ACTUALLY SEND MAILS WITHOUT TEST MAIL RECEIVER SET YET')
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
    const toAddresses = PURRE.TEST_MAIL_RECEIVER ? [PURRE.TEST_MAIL_RECEIVER] : 'neinei'
    // Hvis saksbehandler, send til sakbehandler og ledere eller arkiv på kopi
    // Hvis ledere, send til ledere og arkiv på kopi
    try {
      await sendPurreMail(toAddresses, mailSubject, mailBody)
      purreReceiver.emailResult.status = 'SENDT'
    } catch (error) {
      purreReceiver.emailResult.status = 'FEILET'
      logger('error', ['Failed to send purre mail to', toAddresses.join(', '), error.response?.data || error.stack || error.toString()])
    }
  }
  return purreReport
}


const sendPurreMail = async (to, subject, body, attachments = []) => {
  if (!to || !subject || !body) {
    throw new Error('Missing to, subject or body when sending purre mail')
  }
  if (PURRE.TEST_MAIL_RECEIVER && to.length !== 1 && to[0] !== PURRE.TEST_MAIL_RECEIVER) {
    throw new Error('NOT READY DO ACTUALLY SEND MAILS WITHOUT TEST MAIL RECEIVER SET YET')
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
          name: 'Arkiveringsroboten',
          title: 'Robot',
          company: 'Robotavdelingen'
        }
      }
    }
  }
  logger('info', ['Sending purre mail to', to.join(', ')])
  await axios.post(MAIL.URL, mailPayload, { headers: { 'x-functions-key': MAIL.KEY } })
  logger('info', ['Succesfully sent purre mail to', to.join(', ')])
}

module.exports = { sendReportMails }