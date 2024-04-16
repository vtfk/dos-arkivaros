const { readFileSync, writeFileSync } = require('fs')

const txtFile = './CREATE-ELEVMAPPER/input.txt' // Fyll inn sti til txt-fil her, linjeseparert tekstfil med fødselsnummer
const txtContent = readFileSync(txtFile).toString()

// Hent ut en og en linje
const lines = txtContent.split('\n')

// Map to only the digits on a line - and to Object
const onlyDigits = lines.map(line => {
  return {
    ssn: line.replace(/[^0-9]/gi, '')
  }
})

// Save to new file here (txt and json in this dir are gitignored)
writeFileSync('./CREATE-ELEVMAPPER/input.json', JSON.stringify(onlyDigits, null, 2))
