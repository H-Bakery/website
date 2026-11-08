/**
 * Verhalten von `public/sw.js`, ausgeführt in einer nachgebauten
 * Service-Worker-Umgebung (vm-Kontext mit Fake-`caches` und -`fetch`).
 *
 * Regression UI-Runde 2: ohne Worker endete ein Neuladen im Funkloch (der
 * Fahrer kommt aus der Navi-App zurück) in der leeren Fehlerseite des
 * Browsers - die Offline-Kopie der Tour kam nie zum Zug.
 */
import { readFileSync } from 'fs'
import path from 'path'
import vm from 'vm'

const SOURCE = readFileSync(
  path.resolve(__dirname, '../../public/sw.js'),
  'utf8'
)
const ORIGIN = 'https://fahrer.example.test'
const SHELL_HTML =
  '<html><script src="/_next/static/chunks/main-1.js"></script>' +
  '<link rel="stylesheet" href="/_next/static/css/app-2.css">Wird geladen …</html>'

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
  async text() {
    return this.body
  }
}

class FakeRequest {
  method: string
  mode: string
  constructor(
    public url: string,
    init: { method?: string; mode?: string; cache?: string } = {}
  ) {
    this.url = new URL(url, ORIGIN).href
    this.method = init.method ?? 'GET'
    this.mode = init.mode ?? 'cors'
  }
}

type Listener = (event: unknown) => void

function setup(
  options: { network?: (url: string) => FakeResponse | Promise<never> } = {}
) {
  const store = new Map<string, Map<string, FakeResponse>>()
  const keyOf = (request: string | FakeRequest) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).href
  let online = true
  const network =
    options.network ??
    ((url: string) =>
      new URL(url).pathname === '/'
        ? new FakeResponse(SHELL_HTML)
        : new FakeResponse(`netz:${url}`))
  const fetchMock = jest.fn(async (request: FakeRequest | string) => {
    if (!online) throw new TypeError('Failed to fetch')
    return network(keyOf(request))
  })

  const openCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const entries = store.get(name) as Map<string, FakeResponse>
    return {
      put: async (request: string | FakeRequest, response: FakeResponse) => {
        entries.set(keyOf(request), response)
      },
      match: async (request: string | FakeRequest) =>
        entries.get(keyOf(request)),
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      delete: async (request: { url: string }) => entries.delete(request.url),
    }
  }

  const listeners: Record<string, Listener> = {}
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=b1`, origin: ORIGIN },
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
  }

  vm.runInNewContext(SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    Request: FakeRequest,
    Response: FakeResponse,
    URL,
    Set,
    Promise,
    console,
  })

  async function lifecycle(type: 'install' | 'activate') {
    let pending: Promise<unknown> = Promise.resolve()
    listeners[type]({ waitUntil: (p: Promise<unknown>) => (pending = p) })
    await pending
  }

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

  async function message(data: unknown) {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.message({
      data,
      waitUntil: (p: Promise<unknown>) => (pending = p),
    })
    await pending
  }

  const cachedUrls = () =>
    [...store.values()].flatMap((entries) =>
      [...entries.keys()].map((url) => url.replace(ORIGIN, ''))
    )

  return {
    store,
    fetchMock,
    lifecycle,
    dispatch,
    message,
    cachedUrls,
    setOnline: (value: boolean) => (online = value),
  }
}

describe('public/sw.js (Fahrer-App)', () => {
  it('legt beim Installieren die Hülle samt ihrer Chunks ab', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    expect(sw.cachedUrls().sort()).toEqual([
      '/',
      '/_next/static/chunks/main-1.js',
      '/_next/static/css/app-2.css',
    ])
  })

  it('zeigt beim Neuladen ohne Netz die gespeicherte Hülle statt der Fehlerseite', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    sw.setOnline(false)
    const page = await sw.dispatch('/', { mode: 'navigate' })
    expect(page?.body).toBe(SHELL_HTML)
    // Auch eine andere Adresse der App (z. B. mit Suchparameter).
    const other = await sw.dispatch('/?tour=4', { mode: 'navigate' })
    expect(other?.body).toBe(SHELL_HTML)
    // Und die Chunks kommen aus dem Cache.
    const chunk = await sw.dispatch('/_next/static/chunks/main-1.js')
    expect(chunk?.body).toBe(`netz:${ORIGIN}/_next/static/chunks/main-1.js`)
  })

  it('geht mit Netz zuerst ans Netz und frischt die Hülle auf', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    sw.fetchMock.mockImplementationOnce(
      async () => new FakeResponse('<html>neu</html>')
    )
    const page = await sw.dispatch('/', { mode: 'navigate' })
    expect(page?.body).toBe('<html>neu</html>')
    sw.setOnline(false)
    expect((await sw.dispatch('/', { mode: 'navigate' }))?.body).toBe(
      '<html>neu</html>'
    )
  })

  it('nimmt bei 502-504 eines Proxys die gespeicherte Hülle', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    sw.fetchMock.mockImplementationOnce(
      async () => new FakeResponse('Bad Gateway', { status: 502 })
    )
    expect((await sw.dispatch('/', { mode: 'navigate' }))?.body).toBe(
      SHELL_HTML
    )
  })

  it('sagt ohne Netz und ohne gespeicherte Hülle, was los ist', async () => {
    const sw = setup()
    sw.setOnline(false)
    await sw.lifecycle('install')
    const page = await sw.dispatch('/', { mode: 'navigate' })
    expect(page?.status).toBe(503)
    expect(page?.body).toMatch(/^Keine Verbindung/)
  })

  it('fasst Daten nie an: /api und fremde Hosts gehen durch', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    expect(await sw.dispatch('/api/deliveries/tours')).toBeUndefined()
    expect(
      await sw.dispatch('/api/deliveries/tours', { mode: 'navigate' })
    ).toBeUndefined()
    expect(
      await sw.dispatch('https://api.example.test/api/deliveries/tours')
    ).toBeUndefined()
    expect(
      await sw.dispatch('https://tile.openstreetmap.org/1/2/3.png')
    ).toBeUndefined()
    expect(
      await sw.dispatch('/_next/static/x.js', { method: 'POST' })
    ).toBeUndefined()
    expect(sw.cachedUrls().some((url) => url.includes('/api'))).toBe(false)
  })

  it('legt gemeldete Dateien nach, aber nur die Hülle', async () => {
    const sw = setup()
    await sw.lifecycle('install')
    await sw.message({
      type: 'cache-urls',
      urls: [
        '/_next/static/chunks/map-9.js',
        '/leaflet/marker-icon.png',
        '/api/x',
      ],
    })
    expect(sw.cachedUrls()).toEqual(
      expect.arrayContaining([
        '/_next/static/chunks/map-9.js',
        '/leaflet/marker-icon.png',
      ])
    )
    expect(sw.cachedUrls()).not.toContain('/api/x')
  })

  it('löscht beim Aktivieren die Caches älterer Builds', async () => {
    const sw = setup()
    sw.store.set('heusser-fahrer-shell-alt', new Map())
    sw.store.set('fremd', new Map())
    await sw.lifecycle('install')
    await sw.lifecycle('activate')
    expect([...sw.store.keys()].sort()).toEqual([
      'fremd',
      'heusser-fahrer-shell-b1',
    ])
  })
})
