'use client'

import {
  buildNavigationUrl,
  buildPhoneLink,
  formatRouteDistance,
} from '@bakery/delivery/routing'
import type { Stop } from '../lib/delivery-api'
import { formatItems, formatTime, STOP_STATUS_LABEL } from '../lib/format'
import styles from '../app/page.module.css'

interface StopCardProps {
  stop: Stop
  position: number
  isNext: boolean
  /** Luftlinie ab der aktuellen Fahrerposition, `null` wenn unbekannt. */
  distance: number | null
  busy: boolean
  onStatusChange: (stopId: number, status: Stop['status']) => void
  onRemove?: (stopId: number) => void
}

export function StopCard({
  stop,
  position,
  isNext,
  distance,
  busy,
  onStatusChange,
  onRemove,
}: StopCardProps) {
  const phoneLink = buildPhoneLink(stop.phone)
  const navigationUrl =
    stop.lat !== null && stop.lon !== null
      ? buildNavigationUrl({
          latitude: stop.lat,
          longitude: stop.lon,
          address: stop.address,
        })
      : null

  const items = formatItems(stop.items)

  return (
    <li
      className={`${styles.stop} ${styles[`stop_${stop.status}`]} ${
        isNext ? styles.stopNext : ''
      }`}
    >
      <div className={styles.stopHead}>
        <span className={styles.stopNumber} aria-hidden="true">
          {position}
        </span>
        <div className={styles.stopTitle}>
          <h3>{stop.customer}</h3>
          <p className={styles.stopAddress}>{stop.address}</p>
        </div>
        <span className={`${styles.badge} ${styles[`badge_${stop.status}`]}`}>
          {STOP_STATUS_LABEL[stop.status]}
        </span>
      </div>

      <dl className={styles.stopFacts}>
        {stop.timeWindow && (
          <div>
            <dt>Zeitfenster</dt>
            <dd>{stop.timeWindow}</dd>
          </div>
        )}
        {stop.status === 'open' && stop.estimatedArrival && (
          <div>
            <dt>Ankunft ca.</dt>
            <dd>{formatTime(stop.estimatedArrival)}</dd>
          </div>
        )}
        {/* `!= null` statt Truthiness: 0 m ist eine gueltige Entfernung. */}
        {distance != null && (
          <div>
            <dt>Entfernung</dt>
            <dd>{formatRouteDistance(distance)}</dd>
          </div>
        )}
        {stop.status !== 'open' && stop.completedAt && (
          <div>
            <dt>Erledigt</dt>
            <dd>{formatTime(stop.completedAt)}</dd>
          </div>
        )}
      </dl>

      {items && <p className={styles.stopItems}>{items}</p>}
      {stop.notes && <p className={styles.stopNotes}>{stop.notes}</p>}
      {stop.status === 'failed' && stop.failureReason && (
        <p className={styles.stopFailure}>Grund: {stop.failureReason}</p>
      )}
      {stop.lat === null && (
        <p className={styles.stopWarning}>
          Adresse nicht gefunden – dieser Stopp fehlt auf der Karte und in der
          Reihenfolge.
        </p>
      )}

      <div className={styles.stopActions}>
        {navigationUrl && (
          <a
            className={styles.buttonLink}
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Navigation
          </a>
        )}
        {phoneLink && (
          <a className={styles.buttonLinkGhost} href={phoneLink}>
            Anrufen
          </a>
        )}

        {stop.status === 'open' ? (
          <>
            <button
              type="button"
              className={styles.buttonSuccess}
              disabled={busy}
              onClick={() => onStatusChange(stop.id, 'done')}
            >
              Geliefert
            </button>
            <button
              type="button"
              className={styles.buttonWarn}
              disabled={busy}
              onClick={() => onStatusChange(stop.id, 'failed')}
            >
              Nicht angetroffen
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.buttonGhost}
            disabled={busy}
            onClick={() => onStatusChange(stop.id, 'open')}
          >
            Zurücksetzen
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            className={styles.buttonGhost}
            disabled={busy}
            onClick={() => onRemove(stop.id)}
          >
            Entfernen
          </button>
        )}
      </div>
    </li>
  )
}
