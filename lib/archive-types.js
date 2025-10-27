// @ts-check

const { default: z, email } = require("zod")

const ArchiveUser = z.object({
  Login: z.string(),
  IsActive: z.boolean(),
  Profiles: z.array(z.object({
    Role: z.string(),
    RoleDescription: z.string(),
    EnterpriseRecno: z.string(),
    FromDate: z.iso.datetime({ local: true }).nullable(),
    ToDate: z.iso.datetime({ local: true }).nullable()
  })),
  IsServiceUser: z.boolean(),
  ContactRecno: z.number()
})

const ArchiveUsers = z.array(ArchiveUser)

const ArchiveContact = z.object({
  Recno: z.number(),
  Email: z.email().nullable(),
  FirstName: z.string().nullable(),
  LastName: z.string().nullable(),
  EnterpriseEntity: z.object({
    Recno: z.number(),
    ExternalId: z.string(),
    Referencenumber: z.string()
  })
})

/*
EnterpriseEntity": {
      "Recno": 200015,
      "ExternalId": "44000",
      "Referencenumber": ""
    },
*/

const ArchiveContacts = z.array(ArchiveContact)

const ArchiveEnterprise = z.object({
  Recno: z.number(),
  Name: z.string(),
  EnterpriseNumber: z.string(),
  ExternalID: z.string()
})

const ArchiveEnterprises = z.array(ArchiveEnterprise)

const ArchiveDocument = z.object({
  Recno: z.number(),
  DocumentNumber: z.string(),
  CaseNumber: z.string(),
  Title: z.string(),
  OfficialTitle: z.string(),
  DocumentDate: z.iso.datetime({ local: true }).nullable(),
  JournalDate: z.iso.datetime({ local: true }),
  Category: z.object({
    Recno: z.number(),
    Code: z.string(),
    Description: z.string()
  }),
  Type: z.object({
    Recno: z.number(),
    Code: z.string(),
    Description: z.string()
  }),
  StatusCode: z.string(),
  StatusDescription: z.string(),
  ResponsibleEnterprise: z.object({
    Recno: z.number(),
    Name: z.string(),
    ExternalId: z.string(),
    Referencenumber: z.string().nullable(),
    Email: z.string().nullable()
  }),
  ResponsiblePerson: z.object({
    Recno: z.number(),
    UserId: z.string().nullable(),
    Email: z.string(), // P360 have some weird emails that are not valid according to zod email validator,
    Referencenumber: z.string().nullable(),
    Name: z.string().nullable()
  }).nullable(),
  Contacts: z.array(z.object({
    Role: z.string(),
    ContactRecno: z.string(),
    Email: z.string(), // P360 have some weird emails that are not valid according to zod email validator
    ContactType: z.enum(['', 'Virksomhet', 'Kontaktperson', 'Privatperson', 'Utvalg']),
    SearchName: z.string()
  })).nullable(),
  AccessGroup: z.string(),
  URL: z.string()
})

const ArchiveDocuments = z.array(ArchiveDocument)

module.exports = {
  ArchiveUser,
  ArchiveUsers,
  ArchiveContact,
  ArchiveContacts,
  ArchiveEnterprise,
  ArchiveEnterprises,
  ArchiveDocument,
  ArchiveDocuments
}