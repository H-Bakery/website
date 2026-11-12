/**
 * Prop-Typen der Bedienelemente - strukturell gleich dem gemeinsamen Vertrag
 * (`src/lib/produkte/types.ts`, `zuordnung.ts`, `src/config/raeume.ts`).
 * Nur eine Übergangsdatei: Sobald die Typen dort liegen, werden sie von dort
 * importiert und diese Datei entfällt.
 */

export interface ProduktInfo {
  /** hq-ID ohne Nummer, z. B. 'testbrot-500g' */
  id: string
  name: string
  kategorie: string
  /** nur wenn hq eine Einheit kennt - nie erfunden */
  einheit?: string
  kurztext: string
  /** langer Text, '' wenn es keinen gibt */
  text: string
  /** absolute URL der Produktseite, nur wenn es sie gibt */
  seite?: string
}

export interface ListenEintrag {
  slot: string
  produkt: ProduktInfo
  anzahl?: number
}

/** Der Teil eines Blickpunkts, den die Bedienelemente brauchen. */
export interface BlickpunktKurz {
  id: string
  name: string
}
