// Invented sample data. All companies, people and addresses are fictional.

/** Default sample: build an invoice from a month of time entries. */
export const sampleInput = {
  action: 'generate_invoice' as const,
  customerName: 'Nordlicht Robotik GmbH (Beispielkunde)',
  customerAddress: 'Musterweg 12, 12345 Beispielstadt',
  defaultRate: 120,
  vatRate: 19,
  currency: 'EUR',
  invoiceNumberPattern: 'INV-{YEAR}-{SEQ}',
  paymentTerms: '14 Tage netto',
  timeEntries: [
    { date: '2026-02-03', hours: 6.5, description: 'Workshop Anforderungen Kundenportal', project: 'Kundenportal' },
    { date: '2026-02-10', hours: 8, description: 'Umsetzung Login und Rollenverwaltung', project: 'Kundenportal' },
    { date: '2026-02-17', hours: 4.25, description: 'Code-Review und Bugfixes', project: 'Kundenportal' },
    { date: '2026-02-12', hours: 3, description: 'Analyse Schnittstelle Lagerverwaltung', project: 'ERP-Anbindung', rate: 145 },
    { date: '2026-02-24', hours: 5.5, description: 'Prototyp Datenexport', project: 'ERP-Anbindung', rate: 145 },
    { date: '2026-02-26', hours: 1.5, description: 'Monatliches Abstimmungsmeeting' },
  ],
}

/** Second sample: dunning notices at different escalation levels. */
export const sampleDunningInput = {
  action: 'generate_dunning' as const,
  lateFeePercent: 5,
  language: 'de',
  overdueInvoices: [
    {
      invoiceNumber: 'INV-2026-0007',
      customerName: 'Café Morgenrot (Beispielkunde)',
      customerEmail: 'buchhaltung@cafe-morgenrot.example',
      amount: 480,
      currency: 'EUR',
      dueDate: '2026-03-06',
      daysPastDue: 9,
      previousDunningLevel: 0,
    },
    {
      invoiceNumber: 'INV-2026-0003',
      customerName: 'Talblick Immobilien KG (Beispielkunde)',
      customerEmail: 'rechnungen@talblick-immobilien.example',
      amount: 3250.4,
      currency: 'EUR',
      dueDate: '2026-02-10',
      daysPastDue: 33,
      previousDunningLevel: 2,
    },
    {
      invoiceNumber: 'INV-2025-0148',
      customerName: 'Werkstatt Siebenstein (Beispielkunde)',
      customerEmail: 'info@werkstatt-siebenstein.example',
      amount: 1190,
      currency: 'EUR',
      dueDate: '2026-01-15',
      daysPastDue: 59,
      previousDunningLevel: 3,
    },
  ],
}
