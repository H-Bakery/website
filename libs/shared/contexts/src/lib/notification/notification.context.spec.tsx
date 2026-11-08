/**
 * @fileoverview Tests for the notification context (`notification.context.tsx`).
 *
 * The provider loads notifications and preferences from `notificationService`,
 * keeps them in memory, derives stats and filtered lists, receives new ones
 * over a WebSocket (or polls) and shows browser notifications according to
 * the preferences. Loading behaviour without `/api/notifications` is covered
 * in `notification.loadOnMount.spec.tsx`.
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import type {
  Notification as NotificationType,
  NotificationPreferences,
} from '@bakery/shared/types'
import {
  NotificationProvider,
  NotificationProviderProps,
  useNotificationPreferences,
  useNotifications,
  useUnreadCount,
} from './notification.context'

// jest.mock is hoisted above the imports: the factory must not reference
// constants of this file, so the mock is read back with requireMock.
jest.mock('@bakery/shared/data-access', () => {
  // Marking as read and deleting share one mock: the assertions below look
  // at the state, not at which endpoint the provider picks.
  const write = jest.fn()
  return {
    notificationService: {
      getNotifications: jest.fn(),
      getPreferences: jest.fn(),
      deleteNotification: write,
      markAsRead: write,
      updatePreferences: jest.fn(),
    },
  }
})

const service = jest.requireMock('@bakery/shared/data-access')
  .notificationService as Record<string, jest.Mock>

// --- Browser fakes --------------------------------------------------------

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  close = jest.fn()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  static latest(): FakeWebSocket {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  }
}

const audioPlay = jest.fn()
class FakeAudio {
  src: string
  preload = ''
  play = audioPlay
  constructor(src: string) {
    this.src = src
  }
}

const browserNotification = jest.fn()
class FakeBrowserNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = jest.fn()
  constructor(title: string, options: unknown) {
    browserNotification(title, options)
  }
}

const original = {
  WebSocket: global.WebSocket,
  Audio: global.Audio,
  Notification: (global as { Notification?: unknown }).Notification,
}

beforeAll(() => {
  Object.assign(global, {
    WebSocket: FakeWebSocket,
    Audio: FakeAudio,
    Notification: FakeBrowserNotification,
  })
})

afterAll(() => {
  Object.assign(global, original)
})

// --- Synthetic data -------------------------------------------------------

function notification(
  id: string,
  overrides: Partial<NotificationType> = {}
): NotificationType {
  return {
    id,
    type: 'info',
    category: 'order',
    priority: 'medium',
    channel: 'inApp',
    title: `Meldung ${id}`,
    message: `Text ${id}`,
    createdAt: new Date('2026-03-10T08:00:00.000Z'),
    read: false,
    ...overrides,
  }
}

const seed = [
  notification('1', {
    category: 'order',
    priority: 'high',
    title: 'Neue Bestellung',
    message: 'Bestellung für Samstag',
  }),
  notification('2', {
    category: 'inventory',
    priority: 'low',
    channel: 'email',
    read: true,
    title: 'Mehl knapp',
    message: 'Nur noch wenig Weizenmehl',
    createdAt: new Date('2026-03-01T08:00:00.000Z'),
  }),
  notification('3', {
    category: 'system',
    priority: 'urgent',
    channel: 'push',
    title: 'Wartung',
    message: 'Server startet neu',
    createdAt: new Date('2026-03-20T08:00:00.000Z'),
  }),
]

function preferences(
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences {
  return {
    userId: 'u1',
    channels: {
      // Browser notifications only appear for categories listed here.
      inApp: {
        enabled: true,
        categories: ['order', 'inventory', 'staff', 'system', 'customer'],
        minPriority: 'low',
      },
      email: { enabled: false, categories: [], minPriority: 'medium' },
      sms: { enabled: false, categories: [], minPriority: 'high' },
      push: { enabled: false, categories: [], minPriority: 'medium' },
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '06:00',
      timezone: 'UTC',
    },
    sound: { enabled: true, volume: 50 },
    digest: {
      enabled: false,
      frequency: 'daily',
      time: '09:00',
      categories: [],
    },
    language: 'de',
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    ...overrides,
  }
}

// --- Helpers --------------------------------------------------------------

const quiet: Partial<NotificationProviderProps> = {
  enableRealTime: false,
  pollingInterval: 0,
  requestPermissionOnMount: false,
}

function wrapperWith(props: Partial<NotificationProviderProps> = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NotificationProvider {...quiet} {...props}>
        {children}
      </NotificationProvider>
    )
  }
}

async function renderLoaded(props: Partial<NotificationProviderProps> = {}) {
  const hook = renderHook(() => useNotifications(), {
    wrapper: wrapperWith(props),
  })
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

function send(socket: FakeWebSocket, payload: unknown) {
  act(() => {
    socket.onmessage?.({ data: JSON.stringify(payload) })
  })
}

describe('NotificationContext', () => {
  let consoleError: jest.SpyInstance
  let consoleLog: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    FakeWebSocket.instances = []
    FakeBrowserNotification.permission = 'default'
    audioPlay.mockResolvedValue(undefined)
    service.getNotifications.mockResolvedValue({ success: true, data: seed })
    service.getPreferences.mockResolvedValue({ success: true, data: null })
    service.deleteNotification.mockResolvedValue({ success: true })
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    consoleError.mockRestore()
    consoleLog.mockRestore()
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications must be used within a NotificationProvider'
    )
  })

  describe('loading', () => {
    it('loads notifications and preferences on mount', async () => {
      const prefs = preferences()
      service.getPreferences.mockResolvedValue({ success: true, data: prefs })

      const { result } = await renderLoaded()

      expect(result.current.notifications).toEqual(seed)
      expect(result.current.preferences).toEqual(prefs)
      expect(result.current.available).toBe(true)
    })

    it('derives unread count and statistics', async () => {
      const { result } = await renderLoaded()

      expect(result.current.unreadCount).toBe(2)
      expect(result.current.stats).toMatchObject({
        total: 3,
        unread: 2,
        byCategory: {
          order: 1,
          inventory: 1,
          system: 1,
          staff: 0,
          customer: 0,
        },
        byPriority: { low: 1, medium: 0, high: 1, urgent: 1 },
        byChannel: { inApp: 1, email: 1, push: 1, sms: 0 },
      })
    })

    it('refresh loads again', async () => {
      const { result } = await renderLoaded()
      service.getNotifications.mockResolvedValue({
        success: true,
        data: [seed[0]],
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.notifications).toEqual([seed[0]])
    })

    it('polls when real-time updates are off', async () => {
      await renderLoaded({ pollingInterval: 20 })

      await waitFor(() =>
        expect(service.getNotifications.mock.calls.length).toBeGreaterThan(2)
      )
    })

    it('asks for browser permission on mount when not decided yet', () => {
      renderHook(() => useNotifications(), {
        wrapper: wrapperWith({ requestPermissionOnMount: true }),
      })

      expect(FakeBrowserNotification.requestPermission).toHaveBeenCalled()
    })

    it('does not ask again once permission is decided', () => {
      FakeBrowserNotification.permission = 'denied'
      renderHook(() => useNotifications(), {
        wrapper: wrapperWith({ requestPermissionOnMount: true }),
      })

      expect(FakeBrowserNotification.requestPermission).not.toHaveBeenCalled()
    })
  })

  describe('filters', () => {
    it('shows everything without filters', async () => {
      const { result } = await renderLoaded()

      expect(result.current.filters).toEqual({})
      expect(result.current.filteredNotifications).toEqual(seed)
    })

    it.each([
      ['unread only', { unreadOnly: true }, ['1', '3']],
      ['category', { categories: ['inventory' as const] }, ['2']],
      [
        'priority',
        { priorities: ['high' as const, 'urgent' as const] },
        ['1', '3'],
      ],
      ['channel', { channels: ['push' as const] }, ['3']],
      ['search in title, any case', { search: 'MEHL' }, ['2']],
      ['search in message', { search: 'samstag' }, ['1']],
      [
        'date range',
        {
          dateRange: {
            start: new Date('2026-03-05T00:00:00.000Z'),
            end: new Date('2026-03-15T00:00:00.000Z'),
          },
        },
        ['1'],
      ],
    ])('filters by %s', async (_label, filters, expectedIds) => {
      const { result } = await renderLoaded()

      act(() => result.current.setFilters(filters))

      expect(result.current.filteredNotifications.map((n) => n.id)).toEqual(
        expectedIds
      )
      // Statistics always describe all notifications.
      expect(result.current.stats.total).toBe(3)
    })
  })

  describe('reading and deleting', () => {
    it('markAsRead marks one notification as read', async () => {
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.markAsRead('1')
      })

      expect(result.current.notifications.find((n) => n.id === '1')?.read).toBe(
        true
      )
      expect(result.current.unreadCount).toBe(1)
    })

    it('markAsRead reverts when the server refuses', async () => {
      service.deleteNotification.mockRejectedValue(new Error('Serverfehler'))
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.markAsRead('1')
      })

      expect(result.current.notifications.find((n) => n.id === '1')?.read).toBe(
        false
      )
      expect(consoleError).toHaveBeenCalled()
    })

    it('markAllAsRead marks every notification as read', async () => {
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.markAllAsRead()
      })

      expect(result.current.unreadCount).toBe(0)
      expect(result.current.notifications.every((n) => n.read)).toBe(true)
    })

    it('deleteNotification removes one notification', async () => {
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.deleteNotification('2')
      })

      expect(service.deleteNotification).toHaveBeenCalledWith('2')
      expect(result.current.notifications.map((n) => n.id)).toEqual(['1', '3'])
    })

    it('deleteNotification reloads from the server when deleting fails', async () => {
      const { result } = await renderLoaded()
      service.deleteNotification.mockRejectedValue(new Error('Serverfehler'))
      service.getNotifications.mockClear()

      await act(async () => {
        await result.current.deleteNotification('2')
      })

      await waitFor(() => expect(result.current.notifications).toEqual(seed))
      expect(service.getNotifications).toHaveBeenCalledTimes(1)
    })

    it('clearAll removes every notification', async () => {
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.clearAll()
      })

      expect(result.current.notifications).toEqual([])
      expect(service.deleteNotification).toHaveBeenCalledTimes(3)
    })
  })

  describe('preferences', () => {
    it('updatePreferences keeps what the server returns', async () => {
      const updated = preferences({ language: 'en' })
      service.updatePreferences.mockResolvedValue({
        success: true,
        data: updated,
      })
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.updatePreferences({ language: 'en' })
      })

      expect(service.updatePreferences).toHaveBeenCalledWith({ language: 'en' })
      expect(result.current.preferences).toEqual(updated)
    })

    it('updatePreferences rethrows server errors', async () => {
      service.updatePreferences.mockRejectedValue(new Error('Serverfehler'))
      const { result } = await renderLoaded()

      let failed = false
      await act(async () => {
        await result.current.updatePreferences({ language: 'en' }).catch(() => {
          failed = true
        })
      })

      expect(failed).toBe(true)
    })

    it('resetPreferences sends the German defaults', async () => {
      const defaults = preferences()
      service.updatePreferences.mockResolvedValue({
        success: true,
        data: defaults,
      })
      const { result } = await renderLoaded()

      await act(async () => {
        await result.current.resetPreferences()
      })

      expect(service.updatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'de',
          quietHours: expect.objectContaining({ enabled: false }),
          sound: { enabled: true, volume: 50 },
          channels: expect.objectContaining({
            inApp: { enabled: true, categories: [], minPriority: 'low' },
            sms: { enabled: false, categories: [], minPriority: 'high' },
          }),
        })
      )
      expect(result.current.preferences).toEqual(defaults)
    })

    it('useUnreadCount and useNotificationPreferences read the context', async () => {
      const prefs = preferences()
      service.getPreferences.mockResolvedValue({ success: true, data: prefs })
      const { result } = renderHook(
        () => ({
          unread: useUnreadCount(),
          prefs: useNotificationPreferences(),
        }),
        { wrapper: wrapperWith() }
      )

      await waitFor(() => expect(result.current.unread).toBe(2))
      expect(result.current.prefs).toEqual(prefs)
    })
  })

  describe('real-time updates', () => {
    const realTime: Partial<NotificationProviderProps> = {
      enableRealTime: true,
      autoMarkAsReadDelay: 0,
    }

    it('connects and reports the connection state', async () => {
      const { result } = await renderLoaded(realTime)
      const socket = FakeWebSocket.latest()

      expect(socket.url).toBe('ws://localhost:5000/notifications')
      expect(result.current.isConnected).toBe(false)

      act(() => socket.onopen?.())
      expect(result.current.isConnected).toBe(true)

      act(() => socket.onclose?.())
      expect(result.current.isConnected).toBe(false)
    })

    it('reconnects five seconds after the connection drops', async () => {
      await renderLoaded(realTime)
      const socket = FakeWebSocket.latest()
      const before = FakeWebSocket.instances.length

      jest.useFakeTimers()
      act(() => socket.onclose?.())
      act(() => {
        jest.advanceTimersByTime(4999)
      })
      expect(FakeWebSocket.instances.length).toBe(before)
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(FakeWebSocket.instances.length).toBe(before + 1)
    })

    it('closes the socket on unmount', async () => {
      const { unmount } = await renderLoaded(realTime)
      const socket = FakeWebSocket.latest()

      unmount()

      expect(socket.close).toHaveBeenCalled()
    })

    it('puts a pushed notification first and replaces one with the same id', async () => {
      const { result } = await renderLoaded(realTime)
      const socket = FakeWebSocket.latest()

      send(socket, {
        type: 'notification',
        payload: notification('4', { title: 'Neu' }),
      })
      expect(result.current.notifications.map((n) => n.id)).toEqual([
        '4',
        '1',
        '2',
        '3',
      ])

      send(socket, {
        type: 'notification',
        payload: notification('2', { title: 'Mehl wieder da' }),
      })
      expect(result.current.notifications.map((n) => n.id)).toEqual([
        '2',
        '4',
        '1',
        '3',
      ])
      expect(result.current.notifications[0].title).toBe('Mehl wieder da')
    })

    it('keeps at most maxNotifications', async () => {
      const { result } = await renderLoaded({
        ...realTime,
        maxNotifications: 3,
      })
      const socket = FakeWebSocket.latest()

      send(socket, { type: 'notification', payload: notification('4') })

      expect(result.current.notifications.map((n) => n.id)).toEqual([
        '4',
        '1',
        '2',
      ])
    })

    it('ignores other message types and logs unreadable ones', async () => {
      const { result } = await renderLoaded(realTime)
      const socket = FakeWebSocket.latest()

      send(socket, { type: 'ping' })
      act(() => socket.onmessage?.({ data: 'kein json' }))

      expect(result.current.notifications).toEqual(seed)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      )
    })

    it('marks a pushed notification as read after autoMarkAsReadDelay', async () => {
      const { result } = await renderLoaded({
        enableRealTime: true,
        autoMarkAsReadDelay: 20,
      })
      const socket = FakeWebSocket.latest()

      send(socket, { type: 'notification', payload: notification('4') })
      expect(result.current.notifications[0]).toMatchObject({
        id: '4',
        read: false,
      })

      await waitFor(() =>
        expect(result.current.notifications[0]).toMatchObject({
          id: '4',
          read: true,
        })
      )
    })
  })

  describe('browser notifications for pushed notifications', () => {
    async function connectWith(prefs: NotificationPreferences) {
      service.getPreferences.mockResolvedValue({ success: true, data: prefs })
      const hook = await renderLoaded({
        enableRealTime: true,
        autoMarkAsReadDelay: 0,
      })
      await waitFor(() =>
        expect(hook.result.current.preferences).toEqual(prefs)
      )
      return FakeWebSocket.latest()
    }

    it('shows one and plays the sound when allowed', async () => {
      FakeBrowserNotification.permission = 'granted'
      const socket = await connectWith(preferences())

      send(socket, {
        type: 'notification',
        payload: notification('4', { title: 'Abholung', message: '10 Uhr' }),
      })

      expect(browserNotification).toHaveBeenCalledWith(
        'Abholung',
        expect.objectContaining({ body: '10 Uhr', tag: '4' })
      )
      expect(audioPlay).toHaveBeenCalled()
    })

    it('stays silent without sound preference', async () => {
      FakeBrowserNotification.permission = 'granted'
      const socket = await connectWith(
        preferences({ sound: { enabled: false, volume: 0 } })
      )

      send(socket, { type: 'notification', payload: notification('4') })

      expect(browserNotification).toHaveBeenCalled()
      expect(audioPlay).not.toHaveBeenCalled()
    })

    it('shows nothing without browser permission', async () => {
      FakeBrowserNotification.permission = 'denied'
      const socket = await connectWith(preferences())

      send(socket, { type: 'notification', payload: notification('4') })

      expect(browserNotification).not.toHaveBeenCalled()
    })

    it('shows nothing below the minimum priority', async () => {
      FakeBrowserNotification.permission = 'granted'
      const prefs = preferences()
      prefs.channels.inApp.minPriority = 'high'
      const socket = await connectWith(prefs)

      send(socket, {
        type: 'notification',
        payload: notification('4', { priority: 'medium' }),
      })
      expect(browserNotification).not.toHaveBeenCalled()

      send(socket, {
        type: 'notification',
        payload: notification('5', { priority: 'urgent' }),
      })
      expect(browserNotification).toHaveBeenCalledTimes(1)
    })

    it('shows nothing for a category that is not selected', async () => {
      FakeBrowserNotification.permission = 'granted'
      const prefs = preferences()
      prefs.channels.inApp.categories = ['order']
      const socket = await connectWith(prefs)

      send(socket, {
        type: 'notification',
        payload: notification('4', { category: 'staff' }),
      })

      expect(browserNotification).not.toHaveBeenCalled()
    })

    it('shows nothing when in-app notifications are switched off', async () => {
      FakeBrowserNotification.permission = 'granted'
      const prefs = preferences()
      prefs.channels.inApp.enabled = false
      const socket = await connectWith(prefs)

      send(socket, { type: 'notification', payload: notification('4') })

      expect(browserNotification).not.toHaveBeenCalled()
    })
  })
})
