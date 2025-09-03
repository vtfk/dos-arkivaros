// @ts-check

const { ARCHIVE } = require('../config')
const { getMsalToken } = require('./get-msal-token')
const axios = require('./axios-instance').getAxiosInstance()

module.exports.callArchive = async (endpoint, payload) => {
  if (!endpoint) throw new Error('Missing required parameter "endpoint"')
  if (!payload) throw new Error('Missing required parameter "payload"')

  if (!ARCHIVE.SCOPE) throw new Error('Missing config value "ARCHIVE.SCOPE"')
  const accessToken = await getMsalToken(ARCHIVE.SCOPE)
  const { data } = await axios.post(`${ARCHIVE.URL}/${endpoint}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
