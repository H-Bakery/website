import { NextResponse, type NextRequest } from 'next/server'
import { pilotRewriteTarget } from './lib/pilotRewrite'
import {
  ROLE_HEADER,
  SESSION_CHECK_PATH,
  SESSION_COOKIE_NAME,
  SESSION_KIND_HEADER,
} from './lib/sessionCookie'
import { createSessionVerifier, decideAccess } from './lib/serverSession'

/**
 * Next.js 16 Proxy (früher `middleware.ts`) - die serverseitige Wache (F1):
 *
 * 1. Pilotbetrieb: gesperrte `/admin`-Routen werden auf die leere Ersatzseite
 *    umgeschrieben (src/lib/pilotRewrite.ts).
 * 2. Anmeldung + Rolle: `/admin/**` und `/backstube/**` (außer
 *    `/admin/login`) rendern nur, wenn das Sitzungs-Cookie
 *    (src/lib/sessionCookie.ts) an der API gilt und `ROLE_ACCESS` der Rolle
 *    die Seite erlaubt. Sonst wird auf `SESSION_CHECK_PATH` umgeschrieben -
 *    die URL bleibt, Server-Komponente und RSC-Payload der eigentlichen Seite
 *    (Kassenberichte, Kassen-Kachel …) entstehen gar nicht erst.
 *
 * Geprüfte Rolle und Sitzungsart gehen als `x-bakery-role` /
 * `x-bakery-session-kind` an die Seite; eingehende Header dieser Namen werden
 * immer entfernt. Der Proxy läuft in Next 16 immer in Node.js; `API_URL`
 * wird zur Laufzeit gelesen.
 */

const verify = createSessionVerifier({
  apiUrl: process.env.API_URL || 'http://localhost:5000',
})

function rewriteTo(request: NextRequest, pathname: string, headers: Headers) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const response = NextResponse.rewrite(url, { request: { headers } })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const headers = new Headers(request.headers)
  headers.delete(ROLE_HEADER)
  headers.delete(SESSION_KIND_HEADER)

  const pilotTarget = pilotRewriteTarget(pathname)
  if (pilotTarget) return rewriteTo(request, pilotTarget, headers)

  const decision = await decideAccess(
    pathname,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    verify
  )
  if (decision.kind === 'public') {
    return NextResponse.next({ request: { headers } })
  }
  if (decision.kind === 'deny') {
    return rewriteTo(request, SESSION_CHECK_PATH, headers)
  }
  headers.set(ROLE_HEADER, decision.principal.role)
  headers.set(SESSION_KIND_HEADER, decision.principal.sessionKind)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/backstube', '/backstube/:path*'],
}
