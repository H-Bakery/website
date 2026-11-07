'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface LatestRequestState<T> {
  data: T | null
  /** Eine Anfrage läuft (auch beim Nachladen mit schon sichtbaren Daten). */
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Lädt `load()` bei jeder Änderung von `deps` und übernimmt nur die Antwort
 * der **jüngsten** Anfrage. Vorher setzten die Analyse-Seiten jede Antwort,
 * die zurückkam: wer schnell von „30 Tage“ auf „7 Tage“ wechselte, sah die
 * Zahlen der langsameren, älteren Anfrage unter der neuen Auswahl.
 * Bis die neue Antwort da ist, bleiben die alten Daten stehen.
 */
export function useLatestRequest<T>(
  load: () => Promise<T>,
  deps: ReadonlyArray<unknown>
): LatestRequestState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const seq = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const run = useCallback(() => {
    const id = ++seq.current
    setLoading(true)
    setError(null)
    loadRef.current().then(
      (result) => {
        if (id !== seq.current) return
        setData(result)
        setLoading(false)
      },
      (err) => {
        if (id !== seq.current) return
        setError(err ?? new Error('Unbekannter Fehler'))
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps])

  return { data, loading, error, reload: run }
}

export default useLatestRequest
