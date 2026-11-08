import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PickupPointFormClient from './PickupPointFormClient'
import {
  fetchPickupPoints,
  listPreorders,
  savePickupPoint,
} from '../../../../../lib/preordersApi'
import type { PickupPoint } from '../../../../../lib/preordersTypes'
import {
  WithSession,
  fakeSession,
} from '../../../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../../../lib/roles'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/delivery/preorders/lieferstelle',
}))

jest.mock('../../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../../lib/preordersApi'),
  fetchPickupPoints: jest.fn(),
  listPreorders: jest.fn(),
  savePickupPoint: jest.fn(),
}))

function renderAs(role: PilotRole = 'inhaber') {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <PickupPointFormClient />
    </WithSession>
  )
}

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockSave = savePickupPoint as jest.MockedFunction<typeof savePickupPoint>

/** Wie im Seed: die Adresse des Kindergartens ist noch nicht bekannt. */
const POINT: PickupPoint = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  street: '',
  zip: '',
  city: 'Zweibrücken-Mörsbach',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
  updatedAt: '2026-11-01T10:00:00.000Z',
}

describe('PickupPointFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockSave.mockImplementation((id, payload) =>
      Promise.resolve({ ...POINT, ...payload, id })
    )
  })

  it('zeigt die vorhandenen Stammdaten und die noch fehlende Adresse', async () => {
    renderAs()

    expect(
      await screen.findByDisplayValue('Kindergarten Mörsbach')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Straße und Hausnummer/)).toHaveValue('')
    expect(screen.getByText(/Straße noch nicht hinterlegt/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('09:00-09:30')).toBeInTheDocument()
  })

  it('speichert die nachgetragene Adresse mit Liefertag und Bestellschluss', async () => {
    const user = userEvent.setup()
    renderAs()

    const street = await screen.findByLabelText(/Straße und Hausnummer/)
    await user.type(street, 'Hauptstraße 1')
    await user.type(screen.getByLabelText('PLZ'), '66482')

    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        'kindergarten-moersbach',
        {
          name: 'Kindergarten Mörsbach',
          street: 'Hauptstraße 1',
          zip: '66482',
          city: 'Zweibrücken-Mörsbach',
          weekday: 6,
          window: '09:00-09:30',
          orderDeadline: { weekday: 5, time: '12:00' },
          notes: null,
          active: true,
        },
        // Stand beim Laden - der Server lehnt sonst eine überholte Fassung ab
        '2026-11-01T10:00:00.000Z'
      )
    )
    expect(
      await screen.findByText(/Die Sammelstelle wurde gespeichert/)
    ).toBeInTheDocument()
  })

  it('zeigt die deutsche Fehlermeldung des Servers an', async () => {
    const user = userEvent.setup()
    mockSave.mockRejectedValue(
      new Error('Der Name der Lieferstelle ist erforderlich.')
    )
    renderAs()

    await screen.findByDisplayValue('Kindergarten Mörsbach')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(
      await screen.findByText('Der Name der Lieferstelle ist erforderlich.')
    ).toBeInTheDocument()
  })

  it.each<PilotRole>(['verkauf', 'fahrer', 'backstube'])(
    '%s: Felder schreibgeschützt, kein Speichern (W4)',
    async (role) => {
      const user = userEvent.setup()
      renderAs(role)
      await screen.findByDisplayValue('Kindergarten Mörsbach')
      expect(
        screen.getByText('Nur der Inhaber kann die Sammelstelle ändern.')
      ).toBeInTheDocument()
      for (const label of [
        /^Name/,
        /Straße und Hausnummer/,
        'PLZ',
        'Ort',
        'Übergabefenster',
        'Bestellschluss um',
        'Notizen',
      ]) {
        expect(screen.getByLabelText(label)).toHaveAttribute('readonly')
      }
      // Tippen ändert nichts
      await user.type(screen.getByLabelText('PLZ'), '12345')
      expect(screen.getByLabelText('PLZ')).toHaveValue('')
      expect(screen.getByRole('checkbox', { name: 'Aktiv' })).toBeDisabled()
      // Auswahlfelder öffnen sich nicht
      await user.click(screen.getByLabelText('Liefertag'))
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Speichern' })
      ).not.toBeInTheDocument()
      // Rückweg nur noch oben als Link (Layout-Kit), kein zweiter Knopf
      expect(
        screen.getByRole('link', { name: 'Zurück zur Liste' })
      ).toHaveAttribute('href', `/admin/delivery/preorders?point=${POINT.id}`)
      expect(mockSave).not.toHaveBeenCalled()
    }
  )

  it('Inhaber: Felder bearbeitbar, Notizen auf 2000 Zeichen begrenzt', async () => {
    renderAs('inhaber')
    await screen.findByDisplayValue('Kindergarten Mörsbach')
    expect(screen.getByLabelText('PLZ')).not.toHaveAttribute('readonly')
    expect(screen.getByLabelText('Notizen')).toHaveAttribute(
      'maxlength',
      '2000'
    )
    expect(screen.getByText('0 / 2000 Zeichen')).toBeInTheDocument()
  })

  it('inzwischen woanders geändert: Hinweis mit „Neu laden“, nichts überschrieben', async () => {
    const user = userEvent.setup()
    const stale = Object.assign(
      new Error(
        'Die Sammelstelle wurde inzwischen an anderer Stelle geändert. Bitte neu laden und die Änderung dann erneut speichern.'
      ),
      { code: 'stale_pickup_point', status: 409 }
    )
    mockSave.mockRejectedValueOnce(stale)
    renderAs('inhaber')
    await user.type(await screen.findByLabelText('PLZ'), '66482')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(
      await screen.findByText(/inzwischen an anderer Stelle geändert/)
    ).toBeInTheDocument()
    const fresh = {
      ...POINT,
      street: 'Musterweg 2',
      updatedAt: '2026-11-02T10:00:00.000Z',
    }
    mockFetchPickupPoints.mockResolvedValue([fresh])
    await user.click(screen.getByRole('button', { name: 'Neu laden' }))
    expect(await screen.findByDisplayValue('Musterweg 2')).toBeInTheDocument()
    expect(screen.queryByText(/inzwischen an anderer Stelle/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(mockSave).toHaveBeenLastCalledWith(
        'kindergarten-moersbach',
        expect.objectContaining({ street: 'Musterweg 2' }),
        '2026-11-02T10:00:00.000Z'
      )
    )
  })

  it('meldet, wenn die Sammelstellen nicht geladen werden können', async () => {
    mockFetchPickupPoints.mockRejectedValue(
      new Error('Keine Verbindung zur Bäckerei-API.')
    )
    renderAs()

    expect(
      await screen.findByText('Keine Verbindung zur Bäckerei-API.')
    ).toBeInTheDocument()
    // Nicht „Keine Sammelstelle angelegt“ darüber - das klänge, als sei sie
    // gelöscht (UI-Runde 2).
    expect(
      screen.queryByText(/Keine Sammelstelle angelegt/i)
    ).not.toBeInTheDocument()
  })
})

describe('Sammelstelle deaktivieren (W4-verify r4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockSave.mockImplementation((id, payload) =>
      Promise.resolve({ ...POINT, ...payload, id })
    )
  })

  it('warnt beim Speichern, wenn noch Vorbestellungen offen sind', async () => {
    const user = userEvent.setup()
    ;(listPreorders as jest.Mock).mockResolvedValue([
      { id: 1, pickupDate: '2026-11-21' },
      { id: 2, pickupDate: '2026-11-21' },
      { id: 3, pickupDate: '2026-11-28' },
    ])
    renderAs()
    await user.click(await screen.findByRole('checkbox', { name: 'Aktiv' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    const warning = await screen.findByTestId(
      'pickup-point-open-after-deactivate'
    )
    expect(warning).toHaveTextContent(/3 offene Vorbestellungen/)
    expect(warning).toHaveTextContent(/Sa 21\.11\., Sa 28\.11\./)
    expect(warning).toHaveTextContent(/Kindergarten Mörsbach \(inaktiv\)/)
    expect(listPreorders).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupPointId: 'kindergarten-moersbach',
        status: ['offen', 'bereit'],
      })
    )
  })

  it('ohne offene Bestellungen: keine Warnung', async () => {
    const user = userEvent.setup()
    ;(listPreorders as jest.Mock).mockResolvedValue([])
    renderAs()
    await user.click(await screen.findByRole('checkbox', { name: 'Aktiv' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByText('Die Sammelstelle wurde gespeichert.')
    await waitFor(() => expect(listPreorders).toHaveBeenCalled())
    expect(
      screen.queryByTestId('pickup-point-open-after-deactivate')
    ).not.toBeInTheDocument()
  })
})
