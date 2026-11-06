/**
 * W4 fixup: the login limiter (`loginRateLimit`) under aborted requests.
 * Real HTTP (clients that hang up), a tiny express app with the same stack
 * as `/api/auth/login`: per IP (outer) and per IP + account (inner). The
 * handler is slow on purpose, like scrypt, and decides by the query string.
 */
import express from 'express'
import * as http from 'http'
import { AddressInfo } from 'net'

import { loginRateLimit } from '../../src/auth/middleware'

jest.setTimeout(20000)

interface Answer {
  status: number
  retryAfter?: string
  body: string
  ms: number
}

let server: http.Server
let port: number
/** Handler answers; for "the aborted attempt was still checked". */
const handled: Array<{ user: string; status: number }> = []

function buildApp(): express.Express {
  const app = express()
  const perIp = loginRateLimit({ max: 3, waitMs: 400, abortGraceMs: 300 })
  app.get(
    '/login',
    perIp,
    loginRateLimit({
      keyOf: (req) => `u:${String(req.query['u'])}`,
      max: 2,
      waitMs: 400,
      abortGraceMs: 300,
    }),
    (req, res) => {
      const delay = Number(req.query['delay'] ?? 100)
      setTimeout(() => {
        const status = req.query['p'] === 'ok' ? 200 : 401
        handled.push({ user: String(req.query['u']), status })
        res.status(status).json({ status })
      }, delay)
    }
  )
  return app
}

// A fresh app (fresh counters) per test: all requests come from 127.0.0.1.
beforeEach(async () => {
  handled.length = 0
  server = http.createServer(buildApp())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port
})

afterEach(async () => {
  server.closeAllConnections?.()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function call(query: string, abortAfterMs?: number): Promise<Answer | null> {
  const started = Date.now()
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: `/login?${query}`, agent: false },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            retryAfter: res.headers['retry-after'] as string | undefined,
            body,
            ms: Date.now() - started,
          })
        )
      }
    )
    req.on('error', () => resolve(null))
    if (abortAfterMs !== undefined) {
      setTimeout(() => req.destroy(), abortAfterMs)
    }
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('loginRateLimit with aborted requests (W4 fixup)', () => {
  it('waiting requests that hang up do not wedge the account', async () => {
    // two admitted (inner max 2), three more wait - and hang up after 15 ms
    const admitted = [call('u=a&p=ok'), call('u=a&p=ok')]
    const aborted = [1, 2, 3].map(() => call('u=a&p=ok', 15))
    expect(await Promise.all(aborted)).toEqual([null, null, null])
    expect((await Promise.all(admitted)).map((r) => r?.status)).toEqual([
      200, 200,
    ])
    await sleep(50)
    // none of the aborted ones reached the handler
    expect(handled).toHaveLength(2)

    const next = await call('u=a&p=ok')
    expect(next?.status).toBe(200)
    expect(next!.ms).toBeLessThan(1000)

    // and the counter still works: two failures lock
    expect((await call('u=a&p=bad'))?.status).toBe(401)
    expect((await call('u=a&p=bad'))?.status).toBe(401)
    const locked = await call('u=a&p=ok')
    expect(locked?.status).toBe(429)
    expect(locked?.retryAfter).toMatch(/^\d+$/)
  })

  it('a request that hangs up while waiting frees its per-IP slot at once', async () => {
    // per IP max 3: b (slow) and two waiting for b's account hold all three
    const slow = call('u=b&p=ok&delay=600')
    const slow2 = call('u=b&p=ok&delay=600')
    await sleep(30)
    const waiting = call('u=b&p=ok', 60)
    await sleep(20)
    expect(await waiting).toBeNull()
    // another account from the same IP is admitted right away, not after
    // the grace period or after the slow ones
    const other = await call('u=c&p=ok&delay=10')
    expect(other?.status).toBe(200)
    expect(other!.ms).toBeLessThan(300)
    expect((await Promise.all([slow, slow2])).map((r) => r?.status)).toEqual([
      200, 200,
    ])
  })

  it('an admitted wrong guess still counts when the client hangs up', async () => {
    expect(await call('u=d&p=bad&delay=80', 20)).toBeNull()
    expect(await call('u=d&p=bad&delay=80', 20)).toBeNull()
    await sleep(150)
    // both were checked by the handler, both count
    expect(handled.filter((h) => h.user === 'd')).toHaveLength(2)
    expect((await call('u=d&p=ok'))?.status).toBe(429)
  })

  it('an admitted correct login does not count when the client hangs up', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await call('u=e&p=ok&delay=60', 20)).toBeNull()
    }
    await sleep(120)
    expect((await call('u=e&p=bad'))?.status).toBe(401)
    expect((await call('u=e&p=ok'))?.status).toBe(200)
  })

  it('nobody waits forever: 429 with Retry-After after the wait limit', async () => {
    const slow = [call('u=f&p=ok&delay=1500'), call('u=f&p=ok&delay=1500')]
    await sleep(30)
    const third = await call('u=f&p=ok')
    expect(third?.status).toBe(429)
    expect(third?.retryAfter).toMatch(/^\d+$/)
    expect(JSON.parse(third!.body)).toMatchObject({
      error: 'too_many_requests',
    })
    expect(typeof JSON.parse(third!.body).message).toBe('string')
    expect(third!.ms).toBeGreaterThanOrEqual(350)
    expect(third!.ms).toBeLessThan(1200)
    expect((await Promise.all(slow)).map((r) => r?.status)).toEqual([200, 200])
    // the 429 was not a failure
    expect((await call('u=f&p=ok'))?.status).toBe(200)
  })
})
