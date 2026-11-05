/**
 * Two jest projects (roadmap B1). `npx jest -c apps/bakery-api/jest.config.js`
 * and `npx nx test bakery-api` run both; `--selectProjects js|ts` picks one.
 *
 * js - plain-JS tests under tests/**\/*.test.js: the `*.core.js` business
 *      rules, the mock server and the legacy JS layer.
 * ts - TypeScript tests (src/**\/*.spec.ts, tests/**\/*.test.ts) through
 *      ts-jest, transpile-only (`isolatedModules`, type errors are the
 *      `typecheck` target's job). `@bakery/*` resolves via the
 *      tsconfig.base.json paths. Integration tests drive `createApp()` on an
 *      in-memory SQLite with the pilot baseline (tests/helpers/createTestApp.ts).
 */
const path = require('path')
const { pathsToModuleNameMapper } = require('ts-jest')
const { compilerOptions } = require('../../tsconfig.base.json')

/**
 * TS tests that are not run, all for domains that are unmounted in the pilot
 * (roadmap §3/§4) and depend on legacy models without a table in the
 * baseline. B12 deletes them together with their code.
 *
 *   src/routes/__tests__/inventory.routes.test.ts      inventory (D11: out of pilot)
 *   src/services/__tests__/inventory.service.test.ts   inventory (D11)
 *   src/services/__tests__/email-notification.test.ts  email/notifications (unmounted)
 *
 * The other 28 TS specs of the "31" (roadmap §4) live in libs/api/* and run
 * in those libraries' own nx projects, not here - see tests/README.md.
 */
const EXCLUDED_TS_TESTS = [
  '<rootDir>/src/routes/__tests__/inventory.routes.test.ts',
  '<rootDir>/src/services/__tests__/inventory.service.test.ts',
  '<rootDir>/src/services/__tests__/email-notification.test.ts',
]

/** @type {import('jest').Config} */
const js = {
  displayName: 'js',
  rootDir: __dirname,
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/test/fixtures/'],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // marked@16 is ESM-only; the legacy layer (index.js -> utils/recipeParser.js)
  // requires it. See tests/helpers/markedStub.js.
  moduleNameMapper: { '^marked$': '<rootDir>/tests/helpers/markedStub.js' },
}

/** @type {import('jest').Config} */
const ts = {
  displayName: 'ts',
  rootDir: __dirname,
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-ts.js'],
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', ...EXCLUDED_TS_TESTS],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.spec.json') },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../',
  }),
}

module.exports = {
  projects: [js, ts],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
  ],
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  bail: false,
  silent: false,
}
