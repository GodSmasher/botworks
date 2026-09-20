// Invented sample input for demos and offline runs. The shop, its policies and all people are fictional.

export const sampleInput = {
  queries: [
    {
      id: 'q-1001',
      question: 'Wie lange dauert die Lieferung nach Österreich und was kostet der Versand?',
      language: 'de',
      customerInfo: { name: 'Henrike Solbach', customerSince: '2024' },
    },
    {
      id: 'q-1002',
      question: 'How can I return a lamp that I ordered two weeks ago?',
      language: 'en',
    },
    {
      id: 'q-1003',
      question: 'Auf meiner Rechnung wurde der Rabatt nicht abgezogen, ich möchte eine Rückerstattung der Differenz.',
      language: 'de',
      customerInfo: { name: 'Falk Brennecke', orderId: 'ORD-55120' },
    },
    {
      id: 'q-1004',
      question: 'Gibt es Geschenkgutscheine als PDF zum Ausdrucken?',
      language: 'de',
    },
  ],
  knowledgeBase: [
    {
      id: 'kb-shipping-de',
      source: 'FAQ Versand',
      content:
        'Die Lieferung innerhalb Deutschlands dauert 2–3 Werktage. Die Lieferung nach Österreich und in die Schweiz dauert 4–6 Werktage. ' +
        'Der Versand kostet 4,90 EUR in Deutschland und 9,90 EUR nach Österreich; ab 80 EUR Bestellwert ist der Versand kostenlos.',
    },
    {
      id: 'kb-returns-en',
      source: 'Returns policy',
      content:
        'You can return any item within 30 days of delivery. To return an order, open "My orders", select the item and print the prepaid return label. ' +
        'Items that were ordered as custom-made products cannot be returned.',
    },
    {
      id: 'kb-returns-de',
      source: 'FAQ Rücksendung',
      content:
        'Artikel können innerhalb von 30 Tagen nach Lieferung zurückgesendet werden. Das Rücksendeetikett finden Sie unter "Meine Bestellungen".',
    },
    {
      id: 'kb-warranty-en',
      source: 'Warranty terms',
      content:
        'All lamps come with a two-year warranty covering electrical defects. Bulbs are excluded. Contact support with your order number to open a warranty case.',
    },
    {
      id: 'kb-payment-de',
      source: 'FAQ Zahlung',
      content:
        'Wir akzeptieren Zahlung per Kreditkarte, Lastschrift und Kauf auf Rechnung. Bei Kauf auf Rechnung beträgt das Zahlungsziel 14 Tage.',
    },
  ],
  maxSourcesPerQuery: 5,
  escalationEmail: 'support-team@lichtwerk-shop.example',
}
