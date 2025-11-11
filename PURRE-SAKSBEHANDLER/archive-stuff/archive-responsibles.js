// @ts-check

const { logger } = require("@vtfk/logger")
const { default: z } = require("zod")
const { callArchive } = require("../../lib/call-archive")
const { userProfileIsActive } = require("../../lib/archive-helpers")
const { PURRE, NODE_ENV } = require("../../config")
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs")
const { ArchiveContact, ArchiveContacts, ArchiveEnterprise, ArchiveEnterprises, ArchiveUser, ArchiveUsers } = require("../../lib/archive-types")


/** @typedef {z.infer<typeof ResponsibleUser>} ResponsibleUser */
const ResponsibleUser = z.object({
  user: ArchiveUser,
  contact: ArchiveContact.nullable(),
})

/** @typedef {z.infer<typeof ResponsibleLeader>} ResponsibleLeader */
const ResponsibleLeader = z.object({
  user: ArchiveUser,
  contact: ArchiveContact.extend({
    Email: z.email()
  }).omit({ EnterpriseEntity: true })
})

/** @typedef {z.infer<typeof ResponsibleEnterprise>} ResponsibleEnterprise */
const ResponsibleEnterprise = z.object({
  enterprise: ArchiveEnterprise,
  leaders: z.array(ResponsibleLeader)
})

/** @typedef {z.infer<typeof ResponsibleEnterprises>} ResponsibleEnterprises */
const ResponsibleEnterprises = z.array(ResponsibleEnterprise)

/** @typedef {z.infer<typeof Responsibles>} Responsibles */
const Responsibles = z.object({
  users: z.array(ResponsibleUser),
  enterprises: ResponsibleEnterprises
})

/** @typedef {z.infer<typeof GetResponsibleUserResult>} GetResponsibleUserResult */
const GetResponsibleUserResult = z.object({
  user: ArchiveUser.nullable(),
  contact: ArchiveContact.nullable(),
  email: z.email().nullable(),
  canReceivePurre: z.boolean(),
  reason: z.string().nullable()
})

/** @type {Responsibles} */
const responsibles = {
  users: [],
  enterprises: []
}

const getArchiveResponsibles = async () => {
  if (responsibles.enterprises.length === 0 || responsibles.users.length === 0) {
    logger('info', ['Nothing in naughty cache, fetching archive responsibles data, starting with users'])
    const usersPayload = {
      service: 'UserService',
      method: 'GetUsers',
      parameter: {}
    }
    if (PURRE.USE_CACHED_RESPONSE && !existsSync('./PURRE-SAKSBEHANDLER/ignore/response-cache')) {
      mkdirSync('./PURRE-SAKSBEHANDLER/ignore/response-cache', { recursive: true })
    }
    const usersCachePath = `./PURRE-SAKSBEHANDLER/ignore/response-cache/archive-users-${NODE_ENV}.json`
    // @ts-ignore
    const usersResponse = PURRE.USE_CACHED_RESPONSE && existsSync(usersCachePath) ? JSON.parse(readFileSync(usersCachePath)) : await callArchive('archive', usersPayload)
    if (PURRE.USE_CACHED_RESPONSE && !existsSync(usersCachePath)) {
      writeFileSync(usersCachePath, JSON.stringify(usersResponse, null, 2))
    }
    const archiveUsers = ArchiveUsers.parse(usersResponse)
    logger('info', [`Got ${archiveUsers.length} users from archive, fetching contacts as well`])
    const contactsPayload = {
      service: 'ContactService',
      method: 'GetContactPersons',
      parameter: {
        Categories: ["Intern"]
      }
    }
    const contactsCachePath = `./PURRE-SAKSBEHANDLER/ignore/response-cache/archive-contacts-${NODE_ENV}.json`
    // @ts-ignore
    const contactsResponse = PURRE.USE_CACHED_RESPONSE && existsSync(contactsCachePath) ? JSON.parse(readFileSync(contactsCachePath)) : await callArchive('archive', contactsPayload)
    if (PURRE.USE_CACHED_RESPONSE && !existsSync(contactsCachePath)) {
      writeFileSync(contactsCachePath, JSON.stringify(contactsResponse, null, 2))
    }
    const archiveContacts = ArchiveContacts.parse(contactsResponse)
    logger('info', [`Got ${archiveContacts.length} contacts from archive, fetching enterprises as well`])
    const enterprisesPayload = {
      service: 'ContactService',
      method: 'GetEnterprises',
      parameter: {
        Categories: ["Intern"]
      }
    }
    const enterprisesCachePath = `./PURRE-SAKSBEHANDLER/ignore/response-cache/archive-enterprises-${NODE_ENV}.json`
    // @ts-ignore
    const enterprisesResponse = PURRE.USE_CACHED_RESPONSE && existsSync(enterprisesCachePath) ? JSON.parse(readFileSync(enterprisesCachePath)) : await callArchive('archive', enterprisesPayload)
    if (PURRE.USE_CACHED_RESPONSE && !existsSync(enterprisesCachePath)) {
      writeFileSync(enterprisesCachePath, JSON.stringify(enterprisesResponse, null, 2))
    }
    const archiveEnterprises = ArchiveEnterprises.parse(enterprisesResponse)
    logger('info', [`Got ${archiveEnterprises.length} enterprises from archive, caching all data for future use`])

    
    responsibles.users = archiveUsers.map(user => {
      const contact = archiveContacts.find(c => c.Recno === user.ContactRecno) || null
      if (!contact && !PURRE.IGNORE_LOGINS.includes(user.Login)) {
        logger('warn', [`Could not find contact for user with login ${user.Login} and contact recno ${user.ContactRecno}`])
        return { user, contact: null }
        // throw new Error(`Could not find contact for user with login ${user.Login} and contact recno ${user.ContactRecno}`)
      }
      return { user, contact }
    })
    responsibles.enterprises = ResponsibleEnterprises.parse(archiveEnterprises.map(enterprise => {
      const leaders = responsibles.users.filter(rUser => {
        const user = rUser.user
        if (user.Profiles.length === 0) return false
        if (!user.IsActive || user.IsServiceUser) return false
        if (!rUser.contact?.Email || !rUser.contact.Email.endsWith(PURRE.VALID_EMAIL_SUFFIX)) return false
        if (!z.email().safeParse(rUser.contact.Email).success) return false
        return user.Profiles.some(profile => {
          // Role 3 = leder
          return profile.EnterpriseRecno === enterprise.Recno.toString() && profile.Role === '3' && userProfileIsActive(profile)
        })
      })
      return { enterprise, leaders }
    }))
    logger('info', ['Finished caching archive responsibles data'])
  } else {
    logger('info', ['We have data in memoory already, just using that'])
  }
  writeFileSync('./PURRE-SAKSBEHANDLER/ignore/responsibles-cache.json', JSON.stringify(responsibles, null, 2))
  
  /**
   * 
   * @param {string | number} contactRecno
   * @returns {z.infer<typeof GetResponsibleUserResult>}
   */
  const getResponsibleUser = (contactRecno) => {
    const searchRecno = Number(contactRecno)
    if (isNaN(searchRecno)) {
      throw new Error(`Invalid contact recno provided: ${contactRecno}, must be a number or numeric string`)
    }
    const responsibleUser = responsibles.users.find(rUser => rUser.user.ContactRecno === searchRecno)

    // Sjekk om vi skal override Email til userId
    let useUserIdAsEmail = false
    if (!responsibleUser?.contact?.Email?.toLowerCase().endsWith(PURRE.VALID_EMAIL_SUFFIX)) {
      if (responsibleUser?.user.Login.toLowerCase().endsWith(PURRE.VALID_EMAIL_SUFFIX)) {
        useUserIdAsEmail = true
      }
    }

    const responsibleEmail = useUserIdAsEmail ? responsibleUser?.user.Login : responsibleUser?.contact?.Email || null

    const result = GetResponsibleUserResult.parse({
      user: responsibleUser?.user || null,
      contact: responsibleUser?.contact || null,
      email: responsibleEmail,
      canReceivePurre: false,
      reason: null
    })
    if (!responsibleUser) {
      result.reason = `Fant ingen bruker med kontakt-recno: ${contactRecno}`
      return result
    }
    if (!responsibleUser.user.IsActive) {
      result.reason = `Bruker ${responsibleEmail || 'mangler mail'} (${contactRecno}) er ikke aktiv`
      return result
    }
    const isInternal = responsibleEmail?.toLowerCase().endsWith(PURRE.VALID_EMAIL_SUFFIX)
    if (!isInternal) {
      result.reason = `Bruker ${responsibleEmail || 'mangler mail'} (${contactRecno}) har ikke gyldig epostadresse (${PURRE.VALID_EMAIL_SUFFIX})`
      return result
    }
    if (responsibleUser.user.IsServiceUser) {
      result.reason = `Bruker ${responsibleEmail || 'mangler mail'} (${contactRecno}) er en servicebruker`
      return result
    }
    if (!responsibleEmail) {
      result.reason = `Bruker ${contactRecno} har ikke epostadresse??`
      return result
    }
    result.canReceivePurre = true
    return result
  }
  /**
   * 
   * @param {string | number} enterpriseRecno 
   * @returns {z.infer<typeof ResponsibleEnterprise>}
   */
  const getResponsibleEnterprise = (enterpriseRecno) => {
    const searchRecno = Number(enterpriseRecno)
    if (isNaN(searchRecno)) {
      throw new Error(`Invalid enterprise recno provided: ${enterpriseRecno}, must be a number or numeric string`)
    }
    const responsibleEnterprise = responsibles.enterprises.find(rEnt => rEnt.enterprise.Recno === searchRecno)
    if (!responsibleEnterprise) {
      throw new Error(`Could not find responsible enterprise with recno: ${enterpriseRecno}`)
    }
    return responsibleEnterprise
  }
  return { getResponsibleUser, getResponsibleEnterprise }
}

module.exports = { getArchiveResponsibles, GetResponsibleUserResult, ResponsibleEnterprise }
