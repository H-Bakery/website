import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@bakery/shared/data-access'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PriceListClient from './PriceListClient'
import {
  downloadPriceListCsv,
  fetchPriceList,
} from '../../../../lib/priceListApi'
import {
  SYNTHETIC_PARTNER,
  syntheticPriceList,
} from '../../../../lib/priceListFixtures'
import { fakeSession, WithSession } from '../../../../lib/testing/fakeSession'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/products/preisliste',
}))

jest.mock('../../../../lib/priceListApi', () => ({
  ...jest.requireActual('../../../../lib/priceListApi'),
  fetchPriceList: jest.fn(),
  downloadPriceListCsv: jest.fn(),
}))
jest.mock('../../../../lib/partnerApi', () => ({
  ...jest.requireActual('../../../../lib/partnerApi'),
  fetchPartners: jest.fn(async () => []),
}))

const mockFetch = fetchPriceList as jest.MockedFunction<typeof fetchPriceList>
const mockCsv = downloadPriceListCsv as jest.MockedFunction<
  typeof downloadPriceListCsv
>

const LADEN = { audience: 'laden' as const }

function renderPage(options = LADEN, role: 'inhaber' | 'verkauf' = 'inhaber') {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <PriceListClient options={options} />
    </WithSession>
  )
}

describe('PriceListClient (admin/products/preisliste)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockCsv.mockReset()
    mockPush.mockClear()
  })

  it('holt die Liste mit den Optionen und zeigt das Blatt mit allen Kategorien', async () => {
    mockFetch.mockResolvedValue(syntheticPriceList())
    renderPage()
    expect(await screen.findByTestId('price-list-sheet')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith(LADEN)
    for (const key of ['brot', 'broetchen', 'baguette', 'kuchen', 'torten']) {
      expect(screen.getByTestId(`pl-category-${key}`)).toBeInTheDocument()
    }
    expect(
      screen.getByText(
        /10 Produkte in 5 Kategorien - freigegebener Stand vom 13\.11\.2026/
      )
    ).toBeInTheDocument()
  })

  it('nennt intern, was fehlt: „Preis offen“ und ausgeblendete Produkte', async () => {
    mockFetch.mockResolvedValue(syntheticPriceList())
    renderPage()
    const open = await screen.findByTestId('price-open')
    expect(open).toHaveTextContent('Preis offen: 1 Produkt nicht auf der Liste')
    expect(open).toHaveTextContent('Probeplunder (Teilchen)')
    expect(screen.getByTestId('hidden-unavailable')).toHaveTextContent(
      '1 nicht verfügbares Produkt ist ausgeblendet'
    )
    // … aber nicht auf dem Blatt
    expect(screen.getByTestId('price-list-sheet')).not.toHaveTextContent(
      'Probeplunder'
    )
  })

  it('blendet die Bedienung im Druck aus, das Blatt nicht', async () => {
    mockFetch.mockResolvedValue(syntheticPriceList())
    renderPage()
    const sheet = await screen.findByTestId('price-list-sheet')
    const screenOnly = screen.getByTestId('price-list-screen')
    expect(screenOnly).not.toContainElement(sheet)
    expect(screenOnly).toContainElement(
      screen.getByRole('button', { name: 'Drucken / als PDF speichern' })
    )
  })

  it('druckt über den Browser', async () => {
    mockFetch.mockResolvedValue(syntheticPriceList())
    const print = jest.fn()
    const original = window.print
    window.print = print
    try {
      renderPage()
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Drucken / als PDF speichern',
        })
      )
      expect(print).toHaveBeenCalledTimes(1)
    } finally {
      window.print = original
    }
  })

  it('lädt das CSV mit denselben Optionen und zeigt einen Fehler deutsch', async () => {
    mockFetch.mockResolvedValue(syntheticPriceList())
    const options = { audience: 'laden' as const, categories: ['brot'] }
    renderPage(options)
    mockCsv.mockRejectedValueOnce(
      new ApiError('Es gibt nichts zu exportieren.', 404, 'no_data')
    )
    const button = await screen.findByRole('button', {
      name: 'CSV (Excel)',
    })
    await userEvent.click(button)
    expect(mockCsv).toHaveBeenCalledWith(options)
    expect(
      await screen.findByText('Es gibt nichts zu exportieren.')
    ).toBeInTheDocument()
  })

  it('zeigt bei leerer Auswahl einen Hinweis statt eines leeren Blatts', async () => {
    mockFetch.mockResolvedValue(
      syntheticPriceList({ categories: ['gibt-es-nicht'] })
    )
    renderPage()
    expect(
      await screen.findByText(
        'Zu dieser Auswahl gibt es kein Produkt mit Preis.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByTestId('price-list-sheet')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Drucken / als PDF speichern' })
    ).toBeDisabled()
  })

  it('zeigt die Meldung der API (z. B. 403 für die Partnerliste)', async () => {
    mockFetch.mockRejectedValue(
      new ApiError(
        'Die Preisliste für Partner darf nur der Inhaber erstellen.',
        403,
        'forbidden'
      )
    )
    renderPage({ audience: 'partner', partnerId: 1 } as never, 'verkauf')
    expect(
      await screen.findByText(
        'Die Preisliste für Partner darf nur der Inhaber erstellen.'
      )
    ).toBeInTheDocument()
  })

  it('Partnerliste: sagt, woher Sortiment und Preise kommen', async () => {
    mockFetch.mockResolvedValue(
      syntheticPriceList({
        audience: 'partner',
        partner: SYNTHETIC_PARTNER,
        assortment: { slugs: ['p-1', 'p-4'] },
      })
    )
    renderPage({ audience: 'partner', partnerId: 7 } as never)
    const info = await screen.findByTestId('partner-info')
    expect(info).toHaveTextContent('Standard-Bestückung des Partners')
    expect(info).toHaveTextContent(
      'Rabatte oder ein Provisionssatz sind nicht hinterlegt'
    )
    await waitFor(() =>
      expect(screen.getByTestId('pl-partner')).toHaveTextContent(
        'Testmarkt Musterstadt'
      )
    )
  })
})
