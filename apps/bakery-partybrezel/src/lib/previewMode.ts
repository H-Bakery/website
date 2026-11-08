/**
 * 2D- oder 3D-Vorschau: gemerkte Wahl (nur Komfort, eigener Schlüssel neben
 * dem Entwurf) und ob das Gerät WebGL kann.
 */
export type PreviewMode = '2d' | '3d'

export const VIEW_STORAGE_KEY = 'bakery-partybrezel-view-v1'

export function loadPreviewMode(): PreviewMode | null {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY)
    return raw === '2d' || raw === '3d' ? raw : null
  } catch {
    return null
  }
}

export function savePreviewMode(mode: PreviewMode): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode)
  } catch {
    // privater Modus, voller Speicher - die Wahl ist nur Komfort
  }
}

let webglResult: boolean | null = null

/**
 * Prüft einmal je Seite, ob ein WebGL-2-Kontext entsteht, und gibt ihn sofort
 * wieder frei. three.js (ab r163) kann nur WebGL 2 - ein Gerät mit nur
 * WebGL 1 bekommt gleich 2D, statt erst den 3D-Teil zu laden. Lässt sich
 * der Renderer trotzdem nicht starten, merkt `markWebGLUnavailable()` das
 * für die übrige Sitzung. Ein später verlorener Kontext ist dagegen nur eine
 * Unterbrechung (`usePreviewMode`), kein „nicht verfügbar“.
 */
export function webglAvailable(): boolean {
  if (webglResult !== null) return webglResult
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    webglResult = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglResult = false
  }
  return webglResult
}

/** Bereits geprüft? Nur dann darf der erste Render das Ergebnis nutzen (Hydration). */
export function webglChecked(): boolean {
  return webglResult !== null
}

export function markWebGLUnavailable(): void {
  webglResult = false
}

/** Nur für Tests. */
export function resetWebGLCheck(): void {
  webglResult = null
}
