'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  Add as PlusIcon,
  Close as RemoveIcon,
  Remove as MinusIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import QuantityPad, {
  nextQuantity,
} from '../../../components/preorders/QuantityPad'
import {
  createPreorder,
  fetchCatalogue,
  fetchPickupPoints,
  fetchPreorderVariants,
  isPreorderConflict,
  listPreorders,
  preorderErrorMessage,
  requestFailureKind,
  updatePreorder,
} from '../../../lib/preordersApi'
import {
  clearPreorderDraft,
  newRequestId,
  readPreorderDraft,
  savePreorderDraft,
  type PreorderDraftFields,
} from '../../../lib/preorderDraft'
import { useOptionalSession } from '../../../lib/session'
import {
  CHANNEL_LABELS,
  ENTRY_CHANNELS,
  JS_WEEKDAY_LABELS,
  MAX_ITEMS,
  MAX_QTY_PER_ITEM,
  formatCurrency,
  formatDateWithWeekday,
  formatShortDate,
  isBusinessDate,
  isProductionDay,
  jsWeekdayOf,
  nextProductionDate,
  nextProductionDates,
  pickupPointDates,
  preorderPatch,
  shiftDate,
  toBusinessDate,
  variantLabel,
  type CatalogueProduct,
  type PickupPoint,
  type Preorder,
  type PreorderChannel,
  type PreorderInput,
} from '../../../lib/preordersTypes'
import {
  frequentProducts,
  quickProducts,
  readRecentProducts,
  rememberRecentProducts,
  searchProducts,
} from '../../../lib/productSearch'

/** Zuletzt gewählter Bestellweg auf diesem Gerät (nur Bequemlichkeit). */
export const CHANNEL_STORAGE_KEY = 'bakery-management-preorder-channel'
const DEFAULT_CHANNEL: PreorderChannel = 'telefon'

/** Wie weit „häufig vorbestellt“ zurückschaut. */
const FREQUENT_DAYS = 28

interface DraftLine {
  key: string
  productId: string
  name: string
  variant: string
  unit: string
  unitPrice: number
  quantity: number
}

interface Pending {
  product: CatalogueProduct
  variant: string
  qty: string
  /** Die erste Ziffer ersetzt die vorbelegte 1. */
  fresh: boolean
}

function lineKey(productId: string, variant: string): string {
  return `${productId}|${variant}`
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}

function readChannel(): PreorderChannel {
  try {
    const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY)
    return ENTRY_CHANNELS.includes(stored as PreorderChannel)
      ? (stored as PreorderChannel)
      : DEFAULT_CHANNEL
  } catch {
    return DEFAULT_CHANNEL
  }
}

function rememberChannel(channel: PreorderChannel): void {
  if (!ENTRY_CHANNELS.includes(channel)) return
  try {
    window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel)
  } catch {
    // nur Bequemlichkeit
  }
}

/** Touch-Chip: mindestens 44 px hoch. */
const chipSx = {
  minHeight: 44,
  fontSize: '0.95rem',
  borderRadius: 22,
  '& .MuiChip-label': { px: 1.75 },
} as const

/**
 * Sorten-Chips: Fokus als abgesetzter Ring, nicht als Flächenfarbe. MUI
 * färbt einen fokussierten Outlined-Chip grau ein - im Dunkelmodus sah die
 * erste Sorte (die nach der Produktwahl den Fokus bekommt) dann schon
 * gewählt aus, obwohl „Hinzufügen“ noch gesperrt war.
 */
const variantChipSx = {
  ...chipSx,
  '&.Mui-focusVisible, &:focus-visible': {
    outline: '3px solid',
    outlineColor: 'secondary.main',
    outlineOffset: '2px',
  },
  '&.MuiChip-outlined.Mui-focusVisible': { backgroundColor: 'transparent' },
} as const

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Typography
        variant="subtitle2"
        component="h2"
        color="text.secondary"
        sx={{ mb: 1.25, textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

export interface PreorderFormProps {
  /** Gesetzt: Bearbeiten (PATCH), sonst Erfassen (POST). */
  preorder?: Preorder
  onSaved: (preorder: Preorder) => void
  onCancel?: () => void
  /**
   * Beim Bearbeiten: der Server lehnt ab, weil die Bestellung seit dem Laden
   * an anderer Stelle geändert wurde (409 `stale_preorder`). Die Seite lädt
   * dann neu; ohne Handler steht die Meldung in der Maske.
   */
  onConflict?: (message: string, lost?: Partial<PreorderInput>) => void
  /** Vorbelegter Abholtag (z. B. aus der Tagesübersicht). */
  initialDate?: string
  /** Vorbelegte Sammelstelle. */
  initialPickupPointId?: string
}

/**
 * Die Vorbestell-Maske (P1): schnell, per Touch und per Tastatur.
 *
 * Ablauf am Telefon: Name ↵ Telefon ↵ Produkt tippen ↵ Menge ↵ … Strg+↵.
 * Auf dem Tablet: Schnellknöpfe, Sorten-Chips, Ziffernblock. Preise sind eine
 * Vorschau aus dem Sortiment; festgehalten (Snapshot) wird beim Speichern auf
 * dem Server. Geprüft wird dort ebenfalls (`delivery-preorders.core.js`) -
 * die Maske prüft nur vor, damit niemand auf eine Fehlermeldung warten muss.
 */
export default function PreorderForm({
  preorder,
  onSaved,
  onCancel,
  onConflict,
  initialDate,
  initialPickupPointId,
}: PreorderFormProps) {
  const editing = Boolean(preorder)
  const sessionUserId = useOptionalSession()?.user?.id ?? null

  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([])
  const [points, setPoints] = useState<PickupPoint[]>([])
  const [variants, setVariants] = useState<Record<string, string[]>>({})
  const [frequent, setFrequent] = useState<CatalogueProduct[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Erst im Browser aus der Uhr - sonst bricht die Hydration.
  const [today, setToday] = useState('')

  const [customerName, setCustomerName] = useState(preorder?.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(
    preorder?.customerPhone ?? ''
  )
  const [channel, setChannel] = useState<PreorderChannel>(
    preorder?.channel ?? DEFAULT_CHANNEL
  )
  const [pickupPointId, setPickupPointId] = useState(
    preorder ? preorder.pickupPointId ?? '' : initialPickupPointId ?? ''
  )
  const [pickupDate, setPickupDate] = useState(
    preorder?.pickupDate ?? (isBusinessDate(initialDate) ? initialDate : '')
  )
  const [pickupTime, setPickupTime] = useState(preorder?.pickupTime ?? '')
  const [paid, setPaid] = useState(preorder?.paid ?? false)
  const [note, setNote] = useState(preorder?.note ?? '')
  const [lines, setLines] = useState<DraftLine[]>(
    () =>
      preorder?.items.map((item) => ({
        key: lineKey(item.productId, item.variant),
        productId: item.productId,
        name: item.name,
        variant: item.variant,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })) ?? []
  )

  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pending, setPending] = useState<Pending | null>(null)
  // Das Suchfeld steht erst nach dem Rendern wieder da (statt der Menge) -
  // Fokus deshalb per Effekt, nicht direkt nach `setPending(null)`.
  const [focusSearch, setFocusSearch] = useState(0)
  useEffect(() => {
    if (focusSearch > 0) searchRef.current?.focus()
  }, [focusSearch])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  // W4-Verifikation Runde 4: Entwurf (nur Erfassen) und Kennung des
  // Speicherns - siehe `lib/preorderDraft.ts`.
  const requestIdRef = useRef<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const draftFields: PreorderDraftFields = {
    customerName,
    customerPhone,
    channel,
    pickupPointId,
    pickupDate,
    pickupTime,
    paid,
    note,
    lines,
  }
  const draftFieldsRef = useRef(draftFields)
  draftFieldsRef.current = draftFields

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const firstVariantRef = useRef<HTMLDivElement>(null)

  /* ---------------------------------------------------------------- *
   * Laden: Sortiment, Sammelstellen, Sorten; „häufig“ nebenher
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const now = toBusinessDate(new Date())
    setToday(now)
    setRecentIds(readRecentProducts())
    if (!preorder) {
      setChannel(initialPickupPointId ? 'sammelstelle' : readChannel())
      // Ein nicht gespeicherter Entwurf desselben Benutzers (Sitzung
      // abgelaufen, Seite neu geladen) kommt zurück.
      const draft = readPreorderDraft(sessionUserId)
      if (draft) {
        setCustomerName(draft.customerName)
        setCustomerPhone(draft.customerPhone)
        setChannel(draft.channel)
        setPickupPointId(draft.pickupPointId)
        setPickupDate(draft.pickupDate)
        setPickupTime(draft.pickupTime)
        setPaid(draft.paid)
        setNote(draft.note)
        setLines(draft.lines)
        requestIdRef.current = draft.requestId
        setRestoredAt(draft.savedAt)
      }
      setDraftReady(true)
    }

    let active = true
    Promise.all([
      fetchCatalogue(),
      fetchPickupPoints(),
      fetchPreorderVariants(),
    ])
      .then(([products, pointList, variantInfo]) => {
        if (!active) return
        setCatalogue(products)
        setPoints(pointList)
        setVariants(variantInfo.products)
        // „Häufig“ ist Beiwerk: scheitert es, fehlen nur die Knöpfe.
        if (!preorder) {
          listPreorders({ from: shiftDate(now, -FREQUENT_DAYS) })
            .then((list) => {
              if (active) setFrequent(frequentProducts(list, products))
            })
            .catch(() => undefined)
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(
            preorderErrorMessage(
              err,
              'Sortiment und Sammelstellen konnten nicht geladen werden.'
            )
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // Einmal beim Öffnen - die Maske bleibt bis „Nächste Bestellung“ stehen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Jede Änderung landet im Entwurf - erst nach dem Wiederherstellen, sonst
  // überschriebe die leere Maske ihn.
  useEffect(() => {
    if (editing || !draftReady) return
    savePreorderDraft(sessionUserId, draftFields, requestIdRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editing,
    draftReady,
    sessionUserId,
    customerName,
    customerPhone,
    channel,
    pickupPointId,
    pickupDate,
    pickupTime,
    paid,
    note,
    lines,
  ])

  const discardDraft = () => {
    clearPreorderDraft(sessionUserId)
    requestIdRef.current = null
    setRestoredAt(null)
    setCustomerName('')
    setCustomerPhone('')
    setPickupPointId(initialPickupPointId ?? '')
    setChannel(initialPickupPointId ? 'sammelstelle' : readChannel())
    setPickupDate(isBusinessDate(initialDate) ? initialDate : '')
    setPickupTime('')
    setPaid(false)
    setNote('')
    setLines([])
    setPending(null)
    setError(null)
    setShowErrors(false)
  }

  const point = useMemo(
    () => points.find((p) => p.id === pickupPointId) ?? null,
    [points, pickupPointId]
  )
  const activePoints = useMemo(
    () => points.filter((p) => p.active !== false || p.id === pickupPointId),
    [points, pickupPointId]
  )

  // „Sammelstelle“ ohne gefundene Stelle (veralteter Link) gibt es nicht.
  useEffect(() => {
    if (!loading && !point && channel === 'sammelstelle') {
      setChannel(readChannel())
    }
  }, [loading, point, channel])

  // Vorgabe-Abholtag, sobald Uhr und Sammelstellen bekannt sind.
  useEffect(() => {
    if (!today || pickupDate || loading) return
    if (point) {
      const [first] = pickupPointDates(point, today, 1)
      if (first) setPickupDate(first)
    } else {
      setPickupDate(nextProductionDate(today))
    }
  }, [today, pickupDate, point, loading])

  // Fokus: Name zuerst (Telefon: „Wer spricht?“).
  useEffect(() => {
    if (!editing && !loading) nameRef.current?.focus()
  }, [editing, loading])

  // Neues Produkt gewählt: Sorte zuerst, sonst gleich die Menge.
  const pendingId = pending?.product.productId
  useEffect(() => {
    if (!pendingId) return
    if ((variants[pendingId] ?? []).length > 0) firstVariantRef.current?.focus()
    else qtyRef.current?.focus()
  }, [pendingId, variants])

  /* ---------------------------------------------------------------- *
   * Abholung
   * ---------------------------------------------------------------- */
  const dateChoices = useMemo(() => {
    if (!today) return []
    return point
      ? pickupPointDates(point, today, 4)
      : nextProductionDates(today, 6)
  }, [today, point])

  const choosePickup = (id: string) => {
    if (id === pickupPointId) return
    const next = points.find((p) => p.id === id) ?? null
    setPickupPointId(id)
    if (next) {
      setChannel('sammelstelle')
      setPickupTime('')
      if (jsWeekdayOf(pickupDate) !== next.weekday && today) {
        setPickupDate(pickupPointDates(next, today, 1)[0] ?? '')
      }
    } else {
      if (channel === 'sammelstelle') setChannel(readChannel())
      if (!isProductionDay(pickupDate) && today) {
        setPickupDate(nextProductionDate(today))
      }
    }
  }

  const dateError = (() => {
    if (!isBusinessDate(pickupDate)) return 'Bitte einen Abholtag wählen.'
    if (point) {
      if (jsWeekdayOf(pickupDate) !== point.weekday) {
        return `${point.name} wird nur ${
          JS_WEEKDAY_LABELS[point.weekday] ?? 'am Liefertag'
        }s beliefert.`
      }
      return null
    }
    if (!isProductionDay(pickupDate)) {
      return 'Montag ist Ruhetag - bitte einen anderen Tag wählen.'
    }
    return null
  })()
  const datePast = Boolean(
    today && isBusinessDate(pickupDate) && pickupDate < today
  )
  /** Abholtag in der Vergangenheit, für den die Rückfrage bestätigt ist. */
  const [pastAck, setPastAck] = useState<string | null>(null)

  /* ---------------------------------------------------------------- *
   * Produkte, Sorten, Menge
   * ---------------------------------------------------------------- */
  const results = useMemo(
    () => (query.trim() ? searchProducts(catalogue, query, 8) : []),
    [catalogue, query]
  )
  const quick = useMemo(
    () => quickProducts(recentIds, frequent, catalogue, 8),
    [recentIds, frequent, catalogue]
  )

  const selectProduct = (product: CatalogueProduct) => {
    setPending({ product, variant: '', qty: '1', fresh: true })
    setQuery('')
    setHighlight(0)
    setError(null)
  }

  const pendingVariants = pending
    ? variants[pending.product.productId] ?? []
    : []
  const pendingQty = pending ? Number(pending.qty) : 0
  const needsVariant =
    pending !== null && pendingVariants.length > 0 && pending.variant === ''
  const canAdd =
    pending !== null &&
    Number.isInteger(pendingQty) &&
    pendingQty >= 1 &&
    !needsVariant

  const pressKey = useCallback((key: string) => {
    setPending((current) =>
      current
        ? {
            ...current,
            qty: nextQuantity(current.qty, key, current.fresh),
            fresh: false,
          }
        : current
    )
  }, [])

  const addPending = () => {
    if (!pending || !canAdd) return
    const key = lineKey(pending.product.productId, pending.variant)
    const existing = lines.find((line) => line.key === key)
    if (!existing && lines.length >= MAX_ITEMS) {
      setError(`Höchstens ${MAX_ITEMS} verschiedene Artikel je Bestellung.`)
      return
    }
    if (existing && existing.quantity + pendingQty > MAX_QTY_PER_ITEM) {
      setError(
        `Höchstens ${MAX_QTY_PER_ITEM} Stück je Artikel und Sorte - bitte die Menge prüfen.`
      )
      return
    }
    setLines((current) =>
      existing
        ? current.map((line) =>
            line.key === key
              ? { ...line, quantity: line.quantity + pendingQty }
              : line
          )
        : [
            ...current,
            {
              key,
              productId: pending.product.productId,
              name: pending.product.name,
              variant: pending.variant,
              unit: pending.product.unit,
              unitPrice: pending.product.price,
              quantity: pendingQty,
            },
          ]
    )
    setPending(null)
    setError(null)
    setFocusSearch((n) => n + 1)
  }

  const changeLine = (key: string, delta: number) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              quantity: Math.min(
                MAX_QTY_PER_ITEM,
                Math.max(1, line.quantity + delta)
              ),
            }
          : line
      )
    )
  }

  const removeLine = (key: string) =>
    setLines((current) => current.filter((line) => line.key !== key))

  // Bereits bezahlter Betrag einer bezahlten Bestellung (W4-Verifikation
  // Runde 2): ändert sich die Summe, sagt das Formular, was zu kassieren oder
  // zu erstatten ist - „bezahlt“ bleibt stehen, der Betrag nicht.
  const paidBefore = preorder?.paid
    ? preorder.paidAmount ?? preorder.total
    : null
  const total = roundCents(
    lines.reduce(
      (sum, line) => sum + roundCents(line.quantity * line.unitPrice),
      0
    )
  )

  /* ---------------------------------------------------------------- *
   * Speichern
   * ---------------------------------------------------------------- */
  const nameError = customerName.trim() ? null : 'Bitte den Namen eintragen.'
  const linesError =
    lines.length === 0 ? 'Bitte mindestens einen Artikel hinzufügen.' : null
  const valid = !nameError && !linesError && !dateError

  const submit = async () => {
    setShowErrors(true)
    // Eine alte Server-Meldung gilt nicht mehr, sobald neu gespeichert wird -
    // sonst stünde „Telefonnummer ungültig“ neben einem leeren Feld
    // (W4-Verifikation Runde 2).
    if (!saving) setError(null)
    if (!valid || saving) {
      if (nameError) nameRef.current?.focus()
      return
    }
    // Abholtag in der Vergangenheit (meist ein Tippfehler, 01.11. statt
    // 11.11.): die Bestellung fiele aus jeder Liste „ab heute“, aus
    // Abholliste und Backzettel. Deshalb erst nach Rückfrage speichern.
    if (
      datePast &&
      pastAck !== pickupDate &&
      (!preorder || preorder.pickupDate !== pickupDate)
    ) {
      setPastAck(pickupDate)
      setError(
        `Der Abholtag ${formatDateWithWeekday(
          pickupDate
        )} liegt in der Vergangenheit - die Bestellung erscheint dann in keiner Liste ab heute und auf keinem Backzettel. Bitte den Tag prüfen. Nur zum Nachtragen noch einmal „${
          preorder ? 'Änderungen speichern' : 'Vorbestellung speichern'
        }“ tippen.`
      )
      return
    }
    const input: PreorderInput = {
      channel,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      pickupDate,
      pickupPointId: point ? point.id : null,
      pickupTime: point ? null : pickupTime || null,
      items: lines.map((line) => ({
        productId: line.productId,
        variant: line.variant,
        quantity: line.quantity,
      })),
      paid,
      note: note.trim() || null,
    }
    if (!preorder) {
      // Eine Kennung je Bestellung, über Wiederholungen gleich: kam die
      // Antwort des ersten Versuchs nicht an, liefert der zweite dieselbe
      // Bestellung statt einer zweiten (W4-Verifikation Runde 4).
      if (!requestIdRef.current) requestIdRef.current = newRequestId()
      savePreorderDraft(
        sessionUserId,
        draftFieldsRef.current,
        requestIdRef.current
      )
      input.requestId = requestIdRef.current
    }
    setSaving(true)
    setError(null)
    let attemptedPatch: Partial<PreorderInput> | null = null
    try {
      // Beim Bearbeiten nur Geändertes, mit der geladenen Version - so
      // überschreibt eine offene Maske nie, was ein anderes Gerät inzwischen
      // gesetzt hat (übergeben, bezahlt, storniert).
      const patch = preorder ? preorderPatch(preorder, input) : null
      attemptedPatch = patch
      const saved =
        preorder && patch
          ? await updatePreorder(preorder.id, patch, preorder.updatedAt)
          : await createPreorder(input)
      rememberRecentProducts(lines.map((line) => line.productId))
      if (!point) rememberChannel(channel)
      if (!preorder) {
        clearPreorderDraft(sessionUserId)
        requestIdRef.current = null
      }
      onSaved(saved)
    } catch (err) {
      if (preorder && onConflict && isPreorderConflict(err)) {
        // Was getippt wurde, geht mit - die Seite sagt, dass es NICHT
        // gespeichert ist, und zeigt es (W4-verify r4).
        onConflict(
          preorderErrorMessage(
            err,
            'Diese Vorbestellung wurde inzwischen an anderer Stelle geändert.'
          ),
          attemptedPatch ?? undefined
        )
        return
      }
      const text = preorderErrorMessage(
        err,
        'Die Vorbestellung konnte nicht gespeichert werden.'
      )
      const kind = requestFailureKind(err)
      setError(
        !preorder && kind !== 'refused'
          ? `${text} Ob die Bestellung schon angekommen ist, ist unklar - einfach noch einmal „Vorbestellung speichern“ tippen: sie wird dabei nicht doppelt angelegt. Die Eingaben bleiben erhalten.`
          : text
      )
    } finally {
      setSaving(false)
    }
  }

  // Strg/Cmd+Enter speichert von überall in der Maske.
  const onFormKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  const onSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault()
      setHighlight((h) => Math.min(results.length - 1, h + 1))
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      results.length > 0
    ) {
      event.preventDefault()
      selectProduct(results[Math.min(highlight, results.length - 1)])
    } else if (event.key === 'Escape') {
      setQuery('')
    }
  }

  const onQtyKeyDown = (event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) return
    if (/^[0-9]$/.test(event.key) || event.key === 'Backspace') {
      event.preventDefault()
      pressKey(event.key)
    } else if (event.key === 'Delete') {
      event.preventDefault()
      pressKey('Clear')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      addPending()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setPending(null)
      setFocusSearch((n) => n + 1)
    }
  }

  const nextOnEnter =
    (target: React.RefObject<HTMLInputElement>) =>
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        target.current?.focus()
      }
    }

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
        role="status"
        aria-label="Maske wird geladen"
      >
        <CircularProgress />
      </Box>
    )
  }

  const channelChoices: PreorderChannel[] = point
    ? [...ENTRY_CHANNELS, 'sammelstelle']
    : channel === 'shop'
    ? [...ENTRY_CHANNELS, 'shop']
    : ENTRY_CHANNELS

  return (
    // Kein <form>: Enter in einem Feld soll nie versehentlich speichern -
    // gespeichert wird mit dem Knopf oder Strg+Enter.
    <Box
      role="form"
      onKeyDown={onFormKeyDown}
      aria-label={editing ? 'Vorbestellung bearbeiten' : 'Neue Vorbestellung'}
    >
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      {restoredAt && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          data-testid="preorder-draft-restored"
          action={
            <Button
              color="inherit"
              onClick={discardDraft}
              sx={{ minHeight: 44 }}
            >
              Verwerfen
            </Button>
          }
        >
          Nicht gespeicherte Eingaben von {formatClock(restoredAt)} Uhr
          wiederhergestellt - bitte prüfen und speichern.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* ---------------- links: Kunde, Weg, Abholung ---------------- */}
        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <Section title="Kunde">
              <Stack spacing={1.5}>
                <TextField
                  label="Name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  onKeyDown={nextOnEnter(phoneRef)}
                  inputRef={nameRef}
                  required
                  fullWidth
                  autoComplete="off"
                  error={showErrors && Boolean(nameError)}
                  helperText={showErrors ? nameError ?? ' ' : ' '}
                  inputProps={{ maxLength: 500 }}
                />
                <TextField
                  label="Telefon (optional)"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  onKeyDown={nextOnEnter(searchRef)}
                  inputRef={phoneRef}
                  fullWidth
                  type="tel"
                  autoComplete="off"
                  inputProps={{ maxLength: 40, inputMode: 'tel' }}
                />
              </Stack>
            </Section>

            <Section title="Bestellweg">
              <Box
                role="radiogroup"
                aria-label="Bestellweg"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {channelChoices.map((value) => (
                  <Chip
                    key={value}
                    role="radio"
                    aria-checked={channel === value}
                    label={CHANNEL_LABELS[value]}
                    color={channel === value ? 'primary' : 'default'}
                    variant={channel === value ? 'filled' : 'outlined'}
                    onClick={() => setChannel(value)}
                    sx={chipSx}
                  />
                ))}
              </Box>
            </Section>

            <Section title="Abholung">
              <Box
                role="radiogroup"
                aria-label="Abholort"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}
              >
                <Chip
                  role="radio"
                  aria-checked={!point}
                  label="Im Laden"
                  color={!point ? 'primary' : 'default'}
                  variant={!point ? 'filled' : 'outlined'}
                  onClick={() => choosePickup('')}
                  sx={chipSx}
                />
                {activePoints.map((p) => (
                  <Chip
                    key={p.id}
                    role="radio"
                    aria-checked={pickupPointId === p.id}
                    label={p.name}
                    color={pickupPointId === p.id ? 'primary' : 'default'}
                    variant={pickupPointId === p.id ? 'filled' : 'outlined'}
                    onClick={() => choosePickup(p.id)}
                    sx={chipSx}
                  />
                ))}
              </Box>

              <Box
                role="radiogroup"
                aria-label="Abholtag schnell wählen"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}
              >
                {dateChoices.map((date) => (
                  <Chip
                    key={date}
                    role="radio"
                    aria-checked={pickupDate === date}
                    label={formatShortDate(date)}
                    color={pickupDate === date ? 'primary' : 'default'}
                    variant={pickupDate === date ? 'filled' : 'outlined'}
                    onClick={() => setPickupDate(date)}
                    sx={chipSx}
                  />
                ))}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="Abholtag"
                  type="date"
                  value={pickupDate}
                  onChange={(event) => setPickupDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  error={
                    Boolean(dateError) &&
                    (showErrors || isBusinessDate(pickupDate))
                  }
                  helperText={
                    dateError && (showErrors || isBusinessDate(pickupDate))
                      ? dateError
                      : datePast
                      ? 'Liegt in der Vergangenheit - nur zum Nachtragen.'
                      : ' '
                  }
                  sx={{ flex: 1 }}
                />
                {point ? (
                  <Box sx={{ flex: 1, pt: { sm: 1 } }}>
                    <Typography variant="body2" color="text.secondary">
                      Übergabe{' '}
                      {point.window
                        ? `${point.window} Uhr`
                        : 'im Fenster der Stelle'}
                    </Typography>
                    {[
                      point.street,
                      [point.zip, point.city].filter(Boolean).join(' '),
                    ].filter(Boolean).length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {[
                          point.street,
                          [point.zip, point.city].filter(Boolean).join(' '),
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <TextField
                    label="Uhrzeit (optional)"
                    type="time"
                    value={pickupTime}
                    onChange={(event) => setPickupTime(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }}
                    helperText=" "
                    sx={{ flex: 1 }}
                  />
                )}
              </Stack>
            </Section>
          </Stack>
        </Grid>

        {/* ------- rechts: Artikel, Bestellung, Zahlung (am Telefon darunter) ------- */}
        <Grid item xs={12} md={7}>
          <Stack spacing={2}>
            <Section title="Artikel">
              {!pending && (
                <>
                  <TextField
                    label="Produkt suchen"
                    placeholder="z. B. Zopf, Kornbrot …"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setHighlight(0)
                    }}
                    onKeyDown={onSearchKeyDown}
                    inputRef={searchRef}
                    fullWidth
                    autoComplete="off"
                    InputProps={{
                      startAdornment: (
                        <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      ),
                    }}
                    inputProps={{
                      'aria-controls': 'preorder-product-results',
                      'aria-autocomplete': 'list',
                    }}
                  />
                  {query.trim() ? (
                    results.length > 0 ? (
                      <List
                        id="preorder-product-results"
                        aria-label="Suchergebnisse"
                        dense
                        sx={{ mt: 1, maxHeight: 360, overflowY: 'auto' }}
                      >
                        {results.map((product, index) => (
                          <ListItemButton
                            key={product.productId}
                            selected={index === highlight}
                            onClick={() => selectProduct(product)}
                            sx={{ minHeight: 48, borderRadius: 1 }}
                          >
                            <ListItemText
                              primary={product.name}
                              secondary={
                                (variants[product.productId] ?? []).length > 0
                                  ? `${formatCurrency(
                                      product.price
                                    )} · Sorten: ${(
                                      variants[product.productId] ?? []
                                    )
                                      .map(variantLabel)
                                      .join(', ')}`
                                  : formatCurrency(product.price)
                              }
                              primaryTypographyProps={{ fontWeight: 500 }}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    ) : (
                      <Typography color="text.secondary" sx={{ mt: 1.5 }}>
                        Kein Produkt gefunden.
                      </Typography>
                    )
                  ) : (
                    quick.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mb: 0.75 }}
                        >
                          Häufig vorbestellt
                        </Typography>
                        <Box
                          role="group"
                          aria-label="Häufig vorbestellt"
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: 'repeat(2, minmax(0, 1fr))',
                              sm: 'repeat(4, minmax(0, 1fr))',
                            },
                            gap: 1,
                          }}
                        >
                          {quick.map((product) => (
                            <Button
                              key={product.productId}
                              variant="outlined"
                              onClick={() => selectProduct(product)}
                              sx={{
                                minHeight: 52,
                                minWidth: 0,
                                px: 1,
                                textTransform: 'none',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                lineHeight: 1.2,
                                // W4-verify r3: lange Namen („Laugenbrötchen“)
                                // trennen statt über den Rand zu laufen.
                                hyphens: 'auto',
                                overflowWrap: 'anywhere',
                              }}
                              lang="de"
                            >
                              {product.name}
                            </Button>
                          ))}
                        </Box>
                      </Box>
                    )
                  )}
                </>
              )}

              {pending && (
                <Box
                  data-testid="pending-line"
                  sx={{
                    p: { xs: 1, sm: 1.5 },
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Typography
                      variant="h6"
                      component="p"
                      sx={{ fontSize: '1.15rem' }}
                    >
                      {pending.product.name}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {formatCurrency(pending.product.price)} /{' '}
                      {pending.product.unit}
                    </Typography>
                  </Stack>

                  {pendingVariants.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        variant="body2"
                        color={needsVariant ? 'text.primary' : 'text.secondary'}
                        sx={{ mb: 0.75, fontWeight: needsVariant ? 600 : 400 }}
                      >
                        {needsVariant ? 'Sorte wählen (Pflicht)' : 'Sorte'}
                      </Typography>
                      <Box
                        role="radiogroup"
                        aria-label="Sorte"
                        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
                      >
                        {pendingVariants.map((variant, index) => (
                          <Chip
                            key={variant}
                            ref={index === 0 ? firstVariantRef : undefined}
                            role="radio"
                            aria-checked={pending.variant === variant}
                            label={variantLabel(variant)}
                            color={
                              pending.variant === variant
                                ? 'primary'
                                : 'default'
                            }
                            variant={
                              pending.variant === variant
                                ? 'filled'
                                : 'outlined'
                            }
                            onClick={() => {
                              setPending({ ...pending, variant })
                              qtyRef.current?.focus()
                            }}
                            sx={variantChipSx}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Grid container spacing={1.5} alignItems="stretch">
                    <Grid item xs={12} sm={5}>
                      <TextField
                        label="Menge"
                        value={pending.qty}
                        onKeyDown={onQtyKeyDown}
                        inputRef={qtyRef}
                        fullWidth
                        inputProps={{
                          readOnly: true,
                          inputMode: 'none',
                          'aria-describedby': 'preorder-qty-hint',
                          style: {
                            fontSize: '2rem',
                            fontWeight: 600,
                            textAlign: 'center',
                          },
                        }}
                      />
                      <Typography
                        id="preorder-qty-hint"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: { xs: 'none', md: 'block' }, mt: 0.5 }}
                      >
                        Ziffern tippen, ↵ fügt hinzu, Esc bricht ab.
                      </Typography>
                      <Stack
                        direction={{ xs: 'row', sm: 'column' }}
                        spacing={1}
                        sx={{ mt: 1 }}
                      >
                        <Button
                          variant="contained"
                          size="large"
                          onClick={addPending}
                          disabled={!canAdd}
                          sx={{ minHeight: 52, flex: 1 }}
                        >
                          {/* Grund direkt am gesperrten Knopf - der Hinweis
                              unter dem Ziffernblock liegt am Handy außer Sicht */}
                          {needsVariant ? 'Erst Sorte wählen' : 'Hinzufügen'}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setPending(null)
                            setFocusSearch((n) => n + 1)
                          }}
                          sx={{ minHeight: 44, flex: 1 }}
                        >
                          Abbrechen
                        </Button>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <QuantityPad onKey={pressKey} />
                    </Grid>
                  </Grid>
                  {pendingVariants.length > 0 && pending.variant === '' && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Für dieses Produkt muss eine Sorte gewählt werden.
                    </Typography>
                  )}
                </Box>
              )}
            </Section>

            <Section title={`Bestellung (${lines.length})`}>
              {lines.length === 0 ? (
                <Typography color={showErrors ? 'error' : 'text.secondary'}>
                  {showErrors ? linesError : 'Noch keine Artikel.'}
                </Typography>
              ) : (
                <Box
                  component="ul"
                  aria-label="Positionen"
                  sx={{ listStyle: 'none', p: 0, m: 0 }}
                >
                  {lines.map((line) => (
                    <Box
                      component="li"
                      key={line.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 500 }} noWrap>
                          {line.name}
                          {line.variant
                            ? ` (${variantLabel(line.variant)})`
                            : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {line.quantity} × {formatCurrency(line.unitPrice)} ={' '}
                          {formatCurrency(
                            roundCents(line.quantity * line.unitPrice)
                          )}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label={`${line.name} eins weniger`}
                        onClick={() => changeLine(line.key, -1)}
                        disabled={line.quantity <= 1}
                        sx={{ width: 44, height: 44 }}
                      >
                        <MinusIcon />
                      </IconButton>
                      <Typography
                        sx={{
                          minWidth: 28,
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                        aria-label={`Menge ${line.name}`}
                      >
                        {line.quantity}
                      </Typography>
                      <IconButton
                        aria-label={`${line.name} eins mehr`}
                        onClick={() => changeLine(line.key, 1)}
                        disabled={line.quantity >= MAX_QTY_PER_ITEM}
                        sx={{ width: 44, height: 44 }}
                      >
                        <PlusIcon />
                      </IconButton>
                      <IconButton
                        aria-label={`${line.name} entfernen`}
                        onClick={() => removeLine(line.key)}
                        sx={{ width: 44, height: 44 }}
                      >
                        <RemoveIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
              >
                <Typography color="text.secondary">Summe (Vorschau)</Typography>
                <Typography
                  variant="h6"
                  component="p"
                  data-testid="preorder-total"
                >
                  {formatCurrency(total)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {editing
                  ? 'Vorhandene Positionen behalten ihren Preis von damals.'
                  : 'Der Preis wird beim Speichern festgehalten.'}
              </Typography>
            </Section>

            <Section title="Zahlung & Notiz">
              <FormControlLabel
                control={
                  <Switch
                    checked={paid}
                    onChange={(event) => setPaid(event.target.checked)}
                  />
                }
                label={paid ? 'Bezahlt' : 'Noch nicht bezahlt'}
                sx={{ mb: 1, minHeight: 44 }}
              />
              {paidBefore != null &&
                paid &&
                roundCents(total - paidBefore) !== 0 && (
                  <Alert
                    severity="warning"
                    sx={{ mb: 1 }}
                    data-testid="paid-difference"
                  >
                    Bereits bezahlt: {formatCurrency(paidBefore)}.{' '}
                    {total > paidBefore
                      ? `Differenz ${formatCurrency(
                          roundCents(total - paidBefore)
                        )} bei der Abholung kassieren.`
                      : `${formatCurrency(
                          roundCents(paidBefore - total)
                        )} an die Kundschaft zurückgeben.`}
                  </Alert>
                )}
              <TextField
                label="Notiz (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ maxLength: 500 }}
                helperText="Wird 90 Tage nach der Abholung gelöscht, wie Name und Telefon."
              />
            </Section>
          </Stack>
        </Grid>
      </Grid>

      {/* Speichern - auf dem Handy immer in Reichweite */}
      <Paper
        elevation={3}
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 2,
          p: 1.5,
          zIndex: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {error ? (
            <Alert severity="error" sx={{ py: 0 }}>
              {error}
            </Alert>
          ) : (
            <Typography color="text.secondary">
              {lines.length} Artikel · {formatCurrency(total)}
              {paid ? ' · bezahlt' : ''}
            </Typography>
          )}
        </Box>
        {onCancel && (
          <Button onClick={onCancel} sx={{ minHeight: 48 }} disabled={saving}>
            Abbrechen
          </Button>
        )}
        <Button
          onClick={submit}
          variant="contained"
          size="large"
          disabled={saving}
          sx={{ minHeight: 52, px: 3 }}
          title="Strg + Enter"
        >
          {saving
            ? 'Speichert …'
            : editing
            ? 'Änderungen speichern'
            : 'Vorbestellung speichern'}
        </Button>
      </Paper>
    </Box>
  )
}
