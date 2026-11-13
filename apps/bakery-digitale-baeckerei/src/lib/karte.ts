/**
 * Was eine Karte (Bottom-Sheet) und eine Zeile in „Alles hier“ zeigen - der
 * gemeinsame Nenner von Produkt (`ProduktInfo`, aus hq/products) und
 * Infopunkt (`karteVon`, aus den Rauminfos). Die Bedienelemente kennen nur
 * diese Form; woher der Inhalt kommt, weiß `DigitaleBaeckerei`.
 */
export interface Karte {
  /** eindeutig unter allem, was eine Karte haben kann (Infopunkte: `info:<knoten>`) */
  id: string
  name: string
  /** nur Produkte, und nur wenn hq sie nennt */
  einheit?: string
  kurztext: string
  /** langer Text (`''`, wenn es keinen gibt) */
  text: string
  /** Adresse einer Seite mit mehr dazu, nur wenn es sie gibt */
  seite?: string
}

/** Eine Zeile einer Liste: der Platz (oder Knoten) im Bild und sein Inhalt. */
export interface ListenZeile {
  slot: string
  /** Inhalt der Karte - ein Produkt oder ein Infopunkt. */
  produkt: Karte
}
