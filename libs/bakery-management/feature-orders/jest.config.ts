export default {
  displayName: 'feature-orders',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    // ESM-only Pakete hinter dem Barrel `@bakery/shared/ui` (markdown-display);
    // jest transformiert node_modules nicht. Gleicher Stub wie im Shop.
    '^react-markdown$': '<rootDir>/../../../tools/jest/markdown-stub.js',
    '^remark-gfm$': '<rootDir>/../../../tools/jest/markdown-stub.js',
  },
  coverageDirectory: '../../../coverage/libs/bakery-management/feature-orders',
}
