// Invented demo input: monthly service report of a fictional refrigeration & HVAC service company.

export const sampleInput = {
  title: 'Monatsbericht Service – August 2026 (Polarwerk Kältetechnik, Demo)',
  period: 'monthly',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  format: 'markdown',
  language: 'de',
  includeExecutiveSummary: true,
  sections: [
    {
      title: 'Kennzahlen',
      type: 'kpi',
      data: [
        { name: 'Umsatz Service (EUR)', value: 84200, previous: 78900 },
        { name: 'Abgeschlossene Einsätze', value: 142, previous: 131 },
        { name: 'Erstlösungsquote (%)', value: 81, previous: 86 },
        { name: 'Durchschnittliche Reaktionszeit (h)', value: 5.4, previous: 4.1 },
        { name: 'Offene Rechnungen (EUR)', value: 12650, previous: 17300 },
      ],
    },
    {
      title: 'Einsätze nach Techniker',
      type: 'summary',
      data: [
        { techniker: 'M. Brandt', einsaetze: 41, stunden: 148, nacharbeiten: 3 },
        { techniker: 'S. Yildiz', einsaetze: 38, stunden: 139, nacharbeiten: 1 },
        { techniker: 'J. Novak', einsaetze: 35, stunden: 151, nacharbeiten: 6 },
        { techniker: 'L. Petersen', einsaetze: 28, stunden: 112, nacharbeiten: 2 },
      ],
    },
    {
      title: 'Top-Kunden nach Umsatz',
      type: 'table',
      data: [
        { kunde: 'Hotel Seeblick (Demo)', einsaetze: 9, umsatz_eur: 14800 },
        { kunde: 'Bäckerei Sonnenkorn (Demo)', einsaetze: 12, umsatz_eur: 11250 },
        { kunde: 'Gartencenter Blattwerk (Demo)', einsaetze: 6, umsatz_eur: 8900 },
      ],
    },
    {
      title: 'Einsätze pro Woche',
      type: 'chart_data',
      data: [
        { woche: 'KW 32', einsaetze: 31 },
        { woche: 'KW 33', einsaetze: 38 },
        { woche: 'KW 34', einsaetze: 36 },
        { woche: 'KW 35', einsaetze: 37 },
      ],
    },
    {
      title: 'Anmerkungen der Serviceleitung',
      type: 'text',
      text: 'Die Hitzewelle in KW 33 führte zu überdurchschnittlich vielen Notdiensteinsätzen. Zwei Fahrzeuge waren wegen Inspektion jeweils drei Tage nicht verfügbar.',
    },
  ],
}
