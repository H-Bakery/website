import '@testing-library/jest-dom'

// MUI (CssVarsProvider) fragt matchMedia - jsdom kennt es nicht.
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

// jsdom kann kein Canvas/WebGL (und meldet sonst "Not implemented"): wie ein
// Gerät ohne WebGL. Die nachgeladene three-Komponente (Viewer3D) wird in den
// Specs gemockt - three wird in jest nie geladen.
HTMLCanvasElement.prototype.getContext = jest.fn(
  () => null
) as unknown as typeof HTMLCanvasElement.prototype.getContext
