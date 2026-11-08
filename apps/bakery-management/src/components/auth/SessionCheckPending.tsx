'use client'
import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOptionalSession } from '../../lib/session'
import { fetchMe } from '../../lib/authApi'
import { currentToken } from '../../lib/authSession'
import { SESSION_CHECK_PATH, writeSessionCookie } from '../../lib/sessionCookie'
import { ErrorState, LoadingState, PageLayout } from '../layout'

/** So lange nach einem Neuladen ohne Seitenwechsel, bis der Fehler erscheint. */
export const SESSION_CHECK_FAILURE_DELAY_MS = 1500

/**
 * Steht da, wenn `src/proxy.ts` eine geschützte Seite serverseitig nicht
 * rendern durfte - meist, weil das Access-Token im Cookie nach einer Stunde
 * abgelaufen ist, während die Sitzung im Browser noch gilt.
 *
 * Mit Sitzung: einmal `GET /api/auth/me` (der `ApiClient` erneuert das Token
 * bei 401, `saveSession` schreibt das Cookie neu), dann die Original-URL neu
 * vom Server holen (`router.refresh()`). Darf der Server die Seite jetzt
 * rendern, ersetzt sie diese Komponente. Steht sie danach immer noch da,
 * kommt ein Hinweis mit „Erneut versuchen“ statt einer Endlosschleife.
 *
 * Ohne Sitzung rendert der RouteGuard diese Seite gar nicht (Weiterleitung
 * zur Anmeldung); bei fehlender Rolle zeigt das Admin-Layout „Kein Zugriff“.
 */
export default function SessionCheckPending() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const status = useOptionalSession()?.status ?? 'loading'
  const [attempt, setAttempt] = React.useState(0)
  const [refreshIssued, setRefreshIssued] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const started = React.useRef(-1)

  React.useEffect(() => {
    // Direkt aufgerufen gibt es nichts neu zu laden.
    if (pathname === SESSION_CHECK_PATH) {
      router.replace('/admin')
      return
    }
    if (status !== 'authenticated' || started.current === attempt) return
    started.current = attempt
    let cancelled = false
    let done = false
    fetchMe()
      .catch(() => undefined)
      .finally(() => {
        done = true
        if (cancelled) return
        const token = currentToken()
        if (token) writeSessionCookie(token)
        setRefreshIssued(true)
        startTransition(() => router.refresh())
      })
    return () => {
      cancelled = true
      // Abgebrochen, bevor die Prüfung fertig war (Strict Mode, neue
      // Abhängigkeiten): beim nächsten Lauf noch einmal starten.
      if (!done) started.current = -1
    }
  }, [attempt, pathname, router, status])

  // Neu geladen, aber immer noch hier: der Server rendert die Seite nicht.
  React.useEffect(() => {
    if (!refreshIssued || isPending) return
    const timer = window.setTimeout(
      () => setFailed(true),
      SESSION_CHECK_FAILURE_DELAY_MS
    )
    return () => window.clearTimeout(timer)
  }, [refreshIssued, isPending])

  // Steht in der App-Hülle (Seitenleiste): kein bildschirmhoher Ladezustand
  // wie beim RouteGuard, sonst rollt die Seite unter der Kopfzeile weiter.
  if (!failed) return <LoadingState label="Seite wird geladen …" />

  return (
    <PageLayout title="Anmeldung prüfen" width="narrow">
      <ErrorState
        message="Die Seite konnte nicht geladen werden - die Anmeldung wurde vom Server nicht bestätigt. Bitte erneut versuchen oder ab- und wieder anmelden."
        onRetry={() => {
          setFailed(false)
          setRefreshIssued(false)
          setAttempt((value) => value + 1)
        }}
      />
    </PageLayout>
  )
}
