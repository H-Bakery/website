/**
 * Verhalten von `public/sw.js`, ausgeführt in einer nachgebauten
 * Service-Worker-Umgebung (vm-Kontext mit Fake-`caches` und -`fetch`).
 *
 * Geprüft wird die Zusage aus F3: gecacht wird nur die App-Hülle - nie `/api`,
 * nie HTML -, Seiten gehen zuerst ans Netz, und ohne Server kommt die
 * Offline-Seite.
 */
import { readFileSync } from 'fs'
import path from 'path'
import vm from 'vm'

const SOURCE = readFileSync(
  path.resolve(__dirname, '../../public/sw.js'),
  'utf8'
)
const ORIGIN = 'https://intern.example.test'

class FakeResponse {
  constructor(
    public body: string,
    public init: { status?: number; headers?: Record<string, string> } = {},
    public type = 'basic'
  ) {}
  get status() {
    return this.init.status ?? 200
  }
  get ok() {
    return this.status >= 200 && this.status < 300
  }
  clone() {
    return new FakeResponse(this.body, this.init, this.type)
  }
}

class FakeRequest {
  method: string
  mode: string
  constructor(
    public url: string,
    init: { method?: string; mode?: string } = {}
  ) {
    this.url = new URL(url, ORIGIN).href
    this.method = init.method ?? 'GET'
    this.mode = init.mode ?? 'cors'
  }
}

type Listener = (event: unknown) => void

function setup(
  options: { version?: string; network?: (url: string) => FakeResponse } = {}
) {
  const store = new Map<string, Map<string, FakeResponse>>()
  const keyOf = (request: string | FakeRequest) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).href

  const openCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const entries = store.get(name) as Map<string, FakeResponse>
    return {
      add: async (request: FakeRequest) => {
        entries.set(keyOf(request), await fetchMock(request))
      },
      put: async (request: FakeRequest, response: FakeResponse) => {
        entries.set(keyOf(request), response)
      },
      match: async (request: string | FakeRequest) =>
        entries.get(keyOf(request)),
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      delete: async (request: { url: string }) => entries.delete(request.url),
    }
  }

  const network =
    options.network ?? ((url: string) => new FakeResponse(`netz:${url}`))
  const fetchMock = jest.fn(async (request: FakeRequest | string) => {
    const url = keyOf(request)
    return network(url)
  })

  const listeners: Record<string, Listener> = {}
  const self = {
    location: {
      href: `${ORIGIN}/sw.js${options.version ? `?v=${options.version}` : ''}`,
      origin: ORIGIN,
    },
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener
    },
    skipWaiting: jest.fn(async () => undefined),
    clients: { claim: jest.fn(async () => undefined) },
  }
  const caches = {
    open: async (name: string) => openCache(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (request: string) => {
      for (const name of store.keys()) {
        const hit = await openCache(name).match(request)
        if (hit) return hit
      }
      return undefined
    },
  }

  vm.runInNewContext(SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    Request: FakeRequest,
    Response: FakeResponse,
    URL,
    Promise,
    console,
  })

  async function lifecycle(type: 'install' | 'activate') {
    let pending: Promise<unknown> = Promise.resolve()
    listeners[type]({ waitUntil: (p: Promise<unknown>) => (pending = p) })
    await pending
  }

  /** Schickt einen Abruf durch den Worker; `undefined` = durchgereicht. */
  async function dispatch(
    url: string,
    init: { method?: string; mode?: string } = {}
  ) {
    let responded: Promise<FakeResponse> | undefined
    listeners.fetch({
      request: new FakeRequest(url, init),
      respondWith: (p: Promise<FakeResponse>) => (responded = p),
    })
    return responded ? await responded : undefined
  }

  const cachedUrls = () =>
    [...store.values()].flatMap((entries) =>
      [...entries.keys()].map((url) => url.replace(ORIGIN, ''))
    )

  return { store, fetchMock, self, lifecycle, dispatch, cachedUrls }
}

describe('public/sw.js', () => {
  it('legt bei der Installation die Offline-Seite und die Icons ab', async () => {
    const sw = setup({ version: 'b1' })
    await sw.lifecycle('install')

    expect([...sw.store.keys()]).toEqual(['heusser-verwaltung-shell-b1'])
    expect(sw.cachedUrls()).toEqual(
      expect.arrayContaining(['/offline.html', '/icons/icon-192.png'])
    )
    expect(sw.self.skipWaiting).toHaveBeenCalled()
  })

  it('räumt beim Aktivieren alte Versionen ab, fremde Caches bleiben', async () => {
    const sw = setup({ version: 'neu' })
    sw.store.set('heusser-verwaltung-shell-alt', new Map())
    sw.store.set('anderer-cache', new Map())
    await sw.lifecycle('install')
    await sw.lifecycle('activate')

    expect([...sw.store.keys()].sort()).toEqual([
      'anderer-cache',
      'heusser-verwaltung-shell-neu',
    ])
    expect(sw.self.clients.claim).toHaveBeenCalled()
  })

  it('fasst /api nie an - weder Abruf noch direkt geöffneten Link', async () => {
    const sw = setup()
    await sw.lifecycle('install')

    expect(await sw.dispatch('/api/preorders')).toBeUndefined()
    expect(
      await sw.dispatch('/api/partners/1/report.csv', { mode: 'navigate' })
    ).toBeUndefined()
    expect(await sw.dispatch('/api')).toBeUndefined()
    expect(sw.cachedUrls().some((url) => url.startsWith('/api'))).toBe(false)
  })

  it('reicht Schreibzugriffe, fremde Hosts, RSC-Abrufe und das Manifest durch', async () => {
    const sw = setup()
    expect(
      await sw.dispatch('/admin', { method: 'POST', mode: 'navigate' })
    ).toBeUndefined()
    expect(
      await sw.dispatch('https://fonts.googleapis.com/css2?family=Lora')
    ).toBeUndefined()
    expect(await sw.dispatch('/admin/products?_rsc=abc')).toBeUndefined()
    expect(await sw.dispatch('/manifest.webmanifest')).toBeUndefined()
  })

  it('Seiten: Netz zuerst, und die Antwort wird nicht gecacht', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    const before = sw.cachedUrls()

    const response = await sw.dispatch('/admin/reports', { mode: 'navigate' })

    expect(response?.body).toBe(`netz:${ORIGIN}/admin/reports`)
    expect(sw.cachedUrls()).toEqual(before)
  })

  it('Seiten ohne Server: die Offline-Seite', async () => {
    let online = true
    const sw = setup({
      network: (url) => {
        if (!online) throw new TypeError('Failed to fetch')
        return new FakeResponse(url.endsWith('/offline.html') ? 'OFFLINE' : 'x')
      },
    })
    await sw.lifecycle('install')
    online = false

    const response = await sw.dispatch('/admin/products', { mode: 'navigate' })
    expect(response?.body).toBe('OFFLINE')
  })

  it('Seiten bei 502-504 vom Proxy (Caddy läuft, Next nicht): die Offline-Seite', async () => {
    let down = false
    const sw = setup({
      network: (url) =>
        url.endsWith('/offline.html')
          ? new FakeResponse('OFFLINE')
          : new FakeResponse('Bad Gateway', { status: down ? 502 : 200 }),
    })
    await sw.lifecycle('install')
    down = true

    const response = await sw.dispatch('/admin', { mode: 'navigate' })
    expect(response?.body).toBe('OFFLINE')
  })

  it('Seiten ohne Server und ohne Cache: Klartext 503', async () => {
    const sw = setup({
      network: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const response = await sw.dispatch('/admin', { mode: 'navigate' })
    expect(response?.status).toBe(503)
    expect(response?.body).toBe(
      'Keine Verbindung zum Server – bitte WLAN prüfen'
    )
  })

  it('/_next/static: Cache zuerst, beim ersten Mal aus dem Netz abgelegt', async () => {
    const sw = setup()
    const url = '/_next/static/chunks/app-abc123.js'

    const first = await sw.dispatch(url)
    const second = await sw.dispatch(url)

    expect(first?.body).toBe(`netz:${ORIGIN}${url}`)
    expect(second?.body).toBe(first?.body)
    const networkCalls = sw.fetchMock.mock.calls.filter(([request]) =>
      String(typeof request === 'string' ? request : request.url).endsWith(url)
    )
    expect(networkCalls).toHaveLength(1)
    expect(sw.cachedUrls()).toContain(url)
  })

  it('legt fehlgeschlagene statische Antworten nicht ab', async () => {
    const sw = setup({
      network: () => new FakeResponse('nicht da', { status: 404 }),
    })
    const url = '/_next/static/chunks/fehlt.js'
    expect((await sw.dispatch(url))?.status).toBe(404)
    expect(sw.cachedUrls()).not.toContain(url)
  })
})
