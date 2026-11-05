import { NextResponse, type NextRequest } from 'next/server'
import { pilotRewriteTarget } from './lib/pilotRewrite'

/**
 * Next.js 16 Proxy (früher `middleware.ts`), nur für den Pilotbetrieb:
 * gesperrte `/admin`-Routen werden auf die leere Ersatzseite umgeschrieben
 * (siehe src/lib/pilotRewrite.ts). Ohne `NEXT_PUBLIC_PILOT_MODE` tut er
 * nichts. Anmeldung und Rollen prüft der Browser (RouteGuard) und die API.
 */
export function proxy(request: NextRequest) {
  const target = pilotRewriteTarget(request.nextUrl.pathname)
  if (!target) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
