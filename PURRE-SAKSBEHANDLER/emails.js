// @ts-check
// Functions for generating different types of purre emails

const { PURRE } = require("../config");
const { leekSvg } = require("./leek");

/**
 *
 * @param {import('./typeshit').UnansweredDocumentsReport} unansweredDocumentsReport
 * @returns {string}
 */
const reportMailToArchive = (unansweredDocumentsReport) => {
  let mailStr = `
<h1>Ubesvarte dokumenter per avdeling - ${new Date(unansweredDocumentsReport.fromDate).toLocaleDateString('no')} til ${new Date(unansweredDocumentsReport.toDate).toLocaleDateString('no')}</h1>
<p>Dokument inn, Epost inn, og Internt notat med oppfølging som ikke er avskrevet eller besvart. Totalt ${unansweredDocumentsReport.totalDocuments} dokumenter.</p>
`
  for (const [enterpriseRecno, enterpriseData] of Object.entries(unansweredDocumentsReport.enterprises)) {
    mailStr += `<h2>${enterpriseData.name}</h2>\n`
    for (const [emailAddress, alertData] of Object.entries(enterpriseData.alerts)) {
      mailStr += `<div style="border: 2px solid #ccc; padding: 16px; margin-bottom: 16px;">\n`
      mailStr += `<h3>Epost til${alertData.emailToResult.sendToLeaders ? ' leder(e)' : ''}: ${alertData.emailToResult.emailTo.join(', ')}</h3>\n`
      /* mailStr += `<p><strong>Ansvarlig for oppfølging: ${alertData.responsibleForFollowUp?.name || 'nei'} (${alertData.responsibleForFollowUp?.email || 'nei'})</strong></p>` */
      mailStr += `<p>Dokumenter: ${alertData.documentResults.length}</p>\n`
      // Så lister vi opp dokumentene og
      mailStr += `<ul>\n`
      for (const documentResult of alertData.documentResults) {
        mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${documentResult.document.URL}" target="_blank">${documentResult.document.DocumentNumber} - ${documentResult.document.OfficialTitle}</a> (${documentResult.document.Category.Description}).`
        if (documentResult.reason && documentResult.reason.reportDescription) {
          mailStr += `<ul><li><span style="color: ${documentResult.reason.level === 'WARNING' ? '#C70000' : '#000000'};">${documentResult.reason.level === 'WARNING' ? 'OBS!' : ''} ${documentResult.reason.reportDescription}</span></li></ul>`
        }
        mailStr += `</li><br />\n`
      }
      mailStr += `</ul>\n`
      mailStr += `</div>\n`
    }
  }
  return mailStr
}

/**
 * 
 * @param {import('./typeshit').AlertData} alert
 * @returns {string}
 */
const purreToSaksbehandler = (alert) => {
  let mailStr = `
  <!-- Grønnsaken "purre" på engelsk er "leek". -->
<h1> til saksbehandler</h1>
<p>Dette er en test av purre til saksbehandler</p>
<div style="width: 150px; height: 150px; border: 2px solid #4CAF50;">
${leekSvg}
</div>
`
  return mailStr
}


module.exports = { reportMailToArchive, purreToSaksbehandler }