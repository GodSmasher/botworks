// Email
export { EmailConnector, validateEmailCredentials, imapCredentialsSchema, smtpCredentialsSchema } from './email.js'
export type { ImapCredentials, SmtpCredentials } from './email.js'

// Storage
export { StorageConnector, validateStorageCredentials, storageCredentialsSchema } from './storage.js'
export type { StorageCredentials, StorageFile } from './storage.js'

// Webhook
export { sendWebhook, webhookConfigSchema } from './webhook.js'
export type { WebhookConfig } from './webhook.js'
