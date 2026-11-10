/**
 * Backzettel-Stammdaten (Z1): Schema-Pruefung, Normalisierung, Loader, CLI
 * und das Lesen der Fuellungsrezepte. Nur synthetische Fixtures.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const core = require('../../src/services/backzettel-config.core')
const loader = require('../../src/services/backzettel-config.loader')
const recipes = require('../../src/services/backzettel-recipes.core')
const cli = require('../../scripts/validate-backzettel')
const {
  PRODUCTS,
  config,
  RECIPE_MD,
  PRODUCTS_V2,
  configV2,
  OPEN_V2,
} = require('../fixtures/backzettel.synthetic')
const { V1_CASES } = require('../fixtures/backzettel-v1-cases')
const V1_RECORDED = require('../fixtures/backzettel-v1-validation.recorded.json')

function validate(obj, products = PRODUCTS) {
  return core.validateBackzettelConfig(obj, { products })
}

function withItem(patch, index = 0) {
  const cfg = config()
  cfg.items[index] = { ...cfg.items[index], ...patch }
  return cfg
}

function paths(result) {
  return result.errors.map((e) => e.path)
}

describe('validateBackzettelConfig', () => {
  it('akzeptiert die synthetische Konfiguration ohne Fehler', () => {
    const result = validate(config())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('lehnt etwas ab, das kein Objekt ist', () => {
    expect(validate(null).ok).toBe(false)
    expect(validate([]).ok).toBe(false)
    expect(validate('version: 1').errors[0].path).toBe('')
  })

  it('verlangt version 1', () => {
    expect(paths(validate(config({ version: 2 })))).toContain('version')
    expect(paths(validate(config({ version: undefined })))).toContain('version')
  })

  it('prueft days auf 1..7, ohne Doppelte, nicht leer', () => {
    expect(paths(validate(config({ days: [] })))).toContain('days')
    expect(paths(validate(config({ days: [0, 2, 3, 4, 5, 6, 7] })))).toContain(
      'days[0]'
    )
    expect(paths(validate(config({ days: [2, 3, 4, 5, 6, 7, 8] })))).toContain(
      'days[6]'
    )
    expect(paths(validate(config({ days: [2, 2, 3, 4, 5, 6, 7] })))).toContain(
      'days[1]'
    )
    expect(paths(validate(config({ days: [2, 3, 4, 5, 6, '7'] })))).toContain(
      'days[5]'
    )
  })

  it('prueft sections gegen die feste Liste', () => {
    const result = validate(config({ sections: ['brot', 'torten', 'brot'] }))
    expect(paths(result)).toEqual(
      expect.arrayContaining(['sections[1]', 'sections[2]'])
    )
  })

  it('verlangt, dass jeder Posten in einem bekannten Abschnitt steht', () => {
    const cfg = config({
      sections: ['brot', 'broetchen', 'kaffeestueckchen', 'hefeteig'],
    })
    const result = validate(cfg)
    expect(result.errors).toEqual([])
    const cfg2 = withItem({ section: 'laugen' })
    expect(paths(validate(cfg2))).toContain('items[0].section')
  })

  it('verlangt eindeutige Slug-IDs fuer Posten', () => {
    const cfg = config()
    cfg.items[1].id = cfg.items[0].id
    expect(paths(validate(cfg))).toContain('items[1].id')
    expect(paths(validate(withItem({ id: 'Korn Brot' })))).toContain(
      'items[0].id'
    )
    expect(paths(validate(withItem({ id: undefined })))).toContain(
      'items[0].id'
    )
  })

  it('kennt nur die Einheiten Stück, Liter, Blech, kg, Charge', () => {
    expect(paths(validate(withItem({ unit: 'Laib' })))).toContain(
      'items[0].unit'
    )
    for (const unit of ['Stück', 'Liter', 'Blech', 'kg', 'Charge']) {
      const cfg = withItem({ unit, base: { 2: 4 } })
      expect(validate(cfg).errors).toEqual([])
    }
  })

  it('Charge (Chargen-Faktor eines Spezialbrots) darf Bruchteile haben', () => {
    const cfg = withItem({ unit: 'Charge', base: { 2: 1.12, 3: 1.5 } })
    cfg.items[0].pieces_per_liter = null
    expect(validate(cfg).errors).toEqual([])
    expect(core.INTEGER_UNITS.has('Charge')).toBe(false)
    expect(
      core.normalizeConfig(cfg).items.find((i) => i.id === 'kornbrot').unit
    ).toBe('Charge')
  })

  it('purchased (Zukauf) und note: Typen, kein Teig bei Zukauf', () => {
    // Posten ohne Teig (Schnecke) als Zukauf mit Hinweis: gültig
    const ok = withItem({ purchased: true, note: 'mit Käse bestreuen' }, 4)
    const r = validate(ok)
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.path)).not.toContain('items[4].purchased')

    expect(paths(validate(withItem({ purchased: 'ja' }, 4)))).toContain(
      'items[4].purchased'
    )
    expect(paths(validate(withItem({ note: 5 }, 4)))).toContain('items[4].note')
    expect(paths(validate(withItem({ note: '  ' }, 4)))).toContain(
      'items[4].note'
    )
    // Zukauf mit eigenem Teig widerspricht sich
    const withDough = validate(withItem({ purchased: true }, 5))
    expect(paths(withDough)).toContain('items[5].dough')
    expect(
      withDough.errors.find((e) => e.path === 'items[5].dough').message
    ).toMatch(/Zukauf/)
    // false und null sind erlaubt
    expect(validate(withItem({ purchased: false }, 5)).errors).toEqual([])
    expect(validate(withItem({ purchased: null }, 4)).errors).toEqual([])
  })

  it('prueft Produkte gegen den hq-Katalog und factor > 0', () => {
    const r1 = validate(
      withItem({ products: [{ id: 'gibt-es-nicht', factor: 1 }] })
    )
    expect(paths(r1)).toContain('items[0].products[0].id')
    expect(r1.errors[0].message).toMatch(/hq-Katalog/)

    expect(
      paths(
        validate(withItem({ products: [{ id: 'test-kornbrot', factor: 0 }] }))
      )
    ).toContain('items[0].products[0].factor')
    expect(
      paths(
        validate(withItem({ products: [{ id: 'test-kornbrot', factor: -1 }] }))
      )
    ).toContain('items[0].products[0].factor')
    // factor fehlt -> 1
    expect(
      validate(withItem({ products: [{ id: 'test-kornbrot' }] })).errors
    ).toEqual([])
  })

  it('prueft Produkt-IDs nicht, wenn kein Katalog uebergeben wird', () => {
    const cfg = withItem({ products: [{ id: 'irgendwas', factor: 1 }] })
    expect(core.validateBackzettelConfig(cfg).errors).toEqual([])
  })

  it('warnt bei einem nicht verfuegbaren Katalogprodukt', () => {
    const r = validate(withItem({ products: [{ id: 'test-alt', factor: 1 }] }))
    expect(r.ok).toBe(true)
    expect(r.warnings.map((w) => w.path)).toContain('items[0].products[0].id')
  })

  it('verbietet, dass ein Produkt zwei Posten zugeordnet ist (doppelte Vorbestellungen)', () => {
    const cfg = config()
    cfg.items[2].products = [{ id: 'test-kornbrot', factor: 1 }]
    const r = validate(cfg)
    expect(paths(r)).toContain('items[2].products[0].id')
    expect(
      r.errors.find((e) => e.path === 'items[2].products[0].id').message
    ).toMatch(/doppelt/)
  })

  it('verlangt variants als Liste eindeutiger Slugs', () => {
    expect(paths(validate(withItem({ variants: 'nuss' }, 5)))).toContain(
      'items[5].variants'
    )
    expect(
      paths(validate(withItem({ variants: ['nuss', 'Mohn Neu'] }, 5)))
    ).toContain('items[5].variants[1]')
    expect(
      paths(validate(withItem({ variants: ['nuss', 'nuss'] }, 5)))
    ).toContain('items[5].variants[1]')
  })

  it('verlangt base-Schluessel aus days', () => {
    const r = validate(withItem({ base: { 1: 4, 2: 4 } }))
    expect(paths(r)).toContain('items[0].base.1')
    expect(paths(validate(withItem({ base: { montag: 4 } })))).toContain(
      'items[0].base.montag'
    )
  })

  it('verlangt ganzzahlige, nicht-negative Mengen bei Stück, erlaubt Bruchteile bei Liter', () => {
    expect(paths(validate(withItem({ base: { 2: 10.5 } }, 2)))).toContain(
      'items[2].base.2'
    )
    expect(paths(validate(withItem({ base: { 2: -1 } }, 2)))).toContain(
      'items[2].base.2'
    )
    expect(paths(validate(withItem({ base: { 2: '10' } }, 2)))).toContain(
      'items[2].base.2'
    )
    expect(validate(withItem({ base: { 2: 1.24 } }, 0)).errors).toEqual([])
    expect(paths(validate(withItem({ base: { 2: -0.5 } }, 0)))).toContain(
      'items[0].base.2'
    )
  })

  it('erlaubt Varianten-Mengen nur mit Schluesseln aus variants', () => {
    const r = validate(withItem({ base: { 6: { nuss: 1, marzipan: 2 } } }, 5))
    expect(paths(r)).toEqual(['items[5].base.6.marzipan'])
    const r2 = validate(withItem({ base: { 6: { nuss: 1.5 } } }, 5))
    expect(paths(r2)).toEqual(['items[5].base.6.nuss'])
  })

  it('verbietet eine Varianten-Zuordnung bei einem Posten ohne variants', () => {
    expect(
      paths(validate(withItem({ base: { 2: { nuss: 1 } } }, 2)))
    ).toContain('items[2].base.2')
  })

  it('verlangt, dass dough auf einen bekannten Teig zeigt, mit piece_g > 0 und ganzen pieces', () => {
    expect(
      paths(
        validate(
          withItem({ dough: { id: 'unbekannt', piece_g: 500, pieces: 1 } }, 5)
        )
      )
    ).toContain('items[5].dough.id')
    expect(
      paths(
        validate(
          withItem({ dough: { id: 'hefeteig-test', piece_g: 0, pieces: 1 } }, 5)
        )
      )
    ).toContain('items[5].dough.piece_g')
    expect(
      paths(
        validate(
          withItem(
            { dough: { id: 'hefeteig-test', piece_g: 500, pieces: 1.5 } },
            5
          )
        )
      )
    ).toContain('items[5].dough.pieces')
  })

  it('prueft filling_g: braucht variants, Zahl > 0 oder Zuordnung je Variante', () => {
    expect(paths(validate(withItem({ filling_g: 300 }, 2)))).toContain(
      'items[2].filling_g'
    )
    expect(paths(validate(withItem({ filling_g: 0 }, 5)))).toContain(
      'items[5].filling_g'
    )
    expect(
      paths(validate(withItem({ filling_g: { nuss: 100, schoko: 100 } }, 5)))
    ).toContain('items[5].filling_g.schoko')
    expect(validate(withItem({ filling_g: null }, 5)).errors).toEqual([])
  })

  it('warnt, wenn eine Variante mit filling_g keine Fuellung in fillings hat', () => {
    const cfg = config()
    cfg.fillings = cfg.fillings.filter((f) => f.id !== 'mohn')
    const r = validate(cfg)
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => /„mohn“/.test(w.message))).toBe(true)
  })

  it('verlangt tray.no als positive ganze Zahl oder Liste davon', () => {
    expect(paths(validate(withItem({ tray: { no: 0 } }, 3)))).toContain(
      'items[3].tray.no'
    )
    expect(paths(validate(withItem({ tray: { no: [1, 1] } }, 3)))).toContain(
      'items[3].tray.no'
    )
    expect(paths(validate(withItem({ tray: { no: [] } }, 3)))).toContain(
      'items[3].tray.no'
    )
    expect(
      paths(validate(withItem({ tray: { no: 2, per_tray: 0 } }, 3)))
    ).toContain('items[3].tray.per_tray')
    expect(validate(withItem({ tray: { no: 2 } }, 3)).errors).toEqual([])
  })

  it('prueft plu und warnt bei doppelt vergebenen PLUs', () => {
    expect(paths(validate(withItem({ plu: ['906'] }, 3)))).toContain(
      'items[3].plu[0]'
    )
    const cfg = config()
    cfg.items[2].plu = [906]
    const r = validate(cfg)
    expect(r.ok).toBe(true)
    expect(r.warnings.map((w) => w.path)).toContain('items[3].plu[0]')
  })

  it('prueft Vorbereitungen: eindeutige IDs, when_item existiert, by_weekday-Schluessel', () => {
    const cfg = config()
    cfg.prep.push({ id: 'sauerteig' })
    cfg.prep.push({ id: 'x', when_item: 'gibt-es-nicht' })
    cfg.prep.push({ id: 'y', by_weekday: { 1: 'misch', sonntag: 'x' } })
    cfg.prep.push({ id: 'z', days: [1] })
    cfg.prep.push({ id: 'l1', variant_labels: ['groß'] })
    cfg.prep.push({ id: 'l2', variant_labels: { gross: '  ' } })
    const p = paths(validate(cfg))
    expect(p).toEqual(
      expect.arrayContaining([
        'prep[8].variant_labels',
        'prep[9].variant_labels.gross',
        'prep[4].id',
        'prep[5].when_item',
        'prep[6].by_weekday.1',
        'prep[6].by_weekday.sonntag',
        'prep[7].days[0]',
      ])
    )
  })

  it('verlangt eindeutige Teig- und Fuellungs-IDs', () => {
    const cfg = config()
    cfg.doughs.push({ id: 'hefeteig-test', batch_max_kg: 5 })
    cfg.fillings.push({ id: 'nuss' })
    expect(paths(validate(cfg))).toEqual(
      expect.arrayContaining(['doughs[1].id', 'fillings[2].id'])
    )
  })

  it('warnt bei Teig ohne Chargengroesse und bei unbekannten Schluesseln', () => {
    const cfg = config({ extra: 1 })
    delete cfg.doughs[0].batch_max_kg
    cfg.items[0].bsae = { 2: 1 }
    const r = validate(cfg)
    expect(r.ok).toBe(true)
    const w = r.warnings.map((x) => x.path)
    expect(w).toEqual(
      expect.arrayContaining([
        'extra',
        'doughs[0].batch_max_kg',
        'items[0].bsae',
      ])
    )
  })

  it('Z10: batch_max_kg null ist offen, keine Warnung', () => {
    const cfg = config()
    cfg.doughs[0].batch_max_kg = null
    const r = validate(cfg)
    expect(r.ok).toBe(true)
    expect(r.warnings).toEqual([])
    expect(r.open).toEqual([
      {
        path: 'doughs[0].batch_max_kg',
        code: 'batch_max_kg_unknown',
        message:
          'Teig „hefeteig-test“: Chargengröße ist noch offen – Chargen werden nicht berechnet.',
      },
    ])
  })

  it('verlangt Rezeptpfade relativ unter data/recipes/ mit .md (nie ausserhalb von hq)', () => {
    const at = (recipe) => {
      const cfg = config()
      cfg.fillings[0].recipe = recipe
      return paths(validate(cfg))
    }
    for (const bad of [
      '/etc/passwd',
      '../../../website/package.json',
      'data/recipes/../../../x.md',
      'data/recipes/./x.md',
      'data/recipes//x.md',
      'data\\recipes\\x.md',
      'data/recipes/x.txt',
      'fillings/x.md',
    ]) {
      expect(at(bad)).toContain('fillings[0].recipe')
    }
    expect(at('data/recipes/fillings/Gefüllte-Kränze.md')).toEqual([])
    expect(core.isSafeRecipePath(null)).toBe(false)
  })

  it('verlangt bei gefuellten Posten die Grundmenge je Variante', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base = { 6: 5 }
    const r = validate(cfg)
    const e = r.errors.find((x) => x.path === 'items[5].base.6')
    expect(e.message).toMatch(/je Variante, z\. B\. \{ nuss: 5 \}/)
    // null (noch nicht festgelegt) ist erlaubt
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base = { 6: null }
    expect(validate(cfg).errors).toEqual([])
  })

  it('warnt, wenn zwei Posten dasselbe Blech belegen', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'schnecke').tray = { no: 8 }
    const r = validate(cfg)
    expect(r.ok).toBe(true)
    expect(r.warnings).toContainEqual({
      path: 'items[4].tray.no',
      message: 'Blech 8 ist auch Posten „plunder“ zugeordnet.',
    })
  })

  it('sammelt mehrere Fehler auf einmal statt beim ersten abzubrechen', () => {
    const cfg = config({ version: 3 })
    cfg.items[0].unit = 'Laib'
    cfg.items[2].base = { 2: -3 }
    expect(validate(cfg).errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('normalizeConfig', () => {
  it('setzt Standardwerte und macht Wochentage zu Zahl-Schluesseln', () => {
    const n = core.normalizeConfig(config())
    const weck = n.items.find((i) => i.id === 'weck')
    expect(weck.unit).toBe('Stück')
    expect(weck.variants).toEqual([])
    expect(weck.dough).toBeNull()
    expect(weck.base[2]).toBe(40)
    const schnecke = n.items.find((i) => i.id === 'schnecke')
    expect(schnecke.products).toEqual([])
    expect(schnecke.tray).toEqual({ no: [3], per_tray: null })
    const zopf = n.items.find((i) => i.id === 'zopf-gefuellt')
    expect(zopf.filling_g).toEqual({ nuss: 400, mohn: 400 })
    expect(zopf.base[6]).toEqual({ nuss: 4, mohn: 2 })
    const sauerteig = n.prep.find((p) => p.id === 'sauerteig')
    expect(sauerteig.by_weekday).toEqual({
      3: 'buttermilch',
      6: null,
      default: 'misch',
    })
  })

  it('purchased ist immer ein Boolean, note getrimmt oder null', () => {
    const cfg = withItem({ purchased: true, note: ' mit Käse bestreuen ' }, 4)
    const n = core.normalizeConfig(cfg)
    const schnecke = n.items.find((i) => i.id === 'schnecke')
    expect(schnecke.purchased).toBe(true)
    expect(schnecke.note).toBe('mit Käse bestreuen')
    const weck = n.items.find((i) => i.id === 'weck')
    expect(weck.purchased).toBe(false)
    expect(weck.note).toBeNull()
  })

  it('itemHint: „Zukauf – auflegen“ und note, sonst null', () => {
    expect(core.itemHint({ purchased: true, note: 'mit Käse bestreuen' })).toBe(
      'Zukauf – auflegen · mit Käse bestreuen'
    )
    expect(core.itemHint({ purchased: true, note: null })).toBe(
      'Zukauf – auflegen'
    )
    expect(core.itemHint({ purchased: false, note: 'für morgen' })).toBe(
      'für morgen'
    )
    expect(core.itemHint({ purchased: false, note: null })).toBeNull()
    expect(core.itemHint(null)).toBeNull()
  })

  it('ist idempotent', () => {
    const once = core.normalizeConfig(config())
    expect(core.normalizeConfig(once)).toEqual(once)
  })

  it('verkraftet leere Eingaben', () => {
    expect(core.normalizeConfig(undefined)).toMatchObject({
      items: [],
      doughs: [],
      prep: [],
    })
  })
})

describe('Fuellungsrezepte (hq-Markdown)', () => {
  it('liest mehrere Rezepte einer Datei mit deutschen Mengenangaben', () => {
    const all = recipes.parseFillingRecipes(RECIPE_MD)
    expect(all.map((r) => r.id)).toEqual([
      'nussfuellung',
      'mohnfuellung',
      'apfeltest',
    ])
    expect(all[0]).toMatchObject({
      title: 'Nussfüllung',
      batch_g: 2000,
      complete: true,
    })
    expect(all[1].ingredients).toEqual([
      { name: 'Mohn', g: 1500, unit: 'kg', raw: '1,5 kg' },
      { name: 'Zucker', g: 400, unit: 'g', raw: '400 g (nach Bedarf)' },
      { name: 'Bindemittel', g: 100, unit: 'g', raw: '100 g' },
    ])
    expect(all[1].batch_g).toBe(2000)
  })

  it('markiert Rezepte mit nicht umrechenbaren Mengen als unvollstaendig', () => {
    const apfel = recipes.parseFillingRecipe(RECIPE_MD, {
      section: 'Apfeltest',
    })
    expect(apfel.complete).toBe(false)
    expect(apfel.ingredients.map((i) => i.g)).toEqual([null, null, 200])
  })

  it('nimmt ohne section das erste Rezept und liefert null bei unbekannter Ueberschrift', () => {
    expect(recipes.parseFillingRecipe(RECIPE_MD).title).toBe('Nussfüllung')
    expect(
      recipes.parseFillingRecipe(RECIPE_MD, { section: 'Marzipan' })
    ).toBeNull()
    expect(recipes.parseFillingRecipe('')).toBeNull()
  })

  it('benennt ein Rezept unter "### Zutaten:" nach der Datei-Ueberschrift', () => {
    const md =
      '# 🍏 Testkompott\n\n### Zutaten:\n| Zutat | Menge |\n|---|---|\n| Obst | 500 g |\n'
    expect(recipes.parseFillingRecipe(md).title).toBe('Testkompott')
  })

  it('findet einen Abschnitt auch mit Emoji oder Doppelpunkt in der Angabe', () => {
    const all = recipes.parseFillingRecipes(RECIPE_MD)
    expect(recipes.findRecipeBySection(all, '🌰 Nussfüllung:').title).toBe(
      'Nussfüllung'
    )
    expect(recipes.findRecipeBySection(all, 'mohn').title).toBe('Mohnfüllung')
    expect(recipes.findRecipeBySection(all, '')).toBeNull()
    expect(recipes.findRecipeBySection(null, 'Mohn')).toBeNull()
  })

  it('findet das Rezept zu einer Fuellungs-ID', () => {
    const all = recipes.parseFillingRecipes(RECIPE_MD)
    expect(recipes.findRecipeForFilling(all, 'mohn').title).toBe('Mohnfüllung')
    expect(recipes.findRecipeForFilling(all, 'schoko')).toBeNull()
  })

  it('parst Mengenangaben', () => {
    expect(recipes.parseAmount('1.200 ml')).toEqual({ g: 1200, unit: 'ml' })
    expect(recipes.parseAmount('ca. 3 kg')).toEqual({ g: 3000, unit: 'kg' })
    expect(recipes.parseAmount('0,5 l')).toEqual({ g: 500, unit: 'l' })
    expect(recipes.parseAmount('2–5 g')).toEqual({ g: null, unit: null })
    expect(recipes.parseAmount('1 Dose')).toEqual({ g: null, unit: null })
    expect(recipes.parseAmount('5 gr')).toEqual({ g: null, unit: null })
  })

  it('skaliert auf 10 g gerundet, eine benoetigte Zutat nie auf 0', () => {
    const nuss = recipes.parseFillingRecipe(RECIPE_MD, {
      section: 'Nussfüllung',
    })
    const scaled = recipes.scaleRecipe(nuss, 3333)
    expect(scaled.factor).toBe(1.667)
    expect(scaled.ingredients.map((i) => i.scaled_g)).toEqual([1670, 1670])

    const tiny = recipes.scaleRecipe(
      {
        batch_g: 1000,
        ingredients: [
          { name: 'Salz', g: 1 },
          { name: 'Mehl', g: 999 },
        ],
      },
      1000
    )
    expect(tiny.ingredients.map((i) => i.scaled_g)).toEqual([10, 1000])

    const apfel = recipes.parseFillingRecipe(RECIPE_MD, {
      section: 'Apfeltest',
    })
    const a = recipes.scaleRecipe(apfel, 400)
    expect(a.complete).toBe(false)
    expect(a.ingredients[0]).toMatchObject({
      scaled_g: null,
      raw: '1 Dose (ca. 2 kg)',
    })
    // W4-verify r2: no factor from the readable part alone (200 g -> "× 2")
    expect(a.factor).toBeNull()
    expect(a.batch_g).toBeNull()
    expect(a.ingredients.map((i) => i.scaled_g)).toEqual([null, null, null])
    expect(a.ingredients[2]).toMatchObject({ raw: '200 g', g: 200 })
    expect(recipes.scaleRecipe(null, 100)).toBeNull()
  })
})

describe('Loader und CLI', () => {
  let dir
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backzettel-'))
    fs.mkdirSync(path.join(dir, 'config'))
    fs.mkdirSync(path.join(dir, 'products'))
    fs.mkdirSync(path.join(dir, 'data', 'recipes', 'fillings'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(dir, 'data', 'recipes', 'fillings', 'test.md'),
      RECIPE_MD
    )
    for (const p of PRODUCTS) {
      fs.writeFileSync(
        path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
        `---\nid: ${p.id}\nnumeric_id: ${
          p.numeric_id
        }\nname: Test\navailable: ${p.available !== false}\n---\n\nText\n`
      )
    }
    fs.writeFileSync(
      path.join(dir, 'products', '_template.md'),
      '---\nid: [platzhalter]\n---\n'
    )
    fs.writeFileSync(path.join(dir, 'config', 'ok.yaml'), toYaml(config()))
    const broken = config()
    broken.items[0].products = [{ id: 'gibt-es-nicht', factor: 1 }]
    fs.writeFileSync(path.join(dir, 'config', 'fehler.yaml'), toYaml(broken))
    fs.writeFileSync(
      path.join(dir, 'config', 'kaputt.yaml'),
      'version: 1\nitems: [\n'
    )
    const noRecipe = config()
    noRecipe.fillings[1].recipe = 'data/recipes/fillings/fehlt.md'
    fs.writeFileSync(path.join(dir, 'config', 'rezept.yaml'), toYaml(noRecipe))
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  // JSON ist gueltiges YAML - so braucht der Test keinen YAML-Writer.
  function toYaml(obj) {
    return JSON.stringify(obj, null, 2)
  }

  function runCli(args) {
    const out = []
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s))
      return true
    })
    try {
      return { code: cli.main(args), out: out.join('') }
    } finally {
      spy.mockRestore()
    }
  }

  it('liest den Produktkatalog ohne _template.md', () => {
    const catalog = loader.readProductCatalog(path.join(dir, 'products'))
    expect(catalog).toHaveLength(PRODUCTS.length)
    expect(catalog.find((p) => p.id === 'test-alt').available).toBe(false)
  })

  it('laedt und normalisiert eine gueltige Datei', () => {
    const r = loader.loadBackzettelConfig(path.join(dir, 'config', 'ok.yaml'), {
      productsDir: path.join(dir, 'products'),
    })
    expect(r.errors).toEqual([])
    expect(r.config.items).toHaveLength(8)
    expect(r.config.items[0].base[2]).toBe(4)
  })

  it('liest YAML mit Wochentag-Schluesseln und Kommentaren', () => {
    const parsed = loader.parseBackzettelYaml(
      'base: { 2: 4, 6: { nuss: 1 } } # Kommentar\n'
    )
    expect(parsed.data.base).toEqual({ 2: 4, 6: { nuss: 1 } })
  })

  it('meldet YAML-Syntaxfehler mit Zeile', () => {
    const r = loader.loadBackzettelConfig(
      path.join(dir, 'config', 'kaputt.yaml')
    )
    expect(r.ok).toBe(false)
    expect(r.errors[0].message).toMatch(/YAML lässt sich nicht lesen.*Zeile/)
  })

  it('meldet eine fehlende Datei', () => {
    const r = loader.loadBackzettelConfig(path.join(dir, 'config', 'nein.yaml'))
    expect(r.ok).toBe(false)
  })

  it('laedt die Fuellungsrezepte relativ zur hq-Wurzel', () => {
    const r = loader.loadBackzettelConfig(path.join(dir, 'config', 'ok.yaml'))
    const { recipes: loaded, missing } = loader.loadFillingRecipes(
      r.config,
      dir
    )
    expect(missing).toEqual([])
    expect(loaded.nuss.batch_g).toBe(2000)
    expect(loaded.mohn.title).toBe('Mohnfüllung')
  })

  it('Loader: gleiche Abschnittssuche wie der Rezept-Core (Emoji/Doppelpunkt)', () => {
    const r = loader.loadBackzettelConfig(path.join(dir, 'config', 'ok.yaml'))
    r.config.fillings[0].section = '🌰 Nussfüllung:'
    const { recipes: loaded, missing } = loader.loadFillingRecipes(
      r.config,
      dir
    )
    expect(missing).toEqual([])
    expect(loaded.nuss.title).toBe('Nussfüllung')
  })

  it('Loader: liest auch ungeprueft nie ausserhalb von hq', () => {
    const outside = path.join(path.dirname(dir), 'backzettel-outside.md')
    fs.writeFileSync(outside, RECIPE_MD)
    try {
      const cfg = {
        fillings: [
          { id: 'a', recipe: outside },
          { id: 'b', recipe: '../backzettel-outside.md' },
          { id: 'c', recipe: 'data/recipes/../../../backzettel-outside.md' },
        ],
      }
      const { recipes: loaded, missing } = loader.loadFillingRecipes(cfg, dir)
      expect(loaded).toEqual({})
      expect(missing.map((m) => m.id)).toEqual(['a', 'b', 'c'])
      expect(missing[0].message).toMatch(/nicht unter data\/recipes\//)
    } finally {
      fs.rmSync(outside, { force: true })
    }
  })

  it('CLI: Exit 0 fuer eine gueltige Datei', () => {
    const { code, out } = runCli([path.join(dir, 'config', 'ok.yaml')])
    expect(code).toBe(0)
    expect(out).toMatch(/OK: .* ist gültig \(8 Posten, 9 Produkte geprüft/)
  })

  it('CLI: Exit 1 bei unbekanntem Produkt, mit Pfad in der Meldung', () => {
    const { code, out } = runCli([
      path.join(dir, 'config', 'fehler.yaml'),
      path.join(dir, 'products'),
    ])
    expect(code).toBe(1)
    expect(out).toMatch(/FEHLER\s+items\[0\]\.products\[0\]\.id/)
  })

  it('CLI: Exit 1 bei fehlender Rezeptdatei, JSON-Ausgabe', () => {
    const { code, out } = runCli([
      path.join(dir, 'config', 'rezept.yaml'),
      '--json',
    ])
    expect(code).toBe(1)
    const json = JSON.parse(out)
    expect(json.ok).toBe(false)
    expect(json.errors.map((e) => e.path)).toContain('fillings[1].recipe')
  })

  it('CLI: Exit 1 bei YAML-Fehler, Exit 2 ohne Argument', () => {
    expect(runCli([path.join(dir, 'config', 'kaputt.yaml')]).code).toBe(1)
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    expect(cli.main([])).toBe(2)
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Backzettel v2 (Z10): Schema, offene Stammdaten, Normalisierung
// (docs/backzettel-v2.md §2, §3, R28). Nur erfundene Werte.
// ---------------------------------------------------------------------------

const ALL_PRODUCTS = [...PRODUCTS, ...PRODUCTS_V2]

function v2(mutate) {
  const cfg = configV2()
  if (mutate) mutate(cfg)
  return core.validateBackzettelConfig(cfg, { products: ALL_PRODUCTS })
}

function item(cfg, id) {
  return cfg.items.find((i) => i.id === id)
}

function dough(cfg, id) {
  return cfg.doughs.find((d) => d.id === id)
}

const errorPaths = (r) => r.errors.map((e) => e.path)
const warningPaths = (r) => r.warnings.map((w) => w.path)
const openPaths = (r) => r.open.map((o) => o.path)

/** Genau ein Fehler, an `path`. */
function expectOnlyError(r, path) {
  expect(errorPaths(r)).toEqual([path])
}

describe('Z10: v1-Dateien bleiben unverändert', () => {
  it.each(Object.keys(V1_CASES))(
    '%s: dieselben Fehler und Warnungen wie vor Z10',
    (name) => {
      const r = validate(V1_CASES[name]())
      expect({ ok: r.ok, errors: r.errors, warnings: r.warnings }).toEqual(
        V1_RECORDED[name]
      )
    }
  )

  it('die Aufnahme deckt jeden Fall ab', () => {
    expect(Object.keys(V1_RECORDED).sort()).toEqual(
      Object.keys(V1_CASES).sort()
    )
  })

  it('eine v1-Datei hat nichts offen und keine Teig-Warnungen fuer kg_per_liter/liter_rounding', () => {
    const r = validate(config())
    expect(r.open).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('nur ein ausdrueckliches null ist offen (filling_g je Sorte)', () => {
    const r = validate(V1_CASES['fuellung-variante-null']())
    expect(r.open.map((o) => [o.path, o.code])).toEqual([
      ['items[5].filling_g.nuss', 'filling_g_unknown'],
    ])
  })
})

describe('Z10: validateBackzettelConfig fuer v2', () => {
  it('nimmt configV2 ohne Fehler und Warnungen an und listet das Offene', () => {
    const r = v2()
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.open.map((o) => [o.path, o.code])).toEqual(OPEN_V2)
    for (const o of r.open) expect(o.message).toMatch(/offen/)
  })

  it('liefert open auch fuer eine Nicht-Konfiguration', () => {
    expect(core.validateBackzettelConfig(null).open).toEqual([])
  })

  describe('dough_days', () => {
    it('muss eine nicht-leere Teilmenge von days ohne Doppelte sein', () => {
      expectOnlyError(
        v2((c) => (c.dough_days = [])),
        'dough_days'
      )
      expectOnlyError(
        v2((c) => (c.dough_days = 'di-sa')),
        'dough_days'
      )
      expectOnlyError(
        v2((c) => (c.dough_days = [1, 2])),
        'dough_days[0]'
      )
      expectOnlyError(
        v2((c) => (c.dough_days = [2, 2])),
        'dough_days[1]'
      )
      expectOnlyError(
        v2((c) => (c.dough_days = [2, 8])),
        'dough_days[1]'
      )
    })

    it('fehlt es bei lead > 0, warnt der Validator (es gelten days)', () => {
      const r = v2((c) => delete c.dough_days)
      expect(r.errors).toEqual([])
      expect(warningPaths(r)).toEqual(['dough_days'])
      // ohne lead > 0 keine Warnung
      const r2 = v2((c) => {
        delete c.dough_days
        for (const it of c.items) delete it.lead
      })
      expect(warningPaths(r2)).toEqual([])
    })
  })

  describe('bruch_pieces', () => {
    it('null ist offen, fehlend eine Warnung, sonst positive ganze Zahl', () => {
      const r = v2((c) => (c.bruch_pieces = null))
      expect(r.errors).toEqual([])
      expect(openPaths(r)).toContain('bruch_pieces')
      expect(r.open.find((o) => o.path === 'bruch_pieces').code).toBe(
        'bruch_pieces_unknown'
      )
      const r2 = v2((c) => delete c.bruch_pieces)
      expect(r2.errors).toEqual([])
      expect(warningPaths(r2)).toEqual(['bruch_pieces'])
      for (const bad of [0, 2.5, '20', -1])
        expectOnlyError(
          v2((c) => (c.bruch_pieces = bad)),
          'bruch_pieces'
        )
    })

    it('ohne bruch_pieces keine Warnung, wenn jeder Bruch-Posten eigene pieces hat', () => {
      const r = v2((c) => {
        delete c.bruch_pieces
        for (const it of c.items) if (it.bruch) it.bruch.pieces = 20
      })
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
    })
  })

  describe('lead', () => {
    it('fehlend gilt 0, null und alles ausser 0..3 ist ein Fehler', () => {
      expect(v2((c) => delete item(c, 'test-doppel').lead).errors).toEqual([])
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').lead = null)),
        'items[5].lead'
      )
      for (const bad of [4, -1, 1.5, '1', true])
        expectOnlyError(
          v2((c) => (item(c, 'test-doppel').lead = bad)),
          'items[5].lead'
        )
      expect(v2((c) => (item(c, 'test-doppel').lead = 3)).errors).toEqual([])
      expect(v2((c) => (item(c, 'test-doppel').lead = 0)).errors).toEqual([])
    })

    it('eine Zuordnung braucht Backtage aus days oder default', () => {
      expectOnlyError(
        v2((c) => (item(c, 'test-flitweck').lead = { default: 1, 1: 2 })),
        'items[8].lead.1'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-flitweck').lead = { default: 1, montag: 2 })),
        'items[8].lead.montag'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-flitweck').lead = { default: 1, 6: 5 })),
        'items[8].lead.6'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-flitweck').lead = { default: null })),
        'items[8].lead.default'
      )
    })
  })

  describe('sizes', () => {
    it('nicht-leere Liste, nicht zusammen mit variants', () => {
      // ohne gueltige Groessen sind auch die Grundmengen je Groesse falsch
      for (const bad of [[], { g500: 600 }]) {
        const r = v2((c) => (item(c, 'test-holz').sizes = bad))
        expect(errorPaths(r)).toEqual([
          'items[1].sizes',
          'items[1].base.2',
          'items[1].base.6',
        ])
      }
      const r = v2((c) => (item(c, 'test-holz').variants = ['nuss']))
      expect(errorPaths(r)).toContain('items[1].sizes')
    })

    it('IDs sind Slugs mit Buchstaben vorn, eindeutig, mit label', () => {
      const r = v2((c) =>
        item(c, 'test-korn').sizes.push({
          id: 'g500',
          label: 'doppelt',
          dough_g: 600,
        })
      )
      expectOnlyError(r, 'items[0].sizes[3].id')
      expect(
        errorPaths(
          v2((c) => {
            const korn = item(c, 'test-korn')
            korn.sizes[0].id = '500'
          })
        )
      ).toContain('items[0].sizes[0].id')
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').sizes[1].label = '  ')),
        'items[0].sizes[1].label'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').sizes[1].label = 1)),
        'items[0].sizes[1].label'
      )
      // `{ id: g1000, label: 1,5 kg }` ohne Anführungszeichen: YAML liest
      // `label: 1` und einen Schlüssel „5 kg“ - die Meldung nennt die Ursache.
      const yaml = require('js-yaml')
      const comma = yaml.load('{ id: g1000, label: 1,5 kg, dough_g: 100 }')
      expect(comma).toMatchObject({ label: 1, '5 kg': null })
      const r2 = v2((c) => (item(c, 'test-korn').sizes[1] = comma))
      expect(errorPaths(r2)).toEqual(['items[0].sizes[1].label'])
      expect(r2.errors[0].message).toContain('Anführungszeichen')
      expect(warningPaths(r2)).toContain('items[0].sizes[1].5 kg')
      expect(core.isSizeId('g500')).toBe(true)
      expect(core.isSizeId('500')).toBe(false)
      expect(core.isSizeId('Kasten')).toBe(false)
    })

    it('dough_g: null offen, fehlend Warnung, ≤ 0 oder Text Fehler', () => {
      const missing = v2((c) => delete item(c, 'test-korn').sizes[0].dough_g)
      expect(missing.errors).toEqual([])
      expect(warningPaths(missing)).toEqual(['items[0].sizes[0].dough_g'])
      expect(openPaths(v2())).toContain('items[0].sizes[2].dough_g')
      for (const bad of [0, -600, '600'])
        expectOnlyError(
          v2((c) => (item(c, 'test-korn').sizes[0].dough_g = bad)),
          'items[0].sizes[0].dough_g'
        )
    })

    it('Grundmengen stehen je Groesse; eine blosse Zahl oder fremde Groesse ist ein Fehler', () => {
      const r = v2((c) => (item(c, 'test-korn').base[3] = 4))
      expectOnlyError(r, 'items[0].base.3')
      expect(r.errors[0].message).toMatch(/je Größe, z\. B\. \{ g500: 4 \}/)
      const r2 = v2((c) => (item(c, 'test-korn').base[3] = { g750: 2 }))
      expectOnlyError(r2, 'items[0].base.3.g750')
      expect(r2.errors[0].message).toBe('Größe „g750“ steht nicht in sizes.')
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').base[3] = { g500: 1.5 })),
        'items[0].base.3.g500'
      )
    })
  })

  describe('sizes[].plu (Median je Größe, §9 Punkt 10)', () => {
    // Synthetische Kassennummern; Testkorn bekommt plu [971, 972, 973].
    const withPlu = (sizePlu) =>
      v2((c) => {
        const korn = item(c, 'test-korn')
        korn.plu = [971, 972, 973]
        sizePlu(korn.sizes)
      })

    it('fehlt: keine Meldung; null: offen; Liste aus plu des Postens: gültig', () => {
      expect(withPlu(() => undefined).errors).toEqual([])
      const r = withPlu((s) => {
        s[0].plu = [971]
        s[1].plu = [972, 973]
        s[2].plu = null
      })
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual(v2().warnings)
      expect(openPaths(r)).toContain('items[0].sizes[2].plu')
      expect(r.open.find((o) => o.path === 'items[0].sizes[2].plu').code).toBe(
        'size_plu_unknown'
      )
      const korn = core
        .normalizeConfig(
          (() => {
            const c = configV2()
            const k = item(c, 'test-korn')
            k.plu = [971, 972, 973]
            k.sizes[0].plu = [971]
            return c
          })()
        )
        .items.find((i) => i.id === 'test-korn')
      expect(korn.sizes.map((s) => s.plu)).toEqual([[971], null, null])
    })

    it('eine Kassennummer gehört zu genau einer Größe', () => {
      const r = withPlu((s) => {
        s[0].plu = [971]
        s[1].plu = [971]
      })
      expectOnlyError(r, 'items[0].sizes[1].plu[0]')
      expect(r.errors[0].message).toContain('schon Größe „g500“')
      expectOnlyError(
        withPlu((s) => (s[0].plu = [971, 971])),
        'items[0].sizes[0].plu[1]'
      )
    })

    it('muss in plu des Postens stehen, sonst Fehler', () => {
      const r = withPlu((s) => (s[0].plu = [979]))
      expectOnlyError(r, 'items[0].sizes[0].plu[0]')
      expect(r.errors[0].message).toContain('nicht in plu des Postens')
      // Posten ganz ohne plu: jede Kassennummer einer Größe ist ein Fehler
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').sizes[0].plu = [971])),
        'items[0].sizes[0].plu[0]'
      )
    })

    it('leer, kein Array oder keine positive ganze Zahl: Fehler', () => {
      for (const bad of [[], 971, '971'])
        expectOnlyError(
          withPlu((s) => (s[0].plu = bad)),
          'items[0].sizes[0].plu'
        )
      for (const bad of [0, -1, 1.5, '971'])
        expectOnlyError(
          withPlu((s) => (s[0].plu = [bad])),
          'items[0].sizes[0].plu[0]'
        )
    })
  })

  describe('products[].size', () => {
    it('ist bei Groessen Pflicht und muss eine Groesse des Postens sein', () => {
      expectOnlyError(
        v2((c) => delete item(c, 'test-korn').products[0].size),
        'items[0].products[0].size'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').products[0].size = null)),
        'items[0].products[0].size'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').products[0].size = 'g750')),
        'items[0].products[0].size'
      )
    })

    it('ist ohne Groessen verboten', () => {
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').products[0].size = 'g500')),
        'items[5].products[0].size'
      )
      expect(
        v2((c) => (item(c, 'test-doppel').products[0].size = null)).errors
      ).toEqual([])
    })
  })

  describe('dough', () => {
    it('id: null offen, fehlend Warnung, unbekannt Fehler', () => {
      const r = v2((c) => (item(c, 'test-doppel').dough.id = null))
      expect(r.errors).toEqual([])
      expect(r.open.find((o) => o.path === 'items[5].dough.id').code).toBe(
        'dough_unknown'
      )
      const r2 = v2((c) => delete item(c, 'test-doppel').dough.id)
      expect(r2.errors).toEqual([])
      expect(warningPaths(r2)).toEqual(['items[5].dough.id'])
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').dough.id = 'gibt-es-nicht')),
        'items[5].dough.id'
      )
    })

    it('piece_g: null offen, fehlend oder ≤ 0 Fehler, bei sizes/bruch verboten', () => {
      const r = v2((c) => (item(c, 'test-flit-klein').dough.piece_g = null))
      expect(r.errors).toEqual([])
      expect(r.open.find((o) => o.path === 'items[9].dough.piece_g').code).toBe(
        'piece_g_unknown'
      )
      expectOnlyError(
        v2((c) => delete item(c, 'test-flit-klein').dough.piece_g),
        'items[9].dough.piece_g'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-flit-klein').dough.piece_g = 0)),
        'items[9].dough.piece_g'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-korn').dough.piece_g = 600)),
        'items[0].dough.piece_g'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').dough.piece_g = null)),
        'items[5].dough.piece_g'
      )
    })

    it('pieces: null offen, fehlend 1, sonst positive ganze Zahl', () => {
      expect(openPaths(v2())).toContain('items[10].dough.pieces')
      expect(
        v2((c) => delete item(c, 'test-party').dough.pieces).errors
      ).toEqual([])
      expectOnlyError(
        v2((c) => (item(c, 'test-party').dough.pieces = 1.5)),
        'items[10].dough.pieces'
      )
    })

    it('kein Objekt ist ein Fehler', () => {
      expectOnlyError(
        v2((c) => (item(c, 'test-flit-klein').dough = 'test-flit-teig')),
        'items[9].dough'
      )
    })
  })

  describe('bruch', () => {
    it('muss ein Objekt sein, nicht mit sizes, nicht ohne dough', () => {
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').bruch = 1200)),
        'items[5].bruch'
      )
      const r = v2((c) => (item(c, 'test-korn').bruch = { g: 1200 }))
      expect(errorPaths(r)).toContain('items[0].bruch')
      expectOnlyError(
        v2((c) => delete item(c, 'test-doppel').dough),
        'items[5].bruch'
      )
    })

    it('g: null offen, fehlend Warnung, ≤ 0 Fehler', () => {
      const r = v2((c) => (item(c, 'test-doppel').bruch.g = null))
      expect(r.errors).toEqual([])
      expect(r.open.find((o) => o.path === 'items[5].bruch.g').code).toBe(
        'bruch_g_unknown'
      )
      const r2 = v2((c) => delete item(c, 'test-doppel').bruch.g)
      expect(r2.errors).toEqual([])
      expect(warningPaths(r2)).toEqual(['items[5].bruch.g'])
      for (const bad of [0, -5, '1200'])
        expectOnlyError(
          v2((c) => (item(c, 'test-doppel').bruch.g = bad)),
          'items[5].bruch.g'
        )
    })

    it('g je Backtag: Wochentage aus days oder default, Werte > 0 oder null', () => {
      expectOnlyError(
        v2(
          (c) => (item(c, 'test-flitweck').bruch.g = { 1: 1000, default: null })
        ),
        'items[8].bruch.g.1'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-flitweck').bruch.g = { 7: 0, default: null })),
        'items[8].bruch.g.7'
      )
      const r = v2(
        (c) => (item(c, 'test-flitweck').bruch.g = { 7: 1000, 2: null })
      )
      expect(r.errors).toEqual([])
      expect(warningPaths(r)).toEqual(['items[8].bruch.g.default'])
      expect(openPaths(r)).toContain('items[8].bruch.g.2')
      expect(r.open.find((o) => o.path === 'items[8].bruch.g.2').message).toBe(
        'Posten „test-flitweck“: Bruchgewicht am Dienstag ist noch offen.'
      )
    })

    it('per_product: fehlend 1, null oder keine positive ganze Zahl Fehler', () => {
      expect(
        v2((c) => delete item(c, 'test-doppel').bruch.per_product).errors
      ).toEqual([])
      for (const bad of [null, 0, 1.5])
        expectOnlyError(
          v2((c) => (item(c, 'test-doppel').bruch.per_product = bad)),
          'items[5].bruch.per_product'
        )
    })

    it('pieces: null offen, sonst positive ganze Zahl', () => {
      const r = v2((c) => (item(c, 'test-doppel').bruch.pieces = null))
      expect(r.errors).toEqual([])
      expect(r.open.find((o) => o.path === 'items[5].bruch.pieces').code).toBe(
        'bruch_pieces_unknown'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').bruch.pieces = 0)),
        'items[5].bruch.pieces'
      )
    })

    it('group: Slug; Mitglieder brauchen gleichen Teig, Gewicht, Stück je Bruch, lead und Abschnitt', () => {
      expectOnlyError(
        v2((c) => (item(c, 'test-stern').bruch.group = 'Gemischt')),
        // ohne gueltige Gruppe ist Teststern seine eigene Gruppe
        'items[6].bruch.group'
      )
      const cases = [
        [(k) => (k.dough.id = 'test-flit-teig'), /Teig/],
        [(k) => (k.bruch.g = 1900), /Bruchgewicht/],
        [(k) => (k.bruch.pieces = 10), /Stück je Bruch/],
        [(k) => (k.lead = 2), /lead/],
        [(k) => (k.section = 'brot'), /Abschnitt/],
      ]
      for (const [mutate, re] of cases) {
        const r = v2((c) => mutate(item(c, 'test-kaese')))
        expectOnlyError(r, 'items[7].bruch.group')
        expect(r.errors[0].message).toMatch(re)
        expect(r.errors[0].message).toMatch(/„test-gemischt“ mit „test-stern“/)
      }
      // lead 1 und { default: 1 } sind dasselbe
      expect(
        v2((c) => (item(c, 'test-kaese').lead = { default: 1 })).errors
      ).toEqual([])
    })

    it('ein eigenes pieces, das dem bruch_pieces der Datei gleicht, passt zur Gruppe', () => {
      expect(
        v2((c) => (item(c, 'test-kaese').bruch.pieces = 20)).errors
      ).toEqual([])
    })
    it('addons (Zugabe je Bruch, U3): { name, g }, g null offen, fehlend Warnung, ≤ 0 Fehler', () => {
      const ok = v2(
        (c) =>
          (item(c, 'test-doppel').bruch.addons = [
            { name: 'Testkörner', g: 300 },
          ])
      )
      expect(ok.errors).toEqual([])
      expect(ok.warnings).toEqual([])
      const open = v2(
        (c) =>
          (item(c, 'test-doppel').bruch.addons = [
            { name: 'Testkörner', g: null },
          ])
      )
      expect(open.errors).toEqual([])
      expect(
        open.open.find((o) => o.path === 'items[5].bruch.addons[0].g')
      ).toMatchObject({
        code: 'bruch_addon_g_unknown',
        message:
          'Posten „test-doppel“: Gramm „Testkörner“ je Bruch sind noch offen.',
      })
      const missing = v2(
        (c) => (item(c, 'test-doppel').bruch.addons = [{ name: 'Testkörner' }])
      )
      expect(missing.errors).toEqual([])
      expect(warningPaths(missing)).toEqual(['items[5].bruch.addons[0].g'])
      for (const bad of [0, -1, '300'])
        expectOnlyError(
          v2(
            (c) =>
              (item(c, 'test-doppel').bruch.addons = [
                { name: 'Testkörner', g: bad },
              ])
          ),
          'items[5].bruch.addons[0].g'
        )
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').bruch.addons = { g: 300 })),
        'items[5].bruch.addons'
      )
      expectOnlyError(
        v2((c) => (item(c, 'test-doppel').bruch.addons = [{ g: 300 }])),
        'items[5].bruch.addons[0].name'
      )
      expectOnlyError(
        v2(
          (c) =>
            (item(c, 'test-doppel').bruch.addons = [
              { name: 'Testkörner', g: 300 },
              { name: 'Testkörner', g: 100 },
            ])
        ),
        'items[5].bruch.addons[1].name'
      )
    })

    it('addons: Mitglieder einer Gruppe brauchen dieselben Zugaben je Bruch', () => {
      const r = v2(
        (c) =>
          (item(c, 'test-kaese').bruch.addons = [
            { name: 'Testkörner', g: 300 },
          ])
      )
      expectOnlyError(r, 'items[7].bruch.group')
      expect(r.errors[0].message).toMatch(/Zugaben je Bruch/)
      expect(
        v2((c) => {
          item(c, 'test-stern').bruch.addons = [{ name: 'Testkörner', g: 300 }]
          item(c, 'test-kaese').bruch.addons = [{ name: 'Testkörner', g: 300 }]
        }).errors
      ).toEqual([])
    })
  })

  describe('from_dough', () => {
    const kerb = (c) => item(c, 'test-kerb')

    it('braucht sizes und einen bekannten Teig', () => {
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.id = 'gibt-es-nicht')),
        'items[3].from_dough.id'
      )
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.id = null)),
        'items[3].from_dough.id'
      )
      const r = v2(
        (c) =>
          (item(c, 'test-doppel').from_dough = {
            id: 'test-misch-teig',
            mode: 'fixed',
            dough_kg: 5,
          })
      )
      expectOnlyError(r, 'items[5].from_dough')
      expectOnlyError(
        v2((c) => (kerb(c).from_dough = 'test-misch-teig')),
        'items[3].from_dough'
      )
    })

    it('mode: null offen, fehlend Warnung, anderer Text Fehler', () => {
      const r = v2((c) => (kerb(c).from_dough.mode = null))
      expect(r.errors).toEqual([])
      expect(
        r.open.find((o) => o.path === 'items[3].from_dough.mode').code
      ).toBe('from_dough_mode_unknown')
      const r2 = v2((c) => delete kerb(c).from_dough.mode)
      expect(warningPaths(r2)).toEqual(['items[3].from_dough.mode'])
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.mode = 'je-laib')),
        'items[3].from_dough.mode'
      )
      expect(v2((c) => (kerb(c).from_dough.mode = 'per_dough')).errors).toEqual(
        []
      )
    })

    it('dough_kg und extras[].kg: null offen, fehlend Warnung, ≤ 0 Fehler', () => {
      const r = v2((c) => {
        kerb(c).from_dough.dough_kg = null
        kerb(c).from_dough.extras[0].kg = null
      })
      expect(r.errors).toEqual([])
      expect(
        r.open
          .filter((o) => o.path.startsWith('items[3]'))
          .map((o) => [o.path, o.code])
      ).toEqual([
        ['items[3].from_dough.dough_kg', 'from_dough_kg_unknown'],
        ['items[3].from_dough.extras[0].kg', 'extra_kg_unknown'],
      ])
      const r2 = v2((c) => {
        delete kerb(c).from_dough.dough_kg
        delete kerb(c).from_dough.extras[0].kg
      })
      expect(warningPaths(r2)).toEqual([
        'items[3].from_dough.dough_kg',
        'items[3].from_dough.extras[0].kg',
      ])
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.dough_kg = 0)),
        'items[3].from_dough.dough_kg'
      )
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.extras[0].kg = -1)),
        'items[3].from_dough.extras[0].kg'
      )
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.extras = { name: 'Körner' })),
        'items[3].from_dough.extras'
      )
      expectOnlyError(
        v2((c) => (kerb(c).from_dough.extras[0].name = '')),
        'items[3].from_dough.extras[0].name'
      )
    })
  })

  describe('filling_g (null = gefuellt, Gramm unbekannt)', () => {
    it('ist offen und verlangt weiter die Grundmenge je Sorte', () => {
      const r = v2((c) => (item(c, 'test-zopf').base = { 6: 5 }))
      expectOnlyError(r, 'items[12].base.6')
      expect(r.errors[0].message).toMatch(/je Variante/)
      expect(openPaths(r)).toContain('items[12].filling_g')
    })

    it('braucht auch mit null Sorten (variants)', () => {
      const r = v2((c) => (item(c, 'test-kranz').filling_g = null))
      expect(errorPaths(r)).toContain('items[13].filling_g')
    })
  })

  describe('doughs', () => {
    it('kg_per_liter: null offen, fehlend Warnung (nur in v2-Dateien), ≤ 0 Fehler', () => {
      const r = v2((c) => delete dough(c, 'test-hefe').kg_per_liter)
      expect(r.errors).toEqual([])
      expect(warningPaths(r)).toEqual(['doughs[5].kg_per_liter'])
      for (const bad of [0, -2, '2'])
        expectOnlyError(
          v2((c) => (dough(c, 'test-hefe').kg_per_liter = bad)),
          'doughs[5].kg_per_liter'
        )
      // eine v1-Datei mit kg_per_liter an einem Teig ist eine v2-Datei
      const cfg = config()
      cfg.doughs[0].kg_per_liter = 5
      const r2 = validate(cfg)
      expect(warningPaths(r2)).toEqual(['doughs[0].liter_rounding'])
    })

    it('liter_rounding: null offen, fehlend Warnung am Kopf, unvollständig Fehler', () => {
      expect(openPaths(v2())).toContain('doughs[4].liter_rounding')
      const r = v2((c) => delete dough(c, 'test-hefe').liter_rounding)
      expect(warningPaths(r)).toEqual(['doughs[5].liter_rounding'])
      // Mitglied einer Gruppe: keine Warnung (rundet nach dem Kopf)
      expect(v2().warnings).toEqual([])
      expectOnlyError(
        v2(
          (c) =>
            (dough(c, 'test-hefe').liter_rounding = { step: 0, mode: 'up' })
        ),
        'doughs[5].liter_rounding.step'
      )
      expectOnlyError(
        v2(
          (c) =>
            (dough(c, 'test-hefe').liter_rounding = { step: 1, mode: 'auf' })
        ),
        'doughs[5].liter_rounding.mode'
      )
      expectOnlyError(
        v2((c) => (dough(c, 'test-hefe').liter_rounding = { step: 1 })),
        'doughs[5].liter_rounding.mode'
      )
      expectOnlyError(
        v2((c) => (dough(c, 'test-hefe').liter_rounding = 'up')),
        'doughs[5].liter_rounding'
      )
      for (const mode of core.ROUNDING_MODES)
        expect(
          v2((c) => (dough(c, 'test-hefe').liter_rounding = { step: 1, mode }))
            .errors
        ).toEqual([])
    })

    it('combined_with: bekannter anderer Teig, keine Kette; eigene Rundung wird ignoriert', () => {
      expectOnlyError(
        v2((c) => (dough(c, 'test-holz-teig').combined_with = 'gibt-es-nicht')),
        'doughs[1].combined_with'
      )
      expectOnlyError(
        v2(
          (c) => (dough(c, 'test-holz-teig').combined_with = 'test-holz-teig')
        ),
        'doughs[1].combined_with'
      )
      expectOnlyError(
        v2(
          (c) => (dough(c, 'test-misch-teig').combined_with = 'test-holz-teig')
        ),
        'doughs[2].combined_with'
      )
      const r = v2(
        (c) =>
          (dough(c, 'test-holz-teig').liter_rounding = { step: 1, mode: 'up' })
      )
      expect(r.errors).toEqual([])
      expect(warningPaths(r)).toEqual(['doughs[1].liter_rounding'])
      const r2 = v2((c) => (dough(c, 'test-holz-teig').combined_name = 'X'))
      expect(warningPaths(r2)).toEqual(['doughs[1].combined_name'])
      expectOnlyError(
        v2((c) => (dough(c, 'test-korn-teig').combined_name = 3)),
        'doughs[0].combined_name'
      )
    })

    it('addons: eindeutige IDs, g_per_liter > 0 oder null, Rundung oder null', () => {
      const add = (c) => dough(c, 'test-holz-teig').addons
      expectOnlyError(
        v2((c) => add(c).push({ ...add(c)[0] })),
        'doughs[1].addons[1].id'
      )
      expectOnlyError(
        v2((c) => (add(c)[0].g_per_liter = 0)),
        'doughs[1].addons[0].g_per_liter'
      )
      const r = v2((c) => {
        add(c)[0].g_per_liter = null
        add(c)[0].rounding = null
      })
      expect(r.errors).toEqual([])
      expect(
        r.open
          .filter((o) => o.path.startsWith('doughs[1].addons'))
          .map((o) => o.code)
      ).toEqual(['addon_unknown', 'addon_rounding_unknown'])
      const r2 = v2((c) => {
        delete add(c)[0].g_per_liter
        delete add(c)[0].rounding
      })
      expect(warningPaths(r2)).toEqual([
        'doughs[1].addons[0].g_per_liter',
        'doughs[1].addons[0].rounding',
      ])
      expectOnlyError(
        v2((c) => (add(c)[0].rounding = { step: 5, mode: 'rund' })),
        'doughs[1].addons[0].rounding.mode'
      )
      expectOnlyError(
        v2((c) => (dough(c, 'test-holz-teig').addons = { id: 'x' })),
        'doughs[1].addons'
      )
    })

    it('batch_max_kg: null offen, fehlend Warnung', () => {
      const r = v2((c) => delete dough(c, 'test-weck-teig').batch_max_kg)
      expect(warningPaths(r)).toEqual(['doughs[3].batch_max_kg'])
    })
  })

  it('warnt bei unbekannten Schluesseln in sizes, bruch, from_dough und addons', () => {
    const r = v2((c) => {
      item(c, 'test-korn').sizes[0].gewicht = 1
      item(c, 'test-doppel').bruch.gramm = 1
      item(c, 'test-kerb').from_dough.modus = 'fixed'
      dough(c, 'test-holz-teig').addons[0].menge = 1
    })
    expect(r.errors).toEqual([])
    expect(warningPaths(r)).toEqual([
      'doughs[1].addons[0].menge',
      'items[0].sizes[0].gewicht',
      'items[3].from_dough.modus',
      'items[5].bruch.gramm',
    ])
  })
})

describe('Z10: normalizeConfig fuer v2', () => {
  const n = () => core.normalizeConfig(configV2())

  it('macht Groessen zu Varianten (variantKind size) und Produkte mit size', () => {
    const korn = n().items.find((i) => i.id === 'test-korn')
    expect(korn.variants).toEqual(['g500', 'g1000', 'kasten'])
    expect(korn.variantKind).toBe('size')
    expect(korn.sizes).toEqual([
      { id: 'g500', label: '500 g', dough_g: 600, plu: null },
      { id: 'g1000', label: '1 kg', dough_g: 1000, plu: null },
      { id: 'kasten', label: 'Kasten', dough_g: null, plu: null },
    ])
    expect(korn.products).toEqual([
      { id: 'test-korn-500', factor: 1, size: 'g500' },
      { id: 'test-korn-1000', factor: 1, size: 'g1000' },
    ])
    expect(korn.dough).toEqual({
      id: 'test-korn-teig',
      piece_g: null,
      pieces: 1,
    })
    expect(korn.base[2]).toEqual({ g500: 4, g1000: 2, kasten: null })
    expect(korn.lead).toEqual({ default: 0 })
    expect(korn.bruch).toBeNull()
    expect(korn.from_dough).toBeNull()
  })

  it('normalisiert lead, bruch und Bruchgewicht je Backtag', () => {
    const items = n().items
    const doppel = items.find((i) => i.id === 'test-doppel')
    expect(doppel.lead).toEqual({ default: 1 })
    expect(doppel.variantKind).toBeNull()
    expect(doppel.bruch).toEqual({
      g: { default: 1200 },
      per_product: 2,
      group: 'test-doppel',
      piecesPerBruch: 20,
      addons: [],
    })
    expect(items.find((i) => i.id === 'test-stern').bruch.group).toBe(
      'test-gemischt'
    )
    const flit = items.find((i) => i.id === 'test-flitweck')
    expect(flit.lead).toEqual({ default: 1, 6: 2 })
    expect(flit.bruch.g).toEqual({ 2: 1200, 7: 1000, default: null })
    expect(flit.bruch.per_product).toBe(1)
    expect(items.find((i) => i.id === 'test-party').dough).toEqual({
      id: 'test-flit-teig',
      piece_g: 250,
      pieces: null,
    })
  })

  it('bruch.addons: { name, g }, offen bleibt null; idempotent', () => {
    const cfg = configV2()
    item(cfg, 'test-doppel').bruch.addons = [
      { name: 'Testkörner', g: 300 },
      { name: 'Testflocken', g: null },
    ]
    const out = core.normalizeConfig(cfg)
    const doppel = out.items.find((i) => i.id === 'test-doppel')
    expect(doppel.bruch.addons).toEqual([
      { name: 'Testkörner', g: 300 },
      { name: 'Testflocken', g: null },
    ])
    expect(core.normalizeConfig(out)).toEqual(out)
  })

  it('bruch.pieces: eigener Wert vor bruch_pieces, null bleibt unbekannt', () => {
    const cfg = configV2()
    item(cfg, 'test-doppel').bruch.pieces = 10
    item(cfg, 'test-stern').bruch.pieces = null
    cfg.items = cfg.items.filter((i) => i.id !== 'test-kaese')
    const out = core.normalizeConfig(cfg)
    expect(
      out.items.find((i) => i.id === 'test-doppel').bruch.piecesPerBruch
    ).toBe(10)
    expect(
      out.items.find((i) => i.id === 'test-stern').bruch.piecesPerBruch
    ).toBeNull()
    const noTop = core.normalizeConfig(configV2({ bruch_pieces: null }))
    expect(noTop.bruch_pieces).toBeNull()
    expect(
      noTop.items.find((i) => i.id === 'test-doppel').bruch.piecesPerBruch
    ).toBeNull()
  })

  it('setzt kein Bruchgewicht ein, wenn es fehlt', () => {
    const cfg = configV2()
    delete item(cfg, 'test-doppel').bruch.g
    expect(
      core.normalizeConfig(cfg).items.find((i) => i.id === 'test-doppel').bruch
        .g
    ).toEqual({ default: null })
  })

  it('from_dough und Teigfelder bleiben, wie sie sind; offene Werte null', () => {
    const out = n()
    expect(out.items.find((i) => i.id === 'test-kerb').from_dough).toEqual({
      id: 'test-misch-teig',
      mode: 'fixed',
      dough_kg: 5,
      extras: [{ name: 'Körner', kg: 1 }],
    })
    expect(out.doughs.find((d) => d.id === 'test-holz-teig')).toEqual({
      id: 'test-holz-teig',
      name: 'Testholz',
      batch_max_kg: null,
      kg_per_liter: 2,
      liter_rounding: null,
      combined_with: 'test-korn-teig',
      combined_name: null,
      addons: [
        {
          id: 'test-sauer',
          name: 'Testsauer',
          g_per_liter: 10,
          rounding: { step: 5, mode: 'nearest' },
        },
      ],
    })
    expect(out.doughs.find((d) => d.id === 'test-flit-teig')).toMatchObject({
      kg_per_liter: null,
      liter_rounding: null,
      batch_max_kg: null,
    })
    expect(
      out.doughs.find((d) => d.id === 'test-korn-teig').combined_name
    ).toBe('Korn + Holz')
    expect(out.dough_days).toEqual([2, 3, 4, 5, 6])
    expect(out.bruch_pieces).toBe(20)
  })

  it('filling_g: null heisst gefuellt mit unbekannten Gramm, ohne Schluessel nicht gefuellt', () => {
    const out = n()
    const zopf = out.items.find((i) => i.id === 'test-zopf')
    expect(zopf.filling_g).toEqual({ nuss: null, mohn: null })
    expect(zopf.variantKind).toBe('filling')
    const kranz = out.items.find((i) => i.id === 'test-kranz')
    expect(kranz.filling_g).toBeNull()
    expect(kranz.variantKind).toBeNull()
  })

  it('ist idempotent, auch nach einem JSON-Umweg (gefuellt bleibt gefuellt, ungefuellt ungefuellt)', () => {
    for (const cfg of [configV2(), config()]) {
      const once = core.normalizeConfig(cfg)
      expect(core.normalizeConfig(once)).toEqual(once)
      const viaJson = JSON.parse(JSON.stringify(once))
      expect(core.normalizeConfig(viaJson)).toEqual(once)
    }
  })

  it('v1: neue Felder mit neutralen Werten, Teigtage = days', () => {
    const out = core.normalizeConfig(config())
    expect(out.dough_days).toEqual([2, 3, 4, 5, 6, 7])
    expect(out.bruch_pieces).toBeNull()
    const zopf = out.items.find((i) => i.id === 'zopf-gefuellt')
    expect(zopf).toMatchObject({
      variantKind: 'filling',
      sizes: [],
      lead: { default: 0 },
      bruch: null,
      from_dough: null,
      filling_g: { nuss: 400, mohn: 400 },
    })
    expect(out.items.find((i) => i.id === 'weck').products).toEqual([
      { id: 'test-weck', factor: 1, size: null },
    ])
    expect(out.doughs[0]).toEqual({
      id: 'hefeteig-test',
      name: 'Hefeteig (Test)',
      batch_max_kg: 10,
      kg_per_liter: null,
      liter_rounding: null,
      combined_with: null,
      combined_name: null,
      addons: [],
    })
  })
})

describe('Z10: variantDisplayName', () => {
  const cfg = core.normalizeConfig(configV2())
  const korn = cfg.items.find((i) => i.id === 'test-korn')
  const zopf = cfg.items.find((i) => i.id === 'test-zopf')

  it('Groesse → Label, Fuellung → Name, sonst ID mit grossem Anfangsbuchstaben', () => {
    expect(core.variantDisplayName(cfg, korn, 'g500')).toBe('500 g')
    expect(core.variantDisplayName(cfg, korn, 'kasten')).toBe('Kasten')
    expect(core.variantDisplayName(cfg, zopf, 'nuss')).toBe('Nussfüllung')
    expect(core.variantDisplayName(cfg, zopf, 'marzipan')).toBe('Marzipan')
    expect(core.variantDisplayName(null, null, 'nuss')).toBe('Nuss')
  })

  it('keine Variante → null', () => {
    expect(core.variantDisplayName(cfg, korn, null)).toBeNull()
    expect(core.variantDisplayName(cfg, korn, '')).toBeNull()
    expect(core.variantDisplayName(cfg, korn, undefined)).toBeNull()
  })
})

describe('Z10: Loader und CLI', () => {
  let dir
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backzettel-v2-'))
    fs.mkdirSync(path.join(dir, 'config'))
    fs.mkdirSync(path.join(dir, 'products'))
    fs.mkdirSync(path.join(dir, 'data', 'recipes', 'fillings'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(dir, 'data', 'recipes', 'fillings', 'test.md'),
      RECIPE_MD
    )
    for (const p of ALL_PRODUCTS) {
      fs.writeFileSync(
        path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
        `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test\n---\n\nText\n`
      )
    }
    // JSON ist gueltiges YAML
    fs.writeFileSync(
      path.join(dir, 'config', 'v2.yaml'),
      JSON.stringify(configV2(), null, 2)
    )
    const noRecipe = configV2()
    delete noRecipe.fillings[1].recipe
    fs.writeFileSync(
      path.join(dir, 'config', 'ohne-rezept.yaml'),
      JSON.stringify(noRecipe, null, 2)
    )
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  function runCli(args) {
    const out = []
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s))
      return true
    })
    try {
      return { code: cli.main(args), out: out.join('') }
    } finally {
      spy.mockRestore()
    }
  }

  it('Loader liefert open und die normalisierte v2-Konfiguration', () => {
    const r = loader.loadBackzettelConfig(path.join(dir, 'config', 'v2.yaml'), {
      productsDir: path.join(dir, 'products'),
    })
    expect(r.errors).toEqual([])
    expect(r.open.map((o) => [o.path, o.code])).toEqual(OPEN_V2)
    expect(r.config.items.find((i) => i.id === 'test-korn').variantKind).toBe(
      'size'
    )
    expect(
      loader.loadBackzettelConfig(path.join(dir, 'config', 'nein.yaml')).open
    ).toEqual([])
  })

  it('CLI: druckt „Offen (n)“ und zählt sie in der Zusammenfassung', () => {
    const { code, out } = runCli([path.join(dir, 'config', 'v2.yaml')])
    expect(code).toBe(0)
    expect(out).toContain(`Offen (${OPEN_V2.length}):\n`)
    expect(out).toMatch(
      /Offen {4}items\[0\]\.sizes\[2\]\.dough_g: Posten „test-korn“, Größe „kasten“: Teig je Laib ist noch offen\./
    )
    expect(out).toMatch(
      new RegExp(
        `ist gültig \\(14 Posten, ${ALL_PRODUCTS.length} Produkte geprüft, 0 Warnungen, ${OPEN_V2.length} offen\\)`
      )
    )
    const json = JSON.parse(
      runCli([path.join(dir, 'config', 'v2.yaml'), '--json']).out
    )
    expect(json.ok).toBe(true)
    expect(json.open.map((o) => o.path)).toEqual(OPEN_V2.map(([p]) => p))
  })

  it('CLI: eine Fuellung ohne recipe ist eine Warnung, kein Fehler', () => {
    const { code, out } = runCli([path.join(dir, 'config', 'ohne-rezept.yaml')])
    expect(code).toBe(0)
    expect(out).toMatch(
      /Warnung {2}fillings\[1\]\.recipe: Für „Mohnfüllung“ ist kein Rezept hinterlegt\./
    )
  })
})
