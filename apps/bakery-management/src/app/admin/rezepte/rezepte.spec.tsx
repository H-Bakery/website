import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import RecipeListClient from './RecipeListClient'
import RecipeDetailClient from './[category]/[slug]/RecipeDetailClient'
import NewRecipeClient from './neu/NewRecipeClient'
import RecipeEditClient from './bearbeiten/[category]/[slug]/RecipeEditClient'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'
import {
  syntheticFilling,
  syntheticList,
  syntheticRecipe,
  syntheticSummary,
} from '../../../lib/recipeFixtures'
import type { Recipe, RecipeList } from '../../../lib/recipesApi'

/**
 * Rezepte in der Verwaltung: Liste, Rezeptansicht, „Neues Rezept“ und
 * „Bearbeiten“ gegen eine nachgestellte API (`docs/api/recipes.md`).
 * Erfundene Rezepte (`lib/recipeFixtures.ts`).
 */

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

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/rezepte',
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: Record<'get' | 'post' | 'put' | 'delete', jest.Mock>
  ApiError: new (message: string, status: number, code?: string) => Error
}

function mockApi({
  list = syntheticList(),
  recipes = [syntheticRecipe(), syntheticFilling()],
}: { list?: RecipeList; recipes?: Recipe[] } = {}) {
  apiClient.get.mockImplementation(async (url: string) => {
    if (url === '/api/recipes') return { success: true, data: list }
    const found = recipes.find((r) => url === `/api/recipes/${r.id}`)
    if (found) return { success: true, data: found }
    throw new ApiError('Rezept nicht gefunden.', 404, 'not_found')
  })
}

/**
 * Feld füllen. Bewusst `fireEvent` statt `userEvent.type`: Zeichen für
 * Zeichen dauerte der längste Ablauf auf den CI-Runnern länger als die
 * 15 s von Jest.
 */
function fill(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
}

function renderAs(role: PilotRole, ui: React.ReactElement) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>{ui}</WithSession>
  )
}

beforeEach(() => {
  for (const mock of Object.values(apiClient)) mock.mockReset()
  mockPush.mockReset()
})

describe('Rezeptliste (/admin/rezepte)', () => {
  it('zeigt die Rezepte nach Kategorie mit „Ergibt“, Zutatenzahl und Markern', async () => {
    mockApi()
    renderAs('inhaber', <RecipeListClient />)
    const brote = await screen.findByTestId('recipe-group-breads')
    expect(within(brote).getByText('Brote (2)')).toBeInTheDocument()
    const kruste = screen.getByTestId('recipe-row-breads/musterkruste')
    expect(kruste).toHaveAttribute('href', '/admin/rezepte/breads/musterkruste')
    expect(kruste).toHaveTextContent('Ergibt: 3 Laibe à 700g · 5 Zutaten')
    // fehlendes „Ergibt“ ist offen, nie ein Beispielwert
    const laib = screen.getByTestId('recipe-row-breads/probelaib')
    expect(laib).toHaveTextContent('Ergibt: offen · 1 Zutat')
    expect(within(laib).getByTestId('recipe-pending')).toHaveTextContent(
      'wartet auf Freigabe'
    )
    expect(
      within(
        screen.getByTestId('recipe-row-fillings/gefuellte-testkraenze')
      ).getByTestId('recipe-backzettel')
    ).toHaveTextContent('Backzettel')
    expect(
      within(screen.getByTestId('recipe-row-teige/musterteig')).getByTestId(
        'recipe-readonly'
      )
    ).toHaveTextContent('nur lesen')
    expect(
      screen.getByText('1 Änderung wartet auf Freigabe in hq.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Neues Rezept' })).toHaveAttribute(
      'href',
      '/admin/rezepte/neu'
    )
  })

  it('filtert nach Kategorie und gibt sie an „Neues Rezept“ weiter', async () => {
    mockApi()
    renderAs('backstubenleiter', <RecipeListClient />)
    await screen.findByTestId('recipe-group-breads')
    fireEvent.click(screen.getByTestId('recipe-filter-fillings'))
    expect(screen.queryByTestId('recipe-group-breads')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('recipe-row-fillings/gefuellte-testkraenze')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Alle Rezepte (1 von 4)' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Neues Rezept' })).toHaveAttribute(
      'href',
      '/admin/rezepte/neu?kategorie=fillings'
    )
    // Teige sind nicht beschreibbar: keine Vorauswahl
    fireEvent.click(screen.getByTestId('recipe-filter-teige'))
    expect(screen.getByRole('link', { name: 'Neues Rezept' })).toHaveAttribute(
      'href',
      '/admin/rezepte/neu'
    )
  })

  it('„Zurück“ aus einem Rezept: die Filter der Adresse gelten, nicht die des ersten Aufrufs', async () => {
    mockApi()
    const before = window.location.pathname + window.location.search
    // Die Seite kommt über „Zurück“ mit den Angaben ihres ersten Aufrufs
    // (ohne Filter) wieder - die Adresse trägt die zuletzt gewählten.
    window.history.replaceState(
      null,
      '',
      '/admin/rezepte?kategorie=fillings&q=n%C3%BCsse'
    )
    try {
      renderAs('backstube', <RecipeListClient />)
      await screen.findByTestId('recipe-row-fillings/gefuellte-testkraenze')
      expect(
        screen.queryByTestId('recipe-group-breads')
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: 'Rezept oder Zutat suchen' })
      ).toHaveValue('nüsse')
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/recipes',
        expect.objectContaining({ q: 'nüsse' })
      )
      // … und die Adresse behält sie
      expect(window.location.search).toBe('?kategorie=fillings&q=n%C3%BCsse')
    } finally {
      window.history.replaceState(null, '', before)
    }
  })

  it('auf dem Weg zur Liste (Adresse noch die alte Seite) gelten die Filter des Aufrufs', async () => {
    mockApi()
    renderAs(
      'backstube',
      <RecipeListClient initialFilters={{ category: 'fillings', q: '' }} />
    )
    await screen.findByTestId('recipe-row-fillings/gefuellte-testkraenze')
    expect(screen.queryByTestId('recipe-group-breads')).not.toBeInTheDocument()
  })

  it('sucht über die API (auch in Zutaten), sobald das Tippen ruht', async () => {
    jest.useFakeTimers()
    try {
      mockApi()
      renderAs('inhaber', <RecipeListClient />)
      await screen.findByTestId('recipe-group-breads')
      apiClient.get.mockResolvedValueOnce({
        success: true,
        data: syntheticList({ recipes: [syntheticSummary()] }),
      })
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Rezept oder Zutat suchen' }),
        { target: { value: 'probemehl' } }
      )
      expect(apiClient.get).toHaveBeenCalledTimes(1)
      await act(async () => {
        jest.advanceTimersByTime(300)
      })
      await waitFor(() =>
        expect(apiClient.get).toHaveBeenLastCalledWith('/api/recipes', {
          category: undefined,
          q: 'probemehl',
        })
      )
      await waitFor(() =>
        expect(
          screen.queryByTestId('recipe-row-breads/probelaib')
        ).not.toBeInTheDocument()
      )
      expect(
        screen.getByTestId('recipe-row-breads/musterkruste')
      ).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('eine Suche, die noch unterwegs ist, gilt nicht mehr, sobald das Feld wieder leer ist', async () => {
    jest.useFakeTimers()
    try {
      mockApi()
      renderAs('inhaber', <RecipeListClient />)
      await screen.findByTestId('recipe-group-breads')
      // die Antwort auf „probemehl“ lässt auf sich warten (langsame Box)
      let answer: (value: unknown) => void = () => undefined
      apiClient.get.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve
          })
      )
      const field = screen.getByRole('textbox', {
        name: 'Rezept oder Zutat suchen',
      })
      fireEvent.change(field, { target: { value: 'probemehl' } })
      await act(async () => {
        jest.advanceTimersByTime(300)
      })
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/recipes', {
        category: undefined,
        q: 'probemehl',
      })
      // Feld wieder geleert, bevor die Antwort da ist
      fireEvent.change(field, { target: { value: '' } })
      await act(async () => {
        answer({
          success: true,
          data: syntheticList({ recipes: [syntheticSummary()] }),
        })
        jest.advanceTimersByTime(300)
      })
      // die späte Antwort filtert nicht: alle Rezepte bleiben, das Feld ist leer
      expect(field).toHaveValue('')
      expect(
        screen.getByTestId('recipe-row-breads/probelaib')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('recipe-row-fillings/gefuellte-testkraenze')
      ).toBeInTheDocument()
      expect(apiClient.get).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('Backstube liest nur: kein „Neues Rezept“, kein „nur lesen“-Marker', async () => {
    mockApi()
    renderAs('backstube', <RecipeListClient />)
    await screen.findByTestId('recipe-group-breads')
    expect(
      screen.getByText('Rezepte der Backstube zum Nachschlagen')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Neues Rezept' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('recipe-readonly')).not.toBeInTheDocument()
    // der Freigabe-Stand bleibt für alle sichtbar
    expect(screen.getByTestId('recipe-pending')).toBeInTheDocument()
  })

  it('ohne hq-Verzeichnis: „Keine Rezepte vorhanden“ mit der Meldung der API', async () => {
    mockApi({
      list: syntheticList({
        status: 'no-data',
        message: 'Das Rezeptverzeichnis aus hq wurde nicht gefunden.',
        recipes: [],
        writable: false,
      }),
    })
    renderAs('inhaber', <RecipeListClient />)
    const empty = await screen.findByTestId('recipes-no-data')
    expect(empty).toHaveTextContent('Keine Rezepte vorhanden.')
    expect(empty).toHaveTextContent(
      'Das Rezeptverzeichnis aus hq wurde nicht gefunden.'
    )
    expect(
      screen.queryByRole('link', { name: 'Neues Rezept' })
    ).not.toBeInTheDocument()
  })

  it('zeigt den Hinweis nach dem Löschen und Schreibprobleme des Servers', async () => {
    mockApi({
      list: syntheticList({
        writable: false,
        writeIssue: {
          error: 'hq_write_wrong_branch',
          message: 'Das Schreibverzeichnis steht auf dem falschen Branch.',
        },
      }),
    })
    renderAs(
      'inhaber',
      <RecipeListClient flash={{ deleted: 'Testknoten', pending: true }} />
    )
    await screen.findByTestId('recipe-group-breads')
    expect(screen.getByRole('status')).toHaveTextContent(
      '„Testknoten“ wurde gelöscht. Das Löschen wartet auf die Freigabe in hq'
    )
    expect(
      screen.getByText(
        /Speichern ist gerade nicht möglich: Das Schreibverzeichnis/
      )
    ).toBeInTheDocument()
  })

  it('Fehler beim Laden: deutsche Meldung und „Erneut versuchen“', async () => {
    apiClient.get.mockRejectedValueOnce(
      new ApiError('Kein Zugriff auf Rezepte.', 403, 'forbidden')
    )
    renderAs('verkauf', <RecipeListClient />)
    expect(
      await screen.findByText('Kein Zugriff auf Rezepte.')
    ).toBeInTheDocument()
  })
})

describe('Rezeptansicht (/admin/rezepte/<kategorie>/<kennung>)', () => {
  it('zeigt Zutaten je Gruppe, Schritte, Notizen, Angaben und weitere Abschnitte', async () => {
    mockApi()
    renderAs(
      'backstube',
      <RecipeDetailClient category="breads" slug="musterkruste" />
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Musterkruste' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Brote · Ergibt: 3 Laibe à 700g')
    ).toBeInTheDocument()
    const haupt = screen.getByRole('table', { name: 'Hauptteig' })
    const rows = within(haupt).getAllByTestId('recipe-ingredient')
    expect(rows.map((row) => row.textContent)).toEqual([
      '1.465 gProbemehl hell',
      '0,5 gTesthefe',
      // Menge fehlt: „offen“ - nie 0
      'offenProbewasser zum Benetzen',
    ])
    const steps = screen.getByTestId('recipe-preparation')
    expect(within(steps).getByText('Formen')).toBeInTheDocument()
    expect(within(steps).getByText('straff aufrollen')).toBeInTheDocument()
    expect(within(steps).getByText('Stockgare:').tagName).toBe('STRONG')
    expect(screen.getByTestId('recipe-notes')).toHaveTextContent(
      'Haltbarkeit: 5 Tage'
    )
    const meta = screen.getByTestId('recipe-meta')
    expect(meta).toHaveTextContent('Backtemperatur (°C)228')
    expect(meta).toHaveTextContent('Bestätigtoffen')
    expect(screen.getByTestId('recipe-section')).toHaveTextContent(
      'FehlerquellenZu kurze Gare'
    )
  })

  it('Summenzeile der Datei passt nicht mehr zu den Zutaten: Hinweis in Ansicht und Druck', async () => {
    const filling = syntheticFilling()
    mockApi({ recipes: [filling] })
    const { unmount } = renderAs(
      'backstube',
      <RecipeDetailClient category="fillings" slug="gefuellte-testkraenze" />
    )
    expect(await screen.findByTestId('recipe-total')).toHaveTextContent(
      '1.470 gGesamtmasse'
    )
    // passt (oder nicht prüfbar): kein Hinweis
    expect(screen.queryByTestId('recipe-total-stale')).not.toBeInTheDocument()
    unmount()

    const total = filling.parts[0].total
    mockApi({
      recipes: [
        {
          ...filling,
          parts: [
            {
              ...filling.parts[0],
              total: total && { ...total, ingredientSum: '1.480 g' },
            },
          ],
          meta: [
            { key: 'total_mass', label: 'Gesamtmasse (g)', value: '1.470' },
          ],
        },
      ],
    })
    renderAs(
      'backstube',
      <RecipeDetailClient category="fillings" slug="gefuellte-testkraenze" />
    )
    expect(await screen.findByTestId('recipe-total-stale')).toHaveTextContent(
      'Summe aus der Rezeptdatei - die Zutaten ergeben zusammen 1.480 g.'
    )
    // Angaben aus dem Kopf der Datei: als Stand der Datei gekennzeichnet
    expect(screen.getByTestId('recipe-meta')).toHaveTextContent(
      'Stand der Rezeptdatei - diese Angaben werden in der App nicht geändert und nicht neu berechnet.'
    )
  })

  it('offene Menge mit Hinweis: „offen“ in der Mengenspalte, der Hinweis beim Namen', async () => {
    mockApi({
      recipes: [
        syntheticFilling({
          parts: [
            {
              title: 'Testnussfüllung',
              ingredients: [
                {
                  name: 'Probestreiche',
                  amount: null,
                  unit: null,
                  note: 'zum Bestreichen',
                },
                {
                  name: 'Probegewürz',
                  amount: null,
                  unit: null,
                  note: '3–6 g (nach Geschmack)',
                },
                { name: 'Musterzucker', amount: 120, unit: 'g', note: 'fein' },
              ],
              total: null,
            },
          ],
        }),
      ],
    })
    renderAs(
      'backstube',
      <RecipeDetailClient category="fillings" slug="gefuellte-testkraenze" />
    )
    const table = await screen.findByRole('table', { name: 'Testnussfüllung' })
    const amounts = within(table)
      .getAllByTestId('ingredient-amount')
      .map((cell) => cell.textContent)
    // ein Hinweis ohne Zahl ist keine Menge; ein Mengentext der Datei schon
    expect(amounts).toEqual(['offen', '3–6 g (nach Geschmack)', '120 g'])
    expect(
      within(table)
        .getAllByTestId('recipe-ingredient')
        .map((row) => row.textContent)
    ).toEqual([
      'offenProbestreiche (zum Bestreichen)',
      '3–6 g (nach Geschmack)Probegewürz',
      '120 gMusterzucker (fein)',
    ])
  })

  it('Backstube: drucken ja, bearbeiten und löschen nein', async () => {
    mockApi()
    renderAs(
      'backstube',
      <RecipeDetailClient category="breads" slug="musterkruste" />
    )
    await screen.findByRole('heading', { level: 1, name: 'Musterkruste' })
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Bearbeiten' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Löschen' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('recipe-file')).not.toBeInTheDocument()
  })

  it.each<PilotRole>(['inhaber', 'backstubenleiter'])(
    '%s: „Bearbeiten“ führt zum Formular',
    async (role) => {
      mockApi()
      renderAs(
        role,
        <RecipeDetailClient category="breads" slug="musterkruste" />
      )
      expect(
        await screen.findByRole('link', { name: 'Bearbeiten' })
      ).toHaveAttribute('href', '/admin/rezepte/bearbeiten/breads/musterkruste')
      expect(
        screen.getByRole('button', { name: 'Löschen' })
      ).toBeInTheDocument()
    }
  )

  it('vom Backzettel verwendet: bearbeitbar, nicht löschbar, mit Hinweis', async () => {
    mockApi()
    renderAs(
      'backstubenleiter',
      <RecipeDetailClient category="fillings" slug="gefuellte-testkraenze" />
    )
    expect(
      await screen.findByTestId('recipe-backzettel-hint')
    ).toHaveTextContent(
      'Der Backzettel verwendet dieses Rezept („Testnussfüllung“). Es lässt sich ändern, aber nicht löschen'
    )
    expect(screen.getByRole('link', { name: 'Bearbeiten' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Löschen' })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('recipe-file')).toHaveTextContent(
      'nicht löschen oder verschieben'
    )
    expect(screen.getByText('Füllungen · Ergibt: offen')).toBeInTheDocument()
    // Tabellen-Datei: Hinweis neben dem Namen, Text statt Zahl, Summenzeile
    const rows = screen.getAllByTestId('recipe-ingredient')
    expect(rows[1]).toHaveTextContent('120 gMusterzucker (nach Bedarf)')
    expect(rows[2]).toHaveTextContent('3–6 g (nach Geschmack)Probegewürz')
    expect(screen.getByTestId('recipe-total')).toHaveTextContent(
      '1.470 gGesamtmasse'
    )
  })

  it('nur lesbares Rezept: Grund statt „Bearbeiten“', async () => {
    mockApi({
      recipes: [
        syntheticRecipe({
          id: 'teige/musterteig',
          category: 'teige',
          slug: 'musterteig',
          editable: false,
          readOnlyReason: 'Teig-Rezepte werden vorerst nur in hq gepflegt.',
          deletable: false,
          deleteBlockedReason:
            'Teig-Rezepte werden vorerst nur in hq gepflegt.',
        }),
      ],
    })
    renderAs(
      'inhaber',
      <RecipeDetailClient category="teige" slug="musterteig" />
    )
    expect(await screen.findByTestId('recipe-readonly-hint')).toHaveTextContent(
      'Nur zum Ansehen: Teig-Rezepte werden vorerst nur in hq gepflegt.'
    )
    expect(
      screen.queryByRole('link', { name: 'Bearbeiten' })
    ).not.toBeInTheDocument()
  })

  it('wartet auf Freigabe: Marker im Kopf und Hinweis; nach dem Speichern die Bestätigung', async () => {
    mockApi({
      recipes: [syntheticRecipe({ pending: 'changed', pendingApproval: true })],
    })
    const view = renderAs(
      'backstube',
      <RecipeDetailClient category="breads" slug="musterkruste" />
    )
    expect(await screen.findByTestId('recipe-pending-hint')).toHaveTextContent(
      'Diese Änderung ist gespeichert und wartet auf die Freigabe in hq.'
    )
    expect(screen.getByTestId('recipe-pending')).toHaveTextContent(
      'wartet auf Freigabe'
    )
    view.unmount()
    renderAs(
      'inhaber',
      <RecipeDetailClient
        category="breads"
        slug="musterkruste"
        flash="gespeichert-wartet"
      />
    )
    await screen.findByRole('heading', { level: 1, name: 'Musterkruste' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Gespeichert - die Änderung wartet jetzt auf die Freigabe in hq.'
    )
    // nicht zweimal dasselbe sagen
    expect(screen.queryByTestId('recipe-pending-hint')).not.toBeInTheDocument()
  })

  it('löschen: erst nach Bestätigung, mit dem geladenen Stand', async () => {
    mockApi()
    apiClient.delete.mockResolvedValue({
      success: true,
      data: { id: 'breads/musterkruste', deleted: true },
      pending: true,
    })
    renderAs(
      'inhaber',
      <RecipeDetailClient category="breads" slug="musterkruste" />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Rezept löschen?',
    })
    expect(dialog).toHaveTextContent('„Musterkruste“ (Brote) wird gelöscht.')
    expect(apiClient.delete).not.toHaveBeenCalled()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Rezept löschen' })
    )
    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/recipes/breads/musterkruste?expectedVersion=aaaaaaaaaaaaaaaaaaaaaaaa'
      )
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/admin/rezepte?geloescht=Musterkruste&wartet=1'
      )
    )
  })

  it('löschen abgelehnt (Backzettel verwendet es inzwischen): Meldung im Dialog, nichts verlassen', async () => {
    mockApi()
    apiClient.delete.mockRejectedValue(
      new ApiError(
        'Der Backzettel verwendet dieses Rezept (Testbrot).',
        409,
        'recipe_in_use'
      )
    )
    renderAs(
      'inhaber',
      <RecipeDetailClient category="breads" slug="musterkruste" />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Rezept löschen' })
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Der Backzettel verwendet dieses Rezept (Testbrot).'
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('unbekanntes Rezept: „gibt es nicht (mehr)“', async () => {
    mockApi()
    renderAs('inhaber', <RecipeDetailClient category="breads" slug="fehlt" />)
    expect(await screen.findByTestId('recipe-missing')).toHaveTextContent(
      'Dieses Rezept gibt es nicht (mehr).'
    )
  })
})

describe('Neues Rezept (/admin/rezepte/neu)', () => {
  it('legt ein Rezept an: Zeilen hinzufügen, umsortieren, entfernen - offen bleibt offen', async () => {
    mockApi()
    const created = syntheticRecipe({
      id: 'cakes/testschnitte',
      category: 'cakes',
      slug: 'testschnitte',
      title: 'Testschnitte',
    })
    apiClient.post.mockResolvedValue({
      success: true,
      data: created,
      pending: true,
      changed: true,
    })
    renderAs('backstubenleiter', <NewRecipeClient initialCategory="cakes" />)
    fill(await screen.findByRole('textbox', { name: /Name/ }), 'Testschnitte')
    // Kategorie aus der Adresse vorgewählt; Teige stehen nicht zur Wahl
    expect(
      screen.getByRole('combobox', { name: 'Kategorie' })
    ).toHaveTextContent('Kuchen')
    const part = screen.getByTestId('part-form')
    const firstRow = () => within(part).getAllByTestId('ingredient-row')
    fill(within(firstRow()[0]).getByRole('textbox', { name: 'Menge' }), '0,5')
    fill(
      within(firstRow()[0]).getByRole('textbox', { name: 'Zutat' }),
      'Testhefe'
    )
    fireEvent.click(
      within(part).getByRole('button', { name: 'Zutat hinzufügen' })
    )
    expect(firstRow()).toHaveLength(2)
    // der Cursor steht in der neuen Zeile
    expect(
      within(firstRow()[1]).getByRole('textbox', { name: 'Menge' })
    ).toHaveFocus()
    fill(
      within(firstRow()[1]).getByRole('textbox', { name: 'Zutat' }),
      'Probemehl'
    )
    // Enter in der letzten Zeile: nächste Zeile
    fireEvent.keyDown(
      within(firstRow()[1]).getByRole('textbox', { name: 'Zutat' }),
      { key: 'Enter' }
    )
    expect(firstRow()).toHaveLength(3)
    fill(
      within(firstRow()[2]).getByRole('textbox', { name: 'Zutat' }),
      'Überflüssig'
    )
    fireEvent.click(
      within(part).getByRole('button', { name: 'Zutat 3 entfernen' })
    )
    expect(firstRow()).toHaveLength(2)
    // Probemehl nach oben
    fireEvent.click(
      within(part).getByRole('button', { name: 'Zutat 2 nach oben' })
    )
    expect(
      within(firstRow()[0]).getByRole('textbox', { name: 'Zutat' })
    ).toHaveValue('Probemehl')
    expect(
      within(part).getByRole('button', { name: 'Zutat 1 nach oben' })
    ).toBeDisabled()

    fill(screen.getByRole('textbox', { name: 'Schritt 1' }), 'Alles verrühren')
    fireEvent.click(screen.getByRole('button', { name: 'Rezept anlegen' }))

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1))
    expect(apiClient.post).toHaveBeenCalledWith('/api/recipes', {
      title: 'Testschnitte',
      category: 'cakes',
      yield: null,
      description: null,
      parts: [
        {
          title: null,
          ingredients: [
            { name: 'Probemehl', amount: null, unit: null, note: null },
            { name: 'Testhefe', amount: 0.5, unit: null, note: null },
          ],
        },
      ],
      steps: [{ title: null, ordered: true, items: ['Alles verrühren'] }],
      notes: null,
    })
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/admin/rezepte/cakes/testschnitte?gespeichert=angelegt-wartet'
      )
    )
  })

  it('prüft vor dem Senden: Name fehlt, Menge keine Zahl - nichts wird geschickt', async () => {
    mockApi()
    renderAs('inhaber', <NewRecipeClient />)
    const row = (await screen.findAllByTestId('ingredient-row'))[0]
    fill(within(row).getByRole('textbox', { name: 'Menge' }), 'viel')
    fill(within(row).getByRole('textbox', { name: 'Zutat' }), 'Probemehl')
    fireEvent.click(screen.getByRole('button', { name: 'Rezept anlegen' }))
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Nicht gespeichert: bitte die 2 markierten Angaben prüfen.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bitte einen Namen für das Rezept angeben.')
    ).toBeInTheDocument()
    expect(
      within(row).getByText(/Bitte eine Zahl eingeben/)
    ).toBeInTheDocument()
    // Korrigieren räumt die Markierung ab
    fill(within(row).getByRole('textbox', { name: 'Menge' }), '')
    expect(
      within(row).queryByText(/Bitte eine Zahl eingeben/)
    ).not.toBeInTheDocument()
  })

  it('zeigt die deutsche Meldung der API (Name schon vergeben)', async () => {
    mockApi()
    apiClient.post.mockRejectedValue(
      new ApiError(
        'Ein Rezept mit diesem Namen gibt es in dieser Kategorie schon.',
        409,
        'recipe_exists'
      )
    )
    renderAs('inhaber', <NewRecipeClient />)
    fill(await screen.findByRole('textbox', { name: /Name/ }), 'Musterkruste')
    fireEvent.click(screen.getByRole('button', { name: 'Rezept anlegen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ein Rezept mit diesem Namen gibt es in dieser Kategorie schon.'
    )
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Rezept anlegen' })).toBeEnabled()
  })

  it('ohne hq-Verzeichnis kein Formular', async () => {
    mockApi({
      list: syntheticList({
        status: 'no-data',
        recipes: [],
        message: 'hq fehlt.',
      }),
    })
    renderAs('inhaber', <NewRecipeClient />)
    expect(
      await screen.findByText('Rezepte lassen sich hier gerade nicht anlegen.')
    ).toBeInTheDocument()
    expect(screen.getByText('hq fehlt.')).toBeInTheDocument()
  })
})

describe('Rezept bearbeiten (/admin/rezepte/bearbeiten/…)', () => {
  it('schickt nur das Geänderte, mit dem geladenen Stand als expectedVersion', async () => {
    mockApi()
    const saved = syntheticRecipe({ version: 'bbbbbbbbbbbbbbbbbbbbbbbb' })
    apiClient.put.mockResolvedValue({
      success: true,
      data: saved,
      pending: true,
      changed: true,
    })
    renderAs(
      'backstubenleiter',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    const haupt = await screen.findByRole('group', {
      name: 'Zutatengruppe Hauptteig',
    })
    const hefe = within(haupt).getAllByTestId('ingredient-row')[1]
    const amount = within(hefe).getByRole('textbox', { name: 'Menge' })
    expect(amount).toHaveValue('0,5')
    // offene Menge: leeres Feld, kein „0“
    expect(
      within(within(haupt).getAllByTestId('ingredient-row')[2]).getByRole(
        'textbox',
        { name: 'Menge' }
      )
    ).toHaveValue('')
    fill(amount, '')
    fill(amount, '0,75')
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1))
    const [url, body] = apiClient.put.mock.calls[0]
    expect(url).toBe('/api/recipes/breads/musterkruste')
    expect(Object.keys(body).sort()).toEqual(['expectedVersion', 'parts'])
    expect(body.expectedVersion).toBe('aaaaaaaaaaaaaaaaaaaaaaaa')
    expect(body.parts[1].ingredients[1]).toEqual({
      name: 'Testhefe',
      amount: 0.75,
      unit: 'g',
      note: null,
    })
    expect(body.parts[0]).toEqual({
      title: 'Testsauer',
      ingredients: syntheticRecipe().parts[0].ingredients,
    })
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/admin/rezepte/breads/musterkruste?gespeichert=gespeichert-wartet'
      )
    )
  })

  it('ohne Änderung wird nichts gespeichert', async () => {
    mockApi()
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    await screen.findByRole('group', { name: 'Zutatengruppe Hauptteig' })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(
      screen.getByText('Nichts geändert - es gibt nichts zu speichern.')
    ).toBeInTheDocument()
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it('veralteter Stand (409 stale_recipe): Meldung und „Aktuellen Stand laden“', async () => {
    mockApi()
    apiClient.put.mockRejectedValue(
      new ApiError(
        'Das Rezept wurde inzwischen geändert. Bitte neu laden und die Änderung noch einmal eintragen.',
        409,
        'stale_recipe'
      )
    )
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    const name = await screen.findByRole('textbox', { name: /Name/ })
    fill(name, 'Musterkruste neu')
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Das Rezept wurde inzwischen geändert.')
    expect(mockPush).not.toHaveBeenCalled()
    // die Eingabe bleibt stehen, bis man den neuen Stand lädt
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue(
      'Musterkruste neu'
    )
    mockApi({ recipes: [syntheticRecipe({ title: 'Musterkruste (Stand 2)' })] })
    fireEvent.click(
      within(alert).getByRole('button', { name: 'Aktuellen Stand laden' })
    )
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue(
        'Musterkruste (Stand 2)'
      )
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('vom Backzettel verwendet: Hinweis, Kategorie und Gruppenname fest, Hinweis-Feld der Tabelle', async () => {
    mockApi()
    renderAs(
      'inhaber',
      <RecipeEditClient category="fillings" slug="gefuellte-testkraenze" />
    )
    expect(
      await screen.findByTestId('recipe-backzettel-hint')
    ).toHaveTextContent(
      'Der Backzettel verwendet dieses Rezept („Testnussfüllung“)'
    )
    expect(screen.getByRole('combobox', { name: 'Kategorie' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(
      screen.getByText(
        'Der Backzettel verwendet dieses Rezept - die Kategorie bleibt.'
      )
    ).toBeInTheDocument()
    const group = screen.getByRole('group', {
      name: 'Zutatengruppe Testnussfüllung',
    })
    expect(
      within(group).getByRole('textbox', { name: 'Gruppe' })
    ).toBeDisabled()
    expect(
      within(group).getByText(
        'Der Backzettel liest diese Gruppe - der Name bleibt.'
      )
    ).toBeInTheDocument()
    const rows = within(group).getAllByTestId('ingredient-row')
    expect(
      within(rows[1]).getByRole('textbox', { name: 'Hinweis' })
    ).toHaveValue('nach Bedarf')
    expect(within(rows[2]).getByRole('textbox', { name: 'Menge' })).toHaveValue(
      ''
    )
    expect(
      within(rows[2]).getByRole('textbox', { name: 'Hinweis' })
    ).toHaveValue('3–6 g (nach Geschmack)')
    expect(screen.getByTestId('part-total-note')).toHaveTextContent(
      'Summenzeile der Datei: Gesamtmasse 1.470 g - sie wird nicht neu berechnet.'
    )
  })

  it('verschieben nur, wenn es freigeschaltet ist', async () => {
    mockApi({ list: syntheticList({ canDelete: false, deleteIssue: 'aus' }) })
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    expect(
      await screen.findByText(
        'Verschieben in eine andere Kategorie ist noch nicht freigeschaltet.'
      )
    ).toBeInTheDocument()
  })

  it('nennt, was unverändert bleibt (Angaben, weitere Abschnitte)', async () => {
    mockApi()
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    expect(await screen.findByTestId('recipe-untouched')).toHaveTextContent(
      'Angaben: Backtemperatur (°C), Bestätigt · Abschnitte: Fehlerquellen'
    )
  })

  it('nur lesbares Rezept: kein Formular, sondern der Grund', async () => {
    mockApi({
      recipes: [
        syntheticRecipe({
          editable: false,
          readOnlyReason: 'Zeile 12: Freitext zwischen den Zutaten.',
        }),
      ],
    })
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    const blocked = await screen.findByTestId('recipe-edit-readonly')
    expect(blocked).toHaveTextContent(
      'Dieses Rezept lässt sich hier nicht ändern.'
    )
    expect(blocked).toHaveTextContent(
      'Zeile 12: Freitext zwischen den Zutaten.'
    )
    expect(
      screen.queryByRole('button', { name: 'Speichern' })
    ).not.toBeInTheDocument()
  })

  it('Gruppe mit Zutaten entfernen fragt nach', async () => {
    mockApi()
    renderAs(
      'inhaber',
      <RecipeEditClient category="breads" slug="musterkruste" />
    )
    await screen.findByRole('group', { name: 'Zutatengruppe Hauptteig' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Gruppe Testsauer entfernen' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Gruppe entfernen?',
    })
    expect(dialog).toHaveTextContent(
      '„Testsauer“ mit 2 Zutaten wird aus dem Rezept entfernt.'
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Gruppe entfernen' })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('group', { name: 'Zutatengruppe Testsauer' })
      ).not.toBeInTheDocument()
    )
  })
})
