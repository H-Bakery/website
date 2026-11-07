'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  GlobalStyles,
  IconButton,
  LinearProgress,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import {
  ErrorOutline as WarningNoteIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  InfoOutlined as InfoNoteIcon,
  Login as LoginIcon,
} from '@mui/icons-material'
import { ErrorState } from '../layout'
import {
  PERSONAL_SESSION_HINT,
  type FinanceAccessProblem,
} from '../../lib/financeApi'
import type {
  FinanceReconciliation,
  FinanceReportNote,
  FinanceReportRow,
} from '../../lib/financeTypes'
import { formatEuro } from '../../lib/reportFormat'
import { useIsPrinting } from '../../lib/printMode'

/**
 * Bausteine von Jahresabschluss und Monatsanalyse
 * (`/admin/finance/jahr`, `/admin/finance/monat/[monat]`). Sie zeigen nur an,
 * was `/api/finance/year|month` liefert - jede Summe, jeder Anteil und jeder
 * Hinweistext kommt vom Server (`finance-report.core.js`).
 */

// ---------------------------------------------------------------------------
// Formatierung (nur Darstellung, keine Rechnung)
// ---------------------------------------------------------------------------

const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export function formatShare(share: number | undefined): string {
  return percent.format(share ?? 0)
}

/** `2026-10-15` → `15.10.` */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return d && m ? `${d}.${m}.` : iso
}

/** `+400,00 €` / `−200,00 €` - die Richtung steht immer da. */
export function formatSignedEuro(value: number): string {
  const text = formatEuro(Math.abs(value))
  if (Math.abs(value) < 0.005) return formatEuro(0)
  return value < 0 ? `−${text}` : `+${text}`
}

/**
 * Abweichung vom Durchschnitt in Worten. `diff` kommt vom Server
 * (`amount - average`, Abflüsse negativ): bei Ausgaben heißt ein negativer
 * Wert „mehr ausgegeben“, bei Einnahmen ein positiver „mehr eingenommen“.
 */
export function describeDiff(
  diff: number,
  section: 'income' | 'expense'
): string {
  if (Math.abs(diff) < 0.005) return 'wie üblich'
  const more = section === 'expense' ? diff < 0 : diff > 0
  return `${formatEuro(Math.abs(diff))} ${more ? 'mehr' : 'weniger'}`
}

// ---------------------------------------------------------------------------
// Zugriff
// ---------------------------------------------------------------------------

/**
 * Anmeldung fehlt, falsche Rolle, PIN-Station oder Fehler - wie auf
 * `/admin/finance` und dem Tagesziel (dieselben Texte, eigener Seitenname).
 */
export function FinanceAccessNotice({
  kind,
  message,
  onRetry,
  subject,
  nextPath,
}: {
  kind: FinanceAccessProblem
  message: string
  onRetry: () => void
  /** „Der Jahresabschluss“ / „Die Monatsanalyse“ */
  subject: string
  nextPath: string
}) {
  const loginHref = `/admin/login?next=${encodeURIComponent(nextPath)}`
  if (kind === 'unauthenticated') {
    return (
      <Alert
        severity="info"
        action={
          <Button
            component={Link}
            href={loginHref}
            color="inherit"
            size="small"
            startIcon={<LoginIcon />}
          >
            Zur Anmeldung
          </Button>
        }
      >
        <AlertTitle>Anmeldung erforderlich</AlertTitle>
        {subject} ist nur nach Anmeldung als Inhaber sichtbar.
      </Alert>
    )
  }
  if (kind === 'personal_session') {
    // Wie Finanzen/Tagesziel: bewusst ohne Anmelde-Link (F4).
    return (
      <Alert severity="info" data-testid="personal-session-notice">
        <AlertTitle>An der Station nicht verfügbar</AlertTitle>
        {PERSONAL_SESSION_HINT}
      </Alert>
    )
  }
  if (kind === 'forbidden') {
    return (
      <Alert severity="warning">
        <AlertTitle>Keine Berechtigung</AlertTitle>
        {message} {subject} ist nur für Konten mit der Rolle Inhaber.{' '}
        <Link href={loginHref}>Mit einem anderen Konto anmelden</Link>
      </Alert>
    )
  }
  return (
    <ErrorState
      title={`${subject} konnte nicht geladen werden`}
      message={message}
      onRetry={onRetry}
      data-testid="finance-report-error"
    />
  )
}

// ---------------------------------------------------------------------------
// Zeilen einer Gliederung
// ---------------------------------------------------------------------------

/** Spalten, die am Handy wegfallen - im Druck kommen sie zurück. */
export const SM_UP_CELL = {
  display: { xs: 'none', sm: 'table-cell' },
  '@media print': { display: 'table-cell' },
} as const

export interface StatementRowOptions {
  /** Anteil (mit Balken am Bildschirm). */
  showShare?: boolean
  /** Anzahl Buchungen (ab `sm`). */
  showCount?: boolean
  /** Ø und Abweichung (Monatsanalyse, nur vollständige Monate). */
  comparison?: 'income' | 'expense'
}

/** Anzahl Spalten hinter der Bezeichnung - für Zwischenzeilen. */
export function statementColumns(options: StatementRowOptions): number {
  return (
    1 +
    (options.showShare ? 1 : 0) +
    (options.showCount ? 1 : 0) +
    (options.comparison ? 2 : 0)
  )
}

function ShareCell({ share }: { share: number | undefined }) {
  // Neutrale Posten haben keinen Anteil - leer statt „0 %“.
  if (share === undefined || share === null) return <TableCell />
  return (
    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, (share ?? 0) * 100))}
          aria-hidden
          sx={{
            flex: 1,
            width: 72,
            maxWidth: 96,
            height: 6,
            borderRadius: 3,
            display: { xs: 'none', sm: 'block' },
            '@media print': { display: 'none' },
          }}
        />
        <span>{formatShare(share)}</span>
      </Box>
    </TableCell>
  )
}

/**
 * Eine Kategorie mit aufklappbaren Unterkategorien. Im Druck stehen die
 * Unterkategorien immer da (Papier kann nicht aufklappen).
 */
export function StatementRow({
  row,
  options,
}: {
  row: FinanceReportRow
  options: StatementRowOptions
}) {
  const [open, setOpen] = useState(false)
  const printing = useIsPrinting()
  const subs = row.subcategories ?? []
  const expandable = subs.length > 0
  const showSubs = expandable && (open || printing)
  const subId = `sub-${row.category}`
  const emptyCells =
    (options.showShare ? 1 : 0) +
    (options.showCount ? 1 : 0) +
    (options.comparison ? 2 : 0)
  return (
    <>
      <TableRow data-testid={`row-${row.category}`}>
        <TableCell>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
            }}
          >
            <span>{row.label}</span>
            {row.kind === 'offen' && (
              <Chip label="offen" size="small" variant="outlined" />
            )}
            {expandable && (
              <IconButton
                size="small"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={showSubs}
                aria-controls={subId}
                aria-label={`${row.label}: Aufschlüsselung ${
                  open ? 'ausblenden' : 'anzeigen'
                }`}
                sx={{ '@media print': { display: 'none' } }}
              >
                {open ? (
                  <CollapseIcon fontSize="small" />
                ) : (
                  <ExpandIcon fontSize="small" />
                )}
              </IconButton>
            )}
          </Box>
        </TableCell>
        <TableCell
          align="right"
          sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatEuro(row.amount)}
        </TableCell>
        {options.showShare && <ShareCell share={row.share} />}
        {options.showCount && (
          <TableCell align="right" sx={SM_UP_CELL}>
            {row.count}
          </TableCell>
        )}
        {options.comparison && (
          <>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              {row.average === null || row.average === undefined
                ? '–'
                : formatEuro(row.average)}
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              {row.diff === null || row.diff === undefined
                ? '–'
                : describeDiff(row.diff, options.comparison)}
            </TableCell>
          </>
        )}
      </TableRow>
      {showSubs &&
        subs.map((sub, index) => (
          <TableRow
            key={sub.key}
            id={index === 0 ? subId : undefined}
            data-testid={`sub-${row.category}-${sub.key}`}
          >
            <TableCell sx={{ pl: 5, color: 'text.secondary' }}>
              {sub.label}
            </TableCell>
            <TableCell
              align="right"
              sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}
            >
              {formatEuro(sub.amount)}
            </TableCell>
            {Array.from({ length: emptyCells }, (_, i) => (
              <TableCell
                key={i}
                sx={
                  options.showCount && i === (options.showShare ? 1 : 0)
                    ? SM_UP_CELL
                    : undefined
                }
              />
            ))}
          </TableRow>
        ))}
    </>
  )
}

/** Summen- und Zwischenzeile (fett), z. B. „Ergebnis“. */
export function StatementSumRow({
  label,
  amount,
  options,
  strong = true,
  testId,
}: {
  label: string
  amount: number
  options: StatementRowOptions
  strong?: boolean
  testId?: string
}) {
  const rest = statementColumns(options) - 1
  return (
    <TableRow data-testid={testId}>
      <TableCell sx={{ fontWeight: strong ? 700 : 600 }}>{label}</TableCell>
      <TableCell
        align="right"
        sx={{
          fontWeight: strong ? 700 : 600,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatEuro(amount)}
      </TableCell>
      {Array.from({ length: rest }, (_, i) => (
        <TableCell
          key={i}
          sx={
            options.showCount && i === (options.showShare ? 1 : 0)
              ? SM_UP_CELL
              : undefined
          }
        />
      ))}
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Hinweise
// ---------------------------------------------------------------------------

/**
 * Hinweise des Servers. `warning` ist sichtbar abgesetzt (Randlinie, Symbol,
 * „Bitte beachten“), aber kein roter Alarm - die Farbe trägt nie allein.
 */
export function ReportNotes({
  notes,
  'data-testid': testId,
}: {
  notes: FinanceReportNote[]
  'data-testid'?: string
}) {
  if (notes.length === 0) return null
  return (
    <Box
      component="ul"
      data-testid={testId}
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}
    >
      {notes.map((note) => {
        const warning = note.severity === 'warning'
        return (
          <Box
            component="li"
            key={note.key}
            data-severity={note.severity}
            data-note={note.key}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              pl: 1.5,
              py: 0.75,
              borderLeft: warning ? 4 : 2,
              borderColor: warning ? 'warning.main' : 'divider',
              bgcolor: warning ? 'action.hover' : 'transparent',
              borderRadius: 0.5,
              breakInside: 'avoid',
            }}
          >
            {warning ? (
              <WarningNoteIcon
                fontSize="small"
                sx={{ mt: 0.25, color: 'text.secondary' }}
              />
            ) : (
              <InfoNoteIcon
                fontSize="small"
                sx={{ mt: 0.25, color: 'text.secondary' }}
              />
            )}
            <Typography variant="body2" component="span">
              {warning && (
                <Box component="strong" sx={{ fontWeight: 600 }}>
                  Bitte beachten:{' '}
                </Box>
              )}
              {note.text}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Kasse und Konto
// ---------------------------------------------------------------------------

export function ReconciliationTable({ rec }: { rec: FinanceReconciliation }) {
  const rows: { label: string; kasse: number; bank: number; diff: number }[] = [
    {
      label: 'Bar',
      kasse: rec.kasse_cash,
      bank: rec.bank_cash,
      diff: rec.diff_cash,
    },
    {
      label: 'Karte',
      kasse: rec.kasse_card,
      bank: rec.bank_card,
      diff: rec.diff_card,
    },
  ]
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        aria-label="Kasse und Konto"
        data-testid="reconciliation"
        sx={{
          width: '100%',
          minWidth: 320,
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
          '& th, & td': {
            py: 0.75,
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          },
          '& th:first-of-type, & td:first-of-type': { textAlign: 'left' },
          '& thead th': { color: 'text.secondary', fontWeight: 500 },
        }}
      >
        <thead>
          <tr>
            <th scope="col">Zahlart</th>
            <th scope="col">Kasse</th>
            <th scope="col">aufs Konto</th>
            <th scope="col">Differenz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" style={{ fontWeight: 400 }}>
                {row.label}
              </th>
              <td>{formatEuro(row.kasse)}</td>
              <td>{formatEuro(row.bank)}</td>
              <td>{formatSignedEuro(row.diff)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <th scope="row">Zusammen</th>
            <td data-testid="reconciliation-kasse-total">
              {formatEuro(rec.kasse_total)}
            </td>
            <td data-testid="reconciliation-bank-total">
              {formatEuro(rec.bank_total)}
            </td>
            <td data-testid="reconciliation-total">
              {formatSignedEuro(rec.diff_total)}
            </td>
          </tr>
        </tbody>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Druck
// ---------------------------------------------------------------------------

/**
 * A4-Druck der Berichte. Die App-Hülle blendet `admin/layout.tsx` schon aus,
 * Seitenaktionen `PageHeader`; hier kommen schwarze Schrift, schmale Zellen,
 * keine Bedienelemente und - wie bei Backzettel und Hilfe - keine Animation
 * (sonst druckte ein gerade eingeblendeter Abschnitt blass). Hell rendert
 * `Providers.tsx` beim Drucken ohnehin (`useIsPrinting`).
 */
export function FinanceReportPrintStyles() {
  return (
    <GlobalStyles
      styles={{
        '@page': { size: 'A4', margin: '14mm' },
        '@media print': {
          '.fin-report, .fin-report *': {
            animation: 'none !important',
            transition: 'none !important',
            opacity: '1 !important',
            color: '#000 !important',
            boxShadow: 'none !important',
          },
          '.fin-report .MuiPaper-root': {
            border: '1px solid #bbb',
            backgroundColor: '#fff !important',
            backgroundImage: 'none !important',
          },
          '.fin-report .MuiTableCell-root': {
            padding: '3px 6px !important',
            fontSize: '9.5pt',
          },
          '.fin-report thead': { display: 'table-header-group' },
          '.fin-report tr, .fin-report li': { breakInside: 'avoid' },
          '.fin-report [data-print="hide"], .fin-report .fin-no-print': {
            display: 'none !important',
          },
          '.fin-report .fin-print-only': { display: 'block !important' },
          '.fin-report a': { textDecoration: 'none' },
          '.fin-report a::after': { display: 'none !important' },
        },
      }}
    />
  )
}

/** Nur auf dem Papier: Herkunft und Stand des Ausdrucks. */
export function PrintOnlyLine({
  children,
  'data-testid': testId,
}: {
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <Typography
      variant="body2"
      className="fin-print-only"
      data-testid={testId}
      sx={{ display: 'none' }}
    >
      {children}
    </Typography>
  )
}
