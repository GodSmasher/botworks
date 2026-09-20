// Invented demo input: a vacation request at a fictional company.
// The requested period exceeds the remaining balance, so the bot reports a validation issue.

export const sampleInput = {
  employeeId: 'emp-0042',
  employeeName: 'Selin Yildiz',
  department: 'Servicetechnik',
  managerId: 'emp-0007',
  language: 'de',
  existingData: {
    remainingVacationDays: 8,
    vacationDaysPerYear: 30,
    email: 'selin.yildiz@polarwerk.example',
  },
  requestText: [
    'Hallo Personalabteilung,',
    '',
    'ich möchte gern vom 05.10.2026 bis zum 16.10.2026 Urlaub nehmen (Herbstferien der Kinder).',
    'Die Vertretung für meine Wartungstouren übernimmt Herr Novak, das ist bereits mit ihm abgesprochen.',
    'Die Rufbereitschaft in KW 41 müsste bitte neu eingeteilt werden.',
    '',
    'Viele Grüße',
    'Selin Yildiz',
  ].join('\n'),
}
