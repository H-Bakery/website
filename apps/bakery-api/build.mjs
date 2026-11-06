#!/usr/bin/env node
/**
 * Bundles the pilot API: dist/apps/bakery-api/bundle/main.js (server) and
 * dist/apps/bakery-api/bundle/cli.js (operator CLI, `create-user`).
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
import { createRequire } from 'node:module'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(appDir, '../..')
const outdir = path.join(rootDir, 'dist/apps/bakery-api/bundle')
const watch = process.argv.includes('--watch')

/**
 * `packages: 'external'` would also treat `@bakery/*` as packages, so the
 * split is done here: tsconfig aliases (`@bakery/...`) are bundled, every
 * other bare import stays external.
 */
/**
 * Pure-JS packages without dependencies that are bundled anyway: `yaml` (Z4,
 * comment-preserving Backzettel edits) is only a transitive *dev* dependency
 * in the root lockfile (via nx/lint-staged), so `npm ci --omit=dev` on the
 * box would not install it. Bundled, the server does not need it at runtime.
 */
const BUNDLED_PACKAGES = new Set(['yaml'])

/**
 * The hoisted `yaml` is whatever npm picks: several dependencies pin
 * yaml@1.x, whose API lacks `isScalar`/`isMap`/`isSeq` that the editor
 * uses. Fail the build instead of the first Grundmengen save at runtime.
 * (Follow-up: `yaml` ^2 in the root `dependencies`.)
 */
const REQUIRED_MAJOR = { yaml: 2 }
for (const [name, major] of Object.entries(REQUIRED_MAJOR)) {
  const req = createRequire(path.join(rootDir, 'package.json'))
  const version = req(`${name}/package.json`).version
  if (Number(String(version).split('.')[0]) !== major) {
    console.error(
      `[build] ${name}@${version} is hoisted to node_modules, the bundle needs ${name}@${major}.x`
    )
    process.exit(1)
  }
}

const externalPackages = {
  name: 'external-packages',
  setup(build) {
    // Bare specifiers only: not relative ("./", "../") and not absolute.
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@bakery/')) return undefined
      if (BUNDLED_PACKAGES.has(args.path.split('/')[0])) return undefined
      if (path.isAbsolute(args.path)) return undefined
      return { path: args.path, external: true }
    })
  },
}

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: rootDir,
  // main.js = the server; cli.js = operator commands (create-user, B3).
  entryPoints: {
    main: path.join(appDir, 'src/main.ts'),
    cli: path.join(appDir, 'src/cli.ts'),
  },
  outdir,
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
  console.log(`[bundle] watching, output ${path.relative(rootDir, outdir)}`)
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
