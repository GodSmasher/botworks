import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { EMPLOYEE_PROCESS_SYSTEM_PROMPT, EMPLOYEE_JSON_SCHEMA } from './prompts.js'
import { mockProcessRequest } from './mock.js'

const inputSchema = z.object({
  requestText: z.string().min(1),
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  department: z.string().optional(),
  managerId: z.string().optional(),
  existingData: z.record(z.unknown()).optional(),
  language: z.string().default('de'),
})

const resultSchema = z.object({
  requestType: z.enum(['vacation', 'sick_leave', 'data_change', 'onboarding', 'offboarding']),
  extractedData: z.record(z.unknown()),
  requiresApproval: z.boolean(),
  approver: z.string().nullable().optional(),
  actions: z.array(z.object({
    step: z.string(),
    system: z.string(),
    priority: z.enum(['low', 'normal', 'high']),
  })),
  validationIssues: z.array(z.string()),
})

export class EmployeeMgmtBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'employee-mgmt',
    name: 'Employee Management Bot',
    description: 'Processes HR requests (vacation, sick leave, data changes) and triggers required workflows.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['email', 'calendar', 'webhook'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)

    ctx.log('info', `Processing employee request`, {
      employee: parsed.employeeName,
      textLength: parsed.requestText.length,
    })

    const contextParts = [
      `Language: ${parsed.language}`,
      parsed.employeeName ? `Employee: ${parsed.employeeName}` : '',
      parsed.department ? `Department: ${parsed.department}` : '',
      parsed.existingData ? `Existing data:\n${JSON.stringify(parsed.existingData, null, 2)}` : '',
      '',
      `Request:\n${parsed.requestText}`,
    ].filter(Boolean)

    const result = await aiJson({
      system: EMPLOYEE_PROCESS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextParts.join('\n') }],
      schema: EMPLOYEE_JSON_SCHEMA,
      parse: (raw) => resultSchema.parse(JSON.parse(raw)),
      mock: () => mockProcessRequest(parsed),
    })

    ctx.log('info', `Request type: ${result.requestType}`, {
      requiresApproval: result.requiresApproval,
      actions: result.actions.length,
      issues: result.validationIssues.length,
    })

    return {
      result,
      employeeId: parsed.employeeId,
      processedAt: new Date().toISOString(),
    }
  }
}

export default new EmployeeMgmtBot()

export { sampleInput } from './sample.js'
