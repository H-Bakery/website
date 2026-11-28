#!/usr/bin/env node
/**
 * Erzeugt die synthetischen Produktbilder für Tests, e2e und den Fixture-Build
 * (LANDING_PRODUKTBILDER_FIXTURE=1): zwei erfundene Formen als transparente,
 * quadratische WebP in 800 und 400 Pixeln plus index.json - in der Form, in
 * der das Daten-Repo `produkte-3d` seine gerenderten Bilder ablegt
 * (bilder/<id>/haupt-<breite>.webp, bilder/index.json).
 *
 * Die IDs gehören zu erfundenen Produkten aus tools/e2e/hq-products. Keine
 * echten Renderings: Die liegen nur im Daten-Repo und nie in diesem Repo.
 *
 * Die Ergebnisse sind eingecheckt; das Skript braucht `sharp` und läuft nur,
 * wenn sich die Fixtures ändern sollen:
 *   node apps/bakery-landing/src/test/fixtures/produktbilder/build-fixture.mjs
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dir = path.dirname(fileURLToPath(import.meta.url))

const svg = (
  inhalt
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="kruste" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#d9a05b"/><stop offset="1" stop-color="#8a5226"/>
    </radialGradient>
  </defs>
  <ellipse cx="400" cy="640" rx="270" ry="36" fill="#000" opacity="0.18"/>
  ${inhalt}
</svg>`

const FORMEN = {
  // Ein Laib mit drei Schnitten.
  'musterbrot-hell-500g': svg(`
    <ellipse cx="400" cy="440" rx="290" ry="190" fill="url(#kruste)"/>
    <g stroke="#f1d9a8" stroke-width="16" stroke-linecap="round">
      <line x1="270" y1="330" x2="330" y2="450"/>
      <line x1="370" y1="310" x2="430" y2="430"/>
      <line x1="470" y1="330" x2="530" y2="450"/>
    </g>`),
  // Ein Ring - durch das Loch muss der Hintergrund der Seite scheinen.
  musterbrezel: svg(`
    <circle cx="400" cy="400" r="210" fill="none" stroke="url(#kruste)" stroke-width="90"/>
    <g fill="#fff7e6">
      <circle cx="270" cy="250" r="9"/><circle cx="520" cy="240" r="9"/>
      <circle cx="600" cy="420" r="9"/><circle cx="210" cy="430" r="9"/>
    </g>`),
}

const index = { version: 1, bilder: {} }
for (const [id, quelle] of Object.entries(FORMEN)) {
  const varianten = []
  for (const breite of [800, 400]) {
    const file = `bilder/${id}/haupt-${breite}.webp`
    const data = await sharp(Buffer.from(quelle))
      .resize(breite, breite)
      .webp({ quality: 70, alphaQuality: 80, effort: 6 })
      .toBuffer()
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), data)
    varianten.push({ file, ansicht: 'haupt', breite, hoehe: breite })
    console.log(`${file}: ${data.byteLength} Bytes`)
  }
  index.bilder[id] = {
    // Kein Modell dahinter: eine Prüfsumme über die ID, erkennbar erfunden.
    modellSha256: createHash('sha256').update(`fixture:${id}`).digest('hex'),
    varianten,
  }
}
fs.writeFileSync(
  path.join(dir, 'index.json'),
  `${JSON.stringify(index, null, 2)}\n`
)
