// @ts-check

const { logger } = require('@vtfk/logger')
const { getArchiveResponsibles } = require('./archive-stuff/archive-responsibles')
const { createPurreReceiver } = require('./purre')
const { ArchiveDocument } = require('../lib/archive-types')
const { DocumentPurre, PurreDocumentsReport } = require('./purre-types')
const { batchedGetReservedDocuments } = require('./archive-stuff/get-reserved-documents')


/**
 * @param {string} fromDate
 * @param {string} toDate
 */
const reservedDocumentsPurre = async (fromDate, toDate) => {
  // Valider input dates
  if (!fromDate || isNaN(Date.parse(fromDate))) {
    throw new Error('Invalid fromDate, must be YYYY-MM-DD')
  }
  if (!toDate || isNaN(Date.parse(toDate))) {
    throw new Error('Invalid toDate, must be YYYY-MM-DD')
  }

  const archiveResponsibles = await getArchiveResponsibles()
  logger('info', ['Fetching reserved documents from archive between dates', fromDate, 'and', toDate])
  const reservedDocuments = await batchedGetReservedDocuments(fromDate, toDate)
  logger('info', [`Fetched ${reservedDocuments.length} reserved documents from archive`])

  /**
   *
   * @param {ArchiveDocument} document
   * @returns {DocumentPurre}
   */
  const createPurreFromDocument = (document) => {
    // Finn ut hvem som skal få purre, legg inn eller finn receiver, og dokumentresultatet i den receiveren
    // Hent ut responisbleUnit rett fra dokumentet (bare for å ha den)
    const documentResponsibleUnit = archiveResponsibles.getResponsibleEnterprise(document.ResponsibleEnterprise.Recno)
    
    // Vi sjekker om vi kan sende til ansvarlig person
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

  const reservedDocumentsReport = PurreDocumentsReport.parse({
    fromDate,
    toDate,
    totalDocuments: reservedDocuments.length,
    purreReceivers: []
  })

  logger('info', ['Processing reserved documents and creating report'])
  // Gå gjennom alle dokumenter og lag rapport 👍
  for (const document of reservedDocuments) {
    const documentPurre = createPurreFromDocument(document)
    // Sjekk om vi har lagt den inn i purreReceivers allerede
    let purreReceiver
    const existingReceiver = reservedDocumentsReport.purreReceivers.find(receiver => receiver.receiverId === documentPurre.receiver.receiverId)
    if (!existingReceiver) {
      reservedDocumentsReport.purreReceivers.push(documentPurre.receiver)
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
  logger('info', ['Finished processing reserved documents and creating report, returning report'])

  return reservedDocumentsReport
}

module.exports = { reservedDocumentsPurre }