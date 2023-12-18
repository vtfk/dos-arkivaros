# Flyt
- Henter hele orgstruktur fra FINT
- Henter alle interne virksomheter fra P360
- For hver enhet fra FINT
  - Sjekk om vi har tilsvarende enhet i P360
    - Basert på ExternalID
    - Basert på Kortnavn
    - Basert på displayName
      - Dersom flere enheter funnet på navnet - legg til i liste over ikke-entydig match
  - Om det ikke finnes tilsvarende enhet - legg til i liste over manglende enheter
  - Om vi har tilsvarende enhet - sjekk om externId og kortnavn er korrekt, om ikke oppdater
    - Legg til både FINT-enhet og virksomhet i en resultatliste
    - Legg til status på hva roboten har gjort (kortnavn externalID, evt navn?)
  - Sender e-post med rapport til arkiv

- Henter alle users fra P360
- For hver enhet/virksomhet fra resultatlista
  - Sjekk at det finnes en bruker som har rollen "leder" (role: 3) for enterprisen sitt recno. Sjekk også om user sin contactRecno har samme navn som lederen for enheten i FINT
- Sender e-post med rapport til arkiv om:
  - Hvilke interne virksomheter har ikke leder i P360
  - Hvilke interne virksomheter i P360 har en matchende enhet i HR, men mangler leder i HR
  - Hvilke interne virksomheter har leder - men navnet på lederen matcher ikke navnet på lederen i HR


