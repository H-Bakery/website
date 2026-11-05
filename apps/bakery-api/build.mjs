#!/usr/bin/env node
/**
 * Bundles the pilot API into one file: dist/apps/bakery-api/bundle/main.js
 *
 * - App code, `@bakery/*` libs (tsconfig paths, source) and the `*.core.js`
 *   business rules are bundled.
 * - npm packages stay external and are loaded from the root `node_modules`
 *   at runtime (sqlite3 is native and cannot be bundled anyway).
 * - `useDefineForClassFields: false` (tsconfig.bundle.json): with define
 *   semantics, class fields would shadow the attribute getters Sequelize
 *   installs on its models.
 *
 * Usage (from the website root):
 *   node apps/bakery-api/build.mjs            one build
 *   node apps/bakery-api/build.mjs --watch    rebuild on change
 *   npx nx run bakery-api:bundle
 */
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(appDir, '../..')
const outfile = path.join(rootDir, 'dist/apps/bakery-api/bundle/main.js')
const watch = process.argv.includes('--watch')

/**
 * `packages: 'external'` would also treat `@bakery/*` as packages, so the
 * split is done here: tsconfig aliases (`@bakery/...`) are bundled, every
 * other bare import stays external.
 */
const externalPackages = {
  name: 'external-packages',
  setup(build) {
    // Bare specifiers only: not relative ("./", "../") and not absolute.
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@bakery/')) return undefined
      if (path.isAbsolute(args.path)) return undefined
      return { path: args.path, external: true }
    })
  },
}

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: rootDir,
  entryPoints: [path.join(appDir, 'src/main.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  tsconfig: path.join(appDir, 'tsconfig.bundle.json'),
  plugins: [externalPackages],
  sourcemap: true,
  logLevel: 'info',
  metafile: true,
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log(`[bundle] watching, output ${path.relative(rootDir, outfile)}`)
} else {
  const result = await esbuild.build(options)
  const inputs = Object.keys(result.metafile.inputs)
  const external = new Set(
    Object.values(result.metafile.outputs)
      .flatMap((o) => o.imports)
      .filter((i) => i.external)
      .map((i) => i.path)
  )
  console.log(
    `[bundle] ${inputs.length} source files, external: ${[...external]
      .sort()
      .join(', ')}`
  )
}
