export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // Jede Spec läuft genau einmal - im Projekt, zu dem sie gehört. Die Unterordner
  // mit eigenem test-Target sind hier ausgenommen; sonst kompiliert dieselbe Spec
  // ein zweites Mal gegen diese (strengere) tsconfig und fällt dort spurios um.
  // reporting-service/__tests__ ist ein von Hand gestartetes Node-Skript, kein Jest-Test.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/(baking-list|database|delivery|email|import-service|preferences|templates|unsold-products|utils|websocket)/',
    '<rootDir>/reporting-service/src/lib/__tests__/',
  ],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/api',
}
