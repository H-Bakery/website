import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ChatPage from './page'

// Ohne AuthProvider wirft useAuth - genau der Fall, den die Seite abfängt.
jest.mock('@bakery/shared/contexts', () => ({
  useAuth: () => {
    throw new Error('useAuth must be used within an AuthProvider')
  },
}))

jest.mock('@bakery/management/feature-chat', () => ({
  ChatMessageList: ({ messages }: { messages: { message: string }[] }) => (
    <ul>
      {messages.map((m) => (
        <li key={m.message}>{m.message}</li>
      ))}
    </ul>
  ),
  ChatMessageInput: ({ disabled }: { disabled?: boolean }) => (
    <input aria-label="Nachricht" disabled={disabled} />
  ),
}))

const jsonResponse = (status: number, body: unknown = []) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)

const POLL_MS = 5000

describe('ChatPage - Polling gegen einen fehlenden Endpunkt', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms)
    })
  }

  it('fragt nach einem 404 nicht weiter alle 5 Sekunden nach', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404))

    renderWithTheme(<ChatPage />)

    await screen.findByText(/noch nicht eingerichtet/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Der Chat liegt auf der API, nicht auf dem Next-Origin.
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http.*\/api\/chat$/)

    await advance(POLL_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Der ruhige Hinweis ist eine Info, kein Fehler - und die Eingabe ist zu.
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-standardInfo')
    expect(screen.getByLabelText('Nachricht')).toBeDisabled()
  })

  it('versucht es nur auf Knopfdruck erneut und pollt dann wieder', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404))

    renderWithTheme(<ChatPage />)
    await screen.findByText(/noch nicht eingerichtet/i)

    fetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 1,
          message: 'Hallo Team',
          timestamp: '',
          User: { username: 'a' },
        },
      ])
    )
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    await screen.findByText('Hallo Team')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByText(/noch nicht eingerichtet/i)
    ).not.toBeInTheDocument()

    await advance(POLL_MS)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  it('stoppt das Polling, sobald der Server nicht mehr antwortet', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    renderWithTheme(<ChatPage />)
    await screen.findByText(/Noch keine Nachrichten/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await advance(POLL_MS)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await advance(POLL_MS)
    await screen.findByText(/derzeit nicht erreichbar/i)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await advance(POLL_MS * 4)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
