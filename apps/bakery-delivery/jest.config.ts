// Benannte Konstante statt anonymem Default-Export - sonst meldet
// `import/no-anonymous-default-export` bei jedem `nx lint` eine Warnung.
const config = {
  displayName: 'bakery-delivery',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  coverageDirectory: '../../coverage/apps/bakery-delivery',
}

export default config
