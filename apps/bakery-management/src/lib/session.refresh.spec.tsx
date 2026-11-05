/**
 * Ende-zu-Ende im Browser-Teil: eine Seite fragt mit abgelaufenem
 * Access-Token, die API antwortet 401, der `apiClient` erneuert über
 * `/api/auth/refresh` genau einmal und wiederholt die Anfrage. Scheitert
 * der Refresh, ist die Sitzung vorbei (der RouteGuard leitet dann um).
 * Echter `ApiClient`, echtes `authApi`, nur `fetch` ist nachgebaut.
 */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { apiClient } from '@bakery/shared/data-access'
import { SessionProvider, useSession } from './session'
import { loadSession, saveSession } from './authSession'
import { useMemoryStorage } from './testing/memoryStorage'

const USER = {
  id: 1,
  username: 'test.inhaber',
  displayName: 'Test Inhaber',
  role: 'inhaber',
}

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function Probe() {
  const { status } = useSession()
  return <span data-testid="status">{status}</span>
}

describe('401 → ein Refresh → Wiederholung', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    ;(global as unknown as { fetch: unknown }).fetch = fetchMock
    useMemoryStorage()
    apiClient.clearAuthToken()
    saveSession({
      token: 'acc-abgelaufen',
      refreshToken: 'rt_1',
      user: {
        id: 1,
        username: 'test.inhaber',
        displayName: 'Test Inhaber',
        role: 'inhaber',
      },
      sessionKind: 'personal',
      startedAt: Date.now(),
    })
  })

  function authHeader(call: number) {
    return fetchMock.mock.calls[call][1].headers['Authorization']
  }

  it('erneuert und wiederholt /me mit dem neuen Token', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { error: 'unauthorized', message: 'Sitzung abgelaufen.' })
      )
      .mockResolvedValueOnce(
        json(200, {
          success: true,
          data: {
            user: USER,
            token: 'acc-neu',
            refreshToken: 'rt_2',
            expiresIn: 3600,
            sessionKind: 'personal',
          },
        })
      )
      .mockResolvedValueOnce(json(200, { success: true, data: USER }))

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    )
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/\/api\/auth\/me$/),
      expect.stringMatching(/\/api\/auth\/refresh$/),
      expect.stringMatching(/\/api\/auth\/me$/),
    ])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      refreshToken: 'rt_1',
    })
    expect(authHeader(0)).toBe('Bearer acc-abgelaufen')
    expect(authHeader(2)).toBe('Bearer acc-neu')
    expect(loadSession()).toMatchObject({
      token: 'acc-neu',
      refreshToken: 'rt_2',
    })
  })

  it('scheitert der Refresh, ist die Sitzung vorbei', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { error: 'unauthorized', message: 'Sitzung abgelaufen.' })
      )
      .mockResolvedValueOnce(
        json(401, { error: 'unauthorized', message: 'Sitzung abgelaufen.' })
      )
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    )
    // /me, /refresh - kein zweiter Refresh, keine Schleife
    await act(async () => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(loadSession()).toBeNull()
  })
})
