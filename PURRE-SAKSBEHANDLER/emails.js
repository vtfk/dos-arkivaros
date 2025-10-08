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


<svg width="200" height="400" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient for stilken -->
    <linearGradient id="stemGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#e6f2e6; stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ffffff; stop-opacity:1" />
    </linearGradient>

    <!-- Gradient for bladene -->
    <linearGradient id="leafGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#2e7d32; stop-opacity:1" />
      <stop offset="100%" style="stop-color:#66bb6a; stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Blader -->
  <path d="M100 40 C80 0, 40 20, 60 100 C70 130, 90 130, 100 100 Z" fill="url(#leafGradient)"/>
  <path d="M100 40 C120 0, 160 20, 140 100 C130 130, 110 130, 100 100 Z" fill="url(#leafGradient)"/>

  <!-- Stilk -->
  <path d="M85 100 C80 180, 80 260, 90 300 C100 320, 110 320, 120 300 C130 260, 130 180, 115 100 Z" fill="url(#stemGradient)" stroke="#ccc" stroke-width="1"/>

  <!-- Røtter -->
  <path d="M90 300 Q100 330, 110 300" stroke="#a67c52" stroke-width="3" fill="none"/>
  <path d="M95 300 Q100 315, 105 300" stroke="#a67c52" stroke-width="2" fill="none"/>
</svg>


`
  for (const [enterpriseRecno, enterpriseData] of Object.entries(unansweredDocumentsReport.enterprises)) {
    mailStr += `<h2>${enterpriseData.name}</h2>\n`
    for (const [emailAddress, alertData] of Object.entries(enterpriseData.alerts)) {
      mailStr += `<div style="border: 2px solid #ccc; padding: 16px; margin-bottom: 16px;">\n`
      mailStr += `<h3>Epost til: ${alertData.emailTo.join(', ')}</h3>\n`
      if (alertData.reason) {
        mailStr += `<br /><span style="color: #C70000;">OBS! ${alertData.reason}</span><br />`
      }
      mailStr += `<p><strong>Ansvarlig person: ${alertData.responsiblePerson.name} (${alertData.responsiblePerson.email})</strong></p>`
      mailStr += `<p>Dokumenter: ${alertData.documents.length}</p>\n`
      // Så lister vi opp dokumentene og
      mailStr += `<ul>\n`
      for (const document of alertData.documents) {
        mailStr += `<li><a href="${PURRE.LOCATOR_BASE_URL}${document.URL}" target="_blank">${document.DocumentNumber} - ${document.OfficialTitle}</a></li>\n`
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