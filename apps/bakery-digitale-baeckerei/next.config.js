// @ts-check
const { PHASE_PRODUCTION_BUILD } = require('next/constants')

/**
 * Digitale Bäckerei: rein statischer Export, keine Workspace-Libs, also kein
 * withNx(). Der Basis-Pfad kommt aus DIGITALE_BAECKEREI_BASE_PATH, damit der
 * Export unter /digitale-baeckerei auf der Pages-Seite der Landing Page laufen
 * kann - siehe docs/apps/digitale-baeckerei.md.
 */

/** @param {string | undefined} raw */
function normalizeBasePath(raw) {
  const value = (raw || '').trim().replace(/\/+$/, '')
  if (value === '') return ''
  if (!/^(\/[A-Za-z0-9._-]+)+$/.test(value)) {
    throw new Error(
      `DIGITALE_BAECKEREI_BASE_PATH muss mit "/" beginnen und darf nur Buchstaben, Ziffern, ".", "_" und "-" enthalten (bekommen: "${raw}")`
    )
  }
  return value
}

const basePath = normalizeBasePath(process.env.DIGITALE_BAECKEREI_BASE_PATH)

/**
 * Einrichten-Modus (DB12): das lokale Werkzeug des Inhabers - nur im
 * Dev-Server, den `scripts/einrichten.mjs` startet. Ein Export mit diesem
 * Schalter wird nicht gebaut: Das Werkzeug und die Daten, die es braucht (alle
 * Produkte aus hq, die Einrichtung im Klartext), gehören nicht ins Netz.
 */
const einrichten = process.env.DIGITALE_BAECKEREI_EINRICHTEN === '1'

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  // Das Modell liegt in public/model/ und wird per fetch geladen - dafür
  // braucht der Client den Basis-Pfad (src/lib/basePath.ts).
  // Der Fixture-Schalter als Konstante zur Bauzeit: Nur dann nimmt die App die
  // synthetischen Räume der Tests auf (src/lib/raeume/verfuegbar.ts).
  env: {
    NEXT_PUBLIC_DIGITALE_BAECKEREI_BASE_PATH: basePath,
    NEXT_PUBLIC_DIGITALE_BAECKEREI_FIXTURE:
      process.env.DIGITALE_BAECKEREI_FIXTURE === '1' ? '1' : '',
    // Als Konstante zur Bauzeit: Nur dann steckt das Werkzeug in der App
    // (src/components/DigitaleBaeckerei.tsx).
    NEXT_PUBLIC_DIGITALE_BAECKEREI_EINRICHTEN: einrichten ? '1' : '',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
}

/** @param {string} phase */
module.exports = (phase) => {
  if (einrichten && phase === PHASE_PRODUCTION_BUILD) {
    throw new Error(
      'DIGITALE_BAECKEREI_EINRICHTEN ist gesetzt: Der Einrichten-Modus läuft nur im lokalen Dev-Server (nx run bakery-digitale-baeckerei:einrichten) und wird nie als Export gebaut.'
    )
  }
  return config
}
