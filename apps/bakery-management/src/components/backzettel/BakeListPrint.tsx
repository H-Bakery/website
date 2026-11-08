'use client'

import React from 'react'
import { GlobalStyles } from '@mui/material'
import type {
  BackzettelConfigData,
  BackzettelLineDelta,
  BakeList,
} from '../../lib/backzettelApi'
import {
  bakeSourceText,
  deltaBadgeText,
  formatDateLong,
  formatQty,
  formatSignedQty,
  lineLabel,
} from '../../lib/backzettelFormat'
import { bakeListPrintLayout } from '../../lib/dayPrintLayout'
import { groupDeltasForPrint, printDeltaFigure } from './BackzettelPrint'

/**
 * Druckregeln der Backliste: auf dem Bildschirm unsichtbar; im Druck fallen
 * App-Hülle und `.bl-screen` weg (Animationen aus, siehe `global.css`).
 */
export const bakeListPrintStyles = (
  <GlobalStyles
    styles={{
      '.bl-print': { display: 'none' },
      '@media print': {
        '@page': { size: 'A4', margin: '12mm' },
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
          animation: 'none !important',
          transition: 'none !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"], main > .MuiToolbar-root':
          { display: 'none !important' },
        main: {
          padding: '0 !important',
          width: '100% !important',
          overflow: 'visible !important',
        },
        '.bl-screen': { display: 'none !important' },
        '.bl-print': {
          display: 'block !important',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 'var(--bl-font)',
          lineHeight: 1.2,
        },
        '.bl-print, .bl-print *': {
          color: '#000 !important',
          background: 'transparent !important',
          boxShadow: 'none !important',
          animation: 'none !important',
          transition: 'none !important',
          opacity: '1 !important',
        },
        '.bl-print h1': {
          fontSize: 'calc(var(--bl-font) * 1.6)',
          margin: '0 0 1mm',
        },
        '.bl-print .meta': { margin: '0 0 1mm' },
        '.bl-print .small': { fontSize: 'calc(var(--bl-font) * 0.85)' },
        '.bl-print .banner': {
          border: '2pt dashed #000',
          padding: '1mm 3mm',
          fontWeight: 700,
          margin: '1mm 0 2mm',
        },
        '.bl-print .bl-body': {
          columnCount: 'var(--bl-cols)',
          columnGap: '6mm',
        },
        '.bl-print h2': {
          fontSize: 'calc(var(--bl-font) * 1.15)',
          margin: '2mm 0 0.5mm',
          borderBottom: '1.2pt solid #000',
          breakAfter: 'avoid',
        },
        '.bl-print .bl-row': {
          display: 'flex',
          alignItems: 'center',
          gap: '2mm',
          minHeight: 'calc(var(--bl-row) * 1.15)',
          borderBottom: '0.5pt solid #777',
          breakInside: 'avoid',
        },
        '.bl-print .bl-name': { flex: '1 1 auto', minWidth: 0 },
        '.bl-print .bl-qty': {
          fontSize: 'calc(var(--bl-font) * 1.4)',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          textAlign: 'right',
        },
        '.bl-print .box': {
          display: 'inline-block',
          width: '4.5mm',
          height: '4.5mm',
          border: '1pt solid #000',
          verticalAlign: 'middle',
          textAlign: 'center',
          lineHeight: '4.5mm',
          fontWeight: 700,
        },
      },
    }}
  />
)

function lineDeltaText(
  delta: BackzettelLineDelta | null,
  unit: string
): string | null {
  if (!delta || delta.count === 0) return null
  return `${deltaBadgeText(delta, unit)} (unten, nicht in der Zahl)${
    delta.open === 0 ? ' · gesehen' : ''
  }`
}

export interface BakeListPrintProps {
  list: BakeList
  config: BackzettelConfigData | null
}

/**
 * Druckbild der Backliste eines Backtags (Z10, docs/backzettel-v2.md §7.5):
 * eine Seite für die Person, die nur backt (Sonntag). Je Posten Stück, aus
 * welchem Teig („Teig vom Samstag“) und ein Kästchen; Nachträge darunter,
 * nie in der Zahl. Keine Teigzahlen - die stehen auf dem Zettel des Teigtags.
 */
export function BakeListPrint({ list, config }: BakeListPrintProps) {
  if (list.status !== 'ok') return null
  const layout = bakeListPrintLayout(list)
  const draft = list.sources.some((s) => s.status === 'draft')
  const sections = list.sections.filter((s) => s.lines.length > 0)
  const lineDeltas = Object.fromEntries(
    list.sections.flatMap((s) =>
      s.lines.filter((l) => l.delta).map((l) => [l.key, l.delta] as const)
    )
  )
  const groups = groupDeltasForPrint(list.deltas, lineDeltas)
  const style = {
    '--bl-font': `${layout.fontPt}pt`,
    '--bl-row': `${layout.rowMm}mm`,
    '--bl-cols': String(layout.columns),
  } as React.CSSProperties
  return (
    <div
      className="bl-print"
      data-testid="bl-print"
      data-print-step={layout.step}
      aria-hidden="true"
      style={style}
    >
      <h1>Backliste {formatDateLong(list.date)}</h1>
      <p className="meta">
        {`Aus: ${list.sources
          .map((s) => bakeSourceText(s, list.date))
          .join('; ')}`}
      </p>
      {draft && (
        <p className="banner" data-testid="bl-draft">
          ENTWURF – ein Teil ist noch nicht freigegeben, Mengen können sich
          ändern
        </p>
      )}
      {sections.length === 0 && (
        <p>Für diesen Tag steht nichts auf der Backliste.</p>
      )}
      <div className="bl-body">
        {sections.map((section) => (
          <React.Fragment key={section.id}>
            <h2>{section.label}</h2>
            {section.lines.map((line) => {
              const detail = [
                line.madeOn,
                line.sheetStatus === 'draft' ? 'Entwurf' : null,
                line.baseUnset ? 'Grundmenge offen' : null,
                lineDeltaText(line.delta, line.unit),
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={`${line.doughDate ?? ''}-${line.key}`}
                  className="bl-row"
                  data-testid={`bl-line-${line.key}`}
                >
                  <span className="bl-name">
                    <strong>
                      {lineLabel({ ...line, bakeDate: undefined }, config)}
                    </strong>
                    {detail && <span className="small"> – {detail}</span>}
                  </span>
                  <span className="bl-qty">
                    {formatQty(line.total, line.unit)}
                  </span>
                  <span className="box" />
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      {groups.length > 0 && (
        <div data-testid="bl-deltas">
          <h2>Nachträge (nicht in den Zahlen oben)</h2>
          {groups.map((g) => {
            const { shown, done } = printDeltaFigure(g)
            return (
              <div key={g.key} className="bl-row">
                <span className="bl-qty" style={{ minWidth: '18mm' }}>
                  {shown === 0 ? '±0' : formatSignedQty(shown, g.first.unit)}
                </span>
                <span className="bl-name">
                  {lineLabel(
                    {
                      name: g.first.name,
                      variant: g.first.variant,
                      itemId: g.first.itemId,
                    },
                    config
                  )}
                  <span className="small">
                    {g.first.doughDate && g.first.doughDate !== list.date
                      ? ' · Zettel vom ' + formatDateLong(g.first.doughDate)
                      : ''}
                    {g.open === 0 ? ' · gesehen' : ''}
                  </span>
                </span>
                {done ? (
                  <span className="box">✓</span>
                ) : (
                  <span className="box" />
                )}
              </div>
            )
          })}
        </div>
      )}
      {list.warnings.length > 0 && (
        <p className="small">
          <strong>Hinweise:</strong>{' '}
          {list.warnings.map((w) => w.message).join(' · ')}
        </p>
      )}
    </div>
  )
}

export default BakeListPrint
