const { default: axios } = require('axios')
const { MAIL, PURRE } = require('../../config')
const { logger } = require('@vtfk/logger')

const sendPurreMail = async (to, subject, body, attachments = []) => {
  if (!to || !subject || !body) {
    throw new Error('Missing to, subject or body when sending purre mail')
  }
  const mailPayload = {
    to,
    from: PURRE.MAIL_SENDER,
    subject: `P360 Purre`,
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
  try {
    logger('info', ['Sending purre mail to', to.join(', ')])
    await axios.post(MAIL.URL, mailPayload, { headers: { 'x-functions-key': MAIL.KEY } })
    logger('info', ['Succesfully sent purre mail to', to.join(', ')])
  } catch (error) {
    logger('error', ['AAAH, failed when sending purre email, will have to try again next time...', error.response?.data || error.stack || error.toString()])
  }
}

module.exports = { sendPurreMail }