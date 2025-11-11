// @ts-check

const { callArchive } = require('../../lib/call-archive.js')
const { NODE_ENV, PURRE } = require('../../config.js')
const { ArchiveDocuments } = require('../../lib/archive-types.js')
const { default: z } = require('zod')
const { writeFileSync, existsSync, readFileSync } = require('fs')
const { logger } = require('@vtfk/logger')

/**
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate YYYY-MM-DD
 * @returns {Promise<z.infer<typeof ArchiveDocuments>>}
 */
const getUnansweredDocuments = async (fromDate, toDate) => {
  // Den under er sånn rimelig validert og gitt mot restanseliste (y)
  if (isNaN(new Date(fromDate).getTime())) throw new Error('Invalid fromDate')
  if (isNaN(new Date(toDate).getTime())) throw new Error('Invalid toDate')
  if (new Date(fromDate) >= new Date(toDate)) throw new Error('fromDate must be before toDate')

  const psychoPayload = {
    service: 'DocumentService',
    method: 'GetDocuments',
    parameter: {
      SortingCriterion: 'RecnoAscending',
      IncludeFiles: false,
      IncludeDocumentContacts: true,
      IncludeCustomFields: NODE_ENV !== 'production', // For å se litt mer, kan skru av i prod
      DateCriteria: [
        {
          DateName: 'JournalDate',
          Operator: 'GT',
          DateValue: fromDate // Inclusive
        },
        {
          DateName: 'JournalDate',
          Operator: 'LT',
          DateValue: toDate // Exclusive
        }
      ],
      AdditionalListFields: [
        {
          Name: 'ToDocumentCategory',
          Value: NODE_ENV === 'production' ? [200001, 110, 113] : [200007, 110, 113] // PROD: 101=Epost inn, 110=Dokument inn, 113=Internt notat med oppfølging, TEST: 110=Dokument inn, 200007=Epost inn, 113=Internt notat med oppfølging
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

  const response = await callArchive('archive', psychoPayload)

  return ArchiveDocuments.parse(response)
}

/**
 * 
 * @param {Date} date 
 * @param {number} days 
 * @returns {Date}
 */
const addDays = (date, days) => {
  var result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 
 * @param {string} fromDate YYYY-MM-DD 
 * @param {string} toDate YYYY-MM-DD 
 * @param {number} [batchSizeDays=180] 
 * @returns {Promise<z.infer<typeof ArchiveDocuments>>}
 */
const batchedGetUnansweredDocuments = async (fromDate, toDate, batchSizeDays = 180) => {
  const cachedPath = `./PURRE-SAKSBEHANDLER/ignore/response-cache/unanswered-documents-${NODE_ENV}.json`
  if (PURRE.USE_CACHED_RESPONSE && existsSync(cachedPath)) {
    const cached = JSON.parse(readFileSync(cachedPath, 'utf-8'))
    return ArchiveDocuments.parse(cached)
  }

  const allDocuments = []
  let batchFromDate = new Date(fromDate)
  let batchToDate = addDays(batchFromDate, batchSizeDays)

  if (batchToDate >= new Date(toDate)) {
    logger('info', ['batchedGetUnansweredDocuments', 'Date range is within batch size, fetching all at once'])
    return await getUnansweredDocuments(fromDate, toDate)
  }
  while (batchToDate <= new Date(toDate)) {
    logger('info', ['batchedGetUnansweredDocuments', `Fetching batch from ${batchFromDate.toISOString().split('T')[0]} to ${batchToDate.toISOString().split('T')[0]}`])
    const batchDocuments = await getUnansweredDocuments(batchFromDate.toISOString().split('T')[0], batchToDate.toISOString().split('T')[0])
    logger('info', ['batchedGetUnansweredDocuments', `Fetched ${batchDocuments.length} documents in this batch`])
    allDocuments.push(...batchDocuments)
    batchFromDate = batchToDate
    batchToDate = addDays(batchFromDate, batchSizeDays)
  }
  // Hent siste batch om det trengs
  if (batchFromDate < new Date(toDate)) {
    logger('info', ['batchedGetUnansweredDocuments', `Fetching last batch from ${batchFromDate.toISOString().split('T')[0]} to ${new Date(toDate).toISOString().split('T')[0]}`])
    const batchDocuments = await getUnansweredDocuments(batchFromDate.toISOString().split('T')[0], toDate)
    logger('info', ['batchedGetUnansweredDocuments', `Fetched ${batchDocuments.length} documents in the last batch`])
    allDocuments.push(...batchDocuments)
  }

  if (PURRE.USE_CACHED_RESPONSE) {
    writeFileSync(cachedPath, JSON.stringify(allDocuments, null, 2))
  }

  return ArchiveDocuments.parse(allDocuments)
}

module.exports = { batchedGetUnansweredDocuments }

