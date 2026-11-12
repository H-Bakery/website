// Benannte Konstante statt anonymem Default-Export (import/no-anonymous-default-export).
const config = {
  displayName: 'bakery-digitale-baeckerei',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/out/',
    '<rootDir>/.next/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'scripts/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test-setup.ts',
  ],
  coverageDirectory: '../../coverage/apps/bakery-digitale-baeckerei',
}

export default config
