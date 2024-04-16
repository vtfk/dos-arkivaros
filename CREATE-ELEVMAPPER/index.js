(async () => {
  /* USER CONFIG */

  const inputList = require('./input.json') // Legg inn sti til det du trenger
  const timeoutInterval = 0 // Seconds
  const outputListPath = './CREATE-ELEVMAPPER/failed.json'
  
  /* END USER CONFIG */

  const { callArchive } = require('../lib/call-archive')
  const { logger, logConfig } = require('@vtfk/logger')
  const { writeFileSync } = require('fs')
  const { createLocalLogger } = require('../lib/local-logger')


  logConfig({
    prefix: 'CREATE-ELEVMAPPER',
    localLogger: createLocalLogger('CREATE-ELEVMAPPER')
  })

  const sleep = (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
  }

  const failedRequests = []

  let index = 0
  for (const person of inputList) {
    index++
    logger('info', [`Handling person ${index} of ${inputList.length}`])
    const hasRequiredProps = person.ssn || (person.birthdate && (person.name || (person.firstName && person.lastName)))
    if (!hasRequiredProps) {
      logger('warn', ['Person does not have required attributes, please check'])
      failedRequests.push({
        ...person,
        reason: 'Missing required properties',
        error: 'Missing required properties'
      })
      continue
    }
    if (person.ssn && person.ssn.length !== 11) {
      logger('warn', ['Ssn is not length 11'])
      failedRequests.push({
        ...person,
        reason: 'Ssn is not length 11',
        error: 'Ssn is not length 11'
      })
      continue
    }
    try {
      const syncElevmappeResult = await callArchive('SyncElevmappe', person)
      logger('info', [`Succesfully synced elevmappe for ${person.ssn || person.name || person.firstName}`, syncElevmappeResult.elevmappe.CaseNumber])
    } catch (error) {
      logger('warn', [`Failed when syncing elevmappe for ${person.ssn || person.name || person.firstName}`, error.response?.data || error.stack || error.toString()])
      failedRequests.push({
        ...person,
        reason: 'Failed in web-request',
        error: error.response?.data || error.stack || error.toString()
      })
    }

    if (timeoutInterval > 0) {
      await sleep(1000 * timeoutInterval) // If we should wait in between requests
    }
  }

  writeFileSync(outputListPath, JSON.stringify(failedRequests, null, 2))
})()
