#!/usr/bin/env node
/**
 * Erzeugt die PWA-Icons der Management-App (F3) aus dem Heusser-Monogramm des
 * Shops (`apps/bakery-shop/public/favicon.svg`): SVG-Quellen in
 * `apps/bakery-management/pwa/` und die PNGs in `public/icons/`.
 *
 * Aus `website/` aufrufen, nur nötig, wenn sich das Monogramm ändert:
 *
 *   node apps/bakery-management/pwa/render-icons.mjs
 *
 * Drei Formen:
 * - `icon`          abgerundetes Quadrat, Zweck `any` (Browser, Desktop).
 * - `icon-maskable` randlos, Monogramm in der 80-%-Sicherheitszone, damit
 *                   Android es rund, eckig oder als Tropfen zuschneiden kann.
 * - `apple-touch`   randlos (iOS rundet selbst ab), ohne Transparenz.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const shopFavicon = resolve(appDir, '../bakery-shop/public/favicon.svg')
const outDir = join(appDir, 'public/icons')

const BROWN = '#5A2E2A'
const CREAM = '#FFF3E6'

// Das Monogramm im Shop-Favicon: ein Pfad, Rohmaße 30.49 × 40.
const match = readFileSync(shopFavicon, 'utf8').match(/<path d="([^"]+)"/)
if (!match) throw new Error(`Kein Pfad in ${shopFavicon}`)
const glyph = match[1]
const GLYPH_CENTER = { x: 15.2452, y: 20 }

/** SVG 64×64: Hintergrund mit Eckenradius `rx`, Monogramm mittig in `scale`. */
function svg(rx, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rx}" ry="${rx}" fill="${BROWN}"/>
  <g transform="translate(32 32) scale(${scale}) translate(-${GLYPH_CENTER.x} -${GLYPH_CENTER.y})">
    <path d="${glyph}" fill="${CREAM}"/>
  </g>
</svg>
`
}

// Maskable: halbe Diagonale des Monogramms bei 0.85 ≈ 22.6 < 25.6 (40 % von 64).
const shapes = {
  icon: svg(12, 1.056),
  'icon-maskable': svg(0, 0.85),
  'apple-touch-icon': svg(0, 0.96),
}

const renders = [
  ['icon', 192, 'icon-192.png'],
  ['icon', 512, 'icon-512.png'],
  ['icon-maskable', 192, 'icon-maskable-192.png'],
  ['icon-maskable', 512, 'icon-maskable-512.png'],
  ['apple-touch-icon', 180, 'apple-touch-icon.png'],
]

mkdirSync(outDir, { recursive: true })
for (const [name, source] of Object.entries(shapes)) {
  writeFileSync(join(here, `${name}.svg`), source)
}
for (const [name, size, file] of renders) {
  await sharp(Buffer.from(shapes[name]))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, file))
  console.log(`public/icons/${file} (${size}×${size})`)
}
