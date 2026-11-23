'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import {
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import { ReceiptFilePreview } from '../../../../../components/receipts/ReceiptFilePreview'
import {
  bookingLabel,
  ReceiptMatchCards,
} from '../../../../../components/receipts/ReceiptMatchCards'
import { ReceiptUpload } from '../../../../../components/receipts/ReceiptUpload'
import {
  classifyFinanceError,
  fetchFinanceTransactions,
} from '../../../../../lib/financeApi'
import {
  currentReceiptMonth,
  fetchReceipt,
  fetchReceiptMatches,
  formatReceiptMoney,
  linkReceipt,
  patchReceipt,
  receiptHref,
  RECEIPTS_PATH,
  RECEIPT_STATUS,
  rejectReceiptMatch,
  transitionReceipt,
  type ReceiptBooking,
  type ReceiptBookingHint,
  type ReceiptDetail,
  type ReceiptMatches,
} from '../../../../../lib/receiptsApi'
import ReceiptFieldsForm, {
  centText,
  parseCents,
  type Draft,
  type VatDraft,
} from './ReceiptFieldsForm'

interface View {
  receipt: ReceiptDetail
  matches: ReceiptMatches
}

function fieldPatch(
  draft: Draft,
  vat: VatDraft | null
): Parameters<typeof patchReceipt>[1] {
  const mapped = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => {
      if (key === 'gross_cents') return [key, parseCents(value)]
      if (key === 'skonto_rate')
        return [key, value.trim() ? Number(value.replace(',', '.')) : null]
      return [key, value.trim() || null]
    })
  )
  if (vat)
    mapped['vat_lines'] = vat.map((line) => {
      const rate = Number(line.rate.trim().replace(',', '.'))
      const net_cents = parseCents(line.net)
      const vat_cents = parseCents(line.vat)
      if (
        !line.rate.trim() ||
        !Number.isFinite(rate) ||
        net_cents === null ||
        vat_cents === null
      ) {
        throw new Error(
          'Bitte Steuersatz, Netto und Umsatzsteuer je Zeile eintragen.'
        )
      }
      return { rate, net_cents, vat_cents }
    })
  return mapped
}

function BookingHintCard({
  booking,
  busy,
  changed,
  onLink,
}: {
  booking: ReceiptBookingHint
  busy: boolean
  changed: boolean
  onLink: (id: string, amount: number) => void
}) {
  const [input, setInput] = useState('')
  const allocation = booking.allocation
  const money = (cents: number) =>
    formatReceiptMoney(cents / 100, booking.currency)

  if (changed || !allocation || allocation.max_cents <= 0) {
    return (
      <Alert severity="info">
        <Typography>Buchung zum Upload · {bookingLabel(booking)}</Typography>
        <Typography variant="body2">
          {changed
            ? 'Speichere die Belegfelder, um den Zuordnungsbetrag zu prüfen.'
            : 'Für diese Buchung und diesen Beleg ist derzeit keine Zuordnung möglich.'}
        </Typography>
      </Alert>
    )
  }

  const { max_cents, booking_open_cents, receipt_open_cents } = allocation
  const partial = booking_open_cents !== receipt_open_cents
  let cents: number | null = partial ? null : max_cents
  let validation = ''
  if (partial && input.trim()) {
    try {
      cents = parseCents(input)
      if (cents === null || cents <= 0 || cents > max_cents) {
        cents = null
        validation = 'Gib einen Betrag innerhalb der offenen Beträge ein.'
      }
    } catch (error) {
      validation =
        error instanceof Error ? error.message : 'Der Teilbetrag ist ungültig.'
    }
  }
  const preview = cents ?? max_cents

  return (
    <Alert severity="info">
      <Stack spacing={1}>
        <Typography>Buchung zum Upload · {bookingLabel(booking)}</Typography>
        <Typography variant="body2">
          {cents === null ? 'Höchstens zuordnen' : 'Zuordnungsbetrag'} ·{' '}
          {money(preview)}
        </Typography>
        <Typography variant="body2">
          Danach offen auf der Buchung · {money(booking_open_cents - preview)}
        </Typography>
        {receipt_open_cents - preview > 0 && (
          <Typography variant="body2">
            Danach offen auf dem Beleg · {money(receipt_open_cents - preview)}
          </Typography>
        )}
        {partial && (
          <TextField
            label="Teilbetrag in Euro"
            inputProps={{ inputMode: 'decimal' }}
            value={input}
            disabled={busy}
            error={Boolean(validation)}
            helperText={
              validation || 'Gib den Betrag ein, den du verknüpfen möchtest.'
            }
            onChange={(event) => setInput(event.target.value)}
          />
        )}
        <Button
          variant="outlined"
          disabled={busy || cents === null}
          onClick={() => {
            if (cents !== null) onLink(booking.id, cents)
          }}
        >
          Ja, verknüpfen
        </Button>
      </Stack>
    </Alert>
  )
}

function OtherBooking({
  receipt,
  busy,
  onLink,
}: {
  receipt: ReceiptDetail
  busy: boolean
  onLink: (id: string, amount: number | null) => void
}) {
  const [month, setMonth] = useState(
    receipt.invoice_date?.slice(0, 7) ?? currentReceiptMonth()
  )
  const [rows, setRows] = useState<ReceiptBooking[] | null>(null)
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setRows(null)
    setSelected('')
    setAmount('')
    setError('')
    fetchFinanceTransactions({
      month,
      direction: receipt.kind === 'gutschrift' ? 'in' : 'out',
    })
      .then((result) => {
        if (active)
          setRows(result.status === 'ok' ? result.data.transactions : [])
      })
      .catch((err) => {
        if (active)
          setError(
            classifyFinanceError(err, 'Buchungen konnten nicht geladen werden.')
              .message
          )
      })
    return () => {
      active = false
    }
  }, [month, receipt.kind])

  return (
    <Stack spacing={1.5}>
      <TextField
        label="Buchungsmonat"
        type="month"
        InputLabelProps={{ shrink: true }}
        value={month}
        disabled={busy}
        onChange={(event) => {
          if (event.target.value) setMonth(event.target.value)
        }}
      />
      {error && <ErrorState message={error} />}
      {rows === null && !error && (
        <LoadingState dense label="Buchungen werden geladen" />
      )}
      {rows?.length === 0 && (
        <Typography>
          Keine passenden Buchungen in diesem Monat verfügbar.
        </Typography>
      )}
      {Boolean(rows?.length) && (
        <>
          <TextField
            select
            label="Buchung auswählen"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={busy}
          >
            {rows?.map((row) => (
              <MenuItem
                key={row.id}
                value={row.id}
                sx={{ whiteSpace: 'normal' }}
              >
                {bookingLabel(row)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Teilbetrag in Euro (optional)"
            inputProps={{ inputMode: 'decimal' }}
            value={amount}
            disabled={busy}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button
            variant="outlined"
            disabled={!selected || busy}
            onClick={() => {
              try {
                setError('')
                onLink(selected, parseCents(amount))
              } catch (err) {
                if (err instanceof Error) setError(err.message)
              }
            }}
          >
            Ja, verknüpfen
          </Button>
        </>
      )}
    </Stack>
  )
}

export default function ReceiptDetailClient({ id }: { id: number }) {
  const router = useRouter()
  const [view, setView] = useState<View | null>(null)
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<Draft>({})
  const [vat, setVat] = useState<VatDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [other, setOther] = useState(false)
  const [remove, setRemove] = useState<'delete' | 'discard' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reload = () => setRevision((value) => value + 1)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const receipt = await fetchReceipt(id)
        if (!active) return
        const matches = await fetchReceiptMatches({ beleg: id })
        if (!active) return
        setView({ receipt, matches })
        if (receipt.extraction_pending)
          timer = setTimeout(() => void load(), 1200)
      } catch (err) {
        if (active)
          setError(
            classifyFinanceError(err, 'Der Beleg konnte nicht geladen werden.')
              .message
          )
      }
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [id, revision])

  async function save() {
    if (Object.keys(draft).length || vat) {
      await patchReceipt(id, fieldPatch(draft, vat))
      setDraft({})
      setVat(null)
      reload()
    }
  }

  async function act(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(message)
      reload()
    } catch (err) {
      setError(
        classifyFinanceError(
          err,
          'Die Änderung konnte nicht gespeichert werden.'
        ).message
      )
    } finally {
      setBusy(false)
    }
  }

  const receipt = view?.receipt
  const closed = receipt?.status === 'verworfen'
  const checked = receipt?.status === 'geprueft'
  const changed = Object.keys(draft).length > 0 || vat !== null
  const hasLinks = Boolean(view?.matches.links.length)
  const bar = (draft['payment'] ?? receipt?.payment) === 'bar'
  const bookingHint = receipt?.booking_hint
  const setField = (key: string, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }))

  function manual(transaction_id: string, amount: number | null) {
    void act(async () => {
      await save()
      await linkReceipt({
        transaction_id,
        kind: 'receipt',
        target_id: id,
        ...(amount !== null ? { amount_cents: amount } : {}),
      })
      setOther(false)
    }, 'Buchung verknüpft.')
  }

  return (
    <PageLayout
      title={receipt?.supplier_name ?? 'Beleg prüfen'}
      width="narrow"
      back={{ href: RECEIPTS_PATH, label: 'Belege' }}
      status={receipt && <Chip label={RECEIPT_STATUS[receipt.status]} />}
    >
      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setError('')
            reload()
          }}
        />
      )}
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      {!view && !error && <LoadingState label="Beleg wird geladen" />}
      {receipt && view && (
        <>
          {receipt.extraction_pending && (
            <Alert severity="info" role="status">
              Gespeichert - wird erkannt
            </Alert>
          )}
          {!receipt.extraction_pending && receipt.status === 'neu' && (
            <Alert severity="info">
              Bitte die Belegfelder von Hand ergänzen.
            </Alert>
          )}
          {receipt.extraction_errors.map((message, index) => (
            <Alert severity="warning" key={index}>
              {message}
            </Alert>
          ))}
          {receipt.duplicates.length > 0 && (
            <Alert severity="warning">
              Schon erfasst? Lieferant und Rechnungsnummer stimmen mit{' '}
              {receipt.duplicates.map((otherId) => (
                <React.Fragment key={otherId}>
                  <Link href={receiptHref(otherId)}>Beleg {otherId}</Link>{' '}
                </React.Fragment>
              ))}
              überein.
            </Alert>
          )}
          <PageSection title="Originaldateien">
            <Stack spacing={2}>
              {receipt.files.map((file) => (
                <ReceiptFilePreview receiptId={id} file={file} key={file.id} />
              ))}
              {!closed && !checked && (
                <ReceiptUpload
                  receiptId={id}
                  disabled={busy}
                  onSaved={reload}
                />
              )}
            </Stack>
          </PageSection>
          <PageSection title="Belegfelder">
            {!closed && !checked && (
              <Typography sx={{ mb: 2 }}>
                Bitte prüfen. Vergleiche die Angaben mit dem Original.
              </Typography>
            )}
            <ReceiptFieldsForm
              fields={receipt}
              draft={draft}
              vat={
                vat ??
                receipt.vat_lines.map((line) => ({
                  rate: String(line.rate),
                  net: centText(line.net_cents),
                  vat: centText(line.vat_cents),
                }))
              }
              setField={setField}
              setVat={setVat}
              disabled={closed || busy}
            />
          </PageSection>
          <PageSection title="Buchungsabgleich">
            <Stack spacing={1.5}>
              <ReceiptMatchCards
                matches={
                  bar || closed
                    ? { ...view.matches, proposals: [] }
                    : view.matches
                }
                disabled={busy || changed}
                onConfirm={(proposal_id) =>
                  void act(
                    () => linkReceipt({ proposal_id }),
                    'Buchung verknüpft.'
                  )
                }
                onReject={(matchId) =>
                  void act(
                    () => rejectReceiptMatch(matchId),
                    'Vorschlag abgelehnt.'
                  )
                }
                onReplace={(link, booking) =>
                  void act(
                    () =>
                      linkReceipt({
                        transaction_id: booking.id,
                        kind: link.kind,
                        target_id: link.target_id,
                        replace_link_id: link.id,
                      }),
                    'Ersatzbuchung verknüpft.'
                  )
                }
              />
              {!closed && !hasLinks && bookingHint && !bar && (
                <BookingHintCard
                  key={bookingHint.id}
                  booking={bookingHint}
                  busy={busy}
                  changed={changed}
                  onLink={manual}
                />
              )}
              {!closed &&
                !bar &&
                !view.matches.proposals.length &&
                !bookingHint &&
                !hasLinks && (
                  <Typography color="text.secondary">
                    {view.matches.available
                      ? 'Kein Buchungsvorschlag verfügbar.'
                      : 'Keine Bankbuchungen verfügbar.'}
                  </Typography>
                )}
              {!closed && (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {!bar && (
                    <Button
                      variant="outlined"
                      onClick={() => setOther(!other)}
                      disabled={busy}
                    >
                      Andere Buchung
                    </Button>
                  )}
                  {!hasLinks && (
                    <Button
                      onClick={() => {
                        setField('payment', 'offen')
                        setOther(false)
                      }}
                      disabled={busy}
                    >
                      Noch nicht bezahlt
                    </Button>
                  )}
                  {!hasLinks && (
                    <Button
                      onClick={() => {
                        setField('payment', 'bar')
                        setOther(false)
                      }}
                      disabled={busy}
                    >
                      Bar bezahlt
                    </Button>
                  )}
                </Stack>
              )}
              {other && !bar && (
                <OtherBooking
                  receipt={{
                    ...receipt,
                    kind:
                      (draft['kind'] as ReceiptDetail['kind']) ?? receipt.kind,
                  }}
                  busy={busy}
                  onLink={manual}
                />
              )}
            </Stack>
          </PageSection>
          <PageSection>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={1}
              flexWrap="wrap"
            >
              {!closed && !checked && (
                <Button
                  variant="contained"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await save()
                      await transitionReceipt(id, 'confirm')
                    }, 'Beleg bestätigt.')
                  }
                >
                  Bestätigen
                </Button>
              )}
              {!closed && (
                <Button
                  variant={checked ? 'contained' : 'outlined'}
                  disabled={busy || !changed}
                  onClick={() => void act(save, 'Änderungen gespeichert.')}
                >
                  Änderungen speichern
                </Button>
              )}
              {!closed && !checked && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (hasLinks) setRemove('discard')
                    else
                      void act(
                        () => transitionReceipt(id, 'discard'),
                        'Beleg verworfen.'
                      )
                  }}
                >
                  Verwerfen
                </Button>
              )}
              {!checked && (
                <Button
                  color="error"
                  disabled={busy}
                  onClick={() => setRemove('delete')}
                >
                  Beleg löschen
                </Button>
              )}
            </Stack>
            {remove && (
              <Alert
                severity="warning"
                sx={{ mt: 1 }}
                action={
                  <Stack direction="row">
                    <Button
                      color="inherit"
                      disabled={busy}
                      onClick={() => setRemove(null)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      color="inherit"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          async () => {
                            await transitionReceipt(id, remove)
                            setRemove(null)
                            if (remove === 'delete') router.push(RECEIPTS_PATH)
                          },
                          remove === 'delete'
                            ? 'Beleg gelöscht.'
                            : 'Beleg verworfen.'
                        )
                      }
                    >
                      {remove === 'delete' ? 'Löschen' : 'Verwerfen'}
                    </Button>
                  </Stack>
                }
              >
                {remove === 'delete'
                  ? 'Beleg aus der Verwaltung entfernen?'
                  : 'Beleg verwerfen?'}
                {hasLinks && ' Dabei werden Buchungsverknüpfungen aufgehoben.'}
              </Alert>
            )}
          </PageSection>
        </>
      )}
    </PageLayout>
  )
}
