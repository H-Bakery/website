export interface Logger {
  info: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  debug: (message: string, ...args: any[]) => void
}

class LoggerImpl implements Logger {
  private prefix: string

  constructor(prefix: string = '') {
    this.prefix = prefix
  }

  info(message: string, ...args: any[]): void {
    console.log(`[INFO]${this.prefix} ${message}`, ...args)
  }

  error(message: string, error?: any, ...args: any[]): void {
    console.error(`[ERROR]${this.prefix} ${message}`, error, ...args)
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN]${this.prefix} ${message}`, ...args)
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG]${this.prefix} ${message}`, ...args)
    }
  }
}

export const logger = new LoggerImpl()
export const createLogger = (prefix: string) => new LoggerImpl(` [${prefix}]`)