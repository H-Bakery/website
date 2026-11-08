import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import {
  MoersbachNewPreorderClient,
  MoersbachPreorderDetailClient,
  moersbachListHref,
} from './MoersbachPreorderClients'
import { fetchPickupPoints } from '../../../../lib/preordersApi'
import {
  POINT,
  preorder as mockPreorder,
} from '../../../../lib/testing/preorderFixtures'
import type { PreorderFormProps } from '../../preorders/PreorderForm'
import type { PreorderDetailClientProps } from '../../preorders/[id]/PreorderDetailClient'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/delivery/preorders/new',
}))

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  fetchPickupPoints: jest.fn(),
}))

// Die Maske selbst testet P1 (PreorderEntryClient.spec) - hier zählt nur,
// womit sie vorbelegt wird und wohin es danach geht.
jest.mock('../../preorders/PreorderForm', () => ({
  __esModule: true,
  default: (props: PreorderFormProps) => (
    <div>
      <span data-testid="form-point">{props.initialPickupPointId}</span>
      <span data-testid="form-date">{props.initialDate}</span>
      <button
        onClick={() =>
          props.onSaved(
            mockPreorder({
              pickupDate: '2026-11-21',
              pickupPointId: 'kita-test',
            })
          )
        }
      >
        speichern
      </button>
      <button onClick={props.onCancel}>abbrechen</button>
    </div>
  ),
}))

jest.mock('../../preorders/[id]/PreorderDetailClient', () => ({
  __esModule: true,
  default: (props: PreorderDetailClientProps) => (
    <div>
      <span data-testid="detail-id">{props.id}</span>
      <span data-testid="detail-back">
        {props.backHref?.(mockPreorder({ pickupDate: '2026-11-21' }))}
      </span>
      <span data-testid="detail-back-label">{props.backLabel}</span>
    </div>
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([
    { ...POINT, id: 'alt', active: false },
    POINT,
  ])
})

describe('Mörsbach-Seiten auf der allgemeinen Maske (P2)', () => {
  it('baut die Rück-URL auf den Liefertag', () => {
    expect(moersbachListHref('2026-11-21', true)).toBe(
      '/admin/delivery/preorders?date=2026-11-21&saved=1'
    )
    expect(moersbachListHref(null)).toBe('/admin/delivery/preorders')
    // Mit Sammelstelle: zurück auf genau diese, nicht auf die erste.
    expect(moersbachListHref('2026-11-21', true, 'kita-test')).toBe(
      '/admin/delivery/preorders?date=2026-11-21&point=kita-test&saved=1'
    )
    // unbrauchbare Kennungen landen nicht in der URL
    expect(moersbachListHref('2026-11-21', false, '../x')).toBe(
      '/admin/delivery/preorders?date=2026-11-21'
    )
  })

  it('erfasst mit vorbelegter Sammelstelle und kehrt zum Liefertag zurück', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <MoersbachNewPreorderClient
        initialDate="2026-11-21"
        initialPickupPointId={POINT.id}
      />
    )
    expect(screen.getByTestId('form-point')).toHaveTextContent(POINT.id)
    expect(screen.getByTestId('form-date')).toHaveTextContent('2026-11-21')
    // die Maske wartet nicht auf die Sammelstellen - die liefern nur den Namen
    expect(
      await screen.findByText(`Abholung: ${POINT.name}`)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Neue Vorbestellung' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'speichern' }))
    // Regression: ohne `point` zeigte die Liste danach die erste Sammelstelle
    // und die eben gespeicherte Bestellung fehlte.
    expect(mockPush).toHaveBeenCalledWith(
      `/admin/delivery/preorders?date=2026-11-21&point=kita-test&saved=1`
    )
    await user.click(screen.getByRole('button', { name: 'abbrechen' }))
    expect(mockPush).toHaveBeenLastCalledWith(
      `/admin/delivery/preorders?date=2026-11-21&point=${POINT.id}`
    )
  })

  it('nimmt ohne Sammelstelle in der URL die erste aktive', async () => {
    renderWithTheme(<MoersbachNewPreorderClient />)
    await waitFor(() =>
      expect(screen.getByTestId('form-point')).toHaveTextContent(POINT.id)
    )
  })

  it('meldet, wenn es keine Sammelstelle gibt', async () => {
    ;(fetchPickupPoints as jest.Mock).mockResolvedValue([])
    renderWithTheme(<MoersbachNewPreorderClient />)
    expect(
      await screen.findByText('Es ist keine Sammelstelle angelegt.')
    ).toBeInTheDocument()
  })

  it('zeigt eine Bestellung in der P3-Ansicht mit Rückweg zur Sammelstelle', () => {
    renderWithTheme(<MoersbachPreorderDetailClient id={7} />)
    expect(screen.getByTestId('detail-id')).toHaveTextContent('7')
    expect(screen.getByTestId('detail-back')).toHaveTextContent(
      '/admin/delivery/preorders?date=2026-11-21'
    )
    expect(screen.getByTestId('detail-back-label')).toHaveTextContent(
      'Zurück zur Sammelstelle'
    )
  })
})
