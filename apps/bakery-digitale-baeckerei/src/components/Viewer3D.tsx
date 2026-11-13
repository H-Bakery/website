'use client'
/**
 * Hülle um die three-Szene (src/lib/scene/createViewer.ts). Wird nur über
 * `DigitaleBaeckerei` per next/dynamic (ssr: false) nachgeladen - three ist
 * nicht im ersten Bundle. In jest wird diese Komponente gemockt.
 *
 * Die Szene wird nur neu gebaut, wenn sich das Modell ändert. Blickpunkt,
 * Beschriftung und Auswahl gehen an die laufende Szene.
 */
import React, { useCallback, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import type { Blickpunkt, Intro } from '../config/raeume'
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
   * Das Element, das das Bild gerade verdeckt (die Produktkarte), oder
   * `null`. Ändert es seine Größe („Mehr lesen“, Drehen des Geräts), wird
   * der gewählte Platz wieder in den freien Teil des Bildes gedreht.
   */
  verdecktVon?: () => Element | null
  /** Der gewählte Platz steht im freien Bild (`true`) oder lässt sich von hier nicht zeigen. */
  onAuswahlImBild?: (slot: string, imBild: boolean) => void
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
  /** Flüge zum Start dieses Raums (raeume.ts). `?intro=0` in der Adresse stellt sie ab. */
  intros?: readonly Intro[]
  /**
   * `false`: nach dem Laden ohne Flug am Blickpunkt stehen - der Raum wurde in
   * diesem Besuch schon einmal betreten. Gelesen beim Aufbau der Szene.
   */
  introSpielen?: boolean
  /** Neuer Wert (> 0): den Flug noch einmal zeigen. */
  introNochmal?: number
  /** Neuer Wert (> 0): den laufenden Flug überspringen. */
  introSchluss?: number
  /** Ein Flug beginnt (`true`) oder ist zu Ende (`false`). */
  onIntro?: (laeuft: boolean) => void
}

export default function Viewer3D(props: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ViewerHandle | null>(null)
  // Callbacks und veränderliche Werte über eine Ref: Sie bauen die Szene nicht neu.
  const aktuell = useRef(props)
  aktuell.current = props

  const { modelUrl, modelBytes, blickpunkt, fuellung, label, auswahl } = props
  const { intros, introNochmal = 0, introSchluss = 0 } = props

  /** Rechteck der Karte im Viewport - für die Szene, immer frisch gemessen. */
  const karte = useCallback((): Rechteck | null => {
    const element = aktuell.current.verdecktVon?.()
    if (!element) return null
    const { left, top, right, bottom } = element.getBoundingClientRect()
    return { left, top, right, bottom }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let debug = false
    let introSpielen = aktuell.current.introSpielen !== false
    try {
      const parameter = new URLSearchParams(window.location.search)
      debug = parameter.has('debug')
      introSpielen =
        aktuell.current.introSpielen !== false && parameter.get('intro') !== '0'
    } catch {
      /* ohne Messhaken, mit Flug */
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
        intros,
        introSpielen,
        onIntro: (laeuft) => aktuell.current.onIntro?.(laeuft),
        onProgress: (f) => aktuell.current.onProgress(f),
        onReady: (info) => aktuell.current.onReady(info),
        onError: (err) => aktuell.current.onError(err),
        onLost: () => aktuell.current.onLost(),
        onTreffer: (treffer) => aktuell.current.onTreffer?.(treffer),
        onErsteGeste: () => aktuell.current.onErsteGeste?.(),
        onWechselGeste: (richtung) =>
          aktuell.current.onWechselGeste?.(richtung),
        onAuswahlImBild: (slot, imBild) =>
          aktuell.current.onAuswahlImBild?.(slot, imBild),
      })
      viewerRef.current = viewer
      viewer.waehle(aktuell.current.auswahl ?? null, karte)
      return () => {
        if (viewerRef.current === viewer) viewerRef.current = null
        viewer.dispose()
      }
    } catch (err) {
      if (err instanceof WebGLUnavailableError) aktuell.current.onUnavailable()
      else aktuell.current.onError(err)
      return undefined
    }
  }, [modelUrl, modelBytes, fuellung, intros, karte])

  useEffect(() => {
    viewerRef.current?.setBlickpunkt(blickpunkt)
  }, [blickpunkt])

  useEffect(() => {
    viewerRef.current?.setLabel(label)
  }, [label])

  // Nach dem Blickpunkt: „Noch einmal“ setzt ihn zuerst auf das Ziel des Flugs.
  useEffect(() => {
    if (introNochmal > 0) viewerRef.current?.spieleIntro()
  }, [introNochmal])

  useEffect(() => {
    if (introSchluss > 0) viewerRef.current?.ueberspringeIntro()
  }, [introSchluss])

  useEffect(() => {
    viewerRef.current?.waehle(auswahl ?? null, karte)
    if (!auswahl) return undefined
    // Die Karte wächst („Mehr lesen“) oder wandert (hoch ↔ quer): den Platz
    // wieder frei stellen.
    const element = aktuell.current.verdecktVon?.()
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    let erste = true
    const beobachter = new ResizeObserver(() => {
      // Der erste Aufruf meldet nur die Größe beim Anmelden.
      if (erste) erste = false
      else viewerRef.current?.haltFrei()
    })
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [auswahl, karte])

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
