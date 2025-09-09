// @ts-check
(async () => {
  const { callArchive } = require('../lib/call-archive')
  const { NODE_ENV } = require('../config.js')
  const { writeFileSync } = require('fs')

  const psychoPayload = {
    service: 'DocumentService',
    method: 'GetDocuments',
    parameter: {
      IncludeFiles: false,
      IncludeDocumentContacts: true,
      IncludeCustomFields: true, // For å se litt mer, kan skru av i prod
      DateCriteria: [
        {
          DateName: 'JournalDate',
          Operator: 'LT',
          DateValue: '2024-02-01'
        },
        {
          DateName: 'JournalDate',
          Operator: 'GT',
          DateValue: '2024-01-01'
        }
      ],
      AdditionalListFields: [
        {
          Name: 'ToDocumentCategory',
          Value: NODE_ENV === 'production' ? [101, 110, 113] : [200007, 110, 113] // PROD: 101=Epost inn, 110=Dokument inn, 113=Internt notat med oppfølging, TEST: 110=Dokument inn, 200007=Epost inn, 113=Internt notat med oppfølging
        }
      ],
      AdditionalFields: [
        {
          Name: 'ToJournalStatus', // IKKE dokumenter med status Utgår
          Value: 8,
          OperatorType: '!='
        },
        {
          Name: 'ToDocumentArchive', // IKKE dokumenter fra Importarkiv (uregistrerte meg bekjent hvertfall)
          Value: 7,
          OperatorType: '!='
        },
        // Det under: IKKE dokumenter som er avskrevet med koder: BU(1) NN(2) TLF(3) TE(4) TO(5) ***(6) SA(7) BI(8) GG(9)
        {
          Name: 'ToResponseCode',
          Value: 1, // BU (Besvart utgående)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 2, // NN (Besvart nytt notat)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 3, // TLF (Besvart pr tlf)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 4, // TE (Tatt til etterretning)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 5, // TO (Tatt til orientering)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 6, // *** (Midlertidig svar sendt)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 7, // SA (Sak avsluttet)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 8, // BI (Besvart med inngående dokument)
          OperatorType: '!='
        },
        {
          Name: 'ToResponseCode',
          Value: 9, // GG (Gjennomgått)
          OperatorType: '!='
        }
      ]
    }
  }

  try {
    const response = await callArchive('/archive', psychoPayload)
    console.log('Response:', response.length, 'documents')
    writeFileSync('./PURRE-SAKSBEHANDLER/ignore/ubesvart_drit.json', JSON.stringify(response, null, 2))
  } catch (error) {
    console.error('Error calling archive:', error)
  }
})()
