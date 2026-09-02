export default {
  displayName: 'api-import-service',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  // Die Unter-Libs (core, orders, ...) haben eigene test-Targets; hier laufen nur
  // die Specs unter src/.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/(core|customers|event-bus|inventory|notifications|orders|production|sales-analytics|types|workflows)/',
  ],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/api/import-service',
}
