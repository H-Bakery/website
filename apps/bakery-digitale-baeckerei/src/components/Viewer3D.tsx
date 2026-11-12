'use client'
/**
 * Hülle um die three-Szene (src/lib/scene/createViewer.ts). Wird nur über
 * `DigitaleBaeckerei` per next/dynamic (ssr: false) nachgeladen - three ist
 * nicht im ersten Bundle. In jest wird diese Komponente gemockt.
 */
import React, { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import type { Blickpunkt } from '../config/raeume'
import {
  createViewer,
  WebGLUnavailableError,
  type ViewerReadyInfo,
} from '../lib/scene/createViewer'

export interface Viewer3DProps {
  modelUrl: string
  modelBytes?: number
  blickpunkt: Blickpunkt
  fuellung: string
  /** Text für Screenreader am Canvas. */
  label: string
  onProgress: (fraction: number) => void
  onReady: (info: ViewerReadyInfo) => void
  /** Kein WebGL auf diesem Gerät. */
  onUnavailable: () => void
  /** Das Modell ließ sich nicht laden. */
  onError: (error: unknown) => void
  /** Der WebGL-Kontext ging verloren. */
  onLost: () => void
}

export default function Viewer3D(props: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Callbacks über eine Ref: ein neuer Callback baut die Szene nicht neu.
  const callbacks = useRef(props)
  callbacks.current = props

  const { modelUrl, modelBytes, blickpunkt, fuellung, label } = props

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let debug = false
    try {
      debug = new URLSearchParams(window.location.search).has('debug')
    } catch {
      /* ohne Messhaken */
    }
    try {
      // Eigenes Canvas je Mounten - auch unter React StrictMode sauber.
      const viewer = createViewer(container, {
        modelUrl,
        modelBytes,
        blickpunkt,
        fuellung,
        label,
        debug,
        onProgress: (f) => callbacks.current.onProgress(f),
        onReady: (info) => callbacks.current.onReady(info),
        onError: (err) => callbacks.current.onError(err),
        onLost: () => callbacks.current.onLost(),
      })
      return () => viewer.dispose()
    } catch (err) {
      if (err instanceof WebGLUnavailableError)
        callbacks.current.onUnavailable()
      else callbacks.current.onError(err)
      return undefined
    }
  }, [modelUrl, modelBytes, blickpunkt, fuellung, label])

  return (
    <Box
      ref={containerRef}
      data-testid="viewer-3d"
      sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    />
  )
}
