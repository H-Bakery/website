'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import {
  INTRO_ANSAGE_LADEN,
  INTRO_LABEL_LADEN,
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
  type Raum,
} from '../config/raeume'
import { BASE_PATH, modelUrl } from '../lib/basePath'
import type { Karte, ListenZeile } from '../lib/karte'
import type { BelegungDatei, ProduktSnapshot } from '../lib/produkte/types'
import { raumAusAdresse, sucheFuerRaum } from '../lib/raeume/adresse'
import {
  findeFuerKnoten,
  infoEintraegeFuer,
  infopunkteVon,
  istInfoKarte,
  karteVon,
  ladeRauminfos,
  type Rauminfos,
} from '../lib/raeume/rauminfos'
import { VERFUEGBARE_RAEUME, modellBytes } from '../lib/raeume/verfuegbar'
import {
  LEERER_MODELL_INDEX,
  ladeModellIndex,
  modellAdresse,
  modellFuer,
  type ProduktModellIndex,
} from '../lib/produkte/modelle'
import {
  entdeckbare,
  entdecktText,
  merkeEntdeckt,
  zaehleEntdeckt,
} from '../lib/produkte/entdeckt'
import {
  belegungVon,
  eintraegeFuer,
  ladeProduktdaten,
} from '../lib/produkte/zuordnung'
import type { Treffer, ViewerReadyInfo } from '../lib/scene/createViewer'
import AllesHierListe from './AllesHierListe'
import BlickpunktLeiste from './BlickpunktLeiste'
import Hinweis from './Hinweis'
import IntroKnopf from './IntroKnopf'
import Ladebild from './Ladebild'
import { ladeViewer, type ViewerKomponente } from './ladeViewer'
import Nahansicht from './Nahansicht'
import OhneWebGL, {
  OHNE_WEBGL_TEXT,
  OHNE_WEBGL_ZUSATZ,
  type RaumListen,
} from './OhneWebGL'
import { KEINE_INFOS_TEXT } from './produktliste'
import ProduktSheet from './ProduktSheet'
import { SCENE_BACKDROP } from './theme'

export const TITEL = 'Digitale Bäckerei'
export const FEHLER_TEXT =
  'Der Laden konnte nicht geladen werden. Prüf deine Verbindung und versuch es noch einmal.'
export const UNTERBROCHEN_TEXT =
  'Die 3D-Ansicht wurde unterbrochen. Du kannst sie neu laden.'
/** Ein anderer Raum als der Laden ließ sich nicht laden. */
export const RAUM_FEHLER_TEXT =
  'Der Raum konnte nicht geladen werden. Prüf deine Verbindung und versuch es noch einmal.'
export const BEREIT_TEXT = 'Der Laden ist geladen. Du stehst an der Theke.'
/** Ansage, wenn ein anderer Raum als der Laden geladen ist. */
export const raumBereitText = (raum: string, blickpunkt: string) =>
  `${raum} ist geladen. Blickpunkt ${blickpunkt}.`
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
/**
 * Ansage für Screenreader und Name des Canvas, solange der Flug zum Start des
 * Ladens läuft (danach: „Blickpunkt Theke“). Die Texte stehen am Flug in
 * raeume.ts; ein Flug ohne eigene bekommt die allgemeinen.
 */
export const INTRO_ANSAGE = INTRO_ANSAGE_LADEN
export const INTRO_LABEL = INTRO_LABEL_LADEN
export const INTRO_ANSAGE_ALLGEMEIN =
  'Kurzer Flug zum Start. Überspringen möglich.'
export const INTRO_LABEL_ALLGEMEIN = '3D-Ansicht der Bäckerei, Flug zum Start'

/** Ansage für Screenreader nach einem Wechsel. */
export const blickpunktAnsage = (name: string) => `Blickpunkt ${name}.`
/** Ansage, wenn ein Tipp ins Bild eine Karte geöffnet hat (der Fokus bleibt in der Szene). */
export const kartenAnsage = (name: string) => `Infos zu ${name} geöffnet.`

/** So lange steht der Hinweis an einem Blickpunkt ohne Produktinfos. */
export const KEINE_INFOS_MS = 7000

type Zustand = 'laden' | 'bereit' | 'kein-webgl' | 'fehler' | 'unterbrochen'

interface Produktdaten {
  snapshot: ProduktSnapshot
  /** Belegung aller Räume; je Raum: `belegungVon`. */
  belegung: BelegungDatei
}

/**
 * Was gerade gewählt ist: ein Produkt und der Platz, auf dem es im Bild
 * liegt - oder ein Infopunkt und sein Knoten im Modell.
 */
interface Auswahl {
  /** Platz des Produkts bzw. Knoten des Infopunkts: wird im Bild hervorgehoben. */
  slot: string
  /** Inhalt der Karte. */
  produkt: Karte
  art: 'produkt' | 'info'
  /** `tipp`: ins Bild getippt - der Fokus bleibt in der Szene. */
  quelle: 'tipp' | 'liste'
}

/** Das Produkt, dessen 3D-Modell gerade in der Nahansicht offen ist. */
interface OffeneNahansicht {
  name: string
  url: string
  bytes: number
}

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

export interface DigitaleBaeckereiProps {
  /** Die Räume, die es gibt (Standard: die dieses Builds). Für Tests. */
  raeume?: readonly Raum[]
}

export default function DigitaleBaeckerei({
  raeume = VERFUEGBARE_RAEUME,
}: DigitaleBaeckereiProps = {}) {
  const startRaum = raumAusAdresse('', raeume, START_RAUM_ID)
  /**
   * Der Raum, in dem man steht. Die erste Ausgabe zeigt immer den Start-Raum
   * (so steht sie auch im HTML); `?raum=<id>` wird gleich danach gelesen.
   */
  const [raumId, setRaumId] = useState(startRaum?.id ?? START_RAUM_ID)
  const raum = findeRaum(raumId, raeume) ?? startRaum
  const raumRef = useRef(raumId)
  raumRef.current = raumId
  /** Beim Raumwechsel stand der Fokus auf einem Bedienelement, das dabei verschwindet. */
  const fokusNachWechsel = useRef(false)

  const [zustand, setZustand] = useState<Zustand>('laden')
  const [fortschritt, setFortschritt] = useState(0)
  /** Neuer Wert = Szene neu aufbauen („Noch einmal versuchen“). */
  const [versuch, setVersuch] = useState(0)
  /** Die nachgeladene 3D-Komponente (three.js) - nie im ersten Bundle. */
  const [Viewer3D, setViewer3D] = useState<ViewerKomponente | null>(null)
  const [aktivId, setAktivId] = useState(startRaum?.start ?? '')
  /** Erst nach einem Wechsel sagt die Status-Region den Blickpunkt an. */
  const [gewechselt, setGewechselt] = useState(false)
  const [daten, setDaten] = useState<Produktdaten | null>(null)
  const [datenFehler, setDatenFehler] = useState(false)
  /** Infopunkte der Räume; `null`, solange sie laden (danach nie ein Fehler). */
  const [rauminfos, setRauminfos] = useState<Rauminfos | null>(null)
  /** 3D-Modelle einzelner Produkte; leer = keine Nahansicht (kein Fehler). */
  const [modelle, setModelle] =
    useState<ProduktModellIndex>(LEERER_MODELL_INDEX)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  const [nahansicht, setNahansicht] = useState<OffeneNahansicht | null>(null)
  /** Platz, der sich von hier nicht ins freie Bild drehen lässt. */
  const [nichtImBild, setNichtImBild] = useState<string | null>(null)
  const [listeOffen, setListeOffen] = useState(false)
  /** Nach der ersten Bedienung verschwindet der Hinweis. */
  const [bedient, setBedient] = useState(false)
  /** Blickpunkt, an dem gerade der Hinweis „keine Infos zum Antippen“ steht. */
  const [keineInfosAn, setKeineInfosAn] = useState<string | null>(null)
  const keineInfosGezeigt = useRef(new Set<string>())
  /** Der Flug zum Start läuft: Solange gibt es nur „Überspringen“. */
  const [introLaeuft, setIntroLaeuft] = useState(false)
  /** id des Flugs, den das Modell hat (und das Gerät erlaubt Bewegung): „noch einmal ansehen“. */
  const [introId, setIntroId] = useState<string | null>(null)
  const introDa = introId !== null
  /** Räume, deren Flug in diesem Besuch schon lief - er läuft je Raum einmal. */
  const introGespielt = useRef(new Set<string>())
  /** Nach einem Flug sagt die Status-Region den Blickpunkt an. */
  const [introGesehen, setIntroGesehen] = useState(false)
  /** Zähler als Auftrag an die Szene: noch einmal zeigen / überspringen. */
  const [introNochmal, setIntroNochmal] = useState(0)
  const [introSchluss, setIntroSchluss] = useState(0)
  /**
   * Produkte, deren Karte in diesem Besuch schon offen war - nur im
   * Arbeitsspeicher, nach dem Neuladen wieder leer.
   */
  const [entdeckt, setEntdeckt] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  )

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

  // Infopunkte der Räume (Stationen der Backstube). Fehlt die Datei, gibt es
  // keine - das ist kein Fehler.
  useEffect(() => {
    let aktuell = true
    ladeRauminfos(BASE_PATH).then((geladen) => {
      if (aktuell) setRauminfos(geladen)
    })
    return () => {
      aktuell = false
    }
  }, [])

  // Welche Produkte ein 3D-Modell für die Nahansicht haben. Fehlt der Index
  // oder ist er leer, gibt es den Knopf „In 3D ansehen“ einfach nicht.
  useEffect(() => {
    let aktuell = true
    ladeModellIndex(BASE_PATH).then((index) => {
      if (aktuell) setModelle(index)
    })
    return () => {
      aktuell = false
    }
  }, [])

  // Nur mit `?debug`: eine Nahansicht ohne Karte öffnen - für Modelle, deren
  // Produkt (noch) auf keinem Platz im Laden liegt.
  useEffect(() => {
    if (zustand !== 'bereit') return undefined
    const haken = window.__digitaleBaeckerei
    if (!haken) return undefined
    haken.nahansicht = (id: string) => {
      const modell = modellFuer(modelle, id)
      if (!modell) return false
      setNahansicht({
        name: daten?.snapshot.produkte[id]?.name ?? id,
        url: modellAdresse(modell, BASE_PATH),
        bytes: modell.bytes,
      })
      return true
    }
    return () => {
      delete haken.nahansicht
    }
  }, [zustand, modelle, daten])

  const blickpunkte = useMemo(() => raum?.blickpunkte ?? [], [raum])
  const blickpunkt = raum && findeBlickpunkt(raum, aktivId)

  /**
   * Die Listen aller Räume - der eine Weg der Daten je Raum: je Blickpunkt
   * erst die Produkte (nur in Räumen mit `produkte`: Belegung des Raums +
   * Snapshot, nur was der Snapshot kennt), dann die Infopunkte des Raums.
   * Daraus leben „Alles hier“, der Ersatz ohne WebGL und die Liste für
   * Screenreader.
   */
  const listen = useMemo<RaumListen[]>(
    () =>
      raeume.map((r) => {
        const infopunkte = rauminfos ? infopunkteVon(rauminfos, r.id) : []
        const eintraegeJe: Record<string, ListenZeile[]> = {}
        for (const b of r.blickpunkte) {
          eintraegeJe[b.id] = [
            ...(r.produkte && daten
              ? eintraegeFuer(
                  belegungVon(daten.belegung, r.id),
                  daten.snapshot,
                  b.moebel
                )
              : []),
            ...infoEintraegeFuer(infopunkte, b.moebel),
          ]
        }
        return {
          id: r.id,
          name: r.name,
          blickpunkte: r.blickpunkte,
          eintraegeJe,
          leerText: r.produkte ? undefined : KEINE_INFOS_TEXT,
        }
      }),
    [raeume, daten, rauminfos]
  )
  /** Die Liste des Raums, in dem man steht. */
  const raumListe = useMemo(
    () => listen.filter((liste) => liste.id === raum?.id),
    [listen, raum]
  )
  const eintraegeJe = raumListe[0]?.eintraegeJe

  const waehle = useCallback((neu: Auswahl | null) => {
    setAuswahl(neu)
    setNichtImBild(null)
    if (neu?.art === 'produkt') {
      setEntdeckt((vorher) => merkeEntdeckt(vorher, neu.produkt.id))
    }
  }, [])

  /**
   * In einen anderen Raum gehen: Die Szene wird mit dessen Modell neu gebaut
   * (die alte gibt dabei alles frei), man steht an seinem Start-Blickpunkt,
   * Karte, Liste und Nahansicht des alten Raums gehen zu. `neu`: als eigener
   * Schritt im Verlauf des Browsers (`?raum=<id>`), damit „Zurück“
   * zurückführt; `keiner`: die Adresse stimmt schon (Link, „Zurück“).
   */
  const betrete = useCallback(
    (id: string, verlauf: 'neu' | 'keiner') => {
      const ziel = findeRaum(id, raeume)
      if (!ziel || id === raumRef.current) return
      // Der Knopf, auf dem der Fokus steht, verschwindet mit der Leiste: Ist
      // der neue Raum da, bekommt ihn der Raumwechsel wieder.
      fokusNachWechsel.current =
        document.activeElement !== null &&
        document.activeElement !== document.body
      if (verlauf === 'neu') {
        try {
          const { pathname, search, hash } = window.location
          window.history.pushState(
            null,
            '',
            `${pathname}${sucheFuerRaum(search, id, START_RAUM_ID)}${hash}`
          )
        } catch {
          /* ohne Verlauf: der Wechsel gilt trotzdem */
        }
      }
      raumRef.current = id
      setRaumId(id)
      setAktivId(ziel.start)
      setGewechselt(false)
      setIntroGesehen(false)
      setIntroLaeuft(false)
      setIntroId(null)
      waehle(null)
      setListeOffen(false)
      setNahansicht(null)
      setKeineInfosAn(null)
      setFortschritt(0)
      // Ohne WebGL gibt es keine Szene zu laden - die Liste zeigt alle Räume.
      setZustand((vorher) => (vorher === 'kein-webgl' ? vorher : 'laden'))
      setVersuch((n) => n + 1)
    },
    [raeume, waehle]
  )

  // Der Raum aus der Adresse: beim Start (`?raum=<id>`) und bei „Zurück“ /
  // „Vor“ im Browser. Nichts davon wird auf dem Gerät gespeichert.
  useEffect(() => {
    const ausAdresse = () => {
      const ziel = raumAusAdresse(window.location.search, raeume, START_RAUM_ID)
      if (ziel) betrete(ziel.id, 'keiner')
    }
    ausAdresse()
    window.addEventListener('popstate', ausAdresse)
    return () => window.removeEventListener('popstate', ausAdresse)
  }, [raeume, betrete])

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
  const onReady = useCallback((info?: ViewerReadyInfo) => {
    setZustand('bereit')
    setIntroId(info?.intro?.id ?? null)
    // Der Flug läuft je Raum einmal: Wer zurückkommt, steht gleich am Blickpunkt.
    if (info?.intro?.laeuft) introGespielt.current.add(raumRef.current)
  }, [])
  const onIntro = useCallback((laeuft: boolean) => {
    setIntroLaeuft(laeuft)
    if (!laeuft) setIntroGesehen(true)
  }, [])
  const onUnavailable = useCallback(() => setZustand('kein-webgl'), [])
  const onError = useCallback(() => {
    setIntroLaeuft(false)
    setZustand('fehler')
  }, [])
  const onLost = useCallback(() => {
    setIntroLaeuft(false)
    setZustand('unterbrochen')
  }, [])
  const onErsteGeste = useCallback(() => setBedient(true), [])
  const onAuswahlImBild = useCallback(
    (slot: string, imBild: boolean) =>
      setNichtImBild((vorher) =>
        imBild ? (vorher === slot ? null : vorher) : slot
      ),
    []
  )

  /**
   * Tipp ins Bild. Eine Karte gibt es für ein Produkt, das der Snapshot kennt
   * (in Räumen mit Produkten), und für ein Stück des Modells mit Infopunkt.
   * Eine Tür führt in ihren Raum. Alles andere (neutrale Ware, Möbel, Wand,
   * unbekanntes Produkt) schließt die Karte und nimmt die Hervorhebung weg.
   */
  const onTreffer = useCallback(
    (treffer: Treffer | null) => {
      setKeineInfosAn(null)
      if (!treffer || !raum) {
        waehle(null)
        return
      }
      const id = treffer.produkt
      const produkt =
        raum.produkte &&
        id &&
        daten &&
        Object.prototype.hasOwnProperty.call(daten.snapshot.produkte, id)
          ? daten.snapshot.produkte[id]
          : undefined
      if (produkt) {
        waehle({ slot: treffer.slot, produkt, quelle: 'tipp', art: 'produkt' })
        return
      }
      const tuer = findeFuerKnoten(raum.tueren ?? [], treffer.slot)
      if (tuer && findeRaum(tuer.ziel, raeume)) {
        setBedient(true)
        betrete(tuer.ziel, 'neu')
        return
      }
      const punkt = rauminfos
        ? findeFuerKnoten(infopunkteVon(rauminfos, raum.id), treffer.slot)
        : undefined
      waehle(
        punkt
          ? {
              // Der ganze Infopunkt wird hervorgehoben, nicht nur das getroffene Stück.
              slot: punkt.knoten,
              produkt: karteVon(punkt),
              quelle: 'tipp',
              art: 'info',
            }
          : null
      )
    },
    [daten, rauminfos, raum, raeume, waehle, betrete]
  )

  // Solange die Nahansicht offen ist, gehört Escape ihr - die Karte bleibt.
  const nahansichtOffen = useRef(false)
  nahansichtOffen.current = nahansicht !== null
  const schliesseKarte = useCallback(() => {
    if (!nahansichtOffen.current) waehle(null)
  }, [waehle])
  const schliesseNahansicht = useCallback(() => setNahansicht(null), [])

  const nochmal = () => {
    setFortschritt(0)
    waehle(null)
    setListeOffen(false)
    setIntroLaeuft(false)
    // Wie beim ersten Laden: mit Flug, wenn der Raum einen hat.
    introGespielt.current.delete(raumId)
    setZustand('laden')
    setVersuch((n) => n + 1)
  }

  /** Der Flug zum Start, den das geladene Modell dieses Raums hergibt. */
  const flug = raum?.intros?.find((intro) => intro.id === introId)

  /** „Flug noch einmal ansehen“: zurück an sein Ziel, dann fliegt die Szene. */
  const zeigeIntroNochmal = () => {
    if (!raum) return
    wechsleZu(flug?.ziel ?? raum.start)
    setIntroNochmal((n) => n + 1)
  }

  // „Entdeckt x von y“ zählt die Produkte des Raums, in dem man steht.
  const entdecktZeile = useMemo(
    () =>
      daten && raum?.produkte
        ? entdecktText(
            zaehleEntdeckt(
              entdeckt,
              entdeckbare(belegungVon(daten.belegung, raum.id), daten.snapshot)
            )
          )
        : null,
    [daten, entdeckt, raum]
  )

  const bereit = zustand === 'bereit'
  const eintraege = useMemo(
    () => (blickpunkt ? eintraegeJe?.[blickpunkt.id] ?? [] : []),
    [blickpunkt, eintraegeJe]
  )

  // An einem Blickpunkt ohne Infos (heute: Regale) reagiert kein Tipp mit
  // einer Karte. Das einmal sagen, statt den Besucher raten zu lassen - aber
  // erst, wenn feststeht, dass es wirklich keine gibt (alles geladen).
  const ortId = `${raumId}/${aktivId}`
  const ohneInfos =
    bereit &&
    rauminfos !== null &&
    (daten !== null || raum?.produkte === false) &&
    eintraege.length === 0
  useEffect(() => {
    if (!ohneInfos || keineInfosGezeigt.current.has(ortId)) return undefined
    keineInfosGezeigt.current.add(ortId)
    setKeineInfosAn(ortId)
    const timer = setTimeout(() => setKeineInfosAn(null), KEINE_INFOS_MS)
    return () => clearTimeout(timer)
  }, [ohneInfos, ortId])

  // Nach einem Raumwechsel stünde der Fokus im Nichts (BODY) - Tastatur und
  // Screenreader fingen oben auf der Seite neu an.
  const leisteDa = bereit && !introLaeuft
  useEffect(() => {
    if (!leisteDa || !fokusNachWechsel.current) return
    fokusNachWechsel.current = false
    const aktiv = document.activeElement
    if (aktiv && aktiv !== document.body) return
    document
      .querySelector<HTMLElement>('[data-testid="raum-wechsel"]')
      ?.focus({ preventScroll: true })
  }, [leisteDa, raumId])

  const raumZiele = useMemo(
    () =>
      raeume
        .filter((r) => r.id !== raumId)
        .map(({ id, wechsel }) => ({ id, wechsel })),
    [raeume, raumId]
  )

  if (!raum || !blickpunkt) return null

  const zeigtSzene = zustand === 'laden' || bereit
  /** Mit Produktdaten bleibt bei einem Ladefehler die Liste benutzbar. */
  const fehlerMitListe = zustand === 'fehler' && daten !== null
  const imStartRaum = raum.id === START_RAUM_ID
  const fehlerText = imStartRaum ? FEHLER_TEXT : RAUM_FEHLER_TEXT

  const meldung = fehlerMitListe
    ? ''
    : zustand === 'fehler'
    ? fehlerText
    : zustand === 'unterbrochen'
    ? UNTERBROCHEN_TEXT
    : zustand === 'kein-webgl' && !daten
    ? `${OHNE_WEBGL_TEXT} ${datenFehler ? DATEN_FEHLER_TEXT : DATEN_LADEN_TEXT}`
    : ''
  const fliegt = bereit && introLaeuft
  const ansage = !bereit
    ? ''
    : fliegt
    ? flug?.ansage ?? INTRO_ANSAGE_ALLGEMEIN
    : auswahl?.quelle === 'tipp'
    ? kartenAnsage(auswahl.produkt.name)
    : gewechselt || introGesehen
    ? blickpunktAnsage(blickpunkt.name)
    : imStartRaum
    ? BEREIT_TEXT
    : raumBereitText(raum.name, blickpunkt.name)

  const waehleAusListe = (slot: string) => {
    const eintrag = eintraege.find((e) => e.slot === slot)
    setListeOffen(false)
    waehle(
      eintrag
        ? {
            slot,
            produkt: eintrag.produkt,
            quelle: 'liste',
            art: istInfoKarte(eintrag.produkt) ? 'info' : 'produkt',
          }
        : null
    )
  }

  const keineInfos = keineInfosAn === ortId && !auswahl
  // Die Nahansicht gibt es nur für Produkte.
  const auswahlModell =
    auswahl?.art === 'produkt'
      ? modellFuer(modelle, auswahl.produkt.id)
      : undefined

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
          modelBytes={modellBytes(raum)}
          blickpunkt={blickpunkt}
          fuellung={raum.fuellung}
          label={
            fliegt
              ? flug?.label ?? INTRO_LABEL_ALLGEMEIN
              : `3D-Ansicht der Bäckerei, Blickpunkt ${blickpunkt.name}`
          }
          intros={raum.intros}
          introSpielen={!introGespielt.current.has(raum.id)}
          introNochmal={introNochmal}
          introSchluss={introSchluss}
          onIntro={onIntro}
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

      {/* Ohne 3D: alle Räume untereinander - einen Wechsel gibt es dann nicht. */}
      {zustand === 'kein-webgl' && daten && <OhneWebGL raeume={listen} />}

      {fehlerMitListe && (
        <OhneWebGL
          raeume={listen}
          meldung={`${fehlerText} ${OHNE_WEBGL_ZUSATZ}`}
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

      {fliegt && <IntroKnopf onClick={() => setIntroSchluss((n) => n + 1)} />}

      {bereit && !fliegt && (
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
            onIntroNochmal={introDa ? zeigeIntroNochmal : undefined}
            raumZiele={raumZiele}
            onRaumWechsel={
              raumZiele.length > 0
                ? (id) => {
                    setBedient(true)
                    betrete(id, 'neu')
                  }
                : undefined
            }
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
            onNahansicht={
              auswahl && auswahlModell
                ? () =>
                    setNahansicht({
                      name: auswahl.produkt.name,
                      url: modellAdresse(auswahlModell, BASE_PATH),
                      bytes: auswahlModell.bytes,
                    })
                : undefined
            }
          />
          <AllesHierListe
            offen={listeOffen}
            eintraege={eintraege}
            blickpunktName={blickpunkt.name}
            onSelect={waehleAusListe}
            onClose={() => setListeOffen(false)}
            entdeckt={entdeckt}
            entdecktText={entdecktZeile}
            leerText={
              !raum.produkte
                ? KEINE_INFOS_TEXT
                : daten
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
        <OhneWebGL variante="screenreader" raeume={raumListe} />
      )}

      {nahansicht && (
        <Nahansicht
          name={nahansicht.name}
          url={nahansicht.url}
          bytes={nahansicht.bytes}
          onClose={schliesseNahansicht}
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
