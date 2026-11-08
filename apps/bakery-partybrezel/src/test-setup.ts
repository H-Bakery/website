import '@testing-library/jest-dom'

// MUI (useMediaQuery, CssVarsProvider) fragt matchMedia - jsdom kennt es nicht.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

Element.prototype.scrollIntoView = jest.fn()
window.scrollTo = jest.fn() as unknown as typeof window.scrollTo
