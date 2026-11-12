/**
 * Erfundene Rezepte für Specs (das Repo ist öffentlich - nie ein echtes
 * Rezept, eine echte Menge oder einen echten Namen aus hq hierher kopieren).
 * Form wie `GET /api/recipes[/:category/:slug]` (`docs/api/recipes.md`).
 */

import type {
  Recipe,
  RecipeCategory,
  RecipeList,
  RecipeSummary,
} from './recipesApi'

export const SYNTHETIC_UNITS = ['g', 'kg', 'ml', 'l', 'Stück', 'TL', 'Prise']

export function syntheticCategories(
  counts: Record<string, number> = {}
): RecipeCategory[] {
  const all: [string, string][] = [
    ['breads', 'Brote'],
    ['rolls', 'Brötchen'],
    ['baguettes', 'Baguettes'],
    ['snacks', 'Snacks'],
    ['cakes', 'Kuchen'],
    ['fillings', 'Füllungen'],
    ['special', 'Spezialprodukte'],
    ['teige', 'Teige (Backzettel)'],
  ]
  return all.map(([id, label]) => ({
    id,
    label,
    count: counts[id] ?? 0,
    writable: id !== 'teige',
  }))
}

export function syntheticSummary(
  overrides: Partial<RecipeSummary> = {}
): RecipeSummary {
  const category = overrides.category ?? 'breads'
  const slug = overrides.slug ?? 'musterkruste'
  return {
    id: `${category}/${slug}`,
    category,
    categoryLabel: 'Brote',
    slug,
    file: 'Musterkruste.md',
    path: `data/recipes/${category}/Musterkruste.md`,
    format: 'standard',
    title: 'Musterkruste',
    yield: '3 Laibe à 700g',
    ingredientCount: 5,
    editable: true,
    readOnlyReason: null,
    pendingApproval: false,
    pending: null,
    usedByBackzettel: [],
    ...overrides,
  }
}

/** Ein Brot im Standard-Format: zwei Gruppen, eine Zutat ohne Menge. */
export function syntheticRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    ...syntheticSummary(),
    description: 'Ein erfundenes Brot für die Tests.',
    parts: [
      {
        title: 'Testsauer',
        ingredients: [
          { name: 'Probemehl dunkel', amount: 135, unit: 'g', note: null },
          { name: 'Wasser', amount: 115, unit: 'g', note: null },
        ],
        total: null,
      },
      {
        title: 'Hauptteig',
        ingredients: [
          { name: 'Probemehl hell', amount: 1465, unit: 'g', note: null },
          { name: 'Testhefe', amount: 0.5, unit: 'g', note: null },
          {
            name: 'Probewasser zum Benetzen',
            amount: null,
            unit: null,
            note: null,
          },
        ],
        total: null,
      },
    ],
    steps: [
      {
        title: 'Formen',
        ordered: true,
        items: [
          'Teig in drei Stücke teilen',
          'Laibe formen:\n   - straff aufrollen\n   - Naht nach unten legen',
        ],
      },
      {
        title: 'Gärung',
        ordered: false,
        items: ['**Stockgare:** 35 Minuten'],
      },
    ],
    notes: '- **Haltbarkeit:** 5 Tage\n- **Lagerung:** Im Leinenbeutel',
    meta: [
      { key: 'baking.temperature', label: 'Backtemperatur (°C)', value: '228' },
      { key: 'bestaetigt', label: 'Bestätigt', value: null },
    ],
    sections: [{ title: 'Fehlerquellen', text: '- Zu kurze Gare' }],
    version: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    deletable: true,
    deleteBlockedReason: null,
    ...overrides,
  }
}

/** Eine Füllung im Tabellen-Format, die der Backzettel verwendet. */
export function syntheticFilling(overrides: Partial<Recipe> = {}): Recipe {
  return syntheticRecipe({
    id: 'fillings/gefuellte-testkraenze',
    category: 'fillings',
    categoryLabel: 'Füllungen',
    slug: 'gefuellte-testkraenze',
    file: 'Gefüllte-Testkränze.md',
    path: 'data/recipes/fillings/Gefüllte-Testkränze.md',
    format: 'table',
    title: 'Gefüllte Testkränze',
    yield: null,
    description: null,
    parts: [
      {
        title: 'Testnussfüllung',
        ingredients: [
          { name: 'Testnüsse', amount: 1350, unit: 'g', note: null },
          { name: 'Musterzucker', amount: 120, unit: 'g', note: 'nach Bedarf' },
          {
            name: 'Probegewürz',
            amount: null,
            unit: null,
            note: '3–6 g (nach Geschmack)',
          },
        ],
        total: { label: 'Gesamtmasse', text: '1.470 g' },
      },
    ],
    steps: [],
    notes: null,
    meta: [],
    sections: [],
    usedByBackzettel: [
      {
        kind: 'filling',
        id: 'nuss',
        name: 'Testnussfüllung',
        section: 'Testnussfüllung',
      },
    ],
    deletable: false,
    deleteBlockedReason:
      'Der Backzettel verwendet dieses Rezept (Testnussfüllung). Es lässt sich bearbeiten, aber nicht löschen oder verschieben.',
    ...overrides,
  })
}

export function syntheticList(overrides: Partial<RecipeList> = {}): RecipeList {
  const recipes: RecipeSummary[] = overrides.recipes ?? [
    syntheticSummary(),
    syntheticSummary({
      id: 'breads/probelaib',
      slug: 'probelaib',
      title: 'Probelaib',
      yield: null,
      ingredientCount: 1,
      pending: 'changed',
      pendingApproval: true,
    }),
    syntheticSummary({
      id: 'fillings/gefuellte-testkraenze',
      category: 'fillings',
      categoryLabel: 'Füllungen',
      slug: 'gefuellte-testkraenze',
      title: 'Gefüllte Testkränze',
      format: 'table',
      yield: null,
      ingredientCount: 3,
      usedByBackzettel: [
        {
          kind: 'filling',
          id: 'nuss',
          name: 'Testnussfüllung',
          section: 'Testnussfüllung',
        },
      ],
    }),
    syntheticSummary({
      id: 'teige/musterteig',
      category: 'teige',
      categoryLabel: 'Teige (Backzettel)',
      slug: 'musterteig',
      title: 'Musterteig',
      format: 'teig',
      yield: 'je 1 L Schüttwasser',
      editable: false,
      readOnlyReason: 'Teig-Rezepte werden vorerst nur in hq gepflegt.',
    }),
  ]
  const counts: Record<string, number> = {}
  for (const recipe of recipes) {
    counts[recipe.category] = (counts[recipe.category] ?? 0) + 1
  }
  return {
    status: 'ok',
    categories: syntheticCategories(counts),
    recipes,
    count: recipes.length,
    units: SYNTHETIC_UNITS,
    writable: true,
    writeIssue: null,
    canDelete: true,
    deleteIssue: null,
    ...overrides,
  }
}
