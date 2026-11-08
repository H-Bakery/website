// @ts-check

/**
 * Partybrezel-Prototyp: rein statischer Export, keine Workspace-Libs, also
 * kein withNx(). Der Basis-Pfad kommt aus PARTYBREZEL_BASE_PATH, damit der
 * Export auch unter einem Unterpfad laufen kann (z. B. /partybrezel auf der
 * Pages-Seite der Landing Page) - siehe docs/partybrezel-prototyp.md.
 */

/** @param {string | undefined} raw */
function normalizeBasePath(raw) {
  const value = (raw || '').trim().replace(/\/+$/, '')
  if (value === '') return ''
  if (!/^(\/[A-Za-z0-9._-]+)+$/.test(value)) {
    throw new Error(
      `PARTYBREZEL_BASE_PATH muss mit "/" beginnen und darf nur Buchstaben, Ziffern, ".", "_" und "-" enthalten (bekommen: "${raw}")`
    )
  }
  return value
}

const basePath = normalizeBasePath(process.env.PARTYBREZEL_BASE_PATH)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // Das Next-Symbol unten links verdeckt in `next dev` auf dem Handy den
  // Weiter-Knopf der festen Leiste - bei Vorführungen stört es nur.
  devIndicators: false,
}

module.exports = nextConfig
