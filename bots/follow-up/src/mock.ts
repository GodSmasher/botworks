// Offline (mock mode) answers for the follow-up bot.
// Small deterministic heuristics that mimic what the model would return.

interface MockTarget {
  id: string
  recipientName: string
  subject: string
  createdAt: string
  lastContactAt?: string
  remindersSent: number
}

interface MockRule {
  escalationLevel: number
  triggerAfterDays: number
  maxReminders?: number
}

/** Counts Mon–Fri days between two ISO dates (start exclusive, end inclusive). */
export function businessDaysBetween(from: string, to: string): number {
  const start = new Date(from.slice(0, 10) + 'T00:00:00Z')
  const end = new Date(to.slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  let days = 0
  const cursor = new Date(start)
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days++
  }
  return days
}

/**
 * Decides the next action per target:
 * reminder cap reached → escalate, waiting time of the next level reached → send_reminder, else skip.
 */
export function mockEvaluateTargets(targets: MockTarget[], rules: MockRule[], currentDate: string) {
  const levels = rules.map((r) => r.escalationLevel)
  const maxLevel = Math.max(...levels)
  const minLevel = Math.min(...levels)
  const reminderCap = Math.max(...rules.map((r) => r.maxReminders ?? rules.length))

  const actions = targets.map((target) => {
    const since = target.lastContactAt ?? target.createdAt
    const waited = businessDaysBetween(since, currentDate)

    if (target.remindersSent >= reminderCap) {
      return {
        targetId: target.id,
        action: 'escalate' as const,
        escalationLevel: maxLevel,
        reason: `${target.remindersSent} reminder(s) sent, cap of ${reminderCap} reached — escalating.`,
      }
    }

    const nextLevel = Math.min(Math.max(target.remindersSent + 1, minLevel), maxLevel)
    const rule = rules.find((r) => r.escalationLevel === nextLevel) ?? rules[0]

    if (waited >= rule.triggerAfterDays) {
      return {
        targetId: target.id,
        action: 'send_reminder' as const,
        escalationLevel: rule.escalationLevel,
        reason: `${waited} working day(s) since last contact, level ${rule.escalationLevel} triggers after ${rule.triggerAfterDays}.`,
      }
    }

    return {
      targetId: target.id,
      action: 'skip' as const,
      escalationLevel: rule.escalationLevel,
      reason: `Only ${waited} working day(s) since last contact, level ${rule.escalationLevel} needs ${rule.triggerAfterDays}.`,
    }
  })

  return { actions }
}

const GERMAN_HINTS = /\b(und|bitte|sehr|hallo|guten|geehrte|geehrter|sie|ihre|ihr|wir|rechnung|grüße|gruß)\b/i

const TONES = { 1: 'friendly', 2: 'direct', 3: 'urgent' } as const

const WORDING = {
  de: {
    prefix: { 1: 'Erinnerung', 2: '2. Erinnerung', 3: 'Letzte Erinnerung' },
    closing: {
      1: 'Geben Sie uns gern kurz Bescheid, falls Sie noch etwas von uns benötigen.',
      2: 'Bitte melden Sie sich bis Ende dieser Woche bei uns, damit wir den Vorgang abschließen können.',
      3: 'Dies ist unsere letzte Erinnerung. Ohne Rückmeldung innerhalb von 3 Werktagen geben wir den Vorgang an die Geschäftsleitung weiter.',
    },
  },
  en: {
    prefix: { 1: 'Reminder', 2: 'Second reminder', 3: 'Final notice' },
    closing: {
      1: 'Just let us know if you need anything else from us.',
      2: 'Please get back to us by the end of this week so we can close this topic.',
      3: 'This is our final reminder. Without a reply within 3 working days we will hand this over to management.',
    },
  },
} as const

/** Builds the email from the already filled-in template; tone and wording follow the escalation level. */
export function mockComposeEmail(filledTemplate: string, originalSubject: string, level: number) {
  const lvl = (level <= 1 ? 1 : level >= 3 ? 3 : 2) as 1 | 2 | 3
  const wording = GERMAN_HINTS.test(filledTemplate) ? WORDING.de : WORDING.en

  // Drop template variables that had no matching context value
  const body = filledTemplate.replace(/\{\{\w+\}\}/g, '').trim()

  return {
    subject: `${wording.prefix[lvl]}: ${originalSubject}`,
    body: `${body}\n\n${wording.closing[lvl]}`,
    tone: TONES[lvl],
  }
}
