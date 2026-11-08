import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductsPageClient from './ProductsPageClient'
import ProductEditLoader from './[id]/ProductEditLoader'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import { toManagementProduct } from '../../../lib/products'

/**
 * F4: Produktliste und Bearbeiten lesen `/api/hq-products` zur Laufzeit -
 * mit `pendingApproval` („wartet auf Freigabe“) und Schreiben nur für den
 * Inhaber. Synthetische Produkte.
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
  return { ApiError, apiClient: { get: jest.fn(), put: jest.fn() } }
})

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/products',
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; put: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

const musterbrot = {
  id: 'musterbrot',
  numeric_id: 1,
  name: 'Musterbrot',
  category: 'brot',
  price: 3.2,
  available: true,
  seasonal: false,
  image: 'images/',
  short_description: 'Ein Testbrot.',
  description: 'Langer Text zum Testbrot.',
  rawDescription: 'Langer Text zum Testbrot.',
  pendingApproval: false,
}
/** Datei ohne Beschreibung: die API füllt `description` mit dem Kurztext. */
const leertext = {
  ...musterbrot,
  id: 'leertext',
  numeric_id: 3,
  name: 'Leertext',
  short_description: 'Nur ein Teaser.',
  description: 'Nur ein Teaser.',
  rawDescription: '',
}
const probekruste = {
  ...musterbrot,
  id: 'probekruste',
  numeric_id: 2,
  name: 'Probekruste neu',
  price: 4.1,
  pendingApproval: true,
  approved: {
    ...musterbrot,
    id: 'probekruste',
    name: 'Probekruste',
    price: 3.9,
  },
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.put.mockReset()
})

describe('toManagementProduct', () => {
  it('Kategoriebild statt Platzhalter, rohes Bild bleibt fürs Formular', () => {
    const product = toManagementProduct(musterbrot)
    expect(product.image).toBe('/assets/images/products/brot-rund.svg')
    expect(product.rawImage).toBe('images/')
    expect(product.category).toBe('Brot')
    expect(product.pendingApproval).toBe(false)
    expect(product.approved).toBeNull()
  })

  it('Beschreibung aus rawDescription, nicht aus dem Rückgriff auf den Kurztext', () => {
    expect(toManagementProduct(leertext).description).toBe('')
    expect(toManagementProduct(leertext).shortDescription).toBe(
      'Nur ein Teaser.'
    )
    // PUT-Antwort / Mock ohne rawDescription: description ist der Body
    const withoutRaw = { ...musterbrot, rawDescription: undefined }
    expect(toManagementProduct(withoutRaw).description).toBe(
      'Langer Text zum Testbrot.'
    )
  })

  it('wartendes Produkt trägt den freigegebenen Stand', () => {
    const product = toManagementProduct(probekruste)
    expect(product.pendingApproval).toBe(true)
    expect(product.approved).toEqual({
      name: 'Probekruste',
      price: 3.9,
      status: 'active',
    })
  })
})

describe('ProductsPageClient', () => {
  it('lädt /api/hq-products und markiert wartende Produkte', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [musterbrot, probekruste],
    })
    renderWithTheme(<ProductsPageClient />)
    expect(await screen.findByText('Produktliste (2)')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/hq-products')
    expect(screen.getAllByText('wartet auf Freigabe')).toHaveLength(1)
  })

  it('zeigt den Fehler der API und lädt auf Wunsch neu', async () => {
    apiClient.get
      .mockRejectedValueOnce(new ApiError('Nicht angemeldet.', 401))
      .mockResolvedValueOnce({ success: true, data: [musterbrot] })
    renderWithTheme(<ProductsPageClient />)
    expect(await screen.findByText('Nicht angemeldet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Produktliste (1)')).toBeInTheDocument()
  })
})

describe('ProductEditLoader', () => {
  it('404 endet in „nicht gefunden“, nicht in einem leeren Formular', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Produkt nicht gefunden.', 404, 'not_found')
    )
    renderWithTheme(<ProductEditLoader productId="gibt-es-nicht" />)
    expect(await screen.findByText(/nicht gefunden/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Produktname/)).toBeNull()
  })

  it('wartendes Produkt: Hinweis mit freigegebenem Stand', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: probekruste })
    renderWithTheme(<ProductEditLoader productId="probekruste" />)
    expect(await screen.findByLabelText(/Produktname/)).toHaveValue(
      'Probekruste neu'
    )
    expect(apiClient.get).toHaveBeenCalledWith('/api/hq-products/probekruste')
    expect(screen.getByText('wartet auf Freigabe')).toBeInTheDocument()
    expect(
      screen.getByText(/Bis dahin gilt der freigegebene Stand: Probekruste/)
    ).toBeInTheDocument()
  })

  it('Speichern, das auf Freigabe wartet, zeigt Chip und Hinweis', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: musterbrot })
    apiClient.put.mockResolvedValue({
      success: true,
      pending: true,
      data: { ...musterbrot, price: 3.5, pendingApproval: true },
    })
    renderWithTheme(<ProductEditLoader productId="musterbrot" />)
    const price = await screen.findByLabelText('Preis (EUR)')
    expect(screen.queryByText('wartet auf Freigabe')).toBeNull()
    fireEvent.change(price, { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/hq-products/musterbrot',
        expect.objectContaining({
          price: 3.5,
          description: musterbrot.description,
        })
      )
    )
    expect(
      await screen.findByText('Gespeichert - die Änderung wartet auf Freigabe.')
    ).toBeInTheDocument()
    expect(screen.getByText('wartet auf Freigabe')).toBeInTheDocument()
    expect(
      screen.getByText(/freigegebene Stand: Musterbrot/)
    ).toBeInTheDocument()
  })

  it('Produkt ohne Beschreibung: unverändertes Speichern schickt keinen Kurztext als Beschreibung', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: leertext })
    apiClient.put.mockResolvedValue({
      success: true,
      pending: false,
      data: { ...leertext, description: '', rawDescription: undefined },
    })
    renderWithTheme(<ProductEditLoader productId="leertext" />)
    expect(await screen.findByLabelText(/^Beschreibung/)).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/hq-products/leertext',
        expect.objectContaining({
          short_description: 'Nur ein Teaser.',
          description: '',
        })
      )
    )
  })

  it('Verkauf sieht das Produkt ohne Speichern', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: musterbrot })
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'verkauf' })}>
        <ProductEditLoader productId="musterbrot" />
      </WithSession>
    )
    expect(await screen.findByLabelText(/Produktname/)).toBeInTheDocument()
    expect(
      screen.getByText(/Produkte ändert nur der Inhaber/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Speichern/ })).toBeNull()
  })
})
