import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from './layout'

// Providers pull in the shared context stack (auth, notifications, theme)
// which is covered by its own tests – keep this test focused on the shell.
jest.mock('./Providers', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
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
})
