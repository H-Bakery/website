/* eslint-disable */
export default {
  displayName: 'event-bus',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../../coverage/libs/api/event-bus',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/index.ts'],
  // Siehe apps/bakery-management/jest.config.ts: ein Shard kann die Schwelle
  // gar nicht erreichen, weil er nur einen Teil der Testdateien ausfuehrt.
  ...(process.env.JEST_SHARDED === 'true'
    ? {}
    : {
        coverageThreshold: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
        },
      }),
}
