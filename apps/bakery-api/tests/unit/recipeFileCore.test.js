/**
 * `recipe-file.core.js`: lesen, verlustfrei schreiben, prüfen. Erfundene
 * Rezepte aus `tools/e2e/hq-recipes` (je Formatvariante eine Datei) - und,
 * wo das private `hq` neben dem Repo liegt, zusätzlich der Beweis über
 * jede echte Datei (im CI übersprungen; dort gibt es `hq` nicht).
 */
const fs = require('fs')
const path = require('path')

const core = require('../../src/services/recipe-file.core')
const backzettelRecipes = require('../../src/services/backzettel-recipes.core')

const FIXTURES = path.resolve(__dirname, '../../../../tools/e2e/hq-recipes')

function filesOf(root) {
  const out = []
  for (const dir of fs.readdirSync(root).sort()) {
    const full = path.join(root, dir)
    if (!fs.statSync(full).isDirectory()) continue
    for (const file of fs.readdirSync(full).sort()) {
      if (!core.isRecipeFileName(file)) continue
      out.push({ category: dir, file, full: path.join(full, file) })
    }
  }
  return out
}

const read = (rel) => fs.readFileSync(path.join(FIXTURES, rel), 'utf8')
const parse = (rel) =>
  core.parseRecipeFile(read(rel), {
    fileStem: core.fileStem(path.basename(rel)),
  })
/** Was die Verwaltung zurückschickt: das Modell einmal durch JSON. */
const formOf = (doc) =>
  JSON.parse(JSON.stringify(core.recipeInputOf(doc.model)))
const lines = (text) => text.split('\n')
/** Zeilen, die nur in einer der beiden Fassungen stehen. */
function changedLines(before, after) {
  const a = lines(before)
  const b = lines(after)
  return {
    removed: a.filter((line) => !b.includes(line)),
    added: b.filter((line) => !a.includes(line)),
  }
}

const FIXTURE_FILES = filesOf(FIXTURES)

describe('Formate', () => {
  it('deckt jede Kategorie und jedes Format ab', () => {
    const seen = new Set(
      FIXTURE_FILES.map(
        (f) =>
          `${f.category}:${
            core.parseRecipeFile(fs.readFileSync(f.full, 'utf8')).format
          }`
      )
    )
    expect([...seen].sort()).toEqual([
      'baguettes:standard',
      'breads:standard',
      'cakes:table',
      'fillings:table',
      'rolls:standard',
      'snacks:standard',
      'special:table',
      'teige:teig',
    ])
  })

  it('Standardformat: Kopf, Gruppen, Mengen, Schritte, Notizen', () => {
    const doc = parse('breads/Musterkruste.md')
    expect(doc).toMatchObject({ format: 'standard', editable: true })
    const m = doc.model
    expect(m.title).toBe('Musterkruste')
    expect(m.yield).toBe('3 Laibe à 700g')
    expect(m.description).toMatch(/^Ein erfundenes Brot/)
    expect(m.parts.map((p) => p.title)).toEqual([
      'Testsauer (Vortag)',
      'Hauptteig',
      'Bestreuung',
    ])
    expect(m.parts[0].ingredients[0]).toEqual({
      name: 'Probemehl dunkel',
      amount: 135,
      unit: 'g',
      note: null,
    })
    // Dezimalkomma, Zeile ohne Menge, Stückzahl ohne Einheit, TL
    expect(m.parts[1].ingredients[5]).toMatchObject({ amount: 0.5, unit: 'g' })
    expect(m.parts[2].ingredients).toEqual([
      {
        name: 'Ei + 15g Testmilch (zum Abglänzen)',
        amount: 1,
        unit: null,
        note: null,
      },
      {
        name: 'Probewasser zum Benetzen',
        amount: null,
        unit: null,
        note: null,
      },
      { name: 'Testsaat', amount: 2, unit: 'TL', note: null },
    ])
    expect(m.steps.map((g) => [g.title, g.ordered, g.items.length])).toEqual([
      ['Vorbereitung (Vortag)', true, 2],
      ['Hauptzubereitung', true, 3],
      ['Formgebung', true, 3],
      ['Gärung', false, 2],
      ['Backen', true, 3],
    ])
    // Unterpunkte bleiben am Schritt
    expect(m.steps[2].items[1]).toBe(
      'Laibe formen:\n   - straff aufrollen\n   - Naht nach unten legen'
    )
    expect(m.steps[3].items[0]).toBe('**Stockgare:** 35 Minuten bei 25°C')
    expect(m.notes).toBe(
      '- **Haltbarkeit:** 5 Tage\n- **Lagerung:** Im Leinenbeutel\n- **Tipps:** Vor dem Anschneiden auskühlen lassen'
    )
    // Was das Modell nicht deutet, bleibt wörtlich zur Anzeige
    expect(m.sections.map((s) => s.title)).toEqual([
      'Qualitätskriterien',
      'Fehlerquellen',
    ])
    expect(m.meta).toEqual(
      expect.arrayContaining([
        { key: 'total_mass', label: 'Gesamtmasse (g)', value: '2100' },
        {
          key: 'equipment',
          label: 'Geräte',
          value: 'Testkneter, Probekörbchen',
        },
        { key: 'baking.steam', label: 'Schwaden', value: 'ja' },
        { key: 'tags', label: 'Schlagworte', value: 'Musterbrot, Testsauer' },
      ])
    )
  })

  it('Standardformat: Titel in Anführungszeichen, Tausenderpunkt, Prise', () => {
    const m = parse('breads/Probelaib.md').model
    expect(m.title).toBe('Probelaib: hell')
    expect(m.parts[0].ingredients[0]).toMatchObject({
      name: 'Probemehl hell',
      amount: 1350,
      unit: 'g',
    })
    expect(m.parts[0].ingredients[4]).toMatchObject({
      name: 'Musterzucker',
      amount: 1,
      unit: 'Prise',
    })
  })

  it('Tabellenformat: Ertrag aus der Überschrift, Einheiten, Hinweise', () => {
    const doc = parse('cakes/Testkuchen.md')
    expect(doc).toMatchObject({ format: 'table', editable: true })
    expect(doc.model.title).toBe('Testkuchen')
    expect(doc.model.yield).toBe('für 3 Bleche')
    expect(doc.model.parts).toHaveLength(1)
    expect(doc.model.parts[0].title).toBeNull()
    expect(doc.model.parts[0].ingredients).toEqual([
      { name: 'Probequark', amount: 1350, unit: 'g', note: null },
      { name: 'Ei(er)', amount: 520, unit: 'g', note: null },
      { name: 'Testsahne', amount: 310, unit: 'g', note: null },
      { name: 'Wasser', amount: 1450, unit: 'ml', note: null },
      { name: 'Mustertrieb*', amount: 95, unit: 'g', note: null },
      { name: 'Salz', amount: 1, unit: 'Prise', note: null },
    ])
  })

  it('Tabellenformat: was keine Zahl ist, bleibt Text - nie 0', () => {
    const m = parse('fillings/Testkompott.md').model
    expect(m.yield).toBeNull() // offen
    expect(m.parts[0].ingredients).toEqual([
      { name: 'Probeäpfel (Dose)', amount: 1, unit: 'Dose', note: 'ca. 4 kg' },
      { name: 'Musterbinder', amount: 120, unit: 'g', note: 'nach Bedarf' },
      { name: 'Zucker', amount: 260, unit: 'g', note: null },
      {
        name: 'Testsäure',
        amount: null,
        unit: null,
        note: '3–6 g (nach Geschmack)',
      },
    ])
  })

  it('Tabellenformat: mehrere Rezeptteile mit Emoji-Überschrift und Trennlinie', () => {
    const m = parse('fillings/Gefüllte-Testkränze.md').model
    expect(m.title).toBe('Testfüllungen für Kränze')
    expect(m.parts.map((p) => [p.title, p.ingredients.length])).toEqual([
      ['Testnussfüllung', 2],
      ['Probeschokofüllung', 3],
      ['Musterquarkfüllung', 3],
    ])
  })

  it('Tabellenformat ohne Dateiendung: Menge-Zeile, Spalteneinheit, Summenzeile, Stichpunkte', () => {
    const doc = parse('special/Probe-Dünnbrot')
    expect(doc).toMatchObject({ format: 'table', editable: true })
    const m = doc.model
    expect(m.yield).toBe('Ergibt ca. 16 Fladen à 110 g')
    expect(m.notes).toBe('- **Hinweis**: Vor dem Backen mit Testöl bestreichen')
    expect(m.parts[0].ingredients[1]).toEqual({
      name: 'Probemehl',
      amount: 1000,
      unit: 'g',
      note: null,
    })
    expect(m.parts[0].ingredients).toHaveLength(5)
    expect(m.parts[0].total).toEqual({ label: 'Gesamtmasse', text: '1.735 g' })
    expect(m.steps).toEqual([
      {
        title: null,
        ordered: false,
        items: [
          'Kneten: 6 Min langsam + 3 Min schnell',
          'Backen: 260 °C, ohne Schwaden, 7–9 Minuten',
        ],
      },
    ])
  })

  it('Teig-Format: lesbar, aber schreibgeschützt', () => {
    const doc = parse('teige/musterteig.md')
    expect(doc.format).toBe('teig')
    expect(doc.editable).toBe(false)
    expect(doc.readOnlyReason).toMatch(/Rechengrundlage des Backzettels/)
    const m = doc.model
    expect(m.title).toBe('Musterteig')
    expect(m.yield).toBe('je 1 L Schüttwasser')
    expect(m.parts[0].ingredients).toEqual([
      { name: 'Wasser', amount: 1000, unit: 'g', note: null },
      { name: 'Probemehl', amount: 1620, unit: 'g', note: null },
      { name: 'Salz', amount: 36, unit: 'g', note: null },
      { name: 'Mustermalz', amount: 47.5, unit: 'g', note: 'auch: Testmittel' },
      { name: 'Testhefe', amount: 44, unit: 'g', note: null },
    ])
    expect(m.meta).toEqual(
      expect.arrayContaining([
        { key: 'art', label: 'Art', value: 'teig' },
        {
          key: 'teig_kg_je_l',
          label: 'Teig je Liter Schüttwasser (kg)',
          value: '2.7475',
        },
        { key: 'bestaetigt', label: 'Bestätigt', value: null },
      ])
    )
    expect(m.sections[0].title).toBe('Originalrezept (Rezeptwasser 3 L)')
    expect(m.sections[0].text).toMatch(/\| Probemehl \| 4 860 \| 1 620 \|/)

    const zusatz = parse('teige/musterteig-koerner.md')
    expect(zusatz.model.yield).toBe('je 1 kg Teig')
    expect(zusatz.model.steps).toEqual([
      {
        title: null,
        ordered: true,
        items: ['Körner eine Stunde einweichen', 'Unter den Teig heben'],
      },
    ])
    expect(core.applyRecipeInput(zusatz, { title: 'Anders' })).toMatchObject({
      ok: false,
      error: 'recipe_read_only',
    })
  })
})

describe('verlustfrei: Speichern ohne Änderung', () => {
  it.each(FIXTURE_FILES.map((f) => [`${f.category}/${f.file}`, f]))(
    '%s ergibt dieselben Bytes',
    (_name, f) => {
      const text = fs.readFileSync(f.full, 'utf8')
      const doc = core.parseRecipeFile(text, {
        fileStem: core.fileStem(f.file),
      })
      expect(doc.regions.map((r) => r.raw).join('')).toBe(text)
      if (!doc.editable) {
        expect(doc.format).toBe('teig')
        return
      }
      const result = core.applyRecipeInput(doc, formOf(doc))
      expect(result).toMatchObject({ ok: true, changed: false })
      expect(result.text).toBe(text)
    }
  )

  it('auch mit Windows-Zeilenenden und ohne Zeilenende am Schluss', () => {
    for (const f of FIXTURE_FILES) {
      const text = fs.readFileSync(f.full, 'utf8').replace(/\n/g, '\r\n')
      const doc = core.parseRecipeFile(text)
      if (!doc.editable) continue
      const result = core.applyRecipeInput(doc, formOf(doc))
      expect(result.changed).toBe(false)
      expect(result.text).toBe(text)
      // eine Änderung behält die Zeilenenden der Datei
      const edited = core.applyRecipeInput(doc, {
        ...formOf(doc),
        notes: 'Neue Notiz',
      })
      expect(edited.ok).toBe(true)
      expect(edited.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    }
  })

  it('prüft unveränderte Werte nicht noch einmal', () => {
    // 0 g und ein überlanger Schritt stehen schon in der Datei
    const text = `---\ntitle: Altlast\n---\n\n## Zutaten\n- [ ] 0 g Testsalz\n\n## Zubereitung\n1. ${'x'.repeat(
      3000
    )}\n`
    const doc = core.parseRecipeFile(text)
    expect(doc.editable).toBe(true)
    const result = core.applyRecipeInput(doc, {
      ...formOf(doc),
      notes: 'dazu',
    })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('- [ ] 0 g Testsalz\n')
    // neu eingegeben wäre beides ein Fehler
    const form = formOf(doc)
    form.parts[0].ingredients.push({ name: 'Neu', amount: 0, unit: 'g' })
    expect(core.applyRecipeInput(doc, form)).toMatchObject({
      ok: false,
      error: 'validation',
    })
  })
})

describe('Änderungen schreiben nur, was sich ändert', () => {
  it('eine Menge: genau eine Zeile', () => {
    for (const rel of [
      'breads/Musterkruste.md',
      'cakes/Testkuchen.md',
      'fillings/Gefüllte-Testkränze.md',
      'special/Probe-Dünnbrot',
    ]) {
      const doc = parse(rel)
      const form = formOf(doc)
      form.parts[0].ingredients[0].amount = 4321
      const result = core.applyRecipeInput(doc, form)
      expect(result).toMatchObject({ ok: true, changed: true })
      const diff = changedLines(doc.text, result.text)
      expect(diff.removed).toHaveLength(1)
      expect(diff.added).toHaveLength(1)
      expect(lines(result.text)).toHaveLength(lines(doc.text).length)
    }
    const kuchen = parse('cakes/Testkuchen.md')
    const form = formOf(kuchen)
    form.parts[0].ingredients[0].amount = 4321
    expect(
      changedLines(kuchen.text, core.applyRecipeInput(kuchen, form).text).added
    ).toEqual(['| Probequark | 4.321 g |'])
  })

  it('Zutaten umsortieren, hinzufügen, entfernen', () => {
    const doc = parse('breads/Musterkruste.md')
    const form = formOf(doc)
    const [first, ...rest] = form.parts[1].ingredients
    form.parts[1].ingredients = [...rest, first]
    const moved = core.applyRecipeInput(doc, form)
    expect(moved.ok).toBe(true)
    expect(lines(moved.text).sort()).toEqual(lines(doc.text).sort())
    expect(moved.text).not.toBe(doc.text)

    const more = formOf(doc)
    more.parts[1].ingredients.push({
      name: 'Testkörner',
      amount: 12.5,
      unit: 'g',
      note: null,
    })
    more.parts[1].ingredients.push({ name: 'Probewasser', amount: null })
    const added = core.applyRecipeInput(doc, more)
    expect(changedLines(doc.text, added.text)).toEqual({
      removed: [],
      added: ['- [ ] 12,5 g Testkörner', '- [ ] Probewasser'],
    })
    // offen bleibt offen
    expect(added.model.parts[1].ingredients.slice(-1)[0]).toEqual({
      name: 'Probewasser',
      amount: null,
      unit: null,
      note: null,
    })

    const less = formOf(doc)
    less.parts[1].ingredients.splice(2, 1)
    const removed = core.applyRecipeInput(doc, less)
    expect(changedLines(doc.text, removed.text)).toEqual({
      removed: ['- [ ] 385 g Probemehl dunkel'],
      added: [],
    })
  })

  it('Gruppen umsortieren und neu anlegen; leere Zeilen fallen weg', () => {
    const doc = parse('fillings/Gefüllte-Testkränze.md')
    const form = formOf(doc)
    form.parts = [form.parts[2], form.parts[0], form.parts[1]]
    form.parts.push({
      title: 'Testmohnfüllung',
      ingredients: [
        { name: 'Probemohn', amount: 1500, unit: 'g' },
        { name: '', amount: null },
        { name: 'Wasser', amount: 0.5, unit: 'l', note: 'heiß' },
      ],
    })
    const result = core.applyRecipeInput(doc, form)
    expect(result.ok).toBe(true)
    expect(result.model.parts.map((p) => p.title)).toEqual([
      'Musterquarkfüllung',
      'Testnussfüllung',
      'Probeschokofüllung',
      'Testmohnfüllung',
    ])
    // alte Zeilen wörtlich (Emoji-Überschrift, Tabellenbreite)
    expect(result.text).toContain('### 🧀 Musterquarkfüllung\n')
    expect(result.text).toContain('| Quarkfest*** | 70 g     |\n')
    expect(result.text).toContain(
      '### Testmohnfüllung\n| Zutat | Menge |\n|-------|-------|\n| Probemohn | 1.500 g |\n| Wasser | 0,5 l (heiß) |\n'
    )
    // der Backzettel liest die neue Datei wie zuvor
    expect(
      backzettelRecipes
        .parseFillingRecipes(result.text)
        .map((r) => [r.title, r.batch_g])
    ).toEqual([
      ['Musterquarkfüllung', 550],
      ['Testnussfüllung', 1750],
      ['Probeschokofüllung', 2900],
      ['Testmohnfüllung', 2000],
    ])
  })

  it('Schritte: neu nummerieren, Unterpunkte behalten, Gruppe anhängen', () => {
    const doc = parse('snacks/Testknoten.md')
    const form = formOf(doc)
    form.steps[1].items.unshift('Teig 10 Min. ruhen lassen')
    form.steps.push({
      title: 'Verkauf',
      ordered: false,
      items: ['Warm anbieten'],
    })
    const result = core.applyRecipeInput(doc, form)
    expect(result.ok).toBe(true)
    expect(result.text).toContain(
      '### Formgebung\n1. Teig 10 Min. ruhen lassen\n2. Stücke zu 70g abwiegen\n3. Zum Knoten legen:\n   - Strang 40cm lang rollen\n'
    )
    expect(result.text).toContain(
      '\n\n### Verkauf\n- Warm anbieten\n\n## Qualitätskriterien\n'
    )
    // der Rest der Datei steht wörtlich da
    expect(result.text.endsWith('*Verantwortlich: Testbäckerei*')).toBe(true)
  })

  it('Titel und Ertrag im Standardformat: Kopf und Überschrift', () => {
    const doc = parse('breads/Musterkruste.md')
    const renamed = core.applyRecipeInput(doc, {
      title: 'Musterkruste: dunkel',
      yield: null,
    })
    expect(renamed.ok).toBe(true)
    expect(changedLines(doc.text, renamed.text)).toEqual({
      removed: [
        'title: Musterkruste',
        'yield: 3 Laibe à 700g',
        '# Musterkruste',
      ],
      added: ['title: "Musterkruste: dunkel"', '# Musterkruste: dunkel'],
    })
    expect(renamed.model).toMatchObject({
      title: 'Musterkruste: dunkel',
      yield: null, // offen, kein Platzhalter
    })
    // und zurück: wieder genau die Datei
    const back = core.applyRecipeInput(
      core.parseRecipeFile(renamed.text),
      formOf(doc)
    )
    expect(back.text).toBe(doc.text)
  })

  it('Titel und Ertrag im Tabellenformat: Emoji und Klammer bleiben', () => {
    const doc = parse('cakes/Testkuchen.md')
    const result = core.applyRecipeInput(doc, {
      title: 'Probekuchen',
      yield: 'für 4 Bleche',
      notes: 'Im Wasserbad backen.',
      description: 'Erfundener Kuchen.',
    })
    expect(result.ok).toBe(true)
    expect(
      result.text.startsWith(
        '# 🍰 Probekuchen (für 4 Bleche)\n\nIm Wasserbad backen.\n\n'
      )
    ).toBe(true)
    expect(result.text).toContain(
      '### Beschreibung\nErfundener Kuchen.\n\n### Zutaten:\n'
    )
    expect(result.model).toMatchObject({
      title: 'Probekuchen',
      yield: 'für 4 Bleche',
      notes: 'Im Wasserbad backen.',
      description: 'Erfundener Kuchen.',
    })
    const burger = parse('special/Probe-Dünnbrot')
    const more = core.applyRecipeInput(burger, { yield: '24 Stück' })
    expect(changedLines(burger.text, more.text)).toEqual({
      removed: ['- **Menge**: Ergibt ca. 16 Fladen à 110 g'],
      added: ['- **Menge**: 24 Stück'],
    })
  })

  it('Abschnitte leeren und wieder füllen', () => {
    const doc = parse('breads/Probelaib.md')
    const emptied = core.applyRecipeInput(doc, {
      notes: null,
      description: '',
      steps: [],
    })
    expect(emptied.ok).toBe(true)
    expect(emptied.text).not.toMatch(/## (Notizen|Beschreibung|Zubereitung)/)
    expect(emptied.model).toMatchObject({
      notes: null,
      description: null,
      steps: [],
    })
    const again = core.applyRecipeInput(core.parseRecipeFile(emptied.text), {
      notes: 'Wieder da',
      steps: [{ title: null, items: ['Kneten', 'Backen'] }],
    })
    expect(again.text).toContain(
      '## Zubereitung\n1. Kneten\n2. Backen\n\n## Notizen\nWieder da\n\n---\n*Rezept erstellt am'
    )
  })
})

describe('neues Rezept', () => {
  it('schreibt nur, was angegeben ist', () => {
    const result = core.newRecipeFile(
      {
        title: 'Testlaib neu',
        yield: '12 Stück',
        description: 'Erfunden.',
        parts: [
          {
            title: 'Hauptteig',
            ingredients: [
              { name: 'Probemehl', amount: 1000, unit: 'g' },
              { name: 'Wasser', amount: 0.65, unit: 'l' },
              { name: 'Salz', amount: null, unit: 'g' },
              { name: 'Testhefe', amount: 2, unit: 'Würfel', note: 'frisch' },
            ],
          },
        ],
        steps: [
          {
            title: 'Teig',
            items: ['Kneten', 'Ruhen lassen:\n- abgedeckt\n- 30 Min.'],
          },
          { title: 'Hinweise', ordered: false, items: ['Nicht zu heiß'] },
        ],
        notes: 'Hält 2 Tage.',
      },
      { category: 'breads' }
    )
    expect(result.ok).toBe(true)
    expect(result.text).toBe(
      [
        '---',
        'title: Testlaib neu',
        'category: bread',
        'yield: 12 Stück',
        '---',
        '',
        '# Testlaib neu',
        '',
        '## Beschreibung',
        'Erfunden.',
        '',
        '## Zutaten',
        '',
        '### Hauptteig',
        '- [ ] 1000 g Probemehl',
        '- [ ] 0,65 l Wasser',
        '- [ ] Salz',
        '- [ ] 2 Würfel Testhefe (frisch)',
        '',
        '## Zubereitung',
        '',
        '### Teig',
        '1. Kneten',
        '2. Ruhen lassen:',
        '   - abgedeckt',
        '   - 30 Min.',
        '',
        '### Hinweise',
        '- Nicht zu heiß',
        '',
        '## Notizen',
        'Hält 2 Tage.',
        '',
      ].join('\n')
    )
    // ohne Menge: offen, keine 0 und keine Einheit
    expect(result.model.parts[0].ingredients[2]).toEqual({
      name: 'Salz',
      amount: null,
      unit: null,
      note: null,
    })
    // und die neue Datei ist selbst verlustfrei
    const doc = core.parseRecipeFile(result.text)
    expect(core.applyRecipeInput(doc, formOf(doc))).toMatchObject({
      changed: false,
    })
  })

  it('nur ein Name: kein Ertrag, keine Zutaten - nichts erfunden', () => {
    const result = core.newRecipeFile(
      { title: 'Nur ein Name' },
      { category: 'cakes' }
    )
    expect(result.text).toBe(
      '---\ntitle: Nur ein Name\ncategory: cake\n---\n\n# Nur ein Name\n'
    )
    expect(result.model).toMatchObject({
      yield: null,
      parts: [],
      steps: [],
      notes: null,
    })
  })

  it('quotet, was YAML anders läse', () => {
    for (const title of [
      '12',
      'true',
      'Brot: neu',
      '#1 Brot',
      '- Brot',
      "Omas 'Brot'",
      'null',
    ]) {
      const result = core.newRecipeFile(
        { title, yield: '2025-01-01' },
        { category: 'rolls' }
      )
      expect(result.ok).toBe(true)
      expect(core.parseRecipeFile(result.text).model).toMatchObject({
        title,
        yield: '2025-01-01',
      })
    }
  })
})

describe('Prüfung der Eingabe', () => {
  const doc = () => parse('breads/Probelaib.md')
  const invalid = (input, pattern) => {
    const result = core.applyRecipeInput(doc(), input)
    expect(result).toMatchObject({ ok: false, error: 'validation' })
    expect(result.message).toMatch(pattern)
  }
  const part = (ingredient) => ({
    parts: [{ title: 'A', ingredients: [ingredient] }],
  })

  it('lehnt mit deutscher Meldung ab', () => {
    invalid(null, /Angaben zum Rezept fehlen/)
    invalid({ title: '' }, /Name des Rezepts fehlt/)
    invalid({ title: 'x'.repeat(121) }, /höchstens 120 Zeichen/)
    invalid({ title: 'Zeile\nzwei' }, /Steuerzeichen oder Zeilenumbrüche/)
    invalid({ parts: 'Mehl' }, /Liste von Gruppen/)
    invalid(part({ name: 'Mehl', amount: 0 }), /größer als 0.*offen/)
    invalid(part({ name: 'Mehl', amount: -5 }), /größer als 0/)
    invalid(part({ name: 'Mehl', amount: '100' }), /muss eine Zahl sein/)
    invalid(
      part({ name: 'Mehl', amount: 1, unit: 'Eimer' }),
      /Unbekannte Einheit/
    )
    invalid(
      part({ name: 'Mehl | Zucker', amount: 1 }),
      /darf kein „\|“ enthalten/
    )
    invalid(part({ amount: null, note: 'etwas' }), /Name der Zutat fehlt/)
    invalid(
      { notes: 'Text\n## Zutaten\n- [ ] 1 g Gift' },
      /Überschrift \(#\) oder Trennlinie/
    )
    invalid({ description: 'a\n---\nb' }, /Überschrift \(#\) oder Trennlinie/)
    invalid(
      { steps: [{ title: '# Titel', items: ['x'] }] },
      /nicht mit „#“ beginnen/
    )
    invalid(
      {
        parts: [
          { title: 'A', ingredients: [] },
          { title: null, ingredients: [{ name: 'Mehl' }] },
        ],
      },
      /jede Gruppe ab der zweiten einen Namen/
    )
  })

  it('Einheiten in jeder Schreibweise, drei Nachkommastellen', () => {
    const result = core.applyRecipeInput(doc(), {
      parts: [
        {
          title: 'Hauptteig',
          ingredients: [
            { name: 'Mehl', amount: 1.23456, unit: 'KG' },
            { name: 'Ei', amount: 2, unit: 'stück' },
            { name: 'Hefe', amount: 1, unit: 'pck' },
          ],
        },
      ],
    })
    expect(result.model.parts[0].ingredients).toEqual([
      { name: 'Mehl', amount: 1.235, unit: 'kg', note: null },
      { name: 'Ei', amount: 2, unit: 'Stück', note: null },
      { name: 'Hefe', amount: 1, unit: 'Pck.', note: null },
    ])
  })

  it('liefert nichts, wenn die Datei die Eingabe nicht eindeutig hält', () => {
    // Klammer am Ende des Namens wäre im Tabellenformat der Ertrag
    expect(
      core.applyRecipeInput(parse('cakes/Testkuchen.md'), {
        title: 'Kuchen (hell)',
        yield: null,
      })
    ).toMatchObject({ ok: false, error: 'invalid_recipe_file' })
  })

  it('was die Datei aus einer Zutat macht, steht in der Antwort', () => {
    const result = core.applyRecipeInput(doc(), {
      parts: [
        { title: 'Hauptteig', ingredients: [{ name: '2 Eier', amount: null }] },
      ],
    })
    expect(result.model.parts[0].ingredients).toEqual([
      { name: 'Eier', amount: 2, unit: null, note: null },
    ])
  })
})

describe('schreibgeschützt statt verlustbehaftet', () => {
  const standard = (zutaten) =>
    `---\ntitle: Test\n---\n\n# Test\n\n## Zutaten\n${zutaten}\n`
  it.each([
    [
      'Freitext zwischen den Zutaten',
      standard('- [ ] 1 g Salz\nNach Gefühl würzen.'),
      /keine Zutat/,
    ],
    [
      'eingerückte Unterpunkte bei Zutaten',
      standard('- [ ] 1 g Salz\n    - fein'),
      /keine Zutat/,
    ],
    ['leere Zutatenzeile', standard('- [ ] '), /leere Zutatenzeile/],
    [
      'Tabelle mit drei Spalten',
      '# Test\n\n### Zutaten\n| Zutat | Menge | Hinweis |\n|---|---|---|\n| Salz | 1 g | fein |\n',
      /zwei Spalten/,
    ],
    [
      'Tabelle ohne Überschrift',
      '# Test\n| Zutat | Menge |\n|---|---|\n| Salz | 1 g |\n',
      /ohne eigene Überschrift/,
    ],
    [
      'gemischte Schritte',
      '---\ntitle: Test\n---\n\n## Zubereitung\n1. Kneten\n- Backen\n',
      /gemischt/,
    ],
    [
      'Absatz in der Zubereitung',
      '---\ntitle: Test\n---\n\n## Zubereitung\nEinfach alles mischen.\n',
      /kein Arbeitsschritt/,
    ],
    [
      'mehrzeiliger Titel im Kopf',
      '---\ntitle: >\n  Langer\n  Titel\n---\n\n# X\n',
      /kein einfacher einzeiliger Wert/,
    ],
  ])('%s', (_name, text, reason) => {
    const doc = core.parseRecipeFile(text, { fileStem: 'Test' })
    expect(doc.editable).toBe(false)
    expect(doc.readOnlyReason).toMatch(/nur in hq bearbeiten/)
    expect(doc.readOnlyReason).toMatch(reason)
    // angezeigt wird trotzdem, was sich lesen lässt
    expect(doc.model.title).toBeTruthy()
    expect(core.applyRecipeInput(doc, { title: 'Neu' })).toMatchObject({
      ok: false,
      error: 'recipe_read_only',
    })
    expect(doc.regions.map((r) => r.raw).join('')).toBe(text)
  })

  it('offener YAML-Kopf', () => {
    const doc = core.parseRecipeFile('---\ntitle: Test\n\n# Test\n', {
      fileStem: 'Test-Datei',
    })
    expect(doc).toMatchObject({ format: 'unknown', editable: false })
    expect(doc.readOnlyReason).toMatch(/nicht abgeschlossen/)
    expect(doc.model.title).toBe('Test Datei')
  })

  it('zeigt Zutaten einer nicht verstandenen Tabelle trotzdem an', () => {
    const doc = core.parseRecipeFile(
      '# Test\n| Zutat | Menge |\n|---|---|\n| Salz | 1 g |\n'
    )
    expect(doc.model.parts[0].ingredients).toEqual([
      { name: 'Salz', amount: 1, unit: 'g', note: null },
    ])
  })
})

describe('Dateien mit wenig Struktur', () => {
  const TABLE = '### Zutaten\n| Zutat | Menge |\n|---|---|\n| Salz | 1 g |\n'
  const apply = (text, input) =>
    core.applyRecipeInput(
      core.parseRecipeFile(text, { fileStem: 'Alter-Zettel' }),
      input
    )

  it('ohne Titel in der Datei gilt der Dateiname - und Änderungen gehen trotzdem', () => {
    const doc = core.parseRecipeFile(TABLE, { fileStem: 'Alter-Zettel' })
    expect(doc.model.title).toBe('Alter Zettel')
    const result = apply(TABLE, { notes: 'Hinweis' })
    expect(result.ok).toBe(true)
    expect(result.text).toBe(`${TABLE}\n### Notizen\nHinweis\n`)
    expect(result.model.title).toBe('Alter Zettel')
    // erst ein neuer Name oder ein Ertrag legt die Überschrift an
    expect(apply(TABLE, { title: 'Neuer Name', yield: '3 Stück' }).text).toBe(
      `# Neuer Name (3 Stück)\n\n${TABLE}`
    )
  })

  it('ein Zettel ohne jede Struktur wird Notiz; Zutaten kommen als Tabelle dazu', () => {
    const result = apply('Nur ein Zettel\nmit zwei Zeilen\n', {
      parts: [
        {
          title: null,
          ingredients: [{ name: 'Probemehl', amount: 1, unit: 'kg' }],
        },
      ],
    })
    expect(result.text).toBe(
      'Nur ein Zettel\nmit zwei Zeilen\n\n### Zutaten\n| Zutat | Menge |\n|-------|-------|\n| Probemehl | 1 kg |\n'
    )
    expect(result.model.notes).toBe('Nur ein Zettel\nmit zwei Zeilen')
  })

  it('Standardformat ohne yield, ohne Titel im Kopf, ohne Überschrift', () => {
    expect(
      apply('---\ntitle: A\ncategory: bread\ntags:\n  - x\n---\n\n# A\n', {
        yield: '2 Stück',
      }).text
    ).toBe(
      '---\ntitle: A\ncategory: bread\nyield: 2 Stück\ntags:\n  - x\n---\n\n# A\n'
    )
    expect(
      apply('---\ncategory: bread\n---\n\n# Alt\n', { title: 'Neu' }).text
    ).toBe('---\ncategory: bread\n---\n\n# Neu\n')
    expect(
      apply('---\ncategory: bread\n---\n\n## Notizen\nx\n', { title: 'Neu' })
        .text
    ).toBe('---\ncategory: bread\ntitle: Neu\n---\n\n## Notizen\nx\n')
  })

  it('neue Abschnitte landen in der üblichen Reihenfolge', () => {
    const result = apply(
      '---\ntitle: A\n---\n\n# A\n\n## Zutaten\n- [ ] 1 g Salz\n\n## Notizen\nx\n',
      { steps: [{ title: null, items: ['Kneten'] }], description: 'Kurz.' }
    )
    expect(result.text).toBe(
      '---\ntitle: A\n---\n\n# A\n\n## Beschreibung\nKurz.\n\n## Zutaten\n- [ ] 1 g Salz\n\n## Zubereitung\n1. Kneten\n\n## Notizen\nx\n'
    )
  })

  it('Byte-Order-Mark und Code-Zaun bleiben, wie sie sind', () => {
    const bom = String.fromCharCode(0xfeff)
    const text = `${bom}---\ntitle: A\n---\n\n## Notizen\n\`\`\`\n## kein Abschnitt\n\`\`\`\n`
    const doc = core.parseRecipeFile(text)
    expect(doc).toMatchObject({ format: 'standard', editable: true })
    expect(doc.model.notes).toBe('```\n## kein Abschnitt\n```')
    expect(core.applyRecipeInput(doc, formOf(doc))).toMatchObject({
      changed: false,
    })
    expect(core.applyRecipeInput(doc, { yield: '1 Stück' }).text).toBe(
      `${bom}---\ntitle: A\nyield: 1 Stück\n---\n\n## Notizen\n\`\`\`\n## kein Abschnitt\n\`\`\`\n`
    )
  })

  it('eine leere Datei', () => {
    const result = apply('', { title: 'Leer', notes: 'x' })
    expect(result.text).toBe('# Leer\n\n### Notizen\nx\n')
  })
})

describe('Dateinamen und Kennungen', () => {
  it('nimmt nur Rezeptdateien', () => {
    for (const ok of ['Musterbrot.md', 'Probe-Dünnbrot', 'käse kuchen.MD']) {
      expect(core.isRecipeFileName(ok)).toBe(true)
    }
    for (const bad of [
      '',
      '.DS_Store',
      '.hidden.md',
      '_vorlage.md',
      'README.md',
      'readme',
      'bild.jpg',
      'tabelle.xlsx',
      '../Musterbrot.md',
      'Muster "Brot".md',
      ' Musterbrot.md',
      'Musterbrot.md ',
      'a/b.md',
      'a\\b.md',
      'Zeile\numbruch.md',
      'null\u0000.md',
      'x'.repeat(201),
      null,
    ]) {
      expect(core.isRecipeFileName(bad)).toBe(false)
    }
  })

  it('leitet Kennungen aus Dateinamen ab, eindeutig und stabil', () => {
    const slugs = core.slugsForFiles([
      'Gefüllte-Testkränze.md',
      // dieselben Buchstaben, zerlegt (so liefert macOS Dateinamen), ohne Endung
      'Gefüllte-Testkränze'.normalize('NFD'),
      'Weiß & Brot!.md',
      '🍰.md',
      '.versteckt.md',
    ])
    expect([...slugs.values()].sort()).toEqual([
      'gefuellte-testkraenze',
      'gefuellte-testkraenze-2',
      'weiss-brot',
    ])
    expect(slugs.has('🍰.md')).toBe(false)
  })

  it('neuer Dateiname nur aus Buchstaben und Ziffern', () => {
    expect(core.newFileName('Süßer Testzopf (groß)')).toEqual({
      slug: 'suesser-testzopf-gross',
      fileName: 'suesser-testzopf-gross.md',
    })
    expect(core.newFileName('../../etc/passwd')).toEqual({
      slug: 'etc-passwd',
      fileName: 'etc-passwd.md',
    })
    expect(core.newFileName('🍞🍞')).toBeNull()
    expect(core.newFileName('README')).toBeNull()
    expect(core.newFileName('x'.repeat(200)).slug).toHaveLength(80)
  })

  it('kennt die Kategorien; teige ist nur lesbar', () => {
    expect(core.CATEGORIES.map((c) => c.id)).toEqual([
      'breads',
      'rolls',
      'baguettes',
      'snacks',
      'cakes',
      'fillings',
      'special',
      'teige',
    ])
    expect(core.categoryOf('teige')).toMatchObject({ readOnly: true })
    expect(core.categoryOf('../breads')).toBeNull()
    expect(core.categoryOf(undefined)).toBeNull()
  })
})

describe('Mengen', () => {
  it('liest deutsche Schreibweisen', () => {
    expect(core.readQuantity('1.200 ml')).toMatchObject({
      amount: 1200,
      unit: 'ml',
      rest: '',
    })
    expect(core.readQuantity('0,5 l Wasser')).toMatchObject({
      amount: 0.5,
      unit: 'l',
      rest: ' Wasser',
    })
    expect(core.readQuantity('ca. 3 kg')).toMatchObject({
      amount: 3,
      unit: 'kg',
      approx: true,
    })
    expect(core.readQuantity('2 EL')).toMatchObject({ amount: 2, unit: 'EL' })
    expect(core.readQuantity('3 Eier')).toMatchObject({
      amount: 3,
      unit: null,
      rest: ' Eier',
    })
    expect(core.readQuantity('5 gr')).toMatchObject({
      amount: 5,
      unit: null,
      rest: ' gr',
    })
    expect(core.readQuantity('2–5 g')).toMatchObject({ amount: 2, unit: null })
    expect(core.readQuantity('Prise')).toMatchObject({ amount: null })
  })

  it('schreibt sie wieder so', () => {
    expect(core.formatAmount(1234.5, 'table')).toBe('1.234,5')
    expect(core.formatAmount(1234.5, 'list')).toBe('1234,5')
    expect(core.formatAmount(1000000, 'table')).toBe('1.000.000')
    expect(core.formatAmount(0.125, 'table')).toBe('0,125')
    expect(core.formatAmount(40, 'list')).toBe('40')
  })
})

describe('Suche und Backzettel-Verweise', () => {
  it('findet Titel, Zutaten und Schlagworte ohne Akzente und Großschreibung', () => {
    const model = parse('rolls/Müsli-Wecken.md').model
    expect(core.matchesSearch(model, 'musli')).toBe(true)
    expect(core.matchesSearch(model, 'TESTFLOCKEN wecken')).toBe(true)
    expect(core.matchesSearch(model, 'frühstück')).toBe(true)
    expect(core.matchesSearch(model, 'testflocken torte')).toBe(false)
    expect(core.matchesSearch(model, '   ')).toBe(true)
  })

  it('sammelt recipe:-Pfade aus Füllungen und Teigen', () => {
    expect(
      core.collectRecipeReferences({
        fillings: [
          {
            id: 'nuss',
            name: 'Nussfüllung',
            recipe: 'data/recipes/fillings/a.md',
            section: 'Nuss',
          },
          { id: 'ohne' },
        ],
        doughs: [
          { id: 'teig', recipe: ' data/recipes/teige/t.md ' },
          { id: 'x', recipe: 5 },
        ],
        days: { 6: { recipe: 'kein Verweis' } },
      })
    ).toEqual([
      {
        kind: 'filling',
        id: 'nuss',
        name: 'Nussfüllung',
        recipe: 'data/recipes/fillings/a.md',
        section: 'Nuss',
      },
      {
        kind: 'dough',
        id: 'teig',
        name: null,
        recipe: 'data/recipes/teige/t.md',
        section: null,
      },
    ])
    expect(core.collectRecipeReferences(null)).toEqual([])
  })

  it('der Backzettel findet seinen Rezeptteil über dieselbe Funktion', () => {
    const all = backzettelRecipes.parseFillingRecipes(
      read('fillings/Gefüllte-Testkränze.md')
    )
    expect(
      backzettelRecipes.findRecipeForReference(all, {
        id: 'nuss',
        section: 'Testnussfüllung',
      })
    ).toMatchObject({ title: 'Testnussfüllung', batch_g: 1750 })
    expect(
      backzettelRecipes.findRecipeForReference(all, { id: 'probeschoko' })
    ).toMatchObject({
      title: 'Probeschokofüllung',
    })
    expect(
      backzettelRecipes.findRecipeForReference(all, { id: 'mohn' })
    ).toBeNull()
  })

  it('Commit-Betreff ohne Zeilenumbruch', () => {
    expect(
      core.commitSubject('create', 'Test\nbrot', 'breads/testbrot.md')
    ).toBe('recipes: Test brot (breads/testbrot.md) angelegt')
    expect(core.commitSubject('delete', '', 'cakes/x.md')).toBe(
      'recipes: Rezept (cakes/x.md) gelöscht'
    )
  })
})

// --------------------------------------------------------------------------
// Der Beweis über die echten Dateien: nur dort, wo das private hq neben dem
// Repo liegt (auch aus einem Worktree unter .claude/worktrees). Im CI gibt
// es hq nicht - dann übersprungen. Meldungen nennen nur Kategorie und
// Position, nie Inhalt.
// --------------------------------------------------------------------------
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const REAL_DIR = [
  process.env.HQ_REAL_RECIPES_DIR,
  path.join(REPO_ROOT, '..', 'hq', 'data', 'recipes'),
  path.join(REPO_ROOT, '..', '..', '..', '..', 'hq', 'data', 'recipes'),
].find((dir) => dir && fs.existsSync(dir))

const describeReal = REAL_DIR ? describe : describe.skip
describeReal('echte Rezepte aus hq (lokal)', () => {
  const real = REAL_DIR ? filesOf(REAL_DIR) : []

  it('jede Datei: Speichern ohne Änderung ändert kein Byte', () => {
    expect(real.length).toBeGreaterThan(0)
    const failures = []
    real.forEach((f, index) => {
      const where = `${f.category} #${index + 1}`
      const text = fs.readFileSync(f.full, 'utf8')
      const doc = core.parseRecipeFile(text, {
        fileStem: core.fileStem(f.file),
      })
      if (doc.regions.map((r) => r.raw).join('') !== text) {
        failures.push(`${where}: Bereiche ergeben nicht die Datei`)
        return
      }
      if (!doc.editable) return
      const result = core.applyRecipeInput(doc, formOf(doc))
      if (!result.ok) failures.push(`${where}: ${result.error}`)
      else if (result.changed || result.text !== text) {
        failures.push(`${where}: nicht bytegleich`)
      }
    })
    expect(failures).toEqual([])
  })

  it('schreibgeschützt sind nur die Teig-Rezepte', () => {
    const readOnly = real
      .map((f, index) => ({
        where: `${f.category} #${index + 1}`,
        doc: core.parseRecipeFile(fs.readFileSync(f.full, 'utf8')),
      }))
      .filter(({ doc }) => !doc.editable && doc.format !== 'teig')
      .map(({ where }) => where)
    expect(readOnly).toEqual([])
  })

  it('jede bearbeitbare Datei: eine Menge ändern ändert genau eine Zeile', () => {
    const failures = []
    real.forEach((f, index) => {
      const text = fs.readFileSync(f.full, 'utf8')
      const doc = core.parseRecipeFile(text)
      if (!doc.editable || doc.model.parts.length === 0) return
      const form = formOf(doc)
      if (form.parts[0].ingredients.length === 0) return
      form.parts[0].ingredients[0].amount = 4321
      form.parts[0].ingredients[0].unit = 'g'
      const result = core.applyRecipeInput(doc, form)
      const a = lines(text)
      const b = result.ok ? lines(result.text) : []
      const changed =
        a.length === b.length ? a.filter((l, i) => l !== b[i]).length : -1
      if (changed !== 1)
        failures.push(`${f.category} #${index + 1}: ${changed}`)
    })
    expect(failures).toEqual([])
  })

  it('der Backzettel liest jede Datei wie die Rezeptverwaltung ihre Tabellen', () => {
    const failures = []
    real.forEach((f, index) => {
      const text = fs.readFileSync(f.full, 'utf8')
      const tables = core.scanIngredientTables(text)
      const recipes = backzettelRecipes.parseFillingRecipes(text)
      if (recipes.length > tables.length)
        failures.push(`${f.category} #${index + 1}`)
    })
    expect(failures).toEqual([])
  })
})
