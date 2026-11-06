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
  /** Vorbestellungen insgesamt, ohne stornierte. */
  total: number
  handedOver: number
  notCollected: number
  open: number
  /**
   * Was bei den offenen Bestellungen noch bar zu kassieren ist: unbezahlte
   * voll, vorab bezahlte nur ein offener Rest - nie ein zweites Mal.
   */
  openTotal: number
  /** Zurückzugeben: billiger gewordene und stornierte, schon bezahlte. */
  refundTotal: number
  refundCount: number
}

/**
 * Was an einer Vorbestellung noch zu kassieren (`> 0`) oder zurückzugeben
 * (`< 0`) ist - wie `paymentState()` der Abholliste. Ohne `paid` im Payload
 * (alte Offline-Kopie) gilt sie als unbezahlt: der ganze Betrag.
 */
export function moneyDue(preorder: Preorder): number {
  if (!preorder.paid) {
    return preorder.status === 'cancelled' ? 0 : roundCents(preorder.total)
  }
  return roundCents(Number(preorder.paymentBalance) || 0)
}

export function summarizeHandover(preorders: Preorder[]): HandoverSummary {
  const all = preorders ?? []
  const list = all.filter((preorder) => preorder.status !== 'cancelled')
  const open = list.filter((preorder) => preorder.status === 'open')
  const refunds = all.filter((preorder) => moneyDue(preorder) < 0)
  return {
    total: list.length,
    handedOver: list.filter((p) => p.status === 'handed_over').length,
    notCollected: list.filter((p) => p.status === 'not_collected').length,
    open: open.length,
    // Geld nie ungerundet summieren: 6,10 + 6,20 ergibt sonst
    // 12,299999999999999 und darunter steht ein Betrag, den niemand kassiert.
    openTotal: roundCents(
      open.reduce((sum, preorder) => sum + Math.max(0, moneyDue(preorder)), 0)
    ),
    refundTotal: roundCents(
      refunds.reduce((sum, preorder) => sum - moneyDue(preorder), 0)
    ),
    refundCount: refunds.length,
  }
}

/** Eine Zeile zum Geld: was der Fahrer an dieser Bestellung tun muss. */
function paymentNote(preorder: Preorder): string {
  const due = moneyDue(preorder)
  if (preorder.status === 'cancelled') {
    return `Storniert – ${formatCurrency(-due)} zurückgeben`
  }
  if (due < 0) return `${formatCurrency(-due)} zurückgeben`
  if (!preorder.paid) return `${formatCurrency(due)} kassieren`
  if (due > 0) return `Bezahlt – Rest ${formatCurrency(due)} kassieren`
  return 'Bezahlt – nichts zu kassieren'
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
  /** Sperrt alle Zeilen - etwa waehrend der Stopp selbst abgeschlossen wird. */
  busy: boolean
  /**
   * Sperrt nur die Zeilen, deren eigener Statuswechsel gerade unterwegs ist.
   * Die naechste Familie steht schon vor dem Fahrer; ein haengender Request
   * der vorigen darf sie nicht warten lassen.
   */
  busyIds?: ReadonlySet<number>
  /**
   * `paid: true` = Rest kassiert bzw. Erstattung ausgezahlt (nur mit
   * „Übergeben“). Ohne bleibt ein offener Rest/Erstattung offen.
   */
  onStatusChange: (
    preorderId: number,
    status: PreorderStatus,
    paid?: true
  ) => void
  /** Nur ansehen (Rolle `verkauf`, B8): keine Statusknöpfe. */
  readOnly?: boolean
  /**
   * Eine übergebene Bestellung zurück auf „Offen" setzen. Der Fahrer darf das
   * nicht (403 `handover_undo_forbidden`); er sieht stattdessen einen Hinweis.
   */
  canUndoHandover?: boolean
}

export function HandoverList({
  preorders,
  busy,
  busyIds,
  onStatusChange,
  readOnly = false,
  canUndoHandover = true,
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
        const rowBusy = busy || (busyIds?.has(preorder.id) ?? false)

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
              <div>
                <dt>Geld</dt>
                <dd data-testid={`payment-${preorder.id}`}>
                  {paymentNote(preorder)}
                </dd>
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
              {readOnly ? null : preorder.status === 'cancelled' ? (
                <p className={styles.placeholder}>
                  Erfassen kann das der Verkauf.
                </p>
              ) : preorder.status === 'open' ? (
                <>
                  {preorder.paid && moneyDue(preorder) !== 0 ? (
                    <>
                      <button
                        type="button"
                        className={styles.buttonSuccess}
                        disabled={rowBusy}
                        onClick={() =>
                          onStatusChange(preorder.id, 'handed_over', true)
                        }
                      >
                        {moneyDue(preorder) > 0
                          ? 'Rest kassiert und übergeben'
                          : 'Erstattet und übergeben'}
                      </button>
                      <button
                        type="button"
                        className={styles.buttonGhost}
                        disabled={rowBusy}
                        onClick={() =>
                          onStatusChange(preorder.id, 'handed_over')
                        }
                      >
                        {moneyDue(preorder) > 0
                          ? 'Ohne Rest übergeben'
                          : 'Ohne Erstattung übergeben'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.buttonSuccess}
                      disabled={rowBusy}
                      onClick={() => onStatusChange(preorder.id, 'handed_over')}
                    >
                      Übergeben
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.buttonWarn}
                    disabled={rowBusy}
                    onClick={() => onStatusChange(preorder.id, 'not_collected')}
                  >
                    Nicht abgeholt
                  </button>
                </>
              ) : preorder.status === 'handed_over' && !canUndoHandover ? (
                <p className={styles.placeholder}>
                  Zurücknehmen kann der Verkauf.
                </p>
              ) : (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={rowBusy}
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

/** „4 von 12 übergeben · Bar zu kassieren: 96,40 € · Zurückzugeben: 9,60 €" */
export function handoverHeadline(summary: HandoverSummary): string {
  const parts = [`${summary.handedOver} von ${summary.total} übergeben`]
  if (summary.notCollected > 0) {
    parts.push(`${summary.notCollected} nicht abgeholt`)
  }
  parts.push(`Bar zu kassieren: ${formatCurrency(summary.openTotal)}`)
  if (summary.refundTotal > 0) {
    parts.push(`Zurückzugeben: ${formatCurrency(summary.refundTotal)}`)
  }
  return parts.join(' · ')
}
