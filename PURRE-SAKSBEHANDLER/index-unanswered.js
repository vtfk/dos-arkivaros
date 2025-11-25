// @ts-check


(async () => {
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { unansweredDocumentsPurre } = require('./unanswered-documents-purre')
  const { sendReportMails } = require('./email-stuff/send-mail')
  const { writeFileSync, existsSync, mkdirSync } = require('fs')
  const { logErrorAndExit } = require('./log-error')
  const { unansweredDocumentsReportMailToArchive } = require('./email-stuff/email-templates')

  // Først setter vi opp litt logging
  logConfig({
    prefix: 'PURRE',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('PURRE')
  })

  logger('info', ['Boom boom, starting new run'])

  logConfig({
    prefix: 'PURRE-UNANSWERED-DOCUMENTS'
  })

  const now = new Date()
  const threeWeeksAgo = new Date(now.setDate(now.getDate() - 21)) // haha
  const threeWeeksAgoString = threeWeeksAgo.toISOString().split('T')[0]

  const unansweredDocumentsDates = {
    fromDate: '2024-01-01',
    toDate: threeWeeksAgoString // Tre uker tilbake i tid fra dagens dato
  }
  logger('info', [`Running unanswered documents purre for dates ${unansweredDocumentsDates.fromDate} to ${unansweredDocumentsDates.toDate}`])
  let unansweredDocumentsReport = null
  try {
    unansweredDocumentsReport = await unansweredDocumentsPurre(unansweredDocumentsDates.fromDate, unansweredDocumentsDates.toDate)
    logger('info', [`Finished unanswered documents purre run, got report with ${unansweredDocumentsReport.totalDocuments} documents in total. Sending report emails...`])
  } catch (error) {
    logErrorAndExit('Failed to get unanswered documents purre', error)
  }
  let unansweredReportWithStatus = null
  try {
    // @ts-expect-error its not null
    unansweredReportWithStatus = await sendReportMails(unansweredDocumentsReport, 'unanswered-documents')
    const failed = unansweredReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'FEILET').length
    const sent = unansweredReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'SENDT').length
    const notSent = unansweredReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'IKKE_SENDT').length // Should be one - the archive one
    logger('info', [`Finished sending report emails for unanswered documents purre. Sent: ${sent}, Failed: ${failed}, Not sent: ${notSent}`])
  } catch (error) {
    logErrorAndExit('Failed to send report emails for unanswered documents purre', error)
  }
  try {
    const backupDir = './PURRE-SAKSBEHANDLER/ignore/report-backups'
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }
    writeFileSync(`${backupDir}/unanswered-documents-report-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(unansweredReportWithStatus, null, 2))
    // @ts-expect-error its not null
    const htmlReport = unansweredDocumentsReportMailToArchive(unansweredReportWithStatus)
    writeFileSync(`${backupDir}/unanswered-documents-report-${new Date().toISOString().split('T')[0]}.html`, htmlReport)
  } catch (error) {
    logErrorAndExit('Failed to backup unanswered documents report', error)
  }

  logConfig({
    prefix: 'PURRE'
  })

  logger('info', ['All done, exiting now'])
})()