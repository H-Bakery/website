/**
 * Loads TypeScript sources of the pilot API into a plain-JS jest test.
 *
 * `jest.config.js` has no TS transform, so the given modules are bundled with
 * esbuild - same settings as `build.mjs` (tsconfig.bundle.json, `@bakery/*`
 * bundled, npm packages external) - into a temp file and required from there.
 *
 *   const { resolveDbPath } = await loadTs(['src/config/env'])
 *
 * Paths are relative to `apps/bakery-api`. Every call gets a fresh bundle
 * (fresh module state, e.g. the model registry).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const esbuild = require('esbuild')

const appDir = path.resolve(__dirname, '../..')
const rootDir = path.resolve(appDir, '../..')

const externalPackages = {
  name: 'external-packages',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@bakery/')) return undefined
      if (path.isAbsolute(args.path)) return undefined
      return { path: args.path, external: true }
    })
  },
}

async function loadTs(modules) {
  const contents = modules
    .map((m) => `export * from ${JSON.stringify(path.join(appDir, m))}`)
    .join('\n')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-api-ts-'))
  const outfile = path.join(dir, 'bundle.js')
  // Plugins need the async API.
  await esbuild.build({
    absWorkingDir: rootDir,
    stdin: {
      contents,
      resolveDir: appDir,
      sourcefile: 'test-entry.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    tsconfig: path.join(appDir, 'tsconfig.bundle.json'),
    plugins: [externalPackages],
    logLevel: 'error',
  })
  // Resolve external packages from the website root, not from the temp dir.
  const Module = require('module')
  const mod = new Module(outfile)
  mod.filename = outfile
  mod.paths = Module._nodeModulePaths(rootDir)
  mod._compile(fs.readFileSync(outfile, 'utf8'), outfile)
  fs.rmSync(dir, { recursive: true, force: true })
  return mod.exports
}

module.exports = { loadTs }
