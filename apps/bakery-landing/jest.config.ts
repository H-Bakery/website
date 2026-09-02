export default {
  displayName: 'bakery-landing',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  // tests/ enthaelt Playwright-Specs (frontend-health.test.ts). Jest zieht sie
  // sonst mit ein und bricht mit "Playwright Test did not expect test.use()" ab.
  testPathIgnorePatterns: ['<rootDir>/tests/'],
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    // ESM-only Pakete hinter dem Barrel `@bakery/shared/ui` (markdown-display);
    // ohne Stub stirbt layout.navigation.spec an "Unexpected token 'export'".
    '^react-markdown$': '<rootDir>/../../tools/jest/markdown-stub.js',
    '^remark-gfm$': '<rootDir>/../../tools/jest/markdown-stub.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
  ],
  coverageDirectory: '../../coverage/apps/bakery-landing',
  coverageThreshold: {
    global: {
      branches: 17,
      functions: 19,
      lines: 22,
      statements: 21,
    },
  },
}
