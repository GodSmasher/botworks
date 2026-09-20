import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  ReportFormat,
  ReportPeriod,
  GeneratedReport,
  GeneratedSection,
} from '@botworks/types'
import {
  SUMMARY_SYSTEM_PROMPT,
  SECTION_SUMMARY_SYSTEM_PROMPT,
  SECTION_JSON_SCHEMA,
  REPORT_SUMMARY_JSON_SCHEMA,
} from './prompts.js'
import { mockSectionAnalysis, mockReportSummary } from './mock.js'

// ─── Input validation ────────────────────────────────────────────────────────

const sectionInputSchema = z.object({
  title: z.string(),
  type: z.enum(['summary', 'table', 'kpi', 'chart_data', 'text']),
  data: z.array(z.record(z.unknown())).optional(),
  text: z.string().optional(),
  aiSummary: z.boolean().default(true),
})

const inputSchema = z.object({
  title: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sections: z.array(sectionInputSchema).min(1),
  format: z.enum(['json', 'html', 'markdown', 'csv']).default('markdown'),
  language: z.string().default('de'),
  includeExecutiveSummary: z.boolean().default(true),
})

// ─── AI response schemas ─────────────────────────────────────────────────────

const sectionResultSchema = z.object({
  title: z.string(),
  content: z.string(),
  highlights: z.array(z.string()),
})

const reportSummarySchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  recommendations: z.array(z.string()),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class ReportGeneratorBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'report-generator',
    name: 'Report Generator Bot',
    description: 'Generates structured business reports from data with AI-powered analysis and summaries.',
    tier: 'tier2',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['storage', 'webhook'],
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

    ctx.log('info', `Generating ${config.period} report: "${config.title}"`, {
      sections: config.sections.length,
      format: config.format,
      language: config.language,
    })

    const generatedSections: GeneratedSection[] = []

    // Step 1: Process each section
    for (const section of config.sections) {
      ctx.log('debug', `Processing section: "${section.title}" (${section.type})`)

      const generated = await this.processSection(ctx, section, config.language)
      generatedSections.push(generated)

      ctx.log('info', `Section "${section.title}" generated`)
    }

    // Step 2: Generate executive summary if requested
    let aiSummary: string | undefined

    if (config.includeExecutiveSummary) {
      ctx.log('info', 'Generating executive summary')

      const allContent = generatedSections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n')

      const summaryResult = await aiJson({
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            `Report: ${config.title}`,
            `Period: ${config.period}${config.startDate ? ` (${config.startDate} — ${config.endDate ?? 'now'})` : ''}`,
            `Language: ${config.language}`,
            '',
            'Report sections:',
            allContent,
          ].join('\n'),
        }],
        schema: REPORT_SUMMARY_JSON_SCHEMA,
        parse: (raw) => reportSummarySchema.parse(JSON.parse(raw)),
        mock: () => mockReportSummary(config.title, config.sections, config.language),
      })

      aiSummary = [
        summaryResult.summary,
        '',
        '### Key Findings',
        ...summaryResult.keyFindings.map((f) => `- ${f}`),
        '',
        '### Recommendations',
        ...summaryResult.recommendations.map((r) => `- ${r}`),
      ].join('\n')
    }

    // Step 3: Format final report
    const content = this.formatReport(config, generatedSections, aiSummary)

    const report: GeneratedReport = {
      reportId: `report-${Date.now()}`,
      title: config.title,
      period: config.period,
      generatedAt: new Date().toISOString(),
      content,
      format: config.format,
      sections: generatedSections,
      aiSummary,
    }

    ctx.log('info', 'Report generated', {
      sections: generatedSections.length,
      contentLength: content.length,
      format: config.format,
    })

    return { report }
  }

  private async processSection(
    ctx: BotContext,
    section: z.infer<typeof sectionInputSchema>,
    language: string,
  ): Promise<GeneratedSection> {
    switch (section.type) {
      case 'kpi':
      case 'summary':
        return this.generateAISection(section, language)

      case 'table':
        return this.generateTableSection(section, language)

      case 'chart_data':
        return {
          title: section.title,
          content: `[Chart data: ${section.data?.length ?? 0} data points]`,
          data: section.data,
        }

      case 'text':
        return {
          title: section.title,
          content: section.text ?? '',
        }

      default:
        return { title: section.title, content: '' }
    }
  }

  private async generateAISection(
    section: z.infer<typeof sectionInputSchema>,
    language: string,
  ): Promise<GeneratedSection> {
    if (!section.data || section.data.length === 0) {
      return { title: section.title, content: 'No data available.' }
    }

    const result = await aiJson({
      system: SECTION_SUMMARY_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Section: ${section.title}`,
          `Type: ${section.type}`,
          `Language: ${language}`,
          '',
          `Data:\n${JSON.stringify(section.data, null, 2)}`,
        ].join('\n'),
      }],
      schema: SECTION_JSON_SCHEMA,
      parse: (raw) => sectionResultSchema.parse(JSON.parse(raw)),
      mock: () => mockSectionAnalysis(section, language),
    })

    return {
      title: result.title,
      content: result.content,
      data: section.data,
    }
  }

  private generateTableSection(
    section: z.infer<typeof sectionInputSchema>,
    _language: string,
  ): GeneratedSection {
    if (!section.data || section.data.length === 0) {
      return { title: section.title, content: 'No data available.' }
    }

    // Generate markdown table
    const headers = Object.keys(section.data[0])
    const headerRow = `| ${headers.join(' | ')} |`
    const separator = `| ${headers.map(() => '---').join(' | ')} |`
    const rows = section.data.map(
      (row) => `| ${headers.map((h) => String(row[h] ?? '')).join(' | ')} |`,
    )

    return {
      title: section.title,
      content: [headerRow, separator, ...rows].join('\n'),
      data: section.data,
    }
  }

  private formatReport(
    config: z.infer<typeof inputSchema>,
    sections: GeneratedSection[],
    aiSummary?: string,
  ): string {
    switch (config.format) {
      case 'markdown':
        return this.formatMarkdown(config, sections, aiSummary)
      case 'html':
        return this.formatHTML(config, sections, aiSummary)
      case 'json':
        return JSON.stringify({ title: config.title, sections, aiSummary }, null, 2)
      case 'csv':
        return this.formatCSV(sections)
      default:
        return this.formatMarkdown(config, sections, aiSummary)
    }
  }

  private formatMarkdown(
    config: z.infer<typeof inputSchema>,
    sections: GeneratedSection[],
    aiSummary?: string,
  ): string {
    const parts = [
      `# ${config.title}`,
      '',
      `**Period:** ${config.period}${config.startDate ? ` | ${config.startDate} — ${config.endDate ?? 'now'}` : ''}`,
      `**Generated:** ${new Date().toISOString().split('T')[0]}`,
      '',
    ]

    if (aiSummary) {
      parts.push('## Executive Summary', '', aiSummary, '')
    }

    for (const section of sections) {
      parts.push(`## ${section.title}`, '', section.content, '')
    }

    return parts.join('\n')
  }

  private formatHTML(
    config: z.infer<typeof inputSchema>,
    sections: GeneratedSection[],
    aiSummary?: string,
  ): string {
    const sectionHTML = sections
      .map((s) => `<section><h2>${s.title}</h2><div>${s.content}</div></section>`)
      .join('\n')

    return `<!DOCTYPE html>
<html lang="${config.language}">
<head><meta charset="UTF-8"><title>${config.title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f5f5f5}h1{border-bottom:2px solid #333}h2{color:#444;margin-top:2rem}</style>
</head>
<body>
<h1>${config.title}</h1>
<p><strong>Period:</strong> ${config.period} | <strong>Generated:</strong> ${new Date().toISOString().split('T')[0]}</p>
${aiSummary ? `<section><h2>Executive Summary</h2><div>${aiSummary}</div></section>` : ''}
${sectionHTML}
</body></html>`
  }

  private formatCSV(sections: GeneratedSection[]): string {
    const lines: string[] = []

    for (const section of sections) {
      if (!section.data || section.data.length === 0) continue

      lines.push(`# ${section.title}`)
      const headers = Object.keys(section.data[0])
      lines.push(headers.join(','))

      for (const row of section.data) {
        lines.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
      }

      lines.push('')
    }

    return lines.join('\n')
  }
}

export default new ReportGeneratorBot()

export { sampleInput } from './sample.js'
