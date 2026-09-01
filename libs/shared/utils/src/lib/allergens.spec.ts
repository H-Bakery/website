import { BRAND_FACTS } from './brand'
import {
  ALLERGEN_KEYS,
  ALLERGEN_LABELS,
  ALLERGEN_SOURCE_NOTES,
  CROSS_CONTAMINATION_NOTE,
  NO_DECLARATION_NOTE,
  allergenLabel,
  formatAllergens,
  isAllergenKey,
  readAllergenDeclaration,
} from './allergens'

/** Jeder Text, den dieses Modul einem Gast zeigen kann. */
const ALL_TEXTS = [
  ...Object.values(ALLERGEN_LABELS),
  ...Object.values(ALLERGEN_SOURCE_NOTES),
  CROSS_CONTAMINATION_NOTE,
  NO_DECLARATION_NOTE,
]

describe('Sicherheitsregel: nur positive Aussagen', () => {
  // Der wichtigste Test der Datei. Eine falsche "enthält"-Angabe ärgert
  // jemanden; eine falsche "enthält nicht"-Angabe bringt jemanden ins
  // Krankenhaus. Es gibt in diesem Modul keine Formulierung über Abwesenheit,
  // und es darf auch später keine dazukommen.
  const VERBOTEN =
    /frei von|glutenfrei|laktosefrei|allergenfrei|nussfrei|ohne gluten|ohne laktose|enthält kein|unbedenklich/i

  it.each(ALL_TEXTS)('behauptet in "%s" keine Abwesenheit', (text) => {
    expect(text).not.toMatch(VERBOTEN)
  })

  it('bietet keine Funktion an, die eine leere Liste als Entwarnung ausgibt', () => {
    // Leere Liste ⇒ leerer String. Es gibt keinen Satz, der "keine Allergene"
    // sagt, weil diese Aussage aus einem Rezept nicht belegbar ist.
    expect(formatAllergens([])).toBe('')
  })

  it('macht aus einer fehlenden Angabe niemals eine leere Liste', () => {
    expect(readAllergenDeclaration({ name: 'Käsekuchen' })).toBeNull()
    expect(
      readAllergenDeclaration({ allergens: [], allergens_source: 'rezept' })
    ).toBeNull()
  })
})

describe('Allergen-Schlüssel und Bezeichnungen', () => {
  it('hat zu jedem Schlüssel eine deutsche Bezeichnung', () => {
    for (const key of ALLERGEN_KEYS) {
      expect(ALLERGEN_LABELS[key]).toBeTruthy()
      expect(ALLERGEN_LABELS[key].trim()).toBe(ALLERGEN_LABELS[key])
    }
    expect(Object.keys(ALLERGEN_LABELS).sort()).toEqual(
      [...ALLERGEN_KEYS].sort()
    )
  })

  it('nennt die Getreidearten einzeln, nicht nur "Gluten"', () => {
    // Anhang II Nr. 1 LMIV nennt sie ausdrücklich — und wer nur Weizen nicht
    // verträgt, ist mit "Gluten" allein nicht bedient.
    for (const cereal of [
      'weizen',
      'roggen',
      'gerste',
      'hafer',
      'dinkel',
    ] as const) {
      expect(ALLERGEN_KEYS).toContain(cereal)
    }
  })

  it('erkennt bekannte Schlüssel und weist unbekannte nicht als bekannt aus', () => {
    expect(isAllergenKey('gluten')).toBe(true)
    expect(isAllergenKey('soja')).toBe(false)
    expect(isAllergenKey(42)).toBe(false)
  })
})

describe('formatAllergens', () => {
  it('gibt einen einzelnen Eintrag ohne Aufzählung aus', () => {
    expect(formatAllergens(['gluten'])).toBe('Gluten')
  })

  it('verbindet zwei Einträge mit "und"', () => {
    expect(formatAllergens(['gluten', 'weizen'])).toBe('Gluten und Weizen')
  })

  it('setzt Kommas und vor dem letzten Eintrag "und"', () => {
    expect(formatAllergens(['gluten', 'weizen', 'milch'])).toBe(
      'Gluten, Weizen und Milch'
    )
  })

  it('sortiert nach Anzeigereihenfolge, nicht nach Eingabe', () => {
    // Im Frontmatter stehen die Schlüssel alphabetisch; angezeigt wird
    // Getreide zuerst.
    expect(formatAllergens(['sesam', 'roggen', 'gluten', 'weizen'])).toBe(
      'Gluten, Weizen, Roggen und Sesam'
    )
  })

  it('führt jedes Allergen nur einmal auf', () => {
    expect(formatAllergens(['milch', 'milch', 'ei'])).toBe('Ei und Milch')
  })

  it('reicht einen unbekannten Schlüssel durch, statt ihn zu verschlucken', () => {
    // Wenn `hq` schneller ist als der Code, darf ein neues Allergen nicht
    // stillschweigend aus der Liste fallen.
    expect(formatAllergens(['gluten', 'soja'])).toBe('Gluten und Soja')
    expect(allergenLabel('soja')).toBe('Soja')
  })

  it('übergeht leere Einträge', () => {
    expect(formatAllergens(['gluten', '', '  '])).toBe('Gluten')
  })

  it('benennt die Schalenfrüchte im Plural', () => {
    expect(formatAllergens(['mandel', 'haselnuss', 'walnuss', 'cashew'])).toBe(
      'Mandeln, Haselnüsse, Walnüsse und Cashewnüsse'
    )
  })
})

describe('Hinweistexte', () => {
  it('nennt im Kreuzkontaminations-Hinweis, was in der Backstube läuft', () => {
    for (const wort of ['Getreide', 'Nüsse', 'Sesam', 'Milch', 'Eier']) {
      expect(CROSS_CONTAMINATION_NOTE).toContain(wort)
    }
    expect(CROSS_CONTAMINATION_NOTE).toMatch(/Spuren/)
  })

  it('nennt ohne Angabe den Weg zur Auskunft (§ 4 LMIDV)', () => {
    expect(NO_DECLARATION_NOTE).toContain(BRAND_FACTS.phone)
    expect(NO_DECLARATION_NOTE).toContain('Theke')
  })

  it('sagt bei abgeleiteten Angaben, dass sie aus dem Rezept stammen', () => {
    expect(ALLERGEN_SOURCE_NOTES.rezept).toMatch(/Rezept/)
    expect(ALLERGEN_SOURCE_NOTES.rezept).toContain(BRAND_FACTS.phone)
    expect(ALLERGEN_SOURCE_NOTES.geprueft).toMatch(/geprüft/)
  })

  it('bleibt in der Sie-Form', () => {
    for (const text of ALL_TEXTS) {
      expect(text).not.toMatch(/\b(du|dich|dir|dein|deine|deinem|deiner)\b/i)
    }
  })
})

describe('readAllergenDeclaration', () => {
  it('liest das Frontmatter, wie es in hq steht', () => {
    expect(
      readAllergenDeclaration({
        allergens: ['gluten', 'roggen', 'sesam', 'weizen'],
        allergens_source: 'rezept',
        allergen_recipe: 'Kornbrot',
      })
    ).toEqual({
      allergens: ['gluten', 'roggen', 'sesam', 'weizen'],
      source: 'rezept',
      recipe: 'Kornbrot',
    })
  })

  it('liest auch die camelCase-Form nach dem Mapping in den Apps', () => {
    expect(
      readAllergenDeclaration({
        allergens: ['milch'],
        allergensSource: 'geprueft',
      })
    ).toEqual({ allergens: ['milch'], source: 'geprueft' })
  })

  it('verlangt eine bekannte Herkunft', () => {
    expect(
      readAllergenDeclaration({
        allergens: ['gluten'],
        allergens_source: 'geschätzt',
      })
    ).toBeNull()
    expect(readAllergenDeclaration({ allergens: ['gluten'] })).toBeNull()
  })

  it('normalisiert die Schreibweise, wirft aber nichts weg', () => {
    const declaration = readAllergenDeclaration({
      allergens: [' Gluten ', 'soja', 7],
      allergens_source: 'rezept',
    })
    expect(declaration?.allergens).toEqual(['gluten', 'soja'])
  })

  it('gibt für nichts null zurück', () => {
    expect(readAllergenDeclaration(null)).toBeNull()
    expect(readAllergenDeclaration(undefined)).toBeNull()
    expect(readAllergenDeclaration({ allergens: 'gluten' })).toBeNull()
  })
})
