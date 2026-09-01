import { defineConfig } from 'vite'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import * as path from 'path'

export default defineConfig({
  // Ohne root loest Nx' outputPath ('../../../dist/...') gegen den
  // Workspace-Root auf, und der Lib-Build landet ausserhalb des Repos.
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/bakery-management-feature-analytics',

  plugins: [
    react(),
    nxViteTsPaths(),
    dts({
      entryRoot: path.join(__dirname, 'src'),
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],

  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'bakery-management-feature-analytics',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
})
