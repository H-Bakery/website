'use client'

import React from 'react'
import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { PageSection } from '../../../components/layout'
import {
  BASIS_LABELS,
  postenLabel,
  type AbgleichEuro,
} from '../../../lib/abgleichApi'
import { formatCurrency } from '../../../lib/partnerTypes'

const percent = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 1,
})
const fullDay = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'full',
  timeZone: 'UTC',
})
const signedEuro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
})

export default function AbgleichEuroView({
  euro,
  configAvailable,
  busy,
  onChange,
}: {
  euro?: AbgleichEuro
  configAvailable: boolean
  busy: boolean
  onChange: (sections: string[]) => void
}) {
  if (!euro) return <Typography>Euro-Abgleich nicht verfügbar.</Typography>
  const selected = euro.abschnitte.filter((s) => s.folgetag).map((s) => s.id)

  return (
    <>
      {!configAvailable && (
        <Alert severity="warning">
          Die Backzettel-Stammdaten fehlen oder sind ungültig.
        </Alert>
      )}
      <PageSection title="Euro-Abgleich">
        <Typography variant="body2">
          Soll = (gebacken − CAP − Vorbestellungen per Überweisung oder
          Rechnung) × Ladenpreis.
        </Typography>
        <Typography variant="body2">
          Anteil der Sammelnummern am Kassenumsatz:{' '}
          <strong>
            {euro.sammelAnteil === null
              ? 'offen'
              : percent.format(euro.sammelAnteil)}
          </strong>
          {' · '}
          {formatCurrency(euro.sammelEur)}
        </Typography>
        {euro.abschnitte.length > 0 && (
          <Box
            component="fieldset"
            disabled={busy}
            sx={{ border: 0, px: 0, ml: 0, mt: 2 }}
          >
            <Typography component="legend" variant="subtitle2">
              Folgetag einrechnen
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ein Verkaufsüberschuss am Folgetag kann eine Lücke am Vortag
              ausgleichen.
            </Typography>
            <FormGroup row>
              {euro.abschnitte.map((s) => (
                <FormControlLabel
                  key={s.id}
                  label={s.label}
                  control={
                    <Checkbox
                      checked={s.folgetag}
                      disabled={busy}
                      onChange={(_, checked) =>
                        onChange(
                          checked
                            ? [...selected, s.id]
                            : selected.filter((id) => id !== s.id)
                        )
                      }
                    />
                  }
                />
              ))}
            </FormGroup>
          </Box>
        )}
      </PageSection>
      {euro.days.length === 0 && (
        <Typography>Keine Backtage im Zeitraum.</Typography>
      )}
      {euro.days.map((day) => (
        <PageSection
          key={day.date}
          title={fullDay.format(new Date(day.date))}
          description={[
            day.basis ? BASIS_LABELS[day.basis] : 'Kein Backzettel',
            day.report
              ? `Kassenumsatz ${formatCurrency(day.kasseEur)}`
              : 'Kein Kassenbericht',
          ].join(' · ')}
          disablePadding
        >
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Euro-Abgleich je Abschnitt">
              <TableHead>
                <TableRow>
                  <TableCell>Abschnitt</TableCell>
                  <TableCell align="right">Soll €</TableCell>
                  <TableCell align="right">Ist € (Kasse)</TableCell>
                  <TableCell align="right">Differenz €</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {day.abschnitte.map((s) => (
                  <TableRow key={s.section ?? 'offen'}>
                    <TableCell component="th" scope="row">
                      {s.sectionLabel}
                      {s.grundmengeOffen && (
                        <Typography variant="caption" component="div">
                          Grundmenge offen
                        </Typography>
                      )}
                      {s.preisOffen.length > 0 && (
                        <Typography variant="caption" component="div">
                          Preis offen:{' '}
                          {day.items
                            .filter((item) => s.preisOffen.includes(item.key))
                            .map(postenLabel)
                            .join(', ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(s.sollEur)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(s.istEur)}
                      {s.sammelEur !== null && s.sammelEur !== 0 && (
                        <Typography variant="caption" component="div">
                          Davon Sammelnummern: {formatCurrency(s.sammelEur)}
                        </Typography>
                      )}
                      {s.handelswareEur !== null && s.handelswareEur !== 0 && (
                        <Typography variant="caption" component="div">
                          Handelsware zusätzlich:{' '}
                          {formatCurrency(s.handelswareEur)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {s.differenzEur === null
                        ? '—'
                        : signedEuro.format(s.differenzEur)}
                      {s.differenzEur !== null &&
                        s.differenzEur < 0 &&
                        !s.restCounted && (
                          <Typography variant="caption" component="div">
                            Nicht verkauft oder nicht kassiert
                          </Typography>
                        )}
                      {s.folgetagEur !== 0 && (
                        <Typography variant="caption" component="div">
                          {signedEuro.format(s.folgetagEur)}{' '}
                          {s.folgetagEur > 0
                            ? 'vom Folgetag'
                            : 'für den Vortag'}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {day.report && (
                  <TableRow>
                    <TableCell component="th" scope="row">
                      Handelsware
                    </TableCell>
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">
                      {formatCurrency(day.handelswareEur)}
                    </TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {(day.items.length > 0 || day.nichtZuordenbar.length > 0) && (
            <Box component="details" sx={{ px: 2, py: 1 }}>
              <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
                Posten und Kassennummern
              </Box>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label="Euro-Abgleich je Posten">
                  <TableHead>
                    <TableRow>
                      <TableCell>Posten oder Kassennummer</TableCell>
                      <TableCell align="right">Soll €</TableCell>
                      <TableCell align="right">Ist € (Kasse)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {day.items.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell component="th" scope="row">
                          {postenLabel(item)}
                        </TableCell>
                        <TableCell align="right">
                          {item.preisOffen
                            ? 'Preis offen'
                            : formatCurrency(item.sollEur)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(item.istEur)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {day.nichtZuordenbar.map((sale) => (
                      <TableRow key={sale.plu ?? sale.name ?? 'unbekannt'}>
                        <TableCell component="th" scope="row">
                          {[sale.name, sale.plu].filter(Boolean).join(' · ') ||
                            'Kassenposition'}
                          <Typography variant="caption" component="div">
                            {sale.sammel ? 'Sammelnummer · ' : ''}Nicht
                            zuordenbar
                          </Typography>
                        </TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">
                          {formatCurrency(sale.istEur)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </PageSection>
      ))}
    </>
  )
}
