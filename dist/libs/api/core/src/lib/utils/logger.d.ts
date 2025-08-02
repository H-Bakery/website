import { Request } from 'express'
interface Logger {
  info: (message: string) => void
  error: (message: string, error?: any) => void
  warn: (message: string) => void
  db: (message: string) => void
  debug: (message: string) => void
  request: (req: Request) => void
}
export declare const logger: Logger
export {}
