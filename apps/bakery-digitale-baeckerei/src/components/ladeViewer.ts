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

/**
 * Kann dieses Gerät die 3D-Ansicht zeigen? three.js braucht WebGL 2. Die
 * Prüfung kommt ohne three aus: Ohne WebGL 2 lädt die App weder den
 * three-Chunk noch (selbst) das Modell, sondern zeigt gleich die Liste.
 * Der Kontext der Probe wird gleich wieder freigegeben - Browser erlauben
 * nur wenige gleichzeitig, und die Szene braucht gleich ihren eigenen.
 */
export function hatWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
