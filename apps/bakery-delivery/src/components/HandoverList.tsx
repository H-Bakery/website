'use client'

import { buildPhoneLink } from '@bakery/delivery/routing'
import type { Preorder, PreorderStatus } from '../lib/delivery-api'
import {
  formatCurrency,
  formatItems,
  formatTime,
  PREORDER_STATUS_LABEL,
} from '../lib/format'
import styles from '../app/page.module.css'

/**
 * Die Übergabeliste einer Sammelstelle. Der Fahrer steht im Zeitfenster vor
 * dem Kindergarten, die Familien kommen nacheinander: er ruft die Referenz
 * auf, gibt die Tüte heraus, kassiert bar und hakt ab. Wer nicht erscheint,
 * bekommt „Nicht abgeholt" - lautlos verschwinden darf niemand.
 */

/** Die Kennzahlen der Kopfzeile. Nur aus `preorders`, nie aus dem Server-Summary:
 * ein eben abgehaktes Kundenpaar soll die Zeile sofort bewegen. */
export interface HandoverSummary {
  /** Vorbestellungen insgesamt (stornierte liefert der Server nicht mit). */
  total: number
  handedOver: number
  notCollected: number
  open: number
  /** Summe der noch offenen Beträge - das, was noch zu kassieren ist. */
  openTotal: number
}

export function summarizeHandover(preorders: Preorder[]): HandoverSummary {
  const list = preorders ?? []
  const open = list.filter((preorder) => preorder.status === 'open')
  return {
    total: list.length,
    handedOver: list.filter((p) => p.status === 'handed_over').length,
    notCollected: list.filter((p) => p.status === 'not_collected').length,
    open: open.length,
    // Geld nie ungerundet summieren: 6,10 + 6,20 ergibt sonst
    // 12,299999999999999 und darunter steht ein Betrag, den niemand kassiert.
    openTotal: roundCents(
      open.reduce((sum, preorder) => sum + roundCents(preorder.total), 0)
    ),
  }
}

function roundCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

/** CSS-Klasse der Zeile - die Farben kommen aus den Status-Variablen. */
const ROW_MODIFIER: Record<PreorderStatus, string> = {
  open: '',
  handed_over: styles.stop_done,
  not_collected: styles.stop_failed,
  cancelled: styles.stop_failed,
}

const BADGE_MODIFIER: Record<PreorderStatus, string> = {
  open: '',
  handed_over: styles.badge_done,
  not_collected: styles.badge_failed,
  cancelled: styles.badge_failed,
}

interface HandoverListProps {
  preorders: Preorder[]
  busy: boolean
  onStatusChange: (preorderId: number, status: PreorderStatus) => void
}

export function HandoverList({
  preorders,
  busy,
  onStatusChange,
}: HandoverListProps) {
  if (preorders.length === 0) {
    return (
      <p className={styles.placeholder}>
        Für diesen Tag liegen keine Vorbestellungen vor.
      </p>
    )
  }

  return (
    <ul className={styles.stopList}>
      {preorders.map((preorder, index) => {
        const phoneLink = buildPhoneLink(preorder.phone)
        const items = formatItems(preorder.items)

        return (
          <li
            key={preorder.id}
            className={`${styles.stop} ${ROW_MODIFIER[preorder.status]}`}
          >
            <div className={styles.stopHead}>
              <span className={styles.stopNumber} aria-hidden="true">
                {index + 1}
              </span>
              <div className={styles.stopTitle}>
                <h4>{preorder.customer}</h4>
                <p className={styles.stopAddress}>{preorder.reference}</p>
              </div>
              <span
                className={`${styles.badge} ${BADGE_MODIFIER[preorder.status]}`}
              >
                {PREORDER_STATUS_LABEL[preorder.status]}
              </span>
            </div>

            <dl className={styles.stopFacts}>
              <div>
                <dt>Betrag</dt>
                <dd>{formatCurrency(preorder.total)}</dd>
              </div>
              {preorder.status === 'handed_over' && preorder.handedOverAt && (
                <div>
                  <dt>Übergeben</dt>
                  <dd>{formatTime(preorder.handedOverAt)}</dd>
                </div>
              )}
            </dl>

            {items && <p className={styles.stopItems}>{items}</p>}
            {preorder.note && (
              <p className={styles.stopNotes}>{preorder.note}</p>
            )}
            {preorder.afterDeadline && (
              <p className={styles.stopWarning}>
                Nach Bestellschluss aufgenommen – bitte prüfen, ob die Ware
                dabei ist.
              </p>
            )}

            <div className={styles.stopActions}>
              {phoneLink && (
                <a className={styles.buttonLinkGhost} href={phoneLink}>
                  Anrufen
                </a>
              )}
              {preorder.status === 'open' ? (
                <>
                  <button
                    type="button"
                    className={styles.buttonSuccess}
                    disabled={busy}
                    onClick={() => onStatusChange(preorder.id, 'handed_over')}
                  >
                    Übergeben
                  </button>
                  <button
                    type="button"
                    className={styles.buttonWarn}
                    disabled={busy}
                    onClick={() => onStatusChange(preorder.id, 'not_collected')}
                  >
                    Nicht abgeholt
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={busy}
                  onClick={() => onStatusChange(preorder.id, 'open')}
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** „4 von 12 übergeben · Bar zu kassieren: 96,40 €" */
export function handoverHeadline(summary: HandoverSummary): string {
  const parts = [`${summary.handedOver} von ${summary.total} übergeben`]
  if (summary.notCollected > 0) {
    parts.push(`${summary.notCollected} nicht abgeholt`)
  }
  parts.push(`Bar zu kassieren: ${formatCurrency(summary.openTotal)}`)
  return parts.join(' · ')
}
