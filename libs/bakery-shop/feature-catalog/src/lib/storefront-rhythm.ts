/**
 * @fileoverview Der vertikale Rhythmus und der Radius der Startseite —
 * genau einmal aufgeschrieben.
 *
 * Vorher standen in den Startseiten-Dateien acht verschiedene `mb`/`py`-Werte
 * und **fünf** Eckradien nebeneinander, obwohl das Theme genau einen definiert.
 * Beides liest sich nicht als Absicht, sondern als Zufall: gleiche Bausteine
 * bekamen ungleiche Abstände, gleich große Flächen ungleiche Ecken.
 *
 * Die Werte sind MUI-Spacing-Vielfache (1 = 8 px). Wer hier etwas ändert,
 * ändert die ganze Startseite — genau das ist der Zweck.
 */

/**
 * Radius **jeder** Fläche des Shops: 1,5 × 8 px = 12 px.
 *
 * Das ist derselbe Wert, den das Theme `MuiCard` und `MuiPaper.rounded` gibt
 * (`shape.borderRadius * 1.5`). Papier-Flächen brauchen ihn deshalb gar nicht
 * zu setzen — nur `Box`/`ButtonBase`/`img`, die MUIs Papier-Klassen nicht
 * tragen. Bedienelemente (Button, Chip, Eingabefeld) behalten die 8 px aus
 * dem Theme; mehr Radien gibt es nicht.
 */
export const SURFACE_RADIUS = 1.5

/**
 * Innenabstand eines Bandes (`Container` mit `py`) — 40 px / 64 px.
 * Gleich groß wie {@link SECTION_GAP}, damit der Sprung über eine
 * Bandgrenze hinweg denselben Takt hat wie der innerhalb eines Bandes.
 */
export const BAND_Y = { xs: 5, md: 8 }

/** Abstand zwischen zwei Sektionen — 40 px / 64 px. */
export const SECTION_GAP = { xs: 5, md: 8 }

/**
 * Der schmale Zusagen-Streifen unter dem Hero ist die einzige Ausnahme:
 * er ist eine Fußnote zum Hero, kein eigenes Band — 24 px / 28 px.
 */
export const STRIP_Y = { xs: 3, md: 3.5 }

/** Zwischen Sektionsüberschrift und ihrem Inhalt — 20 px / 24 px. */
export const HEADING_GAP = { xs: 2.5, md: 3 }

/**
 * Spaltenabstand aller Raster der Startseite — 12 px / 16 px.
 *
 * Identisch mit `productGridSx` in `product-grid.tsx`: Kategoriekacheln und
 * Produktkarten stehen dadurch auf denselben Spaltenkanten.
 */
export const GRID_GAP = { xs: 1.5, sm: 2 }
