import { z } from 'zod'
import type { ConnectorCredentials } from '@botworks/types'

// ─── Credential Schemas ──────────────────────────────────────────────────────

export const storageCredentialsSchema = z.object({
  provider: z.enum(['s3', 'gcs', 'azure', 'local']),
  bucket: z.string().optional(),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  endpoint: z.string().optional(),
  basePath: z.string().default('/'),
})

export type StorageCredentials = z.infer<typeof storageCredentialsSchema>

// ─── Storage Connector Interface ─────────────────────────────────────────────

export interface StorageFile {
  key: string
  name: string
  size: number
  contentType: string
  lastModified: string
}

/**
 * Abstract storage connector for file operations.
 * Implementations: S3-compatible, local filesystem, etc.
 */
export abstract class StorageConnector {
  abstract readonly provider: string

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>

  /** List files in a path/prefix */
  abstract list(prefix?: string, limit?: number): Promise<StorageFile[]>

  /** Read file content as Buffer */
  abstract read(key: string): Promise<Buffer>

  /** Read file content as base64 string */
  abstract readBase64(key: string): Promise<string>

  /** Write file */
  abstract write(key: string, content: Buffer, contentType?: string): Promise<void>

  /** Delete file */
  abstract delete(key: string): Promise<void>

  /** Check if file exists */
  abstract exists(key: string): Promise<boolean>
}

export function validateStorageCredentials(creds: ConnectorCredentials): StorageCredentials {
  return storageCredentialsSchema.parse(creds.credentials)
}
