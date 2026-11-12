import React from 'react'
import { render } from '@testing-library/react'
import ThemeRegistry from './ThemeRegistry'
import type { BlickpunktKurz, ListenEintrag, ProduktInfo } from './typen'

/** Nur für Specs: erfundene Produkte, kein echter Name, Text oder Betrag. */

/** DB8 und Plan: weder Kosten noch Inhaltsstoff-Hinweise im sichtbaren Text. */
export const VERBOTEN = /€|EUR|Preis|Allergen/i

export const BLICKPUNKTE: BlickpunktKurz[] = [
  { id: 'theke', name: 'Theke' },
  { id: 'brotregal', name: 'Brotregal' },
  { id: 'regale', name: 'Regale' },
]

export const TESTBROT: ProduktInfo = {
  id: 'testbrot-500g',
  name: 'Testbrot',
  kategorie: 'brot',
  einheit: '500 g',
  kurztext: 'Ein erfundenes Brot mit kräftiger Kruste.',
  text: 'Ein erfundenes Brot mit kräftiger Kruste.\n\nDer Teig ruht lange und wird von Hand geformt.',
  seite: 'https://example.org/produkte/testbrot',
}

/** ohne Einheit, ohne langen Text, ohne Seite */
export const PROBEWECK: ProduktInfo = {
  id: 'probeweck',
  name: 'Probeweck',
  kategorie: 'broetchen',
  kurztext: 'Ein erfundenes Brötchen.',
  text: '',
}

export const AEPFELTASCHE: ProduktInfo = {
  id: 'aepfeltasche',
  name: 'Äpfeltasche',
  kategorie: 'teilchen',
  einheit: '1 Stück',
  kurztext: 'Ein erfundenes Teilchen.',
  // gleich dem Kurztext: nichts zum Aufklappen
  text: 'Ein erfundenes Teilchen.',
}

export const ZIMTKRINGEL: ProduktInfo = {
  id: 'zimtkringel',
  name: 'Zimtkringel',
  kategorie: 'teilchen',
  kurztext: 'Ein erfundener Kringel.',
  text: '',
}

/** Testbrot liegt auf zwei Plätzen, die Reihenfolge ist absichtlich unsortiert. */
export const EINTRAEGE: ListenEintrag[] = [
  { slot: 'theke/vitrine/ebene-1/platz-03', produkt: ZIMTKRINGEL, anzahl: 7 },
  { slot: 'theke/vitrine/ebene-1/platz-01', produkt: TESTBROT, anzahl: 4 },
  { slot: 'theke/vitrine/ebene-2/platz-02', produkt: PROBEWECK },
  { slot: 'theke/vitrine/ebene-2/platz-05', produkt: TESTBROT, anzahl: 9 },
  { slot: 'theke/vitrine/ebene-3/platz-01', produkt: AEPFELTASCHE, anzahl: 12 },
]

export function zeige(ui: React.ReactElement) {
  return render(<ThemeRegistry>{ui}</ThemeRegistry>)
}
