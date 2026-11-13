/**
 * Der Raum in der Adresse: `?raum=<id>` (DB11). So lässt sich ein Raum
 * verlinken, und „Zurück“ im Browser führt in den vorigen Raum - ohne etwas
 * auf dem Gerät zu speichern. Der Start-Raum steht ohne Parameter da.
 * Reine Rechnung auf Zeichenketten; den Verlauf führt `DigitaleBaeckerei`.
 */
import type { Raum } from '../../config/raeume'

export const RAUM_PARAMETER = 'raum'

/**
 * Der Raum, den die Adresse meint: `?raum=<id>`, wenn es ihn unter den
 * verfügbaren gibt, sonst der Start-Raum (auch bei unbekannter id - ein alter
 * Link auf einen Raum, den es nicht mehr gibt, landet im Laden).
 */
export function raumAusAdresse(
  search: string,
  verfuegbar: readonly Raum[],
  startId: string
): Raum | undefined {
  const start = verfuegbar.find((r) => r.id === startId) ?? verfuegbar[0]
  let id: string | null = null
  try {
    id = new URLSearchParams(search).get(RAUM_PARAMETER)
  } catch {
    /* unlesbare Adresse: Start-Raum */
  }
  return (id !== null && verfuegbar.find((r) => r.id === id)) || start
}

/**
 * Die Query (`?raum=backstube&debug`, oder `''`) für einen Raum: der
 * Parameter wird gesetzt oder - beim Start-Raum - entfernt; alle anderen
 * Parameter bleiben in ihrer Reihenfolge stehen.
 */
export function sucheFuerRaum(
  search: string,
  raumId: string,
  startId: string
): string {
  const parameter = new URLSearchParams(search)
  if (raumId === startId) parameter.delete(RAUM_PARAMETER)
  else parameter.set(RAUM_PARAMETER, raumId)
  // `?debug` soll `?debug` bleiben, nicht `?debug=` werden.
  const text = parameter.toString().replace(/=(?=&|$)/g, '')
  return text ? `?${text}` : ''
}
