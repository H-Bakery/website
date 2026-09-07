'use client'

import { useId, useState } from 'react'
import type { FailureDetails, GoodsDisposition } from '../lib/delivery-api'
import { FAILURE_REASONS, GOODS_DISPOSITION_LABEL } from '../lib/format'
import styles from '../app/page.module.css'

/**
 * Was passiert, wenn der Fahrer "Nicht angetroffen" antippt: ein kurzer Grund
 * und - wichtiger - wo die Ware geblieben ist. Ohne das weiss die Backstube am
 * Montag nicht, ob die Tuete zurueckkam oder vor der Haustuer stand. Beides
 * geht ueber den bestehenden Status-PATCH mit, auch aus der Warteschlange.
 *
 * Bewusst ein Block in der Karte statt eines Dialogs: kein `window.confirm`,
 * kein Overlay, das auf dem Handy wie ein Absturz aussieht.
 */

const OTHER = 'Sonstiges'
type ReasonChoice = (typeof FAILURE_REASONS)[number] | typeof OTHER

/** Laenger nimmt der Server nicht an (`FAILURE_REASON_MAX_LENGTH`). */
const REASON_MAX_LENGTH = 200

interface FailureFormProps {
  busy: boolean
  onSubmit: (details: FailureDetails) => void
  onCancel: () => void
}

export function FailureForm({ busy, onSubmit, onCancel }: FailureFormProps) {
  const id = useId()
  const [reason, setReason] = useState<ReasonChoice>(FAILURE_REASONS[0])
  const [otherText, setOtherText] = useState('')
  const [goods, setGoods] = useState<GoodsDisposition>('taken_back')

  const submit = () => {
    const text = otherText.trim().slice(0, REASON_MAX_LENGTH)
    onSubmit({
      // Ein leerer Freitext heisst schlicht "Sonstiges" - besser als gar kein Grund.
      failureReason: reason === OTHER ? text || OTHER : reason,
      goodsDisposition: goods,
    })
  }

  return (
    <div className={styles.hint} role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className={styles.choiceTitle}>
        Nicht angetroffen – was ist passiert?
      </p>

      <fieldset className={styles.choiceGroup}>
        <legend className={styles.choiceLegend}>Grund</legend>
        {[...FAILURE_REASONS, OTHER].map((choice) => (
          <label key={choice} className={styles.choice}>
            <input
              type="radio"
              name={`${id}-reason`}
              value={choice}
              checked={reason === choice}
              onChange={() => setReason(choice as ReasonChoice)}
            />
            <span>{choice}</span>
          </label>
        ))}
        {reason === OTHER && (
          <div className={styles.field}>
            <label htmlFor={`${id}-other`}>Was genau?</label>
            <input
              id={`${id}-other`}
              type="text"
              value={otherText}
              maxLength={REASON_MAX_LENGTH}
              placeholder="z. B. Tor verschlossen"
              autoFocus
              onChange={(event) => setOtherText(event.target.value)}
            />
          </div>
        )}
      </fieldset>

      <fieldset className={styles.choiceGroup}>
        <legend className={styles.choiceLegend}>Verbleib der Ware</legend>
        {(Object.keys(GOODS_DISPOSITION_LABEL) as GoodsDisposition[]).map(
          (choice) => (
            <label key={choice} className={styles.choice}>
              <input
                type="radio"
                name={`${id}-goods`}
                value={choice}
                checked={goods === choice}
                onChange={() => setGoods(choice)}
              />
              <span>{GOODS_DISPOSITION_LABEL[choice]}</span>
            </label>
          )
        )}
      </fieldset>

      <div className={styles.buttonGroup}>
        <button
          type="button"
          className={styles.buttonWarn}
          disabled={busy}
          onClick={submit}
        >
          Als nicht angetroffen speichern
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          disabled={busy}
          onClick={onCancel}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
