'use client'
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '../../lib/session'
import { loadStation } from '../../lib/authSession'
import { isBackstubePath } from '../../lib/sessionPolicy'
import {
  ROLE_LABELS,
  isPathAllowedForRole,
  isProtectedPath,
  startPathForRole,
} from '../../lib/roles'
import SessionLoading from './SessionLoading'
import NoAccess from './NoAccess'

/**
 * Wohin ohne Sitzung: ein als Station eingerichtetes Gerät zu den
 * Namenskacheln, jedes andere zur Anmeldung (mit `?next=` zurück).
 */
export function anonymousRedirect(
  pathname: string,
  isStation: boolean,
  loggedOut = false
) {
  if (isStation) return '/station'
  // Nach „Abmelden" kein `?next=`: sonst landet die nächste Person auf der
  // letzten Seite der vorigen (LogoutButton und Wache führen so zum selben Ziel).
  if (loggedOut) return '/admin/login'
  return `/admin/login?next=${encodeURIComponent(pathname)}`
}

/**
 * Client-seitige Wache für `/admin/**` und `/backstube/**` (F1).
 *
 * Die Sitzung liegt in `localStorage`: solange sie geprüft wird oder eine
 * Weiterleitung läuft, steht nur ein Ladezustand da, nie die geschützte
 * Seite. Ohne Sitzung geht es zur Anmeldung bzw. zur Station. Serverseitig
 * rendert `src/proxy.ts` geschützte Seiten nur mit gültigem Sitzungs-Cookie
 * (sonst die leere Prüfseite) - so stehen auch im RSC-Payload keine Daten.
 *
 * Rollen: unter `/admin` prüft das Admin-Layout (mit Seitenleiste); außerhalb
 * (`/backstube`) prüft diese Wache selbst.
 */
export default function RouteGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const {
    status,
    user,
    sessionKind,
    loggedOut,
    unattendedAtBackstube,
    endUnattended,
  } = useSession()
  const isProtected = isProtectedPath(pathname)
  // W4-Fixup: vom unbeaufsichtigten Backstube-Tablet weg (siehe
  // `unattendedAtBackstube`) - abmelden statt die nächste Seite zu zeigen.
  const leavingUnattended =
    isProtected &&
    status === 'authenticated' &&
    unattendedAtBackstube === true &&
    !isBackstubePath(pathname)

  React.useEffect(() => {
    if (leavingUnattended) endUnattended?.()
  }, [leavingUnattended, endUnattended])

  React.useEffect(() => {
    if (isProtected && status === 'anonymous') {
      router.replace(
        anonymousRedirect(pathname, loadStation() !== null, loggedOut)
      )
    }
  }, [isProtected, status, pathname, router, loggedOut])

  if (!isProtected) return <>{children}</>
  if (leavingUnattended) {
    return <SessionLoading label="Wegen Inaktivität abgemeldet …" />
  }
  if (status !== 'authenticated' || !user) {
    return (
      <SessionLoading
        label={
          status === 'anonymous'
            ? 'Weiter zur Anmeldung …'
            : 'Anmeldung wird geprüft …'
        }
      />
    )
  }
  const insideAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  if (!insideAdmin && !isPathAllowedForRole(pathname, user.role, sessionKind)) {
    return (
      <NoAccess
        roleLabel={ROLE_LABELS[user.role]}
        startPath={startPathForRole(user.role)}
      />
    )
  }
  return <>{children}</>
}
