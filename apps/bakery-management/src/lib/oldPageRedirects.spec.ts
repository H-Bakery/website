/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { isPilotPathAllowed } from './pilotMode'

// next.config.js ohne Nx laden: composePlugins/withNx gäben sonst eine
// Phasen-Funktion zurück und bauten einen Projektgraphen.
jest.mock('@nx/next', () => ({
  composePlugins:
    () =>
    <T>(config: T) =>
      config,
  withNx: <T>(config: T) => config,
}))

interface Redirect {
  source: string
  destination: string
  permanent: boolean
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../../next.config.js') as {
  redirects: () => Promise<Redirect[]>
}

const appDir = path.resolve(__dirname, '../app')

/** `/admin/...` jeder `page.tsx`, dynamische Segmente als `1`. */
function pages(dir = path.join(appDir, 'admin'), prefix = '/admin'): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile() && entry.name === 'page.tsx') return [prefix]
    if (!entry.isDirectory()) return []
    const segment = entry.name.startsWith('[') ? '1' : entry.name
    return pages(path.join(dir, entry.name), `${prefix}/${segment}`)
  })
}

/** Wohin Next.js `pathname` weiterleitet (erste passende Regel), sonst null. */
function target(redirects: Redirect[], pathname: string): string | null {
  const hit = redirects.find((r) => getPathMatch(r.source)(pathname) !== false)
  return hit ? hit.destination : null
}

describe('Weiterleitungen alter Seiten (B12, next.config.js)', () => {
  let redirects: Redirect[]
  beforeAll(async () => {
    redirects = await nextConfig.redirects()
  })

  it.each([
    ['/admin/orders', '/admin/preorders'],
    ['/admin/orders/5', '/admin/preorders'],
    ['/admin/production', '/admin/backzettel'],
    ['/admin/production/plan/2026-12-05', '/admin/backzettel'],
    ['/admin/baking-list', '/admin/backzettel'],
    ['/admin/bakery/daily-prep', '/admin/backzettel'],
    ['/admin/bakery/saturday-production', '/admin/backzettel'],
    ['/admin/delivery', '/admin/delivery/preorders'],
  ])('%s → %s', (from, to) => {
    expect(target(redirects, from)).toBe(to)
  })

  it('sind vorübergehend (307), nicht dauerhaft im Browser-Cache', () => {
    redirects.forEach((r) => expect(r.permanent).toBe(false))
  })

  it('führen alle auf eine Seite, die es gibt und die der Pilot zeigt', () => {
    redirects.forEach(({ destination }) => {
      expect(fs.existsSync(path.join(appDir, destination, 'page.tsx'))).toBe(
        true
      )
      expect(isPilotPathAllowed(destination, true)).toBe(true)
    })
  })

  it('verdecken keine vorhandene Seite', () => {
    // Vor allem nicht die Sammelstelle unter /admin/delivery/preorders.
    pages().forEach((page) => {
      expect([page, target(redirects, page)]).toEqual([page, null])
    })
    expect(target(redirects, '/admin/ordersarchiv')).toBeNull()
  })
})
