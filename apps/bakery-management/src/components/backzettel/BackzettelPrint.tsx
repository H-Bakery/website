'use client'

import React from 'react'
import { GlobalStyles } from '@mui/material'
import {
  deltaTotalsByKey,
  type BackzettelConfigData,
  type BackzettelDay,
  type BackzettelDeltaEntry,
  type BackzettelLineDelta,
} from '../../lib/backzettelApi'
import {
  DELTA_KIND_LABELS,
  deltaCodeText,
  deltaBadgeText,
  deltaExtrasLines,
  fillingGramsText,
  formatDateLong,
  formatFactor,
  formatGrams,
  formatKnown,
  formatKnownGrams,
  formatNumber,
  formatOrDash,
  formatQty,
  formatSigned,
  formatSignedQty,
  formatTimestamp,
  hasHefeteig,
  ingredientAmount,
  lineLabel,
  previouslyDoneText,
  recipeHeading,
  recipeIncompleteNote,
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
          fontSize: '10pt',
          lineHeight: 1.25,
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
        '.bz-print h1': { fontSize: '16pt', margin: '0 0 1mm' },
        // W4-Verifikation: der Samstag (7 Abschnitte, Hefeteig, Nachträge)
        // brauchte zwei Blätter für Seite 1 - deshalb knapp gesetzt, und ein
        // Abschnitt wird nicht mittendrin umbrochen (.bz-section).
        '.bz-print h2': {
          fontSize: '11.5pt',
          margin: '2.5mm 0 0.5mm',
          borderBottom: '1.5pt solid #000',
          breakAfter: 'avoid',
        },
        '.bz-print .bz-section': { breakInside: 'avoid' },
        '.bz-print th.bz-delta-head': {
          fontSize: '11.5pt',
          fontWeight: 700,
          textAlign: 'left',
          padding: '2.5mm 0 0.5mm',
          borderBottom: '1.5pt solid #000',
        },
        '.bz-print h3': { fontSize: '11pt', margin: '3mm 0 1mm' },
        '.bz-print table': {
          width: '100%',
          borderCollapse: 'collapse',
          pageBreakInside: 'auto',
        },
        '.bz-print thead': { display: 'table-header-group' },
        // W4-Verifikation Runde 2: die Spaltenköpfe stehen nur über dem
        // ersten Abschnitt (die Spalten sind überall gleich breit). Sieben
        // wiederholte Kopfzeilen kosteten auf dem Samstag gut 3 cm - genau
        // den Platz, den die Nachträge brauchen, um auf Seite 1 zu bleiben.
        '.bz-print table.lines.follow thead': { display: 'none' },
        // Alle Abschnitte gleich breit: die Zahlen stehen untereinander.
        '.bz-print table.lines': { tableLayout: 'fixed' },
        // Breiten über <colgroup>, nicht über die <th>: Folge-Abschnitte haben
        // keine sichtbare Kopfzeile, und `table-layout: fixed` nähme sonst die
        // erste Datenzeile als Maß.
        '.bz-print table.lines col.c-name': { width: '34%' },
        '.bz-print table.lines col.c-num': { width: '9%' },
        '.bz-print table.lines col.c-total': { width: '14%' },
        '.bz-print table.lines col.c-tick': { width: '7%' },
        '.bz-print tr': { pageBreakInside: 'avoid', breakInside: 'avoid' },
        '.bz-print th, .bz-print td': {
          borderBottom: '0.5pt solid #777',
          padding: '0.6mm 1.5mm',
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        '.bz-print th': { fontSize: '8.5pt' },
        '.bz-print .num': { textAlign: 'right', whiteSpace: 'nowrap' },
        '.bz-print .total': { fontSize: '13pt', fontWeight: 700 },
        '.bz-print .small': { fontSize: '8pt' },
        '.bz-print .box': {
          display: 'inline-block',
          width: '4.5mm',
          height: '4.5mm',
          border: '1pt solid #000',
          verticalAlign: 'middle',
        },
        '.bz-print .box.done': {
          textAlign: 'center',
          lineHeight: '4.5mm',
          fontSize: '11pt',
          fontWeight: 700,
        },
        '.bz-print .banner': {
          border: '2pt solid #000',
          padding: '1.5mm 3mm',
          fontWeight: 700,
          fontSize: '12pt',
          margin: '2mm 0',
        },
        '.bz-print .meta': { margin: '0 0 1mm' },
        '.bz-print .extras': {
          border: '1.5pt solid #000',
          padding: '1.5mm 3mm',
          margin: '2mm 0',
        },
        '.bz-print .figures': { display: 'flex', gap: '8mm', margin: '1mm 0' },
        '.bz-print .figures strong': { fontSize: '14pt' },
        '.bz-print ul': { margin: '1mm 0', paddingLeft: '5mm' },
        '.bz-print .avoid': { breakInside: 'avoid' },
      },
    }}
  />
)

/**
 * Kürzel für die schmale Haken-Spalte („Bernd Backstube“ → „BB“); ein
 * ausgeschriebener Name lief über den rechten Rand (W4-verify r2).
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 3)
  return words
    .slice(0, 3)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join('')
}

export interface BackzettelPrintProps {
  day: BackzettelDay
  config: BackzettelConfigData | null
}

export interface PrintDeltaGroup {
  key: string
  first: BackzettelDeltaEntry
  deltas: BackzettelDeltaEntry[]
  /** Summe der Nachträge (Viertel möglich). */
  qty: number
  /** Was zusätzlich zu backen ist (aufgerundet); fehlt bei älteren Servern. */
  bake: number | undefined
  open: number
  /** Summe der noch nicht gesehenen Nachträge (W4-verify r6). */
  openQty: number
  /** Was die noch nicht gesehenen zusätzlich zu backen heißen. */
  bakeOpen: number | undefined
}

/**
 * Nachträge im Ausdruck je Backzettel-Zeile zusammengefasst (W4-verify r5):
 * vorher eine Zeile je Vorbestellung - am vollen Samstag zwei zusätzliche
 * Blätter, Viertel wie „+0,75 Kranz“ mit eigenem Kästchen, die die Backstube
 * von Hand zusammenzählen musste. Jetzt wie am Tablet eine Zeile je Posten
 * mit der Menge, die zu backen ist; die Codes stehen klein daneben.
 */
export function groupDeltasForPrint(
  deltas: BackzettelDeltaEntry[],
  lineDeltas: Record<string, BackzettelLineDelta | null | undefined>
): PrintDeltaGroup[] {
  const groups = new Map<string, PrintDeltaGroup>()
  for (const d of deltas) {
    const g = groups.get(d.key) ?? {
      key: d.key,
      first: d,
      deltas: [],
      qty: 0,
      bake: undefined,
      open: 0,
      openQty: 0,
      bakeOpen: undefined,
    }
    g.deltas.push(d)
    g.qty = Math.round((g.qty + (Number(d.qty) || 0)) * 100) / 100
    if (!d.acknowledgedAt) {
      g.open += 1
      g.openQty = Math.round((g.openQty + (Number(d.qty) || 0)) * 100) / 100
    }
    groups.set(d.key, g)
  }
  for (const g of Array.from(groups.values())) {
    const line = lineDeltas[g.key]
    // Nur wenn die Zeile dieselben Nachträge meint, ihr `bake` übernehmen.
    if (line && line.qty === g.qty && typeof line.bake === 'number') {
      g.bake = line.bake
      if (
        typeof line.bakeOpen === 'number' &&
        (line.openQty === undefined || line.openQty === g.openQty)
      ) {
        g.bakeOpen = line.bakeOpen
      }
    }
  }
  return Array.from(groups.values())
}

/**
 * Was im Ausdruck groß neben dem Kästchen steht (W4-verify r6): bei schon
 * gesehenen Nachträgen nicht mehr die ganze Summe mit leerem Kästchen - die
 * Backstube buk sie sonst ein zweites Mal. Ganz gesehen: die Summe mit
 * Haken; teils gesehen: nur, was noch offen ist.
 */
export function printDeltaFigure(group: PrintDeltaGroup): {
  shown: number
  done: boolean
  seen: number | null
} {
  const total = group.bake ?? group.qty
  if (group.open === 0) return { shown: total, done: true, seen: null }
  if (group.open === group.deltas.length) {
    return { shown: total, done: false, seen: null }
  }
  const open = group.bakeOpen ?? group.openQty
  return {
    shown: open,
    done: false,
    seen: Math.round((total - open) * 100) / 100,
  }
}

/**
 * Hinweis an der Zeile auf Seite 1: wie im Ausdruck unten - gesehen, teils
 * gesehen (nur der offene Teil zählt) oder offen.
 */
export function printLineDeltaNote(
  delta: BackzettelLineDelta,
  unit: BackzettelDeltaEntry['unit']
): string {
  if (delta.open === 0) {
    return `${deltaBadgeText(delta, unit)} · schon gesehen (Liste unten)`
  }
  if (delta.open < delta.count && typeof delta.openQty === 'number') {
    const open = delta.bakeOpen ?? delta.openQty
    return `Nachtrag offen ${formatSignedQty(
      open,
      unit
    )} (von ${formatSignedQty(
      delta.bake ?? delta.qty,
      unit
    )}, Rest schon gesehen; Liste unten)`
  }
  return `${deltaBadgeText(delta, unit)} (Liste unten)`
}

function printDeltaDetail(
  group: PrintDeltaGroup,
  unit: BackzettelDeltaEntry['unit']
): string {
  const parts: string[] = []
  if (group.bake !== undefined && group.bake !== group.qty) {
    parts.push(
      deltaBadgeText(
        { qty: group.qty, bake: group.bake, open: 0, count: 0 },
        unit
      )
    )
  }
  if (group.deltas.length === 1) {
    parts.push(DELTA_KIND_LABELS[group.first.kind] ?? group.first.kind)
  } else {
    parts.push(`${group.deltas.length} Nachträge`)
  }
  const codes = Array.from(
    new Set(group.deltas.map((d) => deltaCodeText(d)).filter(Boolean))
  )
  if (codes.length) parts.push(codes.join(', '))
  parts.push(
    group.open === 0
      ? 'quittiert'
      : group.open === group.deltas.length
      ? 'offen'
      : `${group.open} offen`
  )
  return parts.join(' · ')
}

export function BackzettelPrint({ day, config }: BackzettelPrintProps) {
  const confirmed = day.status === 'confirmed'
  const doughs = day.hefeteig?.doughs ?? []
  const fillings = day.fillings ?? []
  const prep = day.prep ?? []
  const withPage2 = hasHefeteig(day)
  const withPage3 = prep.length > 0
  const deltas = day.deltas ?? []
  const deltaGroups = groupDeltasForPrint(deltas, deltaTotalsByKey(day))

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
        {day.sections.map((section, sectionIndex) => (
          <div key={section.id} className="bz-section">
            <h2>{section.label}</h2>
            <table className={sectionIndex === 0 ? 'lines' : 'lines follow'}>
              <colgroup>
                <col className="c-name" />
                <col className="c-num" />
                <col className="c-num" />
                <col className="c-num" />
                <col className="c-num" />
                <col className="c-num" />
                <col className="c-total" />
                <col className="c-tick" />
              </colgroup>
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
                        previouslyDoneText(line) ||
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
                            previouslyDoneText(line),
                            line.delta && line.delta.count > 0
                              ? printLineDeltaNote(line.delta, line.unit)
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
                      {line.doneAt ? (
                        <>
                          <span
                            className="box done"
                            data-testid={`print-done-${line.key}`}
                          >
                            ✓
                          </span>
                          {line.doneBy && (
                            <div
                              className="small"
                              title={line.doneBy.displayName}
                            >
                              {initials(line.doneBy.displayName)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="box" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {deltas.length > 0 && (
          <div className="avoid" data-testid="print-deltas">
            {/* Überschrift als Tabellenkopf: läuft die Liste auf die nächste
                Seite, steht sie dort noch einmal (W4-verify r4). */}
            <table>
              <thead>
                <tr>
                  <th colSpan={3} className="bz-delta-head">
                    Nachträge seit der Freigabe (nicht in den Mengen oben)
                  </th>
                </tr>
              </thead>
              <tbody>
                {deltaGroups.map((g) => {
                  const { shown, done, seen } = printDeltaFigure(g)
                  return (
                    <tr key={g.key} data-testid={`print-delta-${g.key}`}>
                      <td className="num total">
                        {shown === 0
                          ? '±0'
                          : formatSignedQty(shown, g.first.unit)}
                      </td>
                      <td>
                        <strong>
                          {lineLabel(
                            {
                              name: g.first.name,
                              variant: g.first.variant,
                              itemId: g.first.itemId,
                            },
                            config
                          )}
                        </strong>{' '}
                        <span className="small">
                          {[
                            seen !== null
                              ? `noch offen - von ${formatSignedQty(
                                  g.bake ?? g.qty,
                                  g.first.unit
                                )}, ${formatQty(
                                  Math.abs(seen),
                                  g.first.unit
                                )} schon gesehen`
                              : null,
                            printDeltaDetail(g, g.first.unit),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="num">
                        {done ? (
                          <span
                            className="box done"
                            data-testid={`print-delta-done-${g.key}`}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="box" />
                        )}
                      </td>
                    </tr>
                  )
                })}
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
          {deltaExtrasLines(day.deltaExtras).length > 0 && (
            <div className="extras avoid" data-testid="print-delta-extras">
              <strong>
                Nachträge seit der Freigabe – zusätzlich zu den Mengen unten:
              </strong>
              <ul>
                {deltaExtrasLines(day.deltaExtras).map((text) => (
                  <li key={text}>
                    <span className="box" /> {text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {doughs.map((dough) => (
            <div key={dough.id} className="avoid">
              <h2>{dough.name}</h2>
              <div className="figures">
                <span>
                  Teigstücke <strong>{formatKnown(dough.pieces)}</strong>
                </span>
                <span>
                  Teig <strong>{formatKnownGrams(dough.dough_g)}</strong>
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
                    <tr key={w.piece_g ?? 'offen'}>
                      <td className="total">{formatKnown(w.piece_g, 'g')}</td>
                      <td className="num total">{formatKnown(w.pieces)}</td>
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
                {f.name}: {fillingGramsText(f)}
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
                      <th>{recipeHeading(f.recipe)}</th>
                      <th className="num">Menge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.recipe.ingredients.map((ing, idx) => (
                      <tr key={`${ing.name}-${idx}`}>
                        <td>{ing.name}</td>
                        <td className="num">
                          {ing.scaled_g === null ? (
                            ingredientAmount(ing, f.recipe).text
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
              {f.recipe && recipeIncompleteNote(f.recipe) && (
                <p className="small">
                  <strong>{recipeIncompleteNote(f.recipe)}</strong>
                </p>
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
          {/* Wird abgerissen und am Vortag abgearbeitet - auch hier muss
              ein Entwurf als Entwurf erkennbar sein (W4-verify r5). */}
          {!confirmed && (
            <p className="banner">ENTWURF – noch nicht freigegeben</p>
          )}
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
