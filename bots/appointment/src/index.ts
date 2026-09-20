import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { SLOT_SYSTEM_PROMPT, SLOT_JSON_SCHEMA, REMINDER_SYSTEM_PROMPT, REMINDER_JSON_SCHEMA } from './prompts.js'
import { mockFindSlot, mockReminder } from './mock.js'

const slotSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  booked: z.boolean().default(false),
  label: z.string().optional(),
})

const inputSchema = z.object({
  action: z.enum(['find_slot', 'send_reminders']),
  // find_slot
  availableSlots: z.array(slotSchema).optional(),
  customerRequest: z.string().optional(),
  // send_reminders
  appointments: z.array(z.object({
    id: z.string(),
    customerName: z.string(),
    customerEmail: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    subject: z.string(),
    location: z.string().optional(),
    meetingLink: z.string().optional(),
    rescheduleUrl: z.string().optional(),
  })).optional(),
  language: z.string().default('de'),
})

const slotResultSchema = z.object({
  suggestedSlots: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    matchScore: z.number(),
  })),
  conflicts: z.array(z.string()),
  notes: z.string().optional(),
})

const reminderResultSchema = z.object({
  subject: z.string(),
  body: z.string(),
  channel: z.string(),
})

export class AppointmentBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'appointment',
    name: 'Appointment Bot',
    description: 'Finds available time slots from natural language requests and sends appointment reminders.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['calendar', 'email'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)

    if (parsed.action === 'find_slot') {
      return this.findSlot(ctx, parsed)
    }
    return this.sendReminders(ctx, parsed)
  }

  private async findSlot(ctx: BotContext, input: z.infer<typeof inputSchema>) {
    const slots = input.availableSlots ?? []
    const request = input.customerRequest ?? ''
    ctx.log('info', `Finding slot for: "${request.slice(0, 80)}"`, { availableSlots: slots.length })

    const result = await aiJson({
      system: SLOT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Available slots:\n${JSON.stringify(slots, null, 2)}\n\nCustomer request: ${request}`,
      }],
      schema: SLOT_JSON_SCHEMA,
      parse: (raw) => slotResultSchema.parse(JSON.parse(raw)),
      mock: () => mockFindSlot(slots, request),
    })

    ctx.log('info', `Found ${result.suggestedSlots.length} matching slot(s)`)
    return { result }
  }

  private async sendReminders(ctx: BotContext, input: z.infer<typeof inputSchema>) {
    const appointments = input.appointments ?? []
    ctx.log('info', `Composing reminders for ${appointments.length} appointment(s)`)

    const reminders = []
    for (const apt of appointments) {
      const reminder = await aiJson({
        system: REMINDER_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            `Language: ${input.language}`,
            `Customer: ${apt.customerName}`,
            `Date: ${apt.date}, ${apt.startTime}–${apt.endTime}`,
            `Subject: ${apt.subject}`,
            apt.location ? `Location: ${apt.location}` : '',
            apt.meetingLink ? `Meeting link: ${apt.meetingLink}` : '',
            apt.rescheduleUrl ? `Reschedule: ${apt.rescheduleUrl}` : '',
          ].filter(Boolean).join('\n'),
        }],
        schema: REMINDER_JSON_SCHEMA,
        parse: (raw) => reminderResultSchema.parse(JSON.parse(raw)),
        mock: () => mockReminder(apt, input.language),
      })
      reminders.push({ appointmentId: apt.id, ...reminder })
    }

    return { reminders, total: reminders.length }
  }
}

export default new AppointmentBot()

export { sampleInput, sampleReminderInput } from './sample.js'
