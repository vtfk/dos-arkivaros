const { APPREG, FINTFOLK } = require('../config')
const { getMsalToken } = require('./get-msal-token')
const axios = require('./axios-instance').getAxiosInstance()

module.exports.callFintfolk = async (endpoint) => {
  if (!endpoint) throw new Error('Missing required parameter "endpoint"')

  const authConfig = {
    clientId: APPREG.CLIENT_ID,
    tenantId: APPREG.TENANT_ID,
    clientSecret: APPREG.CLIENT_SECRET,
    scope: FINTFOLK.SCOPE
  }
  const accessToken = await getMsalToken(authConfig)
  const { data } = await axios.get(`${FINTFOLK.URL}/${endpoint}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  return data
}
