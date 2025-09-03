// @ts-check

const { config } = require('dotenv')
const { DefaultAzureCredential } = require('@azure/identity')

if (!process.env.AZURE_CLIENT_ID) {
  config()
}

const defaultAzureCredential = new DefaultAzureCredential({})

/**
 * 
 * @param {string | string[]} scopes 
 * @returns {Promise<string>}
 */
const getMsalToken = async (scopes) => {
  const tokenResponse = await defaultAzureCredential.getToken(scopes)
  return tokenResponse.token
}

module.exports = { getMsalToken }
