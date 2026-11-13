'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import InvoiceStatusChip from '../../../components/invoices/InvoiceStatusChip'
import {
  createInvoice,
  formatEuro,
  formatInvoiceDate,
  invoiceErrorMessage,
  listInvoices,
  type InvoiceListItem,
} from '../../../lib/invoicesApi'

/**
 * Rechnungen: alle Entwürfe und ausgestellten Rechnungen, neueste zuerst.
 * „Neue Rechnung“ legt einen leeren Entwurf an; aus einer Vorbestellung
 * heraus geht es über deren Seite („Rechnung erstellen“).
 */
export default function InvoiceListClient() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<InvoiceListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setInvoices(await listInvoices())
    } catch (err) {
      setLoadError(
        invoiceErrorMessage(err, 'Die Rechnungen konnten nicht geladen werden.')
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createInvoice()
      router.push(`/admin/rechnungen/${created.id}`)
    } catch (err) {
      setCreateError(
        invoiceErrorMessage(err, 'Der Entwurf konnte nicht angelegt werden.')
      )
      setCreating(false)
    }
  }

  const newButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={create}
      disabled={creating}
    >
      Neue Rechnung
    </Button>
  )

  return (
    <PageLayout
      title="Rechnungen"
      subtitle="Ausgangsrechnungen mit ZUGFeRD-PDF"
      actions={newButton}
    >
      {createError && (
        <Alert severity="error" onClose={() => setCreateError(null)}>
          {createError}
        </Alert>
      )}
      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : invoices === null ? (
        <LoadingState label="Rechnungen werden geladen …" />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="Noch keine Rechnungen."
          description="Eine Rechnung entsteht aus einer Vorbestellung („Rechnung erstellen“) oder hier als leerer Entwurf."
          data-testid="invoices-empty"
        />
      ) : (
        <PageSection disablePadding>
          <TableContainer>
            <Table aria-label="Rechnungen">
              <TableHead>
                <TableRow>
                  <TableCell>Nummer</TableCell>
                  <TableCell>Datum</TableCell>
                  <TableCell>Empfänger</TableCell>
                  <TableCell align="right">Betrag</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} hover>
                    <TableCell>
                      <MuiLink
                        component={Link}
                        href={`/admin/rechnungen/${invoice.id}`}
                        sx={{ fontWeight: 600 }}
                      >
                        {invoice.number || 'ohne Nummer'}
                      </MuiLink>
                    </TableCell>
                    <TableCell>
                      {formatInvoiceDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      {invoice.buyerName || '–'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatEuro(invoice.dueCents)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusChip status={invoice.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </PageSection>
      )}
    </PageLayout>
  )
}
