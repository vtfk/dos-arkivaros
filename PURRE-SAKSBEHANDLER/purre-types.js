// @ts-check

const { default: z } = require("zod")
const { ArchiveDocument } = require("../lib/archive-types");
const { GetResponsibleUserResult, ResponsibleEnterprise } = require("./archive-stuff/archive-responsibles");

/** @typedef {z.infer<typeof PurreResult>} */
const PurreResult = z.enum(["send_to_archive", "send_to_leaders", "send_to_responsible"]);

/** @typedef {z.infer<typeof PurreResult>} */
const PurreDocumentResult = z.object({
  document: ArchiveDocument,
  reason: z.object({
    code: z.string(),
    reportDescription: z.string(),
    purreDescription: z.string(),
    level: z.enum(['INFO', 'WARNING', 'ERROR'])
  })
})

/** @typedef {z.infer<typeof PurreInput>} */
const PurreInput = z.object({
  responsibleEnterprise: ResponsibleEnterprise,
  responsibleForFollowUp: GetResponsibleUserResult.nullable(),
  purreResult: PurreResult
})

/** @typedef {z.infer<typeof EmailResult>} */
const EmailResult = z.object({
  emailId: z.string().nullable(),
  status: z.enum(['NOT_SENT', 'SENT', 'FAILED']),
}).default({
  emailId: null,
  status: 'NOT_SENT'
})

/** @typedef {z.infer<typeof PurreReceiver>} */
const PurreReceiver = z.object({
  receiverId: z.string(),
  toAddresses: z.array(z.email()),
  responsibleEnterprise: ResponsibleEnterprise,
  responsibleForFollowUp: GetResponsibleUserResult.nullable(),
  purreResult: PurreResult,
  documentResults: z.array(PurreDocumentResult),
  emailResult: EmailResult
})

/** @typedef {z.infer<typeof UnansweredDocumentsReport>} */
const UnansweredDocumentsReport = z.object({
  /** Journaldato fra */
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
  totalDocuments: z.number(),
  purreReceivers: z.array(PurreReceiver)
})

/** @typedef {z.infer<typeof DocumentPurre>} */
const DocumentPurre = z.object({
  receiver: PurreReceiver,
  documentResult: PurreDocumentResult
})

module.exports = {
  PurreResult,
  PurreDocumentResult,
  PurreInput,
  EmailResult,
  PurreReceiver,
  UnansweredDocumentsReport,
  DocumentPurre,
}
