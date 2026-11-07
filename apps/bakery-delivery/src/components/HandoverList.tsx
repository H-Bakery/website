'use client'

import { useState, type ReactNode } from 'react'
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
 * dem Kindergarten, die Familien kommen nacheinander: er sucht den Namen,
 * gibt die Tüte heraus, sagt, ob bezahlt wurde, und hakt ab. Wer nicht
 * erscheint, bekommt „Nicht abgeholt" - lautlos verschwinden darf niemand.
 *
 * Eine Zeile ist bewusst knapp (Name, Betrag, was mit dem Geld zu tun ist,
 * ein Hauptknopf, Anrufen als Symbol): acht Familien passen so auf zwei
 * Handy-Bildschirme statt auf vier.
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
  /**
   * „Ohne Zahlung übergeben": die Ware ist weg, das Geld fehlt noch
   * (unbezahlt voll, sonst der offene Rest) - wie `handedOverUnpaidTotal`
   * der Abholliste. Steht für sich, sonst fiele es aus jeder Summe.
   */
  handedOverUnpaid: number
  handedOverUnpaidTotal: number
  /** Zurückzugeben: billiger gewordene und stornierte, schon bezahlte. */
  refundTotal: number
  refundCount: number
  /**
   * Stornierte - zählen nicht in `total`, stehen aber in der Liste. Die
   * Kopfzeile nennt sie, sonst las sich „0 von 7 übergeben“ unter
   * „Übergabeliste (8)“ wie ein Rechenfehler.
   */
  cancelled: number
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
  const owedAfterHandover = list.filter(
    (preorder) => preorder.status === 'handed_over' && moneyDue(preorder) > 0
  )
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
    handedOverUnpaid: owedAfterHandover.length,
    handedOverUnpaidTotal: roundCents(
      owedAfterHandover.reduce((sum, preorder) => sum + moneyDue(preorder), 0)
    ),
    refundTotal: roundCents(
      refunds.reduce((sum, preorder) => sum - moneyDue(preorder), 0)
    ),
    refundCount: refunds.length,
    cancelled: all.length - list.length,
  }
}

/**
 * Reihenfolge wie die Abholliste der Verwaltung an einer Sammelstelle: nach
 * Name, stornierte zuletzt. Wer zwischen beiden wechselt, findet eine
 * Familie an derselben Stelle.
 */
export function sortForHandover(preorders: Preorder[]): Preorder[] {
  return [...preorders].sort((a, b) => {
    const cancelled =
      Number(a.status === 'cancelled') - Number(b.status === 'cancelled')
    if (cancelled !== 0) return cancelled
    return (
      a.customer.localeCompare(b.customer, 'de', { sensitivity: 'base' }) ||
      a.reference.localeCompare(b.reference)
    )
  })
}

/**
 * Eine Zeile zum Geld. Vorn steht der Zahlungsstand mit denselben Worten wie
 * auf der Abholliste der Verwaltung („Nicht bezahlt“, „Bezahlt“, „Rest X
 * offen“, „Erstattung X offen“) - der Fahrer benutzt beide -, dahinter, was
 * er an dieser Bestellung jetzt tun muss.
 */
export function paymentNote(preorder: Preorder): string {
  const due = moneyDue(preorder)
  const state = !preorder.paid
    ? 'Nicht bezahlt'
    : due > 0
    ? `Rest ${formatCurrency(due)} offen`
    : due < 0
    ? `Erstattung ${formatCurrency(-due)} offen`
    : 'Bezahlt'
  if (preorder.status === 'cancelled') {
    return due < 0 ? state : 'Nichts zu kassieren'
  }
  if (preorder.status === 'handed_over') {
    return !preorder.paid ? `${state} – ${formatCurrency(due)} offen` : state
  }
  const later =
    preorder.status === 'not_collected' ? ', falls doch abgeholt' : ''
  if (!preorder.paid)
    return `${state} – ${formatCurrency(due)} kassieren${later}`
  if (due > 0) return `${state} – kassieren${later}`
  if (due < 0) return `${state} – zurückgeben${later}`
  return state
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
   * `paid: true` = bezahlt bzw. Rest kassiert / Erstattung ausgezahlt,
   * `paid: false` = ohne Zahlung übergeben. Ohne `paid` bleibt ein offener
   * Rest bzw. eine Erstattung offen.
   */
  onStatusChange: (
    preorderId: number,
    status: PreorderStatus,
    paid?: boolean
  ) => void
  /** Nur ansehen (Rolle `verkauf`, B8): keine Statusknöpfe. */
  readOnly?: boolean
  /**
   * Eine übergebene oder nicht abgeholte Bestellung zurück auf „Offen" setzen.
   * Der Fahrer darf beides nicht (403); an einer übergebenen sieht er einen
   * Hinweis, an einer nicht abgeholten nur „Übergeben".
   */
  canUndoHandover?: boolean
}

/** Eine Wahl in der Rückfrage zum Geld. */
interface Choice {
  label: string
  paid?: boolean
  primary?: boolean
}

/**
 * Was beim Übergeben mit dem Geld zu klären ist - `null`, wenn nichts offen
 * ist (vorab bezahlt): dann übergibt ein Tipp direkt.
 */
function handoverQuestion(
  preorder: Preorder
): { text: string; choices: Choice[] } | null {
  const due = moneyDue(preorder)
  if (due === 0) return null
  if (!preorder.paid) {
    return {
      text: `Noch nicht bezahlt: ${formatCurrency(due)} kassieren.`,
      choices: [
        { label: 'Bezahlt und übergeben', paid: true, primary: true },
        { label: 'Ohne Zahlung übergeben', paid: false },
      ],
    }
  }
  if (due > 0) {
    return {
      text: `Rest ${formatCurrency(due)} kassieren.`,
      choices: [
        { label: 'Rest kassiert und übergeben', paid: true, primary: true },
        { label: 'Ohne Rest übergeben' },
      ],
    }
  }
  return {
    text: `${formatCurrency(-due)} an die Kundschaft zurückgeben.`,
    choices: [
      { label: 'Erstattet und übergeben', paid: true, primary: true },
      { label: 'Ohne Erstattung übergeben' },
    ],
  }
}

/** Nach einer Übergabe ohne Zahlung: das Geld kam doch noch. */
function settleQuestion(
  preorder: Preorder
): { text: string; choices: Choice[] } | null {
  const due = moneyDue(preorder)
  if (due === 0) return null
  return due > 0
    ? {
        text: `${formatCurrency(due)} jetzt kassiert?`,
        choices: [{ label: 'Kassiert', paid: true, primary: true }],
      }
    : {
        text: `${formatCurrency(-due)} jetzt zurückgegeben?`,
        choices: [{ label: 'Zurückgegeben', paid: true, primary: true }],
      }
}

export function HandoverList({
  preorders,
  busy,
  busyIds,
  onStatusChange,
  readOnly = false,
  canUndoHandover = true,
}: HandoverListProps) {
  // Höchstens eine offene Rückfrage: die Familie, die gerade vor dem Fahrer
  // steht. Eine zweite schließt die erste.
  const [asking, setAsking] = useState<number | null>(null)

  if (preorders.length === 0) {
    return (
      <p className={styles.placeholder}>
        Für diesen Tag liegen keine Vorbestellungen vor.
      </p>
    )
  }

  return (
    <ul className={styles.handoverRows}>
      {sortForHandover(preorders).map((preorder) => {
        const phoneLink = buildPhoneLink(preorder.phone)
        const items = formatItems(preorder.items)
        const rowBusy = busy || (busyIds?.has(preorder.id) ?? false)
        const due = moneyDue(preorder)
        const canHandOver =
          preorder.status === 'open' || preorder.status === 'not_collected'
        const question = canHandOver
          ? handoverQuestion(preorder)
          : preorder.status === 'handed_over'
          ? settleQuestion(preorder)
          : null
        const isAsking =
          asking === preorder.id && question !== null && !readOnly

        const choose = (paid?: boolean) => {
          setAsking(null)
          onStatusChange(preorder.id, 'handed_over', paid)
        }

        const callLink = phoneLink ? (
          <a
            className={styles.iconLink}
            href={phoneLink}
            aria-label="Anrufen"
            title={`${preorder.customer} anrufen`}
          >
            <PhoneIcon />
          </a>
        ) : null

        let actions: ReactNode = null
        if (readOnly) {
          actions = callLink
        } else if (preorder.status === 'cancelled') {
          actions = (
            <>
              {due < 0 && (
                <p className={styles.placeholder}>
                  Die Erstattung trägt der Verkauf ein. Bar auszahlen nur nach
                  Rücksprache mit dem Laden.
                </p>
              )}
              {callLink}
            </>
          )
        } else if (canHandOver) {
          actions = (
            <>
              <button
                type="button"
                className={styles.buttonSuccess}
                disabled={rowBusy}
                aria-expanded={question ? isAsking : undefined}
                onClick={() =>
                  question
                    ? setAsking(isAsking ? null : preorder.id)
                    : choose(undefined)
                }
              >
                Übergeben
              </button>
              {preorder.status === 'open' ? (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={rowBusy}
                  onClick={() => {
                    setAsking(null)
                    onStatusChange(preorder.id, 'not_collected')
                  }}
                >
                  Nicht abgeholt
                </button>
              ) : canUndoHandover ? (
                // Die Familie kam doch noch: übergeben geht direkt, auch für
                // den Fahrer. Zurück auf „Offen" setzen darf er nicht - die
                // API lässt ihn nur übergeben oder „nicht abgeholt" setzen
                // (403), der Knopf führte also nur zu einer Fehlermeldung.
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={rowBusy}
                  onClick={() => onStatusChange(preorder.id, 'open')}
                >
                  Zurücksetzen
                </button>
              ) : null}
              {callLink}
            </>
          )
        } else {
          // Übergeben: Zurücksetzen (Verkauf, Inhaber) oder der Hinweis,
          // dazu „Nachträglich kassiert", solange Geld offen ist.
          actions = (
            <>
              {question && (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={rowBusy}
                  aria-expanded={isAsking}
                  onClick={() => setAsking(isAsking ? null : preorder.id)}
                >
                  {due > 0 ? 'Nachträglich kassiert' : 'Nachträglich erstattet'}
                </button>
              )}
              {canUndoHandover ? (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  disabled={rowBusy}
                  onClick={() => onStatusChange(preorder.id, 'open')}
                >
                  Zurücksetzen
                </button>
              ) : (
                <p className={styles.placeholder}>
                  Zurücknehmen kann der Verkauf.
                </p>
              )}
              {callLink}
            </>
          )
        }

        return (
          <li
            key={preorder.id}
            className={`${styles.handoverRow} ${ROW_MODIFIER[preorder.status]}`}
          >
            <div className={styles.handoverHead}>
              <div className={styles.stopTitle}>
                <h4>{preorder.customer}</h4>
                <p className={styles.stopAddress}>
                  {preorder.reference}
                  {preorder.status === 'handed_over' &&
                    preorder.handedOverAt &&
                    ` · Übergeben um ${formatTime(preorder.handedOverAt)} Uhr`}
                </p>
              </div>
              <div className={styles.handoverAside}>
                <span
                  className={`${styles.badge} ${
                    BADGE_MODIFIER[preorder.status]
                  }`}
                >
                  {PREORDER_STATUS_LABEL[preorder.status]}
                </span>
                <span className={styles.handoverAmount}>
                  {formatCurrency(preorder.total)}
                </span>
              </div>
            </div>

            <p
              className={`${styles.handoverPayment} ${
                due > 0
                  ? styles.paymentDue
                  : due < 0
                  ? styles.paymentRefund
                  : ''
              }`}
              data-testid={`payment-${preorder.id}`}
            >
              {paymentNote(preorder)}
            </p>

            {items && <p className={styles.handoverItems}>{items}</p>}
            {preorder.note && (
              <p className={styles.stopNotes}>{preorder.note}</p>
            )}
            {/* Nur solange die Tüte noch herausgegeben wird - an einer
                übergebenen oder stornierten hilft der Hinweis nicht mehr. */}
            {preorder.afterDeadline && canHandOver && (
              <p className={styles.inlineWarning}>
                Nach Bestellschluss aufgenommen – bitte prüfen, ob die Ware
                dabei ist.
              </p>
            )}

            {isAsking && question ? (
              <div
                className={`${styles.panel} ${styles.panelWarning} ${styles.handoverChoice}`}
                role="group"
                aria-label={`Übergabe an ${preorder.customer}`}
              >
                <p>{question.text}</p>
                <div className={styles.handoverChoiceButtons}>
                  {question.choices.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      className={
                        choice.primary
                          ? styles.buttonSuccess
                          : styles.buttonGhost
                      }
                      disabled={rowBusy}
                      onClick={() => choose(choice.paid)}
                    >
                      {choice.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.buttonGhost}
                    onClick={() => setAsking(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              actions && <div className={styles.handoverActions}>{actions}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function PhoneIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.6a1 1 0 0 1-.25 1z"
      />
    </svg>
  )
}

/**
 * „4 von 12 übergeben · Bar zu kassieren: 96,40 € · Ohne Zahlung übergeben:
 * 41,40 € · Zurückzugeben: 9,60 €" - Beträge von 0,00 € fallen weg.
 */
export function handoverHeadline(summary: HandoverSummary): string {
  const parts = [`${summary.handedOver} von ${summary.total} übergeben`]
  if (summary.notCollected > 0) {
    parts.push(`${summary.notCollected} nicht abgeholt`)
  }
  if (summary.cancelled > 0) {
    parts.push(`${summary.cancelled} storniert`)
  }
  if (summary.openTotal > 0) {
    parts.push(`Bar zu kassieren: ${formatCurrency(summary.openTotal)}`)
  }
  if (summary.handedOverUnpaidTotal > 0) {
    parts.push(
      `Ohne Zahlung übergeben: ${formatCurrency(summary.handedOverUnpaidTotal)}`
    )
  }
  if (summary.refundTotal > 0) {
    parts.push(`Zurückzugeben: ${formatCurrency(summary.refundTotal)}`)
  }
  return parts.join(' · ')
}
