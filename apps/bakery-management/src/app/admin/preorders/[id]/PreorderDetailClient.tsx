'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  CheckCircleOutline as PickedUpIcon,
  Edit as EditIcon,
  EventBusy as CancelIcon,
  Inventory2 as ReadyIcon,
  MoreVert as MoreIcon,
  Payments as PaidIcon,
  Print as PrintIcon,
  Undo as ReopenIcon,
} from '@mui/icons-material'
import PreorderForm from '../PreorderForm'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import InvoiceFromPreorderButton from '../../../../components/invoices/InvoiceFromPreorderButton'
import {
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import { useOptionalSession } from '../../../../lib/session'
import { readPreorderEditDraft } from '../../../../lib/preorderDraft'
import {
  cancelPreorder,
  changePreorderStatus,
  downloadPreorderPdf,
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
  type PreorderInput,
  type PreorderStatusChange,
} from '../../../../lib/preordersTypes'

/**
 * Was beim Bearbeiten getippt, aber wegen eines Konflikts NICHT gespeichert
 * wurde - in Worten, damit man es auf dem neuen Stand nachtragen kann
 * (W4-verify r4: vorher verschwand die Eingabe mit „nichts überschrieben“).
 */
export function describeLostEdit(
  lost: Partial<PreorderInput> | undefined
): string[] {
  if (!lost) return []
  const out: string[] = []
  if (lost.customerName !== undefined) out.push(`Name „${lost.customerName}“`)
  if (lost.customerPhone !== undefined) {
    out.push(
      lost.customerPhone ? `Telefon ${lost.customerPhone}` : 'Telefon gelöscht'
    )
  }
  if (lost.pickupDate !== undefined) {
    out.push(`Abholtag ${formatDateWithWeekday(lost.pickupDate)}`)
  }
  if (lost.pickupTime !== undefined) {
    out.push(lost.pickupTime ? `Uhrzeit ${lost.pickupTime}` : 'ohne Uhrzeit')
  }
  if (lost.pickupPointId !== undefined) out.push('Abholort geändert')
  if (lost.channel !== undefined) out.push('Kanal geändert')
  if (lost.items !== undefined) out.push('Artikel geändert')
  if (lost.paid !== undefined) {
    out.push(lost.paid ? 'als bezahlt markiert' : 'als unbezahlt markiert')
  }
  if (lost.note !== undefined) {
    out.push(lost.note ? `Notiz „${lost.note}“` : 'Notiz gelöscht')
  }
  return out
}
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
  wide = false,
  children,
}: {
  label: string
  /** Über beide Spalten (lange Notiz). */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <Box sx={{ minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography
        component="dt"
        variant="body2"
        color="text.secondary"
        display="block"
      >
        {label}
      </Typography>
      <Box
        component="dd"
        sx={{ typography: 'body1', m: 0, overflowWrap: 'anywhere' }}
      >
        {children}
      </Box>
    </Box>
  )
}

export type DetailActionKey =
  | 'edit'
  | 'ready'
  | 'pickedUp'
  | 'paid'
  | 'unpaid'
  | 'refundCancelled'
  | 'settle'
  | 'reopen'
  | 'uncancel'
  | 'cancel'

export interface DetailAction {
  key: DetailActionKey
  label: string
  icon: React.ReactElement
  /** Die eine Hauptaktion (contained). */
  primary?: boolean
  color?: 'primary' | 'success' | 'error'
  /** Selten gebraucht: im „Weitere Aktionen“-Menü. */
  inMenu?: boolean
}

/**
 * Welche Aktionen die Ansicht zeigt - sichtbar höchstens der nächste
 * Schritt, Bearbeiten und Kassieren, der Rest im ⋮-Menü (vorher bis zu
 * sechs Knöpfe, am Handy drei Reihen). Genau eine Aktion ist `primary`:
 * offenes Geld vor Bearbeiten vor Storno aufheben; „Auf „Offen“ zurück“
 * ist es nie.
 */
export function detailActions(
  preorder: Preorder,
  editable: boolean
): DetailAction[] {
  const balance = preorder.paymentBalance ?? 0
  const out: DetailAction[] = []
  if (preorder.status === 'storniert') {
    if (preorder.paid) {
      out.push({
        key: 'refundCancelled',
        label: `Erstattet (${formatCurrency(
          preorder.paidAmount ?? preorder.total
        )})`,
        icon: <PaidIcon />,
        color: 'success',
      })
    }
    out.push({
      key: 'uncancel',
      label: 'Storno aufheben',
      icon: <ReopenIcon />,
    })
  } else {
    if (preorder.paid && balance !== 0) {
      out.push({
        key: 'settle',
        label:
          balance > 0
            ? `Rest kassiert (${formatCurrency(balance)})`
            : `Erstattet (${formatCurrency(-balance)})`,
        icon: <PaidIcon />,
        color: 'success',
      })
    }
    if (editable) {
      out.push({ key: 'edit', label: 'Bearbeiten', icon: <EditIcon /> })
    }
    if (preorder.status === 'offen') {
      out.push({
        key: 'ready',
        label: 'Bereitgestellt',
        icon: <ReadyIcon />,
      })
    }
    if (preorder.status === 'offen' || preorder.status === 'bereit') {
      out.push({
        key: 'pickedUp',
        label: 'Abgeholt',
        icon: <PickedUpIcon />,
        color: 'success',
        inMenu: preorder.status === 'offen',
      })
    }
    out.push(
      preorder.paid
        ? {
            key: 'unpaid',
            label: 'Doch nicht bezahlt',
            icon: <PaidIcon />,
            inMenu: true,
          }
        : { key: 'paid', label: 'Bezahlt', icon: <PaidIcon /> }
    )
    if (preorder.status !== 'offen') {
      out.push({
        key: 'reopen',
        label: 'Auf „Offen“ zurück',
        icon: <ReopenIcon />,
        inMenu: preorder.status === 'bereit',
      })
    }
    if (isCancellable(preorder)) {
      out.push({
        key: 'cancel',
        label: 'Stornieren',
        icon: <CancelIcon />,
        color: 'error',
        inMenu: true,
      })
    }
  }
  // „Auf „Offen“ zurück“ nimmt eine Übergabe zurück - nie als gefüllter
  // Hauptknopf, sonst sieht eine abgeholte Bestellung aus, als müsse man sie
  // wieder öffnen.
  const first = out.find((a) => !a.inMenu && a.key !== 'reopen')
  if (first) first.primary = true
  return out
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

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

  // W4-Verifikation Runde 6: Sitzung mitten im Bearbeiten beendet - nach der
  // neuen Anmeldung geht die Maske mit den nicht gespeicherten Änderungen
  // wieder auf (einmal, nicht nach jedem Neuladen).
  const userId = session?.user?.id ?? null
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current || !preorder || !canWrite) return
    resumedRef.current = true
    if (isEditable(preorder) && readPreorderEditDraft(userId, preorder.id)) {
      setEditing(true)
    }
  }, [preorder, canWrite, userId])

  const onConflict = async (message: string, lost?: Partial<PreorderInput>) => {
    setEditing(false)
    setConfirmCancel(false)
    setConfirmUncancel(false)
    const typed = describeLostEdit(lost)
    setConflict(
      typed.length > 0
        ? `${message} Ihre Änderung wurde NICHT gespeichert: ${typed.join(
            '; '
          )}. Unten steht jetzt der aktuelle Stand - bitte prüfen und über „Bearbeiten“ erneut eintragen.`
        : `${message} Es wurde nichts überschrieben - unten steht jetzt der aktuelle Stand.`
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

  // Bestellschein („Als PDF drucken“): lesen darf ihn, wer die Bestellung
  // sieht - auch der Fahrer, auch bei stornierten und anonymisierten.
  const printPdf = async () => {
    if (!preorder) return
    setBusy(true)
    setActionError(null)
    try {
      await downloadPreorderPdf(preorder)
    } catch (err) {
      setActionError(
        preorderErrorMessage(err, 'Die PDF konnte nicht geladen werden.')
      )
    } finally {
      setBusy(false)
    }
  }

  // Jede Aktion schickt die geladene Version mit: ein Klick auf veralteter
  // Anzeige (z. B. „Doch nicht bezahlt“, nachdem der Fahrer kassiert hat)
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
      <PageLayout
        width="narrow"
        title="Vorbestellung"
        back={{ href: backHref(null), label: backLabel }}
      >
        <LoadingState label="Vorbestellung wird geladen …" />
      </PageLayout>
    )
  }

  if (!preorder) {
    return (
      <PageLayout
        width="narrow"
        title="Vorbestellung"
        back={{ href: backHref(null), label: backLabel }}
      >
        <ErrorState
          message={loadError ?? 'Diese Vorbestellung existiert nicht.'}
          onRetry={load}
        />
      </PageLayout>
    )
  }

  const editable = canWrite && isEditable(preorder)

  if (editing && editable) {
    return (
      <PageLayout
        title={`${preorder.code} bearbeiten`}
        subtitle={preorder.customerName}
      >
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
      </PageLayout>
    )
  }

  const balance = preorder.paymentBalance ?? 0
  const actions =
    canWrite && !preorder.anonymizedAt ? detailActions(preorder, editable) : []
  const visibleActions = actions.filter((a) => !a.inMenu)
  const menuActions = actions.filter((a) => a.inMenu)
  const run = (key: DetailActionKey) => {
    setMenuAnchor(null)
    switch (key) {
      case 'edit':
        setEditing(true)
        break
      case 'ready':
        setStatus({ status: 'bereit' }, 'Als bereit markiert.')
        break
      case 'pickedUp':
        setStatus({ status: 'abgeholt' }, 'Als abgeholt markiert.')
        break
      case 'paid':
        setStatus({ paid: true }, 'Als bezahlt markiert.')
        break
      case 'unpaid':
        setStatus({ paid: false }, 'Als nicht bezahlt markiert.')
        break
      case 'refundCancelled':
        setStatus(
          { paid: false },
          'Erstattet - die Bestellung gilt nicht mehr als bezahlt.'
        )
        break
      case 'settle':
        setStatus(
          { paid: true },
          balance > 0
            ? 'Rest kassiert - jetzt voll bezahlt.'
            : 'Erstattet - der bezahlte Betrag stimmt wieder.'
        )
        break
      case 'reopen':
        setStatus({ status: 'offen' }, 'Wieder auf „Offen“ gesetzt.')
        break
      case 'uncancel':
        setConfirmUncancel(true)
        break
      case 'cancel':
        setConfirmCancel(true)
        break
    }
  }

  const fieldGrid = {
    m: 0,
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    columnGap: 3,
    rowGap: 1.5,
  } as const

  return (
    <PageLayout
      width="narrow"
      back={{ href: backHref(preorder), label: backLabel }}
      title={
        <Box
          component="span"
          sx={{ fontFamily: 'monospace', letterSpacing: '0.02em' }}
        >
          {preorder.code}
        </Box>
      }
      status={
        <>
          <PreorderStatusChip preorder={preorder} size="medium" />
          {preorder.paid ? (
            <Chip
              variant="outlined"
              color="success"
              label={
                balance !== 0 && preorder.paidAmount != null
                  ? `bezahlt (${formatCurrency(preorder.paidAmount)})`
                  : 'bezahlt'
              }
              data-testid="paid-chip"
            />
          ) : (
            preorder.status !== 'storniert' && (
              // Wie auf der Abholliste: unbezahlt steht da, nicht nur ein
              // fehlender Chip (UI-Runde 1).
              <Chip
                variant="outlined"
                label="nicht bezahlt"
                data-testid="unpaid-chip"
              />
            )
          )}
        </>
      }
      subtitle={`${formatDateWithWeekday(
        preorder.pickupDate
      )} · ${formatPickupPlace(preorder)}`}
      actions={
        <Box
          role="group"
          aria-label="Aktionen"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { sm: 'flex-end' },
            '& > .MuiButton-root': { flexGrow: { xs: 1, sm: 0 } },
          }}
        >
          {visibleActions.map((a) => (
            <Button
              key={a.key}
              variant={a.primary ? 'contained' : 'outlined'}
              color={a.color ?? 'primary'}
              startIcon={a.icon}
              onClick={() => run(a.key)}
              disabled={busy}
            >
              {a.label}
            </Button>
          ))}
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={printPdf}
            disabled={busy}
          >
            Als PDF drucken
          </Button>
          {menuActions.length > 0 && (
            <>
              <Tooltip title="Weitere Aktionen">
                <IconButton
                  aria-label="Weitere Aktionen"
                  aria-haspopup="menu"
                  aria-controls={menuAnchor ? 'preorder-more' : undefined}
                  aria-expanded={menuAnchor ? 'true' : undefined}
                  onClick={(event) => setMenuAnchor(event.currentTarget)}
                  disabled={busy}
                  sx={{ border: 1, borderColor: 'divider' }}
                >
                  <MoreIcon />
                </IconButton>
              </Tooltip>
              <Menu
                id="preorder-more"
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {menuActions.map((a) => (
                  <MenuItem
                    key={a.key}
                    onClick={() => run(a.key)}
                    sx={{
                      minHeight: 48,
                      color: a.color === 'error' ? 'error.main' : undefined,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: a.color === 'error' ? 'error.main' : undefined,
                      }}
                    >
                      {a.icon}
                    </ListItemIcon>
                    {a.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Box>
      }
    >
      {/* W4-Verifikation Runde 2: bezahlt, aber der Betrag stimmt nicht mehr */}
      {preorder.paid && balance > 0 && (
        <Alert severity="warning" data-testid="payment-balance">
          Bereits bezahlt: {formatCurrency(preorder.paidAmount ?? 0)} - die
          Bestellung kostet jetzt {formatCurrency(preorder.total)}.{' '}
          {preorder.status === 'abgeholt' ? (
            // W4-verify r3: schon übergeben - „bei der Abholung“ ist vorbei.
            <>
              Ohne den Rest übergeben:{' '}
              <strong>{formatCurrency(balance)}</strong> stehen noch aus.
              {canWrite ? ' Wenn das Geld da ist: „Rest kassiert“ tippen.' : ''}
            </>
          ) : (
            <>
              Bei der Abholung noch <strong>{formatCurrency(balance)}</strong>{' '}
              kassieren.
            </>
          )}
        </Alert>
      )}
      {preorder.paid && balance < 0 && (
        <Alert severity="warning" data-testid="payment-balance">
          {preorder.status === 'storniert'
            ? `Storniert, aber bereits bezahlt: ${formatCurrency(
                -balance
              )} an die Kundschaft zurückgeben.`
            : `Bereits bezahlt: ${formatCurrency(
                preorder.paidAmount ?? 0
              )} - die Bestellung kostet jetzt ${formatCurrency(
                preorder.total
              )}. ${formatCurrency(-balance)} zurückgeben.`}{' '}
          {canWrite
            ? 'Danach „Erstattet“ tippen.'
            : preorder.status === 'storniert'
            ? 'Erfassen kann das der Verkauf.'
            : 'Danach in der Abholliste „Erstattet“ tippen.'}
        </Alert>
      )}

      {preorder.anonymizedAt && (
        <Alert severity="info">
          Diese Vorbestellung ist anonymisiert (90 Tage nach dem Abholtag) und
          lässt sich nicht mehr ändern.
        </Alert>
      )}
      {conflict && (
        <Alert
          severity="warning"
          onClose={() => setConflict(null)}
          data-testid="preorder-conflict"
        >
          {conflict}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <PageSection title="Kunde und Abholung">
        <Box component="dl" sx={fieldGrid}>
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
          {preorder.note && (
            <Field label="Notiz" wide>
              {preorder.note}
            </Field>
          )}
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
        </Box>
      </PageSection>

      <PageSection
        title={`Artikel (${preorder.items.length})`}
        description={
          preorder.status === 'abgeholt' && canWrite
            ? 'Abgeholt - Positionen, Tag und Ort bleiben so stehen. Für eine Korrektur zuerst auf „Offen“ zurücksetzen.'
            : 'Preise wie beim Bestellen festgehalten.'
        }
        disablePadding
      >
        <TableContainer>
          <Table
            size="small"
            aria-label="Positionen"
            sx={{
              // passt am Telefon (390 px) ohne seitliches Scrollen
              '& td, & th': { px: { xs: 1, sm: 2 } },
              '& td:first-of-type, & th:first-of-type': {
                pl: { xs: 2, md: 3 },
              },
              '& td:last-of-type, & th:last-of-type': { pr: { xs: 2, md: 3 } },
              '& td:not(:first-of-type), & th:not(:first-of-type)': {
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
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
              <TableRow sx={{ '& td': { borderBottom: 0 } }}>
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
      </PageSection>

      {/* Rechnungen stellt nur der Inhaber aus, und nur mit persönlicher
          Anmeldung - nicht mit der PIN an einer Station (API: /api/invoices
          `inhaber` + `requirePersonalSession`). */}
      {role === 'inhaber' &&
        session?.sessionKind !== 'station' &&
        preorder.status !== 'storniert' && (
          <InvoiceFromPreorderButton preorderId={preorder.id} />
        )}

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
            {formatDateWithWeekday(preorder.pickupDate)} wird wieder „Offen“ und
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
    </PageLayout>
  )
}
