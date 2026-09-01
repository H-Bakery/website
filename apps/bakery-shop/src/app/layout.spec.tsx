import React from 'react'
import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from './layout'

jest.mock('../theme/ThemeRegistry', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-registry">{children}</div>
  )),
}))

jest.mock('@bakery/shared/contexts', () => ({
  RootProvider: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="root-provider">{children}</div>
  )),
}))

jest.mock('../components/shop-header', () => ({
  ShopHeader: jest.fn(() => <div data-testid="shop-header" />),
}))

jest.mock('../components/shop-footer', () => ({
  ShopFooter: jest.fn(() => <div data-testid="shop-footer" />),
}))

const pageContent = (
  <section data-testid="page-content">
    <h1>Shop-Inhalt</h1>
  </section>
)

describe('RootLayout (Shop)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Struktur', () => {
    it('rendert Kopfzeile, Seiteninhalt und Fußzeile', () => {
      render(<RootLayout>{pageContent}</RootLayout>)

      expect(screen.getByTestId('shop-header')).toBeInTheDocument()
      expect(screen.getByTestId('page-content')).toBeInTheDocument()
      expect(screen.getByTestId('shop-footer')).toBeInTheDocument()
    })

    it('legt den Seiteninhalt in ein <main>', () => {
      const { container } = render(<RootLayout>{pageContent}</RootLayout>)

      const main = container.querySelector('main')
      expect(main).toContainElement(screen.getByTestId('page-content'))
      expect(main).not.toContainElement(screen.getByTestId('shop-header'))
    })

    it('legt das MUI-Theme um alle Kontexte', () => {
      render(<RootLayout>{pageContent}</RootLayout>)

      const registry = screen.getByTestId('theme-registry')
      expect(registry).toContainElement(screen.getByTestId('root-provider'))
    })
  })

  describe('Warenkorb-Konfiguration', () => {
    it('schaltet den Mehrwertsteuer-Aufschlag ab (Bruttopreise)', () => {
      const { RootProvider } = jest.requireMock('@bakery/shared/contexts')
      render(<RootLayout>{pageContent}</RootLayout>)

      expect(RootProvider).toHaveBeenCalled()
      expect(RootProvider.mock.calls[0][0]).toEqual(
        expect.objectContaining({ cart: { taxRate: 0 } })
      )
    })
  })

  describe('Metadaten', () => {
    it('nennt den Online-Shop und die Vorbestellung', () => {
      expect(metadata.title).toMatchObject({
        default: expect.stringContaining('Online-Shop'),
      })
      expect(metadata.description).toContain('vorbestellen')
    })

    it('verortet die Bäckerei in Homburg, nicht in Karlsruhe', () => {
      const haystack = JSON.stringify(metadata)

      expect(haystack).toContain('Homburg')
      expect(haystack).not.toContain('Karlsruhe')
      expect(haystack).not.toContain('Beiertheim')
    })
  })
})
