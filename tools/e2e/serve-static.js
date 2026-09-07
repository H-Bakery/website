#!/usr/bin/env node
/**
 * Statischer Server für einen Next.js-Export (`output: 'export'`), wie ihn die
 * Landing-E2E-Suite braucht.
 *
 * Verhält sich wie GitHub Pages, wohin `apps/bakery-landing/out/` deployt wird:
 *
 *   /            -> index.html
 *   /about       -> about.html   (oder about/index.html)
 *   /about/      -> about/index.html (oder about.html)
 *   /gibts-nicht -> 404.html mit Status 404
 *
 * Bewusst ohne Abhängigkeit: `http-server` kennt weder die `.html`-Auflösung
 * noch die 404-Seite, und `next start` weigert sich bei einem Export.
 *
 * Aufruf: node tools/e2e/serve-static.js <verzeichnis> [--port 3000]
 */

const fs = require('fs')
const http = require('http')
const path = require('path')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

function parseArgs(argv) {
  let dir = null
  let port = 3000
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--port' || arg === '-p') {
      port = Number(argv[i + 1])
      i += 1
    } else if (!dir) {
      dir = arg
    }
  }
  if (!dir || !Number.isInteger(port) || port <= 0) {
    console.error(
      'Aufruf: node tools/e2e/serve-static.js <verzeichnis> [--port 3000]'
    )
    process.exit(2)
  }
  return { dir: path.resolve(dir), port }
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

/** Löst einen URL-Pfad auf eine Datei im Export auf, sonst `null`. */
function resolveFile(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  // Pfad normalisieren und im Wurzelverzeichnis halten.
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const base = path.join(root, safe)
  if (!base.startsWith(root)) return null

  const candidates = safe.endsWith('/')
    ? [path.join(base, 'index.html'), `${base.replace(/[/\\]$/, '')}.html`]
    : [base, `${base}.html`, path.join(base, 'index.html')]

  return candidates.find(isFile) ?? null
}

function send(res, status, file) {
  const ext = path.extname(file).toLowerCase()
  res.writeHead(status, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  fs.createReadStream(file).pipe(res)
}

function main() {
  const { dir, port } = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(dir)) {
    console.error(`Verzeichnis nicht gefunden: ${dir}`)
    process.exit(2)
  }
  const notFound = path.join(dir, '404.html')

  const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname
    const file = resolveFile(dir, urlPath)
    if (file) {
      send(res, 200, file)
    } else if (isFile(notFound)) {
      send(res, 404, notFound)
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Nicht gefunden')
    }
  })

  server.listen(port, () => {
    console.log(`Statischer Export ${dir} auf http://localhost:${port}`)
  })
}

main()
