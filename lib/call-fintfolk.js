// @ts-check

const { FINTFOLK } = require('../config')
const { getMsalToken } = require('./get-msal-token')
const axios = require('./axios-instance').getAxiosInstance()

/**
 *
 * @param {string} endpoint
 * @returns {Promise<Object>}
 */
module.exports.callFintfolk = async (endpoint) => {
  if (!endpoint) throw new Error('Missing required parameter "endpoint"')

  if (!FINTFOLK.SCOPE) throw new Error('Missing config value "FINTFOLK.SCOPE"')
  const accessToken = await getMsalToken(FINTFOLK.SCOPE)
  const { data } = await axios.get(`${FINTFOLK.URL}/${endpoint}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
