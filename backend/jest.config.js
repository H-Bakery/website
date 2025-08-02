module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./jest.setup.js"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/test/fixtures/"
  ],
  testPathIgnorePatterns: [
    "/node_modules/"
  ],
  testMatch: [
    "**/tests/**/*.test.js"
  ],
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/coverage/**"
  ],
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  bail: false,
  silent: false
};