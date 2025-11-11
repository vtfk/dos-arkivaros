// @ts-check
// Functions for generating different types of purre emails

const { PURRE } = require("../../config");
const { ArchiveDocument } = require("../../lib/archive-types");
const { PurreDocumentsReport, PurreReceiver, PurreDocumentResult } = require("../purre-types");

/**
 * 
 * @param {PurreReceiver[]} purreReceivers 
 */
const createReportBody = (purreReceivers) => {
  let reportBody = ''

  for (const purreReceiver of purreReceivers.sort((a, b) => a.receiverId.localeCompare(b.receiverId))) {
    reportBody += `<div style="border: 2px solid #ccc; padding: 16px; margin-bottom: 16px;">\n`
    reportBody += `<h3>Epost til${purreReceiver.purreResult === 'send_to_leaders' ? ` ledere for ${purreReceiver.responsibleEnterprise.enterprise.Name}` : ''}: ${purreReceiver.toAddresses.join(', ')}</h3>\n`
    reportBody += `Epost-status: ${purreReceiver.emailResult.status}<br />\n`
    reportBody += `<p>Dokumenter: ${purreReceiver.documentResults.length}</p>\n`
    // Så lister vi opp dokumentene og
    reportBody += `<ul>\n`
    for (const documentResult of purreReceiver.documentResults) {
      reportBody += `<li><a href="${PURRE.LOCATOR_BASE_URL}${documentResult.document.URL}" target="_blank">${documentResult.document.DocumentNumber} - ${documentResult.document.OfficialTitle}</a>.`
      reportBody += `<ul><li>Kategori: ${documentResult.document.Category.Description}</li>`
      if (documentResult.document.JournalDate) {
        reportBody += `<li>Journaldato: ${new Date(documentResult.document.JournalDate).toLocaleDateString('no')}</li>`
      } else if (documentResult.document.DocumentDate) {
        reportBody += `<li>Dokumentdato: ${new Date(documentResult.document.DocumentDate).toLocaleDateString('no')}</li>`
      } else {
        reportBody += `<li>Dato: Ukjent</li>`
      }
      if (documentResult.document.ResponsibleEnterprise?.Name) {
        reportBody += `<li>Ansvarlig enhet: ${documentResult.document.ResponsibleEnterprise?.Name }</li>`
      }
      if (documentResult.reason && documentResult.reason.reportDescription) {
        reportBody += `<li><strong><span style="color: ${documentResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${documentResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${documentResult.reason.reportDescription}</span></strong></li>`
      }
      reportBody += `</ul></li><br />\n`
    }
    reportBody += `</ul>\n`
    reportBody += `</div>\n`
  }
  return reportBody
}

/**
 *
 * @param {PurreDocumentsReport} unansweredDocumentsReport
 * @returns {string}
 */
const unansweredDocumentsReportMailToArchive = (unansweredDocumentsReport) => {
  unansweredDocumentsReport = PurreDocumentsReport.parse(unansweredDocumentsReport, { reportInput: true })
  let mailStr = `
<h1>Ubesvarte dokumenter per avdeling - ${new Date(unansweredDocumentsReport.fromDate).toLocaleDateString('no')} til ${new Date(unansweredDocumentsReport.toDate).toLocaleDateString('no')}</h1>
<p>Dokument inn, Epost inn, og Internt notat med oppfølging som ikke er avskrevet eller besvart. Totalt ${unansweredDocumentsReport.totalDocuments} dokumenter.</p>
`
  mailStr += createReportBody(unansweredDocumentsReport.purreReceivers)

  return mailStr
}

/**
 *
 * @param {PurreDocumentsReport} reservedDocumentsReport
 * @returns {string}
 */
const reservedDocumentsReportMailToArchive = (reservedDocumentsReport) => {
  reservedDocumentsReport = PurreDocumentsReport.parse(reservedDocumentsReport, { reportInput: true })
  let mailStr = `
<h1>Reserverte dokumenter - ${new Date(reservedDocumentsReport.fromDate).toLocaleDateString('no')} til ${new Date(reservedDocumentsReport.toDate).toLocaleDateString('no')}</h1>
<p>Dokumenter som har status reservert. Totalt ${reservedDocumentsReport.totalDocuments} dokumenter.</p>
`
  mailStr += createReportBody(reservedDocumentsReport.purreReceivers)

  return mailStr
}

/**
 *
 * @param {import("../purre-types").PurreDocumentResult[]} documentResult
 * @returns {string}
 */
const createListOfDocuments = (documentResult) => {
  let mailStr = `<ul>\n`
  for (const docResult of documentResult) {
    mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${docResult.document.URL}" target="_blank">${docResult.document.DocumentNumber} - ${docResult.document.OfficialTitle}</a>.`
    mailStr += `<ul>\n`
    if (docResult.document.JournalDate) {
      mailStr += `<li>${docResult.document.Category.Description} med journaldato: ${new Date(docResult.document.JournalDate).toLocaleDateString('no')}</li>`
    } else if (docResult.document.DocumentDate) {
      mailStr += `<li>${docResult.document.Category.Description} med dokumentdato: ${new Date(docResult.document.DocumentDate).toLocaleDateString('no')}</li>`
    } else {
      mailStr += `<li>${docResult.document.Category.Description} med dato: ukjent dato</li>`
    }
    if (docResult.reason && docResult.reason.purreDescription) {
      mailStr += `<li><span style="color: ${docResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${docResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${docResult.reason.purreDescription}</span></li>`
    }
    mailStr += `</ul></li><br />\n`
  }
  mailStr += `</ul>\n`
  return mailStr
}

/**
 *
 * @param {PurreReceiver} alert
 * @returns {string}
 */
const unansweredPurreToSaksbehandler = (alert) => {
  alert = PurreReceiver.parse(alert)
  let mailStr = ''
  const name = alert.responsibleForFollowUp?.contact ? `${alert.responsibleForFollowUp.contact.FirstName} ${alert.responsibleForFollowUp.contact.LastName}` : 'saksbehandler'
  mailStr += `<p>Hei, ${name}!</p>\n`
  mailStr += `<strong>Les dette før du følger opp dokumentene:</strong><br />\n`
  mailStr += `Det er mulig du allerede har fulgt opp disse dokumentene, men ikke avskrevet de i Public 360. Sjekk derfor først om du har svart på dokumentet, eller fulgt opp på annen måte. Hvis du har gjort det, så avskriv dokumentet i Public 360 med korrekt avskrivningskode. Dersom dokumentet ikke er besvart eller håndtert, må det følges opp.<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med din leder eller arkivet.<br /><br />\n'
  mailStr += `<strong>Dokumenter som trenger oppfølging:</strong><br />\n`
  mailStr += createListOfDocuments(alert.documentResults)

  return mailStr
}

/**
 * 
 * @param {PurreReceiver} alert 
 * @returns {string}
 */
const unansweredPurreToLedere = (alert) => {
  alert = PurreReceiver.parse(alert)
  let mailStr = ''
  mailStr += `<p>Hei, ledere for ${alert.responsibleEnterprise.enterprise.Name || 'ukjent virksomhet'}!</p>\n`
  mailStr += `Her er en liste over dokumenter i deres avdeling som trenger oppfølging, da de enten mangler ansvarlig person eller ansvarlig person ikke kan brukes. Dokumentene må enten fordeles til korrekt saksbehandler, avskrives (dersom de er håndtert), eller følges opp.<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med arkivet.<br /><br />\n'
  mailStr += `<strong>Dokumenter som trenger oppfølging:</strong><br />\n`
  mailStr += createListOfDocuments(alert.documentResults)

  return mailStr
}

/**
 *
 * @param {PurreReceiver} alert
 * @returns {string}
 */
const reservedPurreToSaksbehandler = (alert) => {
  alert = PurreReceiver.parse(alert)
  let mailStr = ''
  const name = alert.responsibleForFollowUp?.contact ? `${alert.responsibleForFollowUp.contact.FirstName} ${alert.responsibleForFollowUp.contact.LastName}` : 'saksbehandler'
  mailStr += `<p>Hei, ${name}!</p>\n`
  mailStr += `<strong>Les dette før du følger opp dokumentene:</strong><br />\n`
  mailStr += `Under ser du dine dokumenter under arbeid (status "Reservert") i Public 360. Vennligst fullfør dokumentet og sett til "Ferdig fra ansvarlig", eller forkast dokumentet ved å sette til status "Utgår".<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med din leder eller arkivet.<br /><br />\n'
  mailStr += `<strong>Dine dokumenter under arbeid:</strong><br />\n`
  mailStr += createListOfDocuments(alert.documentResults)

  return mailStr
}

/**
 * 
 * @param {PurreReceiver} alert 
 * @returns {string}
 */
const reservedPurreToLedere = (alert) => {
  alert = PurreReceiver.parse(alert)
  let mailStr = ''
  mailStr += `<p>Hei, ledere for ${alert.responsibleEnterprise.enterprise.Name || 'ukjent virksomhet'}!</p>\n`
  mailStr += `Her er en liste over dokumenter i deres avdeling som er under arbeids (status "Reservert") I Public 360. Vennligst fordel dokumentet, eller fullfør dokumentet og sett til "Ferdig fra ansvarlig", eller forkast dokumentet ved å sette til status "Utgår".<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med arkivet.<br /><br />\n'
  mailStr += `<strong>Dokumenter under arbeid i din avdeling:</strong><br />\n`
  mailStr += createListOfDocuments(alert.documentResults)

  return mailStr
}


module.exports = { unansweredDocumentsReportMailToArchive, reservedDocumentsReportMailToArchive, unansweredPurreToSaksbehandler, unansweredPurreToLedere, reservedPurreToSaksbehandler, reservedPurreToLedere }