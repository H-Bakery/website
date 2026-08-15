import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsPage from './page'
import { notificationArchiveService } from '../../../services/notificationArchiveService'

const mockUseNotifications = jest.fn()

jest.mock('@bakery/shared/contexts', () => ({
  useNotifications: () => mockUseNotifications(),
}))

jest.mock('../../../services/notificationArchiveService', () => ({
  notificationArchiveService: {
    archive: jest.fn(),
    list: jest.fn(),
    stats: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
  },
}))

const mockedArchive = notificationArchiveService as jest.Mocked<
  typeof notificationArchiveService
>

const NOTIFICATIONS = [
  {
    id: 'n-1',
    type: 'warning',
    category: 'inventory',
    priority: 'high',
    title: 'Niedriger Bestand',
    message: 'Roggenmehl unter Mindestmenge',
    read: false,
    channel: 'inApp',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n-2',
    type: 'success',
    category: 'order',
    priority: 'low',
    title: 'Neue Bestellung',
    message: 'Bestellung #42 wurde aufgegeben',
    read: true,
    channel: 'inApp',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'n-3',
    type: 'error',
    category: 'staff',
    priority: 'urgent',
    title: 'Krankmeldung',
    message: 'Lisa fällt morgen aus',
    read: false,
    channel: 'inApp',
    createdAt: new Date().toISOString(),
  },
]

const buildContext = (overrides: Record<string, unknown> = {}) => ({
  notifications: NOTIFICATIONS,
  unreadCount: 2,
  stats: {
    total: 3,
    unread: 2,
    byCategory: {},
    byPriority: { urgent: 1, high: 1, low: 1 },
    byChannel: {},
  },
  isLoading: false,
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined),
  deleteNotification: jest.fn().mockResolvedValue(undefined),
  refresh: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedArchive.archive.mockResolvedValue(undefined)
  })

  it('shows a loading indicator while notifications load', () => {
    mockUseNotifications.mockReturnValue(
      buildContext({ isLoading: true, notifications: [] })
    )
    render(<NotificationsPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders notifications with German labels and stats', () => {
    mockUseNotifications.mockReturnValue(buildContext())
    render(<NotificationsPage />)

    expect(
      screen.getByRole('heading', { name: 'Benachrichtigungen' })
    ).toBeInTheDocument()
    expect(screen.getByText('Niedriger Bestand')).toBeInTheDocument()
    expect(screen.getByText('Krankmeldung')).toBeInTheDocument()
    // priority + category chips are translated (stats cards also show
    // "Dringend"/"Hoch", so scope to the list item)
    const urgentItem = screen
      .getByText('Krankmeldung')
      .closest('li') as HTMLElement
    expect(within(urgentItem).getByText('Dringend')).toBeInTheDocument()
    expect(within(urgentItem).getByText('Personal')).toBeInTheDocument()
    expect(within(urgentItem).queryByText('urgent')).not.toBeInTheDocument()
    const highItem = screen
      .getByText('Niedriger Bestand')
      .closest('li') as HTMLElement
    expect(within(highItem).getByText('Hoch')).toBeInTheDocument()
    expect(within(highItem).getByText('Lager')).toBeInTheDocument()
    // unread tab counter
    expect(
      screen.getByRole('tab', { name: 'Ungelesen (2)' })
    ).toBeInTheDocument()
    // link to archive, no more link to the removed "archival" page
    expect(
      screen.getByRole('link', { name: /Archiv anzeigen/ })
    ).toHaveAttribute('href', '/admin/notifications/archive')
    expect(screen.queryByText('Archivierung verwalten')).not.toBeInTheDocument()
  })

  it('filters to unread notifications on the "Ungelesen" tab', async () => {
    const user = userEvent.setup()
    mockUseNotifications.mockReturnValue(buildContext())
    render(<NotificationsPage />)

    await user.click(screen.getByRole('tab', { name: 'Ungelesen (2)' }))

    expect(screen.getByText('Niedriger Bestand')).toBeInTheDocument()
    expect(screen.getByText('Krankmeldung')).toBeInTheDocument()
    expect(screen.queryByText('Neue Bestellung')).not.toBeInTheDocument()
  })

  it('marks a notification as read when clicked', async () => {
    const user = userEvent.setup()
    const ctx = buildContext()
    mockUseNotifications.mockReturnValue(ctx)
    render(<NotificationsPage />)

    await user.click(screen.getByText('Niedriger Bestand'))
    expect(ctx.markAsRead).toHaveBeenCalledWith('n-1')

    // already read notifications are not re-marked
    await user.click(screen.getByText('Neue Bestellung'))
    expect(ctx.markAsRead).toHaveBeenCalledTimes(1)
  })

  it('marks all as read via the toolbar button', async () => {
    const user = userEvent.setup()
    const ctx = buildContext()
    mockUseNotifications.mockReturnValue(ctx)
    render(<NotificationsPage />)

    await user.click(screen.getByRole('button', { name: 'Alle gelesen' }))
    expect(ctx.markAllAsRead).toHaveBeenCalled()
    expect(
      await screen.findByText('Alle Benachrichtigungen als gelesen markiert')
    ).toBeInTheDocument()
  })

  it('archives a notification and refreshes the list', async () => {
    const user = userEvent.setup()
    const ctx = buildContext()
    mockUseNotifications.mockReturnValue(ctx)
    render(<NotificationsPage />)

    const item = screen.getByText('Krankmeldung').closest('li') as HTMLElement
    await user.click(within(item).getByRole('button', { name: 'Archivieren' }))

    await waitFor(() =>
      expect(mockedArchive.archive).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'n-3' })
      )
    )
    expect(ctx.refresh).toHaveBeenCalled()
    expect(
      await screen.findByText('Benachrichtigung archiviert')
    ).toBeInTheDocument()
    // marking as read must not be triggered by the action button
    expect(ctx.markAsRead).not.toHaveBeenCalled()
  })

  it('shows an error when archiving fails', async () => {
    const user = userEvent.setup()
    mockedArchive.archive.mockRejectedValue(new Error('offline'))
    mockUseNotifications.mockReturnValue(buildContext())
    render(<NotificationsPage />)

    const item = screen.getByText('Krankmeldung').closest('li') as HTMLElement
    await user.click(within(item).getByRole('button', { name: 'Archivieren' }))

    expect(
      await screen.findByText('Fehler beim Archivieren der Benachrichtigung')
    ).toBeInTheDocument()
  })

  it('deletes a notification', async () => {
    const user = userEvent.setup()
    const ctx = buildContext()
    mockUseNotifications.mockReturnValue(ctx)
    render(<NotificationsPage />)

    const item = screen
      .getByText('Neue Bestellung')
      .closest('li') as HTMLElement
    await user.click(within(item).getByRole('button', { name: 'Löschen' }))

    expect(ctx.deleteNotification).toHaveBeenCalledWith('n-2')
    expect(
      await screen.findByText('Benachrichtigung gelöscht')
    ).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', () => {
    mockUseNotifications.mockReturnValue(
      buildContext({
        notifications: [],
        unreadCount: 0,
        stats: {
          total: 0,
          unread: 0,
          byCategory: {},
          byPriority: {},
          byChannel: {},
        },
      })
    )
    render(<NotificationsPage />)
    expect(
      screen.getByText('Keine Benachrichtigungen gefunden')
    ).toBeInTheDocument()
  })
})
