import { apiClient } from '@bakery/shared/data-access'
import {
  acknowledgeDelta,
  confirmDay,
  correctionPath,
  fetchBackzettelDay,
  reopenDay,
  setCorrection,
  setLineDone,
  setSeasonFactor,
} from './backzettelApi'
import { saturdayDraft } from './backzettelFixtures'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}))

const client = apiClient as unknown as {
  get: jest.Mock
  put: jest.Mock
  post: jest.Mock
}

describe('backzettelApi', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.put.mockReset()
    client.post.mockReset()
  })

  it('holt einen Tag und packt { success, data } aus', async () => {
    const day = saturdayDraft()
    client.get.mockResolvedValue({ success: true, data: day })
    await expect(fetchBackzettelDay('2026-11-28')).resolves.toBe(day)
    expect(client.get).toHaveBeenCalledWith('/api/backzettel/2026-11-28')
  })

  it('macht aus 409 ruhetag einen Zustand statt eines Fehlers', async () => {
    client.get.mockRejectedValue(
      Object.assign(
        new Error(
          'Montag ist Ruhetag - an diesem Tag gibt es keinen Backzettel.'
        ),
        { status: 409, code: 'ruhetag' }
      )
    )
    await expect(fetchBackzettelDay('2026-11-23')).resolves.toEqual({
      date: '2026-11-23',
      status: 'ruhetag',
      weekday: null,
      message: 'Montag ist Ruhetag - an diesem Tag gibt es keinen Backzettel.',
    })
  })

  it('wirft andere Fehler weiter', async () => {
    client.get.mockRejectedValue(
      Object.assign(new Error('Ungültiges Datum'), {
        status: 400,
        code: 'invalid_date',
      })
    )
    await expect(fetchBackzettelDay('x')).rejects.toThrow('Ungültiges Datum')
  })

  it('Korrektur: Variante als Segment, ohne Variante weggelassen, 0 ohne Grund', async () => {
    expect(correctionPath('2026-11-28', 'zopf', 'nuss')).toBe(
      '/api/backzettel/2026-11-28/lines/zopf/nuss/correction'
    )
    expect(correctionPath('2026-11-28', 'weck', null)).toBe(
      '/api/backzettel/2026-11-28/lines/weck/correction'
    )
    client.put.mockResolvedValue({ success: true, data: saturdayDraft() })
    await setCorrection('2026-11-28', 'zopf', 'nuss', 2, 'Testgrund')
    expect(client.put).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/lines/zopf/nuss/correction',
      { correction: 2, reason: 'Testgrund' }
    )
    await setCorrection('2026-11-28', 'weck', null, 0, 'egal')
    expect(client.put).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/lines/weck/correction',
      { correction: 0, reason: null }
    )
  })

  it('Saison, Freigeben, Wieder öffnen, Abhaken, Quittieren', async () => {
    client.put.mockResolvedValue({ success: true, data: {} })
    client.post.mockResolvedValue({ success: true, data: {} })
    await setSeasonFactor('2026-11-28', 1.2)
    expect(client.put).toHaveBeenCalledWith(
      '/api/backzettel/2026-11-28/season',
      {
        factor: 1.2,
      }
    )
    await confirmDay('2026-11-28')
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/confirm',
      {}
    )
    await reopenDay('2026-11-28', '  Testgrund ')
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/reopen',
      { reason: 'Testgrund' }
    )
    await reopenDay('2026-11-28')
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/reopen',
      {}
    )
    await setLineDone('2026-11-28', 12, true)
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/lines/12/done',
      {}
    )
    await setLineDone('2026-11-28', 12, false)
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/lines/12/undone',
      {}
    )
    await acknowledgeDelta('2026-11-28', 7)
    expect(client.post).toHaveBeenLastCalledWith(
      '/api/backzettel/2026-11-28/deltas/7/ack',
      {}
    )
  })
})
