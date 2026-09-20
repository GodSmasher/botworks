// Invented sample input for demos and offline runs. All companies, people and addresses are fictional.

const invoiceText = `Kupferberg Analytics GmbH
Lindenallee 14, 04109 Leipzig
info@kupferberg-analytics.example

Rechnung
Rechnungsnummer: RE-2026-1042
Rechnungsdatum: 01.09.2026
Kundennummer: KD-20417

An: Seewind Hotels AG, Hafenstrasse 3, 18055 Rostock

Pos.  Beschreibung                      Einzelpreis   Gesamt
16 x Beratung Datenmigration (Std.)   100,00   1.600,00
4 x Workshop Reporting (Halbtag)   150,00   600,00

Summe netto: 2.200,00 EUR
MwSt 19%: 418,00 EUR
Gesamtbetrag brutto: 2.618,00 EUR

Zahlbar bis 01.10.2026 ohne Abzug.
`

const contractText = `SERVICE AGREEMENT

This Service Agreement is made between Kupferberg Analytics GmbH and Seewind Hotels AG (hereinafter the "Parties").

Effective date: 2026-10-01
End date: 2027-09-30
Contract value: EUR 48,000.00

1. Scope. The provider delivers monthly reporting dashboards and data maintenance services.
2. Payment. Fees are invoiced monthly in equal instalments; payment is due within 30 days.
3. Termination. Either party may terminate with a notice period of 90 days to the end of a quarter.
4. Renewal. The agreement renews automatically for 12 months unless terminated in time.
5. Liability. Liability is limited to the annual contract value except in cases of intent.

Signature: ______________________   Signature: ______________________
`

const letterText = `Seewind Hotels AG
Hafenstrasse 3, 18055 Rostock

Sehr geehrte Damen und Herren,

wir ziehen um. Bitte aktualisieren Sie unsere Stammdaten in Ihren Unterlagen.

Neue Adresse: Am Leuchtturm 21, 18119 Rostock
Gültig ab: 01.11.2026
Ansprechpartnerin: Mareike Tönnies
Telefon: +49 381 5550142
E-Mail: verwaltung@seewind-hotels.example

Mit freundlichen Grüssen
Mareike Tönnies
Leitung Verwaltung
`

export const sampleInput = {
  documents: [
    { filename: 'RE-2026-1042.txt', contentType: 'text/plain', content: invoiceText, source: 'email-attachment' },
    { filename: 'service-agreement-seewind.txt', contentType: 'text/plain', content: contractText, source: 'upload' },
    { filename: 'adressaenderung.txt', contentType: 'text/plain', content: letterText, source: 'scan-inbox' },
  ],
}
