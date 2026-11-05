import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionCheckPending, {
  SESSION_CHECK_FAILURE_DELAY_MS,
} from './SessionCheckPending'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import type { SessionContextValue } from '../../lib/session'

const mockRefresh = jest.fn()
const mockReplace = jest.fn()
let mockPathname = '/admin/reports'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ refresh: mockRefresh, replace: mockReplace }),
}))

const mockFetchMe = jest.fn()
jest.mock('../../lib/authApi', () => ({
  fetchMe: () => mockFetchMe(),
}))

/** Offene Promises (fetchMe, Effekte) abarbeiten. */
const flush = () => act(() => Promise.resolve())

function renderPending(session: SessionContextValue) {
  return render(
    <WithSession value={session}>
      <SessionCheckPending />
    </WithSession>
  )
}

describe('SessionCheckPending (Ersatzseite des Proxys)', () => {
  beforeEach(() => {
    mockRefresh.mockReset()
    mockReplace.mockReset()
    mockFetchMe.mockReset().mockResolvedValue({ role: 'inhaber' })
    mockPathname = '/admin/reports'
  })

  it('erneuert mit Sitzung das Token und lädt die Seite vom Server neu', async () => {
    renderPending(fakeSession({ role: 'inhaber' }))
    expect(screen.getByRole('status')).toHaveTextContent('Seite wird geladen')
    await flush()
    expect(mockFetchMe).toHaveBeenCalledTimes(1)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('tut ohne bestätigte Sitzung nichts (der RouteGuard leitet um)', async () => {
    renderPending(fakeSession({ status: 'loading' }))
    await flush()
    expect(mockFetchMe).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('bleibt die Ersatzseite stehen: Hinweis mit „Erneut versuchen" statt Schleife', async () => {
    jest.useFakeTimers()
    try {
      renderPending(fakeSession({ role: 'inhaber' }))
      await flush()
      expect(mockRefresh).toHaveBeenCalledTimes(1)
      await act(async () => {
        jest.advanceTimersByTime(SESSION_CHECK_FAILURE_DELAY_MS)
      })
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Die Seite konnte nicht geladen werden'
      )
      expect(mockRefresh).toHaveBeenCalledTimes(1)
      jest.useRealTimers()
      await userEvent.click(
        screen.getByRole('button', { name: 'Erneut versuchen' })
      )
      await flush()
      expect(mockFetchMe).toHaveBeenCalledTimes(2)
      expect(mockRefresh).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('direkt aufgerufen: weiter zum Dashboard', () => {
    mockPathname = '/admin/sitzung-pruefen'
    renderPending(fakeSession({ role: 'inhaber' }))
    expect(mockReplace).toHaveBeenCalledWith('/admin')
  })
})

describe('SessionCheckPending im Strict Mode', () => {
  it('lädt trotz doppelt ausgeführter Effekte neu', async () => {
    mockRefresh.mockReset()
    mockFetchMe.mockReset().mockResolvedValue({ role: 'inhaber' })
    mockPathname = '/admin/reports'
    render(
      <React.StrictMode>
        <WithSession value={fakeSession({ role: 'inhaber' })}>
          <SessionCheckPending />
        </WithSession>
      </React.StrictMode>
    )
    await act(() => Promise.resolve())
    await act(() => Promise.resolve())
    expect(mockRefresh).toHaveBeenCalled()
  })
})
