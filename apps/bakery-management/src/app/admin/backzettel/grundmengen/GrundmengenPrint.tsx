'use client'
import React from 'react'
import { GlobalStyles } from '@mui/material'
import {
  cellValue,
  displayValue,
  groupBySection,
  isPerVariant,
  referenceFor,
  variantLabel,
  WEEKDAY_SHORT,
  type GrundmengenConfig,
  type GrundmengenItem,
  type ReferenceResponse,
} from '../../../../lib/grundmengenApi'

/**
 * Druckbild der Grundmengen: eine schlichte Tabelle Posten × Di–So auf A4
 * quer, schwarz auf weiß - unabhängig vom Bildschirm-Raster, dessen
 * Eingabefelder und Referenz-Spalten auf dem Blatt nicht Platz hätten (der
 * Samstag fiele hinten herunter).
 *
 * Am Bildschirm unsichtbar (`grundmengen-print-only`), im Druck verschwinden
 * App-Hülle (AppBar, Navigation, Breadcrumb aus `admin/layout.tsx`) und alles
 * mit `grundmengen-screen-only`. Die Farben werden erzwungen, weil
 * `TableCell` seine Textfarbe selbst setzt - im (standardmäßig) dunklen
 * Admin-Bereich wäre sie hellgrau auf weißem Papier.
 */
export const grundmengenPrintStyles = (
  <GlobalStyles
    styles={{
      '.grundmengen-print-only': { display: 'none' },
      '@media print': {
        '@page': { size: 'A4 landscape', margin: '10mm' },
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: {
          padding: '0 !important',
          width: '100% !important',
        },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.grundmengen-screen-only': { display: 'none !important' },
        '.grundmengen-print-only': { display: 'block !important' },
        '.grundmengen-print, .grundmengen-print *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
        },
      },
    }}
  />
)

const cellSx: React.CSSProperties = {
  border: '1px solid #999',
  padding: '1.2mm 1.6mm',
  verticalAlign: 'top',
}

function approvedValue(
  approved: GrundmengenConfig | null,
  item: GrundmengenItem,
  weekday: number,
  variant: string | null,
  value: number | null | undefined
): { value: number | null | undefined } | null {
  if (!approved) return null
  const was = approved.items.find((i) => i.id === item.id)
  if (!was) return null
  const before = cellValue(was, weekday, variant)
  const norm = (v: number | null | undefined) => (v === undefined ? 0 : v)
  return norm(before) === norm(value) ? null : { value: before }
}

function printValue(value: number | null | undefined): string {
  return value === null ? 'offen' : displayValue(value)
}

export interface GrundmengenPrintProps {
  config: GrundmengenConfig
  /** Freigegebener Stand, nur wenn Änderungen auf Freigabe warten. */
  approved: GrundmengenConfig | null
  reference: ReferenceResponse | null
  printedAt?: Date
}

export default function GrundmengenPrint({
  config,
  approved,
  reference,
  printedAt = new Date(),
}: GrundmengenPrintProps) {
  const days = [...config.days].sort((a, b) => a - b)
  const sections = groupBySection(config)
  let anyChanged = false
  const showReference = Boolean(reference && reference.status === 'ok')

  const dayCells = (item: GrundmengenItem, variant: string | null) =>
    days.map((wd) => {
      const value = cellValue(item, wd, variant)
      const parentOfVariants = item.variants.length > 0 && variant === null
      const hidden =
        parentOfVariants &&
        (isPerVariant(item, wd) || !(typeof value === 'number' && value > 0))
      const was = hidden
        ? null
        : approvedValue(approved, item, wd, variant, value)
      if (was) anyChanged = true
      const ref =
        variant === null && showReference
          ? referenceFor(reference, wd, item.id)
          : null
      return (
        <td key={wd} style={{ ...cellSx, textAlign: 'right' }}>
          {hidden ? (
            parentOfVariants && isPerVariant(item, wd) ? (
              <span style={{ fontSize: '8pt' }}>je Sorte</span>
            ) : null
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontStyle: value === null ? 'italic' : undefined,
              }}
            >
              {printValue(value)}
              {was ? ` * (${printValue(was.value)})` : ''}
            </span>
          )}
          {ref && ref.median !== null && (
            <div style={{ fontSize: '7.5pt' }}>
              ≈ {displayValue(ref.median)}
              {item.unit === 'Stück' || ref.converted ? '' : ' St.'}
            </div>
          )}
        </td>
      )
    })

  const rows = sections.map((section) => (
    <React.Fragment key={section.id}>
      <tr>
        <th
          colSpan={days.length + 2}
          style={{ ...cellSx, textAlign: 'left', fontSize: '10pt' }}
        >
          {section.label}
        </th>
      </tr>
      {section.items.map((item) => (
        <React.Fragment key={item.id}>
          <tr style={{ breakInside: 'avoid' }}>
            <td style={cellSx}>
              <strong>{item.name}</strong>
              {item.plu.length > 0 && (
                <span style={{ fontSize: '7.5pt' }}>
                  {' '}
                  · PLU {item.plu.join(', ')}
                </span>
              )}
            </td>
            <td style={cellSx}>{item.unit}</td>
            {dayCells(item, null)}
          </tr>
          {item.variants.map((variant) => (
            <tr key={variant} style={{ breakInside: 'avoid' }}>
              <td style={{ ...cellSx, paddingLeft: '6mm' }}>
                {variantLabel(config, variant, item)}
              </td>
              <td style={cellSx}>{item.unit}</td>
              {dayCells(item, variant)}
            </tr>
          ))}
        </React.Fragment>
      ))}
    </React.Fragment>
  ))

  return (
    <div
      className="grundmengen-print-only grundmengen-print"
      data-testid="grundmengen-print"
      style={{ fontSize: '9pt', fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div style={{ fontSize: '14pt', fontWeight: 700, marginBottom: '2mm' }}>
        Grundmengen je Wochentag
      </div>
      <div style={{ marginBottom: '3mm' }}>
        Stand {printedAt.toLocaleDateString('de-DE')} · leer/„offen“ = noch
        nicht festgelegt, 0 = wird an dem Tag nicht gebacken
      </div>
      <table
        aria-hidden="true"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: '26%' }} />
          <col style={{ width: '8%' }} />
          {days.map((wd) => (
            <col key={wd} />
          ))}
        </colgroup>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            <th style={{ ...cellSx, textAlign: 'left' }}>Posten</th>
            <th style={{ ...cellSx, textAlign: 'left' }}>Einheit</th>
            {days.map((wd) => (
              <th key={wd} style={{ ...cellSx, textAlign: 'right' }}>
                {WEEKDAY_SHORT[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <div style={{ marginTop: '2mm', fontSize: '8pt' }}>
        {anyChanged &&
          '* geändert, wartet auf Freigabe in hq - in Klammern der freigegebene Wert, mit dem der Backzettel bis dahin rechnet. '}
        {showReference &&
          '≈ Median verkauft, letzte 6 gleiche Wochentage (in der Einheit des Postens, sonst „St.“ = Stück laut Kasse) - nur zur Information.'}
      </div>
    </div>
  )
}
