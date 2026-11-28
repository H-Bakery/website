'use client'
/**
 * Das Blatt der Preisliste - Vorschau am Bildschirm und Druckbild zugleich
 * (A4 hoch, zwei Spalten). Immer hell und in Schwarz auf Weiß, unabhängig
 * vom Dunkelmodus: es ist ein Dokument, das ausgehängt oder einem Partner
 * mitgegeben wird.
 *
 * Gerechnet, sortiert oder formatiert wird hier nichts - Reihenfolge,
 * Varianten und Preistexte kommen fertig aus `price-list.core.js` (API).
 */
import React from 'react'
import { Box } from '@mui/material'
import {
  ALLERGEN_SOURCE_NOTES,
  CROSS_CONTAMINATION_NOTE,
  NO_DECLARATION_NOTE,
} from '@bakery/shared/utils'
import { cssString } from '../../../../components/finance/FinancePrint'
import type {
  PriceListCategory,
  PriceListDoc,
  PriceListRow,
} from '../../../../lib/priceListApi'
import { SELLER, type Seller } from '../../../../lib/seller'

const INK = '#111'
const SECONDARY = '#444'
const RULE = '#9a9a9a'
const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

/** Zeilen, die mit der Überschrift einer Kategorie zusammenbleiben. */
export const ROWS_KEPT_WITH_HEADING = 3

/**
 * Seitenformat und Fußzeile (Stand + Seitenzahl) über `@page`-Randfelder
 * (Chrome ab 131; andere Browser drucken ohne Fußzeile, „Stand“ steht
 * deshalb auch im Kopf). Rohes CSS wie in `FinancePrint.tsx`.
 */
export function priceListPageCss(footerLeft: string): string {
  const font = `font: 7.5pt ${SANS}; color: ${SECONDARY};`
  return [
    '@page {',
    '  size: A4 portrait;',
    '  margin: 13mm 13mm 15mm 13mm;',
    `  @bottom-left { content: ${cssString(footerLeft)}; ${font} }`,
    `  @bottom-right { content: "Seite " counter(page) " von " counter(pages); ${font} }`,
    '}',
  ].join('\n')
}

const SHEET_SX = {
  // ---- Blatt: am Bildschirm ein weißes A4-Blatt, im Druck die Seite selbst
  color: INK,
  bgcolor: '#fff',
  fontFamily: SANS,
  fontSize: '9.5pt',
  lineHeight: 1.35,
  width: '210mm',
  maxWidth: '100%',
  mx: 'auto',
  p: '13mm',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  boxShadow: 3,
  colorScheme: 'light',
  '@media (max-width: 900px)': { p: '6mm' },
  '@media print': {
    width: 'auto',
    p: 0,
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
  },
  '& *': { boxSizing: 'border-box' },

  // ---- Kopf
  '& .pl-head': {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '8mm',
    pb: '3mm',
    borderBottom: `2pt solid ${INK}`,
  },
  '& .pl-kicker': {
    fontSize: '9pt',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  '& .pl-title': {
    m: '1mm 0 0',
    fontFamily: SERIF,
    fontSize: '27pt',
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-0.01em',
  },
  '& .pl-for': { mt: '1.5mm', fontSize: '10.5pt', fontWeight: 600 },
  '& .pl-contact': {
    m: 0,
    textAlign: 'right',
    fontSize: '8.5pt',
    fontStyle: 'normal',
    color: SECONDARY,
    whiteSpace: 'nowrap',
    '& strong': { color: INK },
  },
  '& .pl-meta': {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: '8mm',
    rowGap: '1mm',
    pt: '1.5mm',
    mb: '5mm',
    borderTop: `0.5pt solid ${INK}`,
    mt: '0.8mm',
    fontSize: '8.5pt',
    color: SECONDARY,
    '& strong': { color: INK, fontWeight: 700 },
  },

  // ---- Spalten
  '& .pl-columns': {
    columnCount: 2,
    columnGap: '9mm',
    columnRule: `0.5pt solid ${RULE}`,
    '@media (max-width: 700px)': { columnCount: 1 },
    '@media print': { columnCount: 2 },
  },
  '& .pl-single': { columnCount: 1, maxWidth: '120mm' },
  '& .pl-category': { mb: '5.5mm' },
  // Überschrift nie allein am Spalten- oder Seitenende.
  '& .pl-keep': { breakInside: 'avoid' },
  '& .pl-cat-head': {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '3mm',
    pb: '0.8mm',
    mb: '0.6mm',
    borderBottom: `1.25pt solid ${INK}`,
  },
  '& .pl-cat-title': {
    m: 0,
    fontFamily: SERIF,
    fontSize: '14pt',
    fontWeight: 700,
    lineHeight: 1.15,
  },
  '& .pl-cols': { display: 'flex', flex: 'none' },
  '& .pl-col': {
    width: '15mm',
    textAlign: 'right',
    fontSize: '7.5pt',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: SECONDARY,
    whiteSpace: 'nowrap',
  },

  // ---- Zeilen
  '& .pl-row': {
    breakInside: 'avoid',
    py: '1mm',
    borderBottom: `0.5pt dotted ${RULE}`,
  },
  '& .pl-line': {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '3mm',
  },
  '& .pl-name': {
    minWidth: 0,
    fontSize: '10pt',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  '& .pl-unit': {
    ml: '1.5mm',
    fontSize: '8.5pt',
    fontWeight: 400,
    color: SECONDARY,
    whiteSpace: 'nowrap',
  },
  '& .pl-note': {
    ml: '1.5mm',
    fontSize: '8pt',
    fontWeight: 400,
    fontStyle: 'italic',
    color: SECONDARY,
  },
  '& .pl-sub': {
    pl: '4mm',
    mt: '0.4mm',
    '& .pl-sublabel': { fontSize: '9pt', color: SECONDARY },
  },
  '& .pl-price': {
    flex: 'none',
    fontSize: '10pt',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  '& .pl-cell': { width: '15mm' },
  '& .pl-prices': { display: 'flex', flex: 'none' },
  '& .pl-allergens': {
    mt: '0.3mm',
    fontSize: '7.5pt',
    lineHeight: 1.3,
    color: SECONDARY,
  },

  // ---- Fuß des Dokuments
  '& .pl-foot': {
    mt: '2mm',
    pt: '2mm',
    borderTop: `0.5pt solid ${INK}`,
    fontSize: '7.5pt',
    lineHeight: 1.4,
    color: SECONDARY,
    breakInside: 'avoid',
    '& p': { m: '0 0 1mm' },
  },
} as const

function Allergens({ row }: { row: PriceListRow }) {
  if (!row.allergens) return null
  return (
    <div className="pl-allergens">
      {row.allergens.declared
        ? `Enthält: ${row.allergens.text}`
        : 'Allergene: bitte nachfragen*'}
      {row.allergens.declared && row.allergens.partial ? '*' : ''}
    </div>
  )
}

function Note({ text }: { text: string }) {
  return text ? <span className="pl-note">{text}</span> : null
}

/** Eine Zeile der Gewichts-Tabelle (Brot: 500 g | 750 g | 1000 g). */
function MatrixRow({ row, columns }: { row: PriceListRow; columns: string[] }) {
  const note = row.variants.every((v) => v.note === row.variants[0].note)
    ? row.variants[0].note
    : ''
  return (
    <div className="pl-row" data-testid={`pl-row-${row.key}`}>
      <div className="pl-line">
        <span className="pl-name">
          {row.name}
          <Note text={note} />
        </span>
        <span className="pl-prices">
          {columns.map((column) => {
            const variant = row.variants.find((v) => v.label === column)
            return (
              <span key={column} className="pl-price pl-cell">
                {/* leere Zelle mit Grundlinie, sonst verrutscht die Zeile */}
                {variant ? variant.priceText : '\u00a0'}
              </span>
            )
          })}
        </span>
      </div>
      <Allergens row={row} />
    </div>
  )
}

/** Eine Zeile der Liste: erste Variante neben dem Namen, weitere eingerückt. */
function ListRow({ row }: { row: PriceListRow }) {
  const [first, ...rest] = row.variants
  return (
    <div className="pl-row" data-testid={`pl-row-${row.key}`}>
      <div className="pl-line">
        <span className="pl-name">
          {row.name}
          {first.label && <span className="pl-unit">{first.label}</span>}
          <Note text={first.note} />
        </span>
        <span className="pl-price">{first.priceText}</span>
      </div>
      {rest.map((variant) => (
        <div className="pl-line pl-sub" key={variant.productId}>
          <span className="pl-sublabel">
            {variant.label || variant.fullName}
            <Note text={variant.note} />
          </span>
          <span className="pl-price">{variant.priceText}</span>
        </div>
      ))}
      <Allergens row={row} />
    </div>
  )
}

function Category({ category }: { category: PriceListCategory }) {
  const columns = category.layout === 'matrix' ? category.columns ?? [] : null
  const render = (row: PriceListRow) =>
    columns ? (
      <MatrixRow key={row.key} row={row} columns={columns} />
    ) : (
      <ListRow key={row.key} row={row} />
    )
  return (
    <section
      className="pl-category"
      data-testid={`pl-category-${category.key}`}
      data-layout={category.layout}
    >
      <div className="pl-keep">
        <div className="pl-cat-head">
          <h2 className="pl-cat-title">{category.label}</h2>
          {columns && (
            <div className="pl-cols" aria-hidden="true">
              {columns.map((column) => (
                <span key={column} className="pl-col">
                  {column}
                </span>
              ))}
            </div>
          )}
        </div>
        {category.rows.slice(0, ROWS_KEPT_WITH_HEADING).map(render)}
      </div>
      {category.rows.slice(ROWS_KEPT_WITH_HEADING).map(render)}
    </section>
  )
}

export interface PriceListSheetProps {
  doc: PriceListDoc
  /** Absender im Kopf; Vorgabe: die Angaben aus dem Impressum. */
  seller?: Seller
}

export default function PriceListSheet({
  doc,
  seller = SELLER,
}: PriceListSheetProps) {
  const scope =
    doc.options.categories === null
      ? doc.partner
        ? 'Sortiment im Markt'
        : 'Gesamtes Sortiment'
      : doc.categories.map((c) => c.label).join(' · ')
  const partnerAddress = doc.partner
    ? [doc.partner.street, `${doc.partner.zip} ${doc.partner.city}`.trim()]
        .filter(Boolean)
        .join(', ')
    : ''
  const anyUndeclared = doc.categories.some((c) =>
    c.rows.some(
      (r) => r.allergens && (!r.allergens.declared || r.allergens.partial)
    )
  )
  const footerLeft = `${seller.name} · ${doc.title} · Stand: ${doc.generatedOnText}`
  const rowCount = doc.counts.rows

  return (
    <Box
      className="price-list-sheet"
      data-testid="price-list-sheet"
      sx={SHEET_SX}
    >
      <style
        // Nur dieser String; der einzige Text von außen (Titel, Datum) läuft
        // über `cssString`.
        dangerouslySetInnerHTML={{ __html: priceListPageCss(footerLeft) }}
      />
      <header className="pl-head">
        <div>
          <div className="pl-kicker">{seller.name}</div>
          <h1 className="pl-title">Preisliste</h1>
          {doc.partner && (
            <div className="pl-for" data-testid="pl-partner">
              für {doc.partner.name}
              {partnerAddress ? `, ${partnerAddress}` : ''}
            </div>
          )}
        </div>
        <address className="pl-contact">
          <strong>{seller.name}</strong>
          <br />
          {seller.street} · {seller.postalCode} {seller.city}
          <br />
          Telefon {seller.phone}
          <br />
          {seller.email}
        </address>
      </header>
      <div className="pl-meta">
        <span>
          <strong>{scope}</strong>
          {doc.partner ? ` · Abrechnung: ${doc.partner.settlementLabel}` : ''}
        </span>
        <span>
          {doc.validFromText && (
            <>
              <strong>Gültig ab {doc.validFromText}</strong>
              {' · '}
            </>
          )}
          Stand: {doc.generatedOnText}
        </span>
      </div>

      <div className={rowCount <= 14 ? 'pl-columns pl-single' : 'pl-columns'}>
        {doc.categories.map((category) => (
          <Category key={category.key} category={category} />
        ))}
      </div>

      <footer className="pl-foot">
        <p>Alle Preise in Euro.</p>
        {doc.options.withAllergens && (
          <>
            <p>
              Allergene: {ALLERGEN_SOURCE_NOTES.rezept}{' '}
              {CROSS_CONTAMINATION_NOTE}
            </p>
            {anyUndeclared && <p>* {NO_DECLARATION_NOTE}</p>}
          </>
        )}
      </footer>
    </Box>
  )
}
