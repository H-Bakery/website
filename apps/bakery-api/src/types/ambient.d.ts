/**
 * Ambient type declarations for packages missing type definitions.
 * These packages are used in the API but not yet installed or lack @types/* packages.
 * Replace with proper @types/* installs as packages are added to dependencies.
 */

declare module 'swagger-jsdoc' {
  function swaggerJsdoc(options: any): any
  export = swaggerJsdoc
}

declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express'
  const swaggerUi: {
    serve: RequestHandler[]
    setup: (spec: any, options?: any) => RequestHandler
  }
  export = swaggerUi
}

declare module 'express-rate-limit' {
  import { RequestHandler } from 'express'
  function rateLimit(options?: any): RequestHandler
  export default rateLimit
}

declare module 'winston' {
  const winston: any
  export = winston
}

declare module 'prom-client' {
  export class Counter {
    constructor(config: any)
    inc(labels?: any, value?: number): void
    labels(...args: string[]): Counter
  }
  export class Histogram {
    constructor(config: any)
    observe(labels?: any, value?: number): void
    startTimer(labels?: any): () => number
    labels(...args: string[]): Histogram
  }
  export class Gauge {
    constructor(config: any)
    set(labels?: any, value?: number): void
    inc(labels?: any, value?: number): void
    dec(labels?: any, value?: number): void
    labels(...args: string[]): Gauge
  }
  export class Summary {
    constructor(config: any)
    observe(labels: any, value: number): void
    labels(...args: string[]): Summary
  }
  export const register: any
  export function collectDefaultMetrics(config?: any): void
}

declare module 'csv-parse' {
  const parse: any
  export = parse
}

declare module 'xlsx' {
  const XLSX: any
  export = XLSX
}

declare module 'multer' {
  import { RequestHandler } from 'express'
  interface Multer {
    single(fieldname: string): RequestHandler
    array(fieldname: string, maxCount?: number): RequestHandler
    fields(fields: any[]): RequestHandler
    none(): RequestHandler
    any(): RequestHandler
  }
  interface StorageEngine {}
  interface Options {
    dest?: string
    storage?: StorageEngine
    limits?: any
    fileFilter?: any
  }
  function multer(options?: Options): Multer
  namespace multer {
    function memoryStorage(): StorageEngine
    function diskStorage(options: any): StorageEngine
  }

  // Extend Express Request with file property
  global {
    namespace Express {
      interface Request {
        file?: {
          fieldname: string
          originalname: string
          encoding: string
          mimetype: string
          size: number
          buffer: Buffer
          path: string
        }
        files?: any
      }
    }
  }

  export = multer
}

/**
 * express-validator ambient declaration.
 * The package is installed but its ESM-only types are not compatible
 * with the CJS build configuration. This declaration matches the real API.
 */
declare module 'express-validator' {
  import { Request, Response, NextFunction } from 'express'
  export interface ValidationChain {
    (req: Request, res: Response, next: NextFunction): void
    isString(): ValidationChain
    isInt(options?: Record<string, unknown>): ValidationChain
    isFloat(options?: Record<string, unknown>): ValidationChain
    isBoolean(): ValidationChain
    isEmail(): ValidationChain
    isISO8601(): ValidationChain
    isIn(values: unknown[]): ValidationChain
    isArray(options?: Record<string, unknown>): ValidationChain
    optional(options?: Record<string, unknown>): ValidationChain
    notEmpty(): ValidationChain
    trim(): ValidationChain
    escape(): ValidationChain
    toInt(): ValidationChain
    toFloat(): ValidationChain
    withMessage(message: string): ValidationChain
    custom(
      validator: (
        value: unknown,
        meta: { req: Request; path: string }
      ) => unknown
    ): ValidationChain
    default(defaultValue: unknown): ValidationChain
    not(): ValidationChain
    exists(options?: Record<string, unknown>): ValidationChain
    bail(): ValidationChain
    isLength(options: { min?: number; max?: number }): ValidationChain
    matches(pattern: RegExp): ValidationChain
    run(req: Request): Promise<unknown>
  }
  export interface ValidationError {
    type: string
    value?: unknown
    msg: string
    path: string
    location: string
  }
  export function body(field: string, message?: string): ValidationChain
  export function param(field: string, message?: string): ValidationChain
  export function query(field: string, message?: string): ValidationChain
  export function header(field: string, message?: string): ValidationChain
  export function cookie(field: string, message?: string): ValidationChain
  export function check(field: string, message?: string): ValidationChain
  export function validationResult(req: Request): {
    isEmpty(): boolean
    array(): ValidationError[]
    formatWith<T>(formatter: (error: ValidationError) => T): { array(): T[] }
  }
}

declare module '@bakery/api/workflows' {
  import { Router } from 'express'
  export const workflowRoutes: Router
}

declare module '@bakery/api/chat' {
  import { Router } from 'express'
  export const chatRoutes: Router
}

declare module '@bakery/api/dashboard' {
  import { Router } from 'express'
  export const dashboardRoutes: Router
}

declare module '@bakery/api/staff' {
  import { Router } from 'express'
  export function createStaffRoutes(deps?: any): Router
}
