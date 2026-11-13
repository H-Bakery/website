// @ts-check

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

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  },
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
}

module.exports = nextConfig
