'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SaveIcon from '@mui/icons-material/Save'
import SearchIcon from '@mui/icons-material/Search'
import UndoIcon from '@mui/icons-material/Undo'
import {
  CatalogueProduct,
  Partner,
  TemplateItem,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  formatCurrency,
} from '../../../../../lib/partnerTypes'
import {
  fetchPartner,
  fetchTemplates,
  saveTemplate,
} from '../../../../../lib/partnerApi'
import { useOptionalSession } from '../../../../../lib/session'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import { useConfirmLeave } from '../../partnerUi'
import { errorText } from '../../errorText'

interface CategoryGroup {
  category: string
  label: string
  products: CatalogueProduct[]
}

/** Mengen eines Wochentags: `productSlug` → Stückzahl. */
type Quantities = Record<string, number>
/** Alle Wochentage: ISO-Wochentag → Mengen. */
type QuantityMap = Record<number, Quantities>

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Obergrenze je Position - dieselbe wie bei Besuchen (`MAX_ITEM_QTY` der API). */
const MAX_TEMPLATE_QTY = 10000

/** „1 Position“, „3 Positionen“. */
function positionsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Position' : 'Positionen'}`
}

/** Nur Positionen mit Menge > 0 - `0` heißt „nicht Teil der Bestückung“. */
function withoutEmpty(quantities: Quantities): Quantities {
  const result: Quantities = {}
  for (const [slug, quantity] of Object.entries(quantities)) {
    if (quantity > 0) result[slug] = quantity
  }
  return result
}

function sameQuantities(a: Quantities, b: Quantities): boolean {
  const left = withoutEmpty(a)
  const right = withoutEmpty(b)
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => left[key] === right[key])
}

function cloneMap(source: QuantityMap): QuantityMap {
  const result: QuantityMap = {}
  for (const [weekday, quantities] of Object.entries(source)) {
    result[Number(weekday)] = { ...quantities }
  }
  return result
}

export default function TemplatesClient({
  partnerId,
  catalogue,
  groups,
}: {
  partnerId: string
  catalogue: CatalogueProduct[]
  groups: CategoryGroup[]
}) {
  // F4: die Standard-Bestückung schreibt nur der Inhaber (B6, PUT
  // …/templates/:weekday). Verkauf sieht sie zum Nachschlagen. Ohne Sitzung
  // (Specs) wie bisher.
  const role = useOptionalSession()?.user?.role
  const canEdit = !role || role === 'inhaber'
  const [partner, setPartner] = useState<Partner | null>(null)
  const [saved, setSaved] = useState<QuantityMap>({})
  const [drafts, setDrafts] = useState<QuantityMap>({})
  const [weekday, setWeekday] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  // Standard: nur die Positionen des Tages (r1: sonst standen alle 56
  // Katalogprodukte als „0“ da und die vier echten Positionen gingen unter).
  const [showAll, setShowAll] = useState(false)
  // Zeilen, die in dieser Sitzung bearbeitet wurden (`Wochentag:slug`): sie
  // bleiben stehen, auch wenn ihre Menge auf 0 geht oder die Suche geleert
  // wird - sonst verschwände eine Zeile mitten im Tippen.
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [copyAnchor, setCopyAnchor] = useState<HTMLElement | null>(null)
  const [pendingCopy, setPendingCopy] = useState<number | null>(null)
  const [notice, setNotice] = useState<{
    message: string
    severity: 'success' | 'info'
  } | null>(null)

  const productBySlug = useMemo(() => {
    const map = new Map<string, CatalogueProduct>()
    for (const product of catalogue) map.set(product.productSlug, product)
    return map
  }, [catalogue])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [partnerData, templateData] = await Promise.all([
        fetchPartner(partnerId),
        fetchTemplates(partnerId),
      ])
      setPartner(partnerData ?? null)

      const stored: QuantityMap = {}
      for (const template of templateData ?? []) {
        const quantities: Quantities = {}
        for (const item of template.items ?? []) {
          if (item && item.quantity > 0) {
            quantities[item.productSlug] = item.quantity
          }
        }
        stored[template.weekday] = quantities
      }
      setSaved(stored)
      setDrafts(cloneMap(stored))
    } catch (err) {
      setError(errorText(err, 'Vorlagen konnten nicht geladen werden'))
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    load()
  }, [load])

  /** Liefertage des Partners; ohne Angabe stehen alle Wochentage zur Wahl. */
  const weekdays = useMemo(() => {
    const configured = (partner?.deliveryDays ?? []).filter(
      (day) => Number.isInteger(day) && day >= 1 && day <= 7
    )
    const unique = configured
      .filter((day, index) => configured.indexOf(day) === index)
      .sort((a, b) => a - b)
    return unique.length > 0 ? unique : ALL_WEEKDAYS
  }, [partner])

  const hasDeliveryDays = (partner?.deliveryDays ?? []).length > 0

  // Erst nach dem Laden einen Wochentag wählen. Solange der Partner unbekannt
  // ist, stehen alle sieben Tage zur Wahl - würde hier schon Montag gesetzt,
  // rendern die Tabs für einen Frame mit einem Wert, den es bei Di-Sa nicht
  // gibt, und MUI meldet einen ungültigen Tabs-Value.
  useEffect(() => {
    if (loading) return
    setWeekday((current) =>
      current != null && weekdays.includes(current) ? current : weekdays[0]
    )
  }, [weekdays, loading])

  const currentDraft = useMemo<Quantities>(
    () => (weekday != null ? drafts[weekday] ?? {} : {}),
    [drafts, weekday]
  )

  const dirtyDays = useMemo(
    () =>
      weekdays.filter(
        (day) => !sameQuantities(drafts[day] ?? {}, saved[day] ?? {})
      ),
    [weekdays, drafts, saved]
  )
  const isDirty = weekday != null && dirtyDays.includes(weekday)

  // Ungespeicherte Mengen nicht stillschweigend verlieren - auch nicht über
  // den Rücklink oder die Seitenleiste (beforeunload greift dort nicht).
  useConfirmLeave(
    dirtyDays.length > 0,
    'Es gibt ungespeicherte Mengen. Seite trotzdem verlassen?'
  )

  const positionsOf = useCallback(
    (day: number) => Object.keys(withoutEmpty(drafts[day] ?? {})).length,
    [drafts]
  )

  const summary = useMemo(() => {
    let positions = 0
    let units = 0
    let value = 0
    for (const [slug, quantity] of Object.entries(currentDraft)) {
      if (!(quantity > 0)) continue
      positions += 1
      units += quantity
      const product = productBySlug.get(slug)
      if (product) value += product.unitPrice * quantity
    }
    return { positions, units, value }
  }, [currentDraft, productBySlug])

  /** Positionen aus der gespeicherten Vorlage, die es im Katalog nicht mehr gibt. */
  const unknownSlugs = useMemo(
    () =>
      Object.keys(withoutEmpty(currentDraft)).filter(
        (slug) => !productBySlug.has(slug)
      ),
    [currentDraft, productBySlug]
  )

  const setQuantity = (slug: string, value: number) => {
    if (weekday == null) return
    setNotice(null)
    const key = `${weekday}:${slug}`
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    setDrafts((prev) => {
      const day = { ...(prev[weekday] ?? {}) }
      if (value > 0) day[slug] = value
      else delete day[slug]
      return { ...prev, [weekday]: day }
    })
  }

  const applyCopy = (source: number) => {
    if (weekday == null || source === weekday) return
    const copied = { ...(drafts[source] ?? {}) }
    setDrafts((prev) => ({ ...prev, [weekday]: copied }))
    // Stimmt das Ergebnis mit der gespeicherten Vorlage überein, gibt es
    // nichts zu speichern - dann nicht „nicht gespeichert“ melden.
    setNotice({
      message: sameQuantities(copied, saved[weekday] ?? {})
        ? `Von ${WEEKDAY_LABELS[source]} übernommen - entspricht der gespeicherten Vorlage`
        : `Von ${WEEKDAY_LABELS[source]} übernommen - nicht gespeichert`,
      severity: 'info',
    })
  }

  const handleCopySelect = (source: number) => {
    setCopyAnchor(null)
    if (!Number.isFinite(source) || source === weekday) return
    // Gleiche Mengen: keine Rückfrage, nichts ändern - nur sagen, warum.
    if (sameQuantities(drafts[source] ?? {}, currentDraft)) {
      setNotice({
        message: `${WEEKDAY_LABELS[source]} hat dieselben Mengen - nichts geändert`,
        severity: 'info',
      })
      return
    }
    if (summary.positions > 0) {
      setPendingCopy(source)
      return
    }
    applyCopy(source)
  }

  const handleReset = () => {
    if (weekday == null) return
    setDrafts((prev) => ({ ...prev, [weekday]: { ...(saved[weekday] ?? {}) } }))
    setSaveError(null)
  }

  const handleSave = async () => {
    if (weekday == null) return
    const day = drafts[weekday] ?? {}
    // In Katalog-Reihenfolge speichern und nur Positionen mit Menge > 0.
    const items: TemplateItem[] = catalogue
      .map((product) => ({
        productId: product.productId,
        productSlug: product.productSlug,
        quantity: day[product.productSlug] ?? 0,
      }))
      .filter((item) => item.quantity > 0)

    const tooMany = items.find((item) => item.quantity > MAX_TEMPLATE_QTY)
    if (tooMany) {
      const name =
        catalogue.find((p) => p.productSlug === tooMany.productSlug)
          ?.productName ?? tooMany.productSlug
      setSaveError(
        `${name}: ${tooMany.quantity.toLocaleString(
          'de-DE'
        )} Stück sind zu viel - höchstens ${MAX_TEMPLATE_QTY.toLocaleString(
          'de-DE'
        )} je Position. Bitte die Menge prüfen.`
      )
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await saveTemplate(partnerId, weekday, items)
      const persisted: Quantities = {}
      for (const item of items) persisted[item.productSlug] = item.quantity
      setSaved((prev) => ({ ...prev, [weekday]: persisted }))
      setDrafts((prev) => ({ ...prev, [weekday]: { ...persisted } }))
      setNotice({
        message: `${WEEKDAY_LABELS[weekday]} gespeichert`,
        severity: 'success',
      })
    } catch (err) {
      setSaveError(errorText(err, 'Vorlage konnte nicht gespeichert werden'))
    } finally {
      setSaving(false)
    }
  }

  const needle = search.trim().toLowerCase()
  /**
   * Hat der Tag noch keine gespeicherte Bestückung, steht der ganze Katalog
   * da (Erstbestückung). Sonst nur die Positionen des Tages; weitere Produkte
   * über die Suche (durchsucht immer den ganzen Katalog) oder „Alle Produkte
   * zeigen“.
   */
  const savedPositions =
    weekday != null ? Object.keys(withoutEmpty(saved[weekday] ?? {})).length : 0
  // Erstbestückung: wer schreiben darf, sieht den ganzen Katalog. Wer nur
  // nachschlägt, bekommt keine 56 gesperrten Nullen, sondern „nichts
  // hinterlegt“.
  const firstStocking = canEdit && savedPositions === 0
  const listAll = showAll || firstStocking
  const visibleGroups = useMemo(() => {
    const savedDay = weekday != null ? saved[weekday] ?? {} : {}
    return groups
      .map((group) => ({
        ...group,
        products: group.products.filter((product) => {
          const slug = product.productSlug
          if (needle) return product.productName.toLowerCase().includes(needle)
          if (listAll) return true
          return (
            (currentDraft[slug] ?? 0) > 0 ||
            (savedDay[slug] ?? 0) > 0 ||
            touched.has(`${weekday}:${slug}`)
          )
        }),
      }))
      .filter((group) => group.products.length > 0)
  }, [groups, currentDraft, saved, weekday, touched, listAll, needle])
  const visibleCount = visibleGroups.reduce(
    (sum, group) => sum + group.products.length,
    0
  )

  const subtitle = partner?.name
    ? canEdit
      ? `${partner.name} · feste Liefermengen je Wochentag`
      : `${partner.name} · nur zum Nachschlagen - die Standard-Bestückung ändert nur der Inhaber.`
    : 'Feste Liefermengen je Wochentag'
  const layoutProps = {
    title: 'Standard-Bestückung',
    width: 'narrow' as const,
    back: { href: `/admin/partners/${partnerId}`, label: 'Zurück zum Partner' },
  }

  if (loading) {
    return (
      <PageLayout {...layoutProps} subtitle="Feste Liefermengen je Wochentag">
        <LoadingState label="Vorlagen werden geladen …" />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout {...layoutProps} subtitle="Feste Liefermengen je Wochentag">
        <ErrorState message={error} onRetry={load} />
      </PageLayout>
    )
  }

  const summaryText = `${positionsLabel(summary.positions)} · ${
    summary.units
  } Stück · Warenwert ${formatCurrency(summary.value)}`
  const copyTargets = weekdays.filter((day) => day !== weekday)
  const copyAction =
    canEdit && copyTargets.length > 0 ? (
      <>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={(event) => setCopyAnchor(event.currentTarget)}
          disabled={saving}
          aria-haspopup="menu"
          aria-expanded={copyAnchor ? 'true' : undefined}
          aria-controls={copyAnchor ? 'copy-day-menu' : undefined}
        >
          Von anderem Tag übernehmen
        </Button>
        <Menu
          id="copy-day-menu"
          anchorEl={copyAnchor}
          open={copyAnchor != null}
          onClose={() => setCopyAnchor(null)}
        >
          {copyTargets.map((day) => (
            <MenuItem key={day} onClick={() => handleCopySelect(day)}>
              {WEEKDAY_LABELS[day]} ({positionsLabel(positionsOf(day))})
            </MenuItem>
          ))}
        </Menu>
      </>
    ) : undefined

  return (
    <PageLayout
      {...layoutProps}
      subtitle={subtitle}
      status={
        canEdit ? undefined : (
          <Chip size="small" variant="outlined" label="Nur Ansicht" />
        )
      }
    >
      {!hasDeliveryDays && (
        <Alert severity="info">
          Für diesen Partner sind keine Liefertage hinterlegt – es stehen alle
          Wochentage zur Auswahl.
        </Alert>
      )}

      {catalogue.length === 0 && (
        <Alert severity="warning">
          Es sind keine lieferbaren Produkte im Produktkatalog. Ohne Katalog
          lässt sich keine Bestückung pflegen.
        </Alert>
      )}

      <PageSection
        title="Liefermengen je Wochentag"
        actions={copyAction}
        disablePadding
      >
        <Tabs
          value={weekday ?? false}
          onChange={(_event, value: number) => {
            setWeekday(value)
            setNotice(null)
          }}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Wochentage"
          sx={{ borderBottom: 1, borderColor: 'divider', px: { md: 1 } }}
        >
          {weekdays.map((day) => (
            <Tab
              key={day}
              value={day}
              id={`weekday-tab-${day}`}
              aria-controls={`weekday-panel-${day}`}
              sx={{ minHeight: 48, minWidth: { xs: 64, sm: 90 } }}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box component="span">{WEEKDAY_SHORT[day]}</Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {positionsOf(day)}
                  </Box>
                  {dirtyDays.includes(day) && (
                    <Box
                      component="span"
                      aria-label="ungespeicherte Änderungen"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'warning.main',
                      }}
                    />
                  )}
                </Stack>
              }
            />
          ))}
        </Tabs>

        {/* Summe des gewählten Tags (der Tag selbst steht im Reiter), dann
            suchen und „Alle Produkte zeigen“. Übernehmen steht im Kopf. */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            px: { xs: 2, md: 3 },
            py: 2,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="template-summary"
            sx={{
              flexBasis: '100%',
              mb: 0.5,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {summaryText} zu aktuellen Preisen
          </Typography>
          <TextField
            size="small"
            label="Produkt suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: '1 1 220px' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {!firstStocking && (
            <FormControlLabel
              control={
                <Switch
                  checked={showAll}
                  onChange={(event) => setShowAll(event.target.checked)}
                />
              }
              label="Alle Produkte zeigen"
              sx={{ mr: 0, minHeight: 44 }}
            />
          )}
        </Box>

        {unknownSlugs.length > 0 && (
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
            <Alert severity="warning">
              {unknownSlugs.length} Position(en) der gespeicherten Vorlage
              stehen nicht mehr im Produktkatalog ({unknownSlugs.join(', ')})
              und werden beim Speichern entfernt.
            </Alert>
          </Box>
        )}

        <Box
          role="tabpanel"
          id={`weekday-panel-${weekday ?? 'none'}`}
          aria-labelledby={`weekday-tab-${weekday ?? 'none'}`}
        >
          {visibleGroups.length === 0 ? (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
              <EmptyState
                title={
                  needle
                    ? 'Kein Produkt passt zur Suche.'
                    : catalogue.length === 0
                    ? 'Keine Produkte im Katalog.'
                    : `Für ${
                        weekday != null ? WEEKDAY_LABELS[weekday] : 'diesen Tag'
                      } ist keine Bestückung hinterlegt.`
                }
              />
            </Box>
          ) : (
            visibleGroups.map((group) => {
              const groupUnits = group.products.reduce(
                (sum, product) =>
                  sum + (currentDraft[product.productSlug] ?? 0),
                0
              )
              const groupPositions = group.products.filter(
                (product) => (currentDraft[product.productSlug] ?? 0) > 0
              ).length

              return (
                <Box key={group.category} component="section">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 1,
                      px: { xs: 2, md: 3 },
                      pt: 2,
                      pb: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      fontWeight={600}
                    >
                      {group.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {positionsLabel(groupPositions)} · {groupUnits} Stück
                    </Typography>
                  </Box>

                  {group.products.map((product) => {
                    const quantity = currentDraft[product.productSlug] ?? 0
                    return (
                      <Box
                        key={product.productSlug}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, md: 2 },
                          px: { xs: 2, md: 3 },
                          py: 1,
                        }}
                      >
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={quantity > 0 ? 600 : 400}
                            noWrap
                          >
                            {product.productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatCurrency(product.unitPrice)} je Stück
                            {quantity > 0 &&
                              ` · ${formatCurrency(
                                product.unitPrice * quantity
                              )}`}
                          </Typography>
                        </Box>
                        {canEdit ? (
                          <TextField
                            type="number"
                            size="small"
                            value={quantity > 0 ? String(quantity) : ''}
                            placeholder="0"
                            error={quantity > MAX_TEMPLATE_QTY}
                            onChange={(event) => {
                              const parsed = parseInt(event.target.value, 10)
                              setQuantity(
                                product.productSlug,
                                Number.isFinite(parsed) && parsed > 0
                                  ? parsed
                                  : 0
                              )
                            }}
                            inputProps={{
                              min: 0,
                              max: MAX_TEMPLATE_QTY,
                              step: 1,
                              inputMode: 'numeric',
                              'aria-label': `Menge ${product.productName}`,
                              style: { textAlign: 'right' },
                            }}
                            sx={{
                              width: 96,
                              flexShrink: 0,
                              '& .MuiInputBase-root': { minHeight: 44 },
                            }}
                          />
                        ) : (
                          // Nur Ansicht: Menge als Text statt eines gesperrten
                          // Felds (graue Ziffern lagen unter 4,5:1).
                          <Typography
                            variant="body2"
                            fontWeight={quantity > 0 ? 600 : 400}
                            color={
                              quantity > 0 ? 'text.primary' : 'text.secondary'
                            }
                            aria-label={`Menge ${product.productName}`}
                            sx={{
                              flexShrink: 0,
                              minWidth: 72,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {quantity > 0 ? `${quantity} Stück` : '–'}
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )
            })
          )}
          {!listAll && !needle && visibleCount < catalogue.length && (
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                '@media print': { display: 'none' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {canEdit
                    ? 'Weiteres Produkt aufnehmen: oben suchen oder'
                    : 'Gezeigt sind nur die Positionen dieses Tages.'}
                </Typography>
                <Button size="small" onClick={() => setShowAll(true)}>
                  Alle {catalogue.length} Produkte zeigen
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {canEdit && (
          // Speichern bleibt am Handy in Reichweite, auch am Ende einer
          // langen Liste.
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1,
              px: { xs: 2, md: 3 },
              py: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              backgroundImage: 'inherit',
              '@media print': { display: 'none' },
            }}
          >
            {saveError && (
              <Alert
                severity="error"
                sx={{ flexBasis: '100%' }}
                action={
                  <Button color="inherit" size="small" onClick={handleSave}>
                    Erneut versuchen
                  </Button>
                }
              >
                {saveError}
              </Alert>
            )}
            {/* Rückmeldung in der Leiste statt als Snackbar - die lag sonst
                4 s lang über Speichern/Zurücksetzen. */}
            <Typography
              variant="body2"
              role="status"
              color={
                notice?.severity === 'success'
                  ? 'success.main'
                  : isDirty
                  ? 'warning.main'
                  : 'text.secondary'
              }
              sx={{ mr: 'auto', minWidth: 0 }}
            >
              {notice?.message ??
                (isDirty ? 'Nicht gespeichert' : 'Gespeichert')}
            </Typography>
            <Button
              startIcon={<UndoIcon />}
              onClick={handleReset}
              disabled={!isDirty || saving}
              aria-label="Zurücksetzen"
              sx={{
                minWidth: 44,
                '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
              >
                Zurücksetzen
              </Box>
            </Button>
            <Button
              variant="contained"
              startIcon={
                saving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={handleSave}
              disabled={!isDirty || saving || weekday == null}
            >
              {saving ? 'Speichert …' : 'Speichern'}
            </Button>
          </Box>
        )}
      </PageSection>

      <Dialog
        open={pendingCopy != null}
        onClose={() => setPendingCopy(null)}
        aria-labelledby="copy-dialog-title"
      >
        <DialogTitle id="copy-dialog-title">Mengen übernehmen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingCopy != null && weekday != null
              ? `Die aktuellen Mengen für ${
                  WEEKDAY_LABELS[weekday]
                } (${positionsLabel(
                  summary.positions
                )}) werden durch die Mengen von ${
                  WEEKDAY_LABELS[pendingCopy]
                } ersetzt. Gespeichert wird erst mit „Speichern“.`
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingCopy(null)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (pendingCopy != null) applyCopy(pendingCopy)
              setPendingCopy(null)
            }}
          >
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  )
}
