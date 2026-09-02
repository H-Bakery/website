'use client'

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  AddCircleOutline as RefillIcon,
  ArrowBack as ArrowBackIcon,
  Backspace as ClearRowIcon,
  DoneAll as PickupIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Inventory2 as InitialIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import {
  CatalogueProduct,
  DayDetail,
  PartnerDeliveryTemplate,
  PartnerVisit,
  VisitPayload,
  VisitType,
  VISIT_TYPE_DESCRIPTIONS,
  VISIT_TYPE_LABELS,
  WEEKDAY_LABELS,
  formatCurrency,
  formatDate,
  formatTime,
  shiftDate,
  toBusinessDate,
  toDateTimeLocal,
  weekdayOf,
} from '../../../../../../lib/partnerTypes'
import {
  createVisit,
  fetchTemplates,
  fetchToday,
  fetchVisits,
  updateVisit,
} from '../../../../../../lib/partnerApi'

export interface CatalogueGroup {
  category: string
  label: string
  products: CatalogueProduct[]
}

interface VisitFormClientProps {
  partnerId: string
  groups: CatalogueGroup[]
  /** Geschäftstag aus der URL - für Nacherfassung im Büro. */
  initialDate?: string
  /** Gesetzt, wenn ein bestehender Besuch korrigiert wird. */
  visitId?: number
}

/**
 * Eingabestand einer Produktzeile.
 *
 * Bewusst *Strings*, nicht Zahlen: der leere String ist die einzige ehrliche
 * Darstellung von "nicht gezählt". Genau daran hängt die Fachlogik - `null`
 * heißt "nicht gezählt", `0` heißt "Fach war leer", und beides ergibt
 * unterschiedliche Verkaufszahlen.
 */
interface RowState {
  rest: string
  neu: string
}

const EMPTY_ROW: RowState = { rest: '', neu: '' }

const VISIT_TYPE_OPTIONS: VisitType[] = ['initial', 'refill', 'pickup']

const VISIT_TYPE_ICONS: Record<VisitType, React.ReactElement> = {
  initial: <InitialIcon />,
  refill: <RefillIcon />,
  pickup: <PickupIcon />,
}

/** Kategorie-Schlüssel für Produkte, die nicht (mehr) im HQ-Katalog stehen. */
const EXTRA_CATEGORY = '__weitere'

const DRAFT_PREFIX = 'bakery.partnerVisitDraft.v1'

interface StoredDraft {
  version: number
  savedAt: string
  visitType: VisitType
  visitAt: string
  staffName: string
  note: string
  rows: Record<string, RowState>
  extras: CatalogueProduct[]
}

function draftKeyFor(
  partnerId: string,
  businessDate: string,
  visitId?: number
): string {
  const suffix = visitId ? `.v${visitId}` : ''
  return `${DRAFT_PREFIX}.${partnerId}.${businessDate}${suffix}`
}

/** Nur Ziffern zulassen und führende Nullen entfernen ("007" -> "7", "0" -> "0"). */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
}

/** `null` = Feld leer = nicht gezählt. */
function parseQty(value: string): number | null {
  if (!value || value.trim() === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? Math.max(0, n) : null
}

function hasContent(row: RowState | undefined): boolean {
  if (!row) return false
  return row.rest.trim() !== '' || row.neu.trim() !== ''
}

/** Stepper-Schritt. Aus einem leeren Feld macht "−" eine ausdrückliche 0. */
function stepValue(value: string, delta: number): string {
  const current = parseQty(value) ?? 0
  return String(Math.max(0, current + delta))
}

function sanitizeRows(value: unknown): Record<string, RowState> {
  const out: Record<string, RowState> = {}
  if (!value || typeof value !== 'object') return out
  for (const [slug, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Partial<RowState>
    const rest = typeof row.rest === 'string' ? digitsOnly(row.rest) : ''
    const neu = typeof row.neu === 'string' ? digitsOnly(row.neu) : ''
    if (rest === '' && neu === '') continue
    out[slug] = { rest, neu }
  }
  return out
}

function isCatalogueProduct(value: unknown): value is CatalogueProduct {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<CatalogueProduct>
  return typeof p.productSlug === 'string' && typeof p.productName === 'string'
}

/* localStorage wirft im privaten Modus - jeder Zugriff ist deshalb gekapselt. */

function readDraft(key: string): Partial<StoredDraft> | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<StoredDraft>
  } catch {
    return null
  }
}

function writeDraft(key: string, draft: StoredDraft): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    /* Privater Modus oder Speicher voll - der Entwurf ist dann nur flüchtig. */
  }
}

function clearDraft(key: string): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  } catch {
    /* siehe writeDraft */
  }
}

function defaultVisitAt(businessDate: string): string {
  return businessDate === toBusinessDate()
    ? toDateTimeLocal()
    : `${businessDate}T08:00`
}

/** Öffnet alle Gruppen, die eines der Produkte enthalten. */
function openGroupsWith(
  previous: Record<string, boolean>,
  groups: CatalogueGroup[],
  slugs: string[]
): Record<string, boolean> {
  if (slugs.length === 0) return previous
  const wanted = new Set(slugs)
  const next = { ...previous }
  for (const group of groups) {
    if (group.products.some((p) => wanted.has(p.productSlug))) {
      next[group.category] = true
    }
  }
  next[EXTRA_CATEGORY] = next[EXTRA_CATEGORY] ?? true
  return next
}

interface ProductRowProps {
  product: CatalogueProduct
  row: RowState
  /** Erwarteter Bestand im Schrank vor diesem Besuch, aus dem Tagesverlauf. */
  expected: number | null
  emphasis: 'rest' | 'neu' | 'none'
  onChange: (slug: string, field: keyof RowState, value: string) => void
  onStep: (slug: string, field: keyof RowState, delta: number) => void
  onClear: (slug: string) => void
}

/**
 * Eine Produktzeile: zwei Stepper nebeneinander, alle Touch-Ziele ≥ 44 px.
 *
 * `memo`, damit ein Tastendruck in einer Zeile nicht alle ~100 Zeilen neu
 * rendert - auf einem älteren Handy ist das der Unterschied zwischen flüssig
 * und unbenutzbar.
 */
const ProductRow = memo(function ProductRow({
  product,
  row,
  expected,
  emphasis,
  onChange,
  onStep,
  onClear,
}: ProductRowProps) {
  const slug = product.productSlug
  const restQty = parseQty(row.rest)
  const neuQty = parseQty(row.neu) ?? 0
  const filled = hasContent(row)
  const base = restQty ?? expected ?? 0
  const stockAfter = base + neuQty

  let hint: string | null = null
  if (filled || expected != null) {
    if (restQty == null) {
      hint = `Rest nicht gezählt · Bestand danach ${stockAfter}`
    } else {
      const sold = expected != null ? expected - restQty : null
      hint =
        `Bestand danach ${stockAfter} (${restQty} + ${neuQty})` +
        (sold != null && sold >= 0 ? ` · verkauft ${sold}` : '')
    }
  }

  const renderStepper = (
    field: keyof RowState,
    label: string,
    highlighted: boolean
  ) => (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 0,
        borderRadius: 1,
        p: 0.5,
        bgcolor: highlighted ? 'action.hover' : 'transparent',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 0.25,
          fontWeight: highlighted ? 700 : 500,
          color: highlighted ? 'text.primary' : 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton
          aria-label={`${label} verringern: ${product.productName}`}
          onClick={() => onStep(slug, field, -1)}
          sx={{
            minWidth: 44,
            minHeight: 44,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            flexShrink: 0,
          }}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
        <TextField
          value={row[field]}
          onChange={(event) =>
            onChange(slug, field, digitsOnly(event.target.value))
          }
          placeholder="–"
          size="small"
          sx={{ flex: '1 1 0', minWidth: 36 }}
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            'aria-label': `${label} in Stück: ${product.productName}`,
            style: { textAlign: 'center', padding: '10px 2px' },
          }}
        />
        <IconButton
          aria-label={`${label} erhöhen: ${product.productName}`}
          onClick={() => onStep(slug, field, 1)}
          sx={{
            minWidth: 44,
            minHeight: 44,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            flexShrink: 0,
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 1.5 },
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: filled ? 'action.selected' : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {product.productName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatCurrency(product.unitPrice)} / Stück
            {expected != null ? ` · erwartet ${expected}` : ''}
          </Typography>
        </Box>
        {filled && (
          <Tooltip title="Eingaben dieser Zeile verwerfen">
            <IconButton
              aria-label={`Eingaben verwerfen: ${product.productName}`}
              onClick={() => onClear(slug)}
              sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
            >
              <ClearRowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 2 }, mt: 0.5 }}>
        {renderStepper('rest', 'Rest', emphasis === 'rest')}
        {renderStepper('neu', 'Neu', emphasis === 'neu')}
      </Box>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5 }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  )
})

export default function VisitFormClient({
  partnerId,
  groups,
  initialDate,
  visitId,
}: VisitFormClientProps) {
  const router = useRouter()
  const isEditing = typeof visitId === 'number'

  /** Der Geschäftstag, unter dem der Entwurf liegt - bleibt über die Laufzeit stabil. */
  const initialBusinessDate = useMemo(
    () =>
      initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
        ? initialDate
        : toBusinessDate(),
    [initialDate]
  )
  const storageKey = useMemo(
    () => draftKeyFor(partnerId, initialBusinessDate, visitId),
    [partnerId, initialBusinessDate, visitId]
  )

  useEffect(() => {
    // Funktionaler Updater: ein aus dem Entwurf oder dem geladenen Besuch
    // gesetzter Zeitpunkt gewinnt, unabhängig von der Effekt-Reihenfolge.
    setVisitAt((current) => current || defaultVisitAt(initialBusinessDate))
  }, [initialBusinessDate])

  const [visitType, setVisitType] = useState<VisitType>('initial')
  // Leer starten und erst nach dem Mount füllen: `defaultVisitAt` liest die
  // Uhrzeit, und Server-Render und Hydration liegen fast nie in derselben
  // Minute - der Wert stünde sonst schon im SSR-HTML und React würfe den
  // Teilbaum bei jedem Minutenwechsel weg.
  const [visitAt, setVisitAt] = useState('')
  const [staffName, setStaffName] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [extras, setExtras] = useState<CatalogueProduct[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const [templates, setTemplates] = useState<PartnerDeliveryTemplate[]>([])
  const [dayDetail, setDayDetail] = useState<
    (DayDetail & { visits: PartnerVisit[] }) | null
  >(null)
  const [editedVisit, setEditedVisit] = useState<PartnerVisit | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  /** Produkte mit Bestand, deren Rest bei der Abholung nicht gezählt wurde. */
  const [missingRest, setMissingRest] = useState<CatalogueProduct[]>([])
  const [templateInfo, setTemplateInfo] = useState<string | null>(null)
  const [draftInfo, setDraftInfo] = useState<string | null>(null)

  const [restoreDone, setRestoreDone] = useState(false)
  const draftRestoredRef = useRef(false)
  const restoredKeyRef = useRef<string | null>(null)
  const appliedWeekdayRef = useRef<number | null>(null)

  const knownSlugs = useMemo(
    () => new Set(groups.flatMap((g) => g.products.map((p) => p.productSlug))),
    [groups]
  )

  /* ------------------------------------------------------------------ *
   * Entwurf wiederherstellen - läuft vor dem Laden der Serverdaten.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    // Genau einmal je Entwurfs-Schlüssel - ein erneuter Lauf würde bereits
    // getippte Mengen mit dem alten Stand überschreiben.
    if (restoredKeyRef.current === storageKey) return
    restoredKeyRef.current = storageKey

    const draft = readDraft(storageKey)
    if (draft) {
      const restoredExtras = (
        Array.isArray(draft.extras) ? draft.extras : []
      ).filter(isCatalogueProduct)
      const available = new Set(knownSlugs)
      for (const extra of restoredExtras) available.add(extra.productSlug)

      const restored = sanitizeRows(draft.rows)
      const kept: Record<string, RowState> = {}
      let dropped = 0
      for (const [slug, row] of Object.entries(restored)) {
        if (available.has(slug)) kept[slug] = row
        else dropped += 1
      }

      const keptSlugs = Object.keys(kept)
      const hasText =
        (typeof draft.staffName === 'string' && draft.staffName !== '') ||
        (typeof draft.note === 'string' && draft.note !== '')

      if (keptSlugs.length > 0 || hasText) {
        draftRestoredRef.current = true
        if (draft.visitType && VISIT_TYPE_OPTIONS.includes(draft.visitType)) {
          setVisitType(draft.visitType)
        }
        if (typeof draft.visitAt === 'string' && draft.visitAt) {
          setVisitAt(draft.visitAt)
        }
        setStaffName(typeof draft.staffName === 'string' ? draft.staffName : '')
        setNote(typeof draft.note === 'string' ? draft.note : '')
        setRows(kept)
        if (restoredExtras.length > 0) setExtras(restoredExtras)
        setOpenGroups((prev) => openGroupsWith(prev, groups, keptSlugs))
        setDraftInfo(
          `Nicht gespeicherter Entwurf${
            typeof draft.savedAt === 'string' && draft.savedAt
              ? ` von ${formatTime(draft.savedAt)} Uhr`
              : ''
          } wiederhergestellt.` +
            (dropped > 0
              ? ` ${dropped} Position(en) gehören nicht mehr zum Sortiment und wurden entfernt.`
              : '')
        )
      }
    }
    setRestoreDone(true)
  }, [storageKey, knownSlugs, groups])

  /* ------------------------------------------------------------------ *
   * Vorlagen, Tagesstand und - beim Korrigieren - der Besuch selbst.
   * ------------------------------------------------------------------ */
  const applyVisit = useCallback(
    (visit: PartnerVisit) => {
      setEditedVisit(visit)

      const unknown = (visit.items ?? []).filter(
        (item) => !knownSlugs.has(item.productSlug)
      )
      if (unknown.length > 0) {
        // Produkte, die es im HQ-Katalog nicht mehr gibt, trotzdem anzeigen -
        // sonst verschwinden ihre Mengen beim Speichern stillschweigend.
        setExtras((prev) => {
          const seen = new Set(prev.map((p) => p.productSlug))
          const added = unknown
            .filter((item) => !seen.has(item.productSlug))
            .map((item) => ({
              productId: item.productId,
              productSlug: item.productSlug,
              productName: item.productName || item.productSlug,
              unitPrice: item.unitPrice,
              category: EXTRA_CATEGORY,
              categoryLabel: 'Weitere Produkte',
              available: false,
            }))
          return added.length > 0 ? [...prev, ...added] : prev
        })
      }

      if (draftRestoredRef.current) return

      if (VISIT_TYPE_OPTIONS.includes(visit.visitType)) {
        setVisitType(visit.visitType)
      }
      if (visit.visitAt) {
        const parsed = new Date(visit.visitAt)
        if (!Number.isNaN(parsed.getTime())) setVisitAt(toDateTimeLocal(parsed))
      }
      setStaffName(visit.staffName ?? '')
      setNote(visit.note ?? '')

      const fromVisit: Record<string, RowState> = {}
      for (const item of visit.items ?? []) {
        fromVisit[item.productSlug] = {
          rest: item.countedQty == null ? '' : String(item.countedQty),
          neu: String(item.deliveredQty ?? 0),
        }
      }
      // Was währenddessen schon getippt wurde, gewinnt - eine Eingabe darf
      // niemals von nachladenden Daten überschrieben werden.
      setRows((prev) => {
        const merged = { ...fromVisit }
        for (const [slug, row] of Object.entries(prev)) {
          if (hasContent(row)) merged[slug] = row
        }
        return merged
      })
      setOpenGroups((prev) =>
        openGroupsWith(prev, groups, Object.keys(fromVisit))
      )
    },
    [groups, knownSlugs]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [loadedTemplates, today] = await Promise.all([
        fetchTemplates(partnerId),
        fetchToday(partnerId, initialBusinessDate),
      ])
      setTemplates(Array.isArray(loadedTemplates) ? loadedTemplates : [])
      setDayDetail(today)

      if (typeof visitId === 'number') {
        let visit =
          (today.visits ?? []).find((candidate) => candidate.id === visitId) ??
          null
        if (!visit) {
          const nearby = await fetchVisits(partnerId, {
            from: shiftDate(initialBusinessDate, -7),
            to: shiftDate(initialBusinessDate, 1),
          })
          visit = nearby.find((candidate) => candidate.id === visitId) ?? null
        }
        if (!visit) {
          throw new Error(
            `Besuch #${visitId} wurde nicht gefunden. Bitte über die Tagesübersicht erneut öffnen.`
          )
        }
        applyVisit(visit)
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Die Daten konnten nicht geladen werden'
      )
    } finally {
      setLoading(false)
    }
  }, [partnerId, initialBusinessDate, visitId, applyVisit])

  useEffect(() => {
    load()
  }, [load])

  /* ------------------------------------------------------------------ *
   * Abgeleitete Werte
   * ------------------------------------------------------------------ */
  const businessDate = useMemo(() => {
    const datePart = visitAt.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : initialBusinessDate
  }, [visitAt, initialBusinessDate])

  const weekday = useMemo(() => weekdayOf(businessDate), [businessDate])
  const sameDayAsLoaded = businessDate === initialBusinessDate

  /** Erwarteter Bestand je Produkt aus dem bisherigen Tagesverlauf. */
  const expectedStock = useMemo(() => {
    const map = new Map<string, number>()
    if (!dayDetail || !sameDayAsLoaded) return map
    for (const entry of dayDetail.timeline ?? []) {
      for (const item of entry.items ?? []) {
        map.set(item.productSlug, item.stockAfterQty)
      }
    }
    return map
  }, [dayDetail, sameDayAsLoaded])

  /** Abverkauf seit dem letzten Besuch - sortiert die Nachlieferung. */
  const salesRanking = useMemo(() => {
    const sinceLast = new Map<string, number>()
    const today = new Map<string, number>()
    if (dayDetail && sameDayAsLoaded) {
      const timeline = dayDetail.timeline ?? []
      const last = timeline[timeline.length - 1]
      for (const item of last?.items ?? []) {
        sinceLast.set(item.productSlug, item.soldSinceLastQty)
      }
      for (const product of dayDetail.byProduct ?? []) {
        today.set(product.productSlug, product.soldQty)
      }
    }
    return { sinceLast, today }
  }, [dayDetail, sameDayAsLoaded])

  /** Katalog plus Produkte, die nur noch in Entwurf oder Besuch vorkommen. */
  const displayGroups = useMemo(() => {
    const base: CatalogueGroup[] = groups.map((group) => ({
      ...group,
      products: [...group.products],
    }))
    if (extras.length > 0) {
      base.push({
        category: EXTRA_CATEGORY,
        label: 'Weitere Produkte',
        products: [...extras],
      })
    }
    if (visitType === 'refill') {
      const score = (product: CatalogueProduct) => ({
        since: salesRanking.sinceLast.get(product.productSlug) ?? 0,
        today: salesRanking.today.get(product.productSlug) ?? 0,
      })
      for (const group of base) {
        group.products.sort((a, b) => {
          const sa = score(a)
          const sb = score(b)
          return (
            sb.since - sa.since ||
            sb.today - sa.today ||
            a.productName.localeCompare(b.productName, 'de')
          )
        })
      }
    }
    if (visitType === 'pickup') {
      // Was heute im Schrank lag, steht in jeder Kategorie oben - auch ein
      // Produkt, das schon auf 0 gezählt wurde, vor den ~100 nie gelieferten.
      // Innerhalb davon der höchste erwartete Bestand zuerst.
      const inCabinet = (product: CatalogueProduct) =>
        expectedStock.has(product.productSlug) ? 1 : 0
      const expected = (product: CatalogueProduct) =>
        expectedStock.get(product.productSlug) ?? 0
      for (const group of base) {
        group.products.sort(
          (a, b) =>
            inCabinet(b) - inCabinet(a) ||
            expected(b) - expected(a) ||
            a.productName.localeCompare(b.productName, 'de')
        )
      }
    }
    return base
  }, [groups, extras, visitType, salesRanking, expectedStock])

  /** Alle Produkte - Grundlage fürs Speichern, bewusst *ohne* Suchfilter. */
  const allProducts = useMemo(
    () => displayGroups.flatMap((group) => group.products),
    [displayGroups]
  )

  const filledSlugs = useMemo(
    () =>
      allProducts
        .map((product) => product.productSlug)
        .filter((slug) => hasContent(rows[slug])),
    [allProducts, rows]
  )

  /** "Mischbrot 500g 6, Kornbrot 500g 0" - was laut Tagesverlauf im Schrank liegt. */
  const expectedSummary = useMemo(() => {
    if (expectedStock.size === 0) return ''
    const names = new Map(
      allProducts.map((product) => [product.productSlug, product.productName])
    )
    const nameOf = (slug: string) => names.get(slug) ?? slug
    return Array.from(expectedStock.entries())
      .sort(
        ([slugA, a], [slugB, b]) =>
          b - a || nameOf(slugA).localeCompare(nameOf(slugB), 'de')
      )
      .map(([slug, qty]) => `${nameOf(slug)} ${qty}`)
      .join(', ')
  }, [expectedStock, allProducts])

  // Abholung: die Kategorien aufklappen, in denen heute etwas lag - sonst
  // liegen Brötchen oder Teilchen aus der Erstbestückung hinter einem
  // zugeklappten Gruppenkopf, während der Fahrer am Handy zählt.
  useEffect(() => {
    if (visitType !== 'pickup') return
    setOpenGroups((prev) =>
      openGroupsWith(prev, groups, Array.from(expectedStock.keys()))
    )
  }, [visitType, expectedStock, groups])

  const totals = useMemo(() => {
    let rest = 0
    let neu = 0
    let counted = 0
    for (const slug of filledSlugs) {
      const row = rows[slug]
      const restQty = parseQty(row.rest)
      if (restQty != null) {
        rest += restQty
        counted += 1
      }
      neu += parseQty(row.neu) ?? 0
    }
    return { rest, neu, counted, products: filledSlugs.length }
  }, [filledSlugs, rows])

  /* ------------------------------------------------------------------ *
   * Entwurf schreiben - erst nachdem ein vorhandener wiederhergestellt ist.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!restoreDone) return
    const worthSaving =
      Object.values(rows).some(hasContent) ||
      staffName.trim() !== '' ||
      note.trim() !== ''
    if (!worthSaving) {
      clearDraft(storageKey)
      return
    }
    writeDraft(storageKey, {
      version: 1,
      savedAt: new Date().toISOString(),
      visitType,
      visitAt,
      staffName,
      note,
      rows,
      extras,
    })
  }, [
    restoreDone,
    storageKey,
    visitType,
    visitAt,
    staffName,
    note,
    rows,
    extras,
  ])

  /* ------------------------------------------------------------------ *
   * Wochentags-Vorlage
   * ------------------------------------------------------------------ */
  const templateForWeekday = useMemo(() => {
    if (weekday == null) return null
    return (
      templates.find(
        (template) => template.weekday === weekday && template.active !== false
      ) ?? null
    )
  }, [templates, weekday])

  const applyTemplate = useCallback(
    (template: PartnerDeliveryTemplate, force: boolean) => {
      const items = (template.items ?? []).filter(
        (item) => item.productSlug && knownSlugs.has(item.productSlug)
      )
      const missing = (template.items ?? []).length - items.length
      setRows((prev) => {
        const next = { ...prev }
        for (const item of items) {
          const row = next[item.productSlug] ?? EMPTY_ROW
          // Ohne `force` werden nur leere Felder gefüllt - getippte Mengen
          // bleiben stehen.
          if (!force && row.neu.trim() !== '') continue
          const quantity = Math.max(0, Math.trunc(Number(item.quantity) || 0))
          next[item.productSlug] = { ...row, neu: String(quantity) }
        }
        return next
      })
      setOpenGroups((prev) =>
        openGroupsWith(
          prev,
          groups,
          items.map((item) => item.productSlug)
        )
      )
      return { applied: items.length, missing }
    },
    [groups, knownSlugs]
  )

  useEffect(() => {
    if (loading || isEditing) return
    if (visitType !== 'initial' || weekday == null) return
    if (appliedWeekdayRef.current === weekday) return
    appliedWeekdayRef.current = weekday

    const weekdayLabel = WEEKDAY_LABELS[weekday] ?? String(weekday)
    if (!templateForWeekday || (templateForWeekday.items ?? []).length === 0) {
      setTemplateInfo(
        `Für ${weekdayLabel} ist keine Standard-Bestückung hinterlegt - Mengen bitte direkt eintragen.`
      )
      return
    }
    const { applied, missing } = applyTemplate(templateForWeekday, false)
    setTemplateInfo(
      `Vorlage für ${weekdayLabel} übernommen (${applied} ${
        applied === 1 ? 'Position' : 'Positionen'
      }). Bereits eingetragene Mengen bleiben erhalten.` +
        (missing > 0
          ? ` ${missing} Position(en) der Vorlage sind nicht mehr im Sortiment und wurden ausgelassen.`
          : '')
    )
  }, [
    loading,
    isEditing,
    visitType,
    weekday,
    templateForWeekday,
    applyTemplate,
  ])

  /* ------------------------------------------------------------------ *
   * Eingabe-Handler - alle mit funktionalem Update, damit nichts verloren geht.
   * ------------------------------------------------------------------ */
  const handleRowChange = useCallback(
    (slug: string, field: keyof RowState, value: string) => {
      setRows((prev) => ({
        ...prev,
        [slug]: { ...(prev[slug] ?? EMPTY_ROW), [field]: value },
      }))
    },
    []
  )

  const handleRowStep = useCallback(
    (slug: string, field: keyof RowState, delta: number) => {
      setRows((prev) => {
        const row = prev[slug] ?? EMPTY_ROW
        return {
          ...prev,
          [slug]: { ...row, [field]: stepValue(row[field], delta) },
        }
      })
    },
    []
  )

  const handleRowClear = useCallback((slug: string) => {
    setRows((prev) => {
      if (!prev[slug]) return prev
      const next = { ...prev }
      delete next[slug]
      return next
    })
  }, [])

  const discardDraft = () => {
    clearDraft(storageKey)
    draftRestoredRef.current = false
    setRows({})
    setStaffName('')
    setNote('')
    setDraftInfo(null)
    appliedWeekdayRef.current = null
  }

  const toggleGroup = (category: string, currentlyOpen: boolean) => {
    setOpenGroups((prev) => ({ ...prev, [category]: !currentlyOpen }))
  }

  const setAllGroups = (open: boolean) => {
    setOpenGroups(
      Object.fromEntries(displayGroups.map((group) => [group.category, open]))
    )
  }

  /* ------------------------------------------------------------------ *
   * Speichern
   * ------------------------------------------------------------------ */
  /** Alle fehlenden Reste auf 0 setzen - "das Fach war leer", mit einem Tipp. */
  const applyZeroRest = () => {
    for (const product of missingRest) {
      handleRowChange(product.productSlug, 'rest', '0')
    }
    setMissingRest([])
    setFormError(null)
  }

  const handleSubmit = async () => {
    setFormError(null)
    setSaveError(null)
    setMissingRest([])

    const items: VisitPayload['items'] = allProducts
      .filter((product) => hasContent(rows[product.productSlug]))
      .map((product) => {
        const row = rows[product.productSlug]
        return {
          productId: product.productId,
          productSlug: product.productSlug,
          productName: product.productName,
          unitPrice: product.unitPrice,
          // `null` = nicht gezählt, `0` = Fach war leer. Der Unterschied
          // verändert den errechneten Verkauf.
          countedQty: parseQty(row.rest),
          deliveredQty: parseQty(row.neu) ?? 0,
        }
      })

    if (items.length === 0) {
      setFormError(
        'Bitte mindestens ein Produkt erfassen - Rest und/oder neue Menge.'
      )
      return
    }

    // Abholung: jedes Produkt, das laut Tagesverlauf noch im Schrank liegt,
    // braucht einen gezählten Rest. Sonst gilt der Tag als abgeschlossen,
    // obwohl diese Stücke weder verkauft noch Retoure sind.
    if (visitType === 'pickup' && sameDayAsLoaded) {
      const missing = allProducts.filter(
        (product) =>
          (expectedStock.get(product.productSlug) ?? 0) > 0 &&
          parseQty(rows[product.productSlug]?.rest ?? '') == null
      )
      if (missing.length > 0) {
        setMissingRest(missing)
        setOpenGroups((prev) =>
          openGroupsWith(
            prev,
            displayGroups,
            missing.map((product) => product.productSlug)
          )
        )
        setFormError(
          `Bei der Abholung fehlt der Rest für: ${missing
            .map(
              (product) =>
                `${product.productName} (erwartet ${expectedStock.get(
                  product.productSlug
                )})`
            )
            .join(
              ', '
            )}. Bitte zählen – oder auf 0 setzen, wenn das Fach leer war.`
        )
        return
      }
    }

    const visitDate = new Date(visitAt)
    if (Number.isNaN(visitDate.getTime())) {
      setFormError('Bitte einen gültigen Zeitpunkt angeben.')
      return
    }

    const payload: VisitPayload = {
      businessDate,
      visitAt: visitDate.toISOString(),
      visitType,
      staffName: staffName.trim() || null,
      note: note.trim() || null,
      items,
    }

    setSaving(true)
    try {
      if (typeof visitId === 'number') {
        await updateVisit(partnerId, visitId, payload)
      } else {
        await createVisit(partnerId, payload)
      }
      clearDraft(storageKey)
      // `saving` bleibt absichtlich stehen: der Button ist damit bis zum
      // Seitenwechsel gesperrt und ein zweiter Besuch kann nicht entstehen.
      router.push(`/admin/partners/${partnerId}`)
      router.refresh()
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Der Besuch konnte nicht gespeichert werden'
      )
      setSaving(false)
    }
  }

  /* ------------------------------------------------------------------ *
   * Darstellung
   * ------------------------------------------------------------------ */
  const needle = search.trim().toLowerCase()
  const visibleGroups = needle
    ? displayGroups
        .map((group) => ({
          ...group,
          products: group.products.filter((product) =>
            product.productName.toLowerCase().includes(needle)
          ),
        }))
        .filter((group) => group.products.length > 0)
    : displayGroups

  const isGroupOpen = (category: string, index: number) =>
    needle ? true : openGroups[category] ?? index === 0

  const allOpen =
    displayGroups.length > 0 &&
    displayGroups.every((group, index) => isGroupOpen(group.category, index))

  const emphasis: 'rest' | 'neu' | 'none' =
    visitType === 'pickup' ? 'rest' : visitType === 'initial' ? 'neu' : 'none'

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Kopf */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <IconButton
          aria-label="Zurück zum Partner"
          onClick={() => router.push(`/admin/partners/${partnerId}`)}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontSize: { xs: '1.35rem', md: '1.75rem' } }}
          >
            {isEditing ? 'Besuch korrigieren' : 'Besuch erfassen'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {weekday != null ? `${WEEKDAY_LABELS[weekday]}, ` : ''}
            {formatDate(businessDate)}
            {editedVisit ? ` · Besuch ${editedVisit.sequence}` : ''}
          </Typography>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress aria-label="Vorlagen und Tagesstand werden geladen" />
          <Typography variant="caption" color="text.secondary">
            Vorlagen und Tagesstand werden geladen …
          </Typography>
        </Box>
      )}

      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {draftInfo && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={() => setDraftInfo(null)}
          action={
            <Button color="inherit" size="small" onClick={discardDraft}>
              Entwurf verwerfen
            </Button>
          }
        >
          {draftInfo}
        </Alert>
      )}

      {/* Besuchstyp */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <ToggleButtonGroup
          value={visitType}
          exclusive
          fullWidth
          size="large"
          aria-label="Art des Besuchs"
          onChange={(_event, value) => {
            if (value) setVisitType(value as VisitType)
          }}
        >
          {VISIT_TYPE_OPTIONS.map((type) => (
            <ToggleButton
              key={type}
              value={type}
              aria-label={VISIT_TYPE_LABELS[type]}
              sx={{
                flexDirection: 'column',
                gap: 0.25,
                minHeight: 64,
                px: 0.5,
                lineHeight: 1.2,
                textTransform: 'none',
                fontSize: { xs: '0.7rem', sm: '0.85rem' },
              }}
            >
              {VISIT_TYPE_ICONS[type]}
              {VISIT_TYPE_LABELS[type]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1.5, display: 'block' }}
        >
          {VISIT_TYPE_DESCRIPTIONS[visitType]}
        </Typography>

        {visitType === 'pickup' && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Diese Abholung schließt den Geschäftstag ab. Bitte je Produkt den
            Rest zählen - daraus ergeben sich Retoure, Tagesverkauf und Umsatz.
            Ohne Abholung bleibt der Tag offen und alle Zahlen vorläufig.
            {expectedSummary && (
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                {`Im Schrank erwartet: ${expectedSummary} - diese Produkte stehen in jeder Kategorie oben.`}
              </Box>
            )}
          </Alert>
        )}
        {visitType === 'initial' && templateInfo && (
          <Alert
            severity="info"
            sx={{ mt: 1.5 }}
            onClose={() => setTemplateInfo(null)}
            action={
              templateForWeekday &&
              (templateForWeekday.items ?? []).length > 0 ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const { applied } = applyTemplate(templateForWeekday, true)
                    setTemplateInfo(
                      `Vorlage erneut angewendet - ${applied} Position(en) auf die Vorlagenmenge gesetzt.`
                    )
                  }}
                >
                  Vorlage anwenden
                </Button>
              ) : undefined
            }
          >
            {templateInfo}
          </Alert>
        )}
        {visitType === 'refill' && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Zuerst zählen, was noch da ist (Rest), dann eintragen, was neu
            eingeräumt wird (Neu). Produkte mit dem stärksten Abverkauf seit dem
            letzten Besuch stehen in jeder Kategorie oben.
          </Alert>
        )}
      </Paper>

      {/* Zeitpunkt und Person */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Zeitpunkt des Besuchs"
            type="datetime-local"
            value={visitAt}
            onChange={(event) => setVisitAt(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Frei änderbar - so lässt sich ein Besuch auch später im Büro nacherfassen."
          />
          <TextField
            label="Erfasst von (optional)"
            value={staffName}
            onChange={(event) => setStaffName(event.target.value)}
            fullWidth
            placeholder="Name"
          />
          <TextField
            label="Notiz (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="z. B. Brot war um 10 Uhr komplett leer"
          />
        </Stack>
      </Paper>

      {/* Produkte */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'center',
          mb: 1,
        }}
      >
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Produkt suchen"
          size="small"
          sx={{ flex: '1 1 180px' }}
          inputProps={{ 'aria-label': 'Produkt suchen' }}
        />
        <Button
          size="small"
          onClick={() => setAllGroups(!allOpen)}
          sx={{ minHeight: 44 }}
        >
          {allOpen ? 'Alle einklappen' : 'Alle ausklappen'}
        </Button>
      </Box>

      {visibleGroups.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', mb: 2 }}>
          <Typography color="text.secondary">
            Keine Produkte gefunden.
          </Typography>
        </Paper>
      ) : (
        visibleGroups.map((group, index) => {
          const open = isGroupOpen(group.category, index)
          const filledInGroup = group.products.filter((product) =>
            hasContent(rows[product.productSlug])
          ).length
          return (
            <Paper key={group.category} sx={{ mb: 1.5, overflow: 'hidden' }}>
              <ButtonBase
                onClick={() => toggleGroup(group.category, open)}
                aria-expanded={open}
                sx={{
                  width: '100%',
                  minHeight: 52,
                  px: { xs: 1.5, sm: 2 },
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                  textAlign: 'left',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {group.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.products.length} Produkte
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {filledInGroup > 0 && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${filledInGroup} erfasst`}
                    />
                  )}
                  {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </ButtonBase>
              <Collapse in={open} unmountOnExit>
                <Box>
                  {group.products.map((product) => (
                    <ProductRow
                      key={product.productSlug}
                      product={product}
                      row={rows[product.productSlug] ?? EMPTY_ROW}
                      expected={
                        expectedStock.has(product.productSlug)
                          ? (expectedStock.get(product.productSlug) as number)
                          : null
                      }
                      emphasis={emphasis}
                      onChange={handleRowChange}
                      onStep={handleRowStep}
                      onClear={handleRowClear}
                    />
                  ))}
                </Box>
              </Collapse>
            </Paper>
          )
        })
      )}

      {formError && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            missingRest.length > 0 ? (
              <Button color="inherit" size="small" onClick={applyZeroRest}>
                Rest auf 0 setzen
              </Button>
            ) : undefined
          }
        >
          {formError}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {saveError}
        </Alert>
      )}

      {/* Sticky Speichern-Leiste - am Handy immer erreichbar */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          mt: 2,
          mx: { xs: -1.5, sm: -2, md: -3 },
          px: { xs: 1.5, sm: 2, md: 3 },
          py: 1.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: 6,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {totals.products} Produkt(e) erfasst · Rest {totals.rest} (
            {totals.counted} gezählt) · Neu {totals.neu}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => router.push(`/admin/partners/${partnerId}`)}
              disabled={saving}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, minHeight: 48 }}
            >
              Abbrechen
            </Button>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSubmit}
              disabled={saving || loading}
              startIcon={
                saving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              sx={{ minHeight: 48, whiteSpace: 'nowrap' }}
            >
              {saving
                ? 'Wird gespeichert …'
                : isEditing
                ? 'Änderungen speichern'
                : 'Besuch speichern'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
