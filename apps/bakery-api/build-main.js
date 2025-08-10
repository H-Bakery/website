const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

console.log('Building main.ts only...')

// Create output directory
const outDir = path.join(__dirname, '../../dist/apps/bakery-api')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// Build only main.ts
const tscCommand = `npx tsc ${path.join(
  __dirname,
  'src/main.ts'
)} --outDir ${outDir} --module commonjs --target es2015 --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck --declaration --resolveJsonModule`

try {
  execSync(tscCommand, { stdio: 'inherit' })
  console.log('Build successful!')
} catch (error) {
  console.error('Build failed:', error.message)
  process.exit(1)
}
