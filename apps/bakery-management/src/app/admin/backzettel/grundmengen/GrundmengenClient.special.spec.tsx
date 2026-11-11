/**
 * Z14: die Spalten „Vor Feiertag“ / „Samstags-Satz“ im Grundmengen-Bildschirm.
 * Fehlt die Spalte am Posten, ist sie nicht gesetzt (leer, „–“), nie 0.
 */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import GrundmengenClient from './GrundmengenClient'
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

jest.mock('../../../../lib/session', () => ({
  useOptionalSession: () => ({ user: { role: 'backstube' } }),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; put: jest.Mock }
}

function viewWithSpecial(): BackzettelConfigView {
  const config = syntheticConfig()
  config.items[0].baseSpecial = { vor_feiertag: 6 }
  return syntheticView({
    config,
    working: { status: 'ok', config, errors: [], warnings: [] },
  })
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.put.mockReset()
  const view = viewWithSpecial()
  apiClient.get.mockImplementation(async (url: string) => {
    if (url === '/api/backzettel/config') return { success: true, data: view }
    return { success: true, data: syntheticReference() }
  })
})

const input = (name: string) => screen.getByRole('textbox', { name })

describe('GrundmengenClient - Sonderspalten (Z14)', () => {
  it('zeigt beide Spalten; gesetzt = Wert, nicht gesetzt = leer, nie 0', async () => {
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testbrot')
    expect(screen.getByTitle(/^Vor Feiertag:/)).toHaveTextContent('Vor FT')
    expect(screen.getByTitle(/^Samstags-Satz:/)).toHaveTextContent('Sa-Satz')
    expect(input('Testbrot, Vor Feiertag')).toHaveValue('6')
    const unset = input('Testbrot, Samstags-Satz')
    expect(unset).toHaveValue('')
    expect(unset).toHaveAttribute('placeholder', '–')
    expect(input('Testweck, Vor Feiertag')).toHaveValue('')
  })

  it('speichert über PUT /config/base mit dem Spaltennamen; leeren sendet null', async () => {
    apiClient.put.mockResolvedValue({
      success: true,
      data: { ...viewWithSpecial(), pending: true, changed: true },
    })
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testbrot')

    await user.type(input('Testweck, Samstags-Satz'), '70{Enter}')
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/backzettel/config/base',
        { itemId: 'testweck', weekday: 'samstag_ersatz', value: 70 }
      )
    )

    await user.clear(input('Testbrot, Vor Feiertag'))
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/backzettel/config/base',
        { itemId: 'testbrot', weekday: 'vor_feiertag', value: null }
      )
    )
  })

  it('unverändert verlassen = keine Anfrage (Null-Diff)', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testbrot')
    await user.click(input('Testbrot, Samstags-Satz'))
    await user.tab()
    await user.click(input('Testbrot, Vor Feiertag'))
    await user.tab()
    expect(apiClient.put).not.toHaveBeenCalled()
  })
})

describe('Grundmengen-Druckbild - Sonderspalten (Z14)', () => {
  const cell = (id: string) =>
    within(screen.getByTestId('grundmengen-print')).getByTestId(
      `print-special-${id}`
    )

  it('druckt „Vor FT“ / „Sa-Satz“ nach So; gesetzt = Wert, nicht gesetzt = leer, nie 0', async () => {
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testbrot')
    const print = screen.getByTestId('grundmengen-print')
    const heads = Array.from(print.querySelectorAll('thead th')).map(
      (th) => th.textContent
    )
    expect(heads.slice(-3)).toEqual(['So', 'Vor FT', 'Sa-Satz'])
    expect(cell('testbrot-vor_feiertag')).toHaveTextContent(/^6$/)
    expect(cell('testbrot-samstag_ersatz')).toHaveTextContent(/^$/)
    expect(cell('testweck-vor_feiertag')).toHaveTextContent(/^$/)
    expect(cell('testweck-samstag_ersatz')).toHaveTextContent(/^$/)
    expect(print).toHaveTextContent(
      'Vor FT = Vor Feiertag, Sa-Satz = Samstags-Satz: leer = nicht gesetzt, es gilt die Menge des Wochentags'
    )
    // keine Sternchen-Fußnote ohne wartende Änderung
    expect(print).not.toHaveTextContent('wartet auf Freigabe')
  })

  it('Sorten: je Sorte eine Zahl, offene Sorte „offen“, Postenzeile „je Sorte“', async () => {
    const config = syntheticConfig()
    const kranz = config.items.find((i) => i.variants.length > 0)
    if (!kranz) throw new Error('Fixture ohne Sorten-Posten')
    const [first, second] = kranz.variants
    kranz.baseSpecial = { samstag_ersatz: { [first]: 3, [second]: null } }
    const view = syntheticView({
      config,
      working: { status: 'ok', config, errors: [], warnings: [] },
    })
    apiClient.get.mockImplementation(async (url: string) => {
      if (url === '/api/backzettel/config') return { success: true, data: view }
      return { success: true, data: syntheticReference() }
    })
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId(`row-${kranz.id}`)
    expect(cell(`${kranz.id}-samstag_ersatz`)).toHaveTextContent('je Sorte')
    expect(cell(`${kranz.id}-${first}-samstag_ersatz`)).toHaveTextContent(/^3$/)
    expect(cell(`${kranz.id}-${second}-samstag_ersatz`)).toHaveTextContent(
      /^offen$/
    )
    expect(cell(`${kranz.id}-vor_feiertag`)).toHaveTextContent(/^$/)
    expect(cell(`${kranz.id}-${first}-vor_feiertag`)).toHaveTextContent(/^$/)
  })

  it('wartende Änderung: neu gesetzt „7 * (–)“, entfernt „* (6)“ - nie 0', async () => {
    const approved = syntheticConfig()
    approved.items[0].baseSpecial = { vor_feiertag: 6 }
    const working = syntheticConfig()
    working.items[0].baseSpecial = { samstag_ersatz: 7 }
    const view = syntheticView({
      config: approved,
      pendingApproval: true,
      working: { status: 'ok', config: working, errors: [], warnings: [] },
    })
    apiClient.get.mockImplementation(async (url: string) => {
      if (url === '/api/backzettel/config') return { success: true, data: view }
      return { success: true, data: syntheticReference() }
    })
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testbrot')
    expect(cell('testbrot-samstag_ersatz')).toHaveTextContent(/^7 \* \(–\)$/)
    expect(cell('testbrot-vor_feiertag')).toHaveTextContent(/^\* \(6\)$/)
    expect(screen.getByTestId('grundmengen-print')).toHaveTextContent(
      'wartet auf Freigabe'
    )
  })
})
