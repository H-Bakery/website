import { deleteVisit, downloadReportCsv, reportCsvFileName } from './partnerApi'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { delete: jest.fn(), getBlob: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { delete: jest.Mock; getBlob: jest.Mock }
}

beforeEach(() => {
  apiClient.delete.mockReset()
  apiClient.getBlob.mockReset()
})

describe('partnerApi (F4)', () => {
  it('deleteVisit gibt die Meldung der echten API weiter (200 { id, deleted, message })', async () => {
    apiClient.delete.mockResolvedValue({
      success: true,
      data: { id: 12, deleted: true, message: 'Besuch gelöscht.' },
      message: 'Request successful',
    })
    await expect(deleteVisit(3, 12)).resolves.toEqual({
      id: 12,
      deleted: true,
      message: 'Besuch gelöscht.',
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/api/partners/3/visits/12')
  })

  it('deleteVisit verträgt eine leere Antwort (204 des Mocks)', async () => {
    apiClient.delete.mockResolvedValue({
      success: true,
      data: '',
      message: 'Request successful',
    })
    await expect(deleteVisit(3, 12)).resolves.toEqual({
      id: 12,
      deleted: true,
      message: 'Besuch gelöscht.',
    })
  })

  it('downloadReportCsv lädt mit Token (getBlob) und speichert unter dem Servernamen', async () => {
    const blob = { size: 3 } as unknown as Blob
    apiClient.getBlob.mockResolvedValue({
      blob,
      filename: 'partner-1.csv',
      contentType: 'text/csv',
    })
    const save = jest.fn()
    await downloadReportCsv(1, { from: '2026-01-05', to: '2026-01-11' }, save)
    expect(apiClient.getBlob).toHaveBeenCalledWith(
      '/api/partners/1/report.csv?from=2026-01-05&to=2026-01-11'
    )
    expect(save).toHaveBeenCalledWith(blob, 'partner-1.csv')
  })

  it('downloadReportCsv nimmt ohne Content-Disposition den eigenen Namen', async () => {
    apiClient.getBlob.mockResolvedValue({
      blob: {} as Blob,
      filename: null,
      contentType: 'text/csv',
    })
    const save = jest.fn()
    const range = { from: '2026-01-05', to: '2026-01-11' }
    await downloadReportCsv('1', range, save)
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      reportCsvFileName(range)
    )
    expect(reportCsvFileName(range)).toBe(
      'partner-report-2026-01-05-bis-2026-01-11.csv'
    )
  })

  it('downloadReportCsv reicht API-Fehler durch', async () => {
    apiClient.getBlob.mockRejectedValue(new Error('Nicht angemeldet.'))
    await expect(
      downloadReportCsv(1, { from: '2026-01-05', to: '2026-01-11' }, jest.fn())
    ).rejects.toThrow('Nicht angemeldet.')
  })
})
