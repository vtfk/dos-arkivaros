// @ts-check

(async () => {
  const { logger, logConfig } = require('@vtfk/logger')
  const { createLocalLogger } = require('../lib/local-logger')
  const { unansweredDocumentsPurre } = require('./unanswered-documents-purre')
  const { reservedDocumentsPurre } = require('./reservered-documents-purre')


  // Først setter vi opp litt logging
  // Set up logging
  logConfig({
    prefix: 'PURRE',
    teams: {
      onlyInProd: false
    },
    localLogger: createLocalLogger('PURRE')
  })


  logger('info', ['Boom boom, starting new run'])

  const fromDate = '2024-01-01'
  const toDate = '2025-09-30'

  await unansweredDocumentsPurre(fromDate, toDate)
  await reservedDocumentsPurre(fromDate, toDate)
})()