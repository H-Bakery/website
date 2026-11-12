'use client'
/**
 * Hülle um die three-Szene (src/lib/scene/createViewer.ts). Wird nur über
 * `DigitaleBaeckerei` per next/dynamic (ssr: false) nachgeladen - three ist
 * nicht im ersten Bundle. In jest wird diese Komponente gemockt.
 *
 * Die Szene wird nur neu gebaut, wenn sich das Modell ändert. Blickpunkt,
 * Beschriftung und Auswahl gehen an die laufende Szene.
 */
import React, { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import type { Blickpunkt } from '../config/raeume'
import {
  createViewer,
  WebGLUnavailableError,
  type Rechteck,
  type Treffer,
  type ViewerHandle,
  type ViewerReadyInfo,
} from '../lib/scene/createViewer'

export interface Viewer3DProps {
  modelUrl: string
  modelBytes?: number
  /** Der aktive Blickpunkt; ein Wechsel lässt die Kamera dorthin gleiten. */
  blickpunkt: Blickpunkt
  fuellung: string
  /** Text für Screenreader am Canvas. */
  label: string
  /** Platz des gewählten Produkts: hervorgehoben und im freien Bild gehalten. */
  auswahl?: string | null
  /**
   * Was das Bild gerade verdeckt (die Produktkarte), in Viewport-Koordinaten.
   * Wird gelesen, wenn sich `auswahl` ändert.
   */
  verdecktVon?: () => Rechteck | null
  onProgress: (fraction: number) => void
  onReady: (info: ViewerReadyInfo) => void
  /** Kein WebGL auf diesem Gerät. */
  onUnavailable: () => void
  /** Das Modell ließ sich nicht laden. */
  onError: (error: unknown) => void
  /** Der WebGL-Kontext ging verloren. */
  onLost: () => void
  /** Tipp ins Bild: Treffer mit Produkt, sonst `null`. */
  onTreffer?: (treffer: Treffer | null) => void
  onErsteGeste?: () => void
  /** −1 = voriger, +1 = nächster Blickpunkt (Wischen mit zwei Fingern, Pfeiltasten). */
  onWechselGeste?: (richtung: -1 | 1) => void
}

export default function Viewer3D(props: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ViewerHandle | null>(null)
  // Callbacks und veränderliche Werte über eine Ref: Sie bauen die Szene nicht neu.
  const aktuell = useRef(props)
  aktuell.current = props

  const { modelUrl, modelBytes, blickpunkt, fuellung, label, auswahl } = props

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
        blickpunkt: aktuell.current.blickpunkt,
        fuellung,
        label: aktuell.current.label,
        debug,
        onProgress: (f) => aktuell.current.onProgress(f),
        onReady: (info) => aktuell.current.onReady(info),
        onError: (err) => aktuell.current.onError(err),
        onLost: () => aktuell.current.onLost(),
        onTreffer: (treffer) => aktuell.current.onTreffer?.(treffer),
        onErsteGeste: () => aktuell.current.onErsteGeste?.(),
        onWechselGeste: (richtung) =>
          aktuell.current.onWechselGeste?.(richtung),
      })
      viewerRef.current = viewer
      viewer.waehle(aktuell.current.auswahl ?? null)
      return () => {
        if (viewerRef.current === viewer) viewerRef.current = null
        viewer.dispose()
      }
    } catch (err) {
      if (err instanceof WebGLUnavailableError) aktuell.current.onUnavailable()
      else aktuell.current.onError(err)
      return undefined
    }
  }, [modelUrl, modelBytes, fuellung])

  useEffect(() => {
    viewerRef.current?.setBlickpunkt(blickpunkt)
  }, [blickpunkt])

  useEffect(() => {
    viewerRef.current?.setLabel(label)
  }, [label])

  useEffect(() => {
    viewerRef.current?.waehle(
      auswahl ?? null,
      auswahl ? aktuell.current.verdecktVon?.() ?? null : null
    )
  }, [auswahl])

  return (
    <Box
      ref={containerRef}
      data-testid="viewer-3d"
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        '& canvas': { outline: 'none' },
        // Tastatur: sichtbarer Fokus innen am Bildrand.
        '& canvas:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: '-3px',
        },
      }}
    />
  )
}
