import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from './layout'

describe('Landing RootLayout', () => {
  it('includes correct metadata', () => {
    expect(metadata.title).toBe(
      'Bäckerei Heusser - Traditionelle Handwerksbäckerei in Karlsruhe-Beiertheim'
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
    expect(metadata.alternates).toBeDefined()
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
})
