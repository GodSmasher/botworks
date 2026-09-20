// ─── Bot Definition ──────────────────────────────────────────────────────────

export type BotId = string

export type BotStatus = 'idle' | 'running' | 'error' | 'disabled'

export type BotTier = 'tier1' | 'tier2' | 'tier3'

export interface BotManifest {
  id: BotId
  name: string
  description: string
  tier: BotTier
  version: string
  requiredConnectors: ConnectorType[]
  optionalConnectors?: ConnectorType[]
}

// ─── Connectors ──────────────────────────────────────────────────────────────

export type ConnectorType =
  | 'email'
  | 'storage'
  | 'crm'
  | 'accounting'
  | 'telephony'
  | 'calendar'
  | 'webhook'
  | 'custom'

export type ConnectorStatus = 'connected' | 'disconnected' | 'error'

export interface ConnectorCredentials {
  type: ConnectorType
  provider: string
  credentials: Record<string, string>
}

export interface ConnectorConfig {
  id: string
  companyId: string
  type: ConnectorType
  provider: string
  status: ConnectorStatus
  credentials: ConnectorCredentials
  metadata?: Record<string, unknown>
}

// ─── Jobs / Tasks ────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'retrying'

export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

export interface JobPayload {
  botId: BotId
  companyId: string
  trigger: JobTrigger
  input: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface JobResult {
  jobId: string
  botId: BotId
  status: JobStatus
  output?: Record<string, unknown>
  error?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
}

export type JobTrigger =
  | { type: 'webhook'; source: string }
  | { type: 'schedule'; cron: string }
  | { type: 'event'; event: string }
  | { type: 'manual'; userId: string }

// ─── Bot Context (passed to every bot run) ───────────────────────────────────

export interface BotContext {
  jobId: string
  companyId: string
  botId: BotId
  trigger: JobTrigger
  connectors: Map<ConnectorType, ConnectorConfig>
  log: LogFunction
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFunction = (level: LogLevel, message: string, data?: Record<string, unknown>) => void

// ─── API Types ───────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface TriggerBotRequest {
  botId: BotId
  companyId: string
  input: Record<string, unknown>
  priority?: JobPriority
}

export interface BotStatusResponse {
  botId: BotId
  status: BotStatus
  lastRun?: JobResult
  queueDepth: number
}

// ─── Email-specific types (Tier 1: Inbox-Triage) ────────────────────────────

export interface EmailMessage {
  id: string
  from: string
  to: string[]
  cc?: string[]
  subject: string
  body: string
  htmlBody?: string
  attachments: EmailAttachment[]
  receivedAt: string
  headers?: Record<string, string>
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  content?: Buffer | string
}

export type EmailCategory =
  | 'inquiry'
  | 'complaint'
  | 'invoice'
  | 'contract'
  | 'support'
  | 'spam'
  | 'internal'
  | 'other'

export interface TriageResult {
  messageId: string
  category: EmailCategory
  confidence: number
  summary: string
  suggestedAction: string
  routeTo?: string
  priority: JobPriority
  extractedEntities?: Record<string, string>
}

// ─── Document-specific types (Tier 1: Document-Extract) ─────────────────────

export type DocumentType =
  | 'invoice'
  | 'contract'
  | 'report'
  | 'receipt'
  | 'letter'
  | 'form'
  | 'other'

export interface DocumentInput {
  filename: string
  contentType: string
  content: string // base64
  source?: string
}

export interface ExtractedDocument {
  documentId: string
  type: DocumentType
  confidence: number
  fields: Record<string, ExtractedField>
  rawText?: string
  metadata?: Record<string, unknown>
}

export interface ExtractedField {
  key: string
  value: string
  confidence: number
  location?: string
}

export interface InvoiceFields {
  invoiceNumber: string
  vendor: string
  date: string
  dueDate?: string
  totalGross: number
  totalNet?: number
  vatAmount?: number
  vatRate?: number
  currency: string
  lineItems?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  description: string
  quantity?: number
  unitPrice?: number
  total: number
}

export interface ContractFields {
  parties: string[]
  startDate?: string
  endDate?: string
  value?: number
  currency?: string
  type?: string
  keyTerms?: string[]
}

// ─── Tier 2: Customer-Support types ─────────────────────────────────────────

export interface KnowledgeChunk {
  id: string
  content: string
  source: string
  score?: number
}

export interface SupportQuery {
  id: string
  question: string
  context?: string
  language?: string
  customerInfo?: Record<string, string>
}

export interface SupportResponse {
  queryId: string
  answer: string
  confidence: number
  sources: KnowledgeChunk[]
  escalate: boolean
  escalationReason?: string
  suggestedFollowUp?: string[]
}

// ─── Tier 2: Onboarding types ───────────────────────────────────────────────

export type OnboardingEntityType = 'customer' | 'employee' | 'vendor' | 'partner'

export interface OnboardingInput {
  entityType: OnboardingEntityType
  rawData: Record<string, unknown>
  sourceFormat?: string
}

export interface OnboardingResult {
  entityType: OnboardingEntityType
  normalizedData: Record<string, string>
  validationErrors: ValidationError[]
  distributionTargets: DistributionTarget[]
  status: 'complete' | 'needs_review' | 'failed'
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface DistributionTarget {
  system: string
  status: 'sent' | 'pending' | 'failed'
  payload?: Record<string, unknown>
}

// ─── Tier 2: Follow-up / Reminder types ─────────────────────────────────────

export type EscalationLevel = 1 | 2 | 3

export interface FollowUpRule {
  id: string
  name: string
  triggerAfterDays: number
  escalationLevel: EscalationLevel
  template: string
  channel: 'email' | 'webhook'
  maxReminders?: number
}

export interface FollowUpTarget {
  id: string
  recipientEmail: string
  recipientName: string
  subject: string
  context: Record<string, string>
  createdAt: string
  lastContactAt?: string
  remindersSent: number
  status: 'active' | 'completed' | 'escalated' | 'cancelled'
}

export interface FollowUpAction {
  targetId: string
  action: 'send_reminder' | 'escalate' | 'skip' | 'complete'
  escalationLevel: EscalationLevel
  message?: string
  nextReminderAt?: string
}

// ─── Tier 2: Data-Sync types ────────────────────────────────────────────────

export type SyncDirection = 'source_to_target' | 'target_to_source' | 'bidirectional'

export type ConflictStrategy = 'source_wins' | 'target_wins' | 'newest_wins' | 'manual'

export interface SyncMapping {
  sourceField: string
  targetField: string
  transform?: string
}

export interface SyncConfig {
  sourceSystem: string
  targetSystem: string
  direction: SyncDirection
  conflictStrategy: ConflictStrategy
  mappings: SyncMapping[]
  filters?: Record<string, string>
}

export interface SyncResult {
  syncId: string
  created: number
  updated: number
  skipped: number
  conflicts: SyncConflict[]
  errors: string[]
  durationMs: number
}

export interface SyncConflict {
  recordId: string
  field: string
  sourceValue: string
  targetValue: string
  resolution: ConflictStrategy | 'unresolved'
}

// ─── Tier 2: Report-Generator types ─────────────────────────────────────────

export type ReportFormat = 'json' | 'html' | 'markdown' | 'csv'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface ReportConfig {
  title: string
  period: ReportPeriod
  startDate?: string
  endDate?: string
  sections: ReportSection[]
  format: ReportFormat
  language?: string
}

export interface ReportSection {
  title: string
  type: 'summary' | 'table' | 'kpi' | 'chart_data' | 'text'
  dataSource: string
  query?: string
  aiSummary?: boolean
}

export interface GeneratedReport {
  reportId: string
  title: string
  period: ReportPeriod
  generatedAt: string
  content: string
  format: ReportFormat
  sections: GeneratedSection[]
  aiSummary?: string
}

export interface GeneratedSection {
  title: string
  content: string
  data?: Record<string, unknown>[]
}
