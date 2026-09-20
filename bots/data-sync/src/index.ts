import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  SyncDirection,
  ConflictStrategy,
  SyncResult,
  SyncConflict,
  SyncMapping,
} from '@botworks/types'
import { CONFLICT_SYSTEM_PROMPT, CONFLICT_JSON_SCHEMA } from './prompts.js'
import { mockResolveConflict } from './mock.js'

// ─── Input validation ────────────────────────────────────────────────────────

const mappingSchema = z.object({
  sourceField: z.string(),
  targetField: z.string(),
  transform: z.string().nullable().optional(),
})

const recordSchema = z.object({
  id: z.string(),
  fields: z.record(z.unknown()),
  updatedAt: z.string().optional(),
})

const inputSchema = z.object({
  sourceSystem: z.string(),
  targetSystem: z.string(),
  direction: z.enum(['source_to_target', 'target_to_source', 'bidirectional']).default('source_to_target'),
  conflictStrategy: z.enum(['source_wins', 'target_wins', 'newest_wins', 'manual']).default('source_wins'),
  mappings: z.array(mappingSchema).min(1),
  sourceRecords: z.array(recordSchema),
  targetRecords: z.array(recordSchema),
  dryRun: z.boolean().default(false),
})

// ─── AI response schema ──────────────────────────────────────────────────────

const conflictResultSchema = z.object({
  resolution: z.enum(['source_wins', 'target_wins', 'newest_wins', 'manual']),
  chosenValue: z.string(),
  reason: z.string(),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class DataSyncBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'data-sync',
    name: 'Data Sync Bot',
    description: 'Synchronizes data between systems with field mapping, transformation, and AI-powered conflict resolution.',
    tier: 'tier2',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['webhook', 'crm', 'custom'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(
    ctx: BotContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = inputSchema.parse(input)
    const startTime = Date.now()

    ctx.log('info', `Syncing ${config.sourceSystem} → ${config.targetSystem}`, {
      direction: config.direction,
      sourceRecords: config.sourceRecords.length,
      targetRecords: config.targetRecords.length,
      mappings: config.mappings.length,
    })

    // Index target records by ID for fast lookup
    const targetIndex = new Map(config.targetRecords.map((r) => [r.id, r]))

    let created = 0
    let updated = 0
    let skipped = 0
    const conflicts: SyncConflict[] = []
    const errors: string[] = []
    const syncedRecords: Record<string, unknown>[] = []

    for (const sourceRecord of config.sourceRecords) {
      const targetRecord = targetIndex.get(sourceRecord.id)

      if (!targetRecord) {
        // New record — create in target
        const mapped = this.applyMappings(sourceRecord.fields, config.mappings)
        syncedRecords.push({ id: sourceRecord.id, action: 'create', data: mapped })
        created++
        ctx.log('debug', `CREATE: ${sourceRecord.id}`)
        continue
      }

      // Existing record — check for conflicts
      const mapped = this.applyMappings(sourceRecord.fields, config.mappings)
      const targetMapped = targetRecord.fields
      let hasChanges = false

      for (const mapping of config.mappings) {
        const sourceVal = String(mapped[mapping.targetField] ?? '')
        const targetVal = String(targetMapped[mapping.targetField] ?? '')

        if (sourceVal === targetVal) continue
        if (!sourceVal && !targetVal) continue

        hasChanges = true

        // Conflict detected
        const conflict: SyncConflict = {
          recordId: sourceRecord.id,
          field: mapping.targetField,
          sourceValue: sourceVal,
          targetValue: targetVal,
          resolution: 'unresolved',
        }

        // Resolve conflict based on strategy
        if (config.conflictStrategy === 'manual') {
          // Use AI to suggest resolution
          try {
            const resolved = await this.resolveConflict(
              ctx,
              mapping.targetField,
              sourceVal,
              targetVal,
              sourceRecord.updatedAt,
              targetRecord.updatedAt,
            )
            conflict.resolution = resolved.resolution
          } catch {
            conflict.resolution = 'unresolved'
          }
        } else {
          conflict.resolution = config.conflictStrategy
        }

        conflicts.push(conflict)
      }

      if (hasChanges) {
        syncedRecords.push({ id: sourceRecord.id, action: 'update', data: mapped, conflicts: conflicts.filter((c) => c.recordId === sourceRecord.id) })
        updated++
        ctx.log('debug', `UPDATE: ${sourceRecord.id} (${conflicts.filter((c) => c.recordId === sourceRecord.id).length} conflict(s))`)
      } else {
        skipped++
      }
    }

    const durationMs = Date.now() - startTime

    const result: SyncResult = {
      syncId: `sync-${Date.now()}`,
      created,
      updated,
      skipped,
      conflicts,
      errors,
      durationMs,
    }

    ctx.log('info', 'Sync complete', {
      created,
      updated,
      skipped,
      conflicts: conflicts.length,
      durationMs,
      dryRun: config.dryRun,
    })

    return {
      result,
      syncedRecords: config.dryRun ? syncedRecords : undefined,
    }
  }

  private applyMappings(
    fields: Record<string, unknown>,
    mappings: z.infer<typeof mappingSchema>[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const mapping of mappings) {
      const value = fields[mapping.sourceField]
      if (value === undefined) continue

      // Apply basic transforms
      if (mapping.transform) {
        result[mapping.targetField] = this.applyTransform(value, mapping.transform)
      } else {
        result[mapping.targetField] = value
      }
    }

    return result
  }

  private applyTransform(value: unknown, transform: string): unknown {
    const strVal = String(value)

    // Basic built-in transforms
    if (transform === 'uppercase') return strVal.toUpperCase()
    if (transform === 'lowercase') return strVal.toLowerCase()
    if (transform === 'trim') return strVal.trim()

    // Date format transforms
    if (transform.includes('→') || transform.includes('->')) {
      // For now, return as-is — in production, use date-fns or similar
      return strVal
    }

    return strVal
  }

  private async resolveConflict(
    ctx: BotContext,
    field: string,
    sourceValue: string,
    targetValue: string,
    sourceUpdatedAt?: string,
    targetUpdatedAt?: string,
  ) {
    ctx.log('debug', `Resolving conflict for field "${field}"`, { sourceValue, targetValue })

    return aiJson({
      system: CONFLICT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Field: ${field}`,
          `Source value: "${sourceValue}"${sourceUpdatedAt ? ` (updated: ${sourceUpdatedAt})` : ''}`,
          `Target value: "${targetValue}"${targetUpdatedAt ? ` (updated: ${targetUpdatedAt})` : ''}`,
        ].join('\n'),
      }],
      schema: CONFLICT_JSON_SCHEMA,
      parse: (raw) => conflictResultSchema.parse(JSON.parse(raw)),
      mock: () => mockResolveConflict(field, sourceValue, targetValue, sourceUpdatedAt, targetUpdatedAt),
    })
  }
}

export default new DataSyncBot()

export { sampleInput } from './sample.js'
