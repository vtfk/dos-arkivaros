// @ts-check

(async () => {
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { unansweredDocumentsPurre } = require('./unanswered-documents-purre')
  const { reservedDocumentsPurre } = require('./reservered-documents-purre')
  const { sendReportMails } = require('./email-stuff/send-mail')
  const { writeFileSync, existsSync, mkdirSync } = require('fs')
  const { logErrorAndExit } = require('./log-error')

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
  const unansweredDocumentsDates = {
    fromDate: '2024-01-01',
    toDate: '2025-09-30' // hva skal denne være? Egt en mnd tilbake i tid fra dagens dato
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
  } catch (error) {
    logErrorAndExit('Failed to backup unanswered documents report', error)
  }

  logConfig({
    prefix: 'PURRE-RESERVED-DOCUMENTS'
  })
  const reservedDocumentsDates = {
    fromDate: '2024-01-01',
    toDate: '2025-09-30' // Egt en mnd tilbake i tid fra dagens dato
  }
  logger('info', [`Running reserved documents purre for dates ${reservedDocumentsDates.fromDate} to ${reservedDocumentsDates.toDate}`])
  let reservedDocumentsReport = null
  try {
    reservedDocumentsReport = await reservedDocumentsPurre(reservedDocumentsDates.fromDate, reservedDocumentsDates.toDate)
    logger('info', [`Finished reserved documents purre run, got report with ${reservedDocumentsReport.totalDocuments} documents in total. Sending report emails...`])
  } catch (error) {
    logErrorAndExit('Failed to get reserved documents purre', error)
  }
  let reservedReportWithStatus = null
  try {
    // @ts-expect-error its not null
    reservedReportWithStatus = await sendReportMails(reservedDocumentsReport, 'reserved-documents')
    const failed = reservedReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'FEILET').length
    const sent = reservedReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'SENDT').length
    const notSent = reservedReportWithStatus.purreReceivers.filter(r => r.emailResult.status === 'IKKE_SENDT').length // Should be one - the archive one
    logger('info', [`Finished sending report emails for reserved documents purre. Sent: ${sent}, Failed: ${failed}, Not sent: ${notSent}`])
  } catch (error) {
    logErrorAndExit('Failed to send report emails for reserved documents purre', error)
  }
  try {
    const backupDir = './PURRE-SAKSBEHANDLER/ignore/report-backups'
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }
    writeFileSync(`${backupDir}/reserved-documents-report-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(reservedReportWithStatus, null, 2))
  } catch (error) {
    logErrorAndExit('Failed to backup reserved documents report', error)
  }

  logConfig({
    prefix: 'PURRE'
  })

  logger('info', ['All done, exiting now'])
})()