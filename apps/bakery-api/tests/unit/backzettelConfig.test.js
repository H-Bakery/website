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
} = require('../fixtures/backzettel.synthetic')

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

  it('kennt nur die Einheiten Stück, Liter, Blech, kg', () => {
    expect(paths(validate(withItem({ unit: 'Laib' })))).toContain(
      'items[0].unit'
    )
    for (const unit of ['Stück', 'Liter', 'Blech', 'kg']) {
      const cfg = withItem({ unit, base: { 2: 4 } })
      expect(validate(cfg).errors).toEqual([])
    }
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
    const p = paths(validate(cfg))
    expect(p).toEqual(
      expect.arrayContaining([
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
    cfg.doughs[0].batch_max_kg = null
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
