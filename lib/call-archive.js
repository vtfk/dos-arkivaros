const { APPREG, ARCHIVE } = require('../config')
const { getMsalToken } = require('./get-msal-token')
const axios = require('./axios-instance').getAxiosInstance()

module.exports.callArchive = async (endpoint, payload) => {
  if (!endpoint) throw new Error('Missing required parameter "endpoint"')
  if (!payload) throw new Error('Missing required parameter "payload"')

  const authConfig = {
    clientId: APPREG.CLIENT_ID,
    tenantId: APPREG.TENANT_ID,
    clientSecret: APPREG.CLIENT_SECRET,
    scope: ARCHIVE.SCOPE
  }
  const accessToken = await getMsalToken(authConfig)
  const { data } = await axios.post(`${ARCHIVE.URL}/${endpoint}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
