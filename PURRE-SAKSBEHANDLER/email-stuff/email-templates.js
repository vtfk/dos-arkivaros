// @ts-check
// Functions for generating different types of purre emails

const { PURRE } = require("../../config");
const { leekSvg } = require("../leek");
const { UnansweredDocumentsReport } = require("../purre-types");

/**
 *
 * @param {import("../unanswered-documents-purre").UnansweredDocumentsReport} unansweredDocumentsReport
 * @returns {string}
 */
const reportMailToArchive = (unansweredDocumentsReport) => {
  unansweredDocumentsReport = UnansweredDocumentsReport.parse(unansweredDocumentsReport, { reportInput: true })
  let mailStr = `
<h1>Ubesvarte dokumenter per avdeling - ${new Date(unansweredDocumentsReport.fromDate).toLocaleDateString('no')} til ${new Date(unansweredDocumentsReport.toDate).toLocaleDateString('no')}</h1>
<p>Dokument inn, Epost inn, og Internt notat med oppfølging som ikke er avskrevet eller besvart. Totalt ${unansweredDocumentsReport.totalDocuments} dokumenter.</p>
`

  // SLeng på litt mer medata i reason-lista i stedet for i dokumenttittelen (i kveld ellerno)
  for (const purreReceiver of unansweredDocumentsReport.purreReceivers.sort((a, b) => a.receiverId.localeCompare(b.receiverId))) {
    mailStr += `<div style="border: 2px solid #ccc; padding: 16px; margin-bottom: 16px;">\n`
    mailStr += `<h3>Epost til${purreReceiver.purreResult === 'send_to_leaders' ? ` ledere for ${purreReceiver.responsibleEnterprise.enterprise.Name}` : ''}: ${purreReceiver.toAddresses.join(', ')}</h3>\n`
    // mailStr += `<p><strong>Ansvarlig for oppfølging: ${alertData.responsibleForFollowUp?.name || 'nei'} (${alertData.responsibleForFollowUp?.email || 'nei'})</strong></p>`
    mailStr += `<p>Dokumenter: ${purreReceiver.documentResults.length}</p>\n`
    // Så lister vi opp dokumentene og
    mailStr += `<ul>\n`
    for (const documentResult of purreReceiver.documentResults) {
      mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${documentResult.document.URL}" target="_blank">${documentResult.document.DocumentNumber} - ${documentResult.document.OfficialTitle}</a>.`
      mailStr += `<ul><li>Kategori: ${documentResult.document.Category.Description}</li>`
      mailStr += `<li>Journaldato: ${new Date(documentResult.document.JournalDate).toLocaleDateString('no')}</li>`
      if (documentResult.document.ResponsibleEnterprise?.Name) {
        mailStr += `<li>Ansvarlig enhet: ${documentResult.document.ResponsibleEnterprise?.Name }</li>`
      }
      if (documentResult.reason && documentResult.reason.reportDescription) {
        mailStr += `<li><strong><span style="color: ${documentResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${documentResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${documentResult.reason.reportDescription}</span></strong></li>`
      }
      mailStr += `</ul></li><br />\n`
    }
    mailStr += `</ul>\n`
    mailStr += `</div>\n`
  }

  return mailStr
}

/**
 * 
 * @param {import('../typeshit').UnansweredPurreData} alert
 * @returns {string}
 */
const purreToSaksbehandler = (alert) => {
  let mailStr = ''
  mailStr += `<p>Hei, ${alert.responsibleForFollowUp?.name || 'saksbehandler!'}!</p>\n`
  /*
  mailStr += `
  <!-- Grønnsaken "purre" på engelsk er "leek". -->
<div style="width: 150px; height: 150px; border: 0px solid #4CAF50;">
${leekSvg}
</div>
<br />
`
*/
  mailStr += `<strong>Les dette før du følger opp dokumentene:</strong><br />\n`
  mailStr += `Mest sannsynlig har du allerede fulgt opp disse dokumentene, men ikke avskrevet de i Public 360. Sjekk derfor først om du har svart på dokumentet, eller fulgt opp på annen måte. Hvis du har gjort det, så avskriv dokumentet i Public 360 med korrekt avskrivningskode. Dersom dokumentet ikke er besvart eller håndtert, må det følges opp.<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med din leder eller arkivet.<br /><br />\n'
  mailStr += `<strong>Dokumenter som trenger oppfølging:</strong><br />\n`
  mailStr += `<ul>\n`
  for (const documentResult of alert.documentResults) {
    mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${documentResult.document.URL}" target="_blank">${documentResult.document.DocumentNumber} - ${documentResult.document.OfficialTitle}</a>.`
    mailStr += `<ul><li>${documentResult.document.Category.Description} med journaldato: ${new Date(documentResult.document.JournalDate).toLocaleDateString('no')}</li>`
    if (documentResult.reason && documentResult.reason.purreDescription) {
      mailStr += `<li><span style="color: ${documentResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${documentResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${documentResult.reason.purreDescription}</span></li>`
    }
    mailStr += `</ul></li><br />\n`
  }
  mailStr += `</ul>\n`
  mailStr += `Vennlig hilsen arkivet<br />\n`

  return mailStr
}

/**
 * 
 * @param {import('../typeshit').UnansweredPurreData} alert
 * @returns {string}
 */
const purreToLedere = (alert) => {
  let mailStr = ''
  mailStr += `<p>Hei, ledere for ${alert.leaderEnterprise?.name || 'ukjent virksomhet'}!</p>\n`
  mailStr += `Her er en dokumenter i deres avdeling som trenger oppfølging, da de enten mangler ansvarlig person eller ansvarlig person ikke kan brukes. Dokumentene må enten fordeles til korrekt saksbehandler, avskrives (dersom de er håndtert), eller følges opp.<br />\n`
  mailStr += 'Har du spørsmål, ta kontakt med din leder eller arkivet.<br /><br />\n'
  mailStr += `<strong>Dokumenter som trenger oppfølging:</strong><br />\n`
  mailStr += `<ul>\n`
  for (const documentResult of alert.documentResults) {
    mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${documentResult.document.URL}" target="_blank">${documentResult.document.DocumentNumber} - ${documentResult.document.OfficialTitle}</a>.`
    mailStr += `<ul><li>${documentResult.document.Category.Description} med journaldato: ${new Date(documentResult.document.JournalDate).toLocaleDateString('no')}</li>`
    if (documentResult.reason && documentResult.reason.purreDescription) {
      mailStr += `<li><span style="color: ${documentResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${documentResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${documentResult.reason.purreDescription}</span></li>`
    }
    mailStr += `</ul></li><br />\n`
  }
  mailStr += `</ul>\n`
  mailStr += `Vennlig hilsen arkivet<br />\n`

  return mailStr
}


module.exports = { unansweredDocumentEmailTemplates: { reportMailToArchive, purreToSaksbehandler, purreToLedere } }