import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import GrundmengenClient, { REFERENCE_TOOLTIP } from './GrundmengenClient'
import {
  syntheticConfig,
  syntheticReference,
  syntheticView,
} from '../../../../lib/grundmengenFixtures'
import type { BackzettelConfigView } from '../../../../lib/grundmengenApi'

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
  return { ApiError, apiClient: { get: jest.fn(), put: jest.fn() } }
})

const sessionState: { user: { role: string } | null } = {
  user: { role: 'backstube' },
}
jest.mock('../../../../lib/session', () => ({
  useOptionalSession: () => sessionState,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; put: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

function mockGet(view: BackzettelConfigView = syntheticView()) {
  apiClient.get.mockImplementation(async (url: string) => {
    if (url === '/api/backzettel/config') return { success: true, data: view }
    if (url === '/api/backzettel/reference') {
      return { success: true, data: syntheticReference() }
    }
    throw new Error(`unexpected ${url}`)
  })
}

/** Das Bildschirm-Raster (das Druckbild ist `aria-hidden`). */
function grid(): HTMLElement {
  return screen.getByRole('table', { name: 'Grundmengen je Wochentag' })
}

function input(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.put.mockReset()
  sessionState.user = { role: 'backstube' }
})

describe('GrundmengenClient', () => {
  it('zeigt Posten × Di–So nach Abschnitt, Sorten-Zeilen und Einheit', async () => {
    mockGet()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    for (const day of ['Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(
        screen.getByRole('columnheader', { name: day })
      ).toBeInTheDocument()
    }
    expect(within(grid()).getByText('Brot')).toBeInTheDocument()
    expect(within(grid()).getByText('Brötchen')).toBeInTheDocument()
    expect(within(grid()).getByText('Hefeteig')).toBeInTheDocument()
    const brot = screen.getByTestId('row-testbrot')
    expect(within(brot).getByText('Liter')).toBeInTheDocument()
    expect(screen.getByTestId('row-testzopf-nuss')).toHaveTextContent(
      'Nussfüllung'
    )
    expect(screen.getByTestId('row-testzopf-mohn')).toHaveTextContent(
      'Mohnfüllung'
    )
    // Werte: Zahl, kein Eintrag = 0, offen = leer
    expect(input('Testweck, Dienstag').value).toBe('40')
    expect(input('Testweck, Donnerstag').value).toBe('0')
    expect(input('Testbrot, Samstag').value).toBe('')
    expect(input('Testbrot, Mittwoch').value).toBe('4,5')
    expect(input('Testzopf gefüllt (Nussfüllung), Samstag').value).toBe('4')
    expect(input('Testzopf gefüllt (Mohnfüllung), Samstag').value).toBe('')
  })

  it('Referenz grau daneben, mit Tooltip-Text - nie übernommen', async () => {
    mockGet()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const row = screen.getByTestId('row-testweck')
    await waitFor(() =>
      expect(
        within(row).getByLabelText(`${REFERENCE_TOOLTIP}: 38`)
      ).toBeInTheDocument()
    )
    // Liter-Posten: Stück laut Kasse
    expect(
      within(screen.getByTestId('row-testbrot')).getAllByLabelText(
        `${REFERENCE_TOOLTIP}: 7 St.`
      ).length
    ).toBeGreaterThan(0)
    // Der Median steht nie im Eingabefeld
    expect(input('Testweck, Dienstag').value).toBe('40')
    expect(apiClient.put).not.toHaveBeenCalled()
    expect(apiClient.get).toHaveBeenCalledWith('/api/backzettel/reference', {
      weeks: 6,
    })
  })

  it('speichert eine Zelle mit Enter und übernimmt den neuen Stand', async () => {
    mockGet()
    const after = syntheticConfig()
    after.items[1].base = { ...after.items[1].base, 2: 45 }
    apiClient.put.mockResolvedValue({
      success: true,
      data: {
        ...syntheticView({
          working: { status: 'ok', config: after, errors: [], warnings: [] },
          pendingApproval: true,
        }),
        pending: true,
        changed: true,
      },
    })
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const field = input('Testweck, Dienstag')
    await user.clear(field)
    await user.type(field, '45{Enter}')
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/backzettel/config/base',
        {
          itemId: 'testweck',
          weekday: 2,
          value: 45,
        }
      )
    )
    const banner = await screen.findByTestId('pending-banner')
    expect(banner).toHaveTextContent('Wartet auf Freigabe')
    // Hinweis, kein Alarm: Screenreader lesen ihn nicht bei jedem Laden vor
    expect(banner).toHaveAttribute('role', 'status')
    expect(input('Testweck, Dienstag')).toHaveAttribute('data-changed', 'true')
    expect(
      screen.getByText(/Gespeichert: Testweck, Dienstag/)
    ).toBeInTheDocument()
  })

  it('Sorte speichern schickt variants; Leeren heißt „offen" (null)', async () => {
    mockGet()
    apiClient.put.mockResolvedValue({
      success: true,
      data: { ...syntheticView(), pending: false, changed: true },
    })
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const mohn = input('Testzopf gefüllt (Mohnfüllung), Samstag')
    await user.type(mohn, '2')
    await user.tab()
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenLastCalledWith(
        '/api/backzettel/config/base',
        { itemId: 'testzopf', weekday: 6, variants: { mohn: 2 } }
      )
    )
    const weck = input('Testweck, Mittwoch')
    await user.clear(weck)
    await user.tab()
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenLastCalledWith(
        '/api/backzettel/config/base',
        { itemId: 'testweck', weekday: 3, value: null }
      )
    )
  })

  it('ohne Änderung kein Speichern; Unsinn wird markiert, nicht geschickt', async () => {
    mockGet()
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const field = input('Testweck, Freitag')
    await user.click(field)
    await user.tab()
    await user.clear(field)
    await user.type(field, 'viel{Enter}')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    await user.keyboard('{Escape}')
    expect(field.value).toBe('0')
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it('zeigt Prüffehler des Servers und markiert die Zelle', async () => {
    mockGet()
    apiClient.put.mockRejectedValue(
      new ApiError(
        'So lässt sich die Grundmenge nicht speichern: Menge 40.5 muss bei der Einheit Stück ganzzahlig sein.',
        400,
        'validation'
      )
    )
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const field = input('Testweck, Dienstag')
    await user.clear(field)
    await user.type(field, '40,5{Enter}')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Testweck, Dienstag')
    expect(alert).toHaveTextContent('ganzzahlig')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('Verkauf sieht nur Werte - keine Felder, keine Referenz', async () => {
    sessionState.user = { role: 'verkauf' }
    mockGet()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByText(/dürfen Inhaber und Backstube/)).toBeInTheDocument()
    expect(apiClient.get).not.toHaveBeenCalledWith(
      '/api/backzettel/reference',
      expect.anything()
    )
  })

  it('ohne Schreibziel: nur lesen, mit Hinweis', async () => {
    mockGet(syntheticView({ writable: false }))
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByTestId('read-only')).toHaveTextContent(
      'Speichern geht auf diesem Server gerade nicht'
    )
  })

  it('Schreib-Worktree falsch eingerichtet: Grund vom Server, nur lesen', async () => {
    mockGet(
      syntheticView({
        writable: false,
        writeIssue: {
          error: 'hq_write_wrong_branch',
          message: 'Das Schreibverzeichnis steht auf dem falschen Branch.',
        },
      })
    )
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByTestId('read-only')).toHaveTextContent('falschen Branch')
  })

  it('503 hq_write_* beim Speichern: Seite schaltet auf nur lesen', async () => {
    mockGet()
    apiClient.put.mockRejectedValue(
      new ApiError(
        'Das Schreibverzeichnis für hq ist kein git-Arbeitsverzeichnis.',
        503,
        'hq_write_unavailable'
      )
    )
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const field = input('Testweck, Dienstag')
    await user.clear(field)
    await user.type(field, '41{Enter}')
    expect(await screen.findByTestId('read-only')).toHaveTextContent(
      'kein git-Arbeitsverzeichnis'
    )
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('fremder Fehler in der YAML: Tabelle bleibt, mit Warnung darüber', async () => {
    mockGet(
      syntheticView({
        status: 'no-config',
        config: null,
        working: {
          status: 'no-config',
          config: syntheticConfig(),
          errors: [
            {
              path: 'items[0].products[0].id',
              message: 'Unbekanntes Produkt „weg“.',
            },
          ],
          warnings: [],
        },
      })
    )
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const warning = screen.getByTestId('config-errors')
    expect(warning).toHaveTextContent('enthalten Fehler')
    expect(warning).toHaveTextContent('Unbekanntes Produkt')
    expect(input('Testweck, Dienstag').value).toBe('40')
  })

  it('Druckbild: alle Wochentage, Werte und wartende Änderungen', async () => {
    const after = syntheticConfig()
    after.items[1].base = { ...after.items[1].base, 2: 45 }
    mockGet(
      syntheticView({
        pendingApproval: true,
        working: { status: 'ok', config: after, errors: [], warnings: [] },
      })
    )
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    const print = screen.getByTestId('grundmengen-print')
    expect(print).toHaveClass('grundmengen-print-only')
    const heads = Array.from(print.querySelectorAll('thead th')).map(
      (th) => th.textContent
    )
    expect(heads).toEqual([
      'Posten',
      'Einheit',
      'Di',
      'Mi',
      'Do',
      'Fr',
      'Sa',
      'So',
    ])
    expect(print).toHaveTextContent('45 * (40)')
    expect(print).toHaveTextContent('wartet auf Freigabe')
    expect(print).toHaveTextContent('Nussfüllung')
    // Bildschirm-Raster wird im Druck ausgeblendet
    expect(grid().closest('.grundmengen-screen-only')).not.toBeNull()
  })

  it('ungültige Stammdaten: Warnung mit den Fehlern, keine Tabelle', async () => {
    mockGet(
      syntheticView({
        status: 'no-config',
        config: null,
        working: {
          status: 'no-config',
          config: null,
          errors: [
            { path: 'items[0].base.2', message: 'Menge muss ≥ 0 sein.' },
          ],
          warnings: [],
        },
      })
    )
    renderWithTheme(<GrundmengenClient />)
    expect(
      await screen.findByText('Keine gültigen Backzettel-Stammdaten')
    ).toBeInTheDocument()
    expect(screen.getByText('items[0].base.2')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('Ladefehler mit „Erneut versuchen"', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Netzwerkfehler'))
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    expect(await screen.findByText(/Netzwerkfehler/)).toBeInTheDocument()
    mockGet()
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByTestId('row-testweck')).toBeInTheDocument()
  })
})
