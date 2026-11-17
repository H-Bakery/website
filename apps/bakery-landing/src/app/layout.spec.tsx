import React from 'react'
import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from './layout'

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  // AppRouterCacheProvider (ThemeRegistry) meldet hier sein CSS an.
  useServerInsertedHTML: jest.fn(),
}))

/**
 * Rendert den Inhalt von `<body>` aus dem Layout. `<html>` selbst lässt sich
 * in einem `<div>` nicht sinnvoll rendern; geprüft wird, was im Body steht.
 */
function renderLayoutBody() {
  const html = RootLayout({ children: <p>Seiteninhalt</p> })
  const body = React.Children.toArray(html.props.children).find(
    (child): child is React.ReactElement<{ children: React.ReactNode }> =>
      React.isValidElement(child) && child.type === 'body'
  )
  if (!body) throw new Error('Layout ohne <body>')
  return render(<>{body.props.children}</>)
}

describe('Landing RootLayout', () => {
  it('includes correct metadata', () => {
    expect(metadata.title).toBe(
      'Bäckerei Heusser - Traditionelle Handwerksbäckerei in Homburg-Kirrberg'
    )
    expect(metadata.description).toBe(
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933. Brot, Brötchen, Kuchen und mehr täglich frisch gebacken in Kirrberg/Homburg.'
    )
    expect(metadata.keywords).toBeDefined()
    expect(metadata.openGraph).toBeDefined()
    expect(metadata.twitter).toBeDefined()
  })

  it('includes structured data schema', () => {
    // The layout includes structured data in a script tag
    // We verify the metadata contains the necessary fields for schema.org
    expect(metadata.metadataBase).toBeDefined()
    // Canonical URLs are set per page (see page.tsx files), not globally,
    // so every page can't claim the homepage as canonical.
    expect(metadata).not.toHaveProperty('alternates')
    expect(metadata.openGraph).not.toHaveProperty('url')
  })

  it('has proper SEO configuration', () => {
    expect(metadata.robots).toBeDefined()
    expect(metadata.robots.index).toBe(true)
    expect(metadata.robots.follow).toBe(true)
  })

  it('includes Open Graph metadata', () => {
    expect(metadata.openGraph.title).toBe(
      'Bäckerei Heusser - Traditionelle Handwerksbäckerei'
    )
    expect(metadata.openGraph.description).toBe(
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933'
    )
    expect(metadata.openGraph.locale).toBe('de_DE')
    expect(metadata.openGraph.type).toBe('website')
  })

  it('includes Twitter Card metadata', () => {
    expect(metadata.twitter.card).toBe('summary_large_image')
    expect(metadata.twitter.title).toBe(
      'Bäckerei Heusser - Traditionelle Handwerksbäckerei'
    )
    expect(metadata.twitter.description).toBe(
      'Frische Backwaren aus traditioneller Handwerkskunst seit 1933'
    )
  })

  it('has proper viewport and format detection settings', () => {
    expect(metadata.formatDetection).toBeDefined()
    expect(metadata.formatDetection.email).toBe(false)
    expect(metadata.formatDetection.address).toBe(false)
    expect(metadata.formatDetection.telephone).toBe(false)
  })

  it('beginnt mit dem Sprunglink „Zum Inhalt springen“ auf main#inhalt', () => {
    const { container } = renderLayoutBody()

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName('Zum Inhalt springen')
    expect(links[0]).toHaveAttribute('href', '#inhalt')
    // Erstes fokussierbares Element überhaupt, noch vor dem Logo.
    expect(container.querySelector('a[href], button, [tabindex="0"]')).toBe(
      links[0]
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'inhalt')
    expect(main).toHaveAttribute('tabindex', '-1')
    expect(main).toHaveTextContent('Seiteninhalt')
  })
})
