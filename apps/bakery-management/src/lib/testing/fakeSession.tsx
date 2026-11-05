import React from 'react'
import { SessionContextProvider, type SessionContextValue } from '../session'
import type { PilotRole } from '../roles'

/** Fester Sitzungswert für Seiten-Specs (kein localStorage, keine API). */
export function fakeSession(
  overrides: Partial<SessionContextValue> & { role?: PilotRole } = {}
): SessionContextValue {
  const { role, ...rest } = overrides
  const user =
    rest.user !== undefined
      ? rest.user
      : role
      ? {
          id: 1,
          username: `test.${role}`,
          displayName: `Test ${role}`,
          role,
        }
      : null
  const status = rest.status ?? (user ? 'authenticated' : 'anonymous')
  return {
    status,
    user,
    sessionKind: user ? 'personal' : null,
    isAuthenticated: status === 'authenticated' && user !== null,
    isLoading: status === 'loading',
    endReason: null,
    clearEndReason: jest.fn(),
    login: jest.fn(),
    pinLogin: jest.fn(),
    logout: jest.fn(async () => '/admin/login'),
    ...rest,
  }
}

export function WithSession({
  value,
  children,
}: {
  value: SessionContextValue
  children: React.ReactNode
}) {
  return (
    <SessionContextProvider value={value}>{children}</SessionContextProvider>
  )
}
