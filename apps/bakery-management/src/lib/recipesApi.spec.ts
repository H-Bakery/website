import {
  backzettelUseText,
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipes,
  formatAmount,
  ingredientAmountOpen,
  ingredientAmountText,
  ingredientCountText,
  ingredientNoteText,
  pendingHint,
  recipeEditHref,
  recipeHref,
  splitRecipeId,
  updateRecipe,
  yieldText,
} from './recipesApi'
import { syntheticList, syntheticRecipe } from './recipeFixtures'

jest.mock('@bakery/shared/data-access', () => {
  class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  }
  return {
    ApiError,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: Record<'get' | 'post' | 'put' | 'delete', jest.Mock>
  ApiError: new (message: string, status: number, code?: string) => Error
}

beforeEach(() => {
  for (const mock of Object.values(apiClient)) mock.mockReset()
})

describe('recipesApi - Aufrufe', () => {
  it('Liste: Suche und Kategorie als Parameter, leere fallen weg', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: syntheticList() })
    await fetchRecipes({ q: '  mehl ', category: null })
    expect(apiClient.get).toHaveBeenCalledWith('/api/recipes', {
      category: undefined,
      q: 'mehl',
    })
    await fetchRecipes()
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/recipes', {
      category: undefined,
      q: undefined,
    })
  })

  it('ein Rezept: 404 → null, andere Fehler bleiben', async () => {
    apiClient.get.mockRejectedValueOnce(
      new ApiError('Rezept nicht gefunden.', 404)
    )
    await expect(fetchRecipe('breads', 'gibt-es-nicht')).resolves.toBeNull()
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/recipes/breads/gibt-es-nicht'
    )
    apiClient.get.mockRejectedValueOnce(new ApiError('Kein Zugriff.', 403))
    await expect(fetchRecipe('breads', 'x')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('anlegen, ändern (mit expectedVersion) und löschen', async () => {
    const recipe = syntheticRecipe()
    apiClient.post.mockResolvedValue({
      success: true,
      data: recipe,
      pending: true,
      changed: true,
    })
    await expect(
      createRecipe({ title: 'Musterkruste', category: 'breads' })
    ).resolves.toEqual({ recipe, pending: true, changed: true })
    expect(apiClient.post).toHaveBeenCalledWith('/api/recipes', {
      title: 'Musterkruste',
      category: 'breads',
    })

    apiClient.put.mockResolvedValue({
      success: true,
      data: recipe,
      pending: false,
      changed: false,
    })
    await expect(
      updateRecipe(recipe, recipe.version, { yield: null })
    ).resolves.toEqual({ recipe, pending: false, changed: false })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/recipes/breads/musterkruste',
      { expectedVersion: recipe.version, yield: null }
    )

    apiClient.delete.mockResolvedValue({
      success: true,
      data: { id: recipe.id, deleted: true },
      pending: true,
    })
    await expect(deleteRecipe(recipe, 'abc 1')).resolves.toEqual({
      pending: true,
    })
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/recipes/breads/musterkruste?expectedVersion=abc%201'
    )
  })
})

describe('recipesApi - Anzeige', () => {
  it('Pfad der Seiten aus Kategorie und Kennung', () => {
    const recipe = { category: 'breads', slug: 'musterkruste' }
    expect(recipeHref(recipe)).toBe('/admin/rezepte/breads/musterkruste')
    expect(recipeEditHref(recipe)).toBe(
      '/admin/rezepte/bearbeiten/breads/musterkruste'
    )
    expect(splitRecipeId('breads/musterkruste')).toEqual(recipe)
    expect(splitRecipeId('breads')).toBeNull()
    expect(splitRecipeId('a/b/c')).toBeNull()
  })

  it('Mengen deutsch; offen bleibt offen, nie 0', () => {
    expect(formatAmount(0.5)).toBe('0,5')
    expect(formatAmount(1465)).toBe('1.465')
    const ing = (
      amount: number | null,
      unit: string | null,
      note: string | null = null
    ) => ({
      name: 'Probemehl',
      amount,
      unit,
      note,
    })
    expect(ingredientAmountText(ing(1465, 'g'))).toBe('1.465 g')
    expect(ingredientAmountText(ing(4, null))).toBe('4')
    expect(ingredientAmountText(ing(null, null))).toBe('offen')
    expect(
      ingredientAmountText(ing(null, null, '3–6 g (nach Geschmack)'))
    ).toBe('3–6 g (nach Geschmack)')
    expect(ingredientNoteText(ing(120, 'g', 'nach Bedarf'))).toBe('nach Bedarf')
    expect(ingredientNoteText(ing(null, null, '3–6 g'))).toBeNull()
    // ein Hinweis ohne Zahl ist keine Menge: „offen“, der Hinweis beim Namen
    const hint = ing(null, null, 'zum Bestreichen')
    expect(ingredientAmountText(hint)).toBe('offen')
    expect(ingredientNoteText(hint)).toBe('zum Bestreichen')
    expect(ingredientAmountOpen(hint)).toBe(true)
    expect(ingredientAmountOpen(ing(null, null))).toBe(true)
    expect(ingredientAmountOpen(ing(null, null, '1 Dose (ca. 3 kg)'))).toBe(
      false
    )
    expect(ingredientAmountOpen(ing(5, 'g'))).toBe(false)
  })

  it('„Ergibt“: offen, Freitext, kein doppeltes „Ergibt“', () => {
    expect(yieldText(null)).toBe('Ergibt: offen')
    expect(yieldText('3 Laibe à 700g')).toBe('Ergibt: 3 Laibe à 700g')
    expect(yieldText('Ergibt ca. 16 Fladen à 110 g')).toBe(
      'Ergibt ca. 16 Fladen à 110 g'
    )
  })

  it('Zutatenzahl, Freigabe-Hinweis, Backzettel-Verwendung', () => {
    expect(ingredientCountText(0)).toBe('keine Zutaten')
    expect(ingredientCountText(1)).toBe('1 Zutat')
    expect(ingredientCountText(13)).toBe('13 Zutaten')
    expect(pendingHint(null)).toBe('')
    expect(pendingHint('created')).toMatch(/Neues Rezept/)
    expect(pendingHint('changed')).toMatch(/wartet auf die Freigabe/)
    expect(pendingHint('deleted')).toMatch(/gelöscht/)
    expect(
      backzettelUseText([
        { kind: 'filling', id: 'nuss', name: 'Testnussfüllung', section: null },
        { kind: 'filling', id: 'nuss', name: 'Testnussfüllung', section: 'x' },
        { kind: 'filling', id: 'mohn', name: '', section: 'Probemohn' },
      ])
    ).toBe('„Testnussfüllung“, „Probemohn“')
  })
})
