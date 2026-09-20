import { z } from 'zod'

// ─── Webhook Connector ───────────────────────────────────────────────────────

export const webhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('POST'),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  timeout: z.number().default(30_000),
})

export type WebhookConfig = z.infer<typeof webhookConfigSchema>

/**
 * Fire-and-forget or await webhook delivery.
 * Used by bots to notify external systems of results.
 */
export async function sendWebhook(
  config: WebhookConfig,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  }

  if (config.secret) {
    // Simple HMAC could be added here — for now just pass the secret as a header
    headers['X-Webhook-Secret'] = config.secret
  }

  // Mock mode (default): never leave the process, acknowledge the delivery instead.
  if (process.env.BOTWORKS_MOCK !== 'false') {
    return { status: 200, body: JSON.stringify({ mock: true, deliveredTo: config.url }) }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const body = await response.text()
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}
