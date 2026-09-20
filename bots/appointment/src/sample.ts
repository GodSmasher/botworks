// Invented demo inputs for a fictional service company. The week shown starts on Monday, 2026-09-21.

/** Default demo: match a natural-language request against the open calendar slots. */
export const sampleInput = {
  action: 'find_slot',
  language: 'de',
  customerRequest:
    'Guten Tag, wir bräuchten nächste Woche einen Termin für die Wartung unserer Kühlzelle. Am besten passt es Dienstag oder Donnerstag, gern gegen 14 Uhr. Viele Grüße, Jana Albrecht (Bäckerei Sonnenkorn)',
  availableSlots: [
    { date: '2026-09-21', startTime: '09:00', endTime: '10:30', booked: false },
    { date: '2026-09-22', startTime: '10:00', endTime: '11:30', booked: false },
    { date: '2026-09-22', startTime: '14:00', endTime: '15:30', booked: true, label: 'Hotel Seeblick – Störung Klimaanlage' },
    { date: '2026-09-22', startTime: '15:30', endTime: '17:00', booked: false },
    { date: '2026-09-23', startTime: '14:00', endTime: '15:30', booked: false },
    { date: '2026-09-24', startTime: '08:00', endTime: '09:30', booked: true, label: 'Teammeeting' },
    { date: '2026-09-24', startTime: '14:00', endTime: '15:30', booked: false },
    { date: '2026-09-24', startTime: '16:00', endTime: '17:30', booked: false },
    { date: '2026-09-25', startTime: '11:00', endTime: '12:30', booked: false },
  ],
}

/** Second demo for the other action: compose reminders for upcoming appointments. */
export const sampleReminderInput = {
  action: 'send_reminders',
  language: 'de',
  appointments: [
    {
      id: 'apt-2001',
      customerName: 'Frau Albrecht',
      customerEmail: 'jana.albrecht@baeckerei-sonnenkorn.example',
      date: '2026-09-24',
      startTime: '14:00',
      endTime: '15:30',
      subject: 'Wartung Kühlzelle',
      location: 'Bäckerei Sonnenkorn, Musterstraße 12, 12345 Beispielstadt',
      rescheduleUrl: 'https://termine.polarwerk.example/verschieben/apt-2001',
    },
    {
      id: 'apt-2002',
      customerName: 'Herr Novak',
      customerEmail: 'technik@gartencenter-blattwerk.example',
      date: '2026-09-25',
      startTime: '11:00',
      endTime: '11:45',
      subject: 'Beratung Klimatisierung Gewächshaus',
      meetingLink: 'https://meet.polarwerk.example/r/blattwerk-beratung',
    },
  ],
}
