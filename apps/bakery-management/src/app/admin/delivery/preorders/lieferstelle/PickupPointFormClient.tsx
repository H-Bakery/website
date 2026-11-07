'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material'
import { Save as SaveIcon } from '@mui/icons-material'
import {
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import { useOptionalSession } from '../../../../../lib/session'
import {
  STALE_PICKUP_POINT,
  fetchPickupPoints,
  listPreorders,
  preorderErrorCode,
  preorderErrorMessage,
  savePickupPoint,
} from '../../../../../lib/preordersApi'
import { toBusinessDate } from '../../../../../lib/partnerTypes'
import {
  MOERSBACH_POINT_ID,
  preferredPickupPoint,
} from '../../../../../lib/abholliste'
import {
  PICKUP_POINT_MAX_LENGTH,
  formatShortDate,
  type PickupPointInput,
} from '../../../../../lib/preordersTypes'
import {
  DELIVERY_WEEKDAY_LABELS,
  PickupPoint,
  formatPickupAddress,
  hasPickupAddress,
  moersbachListHref,
} from '../preorderTypes'

const messageOf = preorderErrorMessage

export interface PickupPointFormClientProps {
  /** Sammelstelle aus der URL - sonst die erste aktive. */
  initialPickupPointId?: string
}

/**
 * Stammdaten einer Sammelstelle: Adresse, Liefertag, Übergabefenster,
 * Bestellschluss.
 *
 * Seit P2 über `PUT /api/preorders/pickup-points/:id` - ändern darf nur der
 * Inhaber (API: 403), alle anderen sehen die Stammdaten **schreibgeschützt**
 * (W4: Felder, nicht nur der Knopf). Die echte API sucht keine Koordinaten
 * (kein Nominatim auf der Box): eine geänderte Adresse verliert ihre
 * Koordinaten, die Abholliste druckt die Adresse als Text.
 *
 * Gespeichert wird mit `expectedUpdatedAt` (Stand beim Laden): hat jemand
 * die Sammelstelle inzwischen geändert, antwortet die API 409
 * `stale_pickup_point`, und die Maske bietet „Neu laden“ an, statt die
 * fremde Änderung zu überschreiben.
 */
export default function PickupPointFormClient({
  initialPickupPointId,
}: PickupPointFormClientProps) {
  const router = useRouter()
  const session = useOptionalSession()
  const canEdit = session?.user?.role === 'inhaber'
  /** Für alle außer dem Inhaber: lesen ja, tippen nein. */
  const readOnly = canEdit ? undefined : { readOnly: true }

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('')
  const [weekday, setWeekday] = useState(6)
  const [handoverWindow, setHandoverWindow] = useState('')
  const [deadlineWeekday, setDeadlineWeekday] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [staleSave, setStaleSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  /** Deaktiviert, aber noch offene Bestellungen (W4-verify r4). */
  const [openAfterDeactivate, setOpenAfterDeactivate] = useState<{
    count: number
    dates: string[]
  } | null>(null)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )
  const pointIdRef = useRef(pointId)
  pointIdRef.current = pointId

  const apply = useCallback((next: PickupPoint) => {
    setPointId(next.id)
    setName(next.name ?? '')
    setStreet(next.street ?? '')
    setZip(next.zip ?? '')
    setCity(next.city ?? '')
    setWeekday(Number.isFinite(next.weekday) ? next.weekday : 6)
    setHandoverWindow(next.window ?? '')
    setDeadlineWeekday(
      next.orderDeadline ? String(next.orderDeadline.weekday) : ''
    )
    setDeadlineTime(next.orderDeadline ? next.orderDeadline.time : '')
    setNotes(next.notes ?? '')
    setActive(next.active !== false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setSaveError(null)
    setStaleSave(false)
    try {
      const list = await fetchPickupPoints()
      setPoints(list)
      // Nach „Neu laden“ bei derselben Sammelstelle bleiben.
      const first =
        list.find((p) => p.id === pointIdRef.current) ??
        list.find((p) => p.id === initialPickupPointId) ??
        // Ohne Kennung Mörsbach wie die Liste (UI-Runde 1).
        preferredPickupPoint(list, { preferId: MOERSBACH_POINT_ID }) ??
        list[0] ??
        null
      if (first) apply(first)
    } catch (err) {
      setLoadError(
        messageOf(err, 'Die Sammelstelle konnte nicht geladen werden')
      )
    } finally {
      setLoading(false)
    }
  }, [initialPickupPointId, apply])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    setSaveError(null)
    setStaleSave(false)
    setSaved(false)
    if (!pointId || !canEdit) return

    // Bestellschluss ist entweder ganz gesetzt oder gar nicht - ein halber
    // Eintrag ergäbe eine Uhrzeit ohne Tag.
    const hasDeadline = deadlineWeekday !== '' && deadlineTime !== ''
    const payload: PickupPointInput = {
      name: name.trim(),
      street: street.trim(),
      zip: zip.trim(),
      city: city.trim(),
      weekday,
      window: handoverWindow.trim() || null,
      orderDeadline: hasDeadline
        ? { weekday: Number(deadlineWeekday), time: deadlineTime }
        : null,
      notes: notes.trim() || null,
      active,
    }

    setSaving(true)
    try {
      const updated = await savePickupPoint(
        pointId,
        payload,
        point?.updatedAt ?? null
      )
      setPoints((current) =>
        current.map((p) => (p.id === updated.id ? updated : p))
      )
      apply(updated)
      setSaved(true)
      setOpenAfterDeactivate(null)
      if (point?.active !== false && updated.active === false) {
        // Schon gebuchte Bestellungen bleiben bestehen und in der Abholliste
        // ihres Tages wählbar - aber das muss jemand wissen (W4-verify r4).
        listPreorders({
          from: toBusinessDate(new Date()),
          pickupPointId: updated.id,
          status: ['offen', 'bereit'],
        })
          .then((open) => {
            if (open.length === 0) return
            const dates = Array.from(
              new Set(open.map((p) => p.pickupDate))
            ).sort()
            setOpenAfterDeactivate({ count: open.length, dates })
          })
          .catch(() => {
            setOpenAfterDeactivate({ count: -1, dates: [] })
          })
      }
      router.refresh()
    } catch (err) {
      setStaleSave(preorderErrorCode(err) === STALE_PICKUP_POINT)
      setSaveError(
        messageOf(err, 'Die Sammelstelle konnte nicht gespeichert werden')
      )
    } finally {
      setSaving(false)
    }
  }

  // Zurück auf die Liste dieser Sammelstelle, nicht auf die erste.
  const listHref = moersbachListHref(null, false, pointId)
  const back = { href: listHref, label: 'Zurück zur Liste' }

  if (loading) {
    return (
      <PageLayout width="narrow" title="Sammelstelle" back={back}>
        <LoadingState label="Sammelstelle wird geladen …" />
      </PageLayout>
    )
  }

  return (
    <PageLayout
      width="narrow"
      title="Sammelstelle"
      back={back}
      subtitle={
        !point
          ? 'Keine Sammelstelle angelegt'
          : hasPickupAddress(point)
          ? `${point.name} · ${formatPickupAddress(point)}`
          : `${point.name} · Straße noch nicht hinterlegt${
              point.city ? ` · ${point.city}` : ''
            }`
      }
      status={
        point && point.active === false ? (
          <Chip label="inaktiv" variant="outlined" />
        ) : undefined
      }
    >
      {loadError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {!loadError && !point && (
        <Alert severity="info">Es ist keine Sammelstelle angelegt.</Alert>
      )}

      {saved && (
        <Alert severity="success" onClose={() => setSaved(false)}>
          Die Sammelstelle wurde gespeichert.
        </Alert>
      )}
      {openAfterDeactivate && (
        <Alert
          severity="warning"
          data-testid="pickup-point-open-after-deactivate"
          onClose={() => setOpenAfterDeactivate(null)}
        >
          {openAfterDeactivate.count > 0
            ? `Die Sammelstelle ist jetzt inaktiv, hat aber noch ${
                openAfterDeactivate.count
              } offene ${
                openAfterDeactivate.count === 1
                  ? 'Vorbestellung'
                  : 'Vorbestellungen'
              } (${openAfterDeactivate.dates
                .map(formatShortDate)
                .join(', ')}). `
            : 'Die Sammelstelle ist jetzt inaktiv. Ob dort noch Vorbestellungen offen sind, ließ sich nicht prüfen. '}
          Gebuchte Bestellungen bleiben bestehen und stehen in der Abholliste
          ihres Tages unter „{name.trim() || point?.name} (inaktiv)“ - bitte die
          Kundschaft benachrichtigen oder die Bestellungen umbuchen.
        </Alert>
      )}
      {!canEdit && point && (
        <Alert severity="info">
          Nur der Inhaber kann die Sammelstelle ändern.
        </Alert>
      )}
      {saveError && (
        <Alert
          severity={staleSave ? 'warning' : 'error'}
          action={
            staleSave ? (
              <Button
                color="inherit"
                size="small"
                onClick={load}
                sx={{ minHeight: 44 }}
              >
                Neu laden
              </Button>
            ) : undefined
          }
        >
          {saveError}
        </Alert>
      )}

      {point && (
        <>
          {points.length > 1 && (
            <TextField
              select
              label="Sammelstelle"
              value={pointId}
              onChange={(event) => {
                const next = points.find((p) => p.id === event.target.value)
                if (next) apply(next)
              }}
              size="small"
              sx={{ minWidth: 240, alignSelf: 'flex-start' }}
            >
              {points.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <PageSection title="Adresse" description="Steht auf der Abholliste.">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required={canEdit}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                  inputProps={{ maxLength: PICKUP_POINT_MAX_LENGTH.name }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Straße und Hausnummer"
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                  inputProps={{ maxLength: PICKUP_POINT_MAX_LENGTH.street }}
                />
              </Grid>
              <Grid item xs={5} sm={4}>
                <TextField
                  label="PLZ"
                  value={zip}
                  onChange={(event) => setZip(event.target.value)}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                  inputProps={{
                    maxLength: PICKUP_POINT_MAX_LENGTH.zip,
                    inputMode: 'numeric',
                  }}
                />
              </Grid>
              <Grid item xs={7} sm={12}>
                <TextField
                  label="Ort"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                  inputProps={{ maxLength: PICKUP_POINT_MAX_LENGTH.city }}
                />
              </Grid>
            </Grid>
          </PageSection>

          <PageSection title="Lieferung und Bestellschluss">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Liefertag"
                  value={String(weekday)}
                  onChange={(event) => setWeekday(Number(event.target.value))}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                >
                  {Object.entries(DELIVERY_WEEKDAY_LABELS).map(
                    ([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    )
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Übergabefenster"
                  value={handoverWindow}
                  onChange={(event) => setHandoverWindow(event.target.value)}
                  fullWidth
                  size="small"
                  placeholder="09:00-09:30"
                  helperText={canEdit ? 'z. B. 09:00-09:30' : undefined}
                  InputProps={readOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Bestellschluss am"
                  value={deadlineWeekday}
                  onChange={(event) => setDeadlineWeekday(event.target.value)}
                  fullWidth
                  size="small"
                  InputProps={readOnly}
                >
                  <MenuItem value="">Kein Bestellschluss</MenuItem>
                  {Object.entries(DELIVERY_WEEKDAY_LABELS).map(
                    ([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    )
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bestellschluss um"
                  type="time"
                  value={deadlineTime}
                  onChange={(event) => setDeadlineTime(event.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={readOnly}
                />
              </Grid>
            </Grid>
          </PageSection>

          <PageSection title="Notizen und Status">
            <TextField
              label="Notizen"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
              InputProps={readOnly}
              inputProps={{ maxLength: PICKUP_POINT_MAX_LENGTH.notes }}
              helperText={
                canEdit
                  ? `${notes.length} / ${PICKUP_POINT_MAX_LENGTH.notes} Zeichen`
                  : undefined
              }
            />
            <FormControlLabel
              sx={{ mt: 1, minHeight: 44 }}
              control={
                <Switch
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  disabled={!canEdit}
                />
              }
              label="Aktiv"
            />
          </PageSection>

          {canEdit && (
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <Button onClick={() => router.push(listHref)} disabled={saving}>
                Abbrechen
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSubmit}
                disabled={saving}
              >
                Speichern
              </Button>
            </Box>
          )}
        </>
      )}
    </PageLayout>
  )
}
