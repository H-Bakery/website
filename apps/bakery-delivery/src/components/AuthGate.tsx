'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import {
  clearDeviceData,
  clearOfflineCopies,
  describeError,
} from '../lib/delivery-api'
import {
  lastUser,
  login,
  rememberLastUser,
  useDeliverySession,
} from '../lib/session'
import { AppFooter } from './AppFooter'
import styles from '../app/page.module.css'

/**
 * Ohne Anmeldung zeigt die App nur das Anmeldeformular (B8): die API lässt
 * ohne Sitzung ohnehin nichts heraus, und so sieht niemand mit der URL die
 * Adressen der Kundschaft. Während der Hydration steht nur „Wird geladen" da
 * - die Sitzung liegt im localStorage, den das Server-Rendern nicht kennt.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useDeliverySession()
  if (session === undefined) {
    return (
      <main className={styles.main}>
        <p className={`${styles.placeholder} ${styles.loading}`} role="status">
          Wird geladen …
        </p>
      </main>
    )
  }
  if (!session) return <LoginForm />
  return <>{children}</>
}

export function LoginForm() {
  // Ohne gültige Sitzung (abgelaufen, widerrufen, Konto deaktiviert) keine
  // Kundendaten mehr auf dem Gerät: die Offline-Kopien gehen, die
  // Warteschlange bleibt für die nächste Anmeldung desselben Benutzers.
  useEffect(() => {
    clearOfflineCopies()
  }, [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password, (session) => {
        // Ein anderer Benutzer erbt weder Warteschlange noch Offline-Kopie.
        if (lastUser() !== String(session.user.id)) clearDeviceData()
        rememberLastUser(session.user.id)
      })
    } catch (err) {
      setError(describeError(err, 'Anmeldung fehlgeschlagen.'))
      setBusy(false)
    }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Bäckerei Heusser – Fahrer-App</p>
        <h1>Liefertour</h1>
      </header>

      <section className={styles.card}>
        <h2>Anmelden</h2>
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.field}>
            <label htmlFor="login-username">Benutzername</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Passwort</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={busy}>
              {busy ? 'Anmelden …' : 'Anmelden'}
            </button>
          </div>
          <p className={styles.subtitle}>
            Das Konto legt das Büro an. Fahrer sehen hier nur ihre eigenen
            Touren.
          </p>
        </form>
      </section>

      <AppFooter />
    </main>
  )
}
