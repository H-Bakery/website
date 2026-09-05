import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PickupPointFormClient from './PickupPointFormClient'
import { fetchPickupPoints, savePickupPoint } from '../preorderApi'
import type { PickupPoint } from '../preorderTypes'

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

jest.mock('../preorderApi', () => ({
  fetchPickupPoints: jest.fn(),
  savePickupPoint: jest.fn(),
}))

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
  lat: null,
  lon: null,
  geocodeSource: null,
  geocodePrecision: null,
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
    renderWithTheme(<PickupPointFormClient />)

    expect(
      await screen.findByDisplayValue('Kindergarten Mörsbach')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Straße und Hausnummer/)).toHaveValue('')
    expect(screen.getByText(/Straße noch nicht hinterlegt/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('09:00-09:30')).toBeInTheDocument()
  })

  it('speichert die nachgetragene Adresse mit Liefertag und Bestellschluss', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PickupPointFormClient />)

    const street = await screen.findByLabelText(/Straße und Hausnummer/)
    await user.type(street, 'Hauptstraße 1')
    await user.type(screen.getByLabelText('PLZ'), '66482')

    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith('kindergarten-moersbach', {
        name: 'Kindergarten Mörsbach',
        street: 'Hauptstraße 1',
        zip: '66482',
        city: 'Zweibrücken-Mörsbach',
        weekday: 6,
        window: '09:00-09:30',
        orderDeadline: { weekday: 5, time: '12:00' },
        notes: null,
        active: true,
      })
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
    renderWithTheme(<PickupPointFormClient />)

    await screen.findByDisplayValue('Kindergarten Mörsbach')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(
      await screen.findByText('Der Name der Lieferstelle ist erforderlich.')
    ).toBeInTheDocument()
  })

  it('meldet, wenn die Sammelstellen nicht geladen werden können', async () => {
    mockFetchPickupPoints.mockRejectedValue(
      new Error('Keine Verbindung zur Bäckerei-API.')
    )
    renderWithTheme(<PickupPointFormClient />)

    expect(
      await screen.findByText('Keine Verbindung zur Bäckerei-API.')
    ).toBeInTheDocument()
  })
})
