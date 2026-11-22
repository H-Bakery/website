'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { useSession } from '../../../../lib/session'
import {
  classifyFinanceError,
  fetchFinanceTransactions,
  type FinanceAccessProblem,
} from '../../../../lib/financeApi'
import type {
  FinanceKind,
  FinanceTransaction,
  FinanceTransactionsList,
} from '../../../../lib/financeTypes'
import {
  formatEuro,
  formatMonth,
  formatReportDate,
} from '../../../../lib/reportFormat'
import { plural } from '../../../../lib/plural'
import {
  EmptyState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveList,
  type KeyFigure,
  type ResponsiveColumn,
} from '../../../../components/layout'
import {
  FinanceAccessNotice,
  formatSignedEuro,
} from '../../../../components/finance/FinanceReportParts'

const TITLE = 'Buchungen'
const SUBTITLE = 'Einzelne Umsätze des Geschäftskontos aus dem Kontoauszug'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const SEARCH_DELAY_MS = 300

/** Filter, wie sie in der Adresse stehen (deutsche Namen). */
export interface BuchungenQuery {
  monat?: string
  kategorie?: string
  richtung?: 'ein' | 'aus'
  suche?: string
}

export const KIND_LABEL: Record<FinanceKind, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  neutral: 'Neutral',
  offen: 'Nicht zugeordnet',
}

/** Adresse der Liste mit Filtern; leere Werte fallen weg. */
export function buchungenHref(query: BuchungenQuery): string {
  const params = new URLSearchParams()
  if (query.monat) params.set('monat', query.monat)
  if (query.kategorie) params.set('kategorie', query.kategorie)
  if (query.richtung) params.set('richtung', query.richtung)
  if (query.suche) params.set('suche', query.suche)
  const text = params.toString()
  return text ? `/admin/finance/buchungen?${text}` : '/admin/finance/buchungen'
}

export function buchungHref(id: string): string {
  return `/admin/finance/buchungen/${id}`
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'invalid' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-data'; reason: string }
  | { phase: 'ok'; list: FinanceTransactionsList }

function amountColor(amount: number): string {
  return amount < 0 ? 'text.primary' : 'success.dark'
}

function KindChip({ tx }: { tx: FinanceTransaction }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={tx.kind === 'offen' ? 'warning' : 'default'}
      label={tx.category_label}
      data-kind={tx.kind}
    />
  )
}

function MonthSwitcher({
  list,
  onMonth,
}: {
  list: FinanceTransactionsList
  onMonth: (month: string) => void
}) {
  const months = list.months.includes(list.month)
    ? list.months
    : [list.month, ...list.months]
  const arrow = (
    target: string | null,
    label: string,
    icon: React.ReactNode
  ) => (
    <IconButton
      aria-label={target ? `${label}: ${formatMonth(target)}` : label}
      disabled={!target}
      onClick={() => target && onMonth(target)}
    >
      {icon}
    </IconButton>
  )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {arrow(list.previous_month, 'Vormonat', <PrevIcon />)}
      <FormControl size="small" sx={{ minWidth: 168 }}>
        <InputLabel id="buchungen-monat-label">Monat</InputLabel>
        <Select
          labelId="buchungen-monat-label"
          label="Monat"
          value={list.month}
          onChange={(event) => onMonth(String(event.target.value))}
        >
          {months.map((month) => (
            <MenuItem key={month} value={month}>
              {formatMonth(month)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {arrow(list.next_month, 'Nächster Monat', <NextIcon />)}
    </Box>
  )
}

function keyFigures(list: FinanceTransactionsList): KeyFigure[] {
  const filtered = list.totals.count !== list.month_totals.count
  const of = (n: number) =>
    filtered ? `gefiltert · im Monat ${formatEuro(n)}` : undefined
  return [
    {
      label: 'Eingänge',
      value: formatEuro(list.totals.income),
      hint: of(list.month_totals.income),
    },
    {
      label: 'Ausgänge',
      value: formatEuro(list.totals.expense),
      hint: of(list.month_totals.expense),
    },
    {
      label: 'Saldo',
      value: formatSignedEuro(list.totals.net),
      hint: of(list.month_totals.net),
    },
    {
      label: 'Buchungen',
      value: String(list.totals.count),
      hint: filtered ? `von ${list.month_totals.count} im Monat` : undefined,
    },
  ]
}

const COLUMNS: ResponsiveColumn<FinanceTransaction>[] = [
  {
    key: 'date',
    header: 'Datum',
    cell: (tx) => (
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {formatReportDate(tx.booking_date)}
      </Box>
    ),
  },
  {
    key: 'who',
    header: 'Gegenseite und Verwendungszweck',
    primary: true,
    cell: (tx) => (
      <Box sx={{ minWidth: 0 }}>
        <Link
          component={NextLink}
          href={buchungHref(tx.id)}
          underline="hover"
          sx={{ fontWeight: 600 }}
          data-testid={`buchung-link-${tx.id}`}
        >
          {tx.counterparty || tx.booking_text || 'Ohne Angabe'}
        </Link>
        {tx.purpose ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {tx.purpose}
          </Typography>
        ) : null}
        {tx.status === 'vorgemerkt' ? (
          <Chip size="small" label="vorgemerkt" sx={{ mt: 0.5 }} />
        ) : null}
      </Box>
    ),
  },
  {
    key: 'category',
    header: 'Kategorie',
    inline: true,
    cell: (tx) => <KindChip tx={tx} />,
  },
  {
    key: 'amount',
    header: 'Betrag',
    align: 'right',
    cell: (tx) => (
      <Box
        component="span"
        sx={{
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: amountColor(tx.amount),
        }}
      >
        {formatSignedEuro(tx.amount)}
      </Box>
    ),
  },
]

export default function BuchungenClient({
  query = {},
}: {
  /** Filter aus der Adresse. */
  query?: BuchungenQuery
}) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useSession()
  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const [search, setSearch] = useState(query.suche ?? '')
  const requestRef = useRef(0)
  /** Nur getippte Suche schreibt verzögert in die Adresse (nicht „zurücksetzen“). */
  const typedRef = useRef(false)
  const valid = query.monat === undefined || MONTH_RE.test(query.monat)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    if (!valid) {
      setState({ phase: 'invalid' })
      return
    }
    setState((prev) => (prev.phase === 'ok' ? prev : { phase: 'loading' }))
    try {
      const result = await fetchFinanceTransactions({
        month: query.monat,
        category: query.kategorie,
        direction:
          query.richtung === 'ein'
            ? 'in'
            : query.richtung === 'aus'
            ? 'out'
            : undefined,
        q: query.suche,
      })
      if (request !== requestRef.current) return
      if (result.status === 'no-data') {
        setState({ phase: 'no-data', reason: result.reason })
        return
      }
      setState({ phase: 'ok', list: result.data })
    } catch (err) {
      if (request !== requestRef.current) return
      const { kind, message } = classifyFinanceError(
        err,
        'Die Buchungen konnten nicht geladen werden.'
      )
      setState({ phase: 'access', kind, message })
    }
  }, [query.monat, query.kategorie, query.richtung, query.suche, valid])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, isAuthenticated, load])

  const navigate = useCallback(
    (next: BuchungenQuery) => {
      router.replace(buchungenHref(next), { scroll: false })
    },
    [router]
  )

  // Suche erst nach einer kurzen Pause in die Adresse schreiben.
  useEffect(() => {
    const current = query.suche ?? ''
    if (!typedRef.current || search.trim() === current) return
    const timer = setTimeout(() => {
      typedRef.current = false
      navigate({ ...query, suche: search.trim() || undefined })
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, query, navigate])

  const back = { href: '/admin/finance', label: 'Finanzen' }

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <LoadingState label="Buchungen werden geladen" />
      </PageLayout>
    )
  }

  if (state.phase === 'invalid' || state.phase === 'no-data') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <EmptyState
          title={
            state.phase === 'invalid'
              ? 'Diesen Monat gibt es nicht'
              : 'Keine Buchungen vorhanden'
          }
          description={
            state.phase === 'invalid'
              ? 'Der Monat in der Adresse ist ungültig (Format JJJJ-MM).'
              : `${state.reason} Die Buchungen kommen aus dem Import der Kontoauszüge; Beispielwerte gibt es bewusst nicht.`
          }
          action={
            state.phase === 'invalid' ? (
              <Button component={NextLink} href="/admin/finance/buchungen">
                Zum jüngsten Monat
              </Button>
            ) : undefined
          }
        />
      </PageLayout>
    )
  }

  if (state.phase === 'access') {
    return (
      <PageLayout title={TITLE} subtitle={SUBTITLE} back={back}>
        <FinanceAccessNotice
          kind={state.kind}
          message={state.message}
          onRetry={() => void load()}
          subject="Die Buchungsliste"
          nextPath={buchungenHref(query)}
        />
      </PageLayout>
    )
  }

  const { list } = state
  const filtered =
    Boolean(query.kategorie) || Boolean(query.richtung) || Boolean(query.suche)
  const sectionTitle = filtered
    ? `${plural(list.totals.count, 'Buchung', 'Buchungen')} (gefiltert)`
    : plural(list.totals.count, 'Buchung', 'Buchungen')

  return (
    <PageLayout
      title={`${TITLE} – ${formatMonth(list.month)}`}
      documentTitle={TITLE}
      subtitle={SUBTITLE}
      back={back}
      actions={
        <MonthSwitcher
          list={list}
          onMonth={(month) => navigate({ ...query, monat: month })}
        />
      }
      data-testid="buchungen"
    >
      {list.available ? (
        <KeyFigures
          items={keyFigures(list)}
          aria-label={`Kennzahlen ${formatMonth(list.month)}`}
        />
      ) : null}

      <PageSection
        title={sectionTitle}
        disablePadding
        details={
          <Typography variant="body2" color="text.secondary">
            Stand des letzten Kontoauszug-Imports, nach Buchungstag. Die
            Kategorie kommt aus den Zuordnungsregeln in hq
            (config/categories.json); „Nicht zugeordnet“ ist gewollt, solange es
            keine passende Regel gibt. Kontonummern stehen nur verkürzt da.
          </Typography>
        }
        detailsLabel="Woher die Buchungen kommen"
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            px: 2,
            py: 1.5,
          }}
        >
          <TextField
            size="small"
            label="Suche"
            placeholder="Name, Zweck oder Betrag"
            value={search}
            onChange={(event) => {
              typedRef.current = true
              setSearch(event.target.value)
            }}
            inputProps={{ maxLength: 100, 'data-testid': 'buchungen-suche' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: '1 1 220px', maxWidth: 360 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="buchungen-kategorie-label">Kategorie</InputLabel>
            <Select
              labelId="buchungen-kategorie-label"
              label="Kategorie"
              value={query.kategorie ?? ''}
              onChange={(event) =>
                navigate({
                  ...query,
                  kategorie: String(event.target.value) || undefined,
                })
              }
            >
              <MenuItem value="">Alle Kategorien</MenuItem>
              {list.categories.map((c) => (
                <MenuItem key={c.category} value={c.category}>
                  {c.label} ({c.count})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={query.richtung ?? 'alle'}
            onChange={(_event, value) => {
              if (value === null) return
              navigate({
                ...query,
                richtung: value === 'alle' ? undefined : value,
              })
            }}
            aria-label="Richtung"
          >
            <ToggleButton value="alle">Alle</ToggleButton>
            <ToggleButton value="ein">Eingänge</ToggleButton>
            <ToggleButton value="aus">Ausgänge</ToggleButton>
          </ToggleButtonGroup>
          {filtered ? (
            <Button
              size="small"
              onClick={() => {
                typedRef.current = false
                setSearch('')
                navigate({ monat: query.monat })
              }}
            >
              Filter zurücksetzen
            </Button>
          ) : null}
        </Box>
        <ResponsiveList
          rows={list.transactions}
          columns={COLUMNS}
          rowKey={(tx) => tx.id}
          rowTestId={(tx) => `buchung-${tx.id}`}
          aria-label={`Buchungen ${formatMonth(list.month)}`}
          breakpoint="md"
          empty={
            !list.available
              ? 'Für diesen Monat gibt es keine Bankdaten.'
              : filtered
              ? 'Keine Buchung passt zu den Filtern.'
              : 'In diesem Monat gibt es keine Buchungen.'
          }
        />
      </PageSection>
    </PageLayout>
  )
}
