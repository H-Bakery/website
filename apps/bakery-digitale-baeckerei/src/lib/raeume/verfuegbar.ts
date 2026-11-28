/**
 * Welche Räume die App zeigt: die aus `src/config/raeume.ts`, deren Modell in
 * model.lock.json steht (DB11). Ein Raum ohne Lock-Eintrag wird nicht gebaut
 * (`sync-model` lädt nur, was im Lock steht) und darum auch nicht gezeigt -
 * kein Platzhalter.
 *
 * Fixture-Modus (`DIGITALE_BAECKEREI_FIXTURE=1`, Tests und CI): `sync-model`
 * baut dann die synthetischen Räume aus `src/test/fixtures/` - den Laden und
 * die „Testbackstube“. Nur dann kommt deren Konfiguration überhaupt in die
 * App: Der Schalter ist zur Bauzeit eine Konstante (next.config.js), webpack
 * lässt den `require` im echten Build ganz weg, und der Export-Wächter
 * (scripts/export-pruefung.js) prüft das nach.
 */
import lock from '../../../model.lock.json'
import { raeume, type Raum } from '../../config/raeume'

const FIXTURE = process.env.NEXT_PUBLIC_DIGITALE_BAECKEREI_FIXTURE === '1'

interface LockRaum {
  datei: string
  bytes: number
  ausgeliefert?: { bytes: number }
}
type Lock = { raeume: Record<string, LockRaum | undefined> }

const lockRaum = (id: string, l: Lock): LockRaum | undefined =>
  Object.prototype.hasOwnProperty.call(l.raeume, id) ? l.raeume[id] : undefined

/**
 * Die Räume mit Modell im Lock, in der Reihenfolge der Konfiguration. Ein
 * Raum, dessen `modell` nicht die Datei aus dem Lock ist, zählt nicht - die
 * App fände sein Modell nicht (raeume.spec.ts hält beides gleich).
 */
export function gesperrteRaeume(alle: readonly Raum[], l: Lock): Raum[] {
  return alle.filter((raum) => lockRaum(raum.id, l)?.datei === raum.modell)
}

// Die Bedingung steht hier wörtlich und nicht als `FIXTURE`: Nur einen
// Vergleich mit der eingesetzten Konstante rechnet webpack beim Bauen aus und
// lässt dann den toten Zweig samt `require` weg. Über eine Variable bliebe die
// Datei im Bundle des echten Builds (der Export-Wächter hat genau das gemeldet).
const TESTRAEUME: readonly Raum[] =
  process.env.NEXT_PUBLIC_DIGITALE_BAECKEREI_FIXTURE === '1'
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      (
        require('../../test/fixtures/testraeume') as {
          TESTRAEUME: readonly Raum[]
        }
      ).TESTRAEUME
    : []

/** Alle Räume, die dieser Build zeigt. */
export const VERFUEGBARE_RAEUME: readonly Raum[] = FIXTURE
  ? [...raeume, ...TESTRAEUME]
  : gesperrteRaeume(raeume, lock)

/**
 * Größe der ausgelieferten (bereinigten) Datei eines Raums - die lädt der
 * Browser; für die Fortschrittsanzeige. Unbekannt für Räume ohne Lock-Eintrag
 * (die synthetischen der Tests).
 */
export function modellBytes(raum: Raum, l: Lock = lock): number | undefined {
  const eintrag = lockRaum(raum.id, l)
  if (!eintrag || eintrag.datei !== raum.modell) return undefined
  return eintrag.ausgeliefert?.bytes ?? eintrag.bytes
}
