const { logger } = require("@vtfk/logger")
const { AxiosError } = require("axios")

/**
 * 
 * @param {string} msg 
 * @param {*} error 
 */
const logErrorAndExit = (msg, error) => {
  if (error instanceof AxiosError) {
    logger('error', [msg, error?.response?.data || error.stack || error.toString()])
  } else if (error instanceof Error) {
    logger('error', [msg, error.stack || error.toString()])
  } else {
    logger('error', [msg, 'Unknown error type', error])
  }
  process.exit(1)
}

module.exports = { logErrorAndExit }