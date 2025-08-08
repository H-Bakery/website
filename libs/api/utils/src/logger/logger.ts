/**
 * Logger Utility - Centralized logging for the API
 * Bakery Management System
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DB = 'DB',
  REQUEST = 'REQUEST',
}

export interface LoggerConfig {
  level?: LogLevel;
  timestamp?: boolean;
  colorize?: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private levels: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.DB]: 1,
    [LogLevel.REQUEST]: 2,
    [LogLevel.INFO]: 3,
    [LogLevel.WARN]: 4,
    [LogLevel.ERROR]: 5,
  };

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || LogLevel.INFO,
      timestamp: config.timestamp !== false,
      colorize: config.colorize !== false && process.env['NODE_ENV'] !== 'production',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level || LogLevel.INFO];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];

    if (this.config.colorize) {
      parts.push(this.colorize(level, `[${level}]`));
    } else {
      parts.push(`[${level}]`);
    }

    if (this.config.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  private colorize(level: LogLevel, text: string): string {
    const colors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m', // Green
      [LogLevel.WARN]: '\x1b[33m', // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.DB]: '\x1b[35m', // Magenta
      [LogLevel.REQUEST]: '\x1b[34m', // Blue
    };

    return `${colors[level]}${text}\x1b[0m`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message));
      if (data) console.log(data);
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message));
      if (data) console.log(data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.log(this.formatMessage(LogLevel.WARN, message));
      if (data) console.log(data);
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message));
      if (error) {
        if (error instanceof Error) {
          console.error(error.stack || error.message);
        } else {
          console.error(error);
        }
      }
    }
  }

  db(message: string): void {
    if (this.shouldLog(LogLevel.DB)) {
      console.log(this.formatMessage(LogLevel.DB, message));
    }
  }

  request(req: any): void {
    if (this.shouldLog(LogLevel.REQUEST)) {
      console.log(
        this.formatMessage(LogLevel.REQUEST, `${req.method} ${req.url || req.path}`)
      );

      if (req.body && Object.keys(req.body).length > 0) {
        const sanitizedBody = this.sanitizeBody(req.body);
        console.log('Request Body:', sanitizedBody);
      }
    }
  }

  private sanitizeBody(body: any): any {
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '********';
      }
    }

    return sanitized;
  }

  // Create child logger with specific context
  child(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }
}

export class ContextLogger {
  constructor(
    private logger: Logger,
    private context: string
  ) {}

  private prefixMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  debug(message: string, data?: any): void {
    this.logger.debug(this.prefixMessage(message), data);
  }

  info(message: string, data?: any): void {
    this.logger.info(this.prefixMessage(message), data);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(this.prefixMessage(message), data);
  }

  error(message: string, error?: Error | any): void {
    this.logger.error(this.prefixMessage(message), error);
  }

  db(message: string): void {
    this.logger.db(this.prefixMessage(message));
  }

  request(req: any): void {
    this.logger.request(req);
  }
}

// Create default logger instance
export const logger = new Logger({
  level: process.env['LOG_LEVEL'] as LogLevel || LogLevel.INFO,
});

// Export convenience functions
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const db = logger.db.bind(logger);
export const request = logger.request.bind(logger);