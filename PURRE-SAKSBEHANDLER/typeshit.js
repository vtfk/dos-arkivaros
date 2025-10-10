

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
 * @typedef {Object} ArchiveDocumentContact
 * @property {?string} Role
 * @property {?string} ContactRecno
 * @property {?string} Email
 * @property {"Virksomhet" | "Kontaktperson"} ContactType
 * @property {?string} SearchName
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
 * @property {string} Category.Recno
 * @property {string} Category.Code
 * @property {string} Category.Description
 * @property {Object} Type
 * @property {string} Type.Recno
 * @property {string} Type.Code
 * @property {string} Type.Description
 * @property {string} StatusCode
 * @property {string} StatusDescription
 * @property {string} AccessCodeDescription
 * @property {string} AccessCodeCode
 * @property {string} Paragraph
 * @property {?ArchiveResponsibleEnterprise} ResponsibleEnterprise
 * @property {?ArchiveResponsiblePerson} ResponsiblePerson
 * @property {?string} ResponsiblePersonName
 * @property {ArchiveDocumentContact[]} Contacts
 * @property {?string} AccessGroup
 * @property {string} URL
 */

/**
 * @typedef {Object} EmailStatus
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} EmailToResult
 * @property {string[]} emailTo
 * @property {boolean} sendToLeaders
 * @property {boolean} sendToArchive
 */

/**
 * @typedef {Object} DocumentReason
 * @property {string} code
 * @property {string} reportDescription
 * @property {string} purreDescription
 * @property {"INFO" | "WARNING"} level
 */

/**
 * @typedef {Object} DocumentResults
 * @property {DocumentReason} reason
 * @property {ArchiveDocument} document
 */

/**
 * @typedef {Object} GetUserResult
 * @property {ArchiveUser} [user]
 * @property {?string} email
 * @property {?string} name
 * @property {boolean} canSend
 * @property {string} reason
 */

/**
 * @typedef {Object} UnansweredPurreData
 * @property {EmailToResult} emailToResult
 * @property {?GetUserResult} responsibleForFollowUp
 * @property {EmailStatus} emailStatus
 * @property {DocumentResults[]} documentResults
 */

/**
 * @typedef {Object} Enterprise
 * @property {string} name
 * @property {string | number} recno
 * @property {import('./get-leaders').LeaderBase[]} leaders
 * @property {Object<string, UnansweredPurreData>} alerts
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