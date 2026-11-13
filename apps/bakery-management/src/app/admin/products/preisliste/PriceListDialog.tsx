'use client'
import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { fetchPartners } from '../../../../lib/partnerApi'
import type { Partner } from '../../../../lib/partnerTypes'
import {
  downloadPriceListCsv,
  priceListHref,
  type PriceListAudience,
  type PriceListCategoryOption,
  type PriceListOptions,
} from '../../../../lib/priceListApi'
import { TOUCH_MEDIA } from '../../../../lib/muiTheme'
import { errorText } from '../../partners/errorText'

export interface PriceListDialogProps {
  open: boolean
  onClose: () => void
  /** Kategorien zur Auswahl (Schlüssel, Bezeichnung, Anzahl Produkte). */
  categories: PriceListCategoryOption[]
  /** Darf die Partnerliste wählen (nur Inhaber; die API setzt es durch). */
  canPartner: boolean
  /** Änderungen, die auf Freigabe warten - die Liste zeigt sie noch nicht. */
  pendingCount?: number
  /** Vorbelegung (Druckseite: „Optionen ändern“). */
  initial?: PriceListOptions
}

type PartnerState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; partners: Partner[] }
  | { phase: 'error'; message: string }

const CHIP_SX = {
  fontVariantNumeric: 'tabular-nums',
  [TOUCH_MEDIA]: { height: 44, borderRadius: 22, px: 0.5 },
} as const

/**
 * „Preisliste erstellen“: Umfang (ganzes Sortiment oder Kategorien),
 * Zielgruppe (Laden / Partner), „gültig ab“, nicht verfügbare Produkte und
 * Allergene. Führt zur Druckansicht oder lädt das CSV; gebaut wird die Liste
 * von der API.
 */
export default function PriceListDialog({
  open,
  onClose,
  categories,
  canPartner,
  pendingCount = 0,
  initial,
}: PriceListDialogProps) {
  const router = useRouter()
  const [audience, setAudience] = useState<PriceListAudience>(
    canPartner && initial?.audience === 'partner' ? 'partner' : 'laden'
  )
  const [partnerId, setPartnerId] = useState<number | null>(
    initial?.partnerId ?? null
  )
  const [selected, setSelected] = useState<string[]>(initial?.categories ?? [])
  const [validFrom, setValidFrom] = useState(initial?.validFrom ?? '')
  const [includeUnavailable, setIncludeUnavailable] = useState(
    initial?.includeUnavailable ?? false
  )
  const [allergens, setAllergens] = useState(initial?.allergens ?? false)
  const [partners, setPartners] = useState<PartnerState>({ phase: 'idle' })
  const [csv, setCsv] = useState<
    { phase: 'idle' } | { phase: 'busy' } | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  // Partner erst laden, wenn die Partnerliste gewählt ist - einmal je Dialog.
  const needPartners = open && audience === 'partner'
  const requested = useRef(false)
  useEffect(() => {
    if (!needPartners || requested.current) return
    requested.current = true
    setPartners({ phase: 'loading' })
    fetchPartners()
      .then((list) => {
        const active = list.filter((p) => p.active)
        setPartners({ phase: 'ok', partners: active })
        setPartnerId((current) =>
          current && active.some((p) => p.id === current)
            ? current
            : active.length === 1
            ? active[0].id
            : null
        )
      })
      .catch((err) => {
        setPartners({
          phase: 'error',
          message: errorText(
            err,
            'Die Verkaufspartner konnten nicht geladen werden.'
          ),
        })
      })
  }, [needPartners])

  const options: PriceListOptions = {
    audience,
    partnerId: audience === 'partner' ? partnerId : null,
    categories: selected.length > 0 ? selected : null,
    validFrom: validFrom || null,
    includeUnavailable,
    allergens,
  }
  const ready = audience === 'laden' || partnerId !== null

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
    )

  const download = async () => {
    setCsv({ phase: 'busy' })
    try {
      await downloadPriceListCsv(options)
      setCsv({ phase: 'idle' })
    } catch (err) {
      setCsv({
        phase: 'error',
        message: errorText(err, 'Das CSV konnte nicht erstellt werden.'),
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="price-list-dialog-title"
    >
      <DialogTitle id="price-list-dialog-title">
        Preisliste erstellen
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {canPartner && (
            <FormControl>
              <FormLabel id="price-list-audience">Für wen?</FormLabel>
              <RadioGroup
                row
                aria-labelledby="price-list-audience"
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as PriceListAudience)
                }
              >
                <FormControlLabel
                  value="laden"
                  control={<Radio />}
                  label="Laden und Kunden"
                />
                <FormControlLabel
                  value="partner"
                  control={<Radio />}
                  label="Verkaufspartner"
                />
              </RadioGroup>
            </FormControl>
          )}

          {audience === 'partner' && (
            <Stack spacing={1.5}>
              {partners.phase === 'loading' && (
                <Typography variant="body2" color="text.secondary">
                  Verkaufspartner werden geladen …
                </Typography>
              )}
              {partners.phase === 'error' && (
                <Alert severity="error">{partners.message}</Alert>
              )}
              {partners.phase === 'ok' && partners.partners.length === 0 && (
                <Alert severity="warning">
                  Es ist kein aktiver Verkaufspartner angelegt.
                </Alert>
              )}
              {partners.phase === 'ok' && partners.partners.length > 0 && (
                <TextField
                  select
                  label="Verkaufspartner"
                  value={partnerId ?? ''}
                  onChange={(event) => setPartnerId(Number(event.target.value))}
                >
                  {partners.partners.map((partner) => (
                    <MenuItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <Alert severity="info" data-testid="partner-price-hint">
                Die Partnerliste zeigt nur das Sortiment des Partners (seine
                Standard-Bestückung) zu den Preisen aus dem Produktkatalog - so
                rechnet die App den Backschrank ab. Eigene Partnerpreise,
                Rabatte oder ein Provisionssatz sind nicht hinterlegt.
              </Alert>
            </Stack>
          )}

          <FormControl component="fieldset">
            <FormLabel component="legend">Welche Kategorien?</FormLabel>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selected.length === 0
                ? 'Ohne Auswahl: alle Kategorien.'
                : `${selected.length} von ${categories.length} gewählt.`}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                clickable
                aria-pressed={selected.length === 0}
                color={selected.length === 0 ? 'primary' : 'default'}
                variant={selected.length === 0 ? 'filled' : 'outlined'}
                onClick={() => setSelected([])}
                label="Alle"
                sx={CHIP_SX}
              />
              {categories.map((category) => {
                const on = selected.includes(category.key)
                return (
                  <Chip
                    key={category.key}
                    clickable
                    aria-pressed={on}
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    onClick={() => toggle(category.key)}
                    label={`${category.label} ${category.count}`}
                    sx={CHIP_SX}
                  />
                )
              })}
            </Box>
          </FormControl>

          <TextField
            type="date"
            label="Gültig ab (optional)"
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Steht im Kopf der Liste. „Stand“ ist immer das heutige Datum."
            sx={{ maxWidth: 280 }}
          />

          <Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allergens}
                  onChange={(event) => setAllergens(event.target.checked)}
                />
              }
              label="Mit Allergenen"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeUnavailable}
                  onChange={(event) =>
                    setIncludeUnavailable(event.target.checked)
                  }
                />
              }
              label="Auch nicht verfügbare Produkte (gekennzeichnet)"
            />
          </Stack>

          {pendingCount > 0 && (
            <Alert severity="info">
              {pendingCount === 1
                ? '1 Änderung wartet auf Freigabe'
                : `${pendingCount} Änderungen warten auf Freigabe`}{' '}
              - die Preisliste zeigt den freigegebenen Stand.
            </Alert>
          )}
          {csv.phase === 'error' && (
            <Alert severity="error">{csv.message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Abbrechen
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={
            csv.phase === 'busy' ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <DownloadIcon />
            )
          }
          disabled={!ready || csv.phase === 'busy'}
          onClick={download}
        >
          CSV (Excel)
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          disabled={!ready}
          onClick={() => {
            onClose()
            router.push(priceListHref(options))
          }}
        >
          Ansehen und drucken
        </Button>
      </DialogActions>
    </Dialog>
  )
}
