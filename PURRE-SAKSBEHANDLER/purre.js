// @ts-check

const { default: z } = require("zod");
const { PURRE } = require("../config");
const { PurreInput, PurreReceiver } = require("./purre-types");


/**
 * 
 * @param {z.infer<typeof PurreInput>} purreInput 
 * @returns {z.infer<typeof PurreReceiver>} 
 */
const createPurreReceiver = (purreInput) => {
  purreInput = PurreInput.parse(purreInput, { reportInput: true })

  if (purreInput.purreResult === 'send_to_leaders' && purreInput.responsibleEnterprise.leaders.length === 0) {
    throw new Error('Cannot send to leaders if there are no leaders, check your code')
  }
  if (purreInput.responsibleForFollowUp && !purreInput.responsibleForFollowUp.canReceivePurre) {
    throw new Error('Cannot send to responsibleForFollowUp if they cannot receive, check your code')
  }
  if (purreInput.purreResult === 'send_to_responsible' && !purreInput.responsibleForFollowUp) {
    throw new Error('Cannot send to responsible if responsibleForFollowUp is null, check your code')
  }
  const receiverId = purreInput.purreResult === 'send_to_archive' ? '00_archive' : purreInput.purreResult === 'send_to_leaders' ? `01_leaders-${purreInput.responsibleEnterprise.enterprise.Recno}` : purreInput.responsibleForFollowUp?.email
  if (!receiverId) {
    throw new Error('No receiverId could be determined, check your code')
  }
  const toAddresses = purreInput.purreResult === 'send_to_archive' ? [PURRE.ARCHIVE_EMAIL] : purreInput.purreResult === 'send_to_leaders' ? purreInput.responsibleEnterprise.leaders.map(leader => leader.contact.Email) : [purreInput.responsibleForFollowUp?.email]
  if (toAddresses.length === 0) {
    throw new Error('No toAddresses could be determined, check your code')
  }
  return PurreReceiver.parse({
    receiverId,
    toAddresses,
    responsibleEnterprise: purreInput.responsibleEnterprise,
    responsibleForFollowUp: purreInput.responsibleForFollowUp || null,
    purreResult: purreInput.purreResult,
    documentResults: []
  })
}

module.exports = {
  createPurreReceiver
}