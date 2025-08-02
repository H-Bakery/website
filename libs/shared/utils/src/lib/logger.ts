/**
 * Simple logger utility for the application
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, any>
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO

  setLogLevel(level: LogLevel) {
    this.logLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ]
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.toUpperCase()
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    return `[${timestamp}] [${level}] ${entry.message}${context}`
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    }

    const formattedMessage = this.formatMessage(entry)

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context)
  }
}

// Export singleton instance
export const logger = new Logger()

// Export default for convenience
export default logger

// Helper function for logging errors with stack traces
export function logError(error: unknown, context?: Record<string, any>) {
  if (error instanceof Error) {
    logger.error(error.message, {
      ...context,
      stack: error.stack,
      name: error.name,
    })
  } else {
    logger.error('Unknown error', {
      ...context,
      error: String(error),
    })
  }
}

// Helper function for performance logging
export function logPerformance(
  label: string,
  startTime: number,
  context?: Record<string, any>
) {
  const duration = Date.now() - startTime
  logger.info(`Performance: ${label}`, {
    ...context,
    duration: `${duration}ms`,
  })
}

// Helper for structured logging
export function createLogger(namespace: string) {
  return {
    debug: (message: string, context?: Record<string, any>) =>
      logger.debug(message, { namespace, ...context }),
    info: (message: string, context?: Record<string, any>) =>
      logger.info(message, { namespace, ...context }),
    warn: (message: string, context?: Record<string, any>) =>
      logger.warn(message, { namespace, ...context }),
    error: (message: string, context?: Record<string, any>) =>
      logger.error(message, { namespace, ...context }),
  }
}
