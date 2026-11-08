import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import GrundmengenClient from './GrundmengenClient'
import {
  syntheticReference,
  syntheticReferenceV2,
  syntheticView,
  syntheticViewV2,
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
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; put: jest.Mock }
}

function mockGet(
  view: BackzettelConfigView,
  reference: () => unknown = syntheticReference
) {
  apiClient.get.mockImplementation(async (url: string) => {
    if (url === '/api/backzettel/config') return { success: true, data: view }
    if (url === '/api/backzettel/reference') {
      return { success: true, data: reference() }
    }
    throw new Error(`unexpected ${url}`)
  })
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.put.mockReset()
  sessionState.user = { role: 'backstube' }
})

describe('GrundmengenClient - Backzettel v2 (Z10)', () => {
  it('zeigt Laibgrößen als Zeilen mit ihrem Namen', async () => {
    mockGet(syntheticViewV2())
    renderWithTheme(<GrundmengenClient />)
    const row = await screen.findByTestId('row-testkorn-g500')
    expect(row).toHaveTextContent('500 g')
    expect(screen.getByTestId('row-testkorn-g1000')).toHaveTextContent('1 kg')
    expect(screen.getByTestId('v2-note-testkorn')).toHaveTextContent(
      'Laibe je Größe'
    )
    expect(
      screen.getByRole('textbox', { name: 'Testkorn (500 g), Samstag' })
    ).toHaveValue('8')
  })

  it('Bruch-Posten: Hinweis „≈ n Bruch“, Backtag-Hinweis, offene Stückzahl', async () => {
    mockGet(syntheticViewV2())
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testdoppel')
    // 25 Stück × 2 Teigstücke ÷ 20 je Bruch
    expect(screen.getByTestId('bruch-hint-testdoppel-6')).toHaveTextContent(
      '≈ 2,5 Bruch'
    )
    expect(screen.getByTestId('bruch-hint-testdoppel-2')).toHaveTextContent(
      '≈ 3 Bruch'
    )
    // offene Grundmenge: kein Hinweis
    expect(
      screen.queryByTestId('bruch-hint-testdoppel-7')
    ).not.toBeInTheDocument()
    // Stück je Bruch offen: nie geschätzt
    expect(
      screen.queryByTestId('bruch-hint-testflitweck-2')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('v2-note-testflitweck')).toHaveTextContent(
      'Bruch: Stück je Bruch unbekannt'
    )
    expect(screen.getByTestId('v2-note-testdoppel')).toHaveTextContent(
      'Teig am Teigtag davor'
    )
    expect(screen.getByTestId('bake-day-note')).toHaveTextContent(
      'Brötchen: Menge am Backtag, Teig am Teigtag davor.'
    )
  })

  it('Median je Laibgröße neben der Größe; ohne Kassennummer der Größe „unbekannt“', async () => {
    mockGet(syntheticViewV2(), syntheticReferenceV2)
    renderWithTheme(<GrundmengenClient />)
    const small = await screen.findByTestId('row-testkorn-g500')
    const sat = (row: HTMLElement) =>
      within(row)
        .getAllByTestId('reference')
        .map((el) => el.textContent)
    // Größe 500 g: eigener Median (Laibe, Stück laut Kasse)
    expect(sat(small)).toEqual(['≈ 6 St.'])
    // Größe 1 kg: keine eigene Kassennummer - unbekannt, nie 0
    expect(sat(screen.getByTestId('row-testkorn-g1000'))).toEqual(['unbekannt'])
    // die Postenzeile zeigt weiter den Median des ganzen Postens
    expect(sat(screen.getByTestId('row-testkorn'))).toEqual(['≈ 9 St.'])
  })

  it('Posten ohne Kassennummer: auch die Größen-Zeilen ohne Referenz', async () => {
    const ref = syntheticReferenceV2()
    const korn = ref.weekdays[0].items[0]
    Object.assign(korn, {
      plu: [],
      median: null,
      samples: [],
      status: 'no_plu',
    })
    mockGet(syntheticViewV2(), () => ref)
    renderWithTheme(<GrundmengenClient />)
    const row = await screen.findByTestId('row-testkorn-g1000')
    expect(within(row).queryByTestId('reference')).not.toBeInTheDocument()
  })

  it('offene Stammdaten aufklappbar', async () => {
    mockGet(syntheticViewV2())
    renderWithTheme(<GrundmengenClient />)
    const note = within(await screen.findByTestId('grundmengen-open'))
    fireEvent.click(
      note.getByRole('button', { name: /Offene Stammdaten \(2\)/ })
    )
    expect(
      note.getByText('„Testflitweck“: Stück je Bruch sind noch offen.')
    ).toBeInTheDocument()
  })

  it('alte Stammdaten: kein Bruch, kein Backtag-Hinweis', async () => {
    mockGet(syntheticView())
    renderWithTheme(<GrundmengenClient />)
    await screen.findByTestId('row-testweck')
    expect(screen.queryByTestId('bake-day-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('grundmengen-open')).not.toBeInTheDocument()
    expect(screen.queryByTestId(/^bruch-hint-/)).not.toBeInTheDocument()
  })
})
