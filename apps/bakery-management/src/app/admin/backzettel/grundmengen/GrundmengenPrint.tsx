'use client'
import React from 'react'
import { GlobalStyles } from '@mui/material'
import {
  cellValue,
  displayValue,
  groupBySection,
  isPerVariant,
  cellReference,
  variantLabel,
  SPECIAL_COLUMNS,
  WEEKDAY_SHORT,
  type BaseColumn,
  type GrundmengenConfig,
  type GrundmengenItem,
  type ReferenceResponse,
} from '../../../../lib/grundmengenApi'

/**
 * Druckbild der Grundmengen: eine schlichte Tabelle Posten × Di–So auf A4
 * quer, schwarz auf weiß - unabhängig vom Bildschirm-Raster, dessen
 * Eingabefelder und Referenz-Spalten auf dem Blatt nicht Platz hätten (der
 * Samstag fiele hinten herunter). Nach den Wochentagen stehen die
 * Sonderspalten „Vor FT“ / „Sa-Satz“ (Z14): nicht gesetzt = leer, nie 0.
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
        // Kopf des Layout-Kits (Titel, Rücklink): das Druckbild hat einen
        // eigenen Titel.
        '[data-testid="page-header"]': { display: 'none !important' },
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

/**
 * Wert einer Zelle, wie der Backzettel ihn rechnet. Wochentage: der Eintrag.
 * Sonderspalten (Z14): fehlt die Spalte am Posten, ist sie „nicht gesetzt“
 * (`undefined`, es gilt der Wochentag). Ist sie gesetzt, zählt eine Sorte
 * ohne Wert 0 - im Sorten-Eintrag ausgelassen oder unter einer Gesamtzahl -,
 * nicht die Menge des Wochentags.
 */
function effectiveValue(
  item: GrundmengenItem,
  column: BaseColumn,
  variant: string | null
): number | null | undefined {
  const value = cellValue(item, column, variant)
  if (typeof column === 'number' || value !== undefined) return value
  const set =
    item.baseSpecial !== undefined &&
    Object.prototype.hasOwnProperty.call(item.baseSpecial, column)
  return set && variant !== null ? 0 : undefined
}

function approvedValue(
  approved: GrundmengenConfig | null,
  item: GrundmengenItem,
  weekday: BaseColumn,
  variant: string | null,
  value: number | null | undefined
): { value: number | null | undefined } | null {
  if (!approved) return null
  const was = approved.items.find((i) => i.id === item.id)
  if (!was) return null
  const before = effectiveValue(was, weekday, variant)
  // Sonderspalten (Z14): fehlt = nicht gesetzt, nicht 0.
  const norm = (v: number | null | undefined) =>
    v === undefined && typeof weekday === 'number' ? 0 : v
  return norm(before) === norm(value) ? null : { value: before }
}

function printValue(value: number | null | undefined): string {
  return value === null ? 'offen' : displayValue(value)
}

/**
 * Wert einer Sonderspalte (Z14): kein Eintrag heißt „nicht gesetzt“ und
 * druckt leer - nie „0“ (der Zettel nimmt dann die Menge des Wochentags).
 */
function printSpecialValue(value: number | null | undefined): string {
  return value === undefined ? '' : printValue(value)
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
  let anyUnknown = false
  const showReference = Boolean(reference && reference.status === 'ok')

  const columns: { key: BaseColumn; short: string; title?: string }[] = [
    ...days.map((wd) => ({ key: wd, short: WEEKDAY_SHORT[wd] })),
    ...SPECIAL_COLUMNS.map((c) => ({
      key: c.key,
      short: c.short,
      title: c.long,
    })),
  ]

  const dayCells = (item: GrundmengenItem, variant: string | null) =>
    columns.map(({ key: wd }) => {
      const special = typeof wd !== 'number'
      const show = special ? printSpecialValue : printValue
      const value = effectiveValue(item, wd, variant)
      const parentOfVariants = item.variants.length > 0 && variant === null
      // Sonderspalten: die Postenzeile zeigt auch 0 und „offen“ - leer hieße
      // dort „nicht gesetzt, es gilt der Wochentag“.
      const hidden =
        parentOfVariants &&
        (isPerVariant(item, wd) ||
          (!special && !(typeof value === 'number' && value > 0)))
      const was = hidden
        ? null
        : approvedValue(approved, item, wd, variant, value)
      if (was) anyChanged = true
      // Z10: Laibgrößen-Zeilen mit dem Median der Größe (§9 Punkt 10).
      // Sonderspalten haben keine Referenz (kein Wochentag).
      const ref =
        showReference && !special
          ? cellReference(reference, wd, item, variant)
          : null
      if (ref?.status === 'unknown') anyUnknown = true
      const refKey = `${item.id}${variant ? `-${variant}` : ''}-${wd}`
      return (
        <td
          key={wd}
          style={{ ...cellSx, textAlign: 'right' }}
          data-testid={
            special
              ? `print-special-${item.id}${variant ? `-${variant}` : ''}-${wd}`
              : undefined
          }
        >
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
              {show(value)}
              {was ? ` * (${show(was.value) || '–'})` : ''}
            </span>
          )}
          {ref && ref.status === 'unknown' ? (
            // Größe ohne eigene Kassennummer: unbekannt, nie leer oder 0
            // (wie am Bildschirm).
            <div
              style={{ fontSize: '7.5pt', fontStyle: 'italic' }}
              data-testid={`print-reference-${refKey}`}
            >
              ≈ unbekannt
            </div>
          ) : (
            ref &&
            ref.median !== null && (
              <div
                style={{ fontSize: '7.5pt' }}
                data-testid={`print-reference-${refKey}`}
              >
                ≈ {displayValue(ref.median)}
                {item.unit === 'Stück' || ref.converted ? '' : ' St.'}
              </div>
            )
          )}
        </td>
      )
    })

  const rows = sections.map((section) => (
    <React.Fragment key={section.id}>
      <tr>
        <th
          colSpan={columns.length + 2}
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
        nicht festgelegt, 0 = wird an dem Tag nicht gebacken ·{' '}
        {SPECIAL_COLUMNS.map((c) => `${c.short} = ${c.long}`).join(', ')}: leer
        = nicht gesetzt, es gilt die Menge des Wochentags
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
          {columns.map((c) => (
            <col key={c.key} />
          ))}
        </colgroup>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            <th style={{ ...cellSx, textAlign: 'left' }}>Posten</th>
            <th style={{ ...cellSx, textAlign: 'left' }}>Einheit</th>
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                style={{ ...cellSx, textAlign: 'right' }}
              >
                {c.short}
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
        {showReference &&
          anyUnknown &&
          ' „≈ unbekannt“ = für diese Größe ist keine eigene Kassennummer hinterlegt (in den Stammdaten offen).'}
      </div>
    </div>
  )
}
