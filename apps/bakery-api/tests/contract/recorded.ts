/**
 * Recorded mock contract (B12, D3).
 *
 * Until the cutover the frontends were built against `simple-server.js`, and
 * the parity suites sent every request to it and to the real API in lockstep.
 * B12 deleted the mock server. Its answers to those scenarios were recorded
 * once (2026-11, before the deletion) into `recorded/<suite>.json`, so the
 * contract suites keep comparing the real API with exactly what the mock
 * answered - status, JSON shape and, where the suites compare values, the
 * values. The recordings contain only synthetic data (the fixtures of the
 * scenarios).
 *
 *   const mock = loadRecordedMock('partners')     // an Express app
 *   const result = await compare(req, { mock, real })
 *   expect(result.differences).toEqual([])
 *
 * `loadRecordedMock()` replays the recorded answers: a request is matched by
 * method, URL and body; identical requests get their answers in recording
 * order. A request that was never recorded answers 599 `not_recorded`, so a
 * changed scenario fails loudly instead of comparing against nothing. The
 * recordings are the contract now - change a scenario only together with a
 * deliberate decision about the contract, and never re-record from the real
 * API (it would compare the real API with itself).
 *
 * "Shape" means keys and value types (`diffShapes`):
 *   - a key the mock has and the real API lacks is a difference (the
 *     frontend reads it);
 *   - an extra key on the real API is allowed unless `strictKeys` is set;
 *   - `null` is compatible with every type (nullable fields);
 *   - arrays compare the merged shape of their elements; an empty array is
 *     compatible with any array.
 */
import * as fs from 'fs'
import * as path from 'path'
import express from 'express'
import request from 'supertest'
import type { Application } from 'express'

const RECORDED_DIR = path.join(__dirname, 'recorded')

/** One recorded request/answer pair of the mock server. */
export interface RecordedExchange {
  method: string
  url: string
  /** Request body, normalised by `bodyKey()`. */
  body: string
  status: number
  contentType: string | null
  contentDisposition: string | null
  /** Raw response text (JSON or CSV). */
  text: string
}

export interface Recording {
  suite: string
  exchanges: RecordedExchange[]
  /** Side results the suites compare besides HTTP answers (e.g. written files). */
  values: Record<string, unknown>
}

/** Request body as a stable key: parsed JSON re-serialised, `{}` when empty. */
export function bodyKey(raw: Buffer | string | undefined): string {
  const text = raw === undefined ? '' : raw.toString()
  if (!text.trim()) return '{}'
  try {
    return JSON.stringify(JSON.parse(text))
  } catch {
    return text
  }
}

function exchangeKey(method: string, url: string, body: string): string {
  return `${method.toUpperCase()} ${url} ${body}`
}

export function readRecording(suite: string): Recording {
  const file = path.join(RECORDED_DIR, `${suite}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Recording
}

/** A recorded side value (see `Recording.values`). */
export function recordedValue<T>(suite: string, key: string): T {
  const values = readRecording(suite).values
  if (!(key in values)) {
    throw new Error(`recorded value "${key}" missing in ${suite}.json`)
  }
  return values[key] as T
}

/**
 * The mock server as recorded: an Express app that answers each request with
 * the next recorded answer for the same method, URL and body.
 */
export function loadRecordedMock(suite: string): Application {
  const queues = new Map<string, RecordedExchange[]>()
  for (const exchange of readRecording(suite).exchanges) {
    const key = exchangeKey(exchange.method, exchange.url, exchange.body)
    const queue = queues.get(key) ?? []
    queue.push(exchange)
    queues.set(key, queue)
  }

  const app = express()
  app.use(express.raw({ type: () => true, limit: '10mb' }))
  app.use((req, res) => {
    const body = bodyKey(Buffer.isBuffer(req.body) ? req.body : undefined)
    const key = exchangeKey(req.method, req.originalUrl, body)
    const next = queues.get(key)?.shift()
    if (!next) {
      res.status(599).json({
        error: 'not_recorded',
        message: `Keine Aufzeichnung des Mock-Servers für ${key}`,
      })
      return
    }
    res.status(next.status)
    if (next.contentType) res.setHeader('Content-Type', next.contentType)
    if (next.contentDisposition) {
      res.setHeader('Content-Disposition', next.contentDisposition)
    }
    res.send(next.text)
  })
  return app
}

// ---------------------------------------------------------------- shapes

export type Shape =
  | 'null'
  | 'string'
  | 'number'
  | 'boolean'
  | { array: Shape | null }
  | { object: Record<string, Shape> }

export function shapeOf(value: unknown): Shape {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) {
    return {
      array: value.reduce<Shape | null>(
        (acc, item) =>
          acc === null ? shapeOf(item) : mergeShapes(acc, shapeOf(item)),
        null
      ),
    }
  }
  if (typeof value === 'object') {
    const object: Record<string, Shape> = {}
    for (const key of Object.keys(value as object).sort()) {
      object[key] = shapeOf((value as Record<string, unknown>)[key])
    }
    return { object }
  }
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return type
  return 'string'
}

/** Union of two element shapes: keys of both, `null` gives way to a type. */
function mergeShapes(a: Shape, b: Shape): Shape {
  if (a === 'null') return b
  if (b === 'null') return a
  if (typeof a === 'object' && typeof b === 'object') {
    if ('object' in a && 'object' in b) {
      const object: Record<string, Shape> = { ...a.object }
      for (const [key, shape] of Object.entries(b.object)) {
        object[key] = key in object ? mergeShapes(object[key], shape) : shape
      }
      return { object }
    }
    if ('array' in a && 'array' in b) {
      if (a.array === null) return b
      if (b.array === null) return a
      return { array: mergeShapes(a.array, b.array) }
    }
  }
  return a // conflicting element types: keep the first, diffShapes reports it
}

function kind(shape: Shape): string {
  if (typeof shape === 'string') return shape
  return 'array' in shape ? 'array' : 'object'
}

export interface DiffOptions {
  /** Report keys the real API has and the mock lacks. */
  strictKeys?: boolean
  /** Dotted paths to skip, e.g. `data.updatedAt` or `[].createdAt`. */
  ignore?: string[]
}

/** Differences between the mock's and the real API's shape, as readable lines. */
export function diffShapes(
  mock: Shape,
  real: Shape,
  options: DiffOptions = {},
  at = ''
): string[] {
  const where = at || '(root)'
  if (options.ignore?.includes(at)) return []
  if (mock === 'null' || real === 'null') return []
  if (typeof mock === 'string' || typeof real === 'string') {
    return mock === real
      ? []
      : [`${where}: mock ${kind(mock)}, real ${kind(real)}`]
  }
  if ('array' in mock && 'array' in real) {
    if (mock.array === null || real.array === null) return []
    return diffShapes(mock.array, real.array, options, `${at}[]`)
  }
  if ('object' in mock && 'object' in real) {
    const lines: string[] = []
    const keys = new Set([
      ...Object.keys(mock.object),
      ...Object.keys(real.object),
    ])
    for (const key of [...keys].sort()) {
      const child = at ? `${at}.${key}` : key
      if (options.ignore?.includes(child)) continue
      if (!(key in real.object)) {
        lines.push(`${child}: missing on the real API`)
      } else if (!(key in mock.object)) {
        if (options.strictKeys) lines.push(`${child}: only on the real API`)
      } else {
        lines.push(
          ...diffShapes(mock.object[key], real.object[key], options, child)
        )
      }
    }
    return lines
  }
  return [`${where}: mock ${kind(mock)}, real ${kind(real)}`]
}

// --------------------------------------------------------------- runner

export interface ParityRequest {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  body?: unknown
  /** Sent to both servers. */
  headers?: Record<string, string>
  /**
   * Sent to one side only, on top of `headers` - e.g. the mock's recorded
   * login token for the mock and a B3 session for the real API (B4).
   */
  mockHeaders?: Record<string, string>
  realHeaders?: Record<string, string>
  /**
   * Path for one side only, instead of `path` - for ids the two servers hand
   * out differently (B8: the mock numbered stops per tour, the real API
   * globally).
   */
  mockPath?: string
  realPath?: string
  /** Body for one side only, instead of `body` (same reason). */
  mockBody?: unknown
  realBody?: unknown
}

export interface ParitySide {
  status: number
  body: unknown
  shape: Shape
}

export interface ParityResult {
  mock: ParitySide
  real: ParitySide
  /** Status mismatch and shape differences; empty = parity. */
  differences: string[]
}

async function send(
  app: Application,
  req: ParityRequest,
  sideHeaders: Record<string, string> | undefined,
  sidePath: string | undefined,
  sideBody: unknown
): Promise<ParitySide> {
  let call = request(app)[req.method](sidePath ?? req.path)
  for (const [name, value] of Object.entries({
    ...req.headers,
    ...sideHeaders,
  })) {
    call = call.set(name, value)
  }
  const body = sideBody === undefined ? req.body : sideBody
  const res = body === undefined ? await call : await call.send(body as object)
  return { status: res.status, body: res.body, shape: shapeOf(res.body) }
}

/**
 * Sends `req` to the recorded mock and to the real API and compares status
 * and shape. The mock side is the recording (see the file comment).
 */
export async function compare(
  req: ParityRequest,
  apps: { mock: Application; real: Application },
  options: DiffOptions = {}
): Promise<ParityResult> {
  const mock = await send(
    apps.mock,
    req,
    req.mockHeaders,
    req.mockPath,
    req.mockBody
  )
  const real = await send(
    apps.real,
    req,
    req.realHeaders,
    req.realPath,
    req.realBody
  )
  const differences: string[] = []
  if (mock.status !== real.status) {
    differences.push(`status: mock ${mock.status}, real ${real.status}`)
  }
  differences.push(...diffShapes(mock.shape, real.shape, options))
  return { mock, real, differences }
}
