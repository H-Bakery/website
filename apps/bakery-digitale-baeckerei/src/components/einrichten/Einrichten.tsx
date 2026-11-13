'use client'
/**
 * Einrichten-Modus (DB12): das lokale Werkzeug des Inhabers. Platz antippen
 * (oder aus der Liste wählen) → Produkt suchen, Stückzahl einstellen, „leer“
 * oder „wie im Modell“; die Szene zeigt jede Änderung sofort. Am Ende kommt
 * die vollständige `einrichtung.yaml` heraus (herunterladen oder kopieren) -
 * sie gehört nach `hq/config/digitale-baeckerei/einrichtung.yaml`.
 *
 * **Diese Datei gibt es nur im Einrichten-Modus** (`nx run
 * bakery-digitale-baeckerei:einrichten`, und zum Testen im Fixture-Build):
 * `DigitaleBaeckerei` lädt sie über eine Bedingung, die beim Bauen feststeht -
 * im öffentlichen Export steckt sie nicht, und der Export-Wächter prüft das
 * nach (`EINRICHTEN_SPUR`). Der Entwurf lebt nur im Arbeitsspeicher dieses
 * Tabs; gespeichert wird nichts, auch nicht auf dem Gerät.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import RemoveIcon from '@mui/icons-material/Remove'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { auslage, befundText } from '../../../scripts/auslage'
import { MAX_ANZAHL } from '../../../scripts/einrichtung'
import type { Raum } from '../../config/raeume'
import {
  berechneEntwurf,
  mitAenderung,
  ohneAenderung,
  platzName,
  type Aenderungen,
  type Eintrag,
  type Entwurf,
} from '../../lib/einrichtung/entwurf'
import type { RegalModell } from '../../lib/produkte/modelle'
import type {
  Belegung,
  BelegungDatei,
  ProduktSnapshot,
} from '../../lib/produkte/types'
import { EBENE, SEITLICH, TOUCH_TARGET, rand } from '../theme'

/**
 * Woran der Export-Wächter das Werkzeug erkennt: Dieser Text steht nur hier.
 * Taucht er in einem Export auf, ist es kein öffentlicher Build.
 */
export const EINRICHTEN_SPUR = 'Einrichtung herunterladen'
export const ZIEL_IN_HQ = 'hq/config/digitale-baeckerei/einrichtung.yaml'
export const ENTWURF_HINWEIS =
  'Dein Entwurf lebt nur in diesem Tab. Lade die Datei herunter, bevor du ihn schließt.'
export const OHNE_REGAL_TEXT = 'ohne Regal-Modell'
export const MIT_REGAL_TEXT = 'mit Regal-Modell'
export const WIE_IM_MODELL_TEXT = 'wie im Modell'

export interface EinrichtenProps {
  basePath: string
  raum: Raum
  /** Die Belegung des Builds (mit den Rahmen der Plätze). */
  gebaut: BelegungDatei
  /** Im Einrichten-Modus: alle Produkte aus hq. */
  snapshot: ProduktSnapshot
  /** Produkte mit Regal-Modell. */
  regal?: Record<string, RegalModell>
  /** Der gewählte Platz (Tipp ins Bild oder aus der Liste). */
  platz: string | null
  onPlatz: (slot: string | null) => void
  /** Der Entwurf hat sich geändert: die Belegung je Raum, wie sie jetzt gilt. */
  onEntwurf: (belegungen: Record<string, Belegung>) => void
}

const LEERE_DATEI: BelegungDatei = { version: 3, raeume: {} }
/** Suchfelder sind Touch-Ziele: mindestens 44 px hoch (MUI „small“ hat 40). */
const SUCHFELD = {
  '& .MuiInputBase-root': { minHeight: TOUCH_TARGET },
  // Das Eingabefeld selbst ist das Ziel des Tipps, nicht nur sein Rahmen.
  '& .MuiInputBase-input': { minHeight: TOUCH_TARGET, boxSizing: 'border-box' },
}
export const HQ_FEHLER_TEXT =
  'Die Einrichtung aus hq lässt sich so nicht anwenden - bitte die Datei dort korrigieren oder unter „Änderungen“ eine andere laden:'

async function ladeText(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    return res.ok ? await res.text() : ''
  } catch {
    return ''
  }
}

async function ladeModell(url: string): Promise<BelegungDatei> {
  try {
    const res = await fetch(url)
    if (!res.ok) return LEERE_DATEI
    const json = (await res.json()) as BelegungDatei
    return json && json.version === 3 && json.raeume ? json : LEERE_DATEI
  } catch {
    return LEERE_DATEI
  }
}

/** Der Text einer gewählten Datei (FileReader: läuft überall, auch in jsdom). */
const liesDatei = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const leser = new FileReader()
    leser.onload = () => resolve(String(leser.result ?? ''))
    leser.onerror = () => reject(leser.error)
    leser.readAsText(file)
  })

const eintragText = (
  eintrag: Eintrag | undefined,
  name: (id: string) => string
): string =>
  eintrag === undefined
    ? WIE_IM_MODELL_TEXT
    : eintrag === 'leer'
    ? 'leer'
    : `${eintrag.anzahl} × ${name(eintrag.produkt)}`

export default function Einrichten({
  basePath,
  raum,
  gebaut,
  snapshot,
  regal,
  platz,
  onPlatz,
  onEntwurf,
}: EinrichtenProps) {
  const titelId = useId()
  /** Die Datei aus hq, wie sie beim Start der App galt (leer: noch keine). */
  const [quelle, setQuelle] = useState<string | null>(null)
  const [modell, setModell] = useState<BelegungDatei | null>(null)
  const [aenderungen, setAenderungen] = useState<Aenderungen>({})
  const [fehler, setFehler] = useState<string | null>(null)
  /** Platz, dessen Stückzahl beim Wählen auf das angepasst wurde, was passt. */
  const [angepasst, setAngepasst] = useState<{
    slot: string
    text: string
  } | null>(null)
  const [offen, setOffen] = useState<'plaetze' | 'aenderungen' | null>(null)
  const [suche, setSuche] = useState('')
  const [platzSuche, setPlatzSuche] = useState('')
  const [kopiert, setKopiert] = useState(false)
  const datei = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let aktuell = true
    Promise.all([
      ladeText(`${basePath}/data/einrichtung.quelle.yaml`),
      ladeModell(`${basePath}/data/einrichtung.modell.json`),
    ]).then(([text, belegung]) => {
      if (!aktuell) return
      setQuelle(text)
      setModell(belegung)
    })
    return () => {
      aktuell = false
    }
  }, [basePath])

  const produkte = useMemo(
    () =>
      Object.values(snapshot.produkte).sort((a, b) =>
        a.name.localeCompare(b.name, 'de')
      ),
    [snapshot]
  )
  const name = (id: string) =>
    Object.prototype.hasOwnProperty.call(snapshot.produkte, id)
      ? snapshot.produkte[id].name
      : id

  /** Der Entwurf für einen Stand von Änderungen - wirft mit deutscher Meldung. */
  const rechne = (text: string, mit: Aenderungen, belegung: BelegungDatei) =>
    berechneEntwurf({
      quelle: text,
      aenderungen: mit,
      modell: belegung,
      gebaut,
      produkte: Object.keys(snapshot.produkte),
    })

  // Änderungen kommen nur über `setze` herein und sind dort schon geprüft -
  // der Entwurf geht darum nie an einer Eingabe verloren. Scheitern kann nur
  // die Datei aus hq selbst (z. B. ein Platz, den es im Modell nicht mehr
  // gibt); das sagt die Leiste dann.
  const [entwurf, ladeFehler] = useMemo<[Entwurf | null, string | null]>(() => {
    if (quelle === null || modell === null) return [null, null]
    try {
      return [rechne(quelle, aenderungen, modell), null]
    } catch (err) {
      return [null, err instanceof Error ? err.message : String(err)]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quelle, modell, aenderungen, gebaut, snapshot])

  const onEntwurfRef = useRef(onEntwurf)
  onEntwurfRef.current = onEntwurf
  useEffect(() => {
    if (entwurf) onEntwurfRef.current(entwurf.belegungen)
  }, [entwurf])

  const belegung = entwurf?.belegungen[raum.id]
  const plaetze = useMemo(
    () => Object.keys(belegung?.plaetze ?? {}).sort(),
    [belegung]
  )
  const imModell = (slot: string) =>
    modell?.raeume[raum.id]?.slots.find((s) => s.slot === slot)
  /** Was der Entwurf auf einem Platz zeigt - als Text. */
  const inhalt = (slot: string): string => {
    if (!belegung) return ''
    if (belegung.leer?.includes(slot)) return 'leer'
    const s = belegung.slots.find((e) => e.slot === slot)
    if (!s) return 'Ware aus dem Modell'
    return `${s.anzahl ?? 1} × ${name(s.produkt)}`
  }

  /**
   * Eine Änderung übernehmen - erst geprüft: Was die Datei ungültig machte
   * (eine Stückzahl außerhalb von 1 bis 500, ein unbekanntes Produkt), wird
   * nicht übernommen, sondern gemeldet. Der bisherige Entwurf bleibt.
   */
  const setze = (slot: string, eintrag: Eintrag | null, hinweis = '') => {
    if (quelle === null || modell === null) return
    const mit = mitAenderung(aenderungen, raum.id, slot, eintrag)
    try {
      rechne(quelle, mit, modell)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err))
      return
    }
    setFehler(null)
    setKopiert(false)
    setAngepasst(hinweis ? { slot, text: hinweis } : null)
    setAenderungen(mit)
  }

  /** So viele Stück eines Produkts passen auf den Platz (`null`: unbekannt). */
  const passenAuf = (slot: string, produkt: string, anzahl: number) => {
    const platzRahmen = belegung?.plaetze?.[slot]
    const modellFuer =
      regal && Object.prototype.hasOwnProperty.call(regal, produkt)
        ? regal[produkt]
        : null
    if (!platzRahmen || !modellFuer) return null
    return auslage(slot, platzRahmen, modellFuer.bbox_m, anzahl).gelegt
  }

  /**
   * Ein Produkt für den Platz wählen. Dasselbe Produkt behält seine
   * Stückzahl; ein neues nimmt die, die im Modell dort liegt, sonst die
   * bisherige - aber nie mehr, als auf den Platz passen: Dann wird sie
   * angepasst, und das Werkzeug sagt es.
   */
  const waehleProdukt = (slot: string, produkt: string) => {
    const bisher = belegung?.slots.find((s) => s.slot === slot)
    if (bisher?.produkt === produkt) return
    const imModellDort = imModell(slot)
    const wunsch = Math.min(
      MAX_ANZAHL,
      Math.max(
        1,
        imModellDort?.produkt === produkt
          ? imModellDort.anzahl ?? 1
          : bisher?.anzahl ?? 1
      )
    )
    const passen = passenAuf(slot, produkt, wunsch)
    if (passen !== null && passen > 0 && passen < wunsch) {
      setze(
        slot,
        { produkt, anzahl: passen },
        `Auf diesen Platz passen nur ${passen} Stück – die Stückzahl ist angepasst (vorher ${wunsch}).`
      )
      return
    }
    setze(slot, { produkt, anzahl: wunsch })
  }

  const aktuell = platz
    ? belegung?.slots.find((s) => s.slot === platz)
    : undefined
  const istLeer = !!platz && !!belegung?.leer?.includes(platz)
  const rahmen = platz ? belegung?.plaetze?.[platz] : undefined
  /** Passt die Stückzahl? Dieselbe Rechnung wie in der Szene und beim Bauen. */
  const passt = useMemo(() => {
    if (!platz || !aktuell || !rahmen || !regal) return ''
    const modellFuer = Object.prototype.hasOwnProperty.call(
      regal,
      aktuell.produkt
    )
      ? regal[aktuell.produkt]
      : null
    if (!modellFuer) {
      return 'Für dieses Produkt gibt es kein Regal-Modell: Im Bild bleibt der Platz leer, in der Liste steht es.'
    }
    const anzahl = aktuell.anzahl ?? 1
    const lage = auslage(platz, rahmen, modellFuer.bbox_m, anzahl)
    const text = befundText(lage.befund, lage.gelegt, anzahl)
    return text ? `Hinweis: ${text}.` : ''
  }, [platz, aktuell, rahmen, regal])

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de')
    return q
      ? produkte.filter(
          (p) => p.name.toLocaleLowerCase('de').includes(q) || p.id.includes(q)
        )
      : produkte
  }, [produkte, suche])

  const ladeDatei = async (file: File) => {
    const text = await liesDatei(file)
    try {
      if (!modell) throw new Error('Die App ist noch nicht bereit.')
      berechneEntwurf({
        quelle: text,
        aenderungen: {},
        modell,
        gebaut,
        produkte: Object.keys(snapshot.produkte),
      })
      setQuelle(text)
      setAenderungen({})
      setAngepasst(null)
      setFehler(null)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err))
    }
  }

  const herunterladen = () => {
    if (!entwurf) return
    const url = URL.createObjectURL(
      new Blob([entwurf.text], { type: 'text/yaml;charset=utf-8' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'einrichtung.yaml'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const kopieren = async () => {
    if (!entwurf) return
    try {
      await navigator.clipboard.writeText(entwurf.text)
      setKopiert(true)
    } catch {
      setFehler(
        'Kopieren ging nicht - markier den Text unten und kopier ihn von Hand.'
      )
    }
  }

  const anzahlAenderungen = entwurf?.aenderungen.length ?? 0
  const dialogSx = {
    '& .MuiDialog-container': {
      alignItems: 'flex-end',
      [SEITLICH]: { alignItems: 'stretch', justifyContent: 'flex-end' },
    },
    '& .MuiDialog-paper': {
      m: 0,
      width: '100%',
      maxWidth: 'none',
      maxHeight: '85dvh',
      borderRadius: '16px 16px 0 0',
      pb: 'env(safe-area-inset-bottom)',
      [SEITLICH]: {
        width: 'min(440px, 60vw)',
        maxHeight: 'none',
        borderRadius: 0,
      },
    },
  }
  const kopf = (titel: string, schliessen: () => void) => (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: 2.5, pr: 1, pt: 1 }}>
      <Typography
        id={titelId}
        component="h2"
        sx={{ flex: 1, fontSize: '1.1rem', fontWeight: 700 }}
      >
        {titel}
      </Typography>
      <IconButton
        aria-label="Schließen"
        onClick={schliessen}
        sx={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
      >
        <CloseIcon />
      </IconButton>
    </Box>
  )

  return (
    <>
      <Paper
        elevation={2}
        data-testid="einrichten-leiste"
        sx={{
          position: 'absolute',
          // Auf dem Handy unter dem Titel, sonst daneben.
          top: `calc(${rand('top')} + 52px)`,
          [SEITLICH]: { top: rand('top') },
          right: rand('right'),
          zIndex: EBENE.leiste,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          pl: 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', mr: 0.5 }}>
          Einrichten
        </Typography>
        <Button
          size="small"
          onClick={() => setOffen('plaetze')}
          sx={{ minHeight: TOUCH_TARGET }}
        >
          Plätze
        </Button>
        <Button
          size="small"
          variant="contained"
          data-testid="einrichten-aenderungen"
          onClick={() => setOffen('aenderungen')}
          sx={{ minHeight: TOUCH_TARGET }}
        >
          Änderungen ({anzahlAenderungen})
        </Button>
      </Paper>

      {ladeFehler && (
        <Paper
          elevation={3}
          role="alert"
          data-testid="einrichten-hq-fehler"
          sx={{
            position: 'absolute',
            top: `calc(${rand('top')} + 112px)`,
            right: rand('right'),
            left: rand('left'),
            zIndex: EBENE.leiste,
            p: 1.5,
            [SEITLICH]: {
              top: `calc(${rand('top')} + 60px)`,
              left: 'auto',
              width: 'min(440px, 60vw)',
            },
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
            {HQ_FEHLER_TEXT}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', overflowWrap: 'anywhere' }}>
            {ladeFehler}
          </Typography>
        </Paper>
      )}

      {platz && belegung && (
        <Paper
          elevation={6}
          role="region"
          aria-label={`Platz ${platzName(platz)} einrichten`}
          data-testid="einrichten-platz"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: EBENE.leiste + 5,
            maxHeight: '58dvh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px 16px 0 0',
            pb: 'env(safe-area-inset-bottom)',
            [SEITLICH]: {
              left: 'auto',
              top: 72,
              right: rand('right'),
              bottom: 'auto',
              width: 'min(380px, 46vw)',
              maxHeight: 'calc(100dvh - 96px)',
              borderRadius: 2,
            },
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'flex-start', pl: 2, pr: 0.5 }}
          >
            <Box sx={{ flex: 1, minWidth: 0, pt: 1.25 }}>
              <Typography
                component="h2"
                sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.25 }}
              >
                {platzName(platz)}
              </Typography>
              <Typography
                data-testid="einrichten-inhalt"
                color="text.secondary"
                sx={{ fontSize: '0.875rem' }}
              >
                {inhalt(platz)}
              </Typography>
            </Box>
            <IconButton
              aria-label="Platz schließen"
              onClick={() => onPlatz(null)}
              sx={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                aria-label="Ein Stück weniger"
                data-testid="einrichten-weniger"
                disabled={!aktuell || (aktuell.anzahl ?? 1) <= 1}
                onClick={() =>
                  aktuell &&
                  setze(platz, {
                    produkt: aktuell.produkt,
                    anzahl: Math.max(1, (aktuell.anzahl ?? 1) - 1),
                  })
                }
                sx={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
              >
                <RemoveIcon />
              </IconButton>
              <Typography
                data-testid="einrichten-anzahl"
                aria-label="Stückzahl"
                sx={{ minWidth: 36, textAlign: 'center', fontWeight: 700 }}
              >
                {aktuell ? aktuell.anzahl ?? 1 : '–'}
              </Typography>
              <IconButton
                aria-label="Ein Stück mehr"
                data-testid="einrichten-mehr"
                disabled={!aktuell || (aktuell.anzahl ?? 1) >= MAX_ANZAHL}
                onClick={() =>
                  aktuell &&
                  setze(platz, {
                    produkt: aktuell.produkt,
                    anzahl: Math.min(MAX_ANZAHL, (aktuell.anzahl ?? 1) + 1),
                  })
                }
                sx={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
              >
                <AddIcon />
              </IconButton>
            </Box>
            <Button
              variant={istLeer ? 'contained' : 'outlined'}
              data-testid="einrichten-leer"
              onClick={() => setze(platz, 'leer')}
              sx={{ minHeight: TOUCH_TARGET }}
            >
              Leer
            </Button>
            <Button
              variant="outlined"
              data-testid="einrichten-modell"
              onClick={() => setze(platz, null)}
              sx={{ minHeight: TOUCH_TARGET }}
            >
              Wie im Modell
            </Button>
          </Box>
          {angepasst?.slot === platz && (
            <Typography
              role="status"
              data-testid="einrichten-angepasst"
              sx={{ px: 2, pb: 0.5, fontSize: '0.8125rem' }}
            >
              {angepasst.text}
            </Typography>
          )}
          {passt && (
            <Typography
              data-testid="einrichten-hinweis"
              sx={{ px: 2, pb: 0.5, fontSize: '0.8125rem' }}
            >
              {passt}
            </Typography>
          )}
          {fehler && (
            <Typography
              role="alert"
              color="error"
              data-testid="einrichten-platz-fehler"
              sx={{ px: 2, pb: 0.5, fontSize: '0.8125rem' }}
            >
              {fehler}
            </Typography>
          )}

          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              label="Produkt suchen"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              inputProps={{ 'data-testid': 'einrichten-suche' }}
              sx={SUCHFELD}
            />
          </Box>
          <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain' }}>
            <List disablePadding aria-label="Produkte">
              {gefiltert.map((p) => {
                const hatRegal =
                  !!regal && Object.prototype.hasOwnProperty.call(regal, p.id)
                const gewaehlt = aktuell?.produkt === p.id
                return (
                  <ListItem key={p.id} disablePadding>
                    <ListItemButton
                      component="button"
                      selected={gewaehlt}
                      data-testid={`einrichten-produkt-${p.id}`}
                      onClick={() => waehleProdukt(platz, p.id)}
                      sx={{
                        width: '100%',
                        minHeight: 48,
                        px: 2,
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                      }}
                    >
                      <ListItemText
                        primary={p.name}
                        secondary={hatRegal ? MIT_REGAL_TEXT : OHNE_REGAL_TEXT}
                        primaryTypographyProps={{
                          sx: { fontWeight: 600, overflowWrap: 'anywhere' },
                        }}
                        sx={{ my: 0.25 }}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
              {gefiltert.length === 0 && (
                <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
                  Kein Produkt gefunden.
                </Typography>
              )}
            </List>
          </Box>
        </Paper>
      )}

      <Dialog
        open={offen === 'plaetze'}
        onClose={() => setOffen(null)}
        aria-labelledby={titelId}
        sx={dialogSx}
      >
        {kopf(`Plätze: ${raum.name}`, () => setOffen(null))}
        <Box sx={{ px: 2.5, py: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Platz suchen"
            value={platzSuche}
            onChange={(e) => setPlatzSuche(e.target.value)}
            inputProps={{ 'data-testid': 'einrichten-platzsuche' }}
            sx={SUCHFELD}
          />
        </Box>
        <Box sx={{ overflowY: 'auto', pb: 1 }}>
          <List disablePadding>
            {plaetze
              .filter((slot) => {
                const q = platzSuche.trim().toLocaleLowerCase('de')
                return (
                  !q ||
                  platzName(slot).toLocaleLowerCase('de').includes(q) ||
                  inhalt(slot).toLocaleLowerCase('de').includes(q)
                )
              })
              .map((slot) => (
                <ListItem key={slot} disablePadding>
                  <ListItemButton
                    component="button"
                    data-testid={`einrichten-waehle-${slot}`}
                    onClick={() => {
                      setOffen(null)
                      setSuche('')
                      onPlatz(slot)
                    }}
                    sx={{
                      width: '100%',
                      minHeight: 48,
                      px: 2.5,
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    <ListItemText
                      primary={platzName(slot)}
                      secondary={inhalt(slot)}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        </Box>
      </Dialog>

      <Dialog
        open={offen === 'aenderungen'}
        onClose={() => setOffen(null)}
        aria-labelledby={titelId}
        PaperProps={{ 'data-testid': 'einrichten-dialog' } as object}
        sx={dialogSx}
      >
        {kopf('Deine Änderungen', () => setOffen(null))}
        <Box sx={{ overflowY: 'auto', px: 2.5, pb: 2 }}>
          {anzahlAenderungen === 0 ? (
            <Typography color="text.secondary" sx={{ py: 1 }}>
              Noch nichts geändert. Tipp im Bild auf einen Platz oder wähl ihn
              unter „Plätze“.
            </Typography>
          ) : (
            <List disablePadding data-testid="einrichten-liste">
              {entwurf?.aenderungen.map((a) => (
                <ListItem
                  key={`${a.raum}/${a.slot}`}
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      onClick={() =>
                        setAenderungen((vorher) =>
                          ohneAenderung(vorher, a.raum, a.slot)
                        )
                      }
                      sx={{ minHeight: TOUCH_TARGET }}
                    >
                      Zurücknehmen
                    </Button>
                  }
                  sx={{ pr: 15 }}
                >
                  <ListItemText
                    primary={platzName(a.slot)}
                    secondary={`${eintragText(a.vorher, name)} → ${eintragText(
                      a.jetzt,
                      name
                    )}`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            <Button
              variant="contained"
              data-testid="einrichten-herunterladen"
              disabled={!entwurf}
              onClick={herunterladen}
              sx={{ minHeight: TOUCH_TARGET }}
            >
              {EINRICHTEN_SPUR}
            </Button>
            <Button
              variant="outlined"
              data-testid="einrichten-kopieren"
              disabled={!entwurf}
              onClick={kopieren}
              sx={{ minHeight: TOUCH_TARGET }}
            >
              {kopiert ? 'Kopiert' : 'Kopieren'}
            </Button>
            <Button
              variant="text"
              onClick={() => datei.current?.click()}
              sx={{ minHeight: TOUCH_TARGET }}
            >
              Datei laden
            </Button>
            <input
              ref={datei}
              type="file"
              accept=".yaml,.yml,text/yaml"
              hidden
              data-testid="einrichten-datei"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void ladeDatei(file)
                e.target.value = ''
              }}
            />
          </Box>
          {fehler && (
            <Typography
              role="alert"
              color="error"
              data-testid="einrichten-fehler"
              sx={{ mt: 1, fontSize: '0.875rem' }}
            >
              {fehler}
            </Typography>
          )}
          <Typography sx={{ mt: 1.5, fontSize: '0.875rem' }}>
            Die Datei gehört nach <code>{ZIEL_IN_HQ}</code>. Danach die Seite
            neu bauen - dann gilt die Einrichtung.
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mt: 0.5, fontSize: '0.8125rem' }}
          >
            {ENTWURF_HINWEIS}
          </Typography>
          <Box
            component="textarea"
            readOnly
            aria-label="einrichtung.yaml"
            data-testid="einrichten-yaml"
            value={entwurf?.text ?? ''}
            sx={{
              mt: 1.5,
              width: '100%',
              minHeight: 180,
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              color: 'text.primary',
              backgroundColor: 'action.hover',
              border: 0,
              borderRadius: 1,
              p: 1,
              resize: 'vertical',
            }}
          />
        </Box>
      </Dialog>
    </>
  )
}
