'use client'
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '../../lib/session'
import { loadStation } from '../../lib/authSession'
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
export function anonymousRedirect(pathname: string, isStation: boolean) {
  if (isStation) return '/station'
  return `/admin/login?next=${encodeURIComponent(pathname)}`
}

/**
 * Client-seitige Wache für `/admin/**` und `/backstube/**` (F1).
 *
 * Die Tokens liegen in `localStorage`, der Server sieht sie nicht - deshalb
 * entscheidet der Browser: solange die Sitzung geprüft wird oder eine
 * Weiterleitung läuft, steht nur ein Ladezustand da, nie die geschützte
 * Seite. Ohne Sitzung geht es zur Anmeldung bzw. zur Station.
 *
 * Rollen: unter `/admin` prüft das Admin-Layout (mit Seitenleiste); außerhalb
 * (`/backstube`) prüft diese Wache selbst. Daten schützt die API.
 */
export default function RouteGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { status, user } = useSession()
  const isProtected = isProtectedPath(pathname)

  React.useEffect(() => {
    if (isProtected && status === 'anonymous') {
      router.replace(anonymousRedirect(pathname, loadStation() !== null))
    }
  }, [isProtected, status, pathname, router])

  if (!isProtected) return <>{children}</>
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
  if (!insideAdmin && !isPathAllowedForRole(pathname, user.role)) {
    return (
      <NoAccess
        roleLabel={ROLE_LABELS[user.role]}
        startPath={startPathForRole(user.role)}
      />
    )
  }
  return <>{children}</>
}
