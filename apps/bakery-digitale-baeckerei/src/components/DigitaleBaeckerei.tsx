'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import lock from '../../model.lock.json'
import {
  START_BLICKPUNKT_ID,
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
} from '../config/raeume'
import { BASE_PATH, modelUrl } from '../lib/basePath'
import type {
  Belegung,
  ProduktInfo,
  ProduktSnapshot,
} from '../lib/produkte/types'
import {
  eintraegeFuer,
  ladeProduktdaten,
  type ListenEintrag,
} from '../lib/produkte/zuordnung'
import type { Treffer } from '../lib/scene/createViewer'
import AllesHierListe from './AllesHierListe'
import BlickpunktLeiste from './BlickpunktLeiste'
import Hinweis from './Hinweis'
import Ladebild from './Ladebild'
import { ladeViewer, type ViewerKomponente } from './ladeViewer'
import OhneWebGL, { OHNE_WEBGL_TEXT, OHNE_WEBGL_ZUSATZ } from './OhneWebGL'
import ProduktSheet from './ProduktSheet'
import { SCENE_BACKDROP } from './theme'

export const TITEL = 'Digitale Bäckerei'
export const FEHLER_TEXT =
  'Der Laden konnte nicht geladen werden. Prüf deine Verbindung und versuch es noch einmal.'
export const UNTERBROCHEN_TEXT =
  'Die 3D-Ansicht wurde unterbrochen. Du kannst sie neu laden.'
export const BEREIT_TEXT = 'Der Laden ist geladen. Du stehst an der Theke.'
export const DATEN_LADEN_TEXT = 'Die Produktinfos werden geladen …'
export const DATEN_FEHLER_TEXT =
  'Die Produktinfos konnten nicht geladen werden.'
/** An einem Blickpunkt ohne Produktinfos: einmal sagen, dass Tippen hier nichts öffnet. */
export const KEINE_INFOS_HINWEIS =
  'Hier gibt es noch keine Infos zum Antippen – schau dich einfach um.'
/**
 * Das gewählte Produkt lässt sich von diesem Blickpunkt aus nicht ins Bild
 * drehen. Bewusst ohne Richtung: Die Grenze des Umschauens ist dann schon
 * erreicht, „zieh nach rechts“ wäre falsch.
 */
export const NICHT_IM_BILD_TEXT = 'Von hier aus gerade nicht im Bild.'
export const NOCHMAL_TEXT = 'Noch einmal versuchen'

/** Ansage für Screenreader nach einem Wechsel. */
export const blickpunktAnsage = (name: string) => `Blickpunkt ${name}.`
/** Ansage, wenn ein Tipp ins Bild eine Karte geöffnet hat (der Fokus bleibt in der Szene). */
export const kartenAnsage = (name: string) => `Infos zu ${name} geöffnet.`

/** So lange steht der Hinweis an einem Blickpunkt ohne Produktinfos. */
export const KEINE_INFOS_MS = 7000

type Zustand = 'laden' | 'bereit' | 'kein-webgl' | 'fehler' | 'unterbrochen'

interface Produktdaten {
  snapshot: ProduktSnapshot
  belegung: Belegung
}

/** Das gewählte Produkt und der Platz, auf dem es im Bild liegt. */
interface Auswahl {
  slot: string
  produkt: ProduktInfo
  /** `tipp`: ins Bild getippt - der Fokus bleibt in der Szene. */
  quelle: 'tipp' | 'liste'
}

const modelBytes = (file: string): number | undefined =>
  (lock.files as Record<string, { bytes: number } | undefined>)[file]?.bytes

const UNSICHTBAR = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

/** Die Produktkarte, solange sie offen ist - sie verdeckt einen Teil des Bildes. */
const produktKarte = (): Element | null =>
  document.querySelector('[data-testid="produkt-sheet"]')

export default function DigitaleBaeckerei() {
  const raum = findeRaum(START_RAUM_ID)

  const [zustand, setZustand] = useState<Zustand>('laden')
  const [fortschritt, setFortschritt] = useState(0)
  /** Neuer Wert = Szene neu aufbauen („Noch einmal versuchen“). */
  const [versuch, setVersuch] = useState(0)
  /** Die nachgeladene 3D-Komponente (three.js) - nie im ersten Bundle. */
  const [Viewer3D, setViewer3D] = useState<ViewerKomponente | null>(null)
  const [aktivId, setAktivId] = useState(START_BLICKPUNKT_ID)
  /** Erst nach einem Wechsel sagt die Status-Region den Blickpunkt an. */
  const [gewechselt, setGewechselt] = useState(false)
  const [daten, setDaten] = useState<Produktdaten | null>(null)
  const [datenFehler, setDatenFehler] = useState(false)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  /** Platz, der sich von hier nicht ins freie Bild drehen lässt. */
  const [nichtImBild, setNichtImBild] = useState<string | null>(null)
  const [listeOffen, setListeOffen] = useState(false)
  /** Nach der ersten Bedienung verschwindet der Hinweis. */
  const [bedient, setBedient] = useState(false)
  /** Blickpunkt, an dem gerade der Hinweis „keine Infos zum Antippen“ steht. */
  const [keineInfosAn, setKeineInfosAn] = useState<string | null>(null)
  const keineInfosGezeigt = useRef(new Set<string>())

  // Die Szene nachladen. Scheitert das (wackliges Netz: HTML da, der
  // three-Chunk nicht), ist das ein Ladefehler mit „Noch einmal versuchen“ -
  // keine englische Fehlerseite.
  const hatViewer = Viewer3D !== null
  useEffect(() => {
    if (hatViewer) return undefined
    let aktuell = true
    ladeViewer()
      .then((komponente) => {
        if (aktuell) setViewer3D(() => komponente)
      })
      .catch(() => {
        if (aktuell) setZustand('fehler')
      })
    return () => {
      aktuell = false
    }
  }, [hatViewer, versuch])

  // Snapshot aus hq und Belegung aus dem Modell - unabhängig von der Szene,
  // auch der Ersatz ohne WebGL braucht sie.
  useEffect(() => {
    let aktuell = true
    ladeProduktdaten(BASE_PATH)
      .then((geladen) => {
        if (aktuell) setDaten(geladen)
      })
      .catch(() => {
        if (aktuell) setDatenFehler(true)
      })
    return () => {
      aktuell = false
    }
  }, [])

  const blickpunkte = useMemo(() => raum?.blickpunkte ?? [], [raum])
  const blickpunkt = raum && findeBlickpunkt(raum, aktivId)

  /** Was an welchem Blickpunkt liegt - nur Produkte, die der Snapshot kennt. */
  const eintraegeJe = useMemo(() => {
    const je: Record<string, ListenEintrag[]> = {}
    if (!daten) return je
    for (const b of blickpunkte) {
      je[b.id] = eintraegeFuer(daten.belegung, daten.snapshot, [...b.moebel])
    }
    return je
  }, [daten, blickpunkte])

  const waehle = useCallback((neu: Auswahl | null) => {
    setAuswahl(neu)
    setNichtImBild(null)
  }, [])

  const aktivRef = useRef(aktivId)
  aktivRef.current = aktivId
  const wechsleZu = useCallback(
    (id: string) => {
      if (aktivRef.current !== id) setGewechselt(true)
      setAktivId(id)
      // Karte und Liste gehören zum alten Blickpunkt.
      waehle(null)
      setListeOffen(false)
      setBedient(true)
      setKeineInfosAn(null)
    },
    [waehle]
  )

  const onWechselGeste = useCallback(
    (richtung: -1 | 1) => {
      const n = blickpunkte.length
      const index = blickpunkte.findIndex((b) => b.id === aktivRef.current)
      if (n < 2 || index < 0) return
      // Im Kreis, wie die Pfeile der Leiste.
      wechsleZu(blickpunkte[(index + richtung + n) % n].id)
    },
    [blickpunkte, wechsleZu]
  )

  const onProgress = useCallback((f: number) => setFortschritt(f), [])
  const onReady = useCallback(() => setZustand('bereit'), [])
  const onUnavailable = useCallback(() => setZustand('kein-webgl'), [])
  const onError = useCallback(() => setZustand('fehler'), [])
  const onLost = useCallback(() => setZustand('unterbrochen'), [])
  const onErsteGeste = useCallback(() => setBedient(true), [])
  const onAuswahlImBild = useCallback(
    (slot: string, imBild: boolean) =>
      setNichtImBild((vorher) =>
        imBild ? (vorher === slot ? null : vorher) : slot
      ),
    []
  )

  /**
   * Tipp ins Bild. Eine Karte gibt es nur für ein Produkt, das der Snapshot
   * kennt; alles andere (neutrale Ware, Möbel, Wand, unbekanntes Produkt)
   * schließt die Karte und nimmt die Hervorhebung weg.
   */
  const onTreffer = useCallback(
    (treffer: Treffer | null) => {
      const id = treffer?.produkt
      const produkt =
        id &&
        daten &&
        Object.prototype.hasOwnProperty.call(daten.snapshot.produkte, id)
          ? daten.snapshot.produkte[id]
          : undefined
      waehle(
        treffer && produkt
          ? { slot: treffer.slot, produkt, quelle: 'tipp' }
          : null
      )
      setKeineInfosAn(null)
    },
    [daten, waehle]
  )

  const schliesseKarte = useCallback(() => waehle(null), [waehle])

  const nochmal = () => {
    setFortschritt(0)
    waehle(null)
    setListeOffen(false)
    setZustand('laden')
    setVersuch((n) => n + 1)
  }

  const bereit = zustand === 'bereit'
  const eintraege = useMemo(
    () => (blickpunkt ? eintraegeJe[blickpunkt.id] ?? [] : []),
    [blickpunkt, eintraegeJe]
  )

  // An einem Blickpunkt ohne Produktinfos (heute: Regale) reagiert kein Tipp
  // mit einer Karte. Das einmal sagen, statt den Besucher raten zu lassen.
  const ohneInfos = bereit && daten !== null && eintraege.length === 0
  useEffect(() => {
    if (!ohneInfos || keineInfosGezeigt.current.has(aktivId)) return undefined
    keineInfosGezeigt.current.add(aktivId)
    setKeineInfosAn(aktivId)
    const timer = setTimeout(() => setKeineInfosAn(null), KEINE_INFOS_MS)
    return () => clearTimeout(timer)
  }, [ohneInfos, aktivId])

  if (!raum || !blickpunkt) return null

  const zeigtSzene = zustand === 'laden' || bereit
  /** Mit Produktdaten bleibt bei einem Ladefehler die Liste benutzbar. */
  const fehlerMitListe = zustand === 'fehler' && daten !== null

  const meldung = fehlerMitListe
    ? ''
    : zustand === 'fehler'
    ? FEHLER_TEXT
    : zustand === 'unterbrochen'
    ? UNTERBROCHEN_TEXT
    : zustand === 'kein-webgl' && !daten
    ? `${OHNE_WEBGL_TEXT} ${datenFehler ? DATEN_FEHLER_TEXT : DATEN_LADEN_TEXT}`
    : ''
  const ansage = !bereit
    ? ''
    : auswahl?.quelle === 'tipp'
    ? kartenAnsage(auswahl.produkt.name)
    : gewechselt
    ? blickpunktAnsage(blickpunkt.name)
    : BEREIT_TEXT

  const waehleAusListe = (slot: string) => {
    const eintrag = eintraege.find((e) => e.slot === slot)
    setListeOffen(false)
    waehle(eintrag ? { slot, produkt: eintrag.produkt, quelle: 'liste' } : null)
  }

  const keineInfos = keineInfosAn === blickpunkt.id && !auswahl

  return (
    <Box
      component="main"
      data-zustand={zustand}
      sx={{
        position: 'fixed',
        inset: 0,
        // dvh: auf dem Handy ohne die ein- und ausfahrende Adressleiste
        height: '100dvh',
        overflow: 'hidden',
        // Kein Doppeltipp-Zoom der ganzen Seite auf Leiste und Karte; die
        // Szene selbst nimmt sich alle Gesten (touch-action: none am Canvas).
        touchAction: 'manipulation',
        // Die Szene bleibt hell, auch im Dark Mode.
        backgroundColor: SCENE_BACKDROP,
      }}
    >
      {zeigtSzene && Viewer3D && (
        <Viewer3D
          key={versuch}
          modelUrl={modelUrl(raum.modell)}
          modelBytes={modelBytes(raum.modell)}
          blickpunkt={blickpunkt}
          fuellung={raum.fuellung}
          label={`3D-Ansicht der Bäckerei, Blickpunkt ${blickpunkt.name}`}
          auswahl={auswahl?.slot ?? null}
          verdecktVon={produktKarte}
          onProgress={onProgress}
          onReady={onReady}
          onUnavailable={onUnavailable}
          onError={onError}
          onLost={onLost}
          onTreffer={onTreffer}
          onErsteGeste={onErsteGeste}
          onWechselGeste={onWechselGeste}
          onAuswahlImBild={onAuswahlImBild}
        />
      )}

      {zustand === 'kein-webgl' && daten && (
        <OhneWebGL blickpunkte={[...blickpunkte]} eintraegeJe={eintraegeJe} />
      )}

      {fehlerMitListe && (
        <OhneWebGL
          blickpunkte={[...blickpunkte]}
          eintraegeJe={eintraegeJe}
          meldung={`${FEHLER_TEXT} ${OHNE_WEBGL_ZUSATZ}`}
          aktion={
            <Button variant="contained" onClick={nochmal}>
              {NOCHMAL_TEXT}
            </Button>
          }
        />
      )}

      <Paper
        component="header"
        elevation={2}
        sx={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
          px: 1.5,
          py: 1,
          maxWidth: 'calc(100% - 24px)',
        }}
      >
        <Typography variant="h1">{TITEL}</Typography>
      </Paper>

      {bereit && (
        <>
          <Hinweis
            sichtbar={keineInfos || (!bedient && !auswahl)}
            text={keineInfos ? KEINE_INFOS_HINWEIS : undefined}
          />
          <BlickpunktLeiste
            blickpunkte={[...blickpunkte]}
            aktiv={blickpunkt.id}
            onWechsel={wechsleZu}
            onAllesHier={() => {
              setBedient(true)
              setListeOffen(true)
            }}
          />
          <ProduktSheet
            produkt={auswahl?.produkt ?? null}
            onClose={schliesseKarte}
            // Die Szene bleibt bedienbar: Ein Tipp auf ein anderes Produkt
            // wechselt die Karte, ein Tipp daneben schließt sie (onTreffer).
            hintergrundSchliesst={false}
            // Nach einem Tipp ins Bild bleibt der Fokus in der Szene
            // (Pfeiltasten, +/-); die Status-Region sagt die Karte an.
            fokus={auswahl?.quelle !== 'tipp'}
            hinweis={
              auswahl && nichtImBild === auswahl.slot
                ? NICHT_IM_BILD_TEXT
                : undefined
            }
          />
          <AllesHierListe
            offen={listeOffen}
            eintraege={eintraege}
            blickpunktName={blickpunkt.name}
            onSelect={waehleAusListe}
            onClose={() => setListeOffen(false)}
            leerText={
              daten
                ? undefined
                : datenFehler
                ? DATEN_FEHLER_TEXT
                : DATEN_LADEN_TEXT
            }
          />
        </>
      )}

      {/* Derselbe Inhalt als Text neben der laufenden 3D-Ansicht: der Weg
          für Screenreader. */}
      {zeigtSzene && daten && (
        <OhneWebGL
          variante="screenreader"
          blickpunkte={[...blickpunkte]}
          eintraegeJe={eintraegeJe}
        />
      )}

      {zustand === 'laden' && <Ladebild fortschritt={fortschritt} />}

      {/* Die Status-Region steht immer im DOM, damit Screenreader den später
          eingesetzten Text auch ansagen. */}
      <Box
        role="status"
        data-testid="status"
        sx={
          meldung
            ? {
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                p: 2,
              }
            : UNSICHTBAR
        }
      >
        {meldung ? (
          <Paper
            elevation={3}
            sx={{ width: 'min(100%, 360px)', p: 2.5, textAlign: 'center' }}
          >
            <Typography component="p">{meldung}</Typography>
            {zustand !== 'kein-webgl' && (
              <Button variant="contained" onClick={nochmal} sx={{ mt: 2 }}>
                {zustand === 'fehler' ? NOCHMAL_TEXT : 'Neu laden'}
              </Button>
            )}
          </Paper>
        ) : (
          ansage
        )}
      </Box>
    </Box>
  )
}
