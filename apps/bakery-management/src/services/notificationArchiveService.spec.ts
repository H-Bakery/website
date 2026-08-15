import {
  notificationArchiveService,
  type ArchivedNotification,
} from './notificationArchiveService'

const NOTIFICATION: ArchivedNotification = {
  id: 'n-1',
  type: 'warning',
  category: 'inventory',
  priority: 'high',
  title: 'Niedriger Bestand',
  message: 'Roggenmehl unter Mindestmenge',
  read: false,
  channel: 'inApp',
  createdAt: '2026-08-10T08:00:00.000Z',
}

describe('notificationArchiveService (local fallback)', () => {
  let store: Record<string, string>
  let fetchMock: jest.Mock

  beforeEach(() => {
    store = {}
    const ls = window.localStorage as unknown as Record<string, jest.Mock>
    ls.getItem.mockImplementation((key: string) => store[key] ?? null)
    ls.setItem.mockImplementation((key: string, value: string) => {
      store[key] = value
    })
    // Backend without archive endpoints: archive succeeds, everything else 404
    fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/archive') && init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({}) }
      }
      if (url === '/api/notifications' && init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({}) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('archives to the backend and keeps a local copy', async () => {
    await notificationArchiveService.archive(NOTIFICATION)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/n-1/archive',
      expect.objectContaining({ method: 'POST' })
    )
    const result = await notificationArchiveService.list()
    expect(result.local).toBe(true)
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0]).toMatchObject({
      id: 'n-1',
      title: 'Niedriger Bestand',
    })
    expect(result.notifications[0].archivedAt).toBeDefined()
  })

  it('filters the local archive by category and priority', async () => {
    await notificationArchiveService.archive(NOTIFICATION)
    await notificationArchiveService.archive({
      ...NOTIFICATION,
      id: 'n-2',
      category: 'order',
      priority: 'low',
    })

    expect(
      (await notificationArchiveService.list({ category: 'order' }))
        .notifications
    ).toHaveLength(1)
    expect(
      (
        await notificationArchiveService.list({ priority: 'high' })
      ).notifications.map((n) => n.id)
    ).toEqual(['n-1'])
  })

  it('computes archive stats', async () => {
    await notificationArchiveService.archive(NOTIFICATION)
    await notificationArchiveService.archive({
      ...NOTIFICATION,
      id: 'n-2',
      read: true,
      priority: 'urgent',
    })

    const stats = await notificationArchiveService.stats()
    expect(stats).toEqual({
      total: 2,
      read: 1,
      unread: 1,
      byCategory: { inventory: 2 },
      byPriority: { high: 1, urgent: 1 },
    })
  })

  it('restores by re-creating the notification when no restore endpoint exists', async () => {
    await notificationArchiveService.archive(NOTIFICATION)

    await notificationArchiveService.restore('n-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse(
      (
        fetchMock.mock.calls.find(
          ([url, init]) =>
            url === '/api/notifications' && init?.method === 'POST'
        ) as [string, RequestInit]
      )[1].body as string
    )
    expect(body).toMatchObject({ title: 'Niedriger Bestand' })
    expect(body.id).toBeUndefined()
    expect((await notificationArchiveService.list()).notifications).toEqual([])
  })

  it('permanently deletes from the local archive', async () => {
    await notificationArchiveService.archive(NOTIFICATION)
    await notificationArchiveService.permanentDelete('n-1')
    expect((await notificationArchiveService.list()).notifications).toEqual([])
  })

  it('throws when the backend rejects archiving', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(
      notificationArchiveService.archive(NOTIFICATION)
    ).rejects.toThrow('Archivieren fehlgeschlagen (500)')
  })
})
