import React from 'react'
import { Box, GlobalStyles } from '@mui/material'
import type { BackzettelConfigData } from '../../lib/backzettelApi'
import { variantLabel } from '../../lib/backzettelFormat'
import { SECTION_LABELS } from '../../lib/grundmengenApi'

/**
 * Backzettel-Notfallblatt (P6): ein leerer Backzettel zum Ausfüllen von Hand,
 * wenn die App ausfällt UND kein freigegebener Ausdruck da ist. Spalten wie
 * auf dem echten Zettel, nur Basis | Vorbestellt | Gesamt (+ Haken), alles
 * leer. Mit Stammdaten (`GET /api/backzettel/config`) stehen die Posten schon
 * da (je Sorte eine Zeile), sonst leere Zeilen je Abschnitt.
 *
 * Nur gedruckt, immer genau eine A4-Seite: zwei Spalten, die Zeilenhöhe
 * richtet sich nach der Zahl der Zeilen (`notfallLayout`).
 */

/** Abschnitte ohne Stammdaten (Reihenfolge wie `backzettel.yaml`). */
export const FALLBACK_SECTIONS = [
  'brot',
  'broetchen',
  'laugen',
  'kaffeestueckchen',
  'kuchen',
  'hefeteig',
] as const

const BLANK_ROWS_WITHOUT_CONFIG = 7
/** Platz für Posten, die nicht auf dem Blatt stehen. */
const BLANK_ROWS_WITH_CONFIG = 1

export interface NotfallSection {
  id: string
  label: string
  /** Zeilennamen; `''` = leere Zeile zum Eintragen. */
  rows: string[]
}

/** Abschnitte und Zeilen des Blatts aus den Stammdaten (oder leer). */
export function notfallSections(
  config: Pick<BackzettelConfigData, 'sections' | 'items' | 'fillings'> | null
): NotfallSection[] {
  if (!config) {
    return FALLBACK_SECTIONS.map((id) => ({
      id,
      label: SECTION_LABELS[id] ?? id,
      rows: Array.from({ length: BLANK_ROWS_WITHOUT_CONFIG }, () => ''),
    }))
  }
  // Auch „Vorbereitung“ (Sauerteig-Ansatz): das sind Zeilen des Backzettels
  // mit Gesamt und Haken, keine Aufgaben für morgen (Review r2) - die stehen
  // unten im Kasten „Vorbereitung für morgen“.
  return config.sections
    .map((id) => {
      const rows = config.items
        .filter((item) => item.section === id)
        .flatMap((item) =>
          item.variants && item.variants.length > 0
            ? item.variants.map(
                (v) => `${item.name} – ${variantLabel(v, config, item.id) ?? v}`
              )
            : [item.name]
        )
      return {
        id,
        label: SECTION_LABELS[id] ?? id,
        rows: [
          ...rows,
          ...Array.from({ length: BLANK_ROWS_WITH_CONFIG }, () => ''),
        ],
      }
    })
    .filter((section) => section.rows.some((row) => row !== ''))
}

/** Nutzbare Höhe einer Spalte in mm (mit Reserve für Spaltenumbrüche). */
const COLUMN_HEIGHT_MM = 190
/** Breite des Blatts (A4 hoch, 10 mm Rand) und Abstand der Spalten in mm. */
const PAGE_WIDTH_MM = 190
const COLUMN_GAP_MM = 5
/**
 * Breiten der Zahlenspalten in mm, als `<colgroup>` gesetzt: bei
 * `table-layout: fixed` bestimmt sonst die erste Zeile die Breiten - und
 * das ist seit Runde 4 die Abschnitts-Überschrift über alle fünf Spalten,
 * also fünf gleich breite Spalten und „Kranz gef…“ (W4-Verifikation r5).
 */
export const NOTFALL_COLS_MM = { basis: 12, vorb: 12, gesamt: 14, tick: 5 }
/** Ungefähre Breite eines Zeichens der Postenspalte (9 pt Arial) in mm. */
const CHAR_MM = 1.75

/** Breite der Postenspalte in mm bei `columns` Spalten. */
export function notfallPostenWidthMm(columns: number): number {
  const column = (PAGE_WIDTH_MM - COLUMN_GAP_MM * (columns - 1)) / columns
  const numbers = Object.values(NOTFALL_COLS_MM).reduce((a, b) => a + b, 0)
  return Math.round((column - numbers) * 10) / 10
}

/** Zeilen, die ein Posten braucht (lange Namen brechen um statt „…“). */
function rowLines(row: string, columns: number): number {
  if (!row) return 1
  const perLine = Math.max(
    1,
    Math.floor(notfallPostenWidthMm(columns) / CHAR_MM)
  )
  return Math.max(1, Math.ceil(row.length / perLine))
}
/** Überschrift + Kopfzeile eines Abschnitts in mm. */
const SECTION_OVERHEAD_MM = 10
const MIN_ROW_MM = 4
const MAX_ROW_MM = 7
/**
 * Kurze Abschnitte (Hefeteig: Kranz, Zopf) brechen nicht über zwei Spalten
 * um (Review r2: „HEFETEIG“ stand zweimal da und las sich wie zwei
 * Abschnitte). Lange dürfen weiter umbrechen, sonst bliebe unten in einer
 * Spalte viel Platz frei.
 */
export const KEEP_TOGETHER_MAX_LINES = 8

function sectionLines(section: NotfallSection, columns: number): number {
  return section.rows.reduce((n, row) => n + rowLines(row, columns), 0)
}

/** Steht der Abschnitt am Stück in einer Spalte? */
export function keepSectionTogether(
  section: NotfallSection,
  columns: number
): boolean {
  return sectionLines(section, columns) <= KEEP_TOGETHER_MAX_LINES
}

/**
 * Spalten und Zeilenhöhe, damit alles auf EINE Seite passt: zwei Spalten,
 * Zeilen zwischen 4 und 7 mm hoch. Reicht das nicht (mehr als ~80 Zeilen),
 * drei schmalere Spalten - lieber gekürzte Namen als eine zweite Seite.
 */
export function notfallLayout(sections: NotfallSection[]): {
  columns: 2 | 3
  rowHeightMm: number
} {
  const height = (columns: number) => {
    const rows = sections.reduce((sum, s) => sum + sectionLines(s, columns), 0)
    // Ein Abschnitt am Stück kann am Spaltenende höchstens seine eigene
    // Höhe frei lassen - je Spaltenwechsel einmal den größten einplanen.
    const keepLines = Math.max(
      0,
      ...sections
        .filter((s) => keepSectionTogether(s, columns))
        .map((s) => sectionLines(s, columns))
    )
    const breaks = columns - 1
    const available =
      columns * COLUMN_HEIGHT_MM -
      sections.length * SECTION_OVERHEAD_MM -
      (keepLines > 0 ? breaks * SECTION_OVERHEAD_MM : 0)
    const lines = rows + breaks * keepLines
    return lines > 0 ? available / lines : MAX_ROW_MM
  }
  const columns = height(2) >= MIN_ROW_MM ? 2 : 3
  const raw = Math.floor(height(columns) * 10) / 10
  return {
    columns,
    rowHeightMm: Math.max(MIN_ROW_MM, Math.min(MAX_ROW_MM, raw)),
  }
}

const styles = (
  <GlobalStyles
    styles={{
      // 1pt Luft rechts: der rechte Rand der Kästen und die äußere Hälfte
      // der zusammengefallenen Tabellenrahmen lagen genau auf der Seitenkante
      // bzw. hinter `overflow: hidden` und kamen nur halb aufs Papier
      // (W4-verify r6, wie die Abholliste in r4).
      '.nfb': {
        boxSizing: 'border-box',
        height: '270mm',
        paddingRight: '1pt',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        color: '#000',
      },
      '.nfb h2': { fontSize: '15pt', margin: 0 },
      '.nfb-head': {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '4mm',
        whiteSpace: 'nowrap',
      },
      '.nfb-field': {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1.5mm',
        flexGrow: 1,
      },
      '.nfb-field b': { fontSize: '9pt' },
      '.nfb-field span': {
        flexGrow: 1,
        borderBottom: '0.6pt solid #000',
        height: '5mm',
        minWidth: '15mm',
      },
      '.nfb-hint': {
        border: '1.2pt solid #000',
        padding: '1.5mm 2.5mm',
        fontSize: '8.5pt',
      },
      '.nfb-hint p': { margin: '0 0 0.6mm' },
      '.nfb-cols': {
        columnCount: 2,
        columnGap: '5mm',
        columnFill: 'auto',
        flexGrow: 1,
        minHeight: 0,
      },
      // Ein langer Abschnitt darf in die zweite Spalte umbrechen (die Kopfzeile
      // wiederholt sich), sonst bliebe unten in Spalte 1 Platz frei und der
      // letzte Abschnitt fiele in eine dritte, abgeschnittene Spalte.
      '.nfb-section': { marginBottom: '2mm' },
      '.nfb-section.nfb-keep': { breakInside: 'avoid' },
      '.nfb tr': { breakInside: 'avoid' },
      // Die leere Zeile am Ende bleibt bei ihrem Abschnitt - sonst stand oben
      // in der nächsten Spalte eine zweite Überschrift mit nur dieser Zeile
      // (Review Z10 Runde 1).
      '.nfb tr.nfb-blank': { breakBefore: 'avoid' },
      '.nfb thead': { display: 'table-header-group' },
      // Die Überschrift steht als erste Kopfzeile in der Tabelle: bricht ein
      // Abschnitt in die nächste Spalte um, steht sie dort noch einmal
      // (W4-verify r4 - vorher hing die Fortsetzung ohne Namen oben rechts).
      '.nfb th.nfb-title': {
        fontSize: '9.5pt',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        border: 'none',
        padding: '0 0 0.8mm',
      },
      '.nfb table': {
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
      },
      '.nfb th, .nfb td': {
        border: '0.5pt solid #000',
        padding: '0 1.2mm',
        fontSize: '8pt',
        textAlign: 'left',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      },
      // Der Posten ganz, notfalls auf zwei Zeilen - die Sorte steht hinten
      // und ist genau das, was „…“ abschnitt (W4-Verifikation Runde 5).
      '.nfb td.posten': {
        fontSize: '9pt',
        lineHeight: 1.1,
        whiteSpace: 'normal',
        textOverflow: 'clip',
        overflowWrap: 'break-word',
      },
      '.nfb th': { height: '4.2mm', fontWeight: 700 },
      '.nfb .gesamt': { borderLeft: '1.2pt solid #000' },
      '.nfb .tick': { textAlign: 'center' },
      '.nfb-foot': { display: 'flex', gap: '4mm' },
      '.nfb-box': {
        flex: 1,
        border: '0.6pt solid #000',
        padding: '1mm 2mm',
        height: '24mm',
        boxSizing: 'border-box',
      },
      '.nfb-box b': { fontSize: '8.5pt' },
      '.nfb-small': { fontSize: '7.5pt', margin: 0 },
    }}
  />
)

export default function BackzettelNotfallblatt({
  config,
}: {
  config: Pick<BackzettelConfigData, 'sections' | 'items' | 'fillings'> | null
}) {
  const sections = notfallSections(config)
  const { columns, rowHeightMm: rowHeight } = notfallLayout(sections)
  return (
    <>
      {styles}
      <Box
        className="hilfe-sheet hilfe-print-only"
        data-sheet="notfallblatt"
        data-testid="sheet-notfallblatt"
        aria-hidden="true"
      >
        <div className="nfb">
          <div className="nfb-head">
            <h2>Backzettel – Notfallblatt</h2>
            <span className="nfb-field">
              <b>Tag</b>
              <span />
            </span>
            <span className="nfb-field">
              <b>Datum</b>
              <span />
            </span>
            <span className="nfb-field">
              <b>ausgefüllt von</b>
              <span />
            </span>
          </div>
          <div className="nfb-hint">
            <p>
              <b>Zuerst den letzten freigegebenen Ausdruck verwenden</b> (App:
              Backzettel › Drucken). Dieses Blatt nur, wenn keiner da ist.
            </p>
            <p>
              <b>Basis</b> = Grundmenge des Wochentags (letzter Ausdruck vom
              gleichen Wochentag) plus CAP-Lieferung. <b>Vorbestellt</b> =
              Vorbestellscheine und Abholliste für den Tag. <b>Gesamt</b> =
              Basis + Vorbestellt.
            </p>
          </div>
          <div className="nfb-cols" style={{ columnCount: columns }}>
            {sections.map((section) => (
              <div
                className={
                  keepSectionTogether(section, columns)
                    ? 'nfb-section nfb-keep'
                    : 'nfb-section'
                }
                data-section={section.id}
                key={section.id}
              >
                <table>
                  <colgroup>
                    <col />
                    <col style={{ width: `${NOTFALL_COLS_MM.basis}mm` }} />
                    <col style={{ width: `${NOTFALL_COLS_MM.vorb}mm` }} />
                    <col style={{ width: `${NOTFALL_COLS_MM.gesamt}mm` }} />
                    <col style={{ width: `${NOTFALL_COLS_MM.tick}mm` }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="nfb-title" colSpan={5} scope="colgroup">
                        {section.label}
                      </th>
                    </tr>
                    <tr>
                      <th className="hilfe-shade">Posten</th>
                      <th className="hilfe-shade num">Basis</th>
                      <th className="hilfe-shade num">Vorb.</th>
                      <th className="hilfe-shade gesamt">Gesamt</th>
                      <th className="hilfe-shade tick">✓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr
                        key={`${row}-${index}`}
                        className={
                          row === '' &&
                          section.rows.slice(0, index).some((r) => r !== '')
                            ? 'nfb-blank'
                            : undefined
                        }
                        style={{ height: `${rowHeight}mm` }}
                      >
                        <td className="posten">{row}</td>
                        <td />
                        <td />
                        <td className="gesamt" />
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="nfb-foot">
            <div className="nfb-box">
              <b>Vorbereitung für morgen</b>
            </div>
            <div className="nfb-box">
              <b>Notizen / Nachträge</b>
            </div>
          </div>
          <p className="nfb-small">
            {config
              ? 'Posten aus den Backzettel-Stammdaten. Fehlt ein Posten: in die leere Zeile seines Abschnitts schreiben.'
              : 'Ohne Stammdaten gedruckt: Posten von Hand eintragen.'}{' '}
            Wenn die App wieder geht: Backzettel des Tages in der App prüfen und
            freigeben.
          </p>
        </div>
      </Box>
    </>
  )
}
