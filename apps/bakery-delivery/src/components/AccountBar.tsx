'use client'

import { useState } from 'react'

import { clearDeviceData } from '../lib/delivery-api'
import { logout, type DeliverySession } from '../lib/session'
import styles from '../app/page.module.css'

const ROLE_LABEL: Record<string, string> = {
  inhaber: 'Inhaber',
  verkauf: 'Verkauf',
  backstube: 'Backstube',
  fahrer: 'Fahrer',
}

/**
 * Wer angemeldet ist, und „Abmelden". Abmelden löscht auch Warteschlange und
 * Offline-Kopien des Geräts - liegt noch ein nicht gesendetes Abhaken in der
 * Schlange, fragt die Leiste vorher nach (in der Seite, kein
 * `window.confirm`: das sieht auf dem Handy aus wie ein Absturz).
 */
export function AccountBar({
  session,
  pendingCount,
}: {
  session: DeliverySession
  pendingCount: number
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    clearDeviceData()
    await logout()
  }

  return (
    <section className={styles.account} aria-label="Anmeldung">
      <p className={styles.accountName}>
        {session.user.displayName}
        <span className={styles.subtitle}>
          {' '}
          · {ROLE_LABEL[session.user.role] ?? session.user.role}
        </span>
      </p>
      {confirming ? (
        <div className={styles.accountConfirm} role="alert">
          <p>
            {pendingCount === 1
              ? '1 Änderung ist noch nicht beim Server angekommen'
              : `${pendingCount} Änderungen sind noch nicht beim Server angekommen`}{' '}
            und gehen beim Abmelden verloren.
          </p>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.buttonWarn}
              onClick={signOut}
              disabled={busy}
            >
              Trotzdem abmelden
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Angemeldet bleiben
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={() => (pendingCount > 0 ? setConfirming(true) : signOut())}
          disabled={busy}
        >
          Abmelden
        </button>
      )}
    </section>
  )
}
