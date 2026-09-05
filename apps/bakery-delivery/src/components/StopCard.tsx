'use client'

import {
  buildAddressNavigationUrl,
  buildNavigationUrl,
  buildPhoneLink,
  formatRouteDistance,
  hasCoordinates,
} from '@bakery/delivery/routing'
import { useState } from 'react'
import type { PreorderStatus, Stop } from '../lib/delivery-api'
import {
  formatItems,
  formatTime,
  PICKUP_STOP_STATUS_LABEL,
  STOP_STATUS_LABEL,
} from '../lib/format'
import {
  handoverHeadline,
  HandoverList,
  summarizeHandover,
} from './HandoverList'
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
  /** Nur an einer Sammelstelle gebraucht - dort wird je Vorbestellung abgehakt. */
  onPreorderStatusChange?: (preorderId: number, status: PreorderStatus) => void
}

export function StopCard({
  stop,
  position,
  isNext,
  distance,
  busy,
  onStatusChange,
  onRemove,
  onPreorderStatusChange,
}: StopCardProps) {
  // Rueckfrage vor dem Abschliessen einer Sammelstelle mit offenen
  // Vorbestellungen. Bewusst kein `window.confirm`: das blockiert den
  // Browser und sieht auf dem Handy aus wie ein Absturz.
  const [confirmClose, setConfirmClose] = useState(false)
  const phoneLink = buildPhoneLink(stop.phone)
  const located = hasCoordinates(stop)
  // Nur die Strasse gefunden: der Punkt liegt in der Strassenmitte. Dann - wie
  // bei einer gar nicht gefundenen Adresse - bekommt die Navi-App den
  // eingegebenen Text statt der Koordinaten.
  const streetOnly = located && stop.geocodePrecision === 'street'
  const navigationUrl = located
    ? buildNavigationUrl({
        latitude: stop.lat,
        longitude: stop.lon,
        address: stop.address,
        streetOnly,
      })
    : stop.address
    ? buildAddressNavigationUrl(stop.address)
    : null

  const items = formatItems(stop.items)

  // Ein Stopp mit `pickupPointId` ist eine Sammelstelle: statt einer
  // Zustellung stehen dort mehrere Vorbestellungen zur Uebergabe an.
  const isPickupPoint = stop.pickupPointId != null
  const preorders = stop.preorders ?? []
  const handover = summarizeHandover(preorders)
  const closeStop = () => {
    // Erledigt ist der Stopp erst, wenn jede Vorbestellung entschieden ist -
    // sonst verschwaende eine ungeklaerte Tuete lautlos aus der Abrechnung.
    if (handover.open > 0) {
      setConfirmClose(true)
      return
    }
    onStatusChange(stop.id, 'done')
  }

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
          {
            (isPickupPoint ? PICKUP_STOP_STATUS_LABEL : STOP_STATUS_LABEL)[
              stop.status
            ]
          }
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
      {/* Eine Sammelstelle darf ohne Straße stehen (die Adresse des
          Kindergartens ist noch nicht bekannt). „Adresse nicht gefunden" wäre
          dort falsch: es wurde nie eine eingegeben, und die Navigation bekommt
          auch keine. */}
      {!located && isPickupPoint && (
        <p className={styles.stopWarning}>
          Für diese Sammelstelle ist noch keine Adresse hinterlegt – sie fehlt
          auf der Karte und in der Reihenfolge. Die Übergabeliste stimmt
          trotzdem.
        </p>
      )}
      {!located && !isPickupPoint && (
        <p className={styles.stopWarning}>
          Adresse nicht gefunden – dieser Stopp fehlt auf der Karte und in der
          Reihenfolge. Die Navigation bekommt die eingegebene Adresse.
        </p>
      )}
      {streetOnly && (
        <p className={styles.stopWarning}>
          Nur die Straße wurde gefunden, nicht die Hausnummer – die Navigation
          bekommt die eingegebene Adresse.
        </p>
      )}

      {isPickupPoint && onPreorderStatusChange && (
        <>
          <p className={styles.progressLabel}>{handoverHeadline(handover)}</p>
          <HandoverList
            preorders={preorders}
            busy={busy}
            onStatusChange={onPreorderStatusChange}
          />
        </>
      )}

      {confirmClose && (
        <div className={styles.hint} role="alert">
          <p>
            {handover.open === 1
              ? '1 Vorbestellung ist noch offen. Trotzdem abschließen?'
              : `${handover.open} Vorbestellungen sind noch offen. Trotzdem abschließen?`}
          </p>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.buttonWarn}
              disabled={busy}
              onClick={() => {
                setConfirmClose(false)
                onStatusChange(stop.id, 'done')
              }}
            >
              Trotzdem abschließen
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              onClick={() => setConfirmClose(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
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
          // An der Sammelstelle gibt es kein „Nicht angetroffen": nicht
          // erschienen ist dort eine einzelne Vorbestellung, nicht der Stopp.
          isPickupPoint ? (
            <button
              type="button"
              className={styles.buttonSuccess}
              disabled={busy}
              onClick={closeStop}
            >
              Stopp abschließen
            </button>
          ) : (
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
          )
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
