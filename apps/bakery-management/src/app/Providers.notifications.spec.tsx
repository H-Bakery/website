import React from 'react'
import { render } from '@testing-library/react'
import { SessionNotifications } from './Providers'
import { fakeSession, WithSession } from '../lib/testing/fakeSession'

// Welche Props der NotificationProvider bekommt - das Laden selbst prüft
// libs/shared/contexts (notification.loadOnMount.spec.tsx).
const mockProviderProps = jest.fn()
jest.mock('@bakery/shared/contexts', () => ({
  ...jest.requireActual('@bakery/shared/contexts'),
  NotificationProvider: (props: Record<string, unknown>) => {
    mockProviderProps(props)
    return <>{props.children as React.ReactNode}</>
  },
}))

function lastProps() {
  const calls = mockProviderProps.mock.calls
  return calls[calls.length - 1][0]
}

describe('SessionNotifications (Abschluss-Verifikation next)', () => {
  beforeEach(() => mockProviderProps.mockClear())

  it('ohne Sitzung: kein Laden, kein Polling (sonst 401 + console.error)', () => {
    render(
      <WithSession value={fakeSession({ status: 'anonymous' })}>
        <SessionNotifications pilot={false}>x</SessionNotifications>
      </WithSession>
    )
    expect(lastProps()).toMatchObject({
      loadOnMount: false,
      pollingInterval: 0,
      requestPermissionOnMount: false,
    })
  })

  it('während die Sitzung lädt, ebenfalls nicht', () => {
    render(
      <WithSession value={fakeSession({ status: 'loading' })}>
        <SessionNotifications pilot={false}>x</SessionNotifications>
      </WithSession>
    )
    expect(lastProps()).toMatchObject({
      loadOnMount: false,
      pollingInterval: 0,
    })
  })

  it('mit Sitzung außerhalb des Pilotbetriebs: laden, nie ungefragt nach Mitteilungen fragen', () => {
    render(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        <SessionNotifications pilot={false}>x</SessionNotifications>
      </WithSession>
    )
    expect(lastProps()).toMatchObject({
      loadOnMount: true,
      pollingInterval: undefined,
      requestPermissionOnMount: false,
    })
  })

  it('im Pilotbetrieb auch mit Sitzung nicht', () => {
    render(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        <SessionNotifications pilot>x</SessionNotifications>
      </WithSession>
    )
    expect(lastProps()).toMatchObject({
      loadOnMount: false,
      pollingInterval: 0,
    })
  })
})
