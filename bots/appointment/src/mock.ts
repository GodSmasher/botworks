// Offline (mock mode) answers for the appointment bot.

interface MockSlot {
  date: string
  startTime: string
  endTime: string
  booked: boolean
  label?: string
}

interface MockAppointment {
  customerName: string
  date: string
  startTime: string
  endTime: string
  subject: string
  location?: string
  meetingLink?: string
  rescheduleUrl?: string
}

// Index = Date#getUTCDay()
const WEEKDAYS: RegExp[] = [
  /\b(sonntag|sunday)\b/i,
  /\b(montag|monday)\b/i,
  /\b(dienstag|tuesday)\b/i,
  /\b(mittwoch|wednesday)\b/i,
  /\b(donnerstag|thursday)\b/i,
  /\b(freitag|friday)\b/i,
  /\b(samstag|saturday)\b/i,
]

// Day parts as [fromHour, toHour)
const DAY_PARTS: Array<{ pattern: RegExp; from: number; to: number }> = [
  { pattern: /\b(vormittags?|morgens|früh|morning)\b/i, from: 0, to: 12 },
  { pattern: /\b(nachmittags?|afternoon)\b/i, from: 12, to: 17 },
  { pattern: /\b(abends?|evening)\b/i, from: 17, to: 24 },
]

function hourOf(time: string): number {
  return Number.parseInt(time.split(':')[0], 10)
}

function weekdayOf(date: string): number {
  return new Date(date.slice(0, 10) + 'T00:00:00Z').getUTCDay()
}

/**
 * Scores every slot against weekday, day part and explicit hour ("14 Uhr", "14:00", "2 pm") found in the request.
 * Free slots → top 3 suggestions, booked slots that would have matched → conflicts.
 */
export function mockFindSlot(slots: MockSlot[], request: string) {
  const wantedDays = WEEKDAYS.map((re, day) => (re.test(request) ? day : -1)).filter((d) => d >= 0)
  const wantedParts = DAY_PARTS.filter((p) => p.pattern.test(request))

  const hourMatch = request.match(/\b(\d{1,2})(?::\d{2})?\s*(uhr|pm|am|h)\b/i) ?? request.match(/\b(\d{1,2}):\d{2}\b/)
  let wantedHour: number | null = hourMatch ? Number.parseInt(hourMatch[1], 10) : null
  if (wantedHour !== null && hourMatch?.[2]?.toLowerCase() === 'pm' && wantedHour < 12) wantedHour += 12

  const score = (slot: MockSlot): number => {
    const hour = hourOf(slot.startTime)
    let value = 0.4
    if (wantedDays.length === 0) value += 0.15
    else if (wantedDays.includes(weekdayOf(slot.date))) value += 0.3
    if (wantedHour !== null) {
      if (hour === wantedHour) value += 0.3
      else if (Math.abs(hour - wantedHour) === 1) value += 0.15
    } else if (wantedParts.length === 0) value += 0.15
    else if (wantedParts.some((p) => hour >= p.from && hour < p.to)) value += 0.3
    return Math.round(value * 100) / 100
  }

  const ranked = slots
    .map((slot) => ({ slot, matchScore: score(slot) }))
    .sort((a, b) =>
      b.matchScore - a.matchScore ||
      a.slot.date.localeCompare(b.slot.date) ||
      a.slot.startTime.localeCompare(b.slot.startTime))

  const suggestedSlots = ranked
    .filter((r) => !r.slot.booked && r.matchScore > 0.4)
    .slice(0, 3)
    .map((r) => ({ date: r.slot.date, startTime: r.slot.startTime, endTime: r.slot.endTime, matchScore: r.matchScore }))

  const conflicts = ranked
    .filter((r) => r.slot.booked && r.matchScore >= 0.85)
    .map((r) => `${r.slot.date} ${r.slot.startTime}–${r.slot.endTime} matches the request but is already booked`)

  const preferences = [
    wantedDays.length > 0 ? `weekday(s) ${wantedDays.join(',')}` : '',
    wantedParts.length > 0 ? `day part ${wantedParts.map((p) => `${p.from}-${p.to}h`).join('/')}` : '',
    wantedHour !== null ? `around ${wantedHour}:00` : '',
  ].filter(Boolean)

  return {
    suggestedSlots,
    conflicts,
    notes: suggestedSlots.length === 0
      ? 'No free slot matches the request.'
      : preferences.length > 0
        ? `Recognized preferences: ${preferences.join('; ')}.`
        : 'No time preference recognized — earliest free slots suggested.',
  }
}

function germanDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

/** Fills a fixed reminder text (German or English) with the appointment details. */
export function mockReminder(apt: MockAppointment, language: string) {
  const german = language.toLowerCase().startsWith('de')

  // Optional detail lines — only those present in the appointment are included
  const details = (labels: { location: string; link: string; reschedule: string }) => [
    apt.location ? `${labels.location} ${apt.location}` : '',
    apt.meetingLink ? `${labels.link} ${apt.meetingLink}` : '',
    apt.rescheduleUrl ? `${labels.reschedule} ${apt.rescheduleUrl}` : '',
  ].filter(Boolean)

  if (german) {
    const date = germanDate(apt.date)
    return {
      subject: `Terminerinnerung: ${apt.subject} am ${date.slice(0, 6)}`,
      body: [
        `Guten Tag ${apt.customerName},`,
        '',
        `wir erinnern Sie an Ihren Termin "${apt.subject}" am ${date} von ${apt.startTime} bis ${apt.endTime} Uhr.`,
        ...details({ location: 'Ort:', link: 'Link zum Termin:', reschedule: 'Termin verschieben:' }),
        '',
        'Wir freuen uns auf Sie.',
      ].join('\n'),
      channel: 'email',
    }
  }

  return {
    subject: `Appointment reminder: ${apt.subject} on ${apt.date}`,
    body: [
      `Hello ${apt.customerName},`,
      '',
      `this is a reminder of your appointment "${apt.subject}" on ${apt.date} from ${apt.startTime} to ${apt.endTime}.`,
      ...details({ location: 'Location:', link: 'Meeting link:', reschedule: 'Need to reschedule?' }),
      '',
      'We look forward to seeing you.',
    ].join('\n'),
    channel: 'email',
  }
}
