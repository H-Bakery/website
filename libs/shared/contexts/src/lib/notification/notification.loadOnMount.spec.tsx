import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import {
  NOTIFICATIONS_UNAVAILABLE_KEY,
  NotificationProvider,
  useNotifications,
} from './notification.context'

const mockGetNotifications = jest.fn()
const mockGetPreferences = jest.fn()

jest.mock('@bakery/shared/data-access', () => ({
  notificationService: {
    getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
    getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  },
}))

function Probe() {
  const { isLoading, notifications } = useNotifications()
  return (
    <span data-testid="probe">
      {isLoading ? 'loading' : `idle:${notifications.length}`}
    </span>
  )
}

describe('NotificationProvider loadOnMount', () => {
  beforeEach(() => {
    mockGetNotifications
      .mockReset()
      .mockResolvedValue({ success: true, data: [] })
    mockGetPreferences
      .mockReset()
      .mockResolvedValue({ success: true, data: null })
  })

  it('loads notifications on mount by default', async () => {
    render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={0}
        requestPermissionOnMount={false}
      >
        <Probe />
      </NotificationProvider>
    )
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('idle:0')
    )
  })

  it('makes no request and is not loading with loadOnMount={false}', async () => {
    render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={0}
        requestPermissionOnMount={false}
        loadOnMount={false}
      >
        <Probe />
      </NotificationProvider>
    )
    expect(screen.getByTestId('probe').textContent).toBe('idle:0')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockGetNotifications).not.toHaveBeenCalled()
    expect(mockGetPreferences).not.toHaveBeenCalled()
  })
})

describe('NotificationProvider without /api/notifications (W4)', () => {
  function AvailabilityProbe() {
    const { available, isLoading } = useNotifications()
    return (
      <span data-testid="availability">
        {isLoading ? 'loading' : String(available)}
      </span>
    )
  }

  const notFound = () =>
    Object.assign(new Error('Nicht gefunden.'), {
      status: 404,
      code: 'not_found',
    })

  beforeEach(() => {
    window.sessionStorage.clear()
    mockGetNotifications.mockReset()
    mockGetPreferences.mockReset()
  })

  it('404: available=false, no console.error, polling stops, tab remembers', async () => {
    mockGetNotifications.mockRejectedValue(notFound())
    mockGetPreferences.mockRejectedValue(notFound())
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { unmount } = render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={15}
        requestPermissionOnMount={false}
      >
        <AvailabilityProbe />
      </NotificationProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('availability').textContent).toBe('false')
    )
    const calls = mockGetNotifications.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(mockGetNotifications.mock.calls.length).toBe(calls)
    expect(consoleError).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(NOTIFICATIONS_UNAVAILABLE_KEY)).toBe(
      '1'
    )
    unmount()

    // Reload in the same tab: no request at all.
    mockGetNotifications.mockClear()
    render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={0}
        requestPermissionOnMount={false}
      >
        <AvailabilityProbe />
      </NotificationProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('availability').textContent).toBe('false')
    )
    expect(mockGetNotifications).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('other failures still log and do not hide the feature', async () => {
    mockGetNotifications.mockRejectedValue(
      Object.assign(new Error('Serverfehler'), { status: 500 })
    )
    mockGetPreferences.mockResolvedValue({ success: true, data: null })
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={0}
        requestPermissionOnMount={false}
      >
        <AvailabilityProbe />
      </NotificationProvider>
    )
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(screen.getByTestId('availability').textContent).toBe('null')
    expect(window.sessionStorage.getItem(NOTIFICATIONS_UNAVAILABLE_KEY)).toBe(
      null
    )
    consoleError.mockRestore()
  })

  it('a working endpoint reports available=true', async () => {
    mockGetNotifications.mockResolvedValue({ success: true, data: [] })
    mockGetPreferences.mockResolvedValue({ success: true, data: null })
    render(
      <NotificationProvider
        enableRealTime={false}
        pollingInterval={0}
        requestPermissionOnMount={false}
      >
        <AvailabilityProbe />
      </NotificationProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('availability').textContent).toBe('true')
    )
  })
})
