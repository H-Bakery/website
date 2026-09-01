'use client'

import { useState } from 'react'
import type { StopInput } from '../lib/delivery-api'
import styles from '../app/page.module.css'

export type NewStopInput = StopInput

interface AddStopFormProps {
  busy: boolean
  onSubmit: (stop: NewStopInput) => Promise<void>
}

const EMPTY = {
  customer: '',
  street: '',
  zip: '66424',
  city: 'Homburg',
  phone: '',
  timeWindow: '',
  notes: '',
  items: '',
}

export function AddStopForm({ busy, onSubmit }: AddStopFormProps) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)

  const set =
    (key: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.customer.trim() || !form.street.trim()) {
      setError('Kunde sowie Straße und Hausnummer sind Pflicht.')
      return
    }

    try {
      await onSubmit({
        customer: form.customer.trim(),
        street: form.street.trim(),
        zip: form.zip.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        timeWindow: form.timeWindow.trim(),
        notes: form.notes.trim(),
        items: parseItems(form.items),
      })
      setForm(EMPTY)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Stopp konnte nicht angelegt werden.'
      )
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="stop-customer">Kunde *</label>
          <input
            id="stop-customer"
            value={form.customer}
            onChange={set('customer')}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="stop-phone">Telefon</label>
          <input
            id="stop-phone"
            value={form.phone}
            onChange={set('phone')}
            inputMode="tel"
            placeholder="06841 2229"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="stop-street">Straße und Hausnummer *</label>
          <input
            id="stop-street"
            value={form.street}
            onChange={set('street')}
            required
            placeholder="Talstraße 5"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.fieldNarrow}>
          <label htmlFor="stop-zip">PLZ</label>
          <input
            id="stop-zip"
            value={form.zip}
            onChange={set('zip')}
            inputMode="numeric"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="stop-city">Ort</label>
          <input id="stop-city" value={form.city} onChange={set('city')} />
        </div>
        <div className={styles.fieldNarrow}>
          <label htmlFor="stop-window">Zeitfenster</label>
          <input
            id="stop-window"
            value={form.timeWindow}
            onChange={set('timeWindow')}
            placeholder="08:00-09:00"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="stop-items">Ware</label>
          <input
            id="stop-items"
            value={form.items}
            onChange={set('items')}
            placeholder="2x Bauernbrot, 10x Brötchen"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor="stop-notes">Hinweis</label>
          <input
            id="stop-notes"
            value={form.notes}
            onChange={set('notes')}
            placeholder="Hintereingang, bei Nachbarn abgeben …"
          />
        </div>
      </div>

      {error && <p className={styles.formError}>{error}</p>}

      <button type="submit" className={styles.button} disabled={busy}>
        {busy ? 'Wird gespeichert …' : 'Stopp hinzufügen'}
      </button>
    </form>
  )
}

/**
 * "2x Bauernbrot, 10 Brötchen" -> Positionen.
 *
 * Bewusst nachsichtig: die Backstube tippt das samstags frueh in Eile ein.
 * Ohne erkennbare Menge gilt 1.
 */
export function parseItems(
  value: string
): Array<{ name: string; qty: number }> {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)\s*(?:x|×|\*)?\s*(.+)$/i)
      if (match) {
        return { name: match[2].trim(), qty: Number(match[1]) }
      }
      return { name: part, qty: 1 }
    })
    .filter((item) => item.name.length > 0)
}
