// Invented sample input for demos and offline runs. The company, person and all contact data are fictional.
//
// Note: no `webhooks` are configured here on purpose. Webhook delivery is a real HTTP call even in
// mock mode, so the offline sample stops after normalization/validation. Add `webhooks`
// (e.g. [{ system: 'crm', url: 'https://crm.example/hooks/new-customer' }]) to exercise distribution.

export const sampleInput = {
  entityType: 'customer' as const,
  sourceFormat: 'web-form',
  targetSystems: ['crm', 'accounting', 'newsletter'],
  rawData: {
    Firma: 'Bergkristall Optik GmbH',
    Ansprechpartner: 'FRIEDERIKE VON HOLLENSTEDT',
    'E-Mail': 'F.Hollenstedt@Bergkristall-Optik.example',
    Telefon: '0351 555 01 87',
    Adresse: 'Elbuferweg 8, 01067 dresden, Deutschland',
    'USt-ID': 'de 999 999 999',
    'Kunde seit': '15.09.2026',
    payment_terms: '30 Tage netto',
    Bemerkung: 'Wünscht Rechnungen ausschliesslich per E-Mail.',
  },
}
