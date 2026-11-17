/**
 * Der Verlauf des Browsers für Ansichten, die sich über den Laden legen (die
 * Nahansicht; später vielleicht Liste und Karte).
 *
 * Wer so eine Ansicht öffnet, bekommt einen eigenen Eintrag im Verlauf - mit
 * derselben Adresse und einer Marke im `history.state`. So schließt die
 * Zurück-Geste von Android und iOS (und „Zurück“ im Browser) nur die Ansicht,
 * statt die ganze App zu verlassen. Schließt man sie selbst („Zurück“,
 * Escape, Tipp daneben), nimmt sie ihren Eintrag mit `history.back()` wieder
 * heraus - es bleibt kein toter Schritt im Verlauf.
 *
 * Gespeichert wird nichts auf dem Gerät: Der Eintrag lebt nur im Verlauf
 * dieses Tabs. Next.js (App Router) hängt sich an `pushState`; weil der neue
 * Eintrag den Zustand des alten mitnimmt (`__NA` und den Baum des Routers),
 * ist ein Schritt dorthin oder zurück für den Router derselbe Ort: kein
 * Neuladen, keine Navigation. Den Raum aus `?raum` (DigitaleBaeckerei)
 * berührt das nicht - die Adresse bleibt, also bleibt der Raum.
 */
import { useCallback, useEffect, useRef } from 'react'

/** Schlüssel in `history.state`: Daran erkennt eine Ansicht ihren Eintrag. */
export const VERLAUF_MARKE = 'digitaleBaeckereiAnsicht'

/**
 * So lange wartet eine neue Ansicht höchstens auf ein eigenes Zurück, das
 * noch unterwegs ist, bevor sie ihren Eintrag anlegt (sonst träfe das Zurück
 * der alten Ansicht den Eintrag der neuen).
 */
export const ZURUECK_FRIST_MS = 1000

let zaehler = 0
/** Ein `history.back()` von hier, dessen `popstate` noch aussteht. */
let unterwegs: Promise<void> | null = null

function zustand(): Record<string, unknown> | null {
  const stand: unknown = window.history.state
  return typeof stand === 'object' && stand !== null
    ? (stand as Record<string, unknown>)
    : null
}

/** Steht der Eintrag mit dieser Marke gerade oben im Verlauf? */
function istOben(marke: string): boolean {
  return marke !== '' && zustand()?.[VERLAUF_MARKE] === marke
}

/** Nimmt den obersten Eintrag heraus und merkt sich, bis er weg ist. */
function zurueck(): void {
  let uhr: ReturnType<typeof setTimeout> | undefined
  const weg = new Promise<void>((fertig) => {
    const ende = () => {
      clearTimeout(uhr)
      window.removeEventListener('popstate', ende)
      fertig()
    }
    window.addEventListener('popstate', ende)
    uhr = setTimeout(ende, ZURUECK_FRIST_MS)
  })
  unterwegs = weg
  void weg.then(() => {
    if (unterwegs === weg) unterwegs = null
  })
  try {
    window.history.back()
  } catch {
    /* ohne Verlauf: Die Ansicht schließt trotzdem. */
  }
}

/**
 * Gibt einer offenen Ansicht einen eigenen Schritt im Verlauf. Ein Zurück im
 * Browser (Geste, Taste) schließt sie über `onClose`. Die zurückgegebene
 * Funktion schließt sie von innen („Zurück“, Escape, Tipp daneben): Sie nimmt
 * den eigenen Eintrag heraus, wenn er oben liegt, und ruft `onClose`.
 *
 * Wird die Ansicht von außen geschlossen und ihr Eintrag liegt noch oben,
 * verschwindet er ebenfalls; liegt schon ein anderer darüber (z. B. ein
 * Raumwechsel), bleibt der Verlauf, wie er ist.
 */
export function useZurueckSchliesst(
  offen: boolean,
  onClose: () => void
): () => void {
  const schliessen = useRef(onClose)
  schliessen.current = onClose
  /** Die Marke des eigenen Eintrags; `''` = keiner (noch nicht oder nicht mehr). */
  const marke = useRef('')
  /** StrictMode baut ab und sofort wieder auf: Aufgeräumt wird einen Takt später. */
  const aufraeumen = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!offen) return undefined
    clearTimeout(aufraeumen.current)
    let aktiv = true
    const anlegen = () => {
      if (!aktiv || istOben(marke.current)) return
      zaehler += 1
      const neu = `ansicht-${zaehler}`
      try {
        window.history.pushState({ ...zustand(), [VERLAUF_MARKE]: neu }, '')
        marke.current = neu
      } catch {
        marke.current = ''
      }
    }
    if (unterwegs) void unterwegs.then(anlegen)
    else anlegen()

    const beiZurueck = () => {
      if (marke.current === '' || istOben(marke.current)) return
      marke.current = ''
      schliessen.current()
    }
    window.addEventListener('popstate', beiZurueck)
    return () => {
      aktiv = false
      window.removeEventListener('popstate', beiZurueck)
      const eigene = marke.current
      if (eigene === '') return
      aufraeumen.current = setTimeout(() => {
        marke.current = ''
        if (istOben(eigene)) zurueck()
      }, 0)
    }
  }, [offen])

  return useCallback(() => {
    const eigene = marke.current
    marke.current = ''
    if (istOben(eigene)) zurueck()
    schliessen.current()
  }, [])
}
