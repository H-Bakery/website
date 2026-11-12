/**
 * @fileoverview Rezepte in der Verwaltung gegen die echte API
 * (`/admin/rezepte`, `docs/domains/rezepte.md`).
 *
 * Die API liest die erfundenen Rezepte aus `tools/e2e/hq-recipes` (Kopie im
 * Temp-Verzeichnis, `prepareE2eHq()`). Ohne Schreib-Worktree speichert sie
 * direkt in diese Wegwerf-Kopie - das Repo und ein echtes `hq` bleiben
 * unberührt. Das Rezept, das die Suite anlegt, trägt den Projektnamen
 * (Desktop und Handy laufen gegen dieselbe API) und wird am Ende gelöscht.
 */

import { expect, test, type Page } from '@playwright/test'
import { apiGet, apiStatus, signIn } from './login'

interface RecipeRow {
  id: string
  category: string
  slug: string
  title: string
  yield: string | null
  editable: boolean
}

interface RecipeListBody {
  data: {
    status: string
    recipes: RecipeRow[]
    canDelete: boolean
  }
}

const rows = (page: Page) => page.locator('[data-testid^="recipe-row-"]')

async function recipeList(): Promise<RecipeListBody['data']> {
  return (await apiGet<RecipeListBody>('/api/recipes')).data
}

test.describe('Rezepte', () => {
  test('Inhaber: Liste aus /api/recipes, Suche in Zutaten, Rezeptansicht', async ({
    page,
  }) => {
    const list = await recipeList()
    expect(list.status).toBe('ok')
    expect(list.recipes.length).toBeGreaterThan(0)
    const bread = list.recipes.find((r) => r.id === 'breads/musterkruste')
    expect(bread, 'Fixture breads/musterkruste fehlt').toBeTruthy()

    await signIn(page)
    await page.goto('/admin/rezepte')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rezepte')
    // Mindestens so viele wie beim Abruf - der andere Lauf (Desktop/Handy)
    // legt gleichzeitig sein eigenes Rezept an.
    await expect(rows(page).first()).toBeVisible()
    expect(await rows(page).count()).toBeGreaterThanOrEqual(
      list.recipes.length - 1
    )
    await expect(page.getByRole('link', { name: 'Neues Rezept' })).toBeVisible()

    // Suche trifft eine Zutat, nicht nur den Namen
    await page
      .getByRole('textbox', { name: 'Rezept oder Zutat suchen' })
      .fill('Testsaat')
    await expect(
      page.getByTestId('recipe-row-breads/musterkruste')
    ).toBeVisible()
    await expect(page.getByTestId('recipe-row-cakes/testkuchen')).toHaveCount(0)

    await page.getByTestId('recipe-row-breads/musterkruste').click()
    await expect(page).toHaveURL(/\/admin\/rezepte\/breads\/musterkruste$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      bread?.title ?? ''
    )
    const ingredients = page.getByTestId('recipe-ingredients')
    await expect(
      ingredients.getByTestId('recipe-ingredient').first()
    ).toBeVisible()
    // Eine Zutat ohne Menge ist „offen“, nie 0
    await expect(
      ingredients
        .getByTestId('recipe-ingredient')
        .filter({ hasText: 'Probewasser zum Benetzen' })
        .getByTestId('ingredient-amount')
    ).toHaveText('offen')
    await expect(page.getByTestId('recipe-preparation')).toContainText(
      'straff aufrollen'
    )
    await expect(page.getByRole('button', { name: 'Drucken' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toBeVisible()
    // kein waagrechtes Scrollen (Tablet/Handy)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    ).toBeLessThanOrEqual(0)
  })

  test('Teig-Rezept: nur zum Ansehen, auch für den Inhaber', async ({
    page,
  }) => {
    await signIn(page)
    await page.goto('/admin/rezepte/teige/musterteig')
    await expect(page.getByTestId('recipe-readonly-hint')).toContainText(
      'Nur zum Ansehen'
    )
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
    await page.goto('/admin/rezepte/bearbeiten/teige/musterteig')
    await expect(page.getByTestId('recipe-edit-readonly')).toBeVisible()
  })

  test('Backstubenleitung: anlegen, ändern, löschen', async ({
    page,
  }, testInfo) => {
    const title = `E2E-Probestück ${testInfo.project.name}`
    const slug = `e2e-probestueck-${testInfo.project.name}`
    const id = `snacks/${slug}`
    // Rest eines abgebrochenen Laufs gegen eine wiederverwendete API
    const leftover = await apiGet<{ data: { version: string } }>(
      `/api/recipes/${id}`
    ).catch(() => null)
    if (leftover) {
      await apiStatus(
        'DELETE',
        `/api/recipes/${id}?expectedVersion=${leftover.data.version}`,
        'inhaber'
      )
    }

    await signIn(page, 'leitung')
    await page.goto('/admin/rezepte/neu')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Neues Rezept'
    )
    await page.getByRole('textbox', { name: /^Name/ }).fill(title)
    await page.getByRole('combobox', { name: 'Kategorie' }).click()
    await page.getByRole('option', { name: 'Snacks' }).click()
    await page.getByRole('textbox', { name: 'Ergibt' }).fill('12 Stück')

    const ingredientRows = page.getByTestId('ingredient-row')
    await ingredientRows
      .nth(0)
      .getByRole('textbox', { name: 'Menge' })
      .fill('500')
    await ingredientRows
      .nth(0)
      .getByRole('combobox', { name: 'Einheit' })
      .click()
    await page.getByRole('option', { name: 'g', exact: true }).click()
    await ingredientRows
      .nth(0)
      .getByRole('textbox', { name: 'Zutat' })
      .fill('Probemehl')
    await page.getByRole('button', { name: 'Zutat hinzufügen' }).click()
    await expect(ingredientRows).toHaveCount(2)
    // zweite Zutat ohne Menge: bleibt offen
    await ingredientRows
      .nth(1)
      .getByRole('textbox', { name: 'Zutat' })
      .fill('Testsaat zum Bestreuen')
    await page
      .getByRole('textbox', { name: 'Schritt 1' })
      .fill('Alles verkneten')
    await page.getByRole('button', { name: 'Rezept anlegen' }).click()

    await expect(page).toHaveURL(new RegExp(`/admin/rezepte/${id}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.getByText('Rezept angelegt.')).toBeVisible()
    await expect(page.getByText('Snacks · Ergibt: 12 Stück')).toBeVisible()
    const shown = page.getByTestId('recipe-ingredient')
    await expect(shown).toHaveCount(2)
    await expect(shown.nth(0)).toContainText('500 g')
    await expect(shown.nth(1).getByTestId('ingredient-amount')).toHaveText(
      'offen'
    )

    // Ändern: Menge und ein weiterer Schritt
    await page.getByRole('link', { name: 'Bearbeiten' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/rezepte/bearbeiten/${id}$`))
    const amount = ingredientRows.nth(0).getByRole('textbox', { name: 'Menge' })
    await expect(amount).toHaveValue('500')
    await amount.fill('0,75')
    await ingredientRows
      .nth(0)
      .getByRole('combobox', { name: 'Einheit' })
      .click()
    await page.getByRole('option', { name: 'kg', exact: true }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/rezepte/${id}$`))
    await expect(page.getByText('Gespeichert.')).toBeVisible()
    await expect(page.getByTestId('recipe-ingredient').nth(0)).toContainText(
      '0,75 kg'
    )

    // Löschen mit Rückfrage
    const list = await recipeList()
    test.skip(!list.canDelete, 'Löschen ist auf diesem Server abgeschaltet.')
    await page.getByRole('button', { name: 'Löschen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Rezept löschen?' })
    await expect(dialog).toContainText(title)
    await dialog.getByRole('button', { name: 'Rezept löschen' }).click()
    await expect(page).toHaveURL(/\/admin\/rezepte(\?|$)/)
    await expect(page.getByText(`„${title}“ wurde gelöscht.`)).toBeVisible()
    await expect(page.getByTestId(`recipe-row-${id}`)).toHaveCount(0)
  })

  test('Backstube liest nur - Oberfläche, Seiten-Sperre und API', async ({
    page,
  }) => {
    await signIn(page, 'backstube')
    await page.goto('/admin/rezepte')
    await expect(rows(page).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Neues Rezept' })).toHaveCount(
      0
    )
    await page.getByTestId('recipe-row-breads/musterkruste').click()
    await expect(page).toHaveURL(/\/admin\/rezepte\/breads\/musterkruste$/)
    await expect(page.getByTestId('recipe-ingredient').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)

    for (const path of [
      '/admin/rezepte/neu',
      '/admin/rezepte/bearbeiten/breads/musterkruste',
    ]) {
      await page.goto(path)
      await expect(page.getByText(/Kein Zugriff/).first()).toBeVisible()
    }
    // Die Oberfläche führt nur - durchgesetzt wird in der API.
    expect(await apiStatus('GET', '/api/recipes', 'backstube')).toBe(200)
    expect(
      await apiStatus('POST', '/api/recipes', 'backstube', {
        title: 'Darf nicht entstehen',
        category: 'snacks',
      })
    ).toBe(403)
    expect(
      await apiStatus('PUT', '/api/recipes/breads/musterkruste', 'backstube', {
        expectedVersion: 'x',
        yield: null,
      })
    ).toBe(403)
  })

  test('Verkauf hat keine Rezepte', async ({ page }) => {
    await signIn(page, 'verkauf')
    await page.goto('/admin/rezepte')
    await expect(page.getByText(/Kein Zugriff/).first()).toBeVisible()
    expect(await apiStatus('GET', '/api/recipes', 'verkauf')).toBe(403)
  })

  test('Backstubenleitung: Backzettel und Backstube wie die Backstube, sonst nichts', async ({
    page,
  }) => {
    await signIn(page, 'leitung')
    await page.goto('/admin/hilfe')
    await expect(page.getByTestId('tab-backstubenleiter')).toContainText(
      'Backstubenleitung (Ihre Rolle)'
    )
    await page.goto('/admin/backzettel/grundmengen')
    await expect(page.getByText(/Kein Zugriff/)).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Grundmengen'
    )
    await page.goto('/admin/products')
    await expect(page.getByText(/Kein Zugriff/).first()).toBeVisible()
    expect(await apiStatus('GET', '/api/users', 'leitung')).toBe(403)
  })

  test('Benutzerverwaltung bietet die Rolle Backstubenleitung an', async ({
    page,
  }) => {
    await signIn(page)
    await page.goto('/admin/users')
    await page.getByRole('button', { name: 'Neuer Benutzer' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox', { name: 'Rolle' }).click()
    await expect(
      page.getByRole('option', { name: 'Backstubenleitung' })
    ).toBeVisible()
    // das von der Suite angelegte Konto trägt die Rolle in der Liste
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('user-row-e2e.leitung')).toContainText(
      'Backstubenleitung'
    )
  })
})
