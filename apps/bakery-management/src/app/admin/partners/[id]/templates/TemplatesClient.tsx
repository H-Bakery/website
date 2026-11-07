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
  MenuItem,
  Snackbar,
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
  const [onlyStocked, setOnlyStocked] = useState(false)
  const [copySource, setCopySource] = useState('')
  const [pendingCopy, setPendingCopy] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{
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
      setError(
        err instanceof Error
          ? err.message
          : 'Vorlagen konnten nicht geladen werden'
      )
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
    setDrafts((prev) => {
      const day = { ...(prev[weekday] ?? {}) }
      if (value > 0) day[slug] = value
      else delete day[slug]
      return { ...prev, [weekday]: day }
    })
  }

  const applyCopy = (source: number) => {
    if (weekday == null || source === weekday) return
    setDrafts((prev) => ({ ...prev, [weekday]: { ...(prev[source] ?? {}) } }))
    setSnackbar({
      message: `Mengen von ${WEEKDAY_LABELS[source]} übernommen – noch nicht gespeichert`,
      severity: 'info',
    })
  }

  const handleCopySelect = (value: string) => {
    const source = Number(value)
    setCopySource('')
    if (!Number.isFinite(source) || source === weekday) return
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
      setSnackbar({
        message: `Standard-Bestückung für ${WEEKDAY_LABELS[weekday]} gespeichert`,
        severity: 'success',
      })
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Vorlage konnte nicht gespeichert werden'
      )
    } finally {
      setSaving(false)
    }
  }

  const needle = search.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        products: group.products.filter((product) => {
          const quantity = currentDraft[product.productSlug] ?? 0
          if (onlyStocked && quantity <= 0) return false
          if (!needle) return true
          return product.productName.toLowerCase().includes(needle)
        }),
      }))
      .filter((group) => group.products.length > 0)
  }, [groups, currentDraft, onlyStocked, needle])

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
          Es sind keine lieferbaren Produkte aus HQ verfügbar. Ohne Katalog
          lässt sich keine Bestückung pflegen.
        </Alert>
      )}

      <PageSection
        title={weekday != null ? WEEKDAY_LABELS[weekday] : 'Wochentag'}
        description={`${summaryText} (HQ-Preise)`}
        disablePadding
      >
        <Tabs
          value={weekday ?? false}
          onChange={(_event, value: number) => setWeekday(value)}
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

        {/* Werkzeuge: suchen, filtern, von einem anderen Tag übernehmen */}
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
          <TextField
            size="small"
            label="Produkt suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: '1 1 200px' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {canEdit && (
            <TextField
              select
              size="small"
              label="Von anderem Tag übernehmen"
              value={copySource}
              onChange={(event) => handleCopySelect(event.target.value)}
              disabled={weekdays.length < 2 || saving}
              sx={{ flex: '1 1 200px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ContentCopyIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              {weekdays
                .filter((day) => day !== weekday)
                .map((day) => (
                  <MenuItem key={day} value={String(day)}>
                    {WEEKDAY_LABELS[day]} ({positionsLabel(positionsOf(day))})
                  </MenuItem>
                ))}
            </TextField>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={onlyStocked}
                onChange={(event) => setOnlyStocked(event.target.checked)}
              />
            }
            label="Nur bestückte"
            sx={{ mr: 0, minHeight: 44 }}
          />
        </Box>

        {unknownSlugs.length > 0 && (
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
            <Alert severity="warning">
              {unknownSlugs.length} Position(en) der gespeicherten Vorlage
              stehen nicht mehr im HQ-Katalog ({unknownSlugs.join(', ')}) und
              werden beim Speichern entfernt.
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
                  onlyStocked || needle
                    ? 'Keine Produkte für diese Filter.'
                    : 'Keine Produkte im Katalog.'
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
                        <TextField
                          type="number"
                          size="small"
                          value={quantity > 0 ? String(quantity) : ''}
                          placeholder="0"
                          disabled={!canEdit}
                          error={quantity > MAX_TEMPLATE_QTY}
                          onChange={(event) => {
                            const parsed = parseInt(event.target.value, 10)
                            setQuantity(
                              product.productSlug,
                              Number.isFinite(parsed) && parsed > 0 ? parsed : 0
                            )
                          }}
                          inputProps={{
                            min: 0,
                            max: MAX_TEMPLATE_QTY,
                            step: 1,
                            inputMode: 'numeric',
                            readOnly: !canEdit,
                            'aria-label': `Menge ${product.productName}`,
                            style: { textAlign: 'right' },
                          }}
                          sx={{
                            width: 96,
                            flexShrink: 0,
                            '& .MuiInputBase-root': { minHeight: 44 },
                          }}
                        />
                      </Box>
                    )
                  })}
                </Box>
              )
            })
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
            <Typography
              variant="body2"
              color={isDirty ? 'warning.main' : 'text.secondary'}
              sx={{ mr: 'auto' }}
            >
              {isDirty ? 'Nicht gespeichert' : 'Gespeichert'}
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

      <Snackbar
        open={snackbar != null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(null)}
          severity={snackbar?.severity ?? 'success'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  )
}
