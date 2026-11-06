import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AuthGate } from './AuthGate'
import { AccountBar } from './AccountBar'
import { pendingUpdates, queueStopUpdate } from '../lib/delivery-api'
import {
  LAST_USER_KEY,
  currentSession,
  resetSessionCache,
  saveSession,
  type DeliverySession,
} from '../lib/session'

const answer = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

const loginAnswer = (id: number, role = 'fahrer') =>
  answer({
    success: true,
    data: {
      user: { id, username: 'fahrer.test', displayName: 'Test Fahrer', role },
      token: 'at_1',
      refreshToken: 'rt_1',
    },
  })

const session: DeliverySession = {
  token: 'at_1',
  refreshToken: 'rt_1',
  user: {
    id: 42,
    username: 'fahrer.test',
    displayName: 'Test Fahrer',
    role: 'fahrer',
  },
}

let fetchMock: jest.Mock

beforeEach(() => {
  window.localStorage.clear()
  resetSessionCache()
  fetchMock = jest.fn()
  ;(global as { fetch?: unknown }).fetch = fetchMock
})

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch
})

const fillAndSubmit = (username: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Benutzername'), {
    target: { value: username },
  })
  fireEvent.change(screen.getByLabelText('Passwort'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
}

describe('AuthGate', () => {
  it('zeigt ohne Sitzung nur das Anmeldeformular', () => {
    render(
      <AuthGate>
        <p>Geheime Tour</p>
      </AuthGate>
    )

    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeTruthy()
    expect(screen.queryByText('Geheime Tour')).toBeNull()
  })

  it('zeigt die App nach der Anmeldung', async () => {
    fetchMock.mockResolvedValue(loginAnswer(42))
    render(
      <AuthGate>
        <p>Geheime Tour</p>
      </AuthGate>
    )

    fillAndSubmit('fahrer.test', 'richtig-richtig')

    expect(await screen.findByText('Geheime Tour')).toBeTruthy()
    expect(window.localStorage.getItem(LAST_USER_KEY)).toBe('42')
  })

  it('verlangt beide Felder, ohne den Server zu fragen', () => {
    render(
      <AuthGate>
        <p>x</p>
      </AuthGate>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(screen.getByRole('alert').textContent).toMatch(
      /Benutzername und Passwort/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('zeigt die Meldung der API bei falschem Passwort', async () => {
    fetchMock.mockResolvedValue(
      answer(
        {
          error: 'invalid_credentials',
          message: 'Benutzername oder Passwort falsch.',
        },
        401
      )
    )
    render(
      <AuthGate>
        <p>x</p>
      </AuthGate>
    )

    fillAndSubmit('fahrer.test', 'falsch')

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Benutzername oder Passwort falsch.'
    )
  })

  it('ein anderer Benutzer erbt weder Warteschlange noch gewählten Fahrer', async () => {
    window.localStorage.setItem(LAST_USER_KEY, '7')
    window.localStorage.setItem('bakery-delivery-driver', '1')
    queueStopUpdate(7, 1, { status: 'done' })
    fetchMock.mockResolvedValue(loginAnswer(42))
    render(
      <AuthGate>
        <p>App</p>
      </AuthGate>
    )

    fillAndSubmit('fahrer.test', 'pw-pw-pw')

    await screen.findByText('App')
    expect(pendingUpdates()).toEqual([])
    expect(window.localStorage.getItem('bakery-delivery-driver')).toBeNull()
  })

  it('derselbe Benutzer behält seine Warteschlange', async () => {
    window.localStorage.setItem(LAST_USER_KEY, '42')
    queueStopUpdate(7, 1, { status: 'done' })
    fetchMock.mockResolvedValue(loginAnswer(42))
    render(
      <AuthGate>
        <p>App</p>
      </AuthGate>
    )

    fillAndSubmit('fahrer.test', 'pw-pw-pw')

    await screen.findByText('App')
    expect(pendingUpdates()).toHaveLength(1)
  })

  it('geht zurück zur Anmeldung, wenn die Sitzung endet', async () => {
    saveSession(session)
    render(
      <AuthGate>
        <p>App</p>
      </AuthGate>
    )
    expect(screen.getByText('App')).toBeTruthy()

    act(() => saveSession(null))

    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeTruthy()
  })
})

describe('AccountBar', () => {
  beforeEach(() => saveSession(session))

  it('zeigt Name und Rolle und meldet ab', async () => {
    fetchMock.mockResolvedValue(answer({ success: true }))
    render(<AccountBar session={session} pendingCount={0} />)

    expect(
      screen.getByRole('region', { name: 'Anmeldung' }).textContent
    ).toMatch(/Test Fahrer\s*·\s*FahrerAbmelden/)
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))

    await waitFor(() => expect(currentSession()).toBeNull())
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/logout$/)
  })

  it('fragt nach, wenn noch Änderungen in der Warteschlange liegen', async () => {
    queueStopUpdate(7, 1, { status: 'done' })
    fetchMock.mockResolvedValue(answer({ success: true }))
    render(<AccountBar session={session} pendingCount={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    expect(screen.getByRole('alert').textContent).toMatch(
      /1 Änderung ist noch nicht beim Server angekommen/
    )
    expect(currentSession()).toEqual(session)

    fireEvent.click(screen.getByRole('button', { name: 'Angemeldet bleiben' }))
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem abmelden' }))
    await waitFor(() => expect(currentSession()).toBeNull())
    expect(pendingUpdates()).toEqual([])
  })
})
