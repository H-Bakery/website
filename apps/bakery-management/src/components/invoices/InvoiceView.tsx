import React from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  formatEuro,
  formatIban,
  formatInvoiceDate,
  formatQuantity,
  type Invoice,
} from '../../lib/invoicesApi'

function Row({
  label,
  value,
  strong = false,
  testId,
}: {
  label: string
  value: string
  strong?: boolean
  testId?: string
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        py: 0.5,
        fontWeight: strong ? 700 : 400,
        borderTop: strong ? 2 : 0,
        borderColor: 'text.primary',
        mt: strong ? 0.5 : 0,
      }}
    >
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </Box>
  )
}

const rate = (value: number) => `${String(value).replace('.', ',')} %`

/**
 * Die Rechnung zum Lesen und Drucken - dieselben Angaben wie in der PDF
 * (§ 14 Abs. 4 UStG): Verkäufer und Empfänger mit Anschrift, USt-IdNr.,
 * Nummer, Rechnungs- und Leistungsdatum, Positionen, Netto und Steuer je
 * Satz, Bruttobetrag, Zahlungsbedingung, Bankverbindung. Alle Zahlen kommen
 * fertig von der API; hier wird nichts gerechnet.
 */
export default function InvoiceView({ invoice }: { invoice: Invoice }) {
  const { seller, buyer, totals } = invoice
  const rounded = totals.roundingCents !== 0
  return (
    <Box
      data-testid="invoice-view"
      sx={{
        typography: 'body2',
        '@media print': { fontSize: '10.5pt' },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3,
          '@media print': { gridTemplateColumns: '1fr 1fr' },
        }}
      >
        <Box data-testid="invoice-seller">
          <Typography variant="overline" color="text.secondary">
            Rechnungssteller
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>{seller.name}</Typography>
          <div>{seller.street}</div>
          <div>
            {seller.postcode} {seller.city}
          </div>
          {seller.vatId && <div>USt-IdNr. {seller.vatId}</div>}
          {seller.phone && <div>Telefon {seller.phone}</div>}
          {seller.email && <div>{seller.email}</div>}
        </Box>
        <Box data-testid="invoice-buyer">
          <Typography variant="overline" color="text.secondary">
            Rechnungsempfänger
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>{buyer.name || '–'}</Typography>
          {buyer.careOf && <div>{buyer.careOf}</div>}
          <div>{buyer.street}</div>
          <div>
            {buyer.postcode} {buyer.city}
          </div>
          {buyer.countryCode && buyer.countryCode !== 'DE' && (
            <div>{buyer.countryCode}</div>
          )}
        </Box>
      </Box>

      <Box
        component="dl"
        data-testid="invoice-meta"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 2,
          rowGap: 0.5,
          my: 3,
          '& dt': { color: 'text.secondary' },
          '& dd': { m: 0, fontWeight: 600 },
        }}
      >
        <dt>Rechnungsnummer</dt>
        <dd>{invoice.number || '–'}</dd>
        <dt>Rechnungsdatum</dt>
        <dd>{formatInvoiceDate(invoice.invoiceDate)}</dd>
        <dt>Liefer-/Leistungsdatum</dt>
        <dd>{formatInvoiceDate(invoice.deliveryDate)}</dd>
        {invoice.preorderCode && (
          <>
            <dt>Bestellung</dt>
            <dd>{invoice.preorderCode}</dd>
          </>
        )}
      </Box>

      <TableContainer>
        <Table size="small" aria-label="Positionen">
          <TableHead>
            <TableRow>
              <TableCell>Pos.</TableCell>
              <TableCell>Bezeichnung</TableCell>
              <TableCell align="right">Menge</TableCell>
              <TableCell>Einheit</TableCell>
              <TableCell align="right">Einzelpreis brutto</TableCell>
              <TableCell align="right">USt</TableCell>
              <TableCell align="right">Netto</TableCell>
              <TableCell align="right">Brutto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lines.map((line) => (
              <TableRow key={line.position}>
                <TableCell>{line.position}</TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>
                  {line.name}
                </TableCell>
                <TableCell align="right">
                  {formatQuantity(line.quantity)}
                </TableCell>
                <TableCell>{line.unit}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {formatEuro(line.unitPriceGrossCents)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {rate(line.vatRate)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {formatEuro(line.netCents)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {formatEuro(line.grossCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        data-testid="invoice-totals"
        sx={{ ml: 'auto', mt: 2, maxWidth: 360, breakInside: 'avoid' }}
      >
        {invoice.vat.map((group) => (
          <React.Fragment key={group.rate}>
            <Row
              label={`Netto (${rate(group.rate)} USt)`}
              value={formatEuro(group.netCents)}
            />
            <Row
              label={`zzgl. ${rate(group.rate)} Umsatzsteuer`}
              value={formatEuro(group.vatCents)}
            />
          </React.Fragment>
        ))}
        {invoice.vat.length > 1 && (
          <>
            <Row label="Summe netto" value={formatEuro(totals.netCents)} />
            <Row
              label="Summe Umsatzsteuer"
              value={formatEuro(totals.vatCents)}
            />
          </>
        )}
        {rounded ? (
          <>
            <Row
              label="Rechnungsbetrag (netto + USt)"
              value={formatEuro(totals.grandTotalCents)}
            />
            <Row
              label="Rundung"
              value={formatEuro(totals.roundingCents)}
              testId="invoice-rounding"
            />
            <Row
              label="Zahlbetrag (brutto)"
              value={formatEuro(totals.dueCents)}
              strong
              testId="invoice-due"
            />
          </>
        ) : (
          <Row
            label="Rechnungsbetrag (brutto)"
            value={formatEuro(totals.dueCents)}
            strong
            testId="invoice-due"
          />
        )}
      </Box>

      <Box sx={{ mt: 3, breakInside: 'avoid' }} data-testid="invoice-payment">
        {invoice.paymentTerms && <div>{invoice.paymentTerms}</div>}
        {seller.iban ? (
          <Box sx={{ mt: 1, fontWeight: 600 }}>
            <div>Kontoinhaber: {seller.accountHolder}</div>
            <div>IBAN: {formatIban(seller.iban)}</div>
            <div>
              BIC: {seller.bic}
              {seller.bankName ? ` · ${seller.bankName}` : ''}
            </div>
          </Box>
        ) : (
          <Box sx={{ mt: 1, color: 'text.secondary' }}>
            Bankverbindung: nicht eingerichtet
          </Box>
        )}
        {invoice.note && (
          <Box sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{invoice.note}</Box>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 2 }}
        >
          Die Positionspreise sind Bruttopreise. Die Nettobeträge je Position
          sind anteilig aus der Bruttosumme je Steuersatz berechnet.
        </Typography>
      </Box>
    </Box>
  )
}
