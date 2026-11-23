'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Chip, Tab, Tabs, TextField } from '@mui/material'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveList,
  type ResponsiveColumn,
} from '../../../../components/layout'
import { ReceiptUpload } from '../../../../components/receipts/ReceiptUpload'
import { classifyFinanceError } from '../../../../lib/financeApi'
import { formatReportDate } from '../../../../lib/reportFormat'
import {
  currentReceiptMonth,
  fetchExpensesWithoutReceipt,
  fetchReceipts,
  formatReceiptMoney,
  receiptHref,
  RECEIPT_STATUS,
  type ReceiptBooking,
  type ReceiptSummary,
} from '../../../../lib/receiptsApi'

const tabs = ['Zu prüfen', 'Ohne Buchung', 'Ausgaben ohne Beleg'] as const
type TabName = (typeof tabs)[number]
type Listing =
  | { receipts: ReceiptSummary[] }
  | { transactions: ReceiptBooking[]; available: boolean }

const receiptsColumns: ResponsiveColumn<ReceiptSummary>[] = [
  {
    key: 'name',
    header: 'Lieferant',
    primary: true,
    cell: (row) => (
      <Link href={receiptHref(row.id)}>
        {row.supplier_name ?? `Beleg ${row.id}`}
      </Link>
    ),
  },
  {
    key: 'number',
    header: 'Rechnungsnummer',
    cell: (row) => row.invoice_number || '–',
  },
  {
    key: 'date',
    header: 'Datum',
    cell: (row) =>
      row.invoice_date ? formatReportDate(row.invoice_date) : 'Offen',
  },
  {
    key: 'amount',
    header: 'Brutto',
    align: 'right',
    cell: (row) =>
      row.gross_cents === null
        ? 'Offen'
        : formatReceiptMoney(row.gross_cents / 100, row.currency),
  },
  {
    key: 'status',
    header: 'Status',
    inline: true,
    cell: (row) => <Chip size="small" label={RECEIPT_STATUS[row.status]} />,
  },
]

const bookingColumns: ResponsiveColumn<ReceiptBooking>[] = [
  {
    key: 'name',
    header: 'Buchung',
    primary: true,
    cell: (row) => (
      <Link href={`/admin/finance/buchungen/${row.id}`}>
        {row.counterparty ?? row.booking_text ?? 'Buchung öffnen'}
      </Link>
    ),
  },
  {
    key: 'date',
    header: 'Datum',
    cell: (row) => formatReportDate(row.booking_date),
  },
  {
    key: 'amount',
    header: 'Betrag',
    align: 'right',
    cell: (row) => formatReceiptMoney(row.amount, row.currency),
  },
  {
    key: 'status',
    header: 'Status',
    inline: true,
    cell: (row) => (row.status === 'vorgemerkt' ? 'Vorgemerkt' : 'Gebucht'),
  },
]

export default function ReceiptsClient() {
  const [month, setMonth] = useState(currentReceiptMonth)
  const [tab, setTab] = useState<TabName>('Zu prüfen')
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState<{ data?: Listing; error?: string }>({})

  useEffect(() => {
    if (!month) return
    let active = true
    const request =
      tab === 'Ausgaben ohne Beleg'
        ? fetchExpensesWithoutReceipt(month)
        : fetchReceipts(month, tab === 'Ohne Buchung').then((rows) => ({
            receipts:
              tab === 'Zu prüfen'
                ? rows.filter(
                    (row) => row.status === 'neu' || row.status === 'erkannt'
                  )
                : rows,
          }))
    request
      .then((data) => {
        if (active) setState({ data })
      })
      .catch((error) => {
        if (active)
          setState({
            error: classifyFinanceError(
              error,
              'Die Liste konnte nicht geladen werden.'
            ).message,
          })
      })
    return () => {
      active = false
    }
  }, [month, refresh, tab])

  function reload() {
    setState({})
    setRefresh((value) => value + 1)
  }

  const data = state.data
  return (
    <PageLayout
      title="Belege"
      back={{ href: '/admin/finance', label: 'Finanzen' }}
    >
      <PageSection>
        <ReceiptUpload onSaved={reload} />
      </PageSection>
      <PageSection>
        <TextField
          label="Monat"
          type="month"
          value={month}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => {
            if (event.target.value) {
              setMonth(event.target.value)
              setState({})
            }
          }}
        />
        <Tabs
          value={tab}
          onChange={(_, selected: TabName) => {
            setTab(selected)
            setState({})
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Beleglisten"
          sx={{ mt: 1 }}
        >
          {tabs.map((name) => (
            <Tab label={name} value={name} key={name} />
          ))}
        </Tabs>
      </PageSection>
      <PageSection>
        {state.error ? (
          <ErrorState message={state.error} onRetry={reload} />
        ) : !data ? (
          <LoadingState />
        ) : 'receipts' in data ? (
          <ResponsiveList
            aria-label={tab}
            rows={data.receipts}
            rowKey={(row) => row.id}
            columns={receiptsColumns}
            empty={
              tab === 'Zu prüfen'
                ? 'Keine Belege zur Prüfung in diesem Monat.'
                : 'Keine Belege ohne Buchung in diesem Monat.'
            }
          />
        ) : !data.available ? (
          <EmptyState title="Für diesen Monat sind keine Bankbuchungen verfügbar." />
        ) : (
          <ResponsiveList
            aria-label={tab}
            rows={data.transactions}
            rowKey={(row) => row.id}
            columns={bookingColumns}
            empty="Keine Ausgaben ohne Beleg in diesem Monat."
          />
        )}
      </PageSection>
    </PageLayout>
  )
}
