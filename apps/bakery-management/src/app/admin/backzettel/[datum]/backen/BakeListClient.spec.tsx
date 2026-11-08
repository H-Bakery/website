import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import BakeListClient from './BakeListClient'
import {
  fakeSession,
  WithSession,
} from '../../../../../lib/testing/fakeSession'
import * as api from '../../../../../lib/backzettelApi'
import {
  CONFIG_RESPONSE_V2,
  SAT,
  SUN,
  V2_TUE,
  sundayBakeList,
  tuesdayBakeList,
} from '../../../../../lib/backzettelFixtures'
import type { PilotRole } from '../../../../../lib/roles'

jest.mock('../../../../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../../../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBakeList: jest.fn(),
    acknowledgeDelta: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

function renderList(role: PilotRole = 'backstube', date = V2_TUE) {
  return render(
    <WithSession value={fakeSession({ role })}>
      <BakeListClient date={date} />
    </WithSession>
  )
}

const DOPPEL = `test-doppel|@${V2_TUE}`

describe('Backliste (Z10)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE_V2)
    mocked.fetchBakeList.mockResolvedValue(tuesdayBakeList())
  })

  it('zeigt, was heute gebacken wird - mit Herkunft des Teigs', async () => {
    renderList()
    expect(
      await screen.findByRole('heading', { name: 'Backliste' })
    ).toBeInTheDocument()
    expect(mocked.fetchBakeList).toHaveBeenCalledWith(V2_TUE)
    const sources = within(await screen.findByTestId('bake-sources'))
    expect(
      sources.getByText('Teig vom Samstag · freigegeben')
    ).toBeInTheDocument()
    expect(sources.getByText('Teig von heute · Entwurf')).toBeInTheDocument()
    expect(screen.getByTestId('bake-draft-note')).toBeInTheDocument()

    const doppel = within(screen.getByTestId(`bake-line-${DOPPEL}`))
    // kein „· für Di“ - Backtag ist der Tag der Liste
    expect(doppel.getByText('Testdoppel')).toBeInTheDocument()
    expect(doppel.getByText('Teig vom Samstag')).toBeInTheDocument()
    expect(screen.getByTestId(`bake-total-${DOPPEL}`)).toHaveTextContent('44')
    expect(screen.getByTestId(`bake-delta-${DOPPEL}`)).toHaveTextContent(
      'Nachtrag +3'
    )
    const korn = screen
      .getAllByTestId(/^bake-line-test-korn/)
      .map((el) => within(el))[0]
    expect(korn.getByText('Testkorn – 500 g')).toBeInTheDocument()
    expect(korn.getByText('Entwurf')).toBeInTheDocument()
    // Links: Zettel und Teigtag-Quellen, Drucken
    expect(screen.getByRole('link', { name: 'Zum Zettel' })).toHaveAttribute(
      'href',
      `/admin/backzettel/${V2_TUE}`
    )
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeEnabled()
    // keine Haken auf der Backliste
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('„Gesehen“ quittiert beim Zettel des Teigtags', async () => {
    mocked.acknowledgeDelta.mockResolvedValue({
      id: 31,
      acknowledgedAt: '2026-12-01T03:00:00.000Z',
      acknowledgedBy: { id: 2, displayName: 'Test Backstube' },
    } as never)
    renderList()
    const card = within(await screen.findByTestId('deltas-card'))
    fireEvent.click(card.getByRole('button', { name: /Gesehen/ }))
    await waitFor(() =>
      expect(mocked.acknowledgeDelta).toHaveBeenCalledWith(SAT, 31)
    )
    await waitFor(() => expect(mocked.fetchBakeList).toHaveBeenCalledTimes(2))
  })

  it('Verkauf sieht die Liste ohne „Gesehen“', async () => {
    renderList('verkauf')
    const card = within(await screen.findByTestId('deltas-card'))
    expect(
      card.queryByRole('button', { name: /Gesehen/ })
    ).not.toBeInTheDocument()
  })

  it('Sonntag: alles aus Samstagsteig', async () => {
    mocked.fetchBakeList.mockResolvedValue(sundayBakeList())
    renderList('backstube', SUN)
    expect(
      await screen.findByText('Teig vom Samstag · Entwurf')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`bake-total-test-doppel|@${SUN}`)
    ).toHaveTextContent('66')
  })

  it('Ruhetag, fehlende Stammdaten und leere Liste', async () => {
    mocked.fetchBakeList.mockResolvedValue(
      tuesdayBakeList({
        status: 'ruhetag',
        message: 'Montag ist Ruhetag.',
        sources: [],
        sections: [],
        deltas: [],
      })
    )
    const { unmount } = renderList('backstube', '2026-11-30')
    expect(await screen.findByTestId('bake-ruhetag')).toHaveTextContent(
      'Montag ist Ruhetag.'
    )
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeDisabled()
    unmount()

    mocked.fetchBakeList.mockResolvedValue(
      tuesdayBakeList({
        status: 'no-config',
        reasons: [{ message: 'backzettel.yaml fehlt.' }],
        sources: [],
        sections: [],
        deltas: [],
      })
    )
    const second = renderList()
    expect(await screen.findByTestId('bake-no-config')).toHaveTextContent(
      'backzettel.yaml fehlt.'
    )
    second.unmount()

    mocked.fetchBakeList.mockResolvedValue(
      tuesdayBakeList({ sections: [], deltas: [] })
    )
    renderList()
    expect(await screen.findByTestId('bake-empty')).toBeInTheDocument()
  })

  it('Fehler beim Laden: deutsche Meldung', async () => {
    mocked.fetchBakeList.mockRejectedValue(
      new Error('Die API ist gerade nicht erreichbar.')
    )
    renderList()
    expect(await screen.findByTestId('load-error')).toHaveTextContent(
      'Die API ist gerade nicht erreichbar.'
    )
  })

  it('ungültiges Datum lädt nichts', () => {
    renderList('backstube', '2026-13-99')
    expect(screen.getByText(/Ungültiges Datum/)).toBeInTheDocument()
    expect(mocked.fetchBakeList).not.toHaveBeenCalled()
  })
})
