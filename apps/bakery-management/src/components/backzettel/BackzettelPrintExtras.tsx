'use client'

import React from 'react'
import type { BackzettelDay } from '../../lib/backzettelApi'
import {
  deltaExtrasLines,
  fillingGramsText,
  fillingOpenNote,
  formatDateLong,
  formatGrams,
  formatKnown,
  weighingItemsText,
  weighingPiecesText,
  formatNumber,
  hasHefeteig,
  hefeteigDoughText,
  hefeteigPiecesText,
  ingredientAmount,
  recipeHeading,
  recipeIncompleteNote,
} from '../../lib/backzettelFormat'
import { batchText } from './HefeteigCard'
import { prepTaskLabel } from './PrepCard'

export interface BackzettelPrintExtrasProps {
  day: BackzettelDay
}

/** Ob es für den Tag ein zweites Blatt (Abwiegeliste, Rezepte, Vorbereitung) gibt. */
export function hasPrintExtras(
  day: Pick<BackzettelDay, 'hefeteig' | 'fillings' | 'prep'>
): boolean {
  return hasHefeteig(day) || (day.prep?.length ?? 0) > 0
}

/**
 * Zweites Blatt des Backzettel-Drucks (Z7 S. 2-3, seit Z10 eigene Datei):
 * Hefeteig & Füllungen (Abwiegeliste, skalierte Rezepte, Nachträge über dem
 * freigegebenen Stand) und die Vorbereitung am Vortag. Jede Seite beginnt
 * auf einem neuen Blatt (`.bz-break`). Steht innerhalb eines `.bz-print`
 * (Stile: `backzettelPrintStyles`). Der alte Tagesdruck druckt sie immer, der
 * Teigtag-Zettel nur auf Wunsch („Abwiegeliste & Rezepte mitdrucken“, O8).
 */
export function BackzettelPrintExtras({ day }: BackzettelPrintExtrasProps) {
  const confirmed = day.status === 'confirmed'
  const doughs = day.hefeteig?.doughs ?? []
  const fillings = day.fillings ?? []
  const prep = day.prep ?? []
  const withPage2 = hasHefeteig(day)
  const withPage3 = prep.length > 0
  return (
    <>
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
                  Teigstücke <strong>{hefeteigPiecesText(dough)}</strong>
                </span>
                <span>
                  Teig <strong>{hefeteigDoughText(dough)}</strong>
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
                      <td className="num total">{weighingPiecesText(w)}</td>
                      <td>{weighingItemsText(w.items)}</td>
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
                {fillingOpenNote(f) ? ` · ${fillingOpenNote(f)}` : ''}
              </p>
              {/* Vor der Tabelle: der Hinweis sagt „Unten das Grundrezept“
                  (UI-Runde 1 - vorher stand er darunter). */}
              {f.recipe && recipeIncompleteNote(f.recipe) && (
                <p className="small">
                  <strong>{recipeIncompleteNote(f.recipe)}</strong>
                </p>
              )}
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
    </>
  )
}

export default BackzettelPrintExtras
