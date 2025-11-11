# Flyt

## 1. Ubesvarte dokumenter
Henter ubesvarte dokumenter fra arkiv med [denne psycho-spørringen](./archive-stuff/get-unanswered-documents.js)

Går gjennom alle dokumentene og legger de inn i en key/val basert på hvem som skal få purre tilsendt.
Så sendes det purre på epost til alle som trenger
Til slutt sendes en rapport til arkiv over hva som er sendt ut

## 2. Reserverte dokumenter eldre enn en viss dato (1 mnd som eksempel)
Henter reserverte dokumenter fra arkiv med [denne spørringen](./archive-stuff/get-reserved-documents.js)

Går gjennom alle dokumentene og legger de inn i en key/val basert på hvem som skal få purre tilsendt.
Så sendes det purre på epost til alle som trenger
Til slutt sendes en rapport til arkiv over hva som er sendt ut

## Hva gjenstår
- Sett riktige mottakere på utsending av mail når alt er godkjent av arkiv
