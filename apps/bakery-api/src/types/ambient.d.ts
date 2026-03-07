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

declare module 'express-validator' {
  import { RequestHandler, Request } from 'express'
  export function body(field: string, message?: string): any
  export function param(field: string, message?: string): any
  export function query(field: string, message?: string): any
  export function validationResult(req: Request): {
    isEmpty(): boolean
    array(): any[]
  }
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

declare module '@opentelemetry/sdk-node' {
  export class NodeSDK {
    constructor(config: any)
    start(): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(config?: any): any
}

declare module '@opentelemetry/sdk-metrics' {
  export class PeriodicExportingMetricReader {
    constructor(config: any)
  }
  export class ConsoleMetricExporter {
    constructor()
  }
}

declare module '@opentelemetry/resources' {
  export class Resource {
    constructor(attributes: Record<string, any>)
  }
}

declare module '@opentelemetry/semantic-conventions' {
  export const ATTR_SERVICE_NAME: string
  export const ATTR_SERVICE_VERSION: string
}

declare module '@opentelemetry/exporter-jaeger' {
  export class JaegerExporter {
    constructor(config: any)
  }
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BatchSpanProcessor {
    constructor(exporter: any)
  }
}
