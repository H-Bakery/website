/**
 * Ambient type declarations for the pilot API.
 *
 * express-validator: the root `package.json` carries the obsolete
 * `@types/express-validator@2` stub, which shadows the package's own modern
 * types. This declaration matches the real v7 API. (Drop it together with
 * the stub.)
 */

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
