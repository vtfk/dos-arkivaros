

/**
 * @typedef {Object} ArchiveUser
 * @property {string} Login
 * @property {number} ContactRecno
 * @property {boolean} IsActive
 * @property {boolean} IsServiceUser
 * @property {Object[]} Profiles
 * @property {string} Profiles[].Role
 * @property {string} Profiles[].EnterpriseRecno
 * @property {?string} Profiles[].ValidFrom
 * @property {?string} Profiles[].ValidTo
 */

/**
 * @typedef {Object} ArchiveResponsibleEnterprise
 * @property {?string} Email
 * @property {number} Recno
 * @property {?string} ExternalId
 * @property {?string} Referencenumber
 * @property {?string} Name
 */

/**
 * @typedef {Object} ArchiveResponsiblePerson
 * @property {?string} Email
 * @property {number} Recno
 * @property {string} UserId
 * @property {?string} Referencenumber
 * @property {?string} Name
 */

/**
 * @typedef {Object} ArchiveDocument
 * @property {number} Recno
 * @property {string} DocumentNumber
 * @property {string} CaseNumber
 * @property {string} Title
 * @property {string} OfficialTitle
 * @property {string} DocumentDate
 * @property {string} JournalDate
 * @property {Object} Category
 * @property {string} Category.name
 * @property {string} Category.code
 * @property {string} Category.description
 * @property {Object} Type
 * @property {string} Type.name
 * @property {string} Type.code
 * @property {string} Type.description
 * @property {string} StatusCode
 * @property {string} StatusDescription
 * @property {string} AccessCodeDescription
 * @property {string} AccessCodeCode
 * @property {string} Paragraph
 * @property {?ArchiveResponsibleEnterprise} ResponsibleEnterprise
 * @property {?ArchiveResponsiblePerson} ResponsiblePerson
 * @property {?string} ResponsiblePersonName
 * @property {?string} AccessGroup
 * @property {string} URL
 */

/**
 * @typedef {Object} EmailStatus
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} AlertResponsiblePerson
 * @property {string} email
 * @property {string} name
 * @property {?number} recno
 * @property {boolean} isActive
 * @property {boolean} isInternal
 * @property {boolean} isServiceUser
 */

/**
 * @typedef {Object} AlertData
 * @property {string} key
 * @property {string[]} emailTo
 * @property {boolean} sendToLeaders
 * @property {boolean} sendToArchive
 * @property {string} reason
 * @property {AlertResponsiblePerson} responsiblePerson
 * @property {EmailStatus} emailStatus
 * @property {ArchiveDocument[]} documents
 */

/**
 * @typedef {Object} Enterprise
 * @property {string} name
 * @property {number} recno
 * @property {import('./get-leaders').LeaderBase[]} leaders
 * @property {Object<string, AlertData>} alerts
 */

/**
 * @typedef {Object.<string, Enterprise>} UnansweredDocumentsForEnterprise
 */

/**
 * @typedef {Object} UnansweredDocumentsReport
 * @property {string} fromDate
 * @property {string} toDate
 * @property {number} totalDocuments
 * @property {UnansweredDocumentsForEnterprise} enterprises
 */


module.exports = {}