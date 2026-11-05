/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { proxy } from './proxy'
import {
  ROLE_HEADER,
  SESSION_CHECK_PATH,
  SESSION_COOKIE_NAME,
} from './lib/sessionCookie'

/**
 * Die serverseitige Wache (F1): ohne gültiges Sitzungs-Cookie entsteht für
 * geschützte Seiten nie die eigentliche Server-Komponente - der Proxy
 * schreibt auf die leere Prüfseite um.
 */

const REWRITE = 'x-middleware-rewrite'
const NEXT = 'x-middleware-next'

let counter = 0
function token(): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  counter += 1
  return `${part({ alg: 'HS256' })}.${part({
    exp: Math.floor(Date.now() / 1000) + 3600,
    n: counter,
  })}.sig`
}

function request(path: string, cookie?: string, headers: HeadersInit = {}) {
  const init = new Headers(headers)
  if (cookie) init.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(`http://localhost:4201${path}`, { headers: init })
}

const fetchMock = jest.fn()
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch
})
beforeEach(() => fetchMock.mockReset())

function apiAnswers(status: number, role?: string) {
  fetchMock.mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => ({ success: true, data: { role } }),
  })
}

function rewrittenTo(response: Response): string | null {
  const target = response.headers.get(REWRITE)
  return target ? new URL(target).pathname : null
}

describe('proxy', () => {
  it('ohne Cookie: /admin/reports wird zur Prüfseite (keine Berichtsdaten)', async () => {
    const response = await proxy(request('/admin/reports'))
    expect(rewrittenTo(response)).toBe(SESSION_CHECK_PATH)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ohne Cookie: auch Dashboard, Kassentag und /backstube', async () => {
    for (const path of ['/admin', '/admin/reports/2026-01-06', '/backstube']) {
      const response = await proxy(request(path))
      expect(rewrittenTo(response)).toBe(SESSION_CHECK_PATH)
    }
  })

  it('ungültiges Token (API 401): Prüfseite', async () => {
    apiAnswers(401)
    const response = await proxy(request('/admin/reports', token()))
    expect(rewrittenTo(response)).toBe(SESSION_CHECK_PATH)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Verkauf-Token: Berichte gesperrt, Produktliste offen', async () => {
    apiAnswers(200, 'verkauf')
    const t = token()
    expect(rewrittenTo(await proxy(request('/admin/reports', t)))).toBe(
      SESSION_CHECK_PATH
    )
    const products = await proxy(request('/admin/products', t))
    expect(rewrittenTo(products)).toBeNull()
    expect(products.headers.get(NEXT)).toBe('1')
  })

  it('Inhaber-Token: durch, mit geprüfter Rolle als Request-Header', async () => {
    apiAnswers(200, 'inhaber')
    const response = await proxy(request('/admin/reports', token()))
    expect(rewrittenTo(response)).toBeNull()
    expect(response.headers.get(NEXT)).toBe('1')
    expect(response.headers.get(`x-middleware-request-${ROLE_HEADER}`)).toBe(
      'inhaber'
    )
  })

  it('ein mitgeschickter Rollen-Header wird nie durchgereicht', async () => {
    const response = await proxy(
      request('/admin/login', undefined, { [ROLE_HEADER]: 'inhaber' })
    )
    expect(
      response.headers.get(`x-middleware-request-${ROLE_HEADER}`)
    ).toBeNull()
    // Next übernimmt nur die gelisteten Request-Header; der Rollen-Header fehlt.
    const overridden = response.headers.get('x-middleware-override-headers')
    expect(overridden?.split(',')).not.toContain(ROLE_HEADER)
  })

  it('Anmeldeseite bleibt ohne Sitzung erreichbar', async () => {
    const response = await proxy(request('/admin/login'))
    expect(rewrittenTo(response)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
