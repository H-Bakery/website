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

export interface PreviewModeState {
  /** Was gezeigt wird: ohne WebGL immer 2D. */
  mode: PreviewMode
  /** null = noch nicht geprüft (erster Render, statischer Export). */
  webgl: boolean | null
  setMode: (mode: PreviewMode) => void
  /** Die 3D-Ansicht ist ausgefallen (kein Kontext, Kontext verloren). */
  markUnavailable: () => void
}

/**
 * 2D/3D-Wahl der Vorschau. Vorgabe 3D, wenn das Gerät WebGL kann. Geprüft
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

  useEffect(() => {
    setWebgl(webglAvailable())
    setChosen(loadPreviewMode())
  }, [])

  const setMode = useCallback((mode: PreviewMode) => {
    setChosen(mode)
    savePreviewMode(mode)
  }, [])

  const markUnavailable = useCallback(() => {
    markWebGLUnavailable()
    setWebgl(false)
  }, [])

  const mode: PreviewMode = webgl ? chosen ?? '3d' : '2d'
  return { mode, webgl, setMode, markUnavailable }
}
