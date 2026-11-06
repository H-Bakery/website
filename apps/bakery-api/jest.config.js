/**
 * Two jest projects (roadmap B1). `npx jest -c apps/bakery-api/jest.config.js`
 * and `npx nx test bakery-api` run both; `--selectProjects js|ts` picks one.
 *
 * js - plain-JS tests under tests/**\/*.test.js: the `*.core.js` business
 *      rules and the CommonJS route modules.
 * ts - TypeScript tests (src/**\/*.spec.ts, tests/**\/*.test.ts) through
 *      ts-jest, transpile-only (`isolatedModules`, type errors are the
 *      `typecheck` target's job). `@bakery/*` resolves via the
 *      tsconfig.base.json paths. Integration tests drive `createApp()` on an
 *      in-memory SQLite with the pilot baseline (tests/helpers/createTestApp.ts).
 */
const path = require('path')
const { pathsToModuleNameMapper } = require('ts-jest')
const { compilerOptions } = require('../../tsconfig.base.json')

/** @type {import('jest').Config} */
const js = {
  displayName: 'js',
  rootDir: __dirname,
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/fixtures/'],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
}

/** @type {import('jest').Config} */
const ts = {
  displayName: 'ts',
  rootDir: __dirname,
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-ts.js'],
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
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
