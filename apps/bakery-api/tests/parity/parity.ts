/**
 * Parity runner (roadmap B1, D3): sends the same request to the mock server
 * (`simple-server.js`, the contract the frontends were built against) and to
 * the real API (`createApp()`), and compares status and JSON shape.
 *
 *   const mock = loadMockServer(tmpDir)
 *   const real = (await createTestApp({ seedPartners: true })).app
 *   const result = await compare({ method: 'get', path: '/api/partners' }, { mock, real })
 *   expect(result.differences).toEqual([])
 *
 * "Shape" means keys and value types, not values: the two servers seed
 * different example data. Rules (see `diffShapes`):
 *   - a key the mock has and the real API lacks is a difference (the
 *     frontend reads it);
 *   - an extra key on the real API is allowed unless `strictKeys` is set;
 *   - `null` is compatible with every type (nullable fields);
 *   - arrays compare the merged shape of their elements; an empty array is
 *     compatible with any array.
 *
 * The mock server keeps its stores in `apps/bakery-api/data/*.json`, the only
 * record of a developer's mock data. `loadMockServer()` therefore loads a
 * fresh copy of it with `json-store.core.js` redirected into a temp dir, so a
 * parity test never reads or writes the real store files.
 */
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

const APP_DIR = path.resolve(__dirname, '../..')
const MOCK_DATA_DIR = path.join(APP_DIR, 'data')
const JSON_STORE = path.join(APP_DIR, 'src/services/json-store.core.js')

type Store = {
  writeJsonAtomic: (file: string, data: unknown) => void
  readJsonOrQuarantine: (file: string) => unknown
  quarantinePath: (file: string, now?: Date) => string
}

/**
 * Loads `simple-server.js` with its JSON stores in `dataDir`. Each call
 * returns a fresh mock server (own module state, own stores).
 */
export function loadMockServer(dataDir: string): Application {
  const redirect = (file: string) =>
    path.dirname(path.resolve(file)) === MOCK_DATA_DIR
      ? path.join(dataDir, path.basename(file))
      : file

  let app: Application | undefined
  jest.isolateModules(() => {
    jest.doMock(JSON_STORE, () => {
      const actual = jest.requireActual(JSON_STORE) as Store
      return {
        ...actual,
        writeJsonAtomic: (file: string, data: unknown) =>
          actual.writeJsonAtomic(redirect(file), data),
        readJsonOrQuarantine: (file: string) =>
          actual.readJsonOrQuarantine(redirect(file)),
        quarantinePath: (file: string, now?: Date) =>
          actual.quarantinePath(redirect(file), now),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app = require(path.join(APP_DIR, 'simple-server.js')) as Application
  })
  jest.dontMock(JSON_STORE)
  if (!app) throw new Error('simple-server.js did not export an app')
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
   * Sent to one side only, on top of `headers` - e.g. a mock login token for
   * the mock and a B3 session for the real API (B4).
   */
  mockHeaders?: Record<string, string>
  realHeaders?: Record<string, string>
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
  sideHeaders: Record<string, string> | undefined
): Promise<ParitySide> {
  let call = request(app)[req.method](req.path)
  for (const [name, value] of Object.entries({
    ...req.headers,
    ...sideHeaders,
  })) {
    call = call.set(name, value)
  }
  const res =
    req.body === undefined ? await call : await call.send(req.body as object)
  return { status: res.status, body: res.body, shape: shapeOf(res.body) }
}

export async function compare(
  req: ParityRequest,
  apps: { mock: Application; real: Application },
  options: DiffOptions = {}
): Promise<ParityResult> {
  const mock = await send(apps.mock, req, req.mockHeaders)
  const real = await send(apps.real, req, req.realHeaders)
  const differences: string[] = []
  if (mock.status !== real.status) {
    differences.push(`status: mock ${mock.status}, real ${real.status}`)
  }
  differences.push(...diffShapes(mock.shape, real.shape, options))
  return { mock, real, differences }
}
