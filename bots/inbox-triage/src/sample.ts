// Invented sample input for demos and offline runs. All companies, people and addresses are fictional.

export const sampleInput = {
  emails: [
    {
      id: 'msg-001',
      from: 'buchhaltung@nordlicht-logistik.example',
      to: ['info@seeblick-manufaktur.example'],
      subject: 'Rechnung RE-2026-0417 für Transportleistungen August',
      body:
        'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Rechnung RE-2026-0417 über 2.380,00 EUR für die Transportleistungen im August. ' +
        'Der Betrag ist fällig bis zum 15.10.2026. Bitte überweisen Sie auf die in der Rechnung genannte IBAN.\n\nFreundliche Grüsse\nJana Feldkamp\nNordlicht Logistik',
    },
    {
      id: 'msg-002',
      from: 'tobias.wernicke@example.com',
      to: ['info@seeblick-manufaktur.example'],
      subject: 'Beschwerde: beschädigte Lieferung, Bestellung ORD-88214',
      body:
        'Guten Tag,\n\nmeine Bestellung ORD-88214 kam heute völlig beschädigt an, zwei der vier Gläser sind zerbrochen. ' +
        'Ich bin sehr enttäuscht und erwarte umgehend eine Rückerstattung oder Ersatz.\n\nTobias Wernicke',
    },
    {
      id: 'msg-003',
      from: 'procurement@harbourview-hotels.example',
      to: ['sales@seeblick-manufaktur.example'],
      subject: 'Inquiry: bulk order of gift sets for December',
      body:
        'Hello,\n\nwe are interested in 250 of your gift sets for our hotel guests in December. ' +
        'Could you send us a quote including delivery to three locations, and information about custom branding?\n\nBest regards,\nMarisol Attenbury\nHarbourview Hotels',
    },
    {
      id: 'msg-004',
      from: 'promo@mega-deals-now.example',
      to: ['info@seeblick-manufaktur.example'],
      subject: 'You won! Claim your 100% free SEO ranking boost',
      body:
        'Congratulations! You won our limited offer. Click here to claim your prize today. To unsubscribe reply STOP.',
    },
    {
      id: 'msg-005',
      from: 'lea.brandt@seeblick-manufaktur.example',
      to: ['team@seeblick-manufaktur.example'],
      subject: 'Teammeeting am Donnerstag verschoben',
      body:
        'Hallo zusammen,\n\ndas Teammeeting findet diese Woche erst um 14 Uhr statt, Raum Säntis. Bitte bringt eure Urlaubsplanung für Q4 mit.\n\nLG Lea',
    },
  ],
  routingRules: {
    invoice: 'accounting@seeblick-manufaktur.example',
    complaint: 'service@seeblick-manufaktur.example',
  },
}
