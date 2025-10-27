// @ts-check

const { PURRE } = require('../../config')
const { userProfileIsActive } = require('../../lib/archive-helpers')
const { callArchive } = require('../../lib/call-archive')
const { logger } = require('@vtfk/logger')

/**
 * @typedef {Object} LeaderBase
 * @property {string} login
 * @property {number} contactRecno
 */

/**
 * @typedef {LeaderBase & { enterpriseRecnos: string[] }} Leader
 * @typedef {Object<string, { leaders: LeaderBase[] }>} EnterprisesWithLeader
*/

/**
 * @typedef {{ enterpriseWithLeaders: EnterprisesWithLeader, users: import('../typeshit').ArchiveUser[] }} EnterprisesWithLeadersResult
 */

/**
 * @returns {Promise<EnterprisesWithLeadersResult>}
 */
const getEnterprisesWithLeaders = async () => {
  // Den under er sånn rimelig validert og gitt (y)
  const usersPayload = {
    service: 'UserService',
    method: 'GetUsers',
    parameter: {}
  }
  /** @type {import('../typeshit').ArchiveUser[]} */
  const response = await callArchive('archive', usersPayload)
  logger('info', [`Got ${response.length} users from archive`])
  const leaders = response.filter(user => {
    if (!user.IsActive || user.IsServiceUser || !Array.isArray(user.Profiles) || user.Profiles.length === 0) {
      return false
    }
    return user.Profiles.some(profile => profile.Role === '3' && userProfileIsActive(profile)) // Rolle 3 = leder og aktiv periode på profilen
  })
  logger('info', [`Found ${leaders.length} leaders`])
  const mappedLeaders = leaders.map(leader => {
    const activeProfiles = leader.Profiles.filter(userProfileIsActive)
    return {
      login: leader.Login,
      contactRecno: leader.ContactRecno,
      enterpriseRecnos: Array.from(new Set(activeProfiles.filter(profile => profile.Role === '3' && profile.EnterpriseRecno).map(profile => profile.EnterpriseRecno))) // Unike enheter de er leder for
    }
  })
  // Easier with enterprises with array of leaders actually
  /** @type {EnterprisesWithLeader} */
  const enterprisesWithLeaders = {}
  mappedLeaders.forEach(leader => {
    leader.enterpriseRecnos.forEach(entRecno => {
      if (!enterprisesWithLeaders[entRecno]) {
        enterprisesWithLeaders[entRecno] = {
          leaders: []
        }
      }
      if (leader.login.endsWith(PURRE.VALID_EMAIL_SUFFIX)) { // Dont add leaders with invalid email suffix
        enterprisesWithLeaders[entRecno].leaders.push({
          login: leader.login,
          contactRecno: leader.contactRecno
        })
      } else {
        logger('warn', [`Not adding leader ${leader.login} as they do not have valid email suffix (${PURRE.VALID_EMAIL_SUFFIX})`])
      }
    })
  })
  logger('info', [`Mapped leaders to ${Object.keys(enterprisesWithLeaders).length} enterprises, returning`])

  // @ts-ignore
  return { enterpriseWithLeaders: enterprisesWithLeaders, users: response }
}

module.exports = { getEnterprisesWithLeaders }
