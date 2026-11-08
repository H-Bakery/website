'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  loadPreviewMode,
  markWebGLUnavailable,
  savePreviewMode,
  webglAvailable,
  webglChecked,
  type PreviewMode,
} from '../lib/previewMode'

/**
 * Warum gerade 2D gezeigt wird, obwohl 3D gewählt war:
 * - `unavailable`: das Gerät kann kein WebGL 2 oder der Renderer startet nicht
 *   (3D bleibt für die Sitzung gesperrt);
 * - `interrupted`: der Kontext ging verloren (z. B. App gewechselt,
 *   Speicherdruck) - 3D lässt sich erneut wählen.
 */
export type PreviewNotice = 'unavailable' | 'interrupted' | null

export interface PreviewModeState {
  /** Was gezeigt wird: ohne WebGL und nach einer Unterbrechung 2D. */
  mode: PreviewMode
  /** null = noch nicht geprüft (erster Render, statischer Export). */
  webgl: boolean | null
  notice: PreviewNotice
  setMode: (mode: PreviewMode) => void
  /** Die 3D-Ansicht ließ sich nicht starten. */
  markUnavailable: () => void
  /** Der WebGL-Kontext ging verloren: vorerst 2D, 3D bleibt wählbar. */
  markInterrupted: () => void
}

/**
 * 2D/3D-Wahl der Vorschau. Vorgabe 3D, wenn das Gerät WebGL 2 kann. Geprüft
 * wird erst im Browser nach dem Mounten - der statische Export und der
 * erste Render zeigen 2D.
 */
export function usePreviewMode(): PreviewModeState {
  const [webgl, setWebgl] = useState<boolean | null>(() =>
    webglChecked() ? webglAvailable() : null
  )
  const [chosen, setChosen] = useState<PreviewMode | null>(() =>
    webglChecked() ? loadPreviewMode() : null
  )
  const [interrupted, setInterrupted] = useState(false)

  useEffect(() => {
    setWebgl(webglAvailable())
    setChosen(loadPreviewMode())
  }, [])

  const setMode = useCallback((mode: PreviewMode) => {
    setChosen(mode)
    setInterrupted(false)
    savePreviewMode(mode)
  }, [])

  const markUnavailable = useCallback(() => {
    markWebGLUnavailable()
    setWebgl(false)
  }, [])

  // Nicht gespeichert: die gemerkte Wahl bleibt 3D, nur diese Sitzung zeigt 2D.
  const markInterrupted = useCallback(() => setInterrupted(true), [])

  const mode: PreviewMode = webgl && !interrupted ? chosen ?? '3d' : '2d'
  const notice: PreviewNotice =
    webgl === false
      ? 'unavailable'
      : webgl && interrupted
      ? 'interrupted'
      : null
  return { mode, webgl, notice, setMode, markUnavailable, markInterrupted }
}
