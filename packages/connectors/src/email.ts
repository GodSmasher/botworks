import { z } from 'zod'
import type { EmailMessage, ConnectorCredentials } from '@botworks/types'

// ─── Credential Schemas ──────────────────────────────────────────────────────

export const imapCredentialsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().default(993),
  user: z.string().min(1),
  password: z.string().min(1),
  tls: z.coerce.boolean().default(true),
})

export const smtpCredentialsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().default(587),
  user: z.string().min(1),
  password: z.string().min(1),
  tls: z.coerce.boolean().default(true),
  fromName: z.string().optional(),
  fromEmail: z.string().email(),
})

export type ImapCredentials = z.infer<typeof imapCredentialsSchema>
export type SmtpCredentials = z.infer<typeof smtpCredentialsSchema>

// ─── Email Connector Interface ───────────────────────────────────────────────

/**
 * Abstract email connector — concrete implementations per provider.
 *
 * For MVP we support generic IMAP/SMTP.
 * Later: Microsoft Graph, Gmail API, etc.
 */
export abstract class EmailConnector {
  abstract readonly provider: string

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>

  /** Fetch unread emails from inbox (or a specific folder) */
  abstract fetchUnread(folder?: string, limit?: number): Promise<EmailMessage[]>

  /** Fetch a single email by ID */
  abstract fetchById(id: string): Promise<EmailMessage | null>

  /** Mark an email as read */
  abstract markAsRead(id: string): Promise<void>

  /** Move email to a folder */
  abstract moveTo(id: string, folder: string): Promise<void>

  /** Send an email */
  abstract send(to: string[], subject: string, body: string, html?: string): Promise<void>

  /** Reply to an email */
  abstract reply(originalId: string, body: string, html?: string): Promise<void>
}

/**
 * Validates email connector credentials from the stored config.
 */
export function validateEmailCredentials(
  creds: ConnectorCredentials,
): { imap: ImapCredentials; smtp: SmtpCredentials } {
  const imap = imapCredentialsSchema.parse({
    host: creds.credentials.imap_host,
    port: creds.credentials.imap_port,
    user: creds.credentials.user,
    password: creds.credentials.password,
    tls: creds.credentials.tls,
  })

  const smtp = smtpCredentialsSchema.parse({
    host: creds.credentials.smtp_host,
    port: creds.credentials.smtp_port,
    user: creds.credentials.user,
    password: creds.credentials.password,
    tls: creds.credentials.tls,
    fromName: creds.credentials.from_name,
    fromEmail: creds.credentials.from_email,
  })

  return { imap, smtp }
}
