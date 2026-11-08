import {
  bulkPreorderStatus,
  fetchPreorderSums,
  requestFailureKind,
  savePickupPoint,
} from './preordersApi'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; post: jest.Mock; put: jest.Mock }
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.post.mockReset()
  apiClient.put.mockReset()
})

describe('preordersApi (W4)', () => {
  it('bulkPreorderStatus: ein Request, Fassung je Bestellung als Map', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        counts: { ok: 1, conflict: 1, anonymized: 0, not_found: 0, refused: 0 },
        results: [
          { id: 1, result: 'ok' },
          { id: 2, result: 'conflict', error: 'stale_preorder' },
        ],
      },
    })
    const answer = await bulkPreorderStatus(
      [
        { id: 1, updatedAt: '2026-11-12T08:00:00.000Z' },
        { id: 2, updatedAt: null },
      ],
      { notCollected: true }
    )
    expect(apiClient.post).toHaveBeenCalledWith('/api/preorders/bulk-status', {
      ids: [1, 2],
      notCollected: true,
      // ohne bekannten Stand keine Prüfung für diese Bestellung
      expectedUpdatedAt: { '1': '2026-11-12T08:00:00.000Z' },
    })
    expect(answer.counts.conflict).toBe(1)
    expect(answer.results).toHaveLength(2)
  })

  it('requestFailureKind: offline, Serverfehler oder abgelehnt', () => {
    expect(requestFailureKind(new Error('Failed to fetch'))).toBe('offline')
    expect(requestFailureKind(new Error('Request timeout'))).toBe('offline')
    expect(requestFailureKind({ status: 502 })).toBe('server')
    expect(requestFailureKind({ status: 500 })).toBe('server')
    expect(requestFailureKind({ status: 409 })).toBe('refused')
    expect(requestFailureKind({ status: 403 })).toBe('refused')
    expect(requestFailureKind(null)).toBe('offline')
  })

  it('savePickupPoint schickt den geladenen Stand mit, ohne Stand nicht', async () => {
    apiClient.put.mockResolvedValue({ success: true, data: { id: 'p' } })
    const input = {
      name: 'Kita Test',
      street: '',
      zip: '',
      city: '',
      weekday: 6,
      window: null,
      orderDeadline: null,
      notes: null,
      active: true,
    }
    await savePickupPoint('p', input, '2026-11-01T10:00:00.000Z')
    expect(apiClient.put).toHaveBeenLastCalledWith(
      '/api/preorders/pickup-points/p',
      { ...input, expectedUpdatedAt: '2026-11-01T10:00:00.000Z' }
    )
    await savePickupPoint('p', input)
    expect(apiClient.put).toHaveBeenLastCalledWith(
      '/api/preorders/pickup-points/p',
      input
    )
  })

  it('fetchPreorderSums fragt je Abholort', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { items: [] } })
    await fetchPreorderSums('2026-11-14', 'kita-test')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/preorders/sums?date=2026-11-14&pickupPointId=kita-test'
    )
  })
})
