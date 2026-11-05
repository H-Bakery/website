import { render, screen } from '@testing-library/react'
import RootLayout, { metadata, viewport } from './layout'

// Providers pull in the shared context stack (auth, notifications, theme)
// which is covered by its own tests – keep this test focused on the shell.
jest.mock('./Providers', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}))

jest.mock('../components/pwa/ServiceWorkerRegistration', () => ({
  __esModule: true,
  default: () => <span data-testid="sw-registration" />,
}))

jest.mock('@mui/material-nextjs/v14-appRouter', () => ({
  AppRouterCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

describe('Management RootLayout', () => {
  let errorSpy: jest.SpyInstance

  beforeAll(() => {
    // Rendering <html> inside the test container triggers DOM nesting warnings
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterAll(() => errorSpy.mockRestore())

  it('renders children inside the providers', () => {
    render(
      <RootLayout>
        <div data-testid="test-child">Test Content</div>
      </RootLayout>
    )

    expect(screen.getByTestId('providers')).toBeInTheDocument()
    expect(screen.getByTestId('test-child')).toBeInTheDocument()
  })

  it('declares German language', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    )

    expect(container.querySelector('html')).toHaveAttribute('lang', 'de')
  })

  it('meldet Next das sanfte Scrollen aus global.css', () => {
    // Ohne dieses Attribut warnt Next im Dev-Modus bei jeder clientseitigen
    // Navigation ("Detected `scroll-behavior: smooth` on the <html> element").
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    )

    expect(container.querySelector('html')).toHaveAttribute(
      'data-scroll-behavior',
      'smooth'
    )
  })

  it('exposes German metadata', () => {
    expect(metadata.title).toBe('Bäckerei Heusser - Management System')
    expect(metadata.description).toContain('Verwaltungssystem')
  })

  describe('PWA (F3)', () => {
    it('verlinkt Manifest und Apple-Touch-Icon', () => {
      expect(metadata.manifest).toBe('/manifest.webmanifest')
      expect(metadata.applicationName).toBe('Heusser Verwaltung')
      expect(metadata.icons).toMatchObject({
        apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
      })
      expect(metadata.appleWebApp).toMatchObject({
        capable: true,
        title: 'Verwaltung',
      })
    })

    it('setzt Viewport und Statusleistenfarbe je Modus, Zoom bleibt erlaubt', () => {
      expect(viewport.width).toBe('device-width')
      expect(viewport.initialScale).toBe(1)
      expect(viewport.maximumScale).toBeUndefined()
      expect(viewport.userScalable).toBeUndefined()
      expect(viewport.themeColor).toEqual([
        { media: '(prefers-color-scheme: light)', color: '#1976d2' },
        { media: '(prefers-color-scheme: dark)', color: '#272727' },
      ])
    })

    it('bindet die Service-Worker-Registrierung ein', () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      )
      expect(screen.getByTestId('sw-registration')).toBeInTheDocument()
    })
  })
})
