// @ts-check

const { batchedGetUnansweredDocuments } = require('./archive-stuff/get-unanswered-documents')
const { logger } = require('@vtfk/logger')
const { writeFileSync } = require('fs')
const { unansweredDocumentEmailTemplates } = require('./email-stuff/email-templates')
const { sendPurreMail } = require('./email-stuff/send-mail')
const { getArchiveResponsibles } = require('./archive-stuff/archive-responsibles')
const { default: z } = require('zod')
const { createPurreReceiver } = require('./purre')
const { ArchiveDocument } = require('../lib/archive-types')
const { DocumentPurre, UnansweredDocumentsReport } = require('./purre-types')


/**
 * @param {string} fromDate
 * @param {string} toDate
 */
const unansweredDocumentsPurre = async (fromDate, toDate) => {
  // Valider input dates
  if (!fromDate || isNaN(Date.parse(fromDate))) {
    throw new Error('Invalid fromDate, must be YYYY-MM-DD')
  }
  if (!toDate || isNaN(Date.parse(toDate))) {
    throw new Error('Invalid toDate, must be YYYY-MM-DD')
  }

  const archiveResponsibles = await getArchiveResponsibles()
  const unansweredDocuments = await batchedGetUnansweredDocuments(fromDate, toDate)

  /**
   * 
   * @param {z.infer<typeof ArchiveDocument>} document 
   * @returns {z.infer<typeof DocumentPurre>}
   */
  const createPurreFromDocument = (document) => {
    // Finn ut hvem som skal få purre, legg inn eller finn receiver, og dokumentresultatet i den receiveren
    // Hent ut responisbleUnit rett fra dokumentet (bare for å ha den)
    const documentResponsibleUnit = archiveResponsibles.getResponsibleEnterprise(document.ResponsibleEnterprise.Recno)
    // Sjekker først om det er internt notat med oppfølging
    const isInternalNoteWithFollowUp = document.Category.Code === 'Internt notat med oppfølging'
    if (isInternalNoteWithFollowUp) {
      const recipient = Array.isArray(document.Contacts) ? document.Contacts.find(contact => contact.Role === 'Mottaker') : null
      // If no recipient or recipient is not kontaktperson and not virksomhet, we cannot use it - send to archive
      if (!recipient || (recipient?.ContactType !== 'Kontaktperson' && recipient?.ContactType !== 'Virksomhet')) {
        return DocumentPurre.parse({
          receiver: createPurreReceiver({
            purreResult: 'send_to_archive',
            responsibleEnterprise: documentResponsibleUnit,
            responsibleForFollowUp: null
          }),
          documentResult: {
            document,
            reason: {
              code: 'INTERNAL_NOTE_RECIPIENT_INVALID',
              reportDescription: `Mottaker for internt notat er ikke kontaktperson eller virksomhet. Må håndteres av arkiv`,
              purreDescription: `Mottaker for internt notat er ikke kontaktperson eller virksomhet.`,
              level: 'WARNING'
            }
          }
        })
      }
      // Sjekk om vi kan bruke kontaktpersonen som mottaker
      if (recipient?.ContactType === 'Kontaktperson' && recipient?.ContactRecno) { // Her ønsker vi å bruke kontaktperson som mottaker, sjekk at vi kan
        const userResult = archiveResponsibles.getResponsibleUser(recipient.ContactRecno)
        if (userResult.canReceivePurre) {
          // Bruk mottaker og vi er fornøyd
          if (!userResult.contact?.Email || !userResult.contact?.FirstName || !userResult.contact?.LastName) {
            throw new Error(`UserResult is missing receiver contact info for document ${document.Recno}, but canReceivePurre is true, check your code`)
          }
          return DocumentPurre.parse({
            receiver: createPurreReceiver({
              purreResult: 'send_to_responsible',
              responsibleEnterprise: documentResponsibleUnit,
              responsibleForFollowUp: userResult
            }),
            documentResult: {
              document,
              reason: {
                code: 'INTERNAL_NOTE_RECIPIENT',
                reportDescription: `${userResult.contact.FirstName + ' ' + userResult.contact.LastName} er mottaker for internt notat med oppfølging.`,
                purreDescription: 'Du står som mottaker på internt notat med oppfølging.',
                level: 'INFO'
              }
            }
          })
        }
        // Hvis ikke vi kan sende, så sender vi til arkiv i stedet med en begrunnelse på selve dokumentet
        return DocumentPurre.parse({
          receiver: createPurreReceiver({
            purreResult: 'send_to_archive',
            responsibleEnterprise: documentResponsibleUnit,
            responsibleForFollowUp: null
          }),
          documentResult: {
            document,
            reason: {
              code: 'INTERNAL_NOTE_RECIPIENT_INVALID',
              reportDescription: `Mottaker for internt notat kan ikke brukes: ${userResult.reason}. Må håndteres av arkiv`,
              purreDescription: `Mottaker for internt notat kan ikke brukes: ${userResult.reason}.`,
              level: 'WARNING'
            }
          }
        })
      }
      // Hvis fortsatt internt notat, og virksomhet som mottaker, så sender må vi sende til lederne for virksomheten (hvis de finnes)
      if (recipient?.ContactType === 'Virksomhet' && recipient?.ContactRecno && recipient.SearchName) {
        const recipientResponsibleEnterprise = archiveResponsibles.getResponsibleEnterprise(recipient.ContactRecno)
        if (recipientResponsibleEnterprise.leaders.length > 0) {
          return DocumentPurre.parse({
            receiver: createPurreReceiver({
              purreResult: 'send_to_leaders',
              responsibleEnterprise: recipientResponsibleEnterprise,
              responsibleForFollowUp: null
            }),
            documentResult: {
              document,
              reason: {
                code: 'INTERNAL_NOTE_ENTERPRISE_RECIPIENT',
                reportDescription: `${recipientResponsibleEnterprise.enterprise.Name} er mottaker for internt notat med oppfølging. Sender til leder(e) for denne virksomheten.`,
                purreDescription: `${recipientResponsibleEnterprise.enterprise.Name} står som mottaker på internt notat med oppfølging. Du er registrert som leder for denne enheten.`,
                level: 'INFO'
              }
            }
          })
        }
        // Hvis ingen ledere, send til arkiv med begrunnelse
        return DocumentPurre.parse({
          receiver: createPurreReceiver({
            purreResult: 'send_to_archive',
            responsibleEnterprise: documentResponsibleUnit,
            responsibleForFollowUp: null
          }),
          documentResult: {
            document,
            reason: {
              code: 'INTERNAL_NOTE_ENTERPRISE_RECIPIENT_INVALID',
              reportDescription: `Ingen ledere funnet for virksomhet ${recipientResponsibleEnterprise.enterprise.Name} satt som mottaker`,
              purreDescription: `Ingen ledere funnet for virksomhet ${recipientResponsibleEnterprise.enterprise.Name} satt som mottaker`,
              level: 'WARNING'
            }
          }
        })
      }
    }
    // Da var det ikke internt notat med oppfølging, så vi sjekker om vi kan sende til ansvarlig person
    const responsibleUser = document.ResponsiblePerson?.Recno ? archiveResponsibles.getResponsibleUser(document.ResponsiblePerson.Recno) : null
    if (responsibleUser?.canReceivePurre) {
      // Da kan vi bruke ansvarlig person og er fornøyd
      return DocumentPurre.parse({
        receiver: createPurreReceiver({
          purreResult: 'send_to_responsible',
          responsibleEnterprise: documentResponsibleUnit,
          responsibleForFollowUp: responsibleUser
        }),
        documentResult: {
          document,
          reason: {
            code: 'RESPONSIBLE_PERSON',
            reportDescription: `${responsibleUser.contact?.FirstName} ${responsibleUser.contact?.LastName} er ansvarlig person.`,
            purreDescription: 'Du står som ansvarlig person for dette dokumentet.',
            level: 'INFO'
          }
        }
      })
    }
    // Æsj, da kan vi ikke bruken allikevel...
    const docReasonPrefix = `Dokumentansvarlig kan ikke brukes: ${responsibleUser?.reason || 'Mangler ansvarlig person'}.`
    // Hvis brukeren er inaktiv eller servicebruker vil arkivet ha den (skreddersydd for arkiv)
    if (responsibleUser?.user && (!responsibleUser.user.IsActive || responsibleUser.user.IsServiceUser)) {
      return DocumentPurre.parse({
        receiver: createPurreReceiver({
          purreResult: 'send_to_archive',
          responsibleEnterprise: documentResponsibleUnit,
          responsibleForFollowUp: null
        }),
        documentResult: {
          document,
          reason: {
            code: 'RESPONSIBLE_PERSON_INACTIVE_OR_SERVICEUSER',
            reportDescription: `${docReasonPrefix} Må håndteres av arkiv`,
            purreDescription: docReasonPrefix,
            level: 'WARNING'
          }
        }
      })
    }
    // Hvis vi har kommet hit, og har noen ledere for virksomheten, så sender vi til dem
    if (documentResponsibleUnit.leaders.length > 0) {
      const customReason = !document.ResponsiblePerson || (!document.ResponsiblePerson.UserId && document.ResponsiblePerson.Recno.toString() === document.ResponsibleEnterprise?.Recno.toString()) ?
        {
          code: 'NO_RESPONSIBLE_PERSON',
          reportDescription: `Ingen ansvarlig person satt, sender til leder(e) for ansvarlig enhet i stedet.`,
          purreDescription: 'Ingen ansvarlig person satt på dokumentet. Du er registrert som leder for ansvarlig enhet, og får derfor denne påminnelsen.',
          level: 'INFO'
        } : {
          code: 'RESPONSIBLE_PERSON_INVALID',
          reportDescription: `${docReasonPrefix} Sender til leder(e) for ansvarlig enhet i stedet.`,
          purreDescription: docReasonPrefix,
          level: 'WARNING'
        }
      return DocumentPurre.parse({
        receiver: createPurreReceiver({
          purreResult: 'send_to_leaders',
          responsibleEnterprise: documentResponsibleUnit,
          responsibleForFollowUp: null
        }),
        documentResult: {
          document,
          reason: customReason
        }
      })
    }
    // Hvis vi fortsatt ikke har funnet noen å sende til, så sender vi til arkiv med begrunnelse
    return DocumentPurre.parse({
      receiver: createPurreReceiver({
        purreResult: 'send_to_archive',
        responsibleEnterprise: documentResponsibleUnit,
        responsibleForFollowUp: null
      }),
      documentResult: {
        document,
        reason: {
          code: 'NO_RESPONSIBLE_PERSON_OR_LEADERS',
          reportDescription: `${docReasonPrefix} Ingen ledere funnet for ansvarlig enhet, må håndteres av arkiv`,
          purreDescription: docReasonPrefix,
          level: 'WARNING'
        }
      }
    })
  }

  const unansweredDocumentsReport = UnansweredDocumentsReport.parse({
    fromDate,
    toDate,
    totalDocuments: unansweredDocuments.length,
    purreReceivers: []
  })

  // Gå gjennom alle dokumenter og lag rapport 👍
  for (const document of unansweredDocuments) {
    const documentPurre = createPurreFromDocument(document)
    // Sjekk om vi har lagt den inn i purreReceivers allerede
    let purreReceiver
    const existingReceiver = unansweredDocumentsReport.purreReceivers.find(receiver => receiver.receiverId === documentPurre.receiver.receiverId)
    if (!existingReceiver) {
      unansweredDocumentsReport.purreReceivers.push(documentPurre.receiver)
      purreReceiver = documentPurre.receiver
    } else {
      // Check that the reciever info is the same (I don't trust my own code)
      if (JSON.stringify(existingReceiver.toAddresses) !== JSON.stringify(documentPurre.receiver.toAddresses)) {
        throw new Error(`Receiver addresses ${existingReceiver.toAddresses.join(',')} does not match ${documentPurre.receiver.toAddresses.join(',')} for receiverId ${documentPurre.receiver.receiverId}, check your code`)
      }
      if (existingReceiver.purreResult === 'send_to_leaders' && JSON.stringify(existingReceiver.responsibleEnterprise) !== JSON.stringify(documentPurre.receiver.responsibleEnterprise)) {
        throw new Error(`Existing receiver responsibleEnterprise with recno ${existingReceiver.responsibleEnterprise.enterprise.Recno} does not match receiver responsible ${documentPurre.receiver.responsibleEnterprise.enterprise.Recno}, ${JSON.stringify(documentPurre.documentResult.document.DocumentNumber)} check your code`)
      }
      if (JSON.stringify(existingReceiver.responsibleForFollowUp) !== JSON.stringify(documentPurre.receiver.responsibleForFollowUp)) {
        throw new Error(`Existing receiver responsibleForFollowUp ${JSON.stringify(existingReceiver.responsibleForFollowUp)} does not ${JSON.stringify(documentPurre.documentResult.document.DocumentNumber)} match receiver responsibleForFollowUp ${JSON.stringify(documentPurre.receiver.responsibleForFollowUp)}, check your code`)
      }
      purreReceiver = existingReceiver
    }
    // Legg til dokumentresultatet i riktig receiver
    purreReceiver.documentResults.push(documentPurre.documentResult)
  }

  writeFileSync('./PURRE-SAKSBEHANDLER/ignore/rappooort.json', JSON.stringify(unansweredDocumentsReport, null, 2))
  // Send ut driten og lag en rapport til arkiv
  const balls = unansweredDocumentEmailTemplates.reportMailToArchive(unansweredDocumentsReport)
  const b64 = Buffer.from(balls).toString('base64')
  writeFileSync('./PURRE-SAKSBEHANDLER/ignore/report-to-archive-ny.html', balls)


}

module.exports = { unansweredDocumentsPurre, UnansweredDocumentsReport }