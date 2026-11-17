/**
 * Holt das Modell eines Raums als Bytes, mit Fortschritt - **ohne three**.
 * Darum kann `DigitaleBaeckerei` den Abruf gleich beim Start beginnen, noch
 * bevor der Chunk mit three.js da ist; die Szene (`createViewer.ts`) entpackt
 * nur noch.
 *
 * Der Abruf ist ein einfaches `fetch(url)` (Modus `cors`, Credentials
 * `same-origin`) - genau wie das `<link rel="preload" as="fetch"
 * crossorigin="anonymous">` im HTML (`src/app/layout.tsx`). Nur so nimmt der
 * Browser die vorab geladene Antwort, statt das Modell ein zweites Mal zu
 * holen (die Playwright-Suite prüft das).
 *
 * Herkunft von `fetchBytes`: Saar LiDAR Explorer
 * (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher Urheber),
 * `app/src/zones/runtime/gltfZone.ts`.
 */

/** So oft wird der Abruf nach einem Netzfehler wiederholt, mit dieser Pause. */
export const MODELL_NOCHMAL = 2
export const MODELL_NOCHMAL_MS = 200

/**
 * Bis hierhin zählt der Fortschritt nach der erwarteten Größe. Stimmt sie
 * nicht (die Datei ist größer), bleibt er hier stehen, bis wirklich alles da
 * ist - nie „fertig“, solange noch Bytes kommen.
 */
const SCHAETZUNG_BIS = 0.99

const abgebrochen = (): DOMException =>
  new DOMException('Laden abgebrochen', 'AbortError')

/**
 * GET mit Fortschritt 0…1: nach Content-Length, sonst nach der erwarteten
 * Größe (`declared`). Am Ende immer genau 1 - auch wenn die erwartete Größe
 * nicht stimmt.
 */
export async function fetchBytes(
  url: string,
  signal: AbortSignal,
  declared: number | undefined,
  onBytes: (fraction: number) => void
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  // Bei komprimierter Auslieferung zählt Content-Length die gepackten Bytes,
  // der Reader liefert die entpackten - dann gilt die erwartete Größe.
  const encoded = res.headers.get('content-encoding')
  const length = encoded ? 0 : Number(res.headers.get('content-length'))
  const total = length || declared || 0
  if (!res.body || !total) {
    const all = await res.arrayBuffer()
    onBytes(1)
    return all
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.byteLength
    onBytes(Math.min(SCHAETZUNG_BIS, got / total))
  }
  const out = new Uint8Array(got)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  onBytes(1)
  return out.buffer
}

export interface HoleModellOptionen {
  signal: AbortSignal
  /** Erwartete Größe in Bytes (model.lock.json), wenn der Server keine nennt. */
  bytes?: number
  /** Fortschritt 0…1: steigt nur, endet mit 1, wenn das Modell da ist. */
  onFortschritt?: (anteil: number) => void
  /** Wiederholungen nach einem Netzfehler (Standard `MODELL_NOCHMAL`). */
  nochmal?: number
  /** Pause davor in ms (Standard `MODELL_NOCHMAL_MS`). */
  pauseMs?: number
}

/**
 * Holt das Modell. Ein Netzfehler (`TypeError: Failed to fetch`) wird
 * wiederholt, bevor er als Ladefehler gilt: Wechselt man schnell hin und her,
 * bricht der alte Raum seinen Abruf ab - und der Browser lässt dabei auch den
 * neuen Abruf derselben Datei scheitern, obwohl dessen eigenes Signal nicht
 * abgebrochen ist. Ein echter Ausfall scheitert auch beim zweiten und dritten
 * Mal; eine Antwort mit Fehlerstatus (404) wird nicht wiederholt. Abbrechen
 * (`signal`) endet mit einem `AbortError`, auch mitten in der Pause.
 */
export async function holeModell(
  url: string,
  {
    signal,
    bytes,
    onFortschritt,
    nochmal = MODELL_NOCHMAL,
    pauseMs = MODELL_NOCHMAL_MS,
  }: HoleModellOptionen
): Promise<ArrayBuffer> {
  // Ein neuer Versuch fängt bei 0 an - die Anzeige bleibt, wo sie war.
  let bisher = 0
  const melde = (anteil: number) => {
    if (anteil <= bisher) return
    bisher = anteil
    onFortschritt?.(anteil)
  }
  for (let rest = nochmal; ; rest -= 1) {
    if (signal.aborted) throw abgebrochen()
    try {
      return await fetchBytes(url, signal, bytes, melde)
    } catch (err) {
      if (signal.aborted) throw abgebrochen()
      if (!(err instanceof TypeError) || rest <= 0) throw err
    }
    // Die Pause endet auch mit dem Abbruch - dann gleich oben der AbortError.
    await new Promise<void>((weiter) => {
      const fertig = () => {
        clearTimeout(uhr)
        signal.removeEventListener('abort', fertig)
        weiter()
      }
      const uhr = setTimeout(fertig, pauseMs)
      signal.addEventListener('abort', fertig)
    })
  }
}
