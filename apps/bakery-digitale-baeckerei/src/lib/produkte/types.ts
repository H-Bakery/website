/**
 * Produktdaten der Digitalen Bäckerei: der Snapshot aus hq und die Belegung
 * aus dem Modell. Beide Dateien entstehen beim Bauen (git-ignoriert) und
 * werden von der App per fetch gelesen. Keine Preise (DB8), keine Allergene.
 */

/** Ein Produkt aus hq, wie die App es zeigt. */
export interface ProduktInfo {
  /** hq-ID ohne Nummer, z. B. `testbrot-500g` (= `extras.product` im Modell) */
  id: string
  name: string
  /** hq-Kategorie: brot | broetchen | baguette | teilchen | snacks | kuchen | torten */
  kategorie: string
  /** aus hq `weight`, z. B. `500 g`; fehlt sonst - nie erfunden */
  einheit?: string
  kurztext: string
  /** langer Text (`''`, wenn es keinen gibt) */
  text: string
  /** Adresse der Produktseite auf der Landingpage, nur wenn es sie gibt */
  seite?: string
}

/** `public/data/products.snapshot.json`, geschrieben von scripts/sync-products.mjs */
export interface ProduktSnapshot {
  version: 1
  erstellt: string
  produkte: Record<string, ProduktInfo>
}

export interface BelegungEintrag {
  /** Modell-ID ohne `produkt/`, z. B. `brotregal/ebene-1/platz-01` */
  slot: string
  /** hq-ID des Produkts auf diesem Platz */
  produkt: string
  anzahl?: number
  /** `einrichtung`: so in hq eingerichtet (DB12) - sonst aus dem Modell. */
  quelle?: 'einrichtung'
}

/**
 * Der Rahmen eines Platzes im Raum (DB12), von scripts/sync-model.mjs aus der
 * Ware des Modells abgeleitet (scripts/plaetze.js): Mitte der Standfläche,
 * die Achsen rechts / oben / vorn (Einheitsvektoren im Rahmen des Modells),
 * Breite, Tiefe und lichte Höhe in Metern. Darauf legt die App die
 * Regal-Modelle (scripts/auslage.js).
 */
export interface Platz {
  o: [number, number, number]
  r: [number, number, number]
  n: [number, number, number]
  f: [number, number, number]
  b: number
  t: number
  h: number
  /** Reihen (Regalboden), Korb (gehäuft) oder Haken (Brezelständer). */
  art: 'reihen' | 'korb' | 'haken'
  /** Neigung der Standfläche in Grad (+ = hinten höher). */
  neigung: number
  /** Unter der Ware liegt im Modell ein Tablett; es bleibt liegen. */
  traeger?: true
}

/**
 * Die Belegung EINES Raums: nur Plätze, die morgens belegt sind. Abgeleitet
 * von scripts/sync-model.mjs aus dem JSON-Teil des GLB dieses Raums, darüber
 * die Einrichtung aus hq (DB12).
 */
export interface Belegung {
  version: 1
  quelle: { commit: string }
  slots: BelegungEintrag[]
  /** Plätze, die die Einrichtung ausdrücklich leert. */
  leer?: string[]
  /** Rahmen aller Plätze des Modells, auch derer mit neutraler Ware. */
  plaetze?: Record<string, Platz>
}

/**
 * `public/data/belegung.json`: die Belegung aller gebauten Räume, Schlüssel =
 * id des Raums (src/config/raeume.ts). Ein Raum ohne Produkte steht mit
 * leeren `slots` darin. Die App liest je Raum mit `belegungVon`.
 */
export interface BelegungDatei {
  version: 3
  raeume: Record<
    string,
    {
      quelle: { commit: string }
      slots: BelegungEintrag[]
      leer?: string[]
      plaetze?: Record<string, Platz>
    }
  >
}
