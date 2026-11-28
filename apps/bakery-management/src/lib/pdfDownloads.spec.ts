import { downloadInvoiceDraftPdf } from './invoicesApi'
import { downloadPreorderPdf } from './preordersApi'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { getBlob: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { getBlob: jest.Mock }
}

beforeEach(() => apiClient.getBlob.mockReset())

/**
 * Beide PDFs brauchen das Token: ein Link ginge ohne `Authorization` an die
 * API (401). Deshalb `apiClient.getBlob` und Speichern aus dem Blob.
 */
describe('PDF-Downloads mit Token', () => {
  it('downloadPreorderPdf lädt den Bestellschein und speichert unter dem Servernamen', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    apiClient.getBlob.mockResolvedValue({
      blob,
      contentType: 'application/pdf',
      filename: 'Bestellschein-LA-2026-11-17-03.pdf',
    })
    const save = jest.fn()
    await downloadPreorderPdf({ id: 7, code: 'LA-2026-11-17-03' }, save)
    expect(apiClient.getBlob).toHaveBeenCalledWith('/api/preorders/7/pdf')
    expect(save).toHaveBeenCalledWith(
      blob,
      'Bestellschein-LA-2026-11-17-03.pdf'
    )
  })

  it('downloadPreorderPdf nimmt ohne Content-Disposition den Bestellcode', async () => {
    const blob = new Blob(['%PDF'])
    apiClient.getBlob.mockResolvedValue({
      blob,
      contentType: null,
      filename: null,
    })
    const save = jest.fn()
    await downloadPreorderPdf({ id: 7, code: 'LA-2026-11-17-03' }, save)
    expect(save).toHaveBeenCalledWith(
      blob,
      'Bestellschein-LA-2026-11-17-03.pdf'
    )
  })

  it('downloadInvoiceDraftPdf lädt die Vorschau, nicht das Rechnungs-PDF', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    apiClient.getBlob.mockResolvedValue({
      blob,
      contentType: 'application/pdf',
      filename: 'Rechnungsentwurf-12.pdf',
    })
    const save = jest.fn()
    await downloadInvoiceDraftPdf({ id: 12, number: null }, save)
    expect(apiClient.getBlob).toHaveBeenCalledWith('/api/invoices/12/preview')
    expect(save).toHaveBeenCalledWith(blob, 'Rechnungsentwurf-12.pdf')
  })

  it('downloadInvoiceDraftPdf benennt ohne Servernamen nach Nummer oder id', async () => {
    const blob = new Blob(['%PDF'])
    apiClient.getBlob.mockResolvedValue({
      blob,
      contentType: null,
      filename: null,
    })
    const save = jest.fn()
    await downloadInvoiceDraftPdf({ id: 12, number: 'TEST-7' }, save)
    await downloadInvoiceDraftPdf({ id: 12, number: null }, save)
    expect(save.mock.calls.map((call) => call[1])).toEqual([
      'Rechnungsentwurf-TEST-7.pdf',
      'Rechnungsentwurf-12.pdf',
    ])
  })

  it('gibt den Fehler der API weiter und speichert nichts', async () => {
    apiClient.getBlob.mockRejectedValue(new Error('Nicht angemeldet.'))
    const save = jest.fn()
    await expect(
      downloadPreorderPdf({ id: 7, code: 'LA-1' }, save)
    ).rejects.toThrow('Nicht angemeldet.')
    expect(save).not.toHaveBeenCalled()
  })
})
