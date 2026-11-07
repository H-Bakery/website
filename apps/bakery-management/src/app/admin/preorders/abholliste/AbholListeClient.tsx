'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  GlobalStyles,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AddCircleOutline as NewIcon,
  CheckCircle as HandoverIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Clear as ClearIcon,
  DoNotDisturbOn as NotCollectedIcon,
  EventAvailable as DayEndIcon,
  Inventory2 as ReadyIcon,
  MoneyOff as UnpaidIcon,
  MoreVert as MoreIcon,
  OpenInNew as OpenIcon,
  Payments as PaidIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  Replay as ComesIcon,
  Search as SearchIcon,
  Summarize as DayIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import { useOptionalSession } from '../../../../lib/session'
import {
  clearLostActions,
  readLostActions,
  rememberLostAction,
  type LostAction,
} from '../../../../lib/lostActions'
import {
  bulkPreorderStatus,
  changePreorderStatus,
  fetchPickupPoints,
  fetchPreorderDay,
  isPreorderConflict,
  preorderErrorMessage,
  requestFailureKind,
  type RequestFailureKind,
} from '../../../../lib/preordersApi'
import {
  LADEN_PICKUP,
  canWritePreorders,
  formatCurrency,
  formatDate,
  formatDateWithWeekday,
  isBusinessDate,
  isProductionDay,
  itemName,
  owesRefund,
  paymentState,
  toBusinessDate,
  type PickupPoint,
  type Preorder,
  type PreorderDay,
  type PreorderStatusChange,
} from '../../../../lib/preordersTypes'
import {
  CANCELLED_GROUP,
  abholActions,
  abhollisteHref,
  bulkRequestFailedMessage,
  changeAlreadyApplied,
  singleRequestFailedMessage,
  defaultPickupDate,
  defaultPickupPlace,
  describeBulkResults,
  formatClock,
  groupPreorders,
  handoverStillMatches,
  isDayEndAllowed,
  isPickupPlace,
  isWaiting,
  matchesSearch,
  owesRest,
  placeLabel,
  staleListMessage,
  stepPickupDay,
  wrongWeekdayNotice,
  type AbholBulkKind,
  type AbholSort,
} from '../../../../lib/abholliste'

/** Alle so oft still neu laden, solange niemand gerade etwas tut. */
const REFRESH_MS = 60_000

/**
 * Spaltenbreiten des Ausdrucks in mm (W4-verify r4). A4 hoch mit 12 mm Rand
 * lässt 186 mm; die Tabelle hat `table-layout: fixed`, damit kein langer
 * Name, Code oder „Rest …“ sie über den Rand schiebt - vorher maß sie
 * 744 px statt 703 und die Unterschrift fiel vom Blatt. `null` = bekommt
 * den Rest (Artikel).
 *
 * W4-verify r5: Code und Name stehen untereinander in EINER Spalte - vorher
 * blieben dem Artikel 34 mm, jede Position brach über zwei, drei Zeilen und
 * 42 Samstagsbestellungen brauchten 10 Blätter. Jetzt ~59 mm; umbrochen wird
 * an Wortgrenzen, lange Wörter mit Trennstrich (`hyphens`, `lang="de"`).
 */
export const PRINT_PAGE_WIDTH_MM = 186
export const PRINT_COLUMNS: ReadonlyArray<{
  key: string
  widthMm: number | null
}> = [
  { key: 'tick', widthMm: 8 },
  { key: 'who', widthMm: 34 },
  { key: 'items', widthMm: null },
  { key: 'sum', widthMm: 19 },
  { key: 'paid', widthMm: 25 },
  { key: 'na', widthMm: 11 },
  { key: 'sign', widthMm: 30 },
]

export const ABHOL_PRINT_CSS = {
  '.abholliste-print': { display: 'none' },
  '@media print': {
    '@page': { size: 'A4 portrait', margin: '12mm' },
    'html, body': {
      background: '#fff !important',
      color: '#000 !important',
    },
    '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
      display: 'none !important',
    },
    main: { padding: '0 !important', width: '100% !important' },
    'main > .MuiToolbar-root': { display: 'none !important' },
    '.abholliste-screen, .MuiSnackbar-root': {
      display: 'none !important',
    },
    '.abholliste-print': {
      display: 'block !important',
      color: '#000',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10pt',
    },
    '.abholliste-print h1': { fontSize: '15pt', margin: '0 0 2mm' },
    '.abholliste-print p': { margin: '0 0 3mm' },
    // Bei `collapse` ragt die halbe Außenlinie über die Tabelle hinaus -
    // auf voller Breite schnitt der Rand des Blatts sie rechts ab.
    '.abholliste-print table': {
      width: 'calc(100% - 1pt)',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
    },
    '.abholliste-print th, .abholliste-print td': {
      border: '0.5pt solid #555',
      padding: '1.5mm',
      verticalAlign: 'top',
      textAlign: 'left',
      overflowWrap: 'break-word',
      hyphens: 'auto',
    },
    '.abholliste-print th': { background: '#eee', fontWeight: 700 },
    '.abholliste-print thead': { display: 'table-header-group' },
    '.abholliste-print tr': { pageBreakInside: 'avoid' },
    // W4-verify r6: eine Gruppenzeile („12:15 Uhr“, „Storniert - Geld
    // zurückgeben“) steht nie allein unten auf dem Blatt - sie bildet mit
    // ihrer ersten Bestellung einen eigenen `tbody`, der nicht geteilt wird.
    '.abholliste-print tbody.keep': {
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    },
    '.abholliste-print .group': {
      breakAfter: 'avoid',
      pageBreakAfter: 'avoid',
    },
    '.abholliste-print .group td': {
      background: '#f3f3f3',
      fontWeight: 700,
    },
    '.abholliste-print .tick': { textAlign: 'center', fontSize: '13pt' },
    // 16 Zeichen „MO-2026-11-07-03“ in 8 pt passen in 31 mm (Spalte 34 mm
    // abzüglich Innenabstand); der Name steht darunter.
    '.abholliste-print .code': {
      fontFamily: 'monospace',
      fontSize: '8pt',
      whiteSpace: 'nowrap',
      overflowWrap: 'normal',
      hyphens: 'manual',
    },
    '.abholliste-print .num': { textAlign: 'right' },
    // Kästchen zum Ankreuzen so groß wie der Übergabe-Haken; der Text
    // daneben („Rest 9,50 €“, „37,00 € zurück“) bricht um, statt die
    // Tabelle zu verbreitern.
    '.abholliste-print .paid': { overflowWrap: 'normal' },
    '.abholliste-print .paid .box': { fontSize: '13pt' },
    '.abholliste-print th.na': { textAlign: 'center' },
    '.abholliste-print .legend': { fontSize: '9pt', marginTop: '2mm' },
    '.abholliste-print ul': { margin: 0, paddingLeft: '3.5mm' },
  },
} as const

/**
 * Druckbild A4 hoch, schwarz auf weiß. Gedruckt wird nicht der Bildschirm
 * (Karten mit großen Knöpfen), sondern eine eigene Tabelle `.abholliste-print`
 * - immer die ganze Liste des Tages, unabhängig von Suche und Filter: das
 * Blatt ist der Ersatz, wenn Tablet oder WLAN ausfallen. AppBar, Navigation
 * und Pfad fallen weg (wie in der Tagesübersicht).
 */
const printStyles = <GlobalStyles styles={ABHOL_PRINT_CSS} />

/** Touch-Ziel: mindestens 48 px hoch (Tablet an der Theke). */
const TOUCH = { minHeight: 48 } as const

/** „+ 6,40 € ohne Zahlung übergeben“ - sonst fiele der Betrag aus jeder Summe. */
/** „Übergabe“, „Zahlung“ … - für die Meldung über eine verlorene Aktion. */
function describeChange(change: PreorderStatusChange): string {
  if (change.status === 'abgeholt') {
    return change.paid ? 'Die Übergabe mit Zahlung' : 'Die Übergabe'
  }
  if (change.notCollected) return '„Nicht abgeholt“'
  if (change.paid !== undefined && change.status === undefined) {
    return 'Die Zahlung'
  }
  return 'Die Änderung'
}

/**
 * Eine Übergabe scheiterte am Versionsabgleich, weil die Bestellung
 * inzwischen storniert oder ihr Betrag geändert wurde (W4-Verifikation
 * Runde 5): was ist passiert, und was ist jetzt mit dem Geld zu tun? `null`
 * für jede andere Änderung - dann gilt der allgemeine Hinweis.
 */
export function handoverConflictAdvice(
  before: Pick<Preorder, 'total'>,
  fresh: Preorder,
  change: PreorderStatusChange
): string | null {
  const tookMoney = change.paid === true
  const cents = (n: number) => Math.round(n * 100)
  if (fresh.status === 'storniert') {
    const pay = paymentState(fresh)
    const refund =
      pay.kind === 'refund'
        ? ` Schon bezahlte ${formatCurrency(pay.amount)} zurückgeben.`
        : ''
    return `Wurde inzwischen STORNIERT - bitte NICHT übergeben.${
      tookMoney ? ' Gerade kassiertes Geld zurückgeben.' : ''
    }${refund} Bei Fragen im Laden anrufen. Es wurde nichts gespeichert.`
  }
  if (
    fresh.status === 'abgeholt' ||
    cents(fresh.total) === cents(before.total)
  ) {
    return null
  }
  const diff = (cents(fresh.total) - cents(before.total)) / 100
  const pay = paymentState(fresh)
  let money: string
  if (pay.kind === 'unpaid') {
    money = !tookMoney
      ? `${formatCurrency(fresh.total)} kassieren`
      : diff > 0
      ? `noch ${formatCurrency(diff)} kassieren (zusammen ${formatCurrency(
          fresh.total
        )})`
      : `${formatCurrency(-diff)} zurückgeben (zusammen ${formatCurrency(
          fresh.total
        )})`
  } else if (pay.kind === 'rest') {
    money = `noch ${formatCurrency(pay.amount)} kassieren`
  } else if (pay.kind === 'refund') {
    money = `${formatCurrency(pay.amount)} zurückgeben`
  } else {
    money = 'schon bezahlt'
  }
  return `Die Bestellung wurde inzwischen geändert: Betrag jetzt ${formatCurrency(
    fresh.total
  )} statt ${formatCurrency(before.total)} (${
    diff > 0 ? '+' : '−'
  }${formatCurrency(
    Math.abs(diff)
  )}). Es wurde nichts gespeichert - Artikel prüfen, ${money}, dann erneut übergeben.`
}

/**
 * Text für einen Tipp, der im Funkloch NICHT ankam (W4-Verifikation Runde 6):
 * dieselben Hinweise wie beim Konflikt im Netz - storniert (Geld zurück),
 * Betrag geändert (Rest/zurück), von jemand anderem schon übergeben
 * (Zahlung nicht erfasst) - statt für alles „erneut tippen“.
 */
export function lostActionText(
  code: string,
  before: Pick<Preorder, 'total'>,
  fresh: Preorder,
  change: PreorderStatusChange
): string {
  const back = 'Die Verbindung ist wieder da -'
  if (change.status === 'abgeholt' && fresh.status === 'abgeholt') {
    if (change.paid === true && !fresh.paid) {
      return `${code}: ${back} wurde inzwischen schon an anderer Stelle übergeben, Ihre Zahlung ist NICHT erfasst. Wenn Sie das Geld genommen haben: jetzt bei der Bestellung „Bezahlt“ tippen.`
    }
    return `${code}: ${back} wurde inzwischen schon an anderer Stelle übergeben, Ihre Übergabe ist NICHT gespeichert. Bitte prüfen, ob die Ware doppelt ausgegeben wurde.`
  }
  if (change.status === 'abgeholt') {
    const advice = handoverConflictAdvice(before, fresh, change)
    if (advice)
      return `${code}: ${back} die Übergabe ist NICHT gespeichert. ${advice}`
  }
  return `${code}: ${back} das wurde NICHT gespeichert. Bitte jetzt erneut tippen.`
}

function handedOverUnpaidNote(
  summary: { handedOverUnpaidTotal?: number } | null | undefined
): string | null {
  const amount = summary?.handedOverUnpaidTotal ?? 0
  return amount > 0
    ? `+ ${formatCurrency(amount)} ohne Zahlung übergeben`
    : null
}

/** „1 Bestellung“ / „2 Bestellungen“ bezahlt und storniert oder billiger. */
function refundNote(
  summary: { refundCount?: number } | null | undefined
): string | null {
  const n = summary?.refundCount ?? 0
  if (n <= 0) return null
  return `${n} ${n === 1 ? 'Bestellung' : 'Bestellungen'} - Geld zurückgeben`
}

function PaidChip({ preorder }: { preorder: Preorder }) {
  const payment = paymentState(preorder)
  if (payment.kind === 'rest') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={`Rest ${formatCurrency(payment.amount)} offen`}
        data-paid="rest"
      />
    )
  }
  // W4-Verifikation Runde 3: zu viel bezahlt (billiger geworden oder
  // storniert) - sonst stünde hier „Bezahlt“ und das Geld bliebe im Laden.
  if (payment.kind === 'refund') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={`Erstattung ${formatCurrency(payment.amount)} offen`}
        data-paid="erstattung"
      />
    )
  }
  return preorder.paid ? (
    <Chip
      size="small"
      color="success"
      variant="outlined"
      label="Bezahlt"
      data-paid="ja"
    />
  ) : (
    <Chip
      size="small"
      variant="outlined"
      label="Nicht bezahlt"
      data-paid="nein"
    />
  )
}

/** Spalte „Bezahlt“ des Ausdrucks: Rest und Erstattung mit Betrag. */
function printPaid(preorder: Preorder): { box: string; text: string } {
  const payment = paymentState(preorder)
  if (payment.kind === 'rest') {
    return { box: '☐', text: `Rest ${formatCurrency(payment.amount)}` }
  }
  if (payment.kind === 'refund') {
    return { box: '☐', text: `${formatCurrency(payment.amount)} zurück` }
  }
  return payment.kind === 'paid'
    ? { box: '☑', text: 'ja' }
    : { box: '☐', text: '' }
}

function PrintPaidCell({ preorder }: { preorder: Preorder }) {
  const { box, text } = printPaid(preorder)
  return (
    <td className="paid">
      <span className="box">{box}</span>
      {text ? ` ${text}` : null}
    </td>
  )
}

/** Ein Tipp ohne Antwort - offen, bis die Liste wieder lädt. */
interface UncertainAction {
  id: number
  code: string
  change: PreorderStatusChange
  text: string
  /** Betrag beim Tippen - für „Betrag jetzt X statt Y“ nach dem Funkloch. */
  total: number
}

interface Toast {
  text: string
  undo?: () => void
  /**
   * W4-Verifikation: auch Fehler und Konflikte erscheinen unten am
   * Bildschirm - die Meldung über der Liste liegt am Handy weit außer Sicht,
   * wenn weiter unten getippt wurde. Fehler bleiben stehen, bis man sie
   * schließt.
   */
  severity?: 'success' | 'info' | 'warning' | 'error'
}

type BulkKind = AbholBulkKind

/** Telefonnummer antippbar: mindestens 44 × 44 px (W4). */
const PHONE_LINK_STYLE: React.CSSProperties = {
  color: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  minWidth: 44,
  padding: '0 4px',
}

export interface AbholListeClientProps {
  initialDate?: string
  /** `laden` oder die ID einer Sammelstelle. */
  initialPlace?: string
}

/**
 * P2: Abholliste je Tag und Abholort. An der Theke (Tablet) und an der
 * Sammelstelle (Fahrer): großer Haken bei der Übergabe, bezahlt ja/nein,
 * „bereit“ beim Packen, am Tagesende „nicht abgeholt“. Jede Schreibaktion
 * schickt den geladenen `updatedAt` mit - hat ein anderes Gerät die
 * Bestellung inzwischen geändert, lädt die Liste neu statt zu überschreiben.
 */
export default function AbholListeClient({
  initialDate,
  initialPlace,
}: AbholListeClientProps) {
  const router = useRouter()
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canWrite = canWritePreorders(role)

  // Leer starten: Vorgabetag und -ort kommen aus Uhr und Sammelstellen.
  const [today, setToday] = useState('')
  const [date, setDate] = useState(initialDate ?? '')
  const [place, setPlace] = useState('')
  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [day, setDay] = useState<PreorderDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Stilles Nachladen gescheitert: die Liste bleibt, kann aber veraltet sein. */
  const [staleNotice, setStaleNotice] = useState<RequestFailureKind | null>(
    null
  )
  const [printedAt, setPrintedAt] = useState('')
  const [loadedAt, setLoadedAt] = useState('')

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<AbholSort | null>(null)
  const [hideDone, setHideDone] = useState(false)

  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Nicht gespeicherte Aktionen aus einer abgelaufenen Sitzung (siehe
  // `lib/lostActions.ts`) - bleiben stehen, bis jemand sie wegklickt.
  const [lostActions, setLostActions] = useState<LostAction[]>([])
  useEffect(() => setLostActions(readLostActions()), [])
  const [conflict, setConflict] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [handover, setHandover] = useState<Preorder | null>(null)
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    preorder: Preorder
  } | null>(null)
  const [bulk, setBulk] = useState<BulkKind | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const point = useMemo(
    () => points.find((p) => p.id === place) ?? null,
    [points, place]
  )
  // Eine deaktivierte Sammelstelle mit Bestellungen an diesem Tag bleibt
  // wählbar - sonst wären die gebuchten Bestellungen nur noch über die URL
  // erreichbar (W4-verify r4). Der Server nennt sie in `day.pickupPoints`.
  const bookedPointIds = useMemo(
    () =>
      new Set(
        (day?.pickupPoints ?? [])
          .filter((p) => p.preorderCount > 0)
          .map((p) => p.id)
      ),
    [day]
  )

  /* ---------------------------------------------------------------- *
   * Start: Uhr, Sammelstellen, Vorgaben
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const now = toBusinessDate(new Date())
    setToday(now)
    let active = true
    fetchPickupPoints()
      .then((list) => {
        if (!active) return
        setPoints(list)
        const chosen = isPickupPlace(initialPlace, list)
          ? initialPlace
          : defaultPickupPlace(role, list, initialDate ?? now)
        setPlace(chosen)
        const chosenPoint = list.find((p) => p.id === chosen) ?? null
        setDate((current) =>
          isBusinessDate(current)
            ? current
            : defaultPickupDate(now, chosenPoint)
        )
      })
      .catch((err) => {
        if (!active) return
        setPointsError(
          preorderErrorMessage(
            err,
            'Die Sammelstellen konnten nicht geladen werden.'
          )
        )
        setPlace(initialPlace ?? LADEN_PICKUP)
        setDate((current) =>
          isBusinessDate(current) ? current : defaultPickupDate(now, null)
        )
      })
    return () => {
      active = false
    }
    // Einmal beim Öffnen; danach steuern Tag und Ort die Seite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------------------------------------------------------- *
   * Laden
   * ---------------------------------------------------------------- */
  const requestRef = useRef(0)
  const dayRef = useRef<PreorderDay | null>(null)
  dayRef.current = day
  /** Zuletzt erfolgreich geladener Tag - sofort nach `await load()` lesbar. */
  const loadedDayRef = useRef<PreorderDay | null>(null)
  /**
   * Ein Tipp, dessen Ausgang offen ist (Antwort verloren, Liste nicht
   * nachladbar). Das nächste erfolgreiche Laden - z. B. wenn das WLAN
   * zurückkommt - löst ihn auf, statt die rote Meldung stehen zu lassen
   * (W4-Verifikation Runde 2).
   */
  /*
   * W4-Verifikation Runde 3: mehrere Tipps hintereinander im Funkloch - jeder
   * bleibt offen, bis die Liste wieder lädt, und jeder bekommt sein Ergebnis
   * („gespeichert“ oder „NICHT gespeichert“). Vorher hielt die Seite nur den
   * letzten, und der erste verschwand ohne Meldung.
   */
  const uncertainRef = useRef<UncertainAction[]>([])
  /** Offene und nicht gespeicherte Tipps - bleiben stehen bis „Schließen“. */
  const [openActions, setOpenActions] = useState<string[]>([])
  /**
   * Lädt den Tag. `silent`: ohne Ladeanzeige und **ohne die Liste zu
   * leeren** - scheitert es, bleibt der letzte Stand stehen und ein Hinweis
   * sagt, dass er veraltet sein kann. Liefert `true`, wenn neu geladen.
   */
  const load = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!isBusinessDate(date) || !place) return false
      const request = ++requestRef.current
      if (!silent) {
        setLoading(true)
        setLoadError(null)
      }
      try {
        const next = await fetchPreorderDay(date, place)
        if (request !== requestRef.current) return false
        loadedDayRef.current = next
        setDay(next)
        setLoadError(null)
        setStaleNotice(null)
        const open = uncertainRef.current
        if (open.length > 0) {
          uncertainRef.current = []
          const saved: string[] = []
          const lost: string[] = []
          const lostTexts: string[] = []
          for (const action of open) {
            const fresh = next.preorders.find((p) => p.id === action.id)
            if (fresh && changeAlreadyApplied(fresh, action.change)) {
              saved.push(action.code)
            } else if (fresh) {
              lost.push(action.code)
              lostTexts.push(
                lostActionText(action.code, action, fresh, action.change)
              )
            }
          }
          const openTexts = new Set(open.map((a) => a.text))
          setOpenActions((current) => [
            ...current.filter((text) => !openTexts.has(text)),
            ...lostTexts,
          ])
          const savedText =
            saved.length > 0
              ? `${saved.join(
                  ', '
                )}: Die Verbindung ist wieder da - gespeichert ist es.`
              : ''
          const generic = (code: string) =>
            `${code}: Die Verbindung ist wieder da - das wurde NICHT gespeichert. Bitte jetzt erneut tippen.`
          if (lost.length > 0) {
            // Nur wenn alle bloß „erneut tippen“ heißen, in einem Satz;
            // sonst jeder Hinweis für sich (Geld zurück, Rest, …).
            const allGeneric = lost.every(
              (code, i) => lostTexts[i] === generic(code)
            )
            setToast({
              text: [
                lost.length === 1
                  ? lostTexts[0]
                  : allGeneric
                  ? `${lost.join(
                      ', '
                    )}: Die Verbindung ist wieder da - das wurde NICHT gespeichert. Bitte jetzt erneut tippen.`
                  : lostTexts.join(' '),
                savedText,
              ]
                .filter(Boolean)
                .join(' '),
              severity: 'error',
            })
          } else if (saved.length > 0) {
            setToast({ text: savedText, severity: 'success' })
          } else {
            setToast((current) =>
              current && openTexts.has(current.text) ? null : current
            )
          }
        }
        const now = new Date()
        setPrintedAt(
          now.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        )
        setLoadedAt(
          now.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          })
        )
        return true
      } catch (err) {
        if (request !== requestRef.current) return false
        const kind: RequestFailureKind = requestFailureKind(err)
        if (silent && dayRef.current) {
          setStaleNotice(kind)
        } else {
          setDay(null)
          setStaleNotice(null)
          setLoadError(
            kind === 'offline'
              ? 'Keine Verbindung zum Server - die Abholliste konnte nicht geladen werden. Bitte WLAN prüfen.'
              : preorderErrorMessage(
                  err,
                  'Die Abholliste konnte nicht geladen werden.'
                )
          )
        }
        return false
      } finally {
        if (request === requestRef.current) setLoading(false)
      }
    },
    [date, place]
  )

  useEffect(() => {
    load()
  }, [load])

  // URL mitführen: Neuladen und „Zurück“ landen auf demselben Tag und Ort.
  useEffect(() => {
    if (!isBusinessDate(date) || !place) return
    router.replace(abhollisteHref(date, place), { scroll: false })
  }, [date, place, router])

  // Still nachladen (zweites Gerät, Fahrer), aber nicht mitten in einer Aktion.
  const quietRef = useRef(true)
  quietRef.current =
    busyId === null && handover === null && menu === null && bulk === null
  // Der Geschäftstag rollt mit: ein Tablet, das über Nacht offen bleibt,
  // bietet sonst am nächsten Morgen den Tagesabschluss für „gestern“ nicht
  // an bzw. „nicht abgeholt“ für den Abholtag nicht (W4).
  useEffect(() => {
    const refresh = () => {
      setToday(toBusinessDate(new Date()))
      if (document.visibilityState === 'visible' && quietRef.current) {
        load(true)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    // WLAN wieder da: sofort nachladen - nach einem Tipp ohne Antwort zeigt
    // erst die frische Liste, ob er gespeichert wurde.
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  /* ---------------------------------------------------------------- *
   * Aktionen
   * ---------------------------------------------------------------- */
  const replaceLocal = (updated: Preorder) => {
    setDay((current) =>
      current
        ? {
            ...current,
            preorders: current.preorders.map((p) =>
              p.id === updated.id ? updated : p
            ),
          }
        : current
    )
  }

  /** Satz nach einem Konflikt - „neu geladen“ nur, wenn es auch stimmt. */
  const afterReload = (reloaded: boolean) =>
    reloaded
      ? 'Die Liste ist neu geladen.'
      : 'Die Liste konnte nicht neu geladen werden - bitte gleich erneut versuchen.'

  /** Frischer Stand einer Bestellung nach `await load(true)`. */
  const freshOf = (id: number) =>
    loadedDayRef.current?.preorders.find((p) => p.id === id) ?? null

  /**
   * Eine Meldung je Bestellung, die stehen bleibt, bis sie weggeklickt oder
   * der Tipp wiederholt wird (W4-Verifikation Runde 5): mehrere gescheiterte
   * Übergaben hintereinander verdrängten sich vorher gegenseitig.
   */
  const keepFailure = (code: string, text: string) =>
    setOpenActions((current) => [
      ...current.filter((t) => !t.startsWith(`${code}: `)),
      text,
    ])

  const onConflict = async (
    preorder: Preorder,
    err: unknown,
    change?: PreorderStatusChange
  ) => {
    const reloaded = await load(true)
    const fresh = reloaded ? freshOf(preorder.id) : null
    // Der zweite Versuch nach einer verlorenen Antwort: schon erledigt.
    if (fresh && change && changeAlreadyApplied(fresh, change)) {
      const text = `${preorder.code}: Das ist bereits gespeichert - nichts zu tun.`
      setConflict(text)
      setToast({ text, severity: 'info' })
      return
    }
    // W4-verify r2: Übergabe mit Geld, aber jemand anders hat schon ohne
    // Zahlung übergeben - das kassierte Geld ist NICHT erfasst. Das muss
    // stehen bleiben und den nächsten Schritt nennen.
    if (
      fresh &&
      change?.status === 'abgeholt' &&
      change.paid === true &&
      fresh.status === 'abgeholt' &&
      !fresh.paid
    ) {
      const text = `${preorder.code}: Wurde inzwischen schon übergeben - die Zahlung ist NICHT erfasst. Wenn Sie das Geld genommen haben: jetzt bei der Bestellung „Bezahlt“ tippen.`
      // Einmal oben (bleibt stehen) und einmal unten, wo getippt wurde -
      // nicht zusätzlich als blauer Hinweis (W4-verify r4: dreimal derselbe
      // Text schob am Handy die Liste aus dem Bild).
      setActionError(text)
      setToast({ text, severity: 'warning' })
      return
    }
    // W4-verify r5: Übergabe, aber die Bestellung wurde inzwischen storniert
    // oder ihr Betrag geändert - sagen, was passiert ist und was jetzt mit
    // dem Geld zu tun ist, statt „erneut speichern“.
    if (fresh && change?.status === 'abgeholt') {
      const advice = handoverConflictAdvice(preorder, fresh, change)
      if (advice) {
        const text = `${preorder.code}: ${advice}`
        keepFailure(preorder.code, text)
        setToast({ text, severity: 'warning' })
        return
      }
    }
    // W4-verify r6: eine gescheiterte Übergabe muss stehen bleiben und klar
    // sagen, dass weder Übergabe noch Geld erfasst sind - ein blauer Hinweis,
    // der nach 6 s verschwindet, ließ den Fahrer glauben, es habe geklappt.
    if (change?.status === 'abgeholt') {
      const text = `${
        preorder.code
      }: Die Bestellung wurde inzwischen an anderer Stelle geändert - ${describeChange(
        change
      )} wurde NICHT gespeichert${
        change.paid === true ? ', das Geld ist NICHT erfasst' : ''
      }. Bitte die Bestellung prüfen und erneut „Übergeben“ tippen. ${afterReload(
        reloaded
      )}`
      keepFailure(preorder.code, text)
      setToast({ text, severity: 'warning' })
      return
    }
    const text = `${preorder.code}: ${preorderErrorMessage(
      err,
      'Die Bestellung wurde inzwischen geändert.'
    )} Es wurde nichts überschrieben. ${afterReload(reloaded)}`
    setConflict(text)
    setToast({ text, severity: 'info' })
  }

  const act = async (
    preorder: Preorder,
    change: PreorderStatusChange,
    text: string,
    undo?: PreorderStatusChange,
    retried = false
  ): Promise<void> => {
    setBusyId(preorder.id)
    setActionError(null)
    try {
      const updated = await changePreorderStatus(
        preorder.id,
        change,
        preorder.updatedAt
      )
      if (updated) replaceLocal(updated)
      // Ein erneuter Tipp hat geklappt: die alte „unklar“-Meldung ist erledigt.
      uncertainRef.current = uncertainRef.current.filter(
        (a) => a.id !== preorder.id
      )
      setOpenActions((current) =>
        current.filter((t) => !t.startsWith(`${preorder.code}: `))
      )
      setToast({
        text,
        undo:
          undo && updated
            ? () => {
                setToast(null)
                act(updated, undo, `${updated.code}: rückgängig gemacht.`)
              }
            : undefined,
      })
      await load(true)
    } catch (err) {
      if (isPreorderConflict(err)) {
        // W4-verify r6: ein Kollege hat die Bestellung nur „bereit“ gesetzt,
        // „nicht abgeholt“ markiert oder die Anmerkung geändert - für die
        // Übergabe zählt das nicht. Einmal mit der frischen Fassung
        // wiederholen, statt Übergabe und Geld zu verwerfen.
        if (change.status === 'abgeholt' && !retried) {
          const reloaded = await load(true)
          const fresh = reloaded ? freshOf(preorder.id) : null
          if (fresh && handoverStillMatches(preorder, fresh)) {
            return act(
              fresh,
              change,
              text,
              undo ? previousOf(fresh) : undefined,
              true
            )
          }
        }
        await onConflict(preorder, err, change)
      } else if ((err as { status?: unknown } | null)?.status === 401) {
        // Sitzung beendet (Refresh gescheitert): gleich geht es zur
        // Anmeldung. Merken, was NICHT gespeichert wurde - sonst bliebe eine
        // verlorene Übergabe unbemerkt (W4-Verifikation Runde 2).
        const text = `${preorder.code}${
          preorder.customerName ? ` (${preorder.customerName})` : ''
        }: ${describeChange(
          change
        )} wurde NICHT gespeichert - die Sitzung war abgelaufen. Bitte wiederholen.`
        rememberLostAction(
          text,
          new Date(),
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : undefined
        )
        setActionError(text)
      } else {
        const kind = requestFailureKind(err)
        if (kind === 'refused') {
          const text = `${preorder.code}: ${preorderErrorMessage(
            err,
            'Das hat nicht geklappt. Bitte erneut versuchen.'
          )}`
          keepFailure(preorder.code, text)
          setToast({ text, severity: 'error' })
        } else {
          // Keine oder eine 5xx-Antwort: die Anfrage kann trotzdem
          // angekommen sein. Erst die frische Liste sagt, was gilt.
          const reloaded = await load(true)
          const fresh = reloaded ? freshOf(preorder.id) : null
          if (fresh && changeAlreadyApplied(fresh, change)) {
            setToast({
              text: `${preorder.code}: Die Antwort ging verloren, gespeichert ist es trotzdem.`,
              severity: 'success',
            })
          } else {
            const text = `${preorder.code}: ${singleRequestFailedMessage(
              kind,
              reloaded
            )}`
            if (!reloaded) {
              uncertainRef.current = [
                ...uncertainRef.current.filter((a) => a.id !== preorder.id),
                {
                  id: preorder.id,
                  code: preorder.code,
                  change,
                  text,
                  total: preorder.total,
                },
              ]
              setOpenActions((current) => [
                ...current.filter((t) => !t.startsWith(`${preorder.code}: `)),
                text,
              ])
              const pending = uncertainRef.current.length
              setToast({
                text:
                  pending > 1
                    ? `${text} (${pending} Tipps noch unklar - siehe oben.)`
                    : text,
                severity: 'error',
              })
            } else {
              keepFailure(preorder.code, text)
              setToast({ text, severity: 'error' })
            }
          }
        }
      }
    } finally {
      setBusyId(null)
    }
  }

  /** Vorheriger Stand - für „Rückgängig“ nach dem Abhaken. */
  const previousOf = (p: Preorder): PreorderStatusChange => ({
    status: p.status,
    paid: p.paid,
    notCollected: p.notCollected,
  })

  const handOver = (preorder: Preorder, paid?: boolean) => {
    setHandover(null)
    const change: PreorderStatusChange = { status: 'abgeholt' }
    if (paid !== undefined) change.paid = paid
    const payment = paymentState(preorder)
    const what =
      paid !== true
        ? ''
        : payment.kind === 'refund'
        ? `, ${formatCurrency(payment.amount)} erstattet`
        : payment.kind === 'rest'
        ? ', Rest kassiert'
        : ' und bezahlt'
    act(
      preorder,
      change,
      `${preorder.customerName ?? preorder.code} übergeben${what}.`,
      canWrite ? previousOf(preorder) : undefined
    )
  }

  /** Eine Zeile des Ausdrucks (Abholliste auf Papier). */
  const printRow = (p: Preorder) => (
    <tr key={p.id}>
      <td className="tick">
        {p.status === 'storniert' ? '–' : p.status === 'abgeholt' ? '☑' : '☐'}
      </td>
      <td>
        <div className="code">{p.code}</div>
        {p.customerName}
        {p.customerPhone ? (
          <>
            <br />
            {p.customerPhone}
          </>
        ) : null}
        {p.notCollected ? (
          <>
            <br />
            nicht abgeholt
          </>
        ) : null}
      </td>
      <td>
        <ul>
          {p.items.map((item) => (
            <li key={`${item.productId}|${item.variant}`}>
              {item.quantity} × {itemName(item)}
            </li>
          ))}
        </ul>
        {p.note ? <em>{p.note}</em> : null}
      </td>
      <td className="num">{formatCurrency(p.total)}</td>
      {/* Zum Ankreuzen auf Papier (Kurzanleitung Fahrer):
          offen ☐, schon bezahlt ☑. */}
      <PrintPaidCell preorder={p} />
      <td className="tick">
        {p.notCollected
          ? '☑'
          : p.status === 'abgeholt' || p.status === 'storniert'
          ? ''
          : '☐'}
      </td>
      <td className="sign" />
    </tr>
  )

  const startHandover = (preorder: Preorder) => {
    // Bezahlt, Betrag stimmt, Verkauf: ein Tipp genügt (Rückgängig im
    // Hinweis). Sonst fragen - nach dem Geld (auch nach einer Erstattung,
    // W4-Verifikation Runde 3), und Fahrer können nicht zurücknehmen.
    if (paymentState(preorder).kind === 'paid' && canWrite) handOver(preorder)
    else setHandover(preorder)
  }

  /** „Erstattet“: storniert → nicht mehr bezahlt, sonst Betrag stimmt wieder. */
  const markRefunded = (preorder: Preorder) => {
    const payment = paymentState(preorder)
    const name = preorder.customerName ?? preorder.code
    act(
      preorder,
      { paid: preorder.status !== 'storniert' },
      `${name}: ${formatCurrency(payment.amount)} erstattet.`
    )
  }

  /**
   * Sammelaktion über `POST /api/preorders/bulk-status` (W4): eine
   * Transaktion, Ergebnis je Bestellung. Scheitert der Request als Ganzes,
   * ist nichts gespeichert - das sagt die Meldung, und der Dialog bleibt
   * offen zum erneuten Versuch.
   */
  const runBulk = async (kind: BulkKind, list: Preorder[]) => {
    setBulkRunning(true)
    setBulkError(null)
    setActionError(null)
    setConflict(null)
    let answer
    try {
      answer = await bulkPreorderStatus(
        list,
        kind === 'ready' ? { status: 'bereit' } : { notCollected: true }
      )
    } catch (err) {
      const failure = requestFailureKind(err)
      setBulkError(
        bulkRequestFailedMessage(
          failure,
          preorderErrorMessage(err, '') || undefined
        )
      )
      setBulkRunning(false)
      return
    }
    for (const r of answer.results) {
      if (r.result === 'ok' && r.data) replaceLocal(r.data)
    }
    setBulkRunning(false)
    setBulk(null)
    const report = describeBulkResults(
      kind,
      answer.results,
      new Map(list.map((p) => [p.id, p.code]))
    )
    if (report.done) setToast({ text: report.done })
    const reloaded = await load(true)
    if (report.problems.length > 0) {
      const changedElsewhere = answer.results.some(
        (r) => r.result === 'conflict'
      )
      setConflict(
        [
          ...report.problems,
          ...(changedElsewhere ? [afterReload(reloaded)] : []),
        ].join(' ')
      )
    }
  }

  /* ---------------------------------------------------------------- *
   * Ableitungen
   * ---------------------------------------------------------------- */
  const effectiveSort: AbholSort = sort ?? (point ? 'name' : 'zeit')
  const preorders = useMemo(() => day?.preorders ?? [], [day])
  const searching = query.trim() !== ''
  const visible = useMemo(
    () =>
      preorders.filter((p) =>
        searching
          ? matchesSearch(p, query)
          : !hideDone || (p.status !== 'abgeholt' && p.status !== 'storniert')
      ),
    [preorders, query, searching, hideDone]
  )
  const groups = useMemo(
    () =>
      groupPreorders(visible, effectiveSort, { window: point?.window ?? null }),
    [visible, effectiveSort, point]
  )
  // Stornierte stehen nicht auf dem Blatt - außer schon bezahlte: deren Geld
  // muss zurück, und das Blatt ist der Ersatz bei Ausfall (W4-verify r3).
  const printRefundCancelled = useMemo(
    () => preorders.filter((p) => p.status === 'storniert' && owesRefund(p)),
    [preorders]
  )
  const printGroups = useMemo(() => {
    const groups = groupPreorders(preorders, effectiveSort, {
      window: point?.window ?? null,
    }).filter((g) => g.key !== CANCELLED_GROUP)
    if (printRefundCancelled.length > 0) {
      groups.push({
        key: CANCELLED_GROUP,
        label: 'Storniert - Geld zurückgeben',
        preorders: printRefundCancelled,
      })
    }
    return groups
  }, [preorders, effectiveSort, point, printRefundCancelled])
  const waiting = preorders.filter((p) => isWaiting(p) && !p.anonymizedAt)
  const toReady = preorders.filter(
    (p) => p.status === 'offen' && !p.anonymizedAt
  )
  const dayEndAllowed = isDayEndAllowed(date, today)
  const cancelledCount = preorders.filter(
    (p) => p.status === 'storniert'
  ).length
  const summary = day?.summary
  const refundTotal = summary?.refundTotal ?? 0
  const weekdayNotice = wrongWeekdayNotice(date, point)
  // Auch auf Papier: eine deaktivierte Sammelstelle wird nicht mehr
  // angefahren - die gebuchten Kunden müssen verständigt werden (W4-verify r5).
  const title = `Abholliste ${placeLabel(place, points)}${
    point?.active === false ? ' (inaktiv)' : ''
  }`
  const dateLabel = isBusinessDate(date) ? formatDateWithWeekday(date) : ''
  const newHref = `/admin/preorders/neu?date=${date}${
    point ? `&pickupPointId=${encodeURIComponent(point.id)}` : ''
  }`

  const changeDate = (next: string) => {
    setQuery('')
    setDate(next)
  }

  const changePlace = (next: string) => {
    setQuery('')
    setPlace(next)
    const nextPoint = points.find((p) => p.id === next) ?? null
    if (nextPoint && today && wrongWeekdayNotice(date, nextPoint)) {
      setDate(defaultPickupDate(today, nextPoint))
    } else if (!nextPoint && isBusinessDate(date) && !isProductionDay(date)) {
      setDate(defaultPickupDate(today || date, null))
    }
  }

  /* ---------------------------------------------------------------- *
   * Darstellung
   * ---------------------------------------------------------------- */
  const renderRow = (p: Preorder) => {
    const actions = abholActions(p, role, today)
    const busy = busyId === p.id || bulkRunning
    const done = p.status === 'abgeholt'
    const cancelled = p.status === 'storniert'
    const name = p.customerName ?? p.code
    return (
      <Paper
        key={p.id}
        component="li"
        variant="outlined"
        data-testid={`abhol-${p.code}`}
        data-status={p.notCollected ? 'nicht_abgeholt' : p.status}
        sx={{
          listStyle: 'none',
          p: { xs: 1.5, sm: 2 },
          borderLeftWidth: 6,
          borderLeftColor: done
            ? 'success.main'
            : p.notCollected
            ? 'error.main'
            : cancelled
            ? 'divider'
            : p.status === 'bereit'
            ? 'primary.main'
            : 'info.main',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
            gap: { xs: 1.5, md: 2 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="baseline"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  fontSize: { xs: '1.15rem', sm: '1.3rem' },
                  fontWeight: 700,
                  textDecoration: cancelled ? 'line-through' : 'none',
                  color: cancelled ? 'text.secondary' : 'text.primary',
                  overflowWrap: 'anywhere',
                }}
              >
                {name}
              </Typography>
              <Typography
                component="span"
                sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
              >
                {p.code}
              </Typography>
              {effectiveSort === 'name' && p.pickupTime && (
                <Typography component="span" color="text.secondary">
                  {p.pickupTime} Uhr
                </Typography>
              )}
            </Stack>
            <Box
              component="ul"
              sx={{ m: 0, mt: 0.5, pl: 2.5, fontSize: '1.05rem' }}
              aria-label={`Artikel von ${name}`}
            >
              {p.items.map((item) => (
                <li key={`${item.productId}|${item.variant}`}>
                  <strong>{item.quantity} ×</strong> {itemName(item)}
                </li>
              ))}
            </Box>
            {p.note && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Anmerkung: {p.note}
              </Typography>
            )}
            {p.customerPhone && (
              <Typography variant="body2" color="text.secondary">
                Tel.{' '}
                <a
                  href={`tel:${p.customerPhone.replace(/[^\d+]/g, '')}`}
                  style={PHONE_LINK_STYLE}
                >
                  {p.customerPhone}
                </a>
              </Typography>
            )}
          </Box>

          <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
              flexWrap="wrap"
              useFlexGap
            >
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {formatCurrency(p.total)}
              </Typography>
              {(!cancelled || p.paid) && <PaidChip preorder={p} />}
              <PreorderStatusChip preorder={p} />
            </Stack>
            {done && (
              <Typography
                sx={{ fontWeight: 600, textAlign: { md: 'right' } }}
                data-testid="handover-time"
              >
                ✓ Übergeben
                {formatClock(p.pickedUpAt)
                  ? ` um ${formatClock(p.pickedUpAt)} Uhr`
                  : ''}
              </Typography>
            )}
            {cancelled && owesRefund(p) && (
              <Typography
                variant="body2"
                sx={{ textAlign: { md: 'right' } }}
                data-testid="refund-hint"
              >
                Storniert, aber bezahlt:{' '}
                <strong>{formatCurrency(paymentState(p).amount)}</strong>{' '}
                zurückgeben.
                {actions.markRefunded ? '' : ' Erfassen kann das der Verkauf.'}
              </Typography>
            )}
            {cancelled && actions.markRefunded && (
              <Button
                variant="outlined"
                color="warning"
                size="large"
                startIcon={<PaidIcon />}
                onClick={() => markRefunded(p)}
                disabled={busy}
                aria-label={`${name}: Erstattung erfasst`}
                sx={{ minHeight: 56, alignSelf: { md: 'flex-end' } }}
              >
                Erstattet
              </Button>
            )}
            {!cancelled && (
              <Stack
                direction="row"
                spacing={1}
                justifyContent={{ xs: 'stretch', md: 'flex-end' }}
                // Auf 320 px passen drei Knöpfe nicht nebeneinander - dann
                // rutscht „⋮“ in die nächste Zeile statt aus dem Bild.
                flexWrap="wrap"
                useFlexGap
              >
                {actions.handover && (
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<HandoverIcon />}
                    onClick={() => startHandover(p)}
                    disabled={busy}
                    aria-label={`${name} übergeben`}
                    sx={{
                      minHeight: 56,
                      flex: { xs: '1 1 150px', md: 'none' },
                      minWidth: { xs: 0, md: 180 },
                      px: { xs: 1.5, sm: 2.75 },
                      fontSize: { xs: '1rem', sm: '1.05rem' },
                    }}
                  >
                    Übergeben
                  </Button>
                )}
                {actions.markPaid && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<PaidIcon />}
                    onClick={() =>
                      act(
                        p,
                        { paid: true },
                        owesRest(p)
                          ? `${name}: Rest kassiert.`
                          : `${name}: bezahlt.`,
                        // Rückgängig nur für den Verkauf - eine erfasste
                        // Zahlung zurücknehmen darf der Fahrer nicht (API
                        // 403 paid_undo_forbidden, W4-Verifikation Runde 2).
                        canWrite && !p.paid ? { paid: false } : undefined
                      )
                    }
                    disabled={busy}
                    aria-label={`${name}: als bezahlt markieren`}
                    sx={{
                      minHeight: 56,
                      flex: { xs: '1 1 90px', md: 'none' },
                      minWidth: 0,
                      px: { xs: 1.5, sm: 2.75 },
                      '& .MuiButton-startIcon': {
                        display: { xs: 'none', sm: 'inherit' },
                      },
                    }}
                  >
                    Bezahlt
                  </Button>
                )}
                {actions.markRefunded && (
                  <Button
                    variant="outlined"
                    color="warning"
                    size="large"
                    startIcon={<PaidIcon />}
                    onClick={() => markRefunded(p)}
                    disabled={busy}
                    aria-label={`${name}: Erstattung erfasst`}
                    sx={{
                      minHeight: 56,
                      flex: { xs: '1 1 120px', md: 'none' },
                      minWidth: 0,
                      px: { xs: 1.5, sm: 2.75 },
                      '& .MuiButton-startIcon': {
                        display: { xs: 'none', sm: 'inherit' },
                      },
                    }}
                  >
                    Erstattet
                  </Button>
                )}
                {
                  <Tooltip title="Weitere Aktionen">
                    <span>
                      <IconButton
                        aria-label={`Weitere Aktionen für ${name}`}
                        onClick={(event) =>
                          setMenu({ anchor: event.currentTarget, preorder: p })
                        }
                        disabled={busy}
                        sx={{
                          width: 56,
                          height: 56,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      >
                        {busy ? <CircularProgress size={22} /> : <MoreIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                }
              </Stack>
            )}
          </Stack>
        </Box>
      </Paper>
    )
  }

  const handoverPayment = handover ? paymentState(handover) : null
  const menuPreorder = menu?.preorder ?? null
  const menuActions = menuPreorder
    ? abholActions(menuPreorder, role, today)
    : null
  const menuName = menuPreorder?.customerName ?? menuPreorder?.code ?? ''
  const closeMenu = () => setMenu(null)

  const address =
    point && point.street
      ? [point.street, [point.zip, point.city].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ')
      : ''
  const figures: KeyFigure[] = summary
    ? [
        {
          label: 'Übergeben',
          value: `${summary.byStatus.abgeholt} von ${summary.count}`,
          'data-testid': 'figure-handed-over',
        },
        {
          label: 'Warten noch',
          value: String(waiting.length),
          hint:
            refundTotal > 0 && summary.notCollected > 0
              ? `${summary.notCollected} nicht abgeholt`
              : undefined,
        },
        {
          label: 'Noch zu kassieren',
          value: formatCurrency(summary.unpaidTotal),
          tone: summary.unpaidTotal > 0 ? 'warning' : 'default',
          hint: handedOverUnpaidNote(summary) ?? undefined,
        },
        refundTotal > 0
          ? {
              label: 'Zu erstatten',
              value: formatCurrency(refundTotal),
              tone: 'warning',
              hint: refundNote(summary) ?? undefined,
            }
          : {
              label: 'Nicht abgeholt',
              value: String(summary.notCollected),
              tone: summary.notCollected > 0 ? 'error' : 'default',
            },
      ]
    : []
  const showBulk =
    Boolean(day) &&
    (canWrite || role === 'fahrer') &&
    ((canWrite && toReady.length > 0) || waiting.length > 0)

  return (
    <Box>
      {printStyles}

      <Box className="abholliste-screen">
        <PageLayout
          title={title}
          subtitle={
            <>
              {dateLabel}
              {point?.window ? ` · Übergabe ${point.window} Uhr` : ''}
              {address && (
                <Box
                  component="span"
                  sx={{ display: { xs: 'block', sm: 'inline' } }}
                >
                  <Box
                    component="span"
                    sx={{ display: { xs: 'none', sm: 'inline' } }}
                  >
                    {' · '}
                  </Box>
                  {address}
                </Box>
              )}
            </>
          }
          actions={
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                disabled={!day}
              >
                Drucken
              </Button>
              <Button
                component={NextLink}
                href={`/admin/preorders/tag${
                  isBusinessDate(date) ? `?date=${date}` : ''
                }`}
                startIcon={<DayIcon />}
              >
                Tagesübersicht
              </Button>
            </>
          }
        >
          {/* Tag, Ort, Suche - eine Karte, am Handy ohne Leerlauf */}
          <PageSection>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'auto minmax(0, 1fr)',
                },
                alignItems: 'center',
              }}
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Vorheriger Abholtag">
                  <span>
                    <IconButton
                      aria-label="Vorheriger Abholtag"
                      onClick={() => changeDate(stepPickupDay(date, -1, point))}
                      disabled={!isBusinessDate(date)}
                    >
                      <PrevIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <TextField
                  label="Abholtag"
                  type="date"
                  size="small"
                  value={date}
                  onChange={(event) => changeDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 150, flex: 1 }}
                />
                <Tooltip title="Nächster Abholtag">
                  <span>
                    <IconButton
                      aria-label="Nächster Abholtag"
                      onClick={() => changeDate(stepPickupDay(date, 1, point))}
                      disabled={!isBusinessDate(date)}
                    >
                      <NextIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  label="Abholort"
                  size="small"
                  value={place}
                  onChange={(event) => changePlace(event.target.value)}
                  disabled={!place}
                  SelectProps={{ native: false }}
                  sx={{ flex: 1, minWidth: 0, maxWidth: { sm: 320 } }}
                >
                  <MenuItem value={LADEN_PICKUP} sx={TOUCH}>
                    Laden
                  </MenuItem>
                  {points
                    .filter(
                      (p) =>
                        p.active !== false ||
                        p.id === place ||
                        bookedPointIds.has(p.id)
                    )
                    .map((p) => (
                      <MenuItem key={p.id} value={p.id} sx={TOUCH}>
                        {p.active === false ? `${p.name} (inaktiv)` : p.name}
                      </MenuItem>
                    ))}
                </TextField>
                <Tooltip title="Aktualisieren">
                  <span>
                    <IconButton
                      aria-label="Abholliste aktualisieren"
                      onClick={() => load()}
                      disabled={loading || !place}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <TextField
                size="small"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name oder Code, z. B. „Müller“ oder „3“"
                inputProps={{ 'aria-label': 'Name oder Code suchen' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Suche leeren"
                        onClick={() => setQuery('')}
                        edge="end"
                        sx={{ width: 44, height: 44 }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                }}
                sx={{ gridColumn: { sm: '1 / -1' } }}
              />
              <Box
                sx={{
                  gridColumn: { sm: '1 / -1' },
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 2,
                  rowGap: 1,
                }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={effectiveSort}
                  onChange={(_e, value: AbholSort | null) =>
                    value && setSort(value)
                  }
                  aria-label="Sortierung"
                  sx={{ '& .MuiToggleButton-root': { minHeight: 44, px: 2 } }}
                >
                  <ToggleButton value="zeit">Nach Uhrzeit</ToggleButton>
                  <ToggleButton value="name">Nach Name</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel
                  sx={{ minHeight: 44, mr: 0 }}
                  control={
                    <Switch
                      checked={hideDone}
                      onChange={(event) => setHideDone(event.target.checked)}
                    />
                  }
                  label="Abgeholte und stornierte ausblenden"
                />
              </Box>
            </Box>
          </PageSection>

          {/* Fällt der Server ganz aus, sagt das die Fehlermeldung der Liste -
              nicht zweimal „Keine Verbindung“ untereinander. */}
          {pointsError && !loadError && (
            <Alert severity="warning">{pointsError}</Alert>
          )}
          {weekdayNotice && (
            <Alert severity="info">
              {weekdayNotice} Am {formatDate(date)} gibt es dort keine Übergabe.
            </Alert>
          )}
          {!point && isBusinessDate(date) && !isProductionDay(date) && (
            <Alert severity="info">
              Montag ist Ruhetag - im Laden wird nichts abgeholt.
            </Alert>
          )}
          {conflict && (
            <Alert severity="info" onClose={() => setConflict(null)}>
              {conflict}
            </Alert>
          )}
          {lostActions.length > 0 && (
            <Alert
              severity="error"
              data-testid="lost-actions"
              onClose={() => {
                clearLostActions()
                setLostActions([])
              }}
            >
              <AlertTitle>Nicht gespeichert</AlertTitle>
              {lostActions.map((a) => (
                <Box
                  key={a.at + a.text}
                  component="span"
                  sx={{ display: 'block' }}
                >
                  {a.text}
                </Box>
              ))}
            </Alert>
          )}
          {openActions.length > 0 && (
            <Alert
              severity="error"
              data-testid="open-actions"
              onClose={() => setOpenActions([])}
            >
              {openActions.map((text) => (
                <Box key={text} component="span" sx={{ display: 'block' }}>
                  {text}
                </Box>
              ))}
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}
          {staleNotice && !loadError && (
            <Alert
              severity="warning"
              data-testid="abholliste-stale"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => load(true)}
                  sx={TOUCH}
                >
                  Erneut laden
                </Button>
              }
            >
              {staleListMessage(staleNotice, loadedAt)}
            </Alert>
          )}
          {loadError && (
            <ErrorState message={loadError} onRetry={() => load()} />
          )}

          {summary && (
            <KeyFigures items={figures} aria-label="Stand der Übergabe" />
          )}

          {showBulk && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              {canWrite && toReady.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<ReadyIcon />}
                  onClick={() => setBulk('ready')}
                  disabled={bulkRunning}
                  sx={TOUCH}
                >
                  Alle offenen als bereit markieren ({toReady.length})
                </Button>
              )}
              {waiting.length > 0 && (
                <Tooltip
                  title={
                    dayEndAllowed
                      ? ''
                      : 'Erst am Abholtag - vorher kann noch jemand kommen.'
                  }
                >
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<DayEndIcon />}
                      onClick={() => setBulk('dayEnd')}
                      disabled={!dayEndAllowed || bulkRunning}
                      sx={{ ...TOUCH, width: { xs: '100%', sm: 'auto' } }}
                    >
                      Tagesabschluss: Rest „nicht abgeholt“ ({waiting.length})
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
          )}

          {loading && !day ? (
            <LoadingState label="Abholliste wird geladen …" />
          ) : (
            day &&
            (preorders.length === 0 ? (
              <EmptyState
                title="Für diesen Tag ist hier nichts vorbestellt."
                action={
                  canWrite ? (
                    <Button
                      component={NextLink}
                      href={newHref}
                      variant="contained"
                      startIcon={<NewIcon />}
                      sx={TOUCH}
                    >
                      Vorbestellung erfassen
                    </Button>
                  ) : undefined
                }
              />
            ) : groups.length === 0 ? (
              <EmptyState
                title={
                  searching
                    ? `Keine Bestellung zu „${query.trim()}“.`
                    : 'Alles abgeholt.'
                }
              />
            ) : (
              <Box>
                {groups.map((group) => (
                  <Box
                    key={group.key}
                    component="section"
                    aria-label={group.label}
                    sx={{ '&:not(:last-of-type)': { mb: 2.5 } }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="h2"
                      sx={{
                        fontWeight: 700,
                        mb: 1,
                        color:
                          group.key === CANCELLED_GROUP
                            ? 'text.secondary'
                            : 'text.primary',
                      }}
                    >
                      {group.label}{' '}
                      <Typography component="span" color="text.secondary">
                        · {group.preorders.length}
                      </Typography>
                    </Typography>
                    <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }}>
                      {group.preorders.map(renderRow)}
                    </Stack>
                  </Box>
                ))}
              </Box>
            ))
          )}

          {day && cancelledCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              Stornierte stehen nicht auf dem Ausdruck und zählen in keiner
              Summe - außer schon bezahlte: die stehen unter „Zu erstatten“.
            </Typography>
          )}
          {/* W4-Verifikation Runde 3: die Meldung unten (Fehler bleiben stehen)
              lag am Handy über den Knöpfen der letzten Bestellung. Solange sie
              offen ist, lässt sich die Liste so weit schieben, dass die letzte
              Karte darüber steht. */}
          {toast && (
            <Box
              aria-hidden="true"
              data-testid="toast-spacer"
              sx={{ height: { xs: 280, md: 140 } }}
            />
          )}
        </PageLayout>
      </Box>

      {/* ------------------------------ Druck ------------------------------ */}
      {day && (
        <Box className="abholliste-print" aria-hidden="true" lang="de">
          <h1>
            {title} · {dateLabel}
          </h1>
          <p>
            {summary?.count ?? 0}{' '}
            {summary?.count === 1 ? 'Bestellung' : 'Bestellungen'}
            {point?.window ? ` · Übergabe ${point.window} Uhr` : ''}
            {summary
              ? ` · noch zu kassieren ${formatCurrency(summary.unpaidTotal)}`
              : ''}
            {handedOverUnpaidNote(summary)
              ? ` (${handedOverUnpaidNote(summary)})`
              : ''}
            {refundTotal > 0
              ? ` · zu erstatten ${formatCurrency(refundTotal)}`
              : ''}
            {cancelledCount - printRefundCancelled.length > 0
              ? ` · ${
                  cancelledCount - printRefundCancelled.length
                } storniert (nicht aufgeführt)`
              : ''}
            {printedAt ? ` · Stand ${printedAt} Uhr` : ''}
          </p>
          <table>
            <colgroup>
              {PRINT_COLUMNS.map((c) => (
                <col
                  key={c.key}
                  style={c.widthMm ? { width: `${c.widthMm}mm` } : undefined}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="tick">✓</th>
                <th>Code / Name</th>
                <th>Artikel</th>
                <th className="num">Summe</th>
                <th>Bezahlt</th>
                <th className="na" title="nicht abgeholt">
                  n.&nbsp;a.
                </th>
                <th className="sign">Unterschrift</th>
              </tr>
            </thead>
            {printGroups.map((group) => {
              const header =
                printGroups.length > 1 || group.key === CANCELLED_GROUP
              const [first, ...rest] = group.preorders
              return (
                <React.Fragment key={group.key}>
                  <tbody className={header ? 'keep' : undefined}>
                    {header && (
                      <tr className="group">
                        <td colSpan={PRINT_COLUMNS.length}>
                          {group.label} ({group.preorders.length})
                        </td>
                      </tr>
                    )}
                    {first ? printRow(first) : null}
                  </tbody>
                  {rest.length > 0 && <tbody>{rest.map(printRow)}</tbody>}
                </React.Fragment>
              )
            })}
          </table>
          <p className="legend">
            Ankreuzen: ✓ = übergeben, Bezahlt ☐ = Geld erhalten (bei „Rest“ nur
            der Rest, bei „zurück“ = Geld zurückgegeben), n. a. = nicht
            abgeholt.
          </p>
        </Box>
      )}

      {/* --------------------------- Dialoge ------------------------------ */}
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={menu !== null}
        onClose={closeMenu}
      >
        {menuPreorder && menuActions?.ready && (
          <MenuItem
            sx={TOUCH}
            onClick={() => {
              closeMenu()
              act(menuPreorder, { status: 'bereit' }, `${menuName}: bereit.`, {
                status: 'offen',
              })
            }}
          >
            <ListItemIcon>
              <ReadyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Bereit (gepackt)</ListItemText>
          </MenuItem>
        )}
        {menuPreorder && menuActions?.notCollected && (
          <MenuItem
            sx={TOUCH}
            onClick={() => {
              closeMenu()
              act(
                menuPreorder,
                { notCollected: true },
                `${menuName}: nicht abgeholt.`,
                canWrite ? previousOf(menuPreorder) : undefined
              )
            }}
          >
            <ListItemIcon>
              <NotCollectedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Nicht abgeholt</ListItemText>
          </MenuItem>
        )}
        {menuPreorder && menuActions?.clearNotCollected && (
          <MenuItem
            sx={TOUCH}
            onClick={() => {
              closeMenu()
              act(
                menuPreorder,
                { status: 'bereit', notCollected: false },
                `${menuName}: wartet wieder auf Abholung.`
              )
            }}
          >
            <ListItemIcon>
              <ComesIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Kommt doch noch</ListItemText>
          </MenuItem>
        )}
        {menuPreorder && menuActions?.markUnpaid && (
          <MenuItem
            sx={TOUCH}
            onClick={() => {
              closeMenu()
              act(
                menuPreorder,
                { paid: false },
                `${menuName}: nicht bezahlt.`,
                { paid: true }
              )
            }}
          >
            <ListItemIcon>
              <UnpaidIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Als nicht bezahlt markieren</ListItemText>
          </MenuItem>
        )}
        {menuPreorder && menuActions?.undoHandover && (
          <MenuItem
            sx={TOUCH}
            onClick={() => {
              closeMenu()
              act(
                menuPreorder,
                { status: 'bereit' },
                `${menuName}: Übergabe zurückgenommen.`
              )
            }}
          >
            <ListItemIcon>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Übergabe zurücknehmen</ListItemText>
          </MenuItem>
        )}
        {menuPreorder && (
          <MenuItem
            sx={TOUCH}
            component={NextLink}
            href={`/admin/preorders/${menuPreorder.id}`}
            onClick={closeMenu}
          >
            <ListItemIcon>
              <OpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Bestellung öffnen</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={handover !== null}
        onClose={() => setHandover(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          An {handover?.customerName ?? handover?.code} übergeben?
        </DialogTitle>
        <DialogContent>
          {handover && (
            <>
              <DialogContentText component="div">
                <Box
                  component="span"
                  sx={{ fontFamily: 'monospace', display: 'block' }}
                >
                  {handover.code}
                </Box>
                <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                  {handover.items.map((item) => (
                    <li key={`${item.productId}|${item.variant}`}>
                      {item.quantity} × {itemName(item)}
                    </li>
                  ))}
                </Box>
              </DialogContentText>
              <Alert
                severity={
                  handoverPayment?.kind === 'rest' ||
                  handoverPayment?.kind === 'refund'
                    ? 'warning'
                    : handover.paid
                    ? 'success'
                    : 'info'
                }
                sx={{ mt: 2 }}
                data-testid="handover-payment"
              >
                {handoverPayment?.kind === 'rest'
                  ? `Bezahlt waren ${formatCurrency(
                      handover.paidAmount ?? 0
                    )}, die Bestellung kostet jetzt ${formatCurrency(
                      handover.total
                    )}: noch ${formatCurrency(
                      handoverPayment.amount
                    )} kassieren.`
                  : handoverPayment?.kind === 'refund'
                  ? `Bezahlt waren ${formatCurrency(
                      handover.paidAmount ?? 0
                    )}, die Bestellung kostet jetzt nur ${formatCurrency(
                      handover.total
                    )}: ${formatCurrency(
                      handoverPayment.amount
                    )} an die Kundschaft zurückgeben.`
                  : handover.paid
                  ? `Schon bezahlt (${formatCurrency(
                      handover.paidAmount ?? handover.total
                    )}).`
                  : `Noch nicht bezahlt: ${formatCurrency(
                      handover.total
                    )} kassieren.`}
              </Alert>
              {openActions
                .filter((t) => t.startsWith(`${handover.code}: `))
                .map((t) => (
                  <Alert
                    key={t}
                    severity="warning"
                    sx={{ mt: 2 }}
                    data-testid="handover-earlier-failure"
                  >
                    {t.slice(handover.code.length + 2)}
                  </Alert>
                ))}
              {!canWrite && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Zurücknehmen kann danach nur der Verkauf.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'stretch',
            gap: 1,
            px: 3,
            pb: 2,
            '& > :not(style) ~ :not(style)': { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button onClick={() => setHandover(null)} sx={TOUCH}>
            Abbrechen
          </Button>
          {handover && !handover.paid && (
            <Button
              variant="outlined"
              onClick={() => handOver(handover, false)}
              sx={TOUCH}
            >
              Ohne Zahlung übergeben
            </Button>
          )}
          {handover && owesRest(handover) && (
            <Button
              variant="outlined"
              onClick={() => handOver(handover)}
              sx={TOUCH}
            >
              Ohne Rest übergeben
            </Button>
          )}
          {handover && handoverPayment?.kind === 'refund' && (
            <Button
              variant="outlined"
              onClick={() => handOver(handover)}
              sx={TOUCH}
            >
              Ohne Erstattung übergeben
            </Button>
          )}
          {handover && (
            <Button
              variant="contained"
              color="success"
              autoFocus
              startIcon={<HandoverIcon />}
              onClick={() =>
                handOver(
                  handover,
                  handoverPayment?.kind === 'paid' ? undefined : true
                )
              }
              sx={TOUCH}
            >
              {handoverPayment?.kind === 'rest'
                ? 'Rest kassiert und übergeben'
                : handoverPayment?.kind === 'refund'
                ? 'Erstattet und übergeben'
                : handover.paid
                ? 'Übergeben'
                : 'Bezahlt und übergeben'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulk !== null}
        onClose={() => {
          if (bulkRunning) return
          setBulkError(null)
          setBulk(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {bulk === 'ready'
            ? 'Alle offenen als bereit markieren?'
            : 'Tagesabschluss: nicht abgeholt?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {bulk === 'ready'
              ? `${toReady.length} ${
                  toReady.length === 1 ? 'Bestellung ist' : 'Bestellungen sind'
                } gepackt und liegen zur Abholung bereit:`
              : `Diese ${waiting.length} ${
                  waiting.length === 1
                    ? 'Bestellung wurde'
                    : 'Bestellungen wurden'
                } am ${dateLabel} nicht abgeholt. Sie bleiben in der Liste und lassen sich weiter übergeben, falls jemand später kommt.`}
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
              {(bulk === 'ready' ? toReady : waiting).map((p) => (
                <li key={p.id}>
                  {p.customerName} ({p.code})
                </li>
              ))}
            </Box>
          </DialogContentText>
          {bulkError && (
            <Alert severity="error" sx={{ mt: 2 }} role="alert">
              {bulkError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setBulkError(null)
              setBulk(null)
            }}
            disabled={bulkRunning}
            sx={TOUCH}
          >
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              bulk && runBulk(bulk, bulk === 'ready' ? toReady : waiting)
            }
            disabled={bulkRunning}
            sx={TOUCH}
          >
            {bulkRunning
              ? 'Wird gespeichert …'
              : bulk === 'ready'
              ? 'Als bereit markieren'
              : 'Als nicht abgeholt markieren'}
          </Button>
        </DialogActions>
      </Dialog>

      {/*
        W4-verify r6: nicht über einem offenen Dialog - am 360er-Handy
        verdeckte der lange Hinweis die Übergabe-Knöpfe. Was stehen bleiben
        muss, steht im Übergabe-Dialog selbst und oben in der Liste.
      */}
      <Snackbar
        open={toast !== null && handover === null && bulk === null}
        autoHideDuration={
          toast?.severity === 'error' || toast?.severity === 'warning'
            ? null
            : 6000
        }
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setToast(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity ?? 'success'}
          variant="filled"
          onClose={() => setToast(null)}
          action={
            toast?.undo ? (
              <Button color="inherit" size="small" onClick={toast.undo}>
                Rückgängig
              </Button>
            ) : undefined
          }
          sx={{ alignItems: 'center' }}
        >
          {toast?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
