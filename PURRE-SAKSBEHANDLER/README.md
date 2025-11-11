# Flyt

PROMP

TO TING:
1. Ubesvarte dokumenter i avdelingen - bør vel være innkommende dokumenter som ikke har noen "besvarelse", ikke avskrevet på et eller annet vis sikkert?
2. Reserverte dokumenter eldre enn 1 mnd - må ha på et dato filter


# 1. Ubesvarte dokumenter i avdelingen
Jeg gjetter på kriteriet "dokument inn" (kan hende vi også trenger flere, f.eks e-post inn?), og at det ikke har noen Response Code på seg (i det hele tatt?) (f. eks BU besvart utgående eller TO tatt til orientering eller lignende)
- Må også filtrere vekk "Utgår" dokumenter
- Kan også filtrere vekk dokumenter fra "Import arkiv" (uregistrerte)

- Vi må også ha leder for avdelingen for å sende e-post. Må hente users med lederrolle og hvilken enhet de er leder for, og deretter matche mot alle dokumentene. Om login ikke er gyldig epost, må vi hente kontakten og epost fra kontaktpersonen. Om ikke epost er der, så får vi varsle arkiv. Varsle om en enhet ikke har leder heller.

OBS OBS OSBSSBSBS, burde ikke ansvarlig person få e-post i stedet for avdelingsleder der det er en ansvarlig person (evt også varsel til avdelingsleder om at epost er sendt til ansvarlig) hvem skal følge opp liksom

Flyt
- Hent alle brukere - filtrer til ledere (rolle=3) og hvilket enterprise recno de er leder for
	- Må også filtrere ut inaktive brukere da. Må gjøres i etterkant da det ikke går i spørring ifølge sif-dok.
- Hent alle restanse-dokumenter.

API-spørring kan da f.eks være
```json
{
	"service": "DocumentService",
	"method": "GetDocuments",
	"parameter": {
		"IncludeFiles": false,
		"IncludeDocumentContacts": true,
    "IncludeCustomFields": true, // For å se journalStatus
		"AdditionalListFields": [
			{
				"Name": "ToDocumentCategory",
				"Value": [110] // Dette er da Dokument inn - kan legge til flere om det trengs (tror og håper jeg)
			}
		],
		"AdditionalFields": [
			{
				"Name": "ToJournalStatus", // IKKE dokumenter med status Utgår
				"Value": 8,
				"OperatorType": "!="
			},
			{
				"Name": "ToDocumentArchive", // IKKE dokumenter fra Importarkiv (uregistrerte meg bekjent hvertfall)
				"Value": 7,
				"OperatorType": "!="
			},
      // Det under: IKKE dokumenter som er avskrevet med koder: BU(1) NN(2) TLF(3) TE(4) TO(5) ***(6) SA(7) BI(8) GG(9)
			{
				"Name": "ToResponseCode",
				"Value": 1,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 2,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 3,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 4,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 5,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 6,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 7,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 8,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 9,
				"OperatorType": "!="
			}
		]
	}
}
```

Uten kommentarer for testing
```json
{
	"service": "DocumentService",
	"method": "GetDocuments",
	"parameter": {
		"IncludeFiles": false,
		"IncludeDocumentContacts": true,
    "IncludeCustomFields": true,
		"AdditionalListFields": [
			{
				"Name": "ToDocumentCategory",
				"Value": [110]
			}
		],
		"AdditionalFields": [
			{
				"Name": "ToJournalStatus",
				"Value": 8,
				"OperatorType": "!="
			},
			{
				"Name": "ToDocumentArchive",
				"Value": 7,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 1,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 2,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 3,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 4,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 5,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 6,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 7,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 8,
				"OperatorType": "!="
			},
			{
				"Name": "ToResponseCode",
				"Value": 9,
				"OperatorType": "!="
			}
		]
	}
}
```

# 2. Reserverte dokumenter eldre enn en viss dato (1 mnd som eksempel)
Jeg gjetter på kriteret status "Reservert" og Modified date LT (mindre enn) en gitt dato

API-spørring kan da f. eks være
```json
{
	"service": "DocumentService",
	"method": "GetDocuments",
	"parameter": {
		"DateCriteria": [
			{
				"DateName": "ModifiedDate", // Dokumentet sist redigert for MER enn en mnd siden. MERK at dette kun fanger opp når dokumentet ble sist redigert - ikke når en fil i dokumentet ble sist redigert
				"Operator": "LT",
				"DateValue": "2024-12-08"
			}
		],
		"AdditionalListFields": [
			{
				"Name": "ToJournalStatus", // Dokumentstatus "reservert", her kan vi også legge til flere statuser om det trengs
				"Value": [1]
			}
		]
	}
}
```

Sikkert masse greier med de der og... Får lage et utgangspunkt likt den andre - gå gjennom alle dokumenter, sjekk hvem som skal få purre, legg dokumentene på en nøkkel knyttet til mottaker(e) av epost.
