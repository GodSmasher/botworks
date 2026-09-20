// Invented demo input: customer master data from a fictional webshop synced into a fictional CRM.
// conflictStrategy "manual" routes every field conflict through the AI conflict resolver.

export const sampleInput = {
  sourceSystem: 'webshop',
  targetSystem: 'crm',
  direction: 'source_to_target',
  conflictStrategy: 'manual',
  dryRun: true,
  mappings: [
    { sourceField: 'company', targetField: 'firma' },
    { sourceField: 'email', targetField: 'email', transform: 'lowercase' },
    { sourceField: 'phone', targetField: 'telefon', transform: 'trim' },
    { sourceField: 'city', targetField: 'ort' },
  ],
  sourceRecords: [
    {
      // Unchanged → skipped
      id: 'cust-1001',
      updatedAt: '2026-09-01T08:00:00Z',
      fields: { company: 'Nordlicht Metallbau GmbH', email: 'Einkauf@nordlicht-metallbau.example', phone: '+49 40 5550 101', city: 'Hamburg' },
    },
    {
      // Target has a placeholder phone number, source is newer for the city
      id: 'cust-1002',
      updatedAt: '2026-09-15T10:30:00Z',
      fields: { company: 'Bäckerei Sonnenkorn', email: 'info@baeckerei-sonnenkorn.example', phone: ' +49 30 5550 202 ', city: 'Berlin' },
    },
    {
      // Target was edited more recently than the source
      id: 'cust-1003',
      updatedAt: '2026-08-02T09:00:00Z',
      fields: { company: 'Hotel Seeblick', email: 'office@hotel-seeblick.example', phone: '+49 8051 5550 303', city: 'Prien' },
    },
    {
      // No timestamps on either side → needs human review
      id: 'cust-1004',
      fields: { company: 'Gartencenter Blattwerk KG', email: 'kontakt@gartencenter-blattwerk.example', phone: '+49 221 5550 404', city: 'Köln' },
    },
    {
      // Not in the CRM yet → created
      id: 'cust-1005',
      updatedAt: '2026-09-18T14:45:00Z',
      fields: { company: 'Praxis Lindenhof', email: 'empfang@praxis-lindenhof.example', phone: '+49 89 5550 505', city: 'München' },
    },
  ],
  targetRecords: [
    {
      id: 'cust-1001',
      updatedAt: '2026-09-01T08:05:00Z',
      fields: { firma: 'Nordlicht Metallbau GmbH', email: 'einkauf@nordlicht-metallbau.example', telefon: '+49 40 5550 101', ort: 'Hamburg' },
    },
    {
      id: 'cust-1002',
      updatedAt: '2026-06-20T12:00:00Z',
      fields: { firma: 'Bäckerei Sonnenkorn', email: 'info@baeckerei-sonnenkorn.example', telefon: 'n/a', ort: 'Potsdam' },
    },
    {
      id: 'cust-1003',
      updatedAt: '2026-09-10T16:20:00Z',
      fields: { firma: 'Hotel Seeblick GmbH & Co. KG', email: 'office@hotel-seeblick.example', telefon: '+49 8051 5550 303', ort: 'Prien' },
    },
    {
      id: 'cust-1004',
      fields: { firma: 'Gartencenter Blattwerk KG', email: 'kontakt@gartencenter-blattwerk.example', telefon: '+49 221 5550 404', ort: 'Bonn' },
    },
  ],
}
