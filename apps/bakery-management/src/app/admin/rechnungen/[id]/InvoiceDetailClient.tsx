'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  DeleteOutline as RemoveIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import {
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import InvoiceStatusChip from '../../../../components/invoices/InvoiceStatusChip'
import InvoiceView from '../../../../components/invoices/InvoiceView'
import {
  cancelInvoice,
  deleteInvoice,
  downloadInvoiceFile,
  fetchInvoiceConfig,
  formatEuro,
  formatInvoiceDate,
  getInvoice,
  invoiceErrorMessage,
  invoiceFieldErrors,
  issueInvoice,
  updateInvoice,
  type Invoice,
  type InvoiceConfig,
  type InvoiceFieldError,
  type InvoiceInput,
} from '../../../../lib/invoicesApi'

const LIST = '/admin/rechnungen'
const NO_PRINT = { '@media print': { display: 'none' } } as const

interface DraftLine {
  key: number
  productId: string
  name: string
  quantity: string
  unit: string
  unitPriceGross: string
  vatRate: number
}

interface DraftState {
  number: string
  invoiceDate: string
  deliveryDate: string
  paymentTermDays: string
  paymentText: string
  note: string
  buyerName: string
  buyerCareOf: string
  buyerStreet: string
  buyerPostcode: string
  buyerCity: string
  lines: DraftLine[]
}

let lineKey = 0
const nextKey = () => (lineKey += 1)

/** Cent als Eingabetext („1,20“) - nur Darstellung, keine Rechnung. */
function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

function toDraft(invoice: Invoice): DraftState {
  return {
    number: invoice.number ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    deliveryDate: invoice.deliveryDate ?? '',
    paymentTermDays: String(invoice.paymentTermDays),
    paymentText: invoice.paymentText,
    note: invoice.note,
    buyerName: invoice.buyer.name,
    buyerCareOf: invoice.buyer.careOf,
    buyerStreet: invoice.buyer.street,
    buyerPostcode: invoice.buyer.postcode,
    buyerCity: invoice.buyer.city,
    lines: invoice.lines.map((line) => ({
      key: nextKey(),
      productId: line.productId,
      name: line.name,
      quantity: String(line.quantity).replace('.', ','),
      unit: line.unit,
      unitPriceGross: centsToInput(line.unitPriceGrossCents),
      vatRate: line.vatRate,
    })),
  }
}

function toInput(draft: DraftState): InvoiceInput {
  return {
    number: draft.number,
    invoiceDate: draft.invoiceDate,
    deliveryDate: draft.deliveryDate,
    paymentTermDays: draft.paymentTermDays,
    paymentText: draft.paymentText,
    note: draft.note,
    buyer: {
      name: draft.buyerName,
      careOf: draft.buyerCareOf,
      street: draft.buyerStreet,
      postcode: draft.buyerPostcode,
      city: draft.buyerCity,
      countryCode: 'DE',
    },
    lines: draft.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceGross: line.unitPriceGross,
      vatRate: line.vatRate,
    })),
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Eine Rechnung. Entwurf: Formular (Nummer, Daten, Empfänger, Positionen),
 * „Speichern“, „Ausstellen“, „Entwurf löschen“. Ausgestellt oder storniert:
 * nur lesen, PDF (ZUGFeRD), XML, Drucken, Stornieren. Eine ausgestellte
 * Rechnung lässt sich nicht ändern - die API verweigert es, hier gibt es das
 * Formular dann gar nicht.
 */
export default function InvoiceDetailClient({ id }: { id: number }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [config, setConfig] = useState<InvoiceConfig | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldError[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [confirmIssue, setConfirmIssue] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const adopt = useCallback((next: Invoice) => {
    setInvoice(next)
    setDraft(next.status === 'entwurf' ? toDraft(next) : null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [loaded, loadedConfig] = await Promise.all([
        getInvoice(id),
        // Ohne Vorgaben geht es auch (7/19 % stehen dann fest da).
        fetchInvoiceConfig().catch(() => null),
      ])
      adopt(loaded)
      setConfig(loadedConfig)
    } catch (err) {
      setLoadError(
        invoiceErrorMessage(err, 'Die Rechnung konnte nicht geladen werden.')
      )
    } finally {
      setLoading(false)
    }
  }, [id, adopt])

  useEffect(() => {
    load()
  }, [load])

  const fail = (err: unknown, fallback: string) => {
    setError(invoiceErrorMessage(err, fallback))
    setFieldErrors(invoiceFieldErrors(err))
  }

  const run = async (
    work: () => Promise<void>,
    fallback: string
  ): Promise<boolean> => {
    setBusy(true)
    setError(null)
    setFieldErrors([])
    try {
      await work()
      return true
    } catch (err) {
      fail(err, fallback)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (loading && !invoice) {
    return (
      <PageLayout title="Rechnung" back={{ href: LIST, label: 'Rechnungen' }}>
        <LoadingState label="Rechnung wird geladen …" />
      </PageLayout>
    )
  }
  if (!invoice) {
    return (
      <PageLayout title="Rechnung" back={{ href: LIST, label: 'Rechnungen' }}>
        <ErrorState
          message={loadError ?? 'Diese Rechnung gibt es nicht.'}
          onRetry={load}
        />
      </PageLayout>
    )
  }

  const isDraft = invoice.status === 'entwurf' && draft !== null
  const vatRates = config?.vatRates ?? [7, 19]
  const defaultVatRate = config?.defaultVatRate ?? 7
  const errorFor = (field: string) =>
    fieldErrors.find((f) => f.field === field)?.message

  const save = () =>
    run(async () => {
      if (!draft) return
      adopt(await updateInvoice(invoice.id, toInput(draft)))
      setToast('Der Entwurf wurde gespeichert.')
    }, 'Der Entwurf konnte nicht gespeichert werden.')

  const issue = async () => {
    const ok = await run(async () => {
      if (!draft) return
      // Erst speichern, dann ausstellen: ausgestellt wird, was auf dem
      // Bildschirm steht. Scheitert das Ausstellen, bleibt der gespeicherte
      // Entwurf mit der Liste, was fehlt.
      adopt(await updateInvoice(invoice.id, toInput(draft)))
      adopt(await issueInvoice(invoice.id))
      setToast('Die Rechnung ist ausgestellt.')
    }, 'Die Rechnung konnte nicht ausgestellt werden.')
    setConfirmIssue(false)
    return ok
  }

  const remove = async () => {
    const ok = await run(async () => {
      await deleteInvoice(invoice.id)
    }, 'Der Entwurf konnte nicht gelöscht werden.')
    setConfirmDelete(false)
    if (ok) router.push(LIST)
  }

  const cancel = async () => {
    const ok = await run(async () => {
      adopt(await cancelInvoice(invoice.id, cancelReason.trim()))
      setToast('Die Rechnung wurde storniert.')
    }, 'Die Rechnung konnte nicht storniert werden.')
    if (ok) {
      setConfirmCancel(false)
      setCancelReason('')
    }
  }

  const download = (kind: 'pdf' | 'xml') =>
    run(
      () => downloadInvoiceFile(invoice, kind),
      kind === 'pdf'
        ? 'Die PDF konnte nicht geladen werden.'
        : 'Die XML konnte nicht geladen werden.'
    )

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            lines: current.lines.map((line) =>
              line.key === key ? { ...line, ...patch } : line
            ),
          }
        : current
    )

  const title = invoice.number
    ? `Rechnung ${invoice.number}`
    : 'Rechnung (Entwurf)'

  const actions = isDraft ? (
    <>
      <Button variant="outlined" onClick={save} disabled={busy}>
        Speichern
      </Button>
      <Button
        variant="contained"
        onClick={() => setConfirmIssue(true)}
        disabled={busy}
      >
        Ausstellen
      </Button>
    </>
  ) : (
    <>
      <Button
        variant="contained"
        startIcon={<DownloadIcon />}
        onClick={() => download('pdf')}
        disabled={busy}
      >
        PDF (ZUGFeRD)
      </Button>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={() => download('xml')}
        disabled={busy}
      >
        XML
      </Button>
      <Button
        variant="outlined"
        startIcon={<PrintIcon />}
        onClick={() => window.print()}
      >
        Drucken
      </Button>
      {invoice.status === 'ausgestellt' && (
        <Button
          variant="outlined"
          color="error"
          onClick={() => setConfirmCancel(true)}
          disabled={busy}
        >
          Stornieren
        </Button>
      )}
    </>
  )

  return (
    <PageLayout
      title={title}
      status={<InvoiceStatusChip status={invoice.status} />}
      subtitle={
        invoice.preorderCode
          ? `Zur Bestellung ${invoice.preorderCode}`
          : undefined
      }
      back={{ href: LIST, label: 'Rechnungen' }}
      actions={
        <Box
          role="group"
          aria-label="Aktionen"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {actions}
        </Box>
      }
    >
      {error && (
        <Alert
          severity="error"
          onClose={() => {
            setError(null)
            setFieldErrors([])
          }}
          data-testid="invoice-error"
          sx={NO_PRINT}
        >
          {error}
          {fieldErrors.length > 1 && (
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {fieldErrors.map((f, index) => (
                <li key={`${f.field}-${index}`}>{f.message}</li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {invoice.status === 'storniert' && (
        <Alert severity="error" data-testid="invoice-cancelled">
          <AlertTitle>Storniert</AlertTitle>
          Storniert am {formatTimestamp(invoice.cancelledAt)}
          {invoice.cancelReason ? ` - Grund: ${invoice.cancelReason}` : ''}.
          Diese Rechnung gilt nicht mehr; eine Korrektur ist eine neue Rechnung
          mit neuer Nummer.
        </Alert>
      )}

      {isDraft && draft && (
        <>
          {config && !config.bankConfigured && (
            <Alert severity="warning" data-testid="invoice-bank-warning">
              {config.bankMessage ??
                'Die Bankverbindung der Bäckerei ist nicht eingerichtet.'}
            </Alert>
          )}
          {invoice.missing.length > 0 && (
            <Alert severity="info" data-testid="invoice-missing">
              <AlertTitle>Zum Ausstellen fehlt noch</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {invoice.missing.map((m, index) => (
                  <li key={`${m.field}-${index}`}>{m.message}</li>
                ))}
              </Box>
            </Alert>
          )}

          <PageSection title="Rechnung">
            <Box sx={formGrid}>
              <TextField
                label="Rechnungsnummer"
                value={draft.number}
                onChange={(e) => set('number', e.target.value)}
                error={!!errorFor('number')}
                helperText={
                  errorFor('number') ??
                  'Aus dem bisherigen System übernehmen - die App zählt nicht selbst.'
                }
                inputProps={{ maxLength: 40 }}
              />
              <TextField
                label="Rechnungsdatum"
                type="date"
                value={draft.invoiceDate}
                onChange={(e) => set('invoiceDate', e.target.value)}
                error={!!errorFor('invoiceDate')}
                helperText={errorFor('invoiceDate')}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Liefer-/Leistungsdatum"
                type="date"
                value={draft.deliveryDate}
                onChange={(e) => set('deliveryDate', e.target.value)}
                error={!!errorFor('deliveryDate')}
                helperText={errorFor('deliveryDate') ?? 'Tag der Abholung'}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Zahlungsziel (Tage)"
                value={draft.paymentTermDays}
                onChange={(e) => set('paymentTermDays', e.target.value)}
                error={!!errorFor('paymentTermDays')}
                helperText={errorFor('paymentTermDays')}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Zahlungsbedingung"
                value={draft.paymentText}
                onChange={(e) => set('paymentText', e.target.value)}
                error={!!errorFor('paymentText')}
                helperText={
                  errorFor('paymentText') ??
                  'Das Fälligkeitsdatum wird automatisch angehängt.'
                }
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            </Box>
          </PageSection>

          <PageSection title="Empfänger">
            <Box sx={formGrid}>
              <TextField
                label="Name"
                value={draft.buyerName}
                onChange={(e) => set('buyerName', e.target.value)}
                error={!!errorFor('buyer.name')}
                helperText={errorFor('buyer.name')}
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
              <TextField
                label="Zusatz (z. B. c/o, z. Hd.)"
                value={draft.buyerCareOf}
                onChange={(e) => set('buyerCareOf', e.target.value)}
                error={!!errorFor('buyer.careOf')}
                helperText={errorFor('buyer.careOf')}
              />
              <TextField
                label="Straße und Hausnummer"
                value={draft.buyerStreet}
                onChange={(e) => set('buyerStreet', e.target.value)}
                error={!!errorFor('buyer.street')}
                helperText={errorFor('buyer.street')}
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
              <TextField
                label="PLZ"
                value={draft.buyerPostcode}
                onChange={(e) => set('buyerPostcode', e.target.value)}
                error={!!errorFor('buyer.postcode')}
                helperText={errorFor('buyer.postcode')}
                inputProps={{ inputMode: 'numeric', maxLength: 16 }}
              />
              <TextField
                label="Ort"
                value={draft.buyerCity}
                onChange={(e) => set('buyerCity', e.target.value)}
                error={!!errorFor('buyer.city')}
                helperText={errorFor('buyer.city')}
                sx={{ gridColumn: { sm: 'span 2' } }}
              />
            </Box>
          </PageSection>

          <PageSection
            title="Positionen"
            description={`Preise sind Bruttopreise. Der Steuersatz gilt je Position: ${defaultVatRate} % ist die Vorgabe für Backwaren zum Mitnehmen, 19 % z. B. für Getränke.`}
          >
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              data-testid="invoice-lines"
            >
              {draft.lines.length === 0 && (
                <Typography color="text.secondary">
                  Noch keine Positionen.
                </Typography>
              )}
              {draft.lines.map((line, index) => (
                <Box
                  key={line.key}
                  role="group"
                  aria-label={`Position ${index + 1}`}
                  sx={lineGrid}
                >
                  <TextField
                    label="Bezeichnung"
                    value={line.name}
                    onChange={(e) =>
                      setLine(line.key, { name: e.target.value })
                    }
                    error={!!errorFor(`lines[${index}].name`)}
                    helperText={errorFor(`lines[${index}].name`)}
                    size="small"
                  />
                  <TextField
                    label="Menge"
                    value={line.quantity}
                    onChange={(e) =>
                      setLine(line.key, { quantity: e.target.value })
                    }
                    error={!!errorFor(`lines[${index}].quantity`)}
                    helperText={errorFor(`lines[${index}].quantity`)}
                    inputProps={{ inputMode: 'decimal' }}
                    size="small"
                  />
                  <TextField
                    label="Einheit"
                    value={line.unit}
                    onChange={(e) =>
                      setLine(line.key, { unit: e.target.value })
                    }
                    error={!!errorFor(`lines[${index}].unit`)}
                    helperText={errorFor(`lines[${index}].unit`)}
                    size="small"
                  />
                  <TextField
                    label="Einzelpreis brutto (€)"
                    value={line.unitPriceGross}
                    onChange={(e) =>
                      setLine(line.key, { unitPriceGross: e.target.value })
                    }
                    error={!!errorFor(`lines[${index}].unitPriceGross`)}
                    helperText={errorFor(`lines[${index}].unitPriceGross`)}
                    inputProps={{ inputMode: 'decimal' }}
                    size="small"
                  />
                  <TextField
                    select
                    label="USt"
                    value={line.vatRate}
                    onChange={(e) =>
                      setLine(line.key, { vatRate: Number(e.target.value) })
                    }
                    error={!!errorFor(`lines[${index}].vatRate`)}
                    helperText={errorFor(`lines[${index}].vatRate`)}
                    size="small"
                  >
                    {vatRates.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value} %
                      </MenuItem>
                    ))}
                  </TextField>
                  <Tooltip title="Position entfernen">
                    <IconButton
                      aria-label={`Position ${index + 1} entfernen`}
                      onClick={() =>
                        set(
                          'lines',
                          draft.lines.filter((l) => l.key !== line.key)
                        )
                      }
                      sx={{ alignSelf: 'start' }}
                    >
                      <RemoveIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
              <Box>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() =>
                    set('lines', [
                      ...draft.lines,
                      {
                        key: nextKey(),
                        productId: '',
                        name: '',
                        quantity: '1',
                        unit: 'Stück',
                        unitPriceGross: '',
                        vatRate: defaultVatRate,
                      },
                    ])
                  }
                >
                  Position hinzufügen
                </Button>
              </Box>
            </Box>
          </PageSection>

          <PageSection title="Bemerkung">
            <TextField
              label="Bemerkung auf der Rechnung (optional)"
              value={draft.note}
              onChange={(e) => set('note', e.target.value)}
              error={!!errorFor('note')}
              helperText={errorFor('note')}
              multiline
              minRows={2}
              fullWidth
            />
          </PageSection>

          <PageSection
            title="Vorschau"
            description="Stand der letzten Speicherung - nach Änderungen erst speichern."
          >
            <InvoiceView invoice={invoice} />
          </PageSection>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" onClick={save} disabled={busy}>
              Speichern
            </Button>
            <Button
              color="error"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              Entwurf löschen
            </Button>
          </Box>
        </>
      )}

      {!isDraft && (
        <PageSection>
          <InvoiceView invoice={invoice} />
        </PageSection>
      )}

      <Dialog
        open={confirmIssue}
        onClose={() => !busy && setConfirmIssue(false)}
      >
        <DialogTitle>Rechnung ausstellen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Die Rechnung {draft?.number ? `${draft.number} ` : ''}wird
            gespeichert und ausgestellt. Danach lässt sie sich nicht mehr ändern
            - eine Korrektur geht nur über Stornieren und eine neue Rechnung.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmIssue(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="contained" onClick={issue} disabled={busy}>
            Jetzt ausstellen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
      >
        <DialogTitle>Entwurf löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Der Entwurf wird gelöscht. Die Vorbestellung bleibt unverändert.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} disabled={busy}>
            Behalten
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={remove}
            disabled={busy}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmCancel}
        onClose={() => !busy && setConfirmCancel(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rechnung stornieren?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Die Rechnung {invoice.number} über{' '}
            {formatEuro(invoice.totals.dueCents)} vom{' '}
            {formatInvoiceDate(invoice.invoiceDate)} wird als storniert
            markiert. Gelöscht wird nichts; das lässt sich nicht rückgängig
            machen.
          </DialogContentText>
          <TextField
            label="Grund der Stornierung"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            error={!!errorFor('reason')}
            helperText={errorFor('reason')}
            inputProps={{ maxLength: 200 }}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={cancel}
            disabled={busy || cancelReason.trim() === ''}
          >
            Stornieren
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={NO_PRINT}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setToast(null)}
        >
          {toast}
        </Alert>
      </Snackbar>
    </PageLayout>
  )
}

const formGrid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
  gap: 2,
} as const

const lineGrid = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr 1fr',
    md: 'minmax(180px, 3fr) 1fr 1fr 1.4fr 1fr auto',
  },
  gap: 1.5,
  alignItems: 'start',
  pb: { xs: 2, md: 0 },
  borderBottom: { xs: 1, md: 0 },
  borderColor: 'divider',
} as const
