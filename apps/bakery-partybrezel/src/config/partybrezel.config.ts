/**
 * Einzige Quelle aller Werte des Partybrezel-Prototyps.
 *
 * Fest (aus dem Ablauf der Backstube): zwei Größen aus Flitteig, je 3 Teile,
 * klein 300 g, groß 400 g je Teil; der Teig entsteht am Vortag, abgeholt wird
 * am Backtag; Montag ist Ruhetag.
 *
 * Alles andere ist offen (Q-P1 … Q-P7, Liste unten) und hier mit
 * `PLATZHALTER Q-P…` markiert. Preise, Personenzahlen, Beläge und
 * Produkt-IDs sind ERFUNDEN - dieses Repo ist öffentlich, echte Werte stehen
 * (später) nur in hq.
 *
 * Die Komponenten lesen ausschließlich aus diesem Objekt: wer hier etwas
 * ändert, ändert den Prototyp.
 */

export type SizeId = 'klein' | 'gross'

export type ToppingMode = 'per-part' | 'per-pretzel'

export interface SizeConfig {
  id: SizeId
  /** Anzeigename, klein geschrieben ("klein", "groß"). */
  label: string
  /** Teile je Brezel (fest: 3). */
  partsPerPretzel: number
  /** Flitteig je Teil in Gramm (fest: 300 / 400). */
  gramsPerPart: number
  /** Ungefähr satt werdende Personen - Platzhalter. */
  persons: number
  /** Grundpreis je Brezel in Cent - Platzhalter. */
  basePriceCents: number
}

export interface ToppingConfig {
  /** Slug, passt auf das Varianten-Muster der API: ^[a-z0-9]+(?:-[a-z0-9]+)*$ */
  id: string
  label: string
  /** Aufpreis je belegtem Teil in Cent - Platzhalter. */
  surchargePerPartCents: number
  /** Farbe in der Vorschau. Nie einziger Träger: jedes Teil hat Nummer + Text. */
  color?: string
}

export interface OpenQuestion {
  id: string
  title: string
  text: string
}

export interface PartybrezelConfig {
  doughName: string
  sizes: SizeConfig[]
  toppings: ToppingConfig[]
  defaultToppingMode: ToppingMode
  /** Frühester Abholtag = heute + leadTimeDays. */
  leadTimeDays: number
  /** ISO-Wochentage 1 = Mo … 7 = So. Montag (1) wird immer ausgeschlossen. */
  availableWeekdays: number[]
  maxPretzelsPerOrder: number
  /** Wie viele wählbare Abholtage als Chips angeboten werden. */
  pickupDaysShown: number
  /** Höchstlänge der Anmerkung der Kundschaft (API: 500 für die ganze Anmerkung). */
  maxCustomerNoteLength: number
  /**
   * Produkt-IDs für die Vorschau des Vorbestellungs-Payloads.
   * HYPOTHETISCH: keines dieser Produkte existiert bisher in hq.
   */
  productIds: {
    /** Abbildung A: ein Produkt je Größe. */
    pretzelBySize: Record<SizeId, string>
    /** Abbildung B: ein Teil-Produkt je Größe, Belag als Sorte (variant). */
    partBySize: Record<SizeId, string>
  }
  openQuestions: OpenQuestion[]
}

export const partybrezelConfig: PartybrezelConfig = {
  doughName: 'Flitteig',
  sizes: [
    {
      id: 'klein',
      label: 'klein',
      partsPerPretzel: 3,
      gramsPerPart: 300,
      persons: 8, // PLATZHALTER Q-P2 - Personen je Größe offen
      basePriceCents: 1990, // PLATZHALTER Q-P6 - erfundener Preis
    },
    {
      id: 'gross',
      label: 'groß',
      partsPerPretzel: 3,
      gramsPerPart: 400,
      persons: 12, // PLATZHALTER Q-P2 - Personen je Größe offen
      basePriceCents: 2690, // PLATZHALTER Q-P6 - erfundener Preis
    },
  ],
  // PLATZHALTER Q-P3 - welche Beläge es gibt, ist offen; Aufpreise Q-P6.
  // Bewusst ohne Allergen- oder Zutatenangaben.
  toppings: [
    {
      id: 'butter',
      label: 'Butter',
      surchargePerPartCents: 0, // PLATZHALTER Q-P6
      color: '#f2d16b',
    },
    {
      id: 'kaese',
      label: 'Käse',
      surchargePerPartCents: 100, // PLATZHALTER Q-P6
      color: '#e9a23b',
    },
    {
      id: 'schinken',
      label: 'Schinken',
      surchargePerPartCents: 150, // PLATZHALTER Q-P6
      color: '#e07a8b',
    },
    {
      id: 'salami',
      label: 'Salami',
      surchargePerPartCents: 150, // PLATZHALTER Q-P6
      color: '#b8433f',
    },
    {
      id: 'frischkaese-kraeuter',
      label: 'Frischkäse & Kräuter',
      surchargePerPartCents: 100, // PLATZHALTER Q-P6
      color: '#8fc27a',
    },
    {
      id: 'vegetarisch',
      label: 'Vegetarisch',
      surchargePerPartCents: 150, // PLATZHALTER Q-P6
      color: '#4f9d69',
    },
  ],
  defaultToppingMode: 'per-part', // PLATZHALTER Q-P3 - gemischt je Teil oder ein Belag je Brezel
  leadTimeDays: 2, // PLATZHALTER Q-P5 - Vorlauf offen (Teig am Vortag => mindestens 1)
  // PLATZHALTER Q-P7 - Di-So; Montag ist immer Ruhetag. Dienstag bleibt
  // bewusst drin, ist aber offen: der Teig entstünde am Montag (Ruhetag).
  // Die Seite nennt dann keinen Teigtag, sondern die offene Frage.
  availableWeekdays: [2, 3, 4, 5, 6, 7],
  maxPretzelsPerOrder: 10, // PLATZHALTER Q-P5 - Obergrenze je Bestellung offen
  pickupDaysShown: 14, // PLATZHALTER Q-P5/Q-P7 - wie weit im Voraus bestellbar
  // Eigene Grenze für den Text der Kundschaft. Die API nimmt 500 Zeichen für
  // die GANZE Anmerkung (Belagsliste + Text); ob beides zusammen passt,
  // prüft validateNoteFits() - bei vielen gemischten Brezeln reicht der
  // Platz auch ohne Text nicht.
  maxCustomerNoteLength: 300,
  productIds: {
    // HYPOTHETISCH - existiert noch nicht in hq (Q-P1)
    pretzelBySize: { klein: 'partybrezel-klein', gross: 'partybrezel-gross' },
    // HYPOTHETISCH - existiert noch nicht in hq (Q-P1)
    partBySize: {
      klein: 'partybrezel-teil-klein',
      gross: 'partybrezel-teil-gross',
    },
  },
  openQuestions: [
    {
      id: 'Q-P1',
      title: 'Zähleinheit',
      text: 'Wird die ganze Brezel bestellt und gezählt oder jedes einzelne Teil?',
    },
    {
      id: 'Q-P2',
      title: 'Personen und Stücke je Größe',
      text: 'Für wie viele Personen reicht eine kleine bzw. große Partybrezel, und in wie viele Stücke wird sie geschnitten?',
    },
    {
      id: 'Q-P3',
      title: 'Beläge',
      text: 'Welche Beläge gibt es, und darf jedes Teil anders belegt werden oder gilt ein Belag für die ganze Brezel?',
    },
    {
      id: 'Q-P4',
      title: 'Belegen',
      text: 'Wer belegt die Brezeln und wann – in der Backstube am Backtag oder im Laden vor der Abholung?',
    },
    {
      id: 'Q-P5',
      title: 'Nur auf Vorbestellung, Vorlauf',
      text: 'Gibt es Partybrezeln nur auf Vorbestellung, und wie viele Tage vorher muss bestellt werden?',
    },
    {
      id: 'Q-P6',
      title: 'Preise',
      text: 'Was kostet eine kleine und eine große Partybrezel, und kosten einzelne Beläge Aufpreis?',
    },
    {
      id: 'Q-P7',
      title: 'Abholtage',
      text: 'An welchen Wochentagen gibt es Partybrezeln? Montag ist Ruhetag – für eine Abholung am Dienstag müsste der Teig aber am Montag angesetzt werden. Gibt es dienstags keine Partybrezeln, oder wird der Teig dann anders vorbereitet?',
    },
  ],
}

export default partybrezelConfig
