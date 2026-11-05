import { render, waitFor } from '@testing-library/react'
import ServiceWorkerRegistration from './ServiceWorkerRegistration'
import ThemeColorSync from './ThemeColorSync'
import { PWA_THEME_COLORS } from '../../lib/pwa'

type Registration = {
  active: { scriptURL: string } | null
  waiting: null
  installing: null
  unregister: jest.Mock
}

function registration(scriptURL: string): Registration {
  return {
    active: { scriptURL },
    waiting: null,
    installing: null,
    unregister: jest.fn(async () => true),
  }
}

describe('ServiceWorkerRegistration', () => {
  const originalEnv = { ...process.env }
  let register: jest.Mock
  let registrations: Registration[]
  let cacheKeys: string[]
  let deleteCache: jest.Mock

  beforeEach(() => {
    register = jest.fn(async () => ({}))
    registrations = []
    cacheKeys = []
    deleteCache = jest.fn(async () => true)
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register,
        getRegistrations: jest.fn(async () => registrations),
      },
    })
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: jest.fn(async () => cacheKeys), delete: deleteCache },
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker
    delete (window as { caches?: unknown }).caches
  })

  it('rendert nichts', () => {
    const { container } = render(<ServiceWorkerRegistration />)
    expect(container).toBeEmptyDOMElement()
  })

  it('registriert im Produktions-Build /sw.js mit Build-Version, Scope /', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SW_VERSION: 'v42',
    }
    render(<ServiceWorkerRegistration />)

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
    expect(register).toHaveBeenCalledWith('/sw.js?v=v42', { scope: '/' })
  })

  it('registriert in Tests/Entwicklung nicht', async () => {
    // jest setzt NODE_ENV=test - genau wie `next dev` „development".
    render(<ServiceWorkerRegistration />)
    await waitFor(() =>
      expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalled()
    )
    expect(register).not.toHaveBeenCalled()
  })

  it('meldet außerhalb der Produktion einen alten Worker der App ab und leert nur dessen Cache', async () => {
    const own = registration('http://localhost:4201/sw.js?v=alt')
    const foreign = registration('http://localhost:4201/anderer-worker.js')
    registrations = [own, foreign]
    cacheKeys = ['heusser-verwaltung-shell-alt', 'fremder-cache']

    render(<ServiceWorkerRegistration />)

    await waitFor(() =>
      expect(deleteCache).toHaveBeenCalledWith('heusser-verwaltung-shell-alt')
    )
    expect(own.unregister).toHaveBeenCalled()
    expect(foreign.unregister).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalledWith('fremder-cache')
  })

  it('der Notschalter NEXT_PUBLIC_DISABLE_SW verhindert die Registrierung im Build', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_DISABLE_SW: '1',
    }
    render(<ServiceWorkerRegistration />)
    await waitFor(() =>
      expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalled()
    )
    expect(register).not.toHaveBeenCalled()
  })

  it('ohne sicheren Kontext (http im LAN) keine Registrierung', async () => {
    process.env = { ...process.env, NODE_ENV: 'production' }
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    })
    render(<ServiceWorkerRegistration />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(register).not.toHaveBeenCalled()
  })

  it('ohne Browser-Unterstützung passiert nichts (jsdom, alte Browser)', () => {
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker
    process.env = { ...process.env, NODE_ENV: 'production' }
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow()
  })
})

describe('ThemeColorSync', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove())
  })

  it('setzt alle theme-color-Tags auf den Modus der App', () => {
    for (const media of [
      '(prefers-color-scheme: light)',
      '(prefers-color-scheme: dark)',
    ]) {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.media = media
      document.head.appendChild(meta)
    }

    const { rerender } = render(<ThemeColorSync mode="dark" />)
    const contents = () =>
      Array.from(
        document.head.querySelectorAll('meta[name="theme-color"]')
      ).map((meta) => meta.getAttribute('content'))
    expect(contents()).toEqual([PWA_THEME_COLORS.dark, PWA_THEME_COLORS.dark])

    rerender(<ThemeColorSync mode="light" />)
    expect(contents()).toEqual([PWA_THEME_COLORS.light, PWA_THEME_COLORS.light])
  })
})
