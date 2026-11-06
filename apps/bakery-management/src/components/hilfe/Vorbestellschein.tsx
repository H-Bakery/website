import React from 'react'
import { Box, GlobalStyles } from '@mui/material'

/**
 * Leerer Vorbestellschein für den Papierbetrieb (P6). Die Felder folgen der
 * Erfassungsmaske (`admin/preorders/PreorderForm.tsx`): Name, Telefon,
 * Bestellweg, Abholung (Laden: Tag + Uhrzeit, oder Sammelstelle), Positionen
 * Produkt/Sorte/Menge, bezahlt, Notiz - dazu, wer den Schein aufgenommen hat,
 * und der Haken „in App übertragen" mit dem Code, den die App beim Nachtragen
 * vergibt.
 *
 * Nur gedruckt (`.hilfe-print-only`): 2 oder 4 Scheine je A4-Seite mit
 * Schnittlinien. Feste Höhen in mm, damit es immer genau eine Seite bleibt.
 */

export type ScheineProSeite = 2 | 4

/** Druckbare Höhe: A4 (297 mm) − 2 × 10 mm Rand, mit etwas Luft. */
const PAGE_HEIGHT_MM = 270

const box = (
  <span className="vbs-box" aria-hidden="true">
    {' '}
  </span>
)

function Line({
  label,
  grow = 1,
  min,
}: {
  label: string
  grow?: number
  min?: string
}) {
  return (
    <span className="vbs-field" style={{ flexGrow: grow, minWidth: min }}>
      <span className="vbs-label">{label}</span>
      <span className="vbs-line" />
    </span>
  )
}

function Check({ label }: { label: string }) {
  return (
    <span className="vbs-check">
      {box}
      {label}
    </span>
  )
}

function Slip({ rows, compact }: { rows: number; compact: boolean }) {
  return (
    <section className="vbs-slip">
      <div className="vbs-row vbs-head">
        <span className="vbs-title">Vorbestellschein</span>
        {!compact && (
          <span className="vbs-hint">Papierbetrieb · später in die App</span>
        )}
      </div>
      <div className="vbs-row">
        <Line label="Name" grow={3} />
        <Line label="Telefon" grow={2} />
      </div>
      <div className="vbs-row">
        <span className="vbs-label">Bestellweg</span>
        <Check label="Laden" />
        <Check label="Telefon" />
        <Check label="WhatsApp" />
      </div>
      <div className={`vbs-row${compact ? ' vbs-wrap' : ''}`}>
        <Check label="Abholung im Laden" />
        <Line label="Tag" min={compact ? '22mm' : '26mm'} />
        <Line label="Uhrzeit" min="16mm" />
      </div>
      <div className="vbs-row">
        <Check label="Sammelstelle" />
        <Line label="welche" grow={2} />
        <Line label="Tag" min={compact ? '18mm' : '26mm'} />
      </div>
      <table className="vbs-items">
        <thead>
          <tr>
            <th className="hilfe-shade">Produkt</th>
            <th className="hilfe-shade vbs-sorte">Sorte</th>
            <th className="hilfe-shade vbs-menge">Menge</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="vbs-row">
        <Check label="bezahlt" />
        <Line label="Anmerkung" grow={4} />
      </div>
      <div className="vbs-row">
        <Line label="Aufgenommen von" grow={2} />
        <Line label="am" min={compact ? '14mm' : '22mm'} />
        <Line label="um" min={compact ? '10mm' : '14mm'} />
      </div>
      <div className="vbs-row vbs-done hilfe-shade">
        <Check label="in App übertragen" />
        <Line label={compact ? 'Code' : 'Code aus der App'} grow={3} />
        <Line label="von" />
      </div>
    </section>
  )
}

const styles = (
  <GlobalStyles
    styles={{
      '.vbs-page': {
        boxSizing: 'border-box',
        height: `${PAGE_HEIGHT_MM}mm`,
        overflow: 'hidden',
        display: 'grid',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
      },
      // minmax(0, …): sonst schiebt die Mindestbreite der Zeilen die rechte
      // Spalte über den Blattrand.
      '.vbs-page.vbs-2': {
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: '1fr 1fr',
        fontSize: '10pt',
      },
      '.vbs-page.vbs-4': {
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gridTemplateRows: '1fr 1fr',
        fontSize: '8.5pt',
      },
      // Schnittlinien: gestrichelt zwischen den Scheinen, mit Schere.
      '.vbs-slip': {
        boxSizing: 'border-box',
        position: 'relative',
        minWidth: 0,
        padding: '4mm',
        display: 'flex',
        flexDirection: 'column',
        gap: '2mm',
        // sichtbar, damit die Schere auf der Schnittlinie nicht abgeschnitten wird
        overflow: 'visible',
      },
      '.vbs-2 .vbs-slip:nth-of-type(2), .vbs-4 .vbs-slip:nth-of-type(n+3)': {
        borderTop: '0.8pt dashed #000',
      },
      '.vbs-4 .vbs-slip:nth-of-type(2n)': { borderLeft: '0.8pt dashed #000' },
      '.vbs-2 .vbs-slip:nth-of-type(2)::before, .vbs-4 .vbs-slip:nth-of-type(3)::before':
        {
          content: '"✂"',
          position: 'absolute',
          top: '-2.6mm',
          left: '-0.5mm',
          fontSize: '10pt',
          lineHeight: 1,
          background: '#fff',
        },
      '.vbs-row': {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3mm',
        whiteSpace: 'nowrap',
      },
      '.vbs-wrap': { flexWrap: 'wrap', rowGap: '2mm' },
      '.vbs-head': { justifyContent: 'space-between', alignItems: 'center' },
      '.vbs-title': { fontSize: '1.35em', fontWeight: 700 },
      '.vbs-hint': { fontSize: '0.85em' },
      '.vbs-field': {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1.5mm',
        minWidth: '12mm',
      },
      '.vbs-label': { fontWeight: 700, fontSize: '0.9em' },
      '.vbs-line': {
        flexGrow: 1,
        borderBottom: '0.6pt solid #000',
        height: '5mm',
        minWidth: '8mm',
      },
      '.vbs-check': {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1.2mm',
      },
      '.vbs-box': {
        display: 'inline-block',
        width: '3.4mm',
        height: '3.4mm',
        border: '0.8pt solid #000',
      },
      '.vbs-items': {
        width: '100%',
        borderCollapse: 'collapse',
        flexGrow: 1,
      },
      '.vbs-items th, .vbs-items td': {
        border: '0.5pt solid #000',
        padding: '0.5mm 1.5mm',
        textAlign: 'left',
        fontSize: '0.9em',
      },
      '.vbs-items td': { height: '6mm' },
      '.vbs-4 .vbs-items td': { height: '5.2mm' },
      '.vbs-items .vbs-sorte': { width: '28%' },
      '.vbs-items .vbs-menge': { width: '16%' },
      '.vbs-done': { padding: '1.5mm', border: '0.8pt solid #000' },
    }}
  />
)

export default function Vorbestellschein({
  perPage,
}: {
  perPage: ScheineProSeite
}) {
  const rows = perPage === 2 ? 9 : 6
  return (
    <>
      {styles}
      <Box
        className="hilfe-sheet hilfe-print-only"
        data-sheet={`vorbestellschein-${perPage}`}
        data-testid={`sheet-vorbestellschein-${perPage}`}
        aria-hidden="true"
      >
        <div className={`vbs-page vbs-${perPage}`}>
          {Array.from({ length: perPage }, (_, i) => (
            <Slip key={i} rows={rows} compact={perPage === 4} />
          ))}
        </div>
      </Box>
    </>
  )
}
