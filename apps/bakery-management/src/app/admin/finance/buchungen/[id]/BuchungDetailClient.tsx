'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { Box, Button, Chip, Link, Typography } from '@mui/material'
import { ApiError } from '@bakery/shared/data-access'
import { useSession } from '../../../../../lib/session'
import {
  classifyFinanceError,
  fetchFinanceTransaction,
  type FinanceAccessProblem,
} from '../../../../../lib/financeApi'
import type { FinanceTransactionDetail } from '../../../../../lib/financeTypes'
import { formatMonth, formatReportDate } from '../../../../../lib/reportFormat'
import {
  EmptyState,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveList,
  type ResponsiveColumn,
} from '../../../../../components/layout'
import {
  FinanceAccessNotice,
  formatSignedEuro,
} from '../../../../../components/finance/FinanceReportParts'
import { buchungHref, buchungenHref, KIND_LABEL } from '../BuchungenClient'

const TITLE = 'Buchung'

type PageState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-data'; reason: string }
  | { phase: 'ok'; detail: FinanceTransactionDetail }

type Related = FinanceTransactionDetail['related'][number]

function Field({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <Box sx={{ minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography component="dt" variant="body2" color="text.secondary">
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

const FIELD_GRID = {
  m: 0,
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  columnGap: 3,
  rowGap: 1.5,
} as const

const RELATED_COLUMNS: ResponsiveColumn<Related>[] = [
  {
    key: 'date',
    header: 'Datum',
    cell: (r) => (
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {formatReportDate(r.booking_date)}
      </Box>
    ),
  },
  {
    key: 'purpose',
    header: 'Verwendungszweck',
    primary: true,
    cell: (r) => (
      <Link component={NextLink} href={buchungHref(r.id)} underline="hover">
        {r.purpose || 'Ohne Verwendungszweck'}
      </Link>
    ),
  },
  {
    key: 'category',
    header: 'Kategorie',
    inline: true,
    cell: (r) => r.category_label,
  },
  {
    key: 'amount',
    header: 'Betrag',
    align: 'right',
    cell: (r) => (
      <Box
        component="span"
        sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {formatSignedEuro(r.amount)}
      </Box>
    ),
  },
]

export default function BuchungDetailClient({ id }: { id: string }) {
  const { isAuthenticated, isLoading: authLoading } = useSession()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setState({ phase: 'loading' })
    try {
      const result = await fetchFinanceTransaction(id)
      if (request !== requestRef.current) return
      if (result.status === 'no-data') {
        setState({ phase: 'no-data', reason: result.reason })
        return
      }
      setState({ phase: 'ok', detail: result.data })
    } catch (err) {
      if (request !== requestRef.current) return
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 400)
      ) {
        setState({ phase: 'not-found' })
        return
      }
      const { kind, message } = classifyFinanceError(
        err,
        'Die Buchung konnte nicht geladen werden.'
      )
      setState({ phase: 'access', kind, message })
    }
  }, [id])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, isAuthenticated, load])

  const listBack = { href: '/admin/finance/buchungen', label: 'Buchungen' }

  if (state.phase === 'loading') {
    return (
      <PageLayout width="narrow" title={TITLE} back={listBack}>
        <LoadingState label="Buchung wird geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'not-found' || state.phase === 'no-data') {
    return (
      <PageLayout width="narrow" title={TITLE} back={listBack}>
        <EmptyState
          title="Diese Buchung gibt es nicht"
          description={
            state.phase === 'no-data'
              ? state.reason
              : 'Vielleicht wurde der Kontoauszug neu eingelesen. Bitte über die Liste neu öffnen.'
          }
          action={
            <Button component={NextLink} href="/admin/finance/buchungen">
              Zur Buchungsliste
            </Button>
          }
        />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout width="narrow" title={TITLE} back={listBack}>
        <FinanceAccessNotice
          kind={state.kind}
          message={state.message}
          onRetry={() => void load()}
          subject="Die Buchung"
          nextPath={buchungHref(id)}
        />
      </PageLayout>
    )
  }

  const { detail } = state
  const tx = detail.transaction
  const name = tx.counterparty || tx.booking_text || 'Ohne Angabe'
  const back = {
    href: buchungenHref({ monat: detail.month }),
    label: `Buchungen ${formatMonth(detail.month)}`,
  }

  return (
    <PageLayout
      width="narrow"
      title={name}
      documentTitle={`${TITLE} – ${name}`}
      subtitle={`${formatReportDate(tx.booking_date)} · ${
        tx.booking_text ?? 'Buchung'
      }`}
      back={back}
      status={
        tx.status === 'vorgemerkt' ? (
          <Chip label="vorgemerkt" size="small" />
        ) : undefined
      }
      data-testid="buchung-detail"
    >
      <PageSection>
        <Typography
          component="p"
          variant="h4"
          sx={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            color: tx.amount < 0 ? 'text.primary' : 'success.dark',
            mb: 2,
          }}
          data-testid="buchung-betrag"
        >
          {formatSignedEuro(tx.amount)}
        </Typography>
        <Box component="dl" sx={FIELD_GRID}>
          <Field label="Verwendungszweck" wide>
            {tx.purpose || '–'}
          </Field>
          <Field label="Gegenseite">{tx.counterparty || '–'}</Field>
          <Field label="Konto der Gegenseite">
            {tx.counterparty_iban || '–'}
          </Field>
          <Field label="Buchungstag">{formatReportDate(tx.booking_date)}</Field>
          <Field label="Wertstellung">
            {tx.value_date ? formatReportDate(tx.value_date) : '–'}
          </Field>
          <Field label="Art">
            {tx.booking_text || '–'}
            {tx.direct_debit ? ' (Lastschrift mit Mandat)' : ''}
          </Field>
        </Box>
      </PageSection>

      <PageSection
        title="Zuordnung"
        description="Aus den Regeln in hq (config/categories.json). Ändern geht heute nur dort."
      >
        <Box component="dl" sx={FIELD_GRID}>
          <Field label="Kategorie">
            <Chip
              size="small"
              variant="outlined"
              color={tx.kind === 'offen' ? 'warning' : 'default'}
              label={tx.category_label}
            />
          </Field>
          <Field label="Topf">{KIND_LABEL[tx.kind]}</Field>
          {tx.subcategory_label ? (
            <Field label="Unterkategorie">{tx.subcategory_label}</Field>
          ) : null}
          {tx.note ? (
            <Field label="Hinweis" wide>
              {tx.note}
            </Field>
          ) : null}
        </Box>
      </PageSection>

      {tx.counterparty ? (
        <PageSection
          title="Weitere Buchungen dieser Gegenseite"
          description={
            detail.related_count === 0
              ? 'Keine weiteren Buchungen im eingelesenen Zeitraum.'
              : detail.related_count > detail.related.length
              ? `Die neuesten ${detail.related.length} von ${detail.related_count}.`
              : undefined
          }
          actions={
            detail.related_count > 0 ? (
              <Button
                size="small"
                component={NextLink}
                href={buchungenHref({
                  monat: detail.month,
                  suche: tx.counterparty.slice(0, 100),
                })}
              >
                In der Liste suchen
              </Button>
            ) : undefined
          }
          disablePadding={detail.related_count > 0}
        >
          {detail.related_count > 0 ? (
            <ResponsiveList
              rows={detail.related}
              columns={RELATED_COLUMNS}
              rowKey={(r) => r.id}
              rowTestId={(r) => `verwandt-${r.id}`}
              aria-label="Weitere Buchungen dieser Gegenseite"
              breakpoint="sm"
            />
          ) : null}
        </PageSection>
      ) : null}
    </PageLayout>
  )
}
