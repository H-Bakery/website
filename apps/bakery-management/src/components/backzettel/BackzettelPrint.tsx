'use client'

import React from 'react'
import { GlobalStyles } from '@mui/material'
import type {
  BackzettelConfigData,
  BackzettelDay,
} from '../../lib/backzettelApi'
import {
  DELTA_KIND_LABELS,
  formatDateLong,
  formatFactor,
  formatGrams,
  formatNumber,
  formatOrDash,
  formatQty,
  formatSigned,
  formatTimestamp,
  hasHefeteig,
  lineLabel,
} from '../../lib/backzettelFormat'
import { batchText } from './HefeteigCard'
import { prepTaskLabel } from './PrepCard'

/**
 * Druckbild des Backzettels (Z7, roadmap §5.5 Nr. 4) - A4, schwarz auf weiß.
 *
 * Auf dem Bildschirm unsichtbar; im Druck verschwindet stattdessen alles mit
 * `.bz-screen` und die App-Hülle aus `admin/layout.tsx` (AppBar, Navigation,
 * Breadcrumb). Eigene, schlichte Tabellen statt der MUI-Ansicht: MUI setzt
 * Textfarben je Zelle (im dunklen Modus weiß), und die Bildschirmansicht
 * schaltet unter `md` auf Karten um - A4 (≈ 794 px) liegt darunter.
 *
 *   S. 1  Backzettel: alle Abschnitte, Gesamt groß, Kästchen zum Abhaken
 *   S. 2  (wenn Hefeteig/Füllungen) Abwiegeliste + skalierte Füllungsrezepte
 *   S. 3  (wenn Vorbereitungen) Vorbereitung am Vortag
 */
export const backzettelPrintStyles = (
  <GlobalStyles
    styles={{
      '.bz-print': { display: 'none' },
      '@media print': {
        '@page': { size: 'A4', margin: '12mm' },
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
          // global.css blendet body und jedes <section> beim Erscheinen ein
          // (opacity 0 → 1). Im Druck springt .bz-print von display:none
          // auf block und die Animation startete neu - das Blatt kam blass
          // bis leer aus dem Drucker.
          animation: 'none !important',
          transition: 'none !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: {
          padding: '0 !important',
          width: '100% !important',
          overflow: 'visible !important',
        },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.bz-screen': { display: 'none !important' },
        '.bz-print': {
          display: 'block !important',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '10.5pt',
          lineHeight: 1.3,
        },
        '.bz-print, .bz-print *': {
          color: '#000 !important',
          background: 'transparent !important',
          boxShadow: 'none !important',
          animation: 'none !important',
          transition: 'none !important',
          opacity: '1 !important',
        },
        '.bz-print .bz-break': {
          breakBefore: 'page',
          pageBreakBefore: 'always',
        },
        '.bz-print h1': { fontSize: '18pt', margin: '0 0 2mm' },
        '.bz-print h2': {
          fontSize: '12.5pt',
          margin: '4mm 0 1mm',
          borderBottom: '1.5pt solid #000',
          breakAfter: 'avoid',
        },
        '.bz-print h3': { fontSize: '11pt', margin: '3mm 0 1mm' },
        '.bz-print table': {
          width: '100%',
          borderCollapse: 'collapse',
          pageBreakInside: 'auto',
        },
        '.bz-print thead': { display: 'table-header-group' },
        // Alle Abschnitte gleich breit: die Zahlen stehen untereinander.
        '.bz-print table.lines': { tableLayout: 'fixed' },
        '.bz-print table.lines th:first-child': { width: '34%' },
        '.bz-print table.lines th:nth-last-child(2)': { width: '14%' },
        '.bz-print table.lines th:last-child': { width: '7%' },
        '.bz-print tr': { pageBreakInside: 'avoid', breakInside: 'avoid' },
        '.bz-print th, .bz-print td': {
          borderBottom: '0.5pt solid #777',
          padding: '1.2mm 1.5mm',
          textAlign: 'left',
          verticalAlign: 'top',
        },
        '.bz-print th': { fontSize: '9pt' },
        '.bz-print .num': { textAlign: 'right', whiteSpace: 'nowrap' },
        '.bz-print .total': { fontSize: '15pt', fontWeight: 700 },
        '.bz-print .small': { fontSize: '8.5pt' },
        '.bz-print .box': {
          display: 'inline-block',
          width: '5mm',
          height: '5mm',
          border: '1pt solid #000',
        },
        '.bz-print .banner': {
          border: '2pt solid #000',
          padding: '1.5mm 3mm',
          fontWeight: 700,
          fontSize: '12pt',
          margin: '2mm 0',
        },
        '.bz-print .meta': { margin: '0 0 2mm' },
        '.bz-print .figures': { display: 'flex', gap: '8mm', margin: '1mm 0' },
        '.bz-print .figures strong': { fontSize: '14pt' },
        '.bz-print ul': { margin: '1mm 0', paddingLeft: '5mm' },
        '.bz-print .avoid': { breakInside: 'avoid' },
      },
    }}
  />
)

export interface BackzettelPrintProps {
  day: BackzettelDay
  config: BackzettelConfigData | null
}

export function BackzettelPrint({ day, config }: BackzettelPrintProps) {
  const confirmed = day.status === 'confirmed'
  const doughs = day.hefeteig?.doughs ?? []
  const fillings = day.fillings ?? []
  const prep = day.prep ?? []
  const withPage2 = hasHefeteig(day)
  const withPage3 = prep.length > 0
  const deltas = day.deltas ?? []

  return (
    <div className="bz-print" data-testid="bz-print" aria-hidden="true">
      {/* Seite 1 */}
      <section className="bz-page" data-testid="print-page-1">
        <h1>Backzettel {formatDateLong(day.date)}</h1>
        {confirmed ? (
          <p className="meta">
            Freigegeben
            {day.confirmedBy ? ` von ${day.confirmedBy.displayName}` : ''}
            {day.confirmedAt ? ` am ${formatTimestamp(day.confirmedAt)}` : ''}
            {' · '}Saisonfaktor {formatFactor(day.seasonFactor)}
          </p>
        ) : (
          <>
            <p className="banner">ENTWURF – noch nicht freigegeben</p>
            <p className="meta">
              Saisonfaktor {formatFactor(day.seasonFactor)}
            </p>
          </>
        )}
        {day.sections.map((section) => (
          <div key={section.id}>
            <h2>{section.label}</h2>
            <table className="lines">
              <thead>
                <tr>
                  <th>Posten</th>
                  <th className="num">Basis</th>
                  <th className="num">Saison</th>
                  <th className="num">Vorb.</th>
                  <th className="num">CAP</th>
                  <th className="num">Korr.</th>
                  <th className="num">Gesamt</th>
                  <th className="num">✓</th>
                </tr>
              </thead>
              <tbody>
                {section.lines.map((line) => (
                  <tr key={line.key}>
                    <td>
                      <strong>{lineLabel(line, config)}</strong>
                      {(line.tray ||
                        line.correctionReason ||
                        line.loavesEstimate ||
                        (line.delta && line.delta.count > 0)) && (
                        <div className="small">
                          {[
                            line.tray,
                            line.loavesEstimate
                              ? `≈ ${line.loavesEstimate} Laibe`
                              : null,
                            line.correctionReason
                              ? `Korrektur: ${line.correctionReason}`
                              : null,
                            line.delta && line.delta.count > 0
                              ? `Nachtrag ${formatSigned(
                                  line.delta.qty
                                )} (siehe unten)`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {line.baseUnset ? 'offen' : formatNumber(line.base)}
                    </td>
                    <td className="num">{formatSigned(line.seasonal)}</td>
                    <td className="num">{formatOrDash(line.preorders)}</td>
                    <td className="num">{formatOrDash(line.cap)}</td>
                    <td className="num">{formatSigned(line.correction)}</td>
                    <td className="num total">
                      {formatQty(line.total, line.unit)}
                    </td>
                    <td className="num">
                      <span className="box" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {deltas.length > 0 && (
          <div className="avoid">
            <h2>Nachträge seit der Freigabe (nicht in den Mengen oben)</h2>
            <table>
              <tbody>
                {deltas.map((d) => (
                  <tr key={d.id}>
                    <td className="num total">{formatSigned(d.qty)}</td>
                    <td>
                      <strong>
                        {lineLabel(
                          {
                            name: d.name,
                            variant: d.variant,
                            itemId: d.itemId,
                          },
                          config
                        )}
                      </strong>
                      <div className="small">
                        {[
                          DELTA_KIND_LABELS[d.kind] ?? d.kind,
                          d.preorderCode,
                          d.acknowledgedAt ? 'quittiert' : 'offen',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td className="num">
                      <span className="box" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {day.warnings.length > 0 && (
          <div className="small avoid">
            <h3>Hinweise</h3>
            <ul>
              {day.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}
        {!withPage3 && (
          <p className="small">Vorbereitung: keine eingetragen.</p>
        )}
      </section>

      {/* Seite 2: Hefeteig & Füllungen */}
      {withPage2 && (
        <section className="bz-page bz-break" data-testid="print-page-2">
          <h1>Hefeteig &amp; Füllungen – {formatDateLong(day.date)}</h1>
          {!confirmed && (
            <p className="banner">ENTWURF – noch nicht freigegeben</p>
          )}
          {doughs.map((dough) => (
            <div key={dough.id} className="avoid">
              <h2>{dough.name}</h2>
              <div className="figures">
                <span>
                  Teigstücke <strong>{formatNumber(dough.pieces)}</strong>
                </span>
                <span>
                  Teig <strong>{formatGrams(dough.dough_g)}</strong>
                </span>
                <span>{batchText(dough)}</span>
              </div>
              <h3>Abwiegeliste</h3>
              <table>
                <thead>
                  <tr>
                    <th>Stückgewicht</th>
                    <th className="num">Stück</th>
                    <th>für</th>
                    <th className="num">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {dough.weighing.map((w) => (
                    <tr key={w.piece_g}>
                      <td className="total">{formatNumber(w.piece_g)} g</td>
                      <td className="num total">{formatNumber(w.pieces)}</td>
                      <td>
                        {w.items
                          .map((i) =>
                            i.piecesPerProduct === 1
                              ? `${i.name} ${formatNumber(i.products)}`
                              : `${i.name} ${formatNumber(i.products)} × ${
                                  i.piecesPerProduct
                                }`
                          )
                          .join(', ')}
                      </td>
                      <td className="num">
                        <span className="box" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {fillings.length > 0 && <h2>Füllungen</h2>}
          {fillings.map((f) => (
            <div key={f.id} className="avoid">
              <h3>
                {f.name}: {formatGrams(f.grams)}
              </h3>
              <p className="small">
                {f.items
                  .map(
                    (i) =>
                      `${i.name} ${formatNumber(i.pieces)} × ${
                        i.filling_g === null
                          ? '? g'
                          : `${formatNumber(i.filling_g)} g`
                      }`
                  )
                  .join(', ')}
                {f.missingFillingG
                  ? ' · Füllungsgewicht fehlt bei mindestens einem Posten – Menge zu klein!'
                  : ''}
              </p>
              {f.recipe ? (
                <table>
                  <thead>
                    <tr>
                      <th>
                        Rezept „{f.recipe.title}“ ×{' '}
                        {formatNumber(f.recipe.factor)}
                      </th>
                      <th className="num">Menge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.recipe.ingredients.map((ing, idx) => (
                      <tr key={`${ing.name}-${idx}`}>
                        <td>{ing.name}</td>
                        <td className="num">
                          {ing.scaled_g === null ? (
                            `${ing.raw} (nicht skaliert)`
                          ) : (
                            <strong>{formatGrams(ing.scaled_g)}</strong>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="small">Kein Rezept hinterlegt.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Seite 3: Vorbereitung */}
      {withPage3 && (
        <section className="bz-page bz-break" data-testid="print-page-3">
          <h1>Vorbereitung für {formatDateLong(day.date)}</h1>
          <p className="meta">
            am Vortag, {formatDateLong(day.prepDate)}, ab 14 Uhr
            {day.prepDateProvisional
              ? ' – der Vortag ist Ruhetag, wer vorbereitet ist noch offen'
              : ''}
          </p>
          <table>
            <tbody>
              {prep.map((t) => (
                <tr key={t.id}>
                  <td className="num" style={{ width: '8mm' }}>
                    <span className="box" />
                  </td>
                  <td className="total">{prepTaskLabel(t)}</td>
                  <td>{t.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default BackzettelPrint
