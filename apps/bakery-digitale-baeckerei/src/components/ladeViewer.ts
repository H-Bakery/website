import type { ComponentType } from 'react'
import type { Viewer3DProps } from './Viewer3D'

export type ViewerKomponente = ComponentType<Viewer3DProps>

/**
 * Lädt die 3D-Komponente (und mit ihr three.js) als eigenen Chunk nach - nur
 * im Browser, nie im ersten Bundle und nie beim Vorab-Rendern. Die einzige
 * Stelle, die `Viewer3D` importiert.
 *
 * Bewusst ohne `next/dynamic`: Dessen Ladefehler landet als Ausnahme im
 * Render und reißt die ganze Seite mit, und ein zweiter Versuch ist nicht
 * vorgesehen. So ist es ein abgelehntes Promise, das `DigitaleBaeckerei` in
 * den Zustand „fehler“ mit „Noch einmal versuchen“ übersetzt; webpack fragt
 * einen gescheiterten Chunk beim nächsten Aufruf neu an.
 */
export function ladeViewer(): Promise<ViewerKomponente> {
  return import('./Viewer3D').then((modul) => modul.default)
}
