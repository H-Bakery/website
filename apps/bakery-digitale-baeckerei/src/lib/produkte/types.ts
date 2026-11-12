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
}

/**
 * `public/data/belegung.json`, geschrieben von scripts/sync-model.mjs aus dem
 * JSON-Teil des GLB: nur Plätze, die morgens belegt sind.
 */
export interface Belegung {
  version: 1
  quelle: { commit: string }
  slots: BelegungEintrag[]
}
