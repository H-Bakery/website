// Import jest-dom's methods for DOM assertions
import '@testing-library/jest-dom'

// Add missing globals for tests that might need encoding
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Add better error handling for unhandled promise rejections
// This will make tests fail on unhandled promise rejections instead of just printing a warning
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:');
  console.error(error);
  process.exit(1);
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/',
    query: {},
    route: '/',
    asPath: '/'
  })),
  usePathname: jest.fn().mockReturnValue('/'),
  useSearchParams: jest.fn().mockReturnValue(new URLSearchParams()),
  useParams: jest.fn().mockReturnValue({}),
}))

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ''} />
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
    key: jest.fn((idx) => Object.keys(store)[idx] || null),
    length: jest.fn(() => Object.keys(store).length)
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {}
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
    key: jest.fn((idx) => Object.keys(store)[idx] || null),
    length: jest.fn(() => Object.keys(store).length)
  }
})()

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Suppress React 18 console errors/warnings during tests
const originalError = console.error
console.error = (...args) => {
  if (/Warning.*not wrapped in act/.test(args[0])) {
    return
  }
  if (/Warning: ReactDOM.render is no longer supported/.test(args[0])) {
    return
  }
  if (/React does not recognize the.*prop on a DOM element/.test(args[0])) {
    return
  }
  originalError.call(console, ...args)
}

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
    this.entries = [];
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    this.unobserve = jest.fn();
  }

  // Helper method to simulate intersection
  simulateIntersection(isIntersecting) {
    this.entries = [{ isIntersecting }];
    this.callback(this.entries, this);
  }
}

global.IntersectionObserver = IntersectionObserverMock;

// MSW will be manually initialized in tests that need it
// This avoids the require.js error when importing msw/node