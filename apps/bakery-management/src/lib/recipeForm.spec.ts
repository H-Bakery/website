import {
  amountInputText,
  changedInput,
  emptyRecipeForm,
  formFromRecipe,
  formProblems,
  fullInput,
  hasContent,
  isChanged,
  moveItem,
  newIngredientRow,
  parseAmount,
  rowProblem,
} from './recipeForm'
import { syntheticFilling, syntheticRecipe } from './recipeFixtures'

describe('parseAmount - Mengenfeld', () => {
  it('leer heißt offen (null), nie 0', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null })
    expect(parseAmount('   ')).toEqual({ ok: true, value: null })
  })

  it('liest Komma und Punkt als Dezimalzeichen', () => {
    expect(parseAmount('0,5')).toEqual({ ok: true, value: 0.5 })
    expect(parseAmount('2.25')).toEqual({ ok: true, value: 2.25 })
    expect(parseAmount(' 1350 ')).toEqual({ ok: true, value: 1350 })
  })

  it.each(['0', '0,0', '-5', 'abc', '1,2345', '12 g', '1,2,3'])(
    'lehnt „%s“ mit einer deutschen Meldung ab',
    (text) => {
      const result = parseAmount(text)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/Menge|Zahl/)
    }
  )

  it('rät keinen Tausenderpunkt', () => {
    const result = parseAmount('1.350')
    expect(result).toEqual({
      ok: false,
      message: 'Bitte ohne Tausenderpunkt eingeben (z. B. 1350).',
    })
  })

  it('amountInputText: Zahl mit Komma, offen = leer', () => {
    expect(amountInputText(0.5)).toBe('0,5')
    expect(amountInputText(1465)).toBe('1465')
    expect(amountInputText(null)).toBe('')
  })
})

describe('Formular ↔ Rezept', () => {
  it('ein unverändertes Formular ergibt keine Änderung (Null-Diff)', () => {
    for (const recipe of [syntheticRecipe(), syntheticFilling()]) {
      const values = formFromRecipe(recipe)
      expect(changedInput(values, recipe)).toEqual({})
      expect(isChanged(values, recipe)).toBe(false)
    }
  })

  it('zeigt offene Angaben als leere Felder', () => {
    const values = formFromRecipe(syntheticFilling())
    expect(values.yield).toBe('')
    const open = values.parts[0].rows[2]
    expect(open.amount).toBe('')
    expect(open.unit).toBe('')
    expect(open.note).toBe('3–6 g (nach Geschmack)')
  })

  it('eine geänderte Menge schickt nur `parts`; unberührte Zutaten sind dieselben Objekte', () => {
    const recipe = syntheticRecipe()
    const values = formFromRecipe(recipe)
    values.parts[1].rows[1] = { ...values.parts[1].rows[1], amount: '0,75' }
    const input = changedInput(values, recipe)
    expect(Object.keys(input)).toEqual(['parts'])
    expect(input.parts?.[1].ingredients[1]).toEqual({
      name: 'Testhefe',
      amount: 0.75,
      unit: 'g',
      note: null,
    })
    expect(input.parts?.[0].ingredients[0]).toBe(recipe.parts[0].ingredients[0])
    expect(input.parts?.[1].ingredients[2]).toBe(recipe.parts[1].ingredients[2])
    // `total` ist nur Anzeige und geht nie zurück.
    expect(input.parts?.[0]).not.toHaveProperty('total')
  })

  it('zurückgeändert ist wieder unverändert', () => {
    const recipe = syntheticRecipe()
    const values = formFromRecipe(recipe)
    const row = values.parts[0].rows[0]
    values.parts[0].rows[0] = { ...row, amount: '999' }
    expect(isChanged(values, recipe)).toBe(true)
    values.parts[0].rows[0] = { ...row, amount: '135' }
    expect(isChanged(values, recipe)).toBe(false)
  })

  it('schickt je Feld nur, was sich geändert hat; geleert wird mit null', () => {
    const recipe = syntheticRecipe()
    const values = formFromRecipe(recipe)
    values.title = 'Musterkruste neu'
    values.yield = ''
    values.notes = ''
    values.steps[1].ordered = true
    const input = changedInput(values, recipe)
    expect(input).toEqual({
      title: 'Musterkruste neu',
      yield: null,
      notes: null,
      steps: [recipe.steps[0], { ...recipe.steps[1], ordered: true }],
    })
  })

  it('neue leere Zeilen und Gruppen fallen weg, geladene Gruppen bleiben', () => {
    const recipe = syntheticRecipe()
    const values = formFromRecipe(recipe)
    values.parts[0].rows.push(newIngredientRow())
    values.parts.push({ ...emptyRecipeForm('breads').parts[0] })
    values.steps.push({ ...emptyRecipeForm('breads').steps[0] })
    expect(changedInput(values, recipe)).toEqual({})
    // Alle Zutaten einer geladenen Gruppe entfernt: die Gruppe bleibt (leer).
    values.parts[0].rows = []
    expect(changedInput(values, recipe).parts?.[0]).toEqual({
      title: 'Testsauer',
      ingredients: [],
    })
  })

  it('umsortieren ändert die Reihenfolge', () => {
    const recipe = syntheticRecipe()
    const values = formFromRecipe(recipe)
    values.parts[1].rows = moveItem(values.parts[1].rows, 0, 1)
    expect(
      changedInput(values, recipe).parts?.[1].ingredients.map((i) => i.name)
    ).toEqual(['Testhefe', 'Probemehl hell', 'Probewasser zum Benetzen'])
  })

  it('fullInput: neues Rezept ohne erfundene Werte', () => {
    const values = emptyRecipeForm('cakes')
    expect(hasContent(values)).toBe(false)
    values.title = '  Testkuchen  '
    values.parts[0].rows[0] = {
      ...values.parts[0].rows[0],
      name: 'Probemehl',
    }
    expect(hasContent(values)).toBe(true)
    expect(fullInput(values)).toEqual({
      title: 'Testkuchen',
      category: 'cakes',
      yield: null,
      description: null,
      parts: [
        {
          title: null,
          ingredients: [
            { name: 'Probemehl', amount: null, unit: null, note: null },
          ],
        },
      ],
      steps: [],
      notes: null,
    })
  })
})

describe('Prüfung vor dem Senden', () => {
  const row = (patch: Partial<ReturnType<typeof newIngredientRow>>) => ({
    ...newIngredientRow(),
    ...patch,
  })

  it('leere und unberührte Zeilen sind in Ordnung', () => {
    expect(rowProblem(row({}))).toBeNull()
    const values = formFromRecipe(syntheticFilling())
    for (const r of values.parts[0].rows) expect(rowProblem(r)).toBeNull()
  })

  it('meldet Menge ohne Zahl, fehlenden Namen und Einheit ohne Menge', () => {
    expect(rowProblem(row({ amount: 'viel', name: 'Mehl' }))).toEqual({
      field: 'amount',
      message: expect.stringMatching(/Zahl/),
    })
    expect(rowProblem(row({ amount: '0', name: 'Mehl' }))).toEqual({
      field: 'amount',
      message: expect.stringMatching(/größer als 0/),
    })
    expect(rowProblem(row({ amount: '5' }))).toEqual({
      field: 'name',
      message: 'Der Name der Zutat fehlt.',
    })
    expect(rowProblem(row({ unit: 'g', name: 'Mehl' }))).toEqual({
      field: 'unit',
      message: expect.stringMatching(/Zur Einheit fehlt die Menge/),
    })
    expect(rowProblem(row({ name: 'Wasser zum Benetzen' }))).toBeNull()
  })

  it('formProblems zählt Titel und Zeilen', () => {
    const values = emptyRecipeForm('breads')
    values.parts[0].rows[0] = row({ amount: 'x', name: 'Mehl' })
    const problems = formProblems(values)
    expect(problems.title).toMatch(/Namen/)
    expect(Object.keys(problems.rows)).toEqual([values.parts[0].rows[0].key])
    expect(problems.count).toBe(2)
    values.title = 'Testbrot'
    values.parts[0].rows[0] = row({ amount: '5', name: 'Mehl' })
    expect(formProblems(values).count).toBe(0)
  })
})

describe('moveItem', () => {
  it('verschiebt um einen Platz und lässt Ränder unverändert', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })
})
