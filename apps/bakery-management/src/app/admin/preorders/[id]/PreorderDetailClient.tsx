'use client'

import React, { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Link,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  CheckCircleOutline as PickedUpIcon,
  Edit as EditIcon,
  EventBusy as CancelIcon,
  Inventory2 as ReadyIcon,
  Payments as PaidIcon,
  Undo as ReopenIcon,
} from '@mui/icons-material'
import PreorderForm from '../PreorderForm'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import { useOptionalSession } from '../../../../lib/session'
import {
  cancelPreorder,
  changePreorderStatus,
  getPreorder,
  isPreorderConflict,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import {
  CHANNEL_LABELS,
  canWritePreorders,
  formatCurrency,
  formatDateWithWeekday,
  formatPickupPlace,
  isCancellable,
  isEditable,
  variantLabel,
  type Preorder,
  type PreorderStatusChange,
} from '../../../../lib/preordersTypes'
import { TOUCH_LINK_STYLE } from '../../../../lib/muiTheme'

function formatTimestamp(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Box sx={{ typography: 'body1' }}>{children}</Box>
    </Box>
  )
}

/**
 * P3: eine Vorbestellung ansehen, ändern (solange offen/bereit), Status
 * setzen, stornieren (mit Rückfrage) - gelöscht wird nie. Fahrer sehen sie
 * nur; übergeben wird in der Abholliste (P2).
 */
export interface PreorderDetailClientProps {
  id: number
  /**
   * Zurück-Link (P2: die Mörsbach-Seite führt auf ihren Liefertag zurück).
   * Bekommt die geladene Bestellung, solange es eine gibt.
   */
  backHref?: (preorder: Preorder | null) => string
  backLabel?: string
}

const DEFAULT_BACK = () => '/admin/preorders'

export default function PreorderDetailClient({
  id,
  backHref = DEFAULT_BACK,
  backLabel = 'Alle Vorbestellungen',
}: PreorderDetailClientProps) {
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canWrite = canWritePreorders(role)

  const [preorder, setPreorder] = useState<Preorder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmUncancel, setConfirmUncancel] = useState(false)
  // Die geladene Fassung war überholt (anderes Gerät) - neu geladen, nichts
  // überschrieben. Steht als Hinweis, bis jemand ihn schließt.
  const [conflict, setConflict] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setPreorder(await getPreorder(id))
    } catch (err) {
      setLoadError(
        preorderErrorMessage(
          err,
          'Die Vorbestellung konnte nicht geladen werden.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const onConflict = async (message: string) => {
    setEditing(false)
    setConfirmCancel(false)
    setConfirmUncancel(false)
    setConflict(
      `${message} Es wurde nichts überschrieben - unten steht jetzt der aktuelle Stand.`
    )
    await load()
  }

  const act = async (
    work: () => Promise<Preorder>,
    success: string
  ): Promise<boolean> => {
    setBusy(true)
    setActionError(null)
    setConflict(null)
    try {
      setPreorder(await work())
      setToast(success)
      return true
    } catch (err) {
      if (isPreorderConflict(err)) {
        await onConflict(
          preorderErrorMessage(
            err,
            'Diese Vorbestellung wurde inzwischen an anderer Stelle geändert.'
          )
        )
        return false
      }
      setActionError(
        preorderErrorMessage(
          err,
          'Die Änderung konnte nicht gespeichert werden.'
        )
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  // Jede Aktion schickt die geladene Version mit: ein Klick auf veralteter
  // Anzeige (z. B. „Doch nicht bezahlt", nachdem der Fahrer kassiert hat)
  // wird abgelehnt statt still übernommen.
  const setStatus = (change: PreorderStatusChange, success: string) =>
    preorder &&
    act(
      () => changePreorderStatus(preorder.id, change, preorder.updatedAt),
      success
    )

  const doCancel = async () => {
    if (!preorder) return
    const ok = await act(
      () => cancelPreorder(preorder.id, preorder.updatedAt),
      'Die Vorbestellung wurde storniert.'
    )
    if (ok) setConfirmCancel(false)
  }

  const doUncancel = async () => {
    const ok = await setStatus(
      { status: 'offen' },
      'Storno aufgehoben - die Bestellung ist wieder offen.'
    )
    if (ok) setConfirmUncancel(false)
  }

  if (loading && !preorder) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
        role="status"
        aria-label="Vorbestellung wird geladen"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!preorder) {
    return (
      <Box>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {loadError ?? 'Diese Vorbestellung existiert nicht.'}
        </Alert>
        <Button
          component={NextLink}
          href={backHref(null)}
          startIcon={<BackIcon />}
        >
          Zur Liste
        </Button>
      </Box>
    )
  }

  const editable = canWrite && isEditable(preorder)

  if (editing && editable) {
    return (
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 2 }}
        >
          {preorder.code} bearbeiten
        </Typography>
        <PreorderForm
          preorder={preorder}
          onCancel={() => setEditing(false)}
          onConflict={onConflict}
          onSaved={(saved) => {
            setToast(
              saved.code !== preorder.code
                ? `Gespeichert - neuer Code ${saved.code} (Tag oder Ort geändert).`
                : 'Die Änderungen wurden gespeichert.'
            )
            setPreorder(saved)
            setEditing(false)
          }}
        />
      </Box>
    )
  }

  const actionSx = { minHeight: 48 }

  return (
    <Box>
      <Button
        component={NextLink}
        href={backHref(preorder)}
        startIcon={<BackIcon />}
        sx={{ mb: 1, minHeight: 44 }}
      >
        {backLabel}
      </Button>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.4rem', md: '2rem' },
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {preorder.code}
        </Typography>
        <PreorderStatusChip preorder={preorder} size="medium" />
        {preorder.paid && (
          <Typography color="success.main" sx={{ fontWeight: 600 }}>
            bezahlt
            {(preorder.paymentBalance ?? 0) !== 0 &&
              preorder.paidAmount != null &&
              ` (${formatCurrency(preorder.paidAmount)})`}
          </Typography>
        )}
      </Stack>

      {/* W4-Verifikation Runde 2: bezahlt, aber der Betrag stimmt nicht mehr */}
      {preorder.paid && (preorder.paymentBalance ?? 0) > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="payment-balance">
          Bereits bezahlt: {formatCurrency(preorder.paidAmount ?? 0)} - die
          Bestellung kostet jetzt {formatCurrency(preorder.total)}. Bei der
          Abholung noch{' '}
          <strong>{formatCurrency(preorder.paymentBalance ?? 0)}</strong>{' '}
          kassieren.
        </Alert>
      )}
      {preorder.paid && (preorder.paymentBalance ?? 0) < 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="payment-balance">
          {preorder.status === 'storniert'
            ? `Storniert, aber bereits bezahlt: ${formatCurrency(
                -(preorder.paymentBalance ?? 0)
              )} an die Kundschaft zurückgeben.`
            : `Bereits bezahlt: ${formatCurrency(
                preorder.paidAmount ?? 0
              )} - die Bestellung kostet jetzt ${formatCurrency(
                preorder.total
              )}. ${formatCurrency(
                -(preorder.paymentBalance ?? 0)
              )} zurückgeben.`}{' '}
          Danach „Erstattet“ tippen.
        </Alert>
      )}

      {preorder.anonymizedAt && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Diese Vorbestellung ist anonymisiert (90 Tage nach dem Abholtag) und
          lässt sich nicht mehr ändern.
        </Alert>
      )}
      {preorder.status === 'abgeholt' && canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Abgeholt - Positionen, Tag und Ort bleiben so stehen. Für eine
          Korrektur zuerst auf „Offen" zurücksetzen.
        </Alert>
      )}
      {conflict && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setConflict(null)}
          data-testid="preorder-conflict"
        >
          {conflict}
        </Alert>
      )}
      {actionError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      )}

      {canWrite && !preorder.anonymizedAt && (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={1}
          sx={{ mb: 2 }}
          role="group"
          aria-label="Aktionen"
        >
          {editable && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
              disabled={busy}
              sx={actionSx}
            >
              Bearbeiten
            </Button>
          )}
          {preorder.status === 'offen' && (
            <Button
              variant="outlined"
              startIcon={<ReadyIcon />}
              onClick={() =>
                setStatus({ status: 'bereit' }, 'Als bereit markiert.')
              }
              disabled={busy}
              sx={actionSx}
            >
              Bereitgestellt
            </Button>
          )}
          {(preorder.status === 'offen' || preorder.status === 'bereit') && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<PickedUpIcon />}
              onClick={() =>
                setStatus({ status: 'abgeholt' }, 'Als abgeholt markiert.')
              }
              disabled={busy}
              sx={actionSx}
            >
              Abgeholt
            </Button>
          )}
          {preorder.status !== 'storniert' && (
            <Button
              variant="outlined"
              startIcon={<PaidIcon />}
              onClick={() =>
                setStatus(
                  { paid: !preorder.paid },
                  preorder.paid
                    ? 'Als nicht bezahlt markiert.'
                    : 'Als bezahlt markiert.'
                )
              }
              disabled={busy}
              sx={actionSx}
            >
              {preorder.paid ? 'Doch nicht bezahlt' : 'Bezahlt'}
            </Button>
          )}
          {preorder.status === 'storniert' && preorder.paid && canWrite && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PaidIcon />}
              onClick={() =>
                setStatus(
                  { paid: false },
                  'Erstattet - die Bestellung gilt nicht mehr als bezahlt.'
                )
              }
              disabled={busy}
              sx={actionSx}
            >
              {`Erstattet (${formatCurrency(
                preorder.paidAmount ?? preorder.total
              )})`}
            </Button>
          )}
          {preorder.status !== 'storniert' &&
            preorder.paid &&
            (preorder.paymentBalance ?? 0) !== 0 && (
              <Button
                variant="contained"
                color="success"
                startIcon={<PaidIcon />}
                onClick={() =>
                  setStatus(
                    { paid: true },
                    (preorder.paymentBalance ?? 0) > 0
                      ? 'Rest kassiert - jetzt voll bezahlt.'
                      : 'Erstattet - der bezahlte Betrag stimmt wieder.'
                  )
                }
                disabled={busy}
                sx={actionSx}
              >
                {(preorder.paymentBalance ?? 0) > 0
                  ? `Rest kassiert (${formatCurrency(
                      preorder.paymentBalance ?? 0
                    )})`
                  : `Erstattet (${formatCurrency(
                      -(preorder.paymentBalance ?? 0)
                    )})`}
              </Button>
            )}
          {preorder.status !== 'offen' && preorder.status !== 'storniert' && (
            <Button
              variant="outlined"
              startIcon={<ReopenIcon />}
              onClick={() =>
                setStatus({ status: 'offen' }, 'Wieder auf „Offen" gesetzt.')
              }
              disabled={busy}
              sx={actionSx}
            >
              Auf „Offen" zurück
            </Button>
          )}
          {preorder.status === 'storniert' && (
            <Button
              variant="outlined"
              startIcon={<ReopenIcon />}
              onClick={() => setConfirmUncancel(true)}
              disabled={busy}
              sx={actionSx}
            >
              Storno aufheben
            </Button>
          )}
          {isCancellable(preorder) && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
              sx={actionSx}
            >
              Stornieren
            </Button>
          )}
        </Stack>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Field label="Kunde">{preorder.customerName || '–'}</Field>
            <Field label="Telefon">
              {preorder.customerPhone ? (
                <Link
                  href={`tel:${preorder.customerPhone.replace(/[^\d+]/g, '')}`}
                  sx={TOUCH_LINK_STYLE}
                >
                  {preorder.customerPhone}
                </Link>
              ) : (
                '–'
              )}
            </Field>
            <Field label="Abholung">
              {formatDateWithWeekday(preorder.pickupDate)} ·{' '}
              {formatPickupPlace(preorder)}
            </Field>
            <Field label="Bestellweg">{CHANNEL_LABELS[preorder.channel]}</Field>
            {preorder.afterDeadline && (
              <Field label="Bestellschluss">Nach Bestellschluss erfasst</Field>
            )}
            {preorder.note && <Field label="Notiz">{preorder.note}</Field>}
            <Field label="Erfasst">{formatTimestamp(preorder.createdAt)}</Field>
            {preorder.pickedUpAt && (
              <Field label="Abgeholt">
                {formatTimestamp(preorder.pickedUpAt)}
              </Field>
            )}
            {preorder.notCollectedAt && (
              <Field label="Nicht abgeholt seit">
                {formatTimestamp(preorder.notCollectedAt)}
              </Field>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <TableContainer component={Paper} variant="outlined">
            <Table
              size="small"
              aria-label="Positionen"
              sx={{
                // passt am Telefon (390 px) ohne seitliches Scrollen
                '& td, & th': { px: { xs: 1, sm: 2 } },
                '& td:not(:first-of-type), & th:not(:first-of-type)': {
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Artikel</TableCell>
                  <TableCell align="right">Menge</TableCell>
                  <TableCell align="right">Preis</TableCell>
                  <TableCell align="right">Summe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preorder.items.map((item) => (
                  <TableRow key={`${item.productId}|${item.variant}`}>
                    <TableCell>
                      {item.name}
                      {item.variant && (
                        <Typography
                          component="span"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          ({variantLabel(item.variant)})
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontWeight: 600 }}>
                    Gesamt
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(preorder.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            Preise wie beim Bestellen festgehalten.
          </Typography>
        </Grid>
      </Grid>

      <Dialog
        open={confirmCancel}
        onClose={() => !busy && setConfirmCancel(false)}
      >
        <DialogTitle>Vorbestellung stornieren?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {preorder.code} für {preorder.customerName} am{' '}
            {formatDateWithWeekday(preorder.pickupDate)} wird storniert. Sie
            bleibt in der Liste sichtbar und zählt nicht mehr für die Backstube.
            Gelöscht wird nichts.
          </DialogContentText>
          {preorder.paid && (
            <Alert
              severity="warning"
              sx={{ mt: 2 }}
              data-testid="cancel-refund"
            >
              Die Bestellung ist bereits bezahlt (
              {formatCurrency(preorder.paidAmount ?? preorder.total)}). Das Geld
              muss zurückgegeben werden - die Tagesübersicht führt es unter „Zu
              erstatten“.
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {actionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmCancel(false)}
            disabled={busy}
            sx={{ minHeight: 44 }}
          >
            Behalten
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={doCancel}
            disabled={busy}
            sx={{ minHeight: 44 }}
          >
            Stornieren
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmUncancel}
        onClose={() => !busy && setConfirmUncancel(false)}
      >
        <DialogTitle>Storno aufheben?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {preorder.code} für {preorder.customerName} am{' '}
            {formatDateWithWeekday(preorder.pickupDate)} wird wieder „Offen" und
            zählt dann wieder für die Backstube.
          </DialogContentText>
          {actionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {actionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmUncancel(false)}
            disabled={busy}
            sx={{ minHeight: 44 }}
          >
            Storniert lassen
          </Button>
          <Button
            variant="contained"
            onClick={doUncancel}
            disabled={busy}
            sx={{ minHeight: 44 }}
          >
            Storno aufheben
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setToast(null)}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
