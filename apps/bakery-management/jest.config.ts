export default {
  displayName: 'bakery-management',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|vfile|vfile-message|unist-.*|unified|bail|is-plain-obj|trough|remark-.*|mdast-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|remark-gfm|ccount|escape-string-regexp|markdown-table|trim-lines|zwitch|longest-streak)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
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
  coverageDirectory: '../../coverage/apps/bakery-management',
  // Die Formulare hier werden mit `userEvent` bedient - MUI-Autocomplete,
  // Mengenknoepfe, Speichern. Lokal dauert so ein Test ein bis zwei Sekunden,
  // auf den CI-Runnern reichten die 5 s von Jest nicht (`PreorderFormClient`
  // und `InternOrdersPage` liefen dort in den Timeout, obwohl nichts kaputt war).
  testTimeout: 15000,
  // Beim Sharden (`--shard=n/3` in CI) laeuft nur ein Teil der Testdateien, die
  // Abdeckung wird aber ueber *alle* Quelldateien gerechnet - die Schwelle
  // schlaegt dann zwangslaeufig fehl, egal wie gut getestet ist. Gemessen wird
  // im Shard trotzdem (Codecov setzt die drei Teile zusammen); geurteilt wird
  // beim vollstaendigen Lauf, lokal oder in `npm run test:coverage`.
  ...(process.env.JEST_SHARDED === 'true'
    ? {}
    : {
        coverageThreshold: {
          global: {
            branches: 39,
            functions: 36,
            lines: 39,
            statements: 38,
          },
        },
      }),
}
