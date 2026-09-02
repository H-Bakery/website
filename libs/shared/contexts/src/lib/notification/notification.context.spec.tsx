/**
 * @fileoverview Tests for enhanced notification context
 * @module @bakery/shared/contexts/notification/tests
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NotificationProvider, useNotifications } from './notification.context'

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
}

global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket)

// Mock sound API
const mockAudio = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
}

global.Audio = jest.fn().mockImplementation(() => mockAudio)

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should initialize with empty notifications', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('should add notification', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'success',
        message: 'Test notification',
        title: 'Success',
      })
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0]).toMatchObject({
      type: 'success',
      message: 'Test notification',
      title: 'Success',
      read: false,
    })
    expect(result.current.unreadCount).toBe(1)
  })

  it('should auto-dismiss notifications based on type', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'success',
        message: 'Auto dismiss',
      })
    })

    expect(result.current.notifications).toHaveLength(1)

    // Fast-forward time for auto-dismiss (success = 4000ms)
    act(() => {
      jest.advanceTimersByTime(4500)
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should not auto-dismiss persistent notifications', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Persistent notification',
        persistent: true,
      })
    })

    expect(result.current.notifications).toHaveLength(1)

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(10000)
    })

    // Should still be there
    expect(result.current.notifications).toHaveLength(1)
  })

  it('should dismiss notification by id', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    let notificationId: string

    act(() => {
      const notification = result.current.addNotification({
        type: 'info',
        message: 'Test notification',
      })
      notificationId = notification.id
    })

    expect(result.current.notifications).toHaveLength(1)

    act(() => {
      result.current.dismissNotification(notificationId)
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should mark notification as read', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    let notificationId: string

    act(() => {
      const notification = result.current.addNotification({
        type: 'info',
        message: 'Test notification',
      })
      notificationId = notification.id
    })

    expect(result.current.unreadCount).toBe(1)

    act(() => {
      result.current.markAsRead(notificationId)
    })

    expect(result.current.notifications[0].read).toBe(true)
    expect(result.current.unreadCount).toBe(0)
  })

  it('should mark all notifications as read', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Notification 1',
      })
      result.current.addNotification({
        type: 'info',
        message: 'Notification 2',
      })
      result.current.addNotification({
        type: 'info',
        message: 'Notification 3',
      })
    })

    expect(result.current.unreadCount).toBe(3)

    act(() => {
      result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.read)).toBe(true)
  })

  it('should clear all notifications', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Notification 1',
      })
      result.current.addNotification({
        type: 'info',
        message: 'Notification 2',
      })
    })

    expect(result.current.notifications).toHaveLength(2)

    act(() => {
      result.current.clearAllNotifications()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it('should handle different notification types with correct durations', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    // Add different types
    act(() => {
      result.current.addNotification({ type: 'success', message: 'Success' })
      result.current.addNotification({ type: 'error', message: 'Error' })
      result.current.addNotification({ type: 'warning', message: 'Warning' })
      result.current.addNotification({ type: 'info', message: 'Info' })
    })

    expect(result.current.notifications).toHaveLength(4)

    // Success should disappear first (4000ms)
    act(() => {
      jest.advanceTimersByTime(4500)
    })
    expect(result.current.notifications).toHaveLength(3)

    // Info should disappear next (6000ms total)
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.notifications).toHaveLength(2)

    // Warning should disappear next (8000ms total)
    act(() => {
      jest.advanceTimersByTime(2500)
    })
    expect(result.current.notifications).toHaveLength(1)

    // Error should still be there (doesn't auto-dismiss)
    expect(result.current.notifications[0].type).toBe('error')
  })

  it('should play sound for notifications when enabled', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider enableSound>{children}</NotificationProvider>
      ),
    })

    act(() => {
      result.current.addNotification({
        type: 'success',
        message: 'Success with sound',
        playSound: true,
      })
    })

    expect(mockAudio.play).toHaveBeenCalled()
  })

  it('should not play sound when disabled globally', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider enableSound={false}>
          {children}
        </NotificationProvider>
      ),
    })

    act(() => {
      result.current.addNotification({
        type: 'success',
        message: 'Success without sound',
        playSound: true,
      })
    })

    expect(mockAudio.play).not.toHaveBeenCalled()
  })

  it('should handle actions on notifications', () => {
    const mockAction = jest.fn()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Notification with action',
        actions: [
          {
            label: 'Click me',
            action: mockAction,
          },
        ],
      })
    })

    const notification = result.current.notifications[0]
    expect(notification.actions).toHaveLength(1)

    // Trigger action
    act(() => {
      notification.actions![0].action()
    })

    expect(mockAction).toHaveBeenCalled()
  })

  it('should handle real-time notifications via WebSocket', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider enableRealTime wsUrl="ws://localhost:8080">
          {children}
        </NotificationProvider>
      ),
    })

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080')

    // Simulate WebSocket message
    const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === 'message'
    )?.[1]

    act(() => {
      messageHandler?.({
        data: JSON.stringify({
          type: 'notification',
          payload: {
            type: 'info',
            message: 'Real-time notification',
            title: 'New Order',
          },
        }),
      })
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].message).toBe(
      'Real-time notification'
    )
  })

  it('should reconnect WebSocket on connection loss', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider enableRealTime wsUrl="ws://localhost:8080">
          {children}
        </NotificationProvider>
      ),
    })

    // Simulate connection close
    const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === 'close'
    )?.[1]

    act(() => {
      closeHandler?.({ code: 1006 }) // Abnormal closure
    })

    // Should attempt to reconnect after delay
    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle notification limits', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider maxNotifications={3}>
          {children}
        </NotificationProvider>
      ),
    })

    // Add 5 notifications
    act(() => {
      for (let i = 1; i <= 5; i++) {
        result.current.addNotification({
          type: 'info',
          message: `Notification ${i}`,
          persistent: true, // Prevent auto-dismiss
        })
      }
    })

    // Should only keep the last 3
    expect(result.current.notifications).toHaveLength(3)
    expect(result.current.notifications[0].message).toBe('Notification 3')
    expect(result.current.notifications[2].message).toBe('Notification 5')
  })

  it('should filter notifications by type', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    act(() => {
      result.current.addNotification({ type: 'success', message: 'Success 1' })
      result.current.addNotification({ type: 'error', message: 'Error 1' })
      result.current.addNotification({ type: 'success', message: 'Success 2' })
      result.current.addNotification({ type: 'warning', message: 'Warning 1' })
    })

    const successNotifications =
      result.current.getNotificationsByType('success')
    const errorNotifications = result.current.getNotificationsByType('error')

    expect(successNotifications).toHaveLength(2)
    expect(errorNotifications).toHaveLength(1)
    expect(successNotifications.every((n) => n.type === 'success')).toBe(true)
    expect(errorNotifications.every((n) => n.type === 'error')).toBe(true)
  })

  it('should throw error when used outside provider', () => {
    // React meldet den Render-Fehler zusätzlich über console.error
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications must be used within a NotificationProvider'
    )

    consoleError.mockRestore()
  })

  describe('Convenience methods', () => {
    let result: any

    beforeEach(() => {
      const wrapper = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })
      result = wrapper.result
    })

    it('should create success notification', () => {
      act(() => {
        result.current.notifySuccess('Success message', { title: 'Great!' })
      })

      expect(result.current.notifications[0]).toMatchObject({
        type: 'success',
        message: 'Success message',
        title: 'Great!',
      })
    })

    it('should create error notification', () => {
      act(() => {
        result.current.notifyError('Error message', { title: 'Oops!' })
      })

      expect(result.current.notifications[0]).toMatchObject({
        type: 'error',
        message: 'Error message',
        title: 'Oops!',
      })
    })

    it('should create warning notification', () => {
      act(() => {
        result.current.notifyWarning('Warning message')
      })

      expect(result.current.notifications[0]).toMatchObject({
        type: 'warning',
        message: 'Warning message',
      })
    })

    it('should create info notification', () => {
      act(() => {
        result.current.notifyInfo('Info message')
      })

      expect(result.current.notifications[0]).toMatchObject({
        type: 'info',
        message: 'Info message',
      })
    })
  })
})
