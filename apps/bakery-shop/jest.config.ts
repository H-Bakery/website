export default {
  displayName: 'bakery-shop',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    // ESM-only Pakete, die jest nicht transformiert. Sie hängen über das
    // Barrel `@bakery/shared/ui` (markdown-display) an fast jedem Import.
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
  coverageDirectory: '../../coverage/apps/bakery-shop',
  // Siehe apps/bakery-management/jest.config.ts: ein Shard kann die Schwelle
  // gar nicht erreichen, weil er nur einen Teil der Testdateien ausfuehrt.
  ...(process.env.JEST_SHARDED === 'true'
    ? {}
    : {
        coverageThreshold: {
          global: {
            branches: 66,
            functions: 68,
            lines: 68,
            statements: 68,
          },
        },
      }),
}
