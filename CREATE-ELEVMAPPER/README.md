# Flyt
- Går gjennom en liste med objekter - enten fødselsnummer eller navn/fødselsdato
- Kjører syncElevmappe på røkla (oppretter om det ikke finnes på fnr allerede)
  - Om noe feiler, legger til i liste sammen med en grunn til at det feila
- Når scriptet er ferdig kan du egt bare fyre av scriptet en gang til på de som har feila, om du ønsker
- De som ikke finnes i arkiv-kontaktregister fra før av, og også mangler i folkeregisteret må du finne løse sjæl.

## Input-liste format (json eller js)
Velg selv objekt-type som passer deg / det du har - ssn er lettest da
```js
[
  {
    ssn: "12345678910"
  },
  {
    name: "Shrek Sump",
    birthdate: "1989-02-27", // YYYY-MM-DD
  },
  {
    firstName: "Shrek",
    lastName: "Sump",
    birthdate: "1989-02-27", // YYYY-MM-DD
  }
]
```

## TXT-liste til JSON-liste
Eget lite script som tar en txt fil med liste av fnr og måker det over i JSON-format, om man trenger



