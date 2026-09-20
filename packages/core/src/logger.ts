import type { LogLevel, LogFunction } from '@botworks/types'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
}

const RESET = '\x1b[0m'

export function createLogger(
  prefix: string,
  minLevel?: LogLevel,
): LogFunction {
  return (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    // Resolved per call, so LOG_LEVEL set after module load (dotenv, scripts) still applies.
    const threshold = LEVEL_PRIORITY[minLevel ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? 1
    if (LEVEL_PRIORITY[level] < threshold) return

    const ts = new Date().toISOString()
    const color = LEVEL_COLORS[level]
    const tag = level.toUpperCase().padEnd(5)
    const line = `${color}${tag}${RESET} ${ts} [${prefix}] ${message}`

    if (level === 'error') {
      console.error(line, data ? JSON.stringify(data) : '')
    } else {
      console.log(line, data ? JSON.stringify(data) : '')
    }
  }
}
