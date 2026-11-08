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

// jsdom kann kein Canvas/WebGL (und meldet sonst "Not implemented"): wie ein
// Gerät ohne WebGL - die Vorschau bleibt 2D. Specs, die 3D brauchen,
// überschreiben das und mocken die nachgeladene three-Komponente.
HTMLCanvasElement.prototype.getContext = jest.fn(
  () => null
) as unknown as typeof HTMLCanvasElement.prototype.getContext
