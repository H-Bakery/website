import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from './notification.context'

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
