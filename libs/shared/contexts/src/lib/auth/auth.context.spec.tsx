/**
 * @fileoverview Tests for the shared auth context.
 *
 * The provider talks to `authService` and `apiClient` from
 * `@bakery/shared/data-access`; both are mocked here. Token storage belongs
 * to the `ApiClient` - the provider only asks `apiClient.isAuthenticated()`.
 * (The management app has its own session in `src/lib/session.tsx`; this
 * provider is still used by the shop through `RootProvider`.)
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { User, UserRole } from '@bakery/shared/types'
import {
  AuthProvider,
  AuthProviderProps,
  useAuth,
  useCurrentUser,
  useIsAuthenticated,
  useRequireAuth,
  useRequirePermission,
  useRequireRole,
} from './auth.context'

// jest.mock is hoisted above the imports: the factory must not reference
// constants of this file, so the mocks are read back with requireMock.
jest.mock('@bakery/shared/data-access', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    getCurrentUser: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  },
  apiClient: {
    isAuthenticated: jest.fn(),
    clearTokens: jest.fn(),
  },
}))

const dataAccess = jest.requireMock('@bakery/shared/data-access')
const authService = dataAccess.authService as Record<string, jest.Mock>
const apiClient = dataAccess.apiClient as Record<string, jest.Mock>

// Synthetic users
const customer: User = {
  id: 1,
  email: 'kundin@example.test',
  firstName: 'Erika',
  lastName: 'Muster',
  role: UserRole.Customer,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const admin: User = {
  ...customer,
  id: 2,
  email: 'admin@example.test',
  role: UserRole.Admin,
}

/** Whether the mocked ApiClient currently holds tokens. */
let tokensPresent = false

function wrapperWith(props: Partial<AuthProviderProps> = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider refreshInterval={0} {...props}>
        {children}
      </AuthProvider>
    )
  }
}

async function renderAuth(props: Partial<AuthProviderProps> = {}) {
  const hook = renderHook(() => useAuth(), { wrapper: wrapperWith(props) })
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

/** Renders the provider with a stored session for `user`. */
async function renderSignedIn(
  user: User,
  props: Partial<AuthProviderProps> = {}
) {
  tokensPresent = true
  authService.getCurrentUser.mockResolvedValue({ success: true, data: user })
  const hook = await renderAuth(props)
  await waitFor(() => expect(hook.result.current.user).toEqual(user))
  return hook
}

describe('AuthContext', () => {
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    tokensPresent = false
    apiClient.isAuthenticated.mockImplementation(() => tokensPresent)
    apiClient.clearTokens.mockImplementation(() => {
      tokensPresent = false
    })
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  describe('initialisation', () => {
    it('starts signed out without stored tokens and asks no server', async () => {
      const { result } = await renderAuth()

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.permissions.size).toBe(0)
      expect(authService.getCurrentUser).not.toHaveBeenCalled()
    })

    it('loads the current user when the ApiClient holds tokens', async () => {
      const { result } = await renderSignedIn(customer)

      expect(result.current.isAuthenticated).toBe(true)
      expect(authService.getCurrentUser).toHaveBeenCalled()
    })

    it('is loading until the current user is known', async () => {
      tokensPresent = true
      let resolveUser: (value: unknown) => void = () => undefined
      authService.getCurrentUser.mockReturnValue(
        new Promise((resolve) => {
          resolveUser = resolve
        })
      )
      const { result } = renderHook(() => useAuth(), {
        wrapper: wrapperWith(),
      })

      expect(result.current.isLoading).toBe(true)
      await act(async () => {
        resolveUser({ success: true, data: customer })
      })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.user).toEqual(customer)
    })

    it('clears invalid tokens when loading the user fails', async () => {
      tokensPresent = true
      authService.getCurrentUser.mockRejectedValue(new Error('401'))

      const { result } = await renderAuth()

      expect(apiClient.clearTokens).toHaveBeenCalled()
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('does not check the session with checkAuthOnMount={false}', async () => {
      tokensPresent = true
      const { result } = await renderAuth({ checkAuthOnMount: false })

      expect(authService.getCurrentUser).not.toHaveBeenCalled()
      expect(result.current.user).toBeNull()
    })

    it('reports state changes to onAuthStateChange', async () => {
      const onAuthStateChange = jest.fn()
      await renderSignedIn(customer, { onAuthStateChange })

      expect(onAuthStateChange).toHaveBeenCalledWith(false, null)
      expect(onAuthStateChange).toHaveBeenLastCalledWith(true, customer)
    })
  })

  describe('login and registration', () => {
    it('signs in with the credentials and keeps the returned user', async () => {
      const credentials = { username: 'erika', password: 'geheim' }
      authService.login.mockImplementation(async () => {
        tokensPresent = true
        return { success: true, data: { user: customer, token: 't' } }
      })
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: customer,
      })
      const { result } = await renderAuth()

      await act(async () => {
        await result.current.login(credentials)
      })

      expect(authService.login).toHaveBeenCalledWith(credentials)
      expect(result.current.user).toEqual(customer)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('stores the error message and rethrows when login fails', async () => {
      authService.login.mockRejectedValue(new Error('Ungültige Anmeldedaten'))
      const { result } = await renderAuth()

      let thrown: unknown
      await act(async () => {
        await result.current
          .login({ username: 'erika', password: 'falsch' })
          .catch((error) => {
            thrown = error
          })
      })

      expect((thrown as Error).message).toBe('Ungültige Anmeldedaten')
      expect(result.current.error).toBe('Ungültige Anmeldedaten')
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('falls back to a generic message for errors without one', async () => {
      authService.login.mockRejectedValue({})
      const { result } = await renderAuth()

      await act(async () => {
        await result.current
          .login({ username: 'erika', password: 'falsch' })
          .catch(() => undefined)
      })

      expect(result.current.error).toBe('Login failed. Please try again.')
    })

    it('clearError resets the error', async () => {
      authService.login.mockRejectedValue(new Error('Fehler'))
      const { result } = await renderAuth()
      await act(async () => {
        await result.current
          .login({ username: 'x', password: 'y' })
          .catch(() => undefined)
      })
      expect(result.current.error).toBe('Fehler')

      act(() => result.current.clearError())

      expect(result.current.error).toBeNull()
    })

    it('registers and keeps the returned user', async () => {
      const data = {
        username: 'erika',
        email: 'kundin@example.test',
        password: 'geheim',
        confirmPassword: 'geheim',
        name: 'Erika Muster',
      }
      authService.register.mockImplementation(async () => {
        tokensPresent = true
        return { success: true, data: { user: customer, token: 't' } }
      })
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: customer,
      })
      const { result } = await renderAuth()

      await act(async () => {
        await result.current.register(data)
      })

      expect(authService.register).toHaveBeenCalledWith(data)
      expect(result.current.user).toEqual(customer)
    })

    it('stores the error and rethrows when registration fails', async () => {
      authService.register.mockRejectedValue({})
      const { result } = await renderAuth()

      let failed = false
      await act(async () => {
        await result.current
          .register({
            username: 'x',
            email: 'x@example.test',
            password: 'a',
            confirmPassword: 'a',
            name: 'X',
          })
          .catch(() => {
            failed = true
          })
      })

      expect(failed).toBe(true)
      expect(result.current.error).toBe(
        'Registration failed. Please try again.'
      )
    })
  })

  describe('logout', () => {
    it('calls the server and forgets the user', async () => {
      // Like the real service: a successful logout drops the tokens.
      authService.logout.mockImplementation(async () => {
        tokensPresent = false
        return { success: true }
      })
      const { result } = await renderSignedIn(customer)

      await act(async () => {
        await result.current.logout()
      })

      expect(authService.logout).toHaveBeenCalled()
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('logs a failing server call instead of surfacing it', async () => {
      const failure = new Error('offline')
      authService.logout.mockRejectedValue(failure)
      const { result } = await renderSignedIn(customer)

      await act(async () => {
        await result.current.logout()
      })

      expect(consoleError).toHaveBeenCalledWith('Logout error:', failure)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('session refresh', () => {
    it('refreshAuth reloads the current user', async () => {
      const { result } = await renderSignedIn(customer)
      const renamed = { ...customer, firstName: 'Erika-Marie' }
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: renamed,
      })

      await act(async () => {
        await result.current.refreshAuth()
      })

      expect(result.current.user).toEqual(renamed)
    })

    it('refreshAuth stores the error and rethrows', async () => {
      const { result } = await renderSignedIn(customer)
      authService.getCurrentUser.mockRejectedValue({})

      let failed = false
      await act(async () => {
        await result.current.refreshAuth().catch(() => {
          failed = true
        })
      })

      expect(failed).toBe(true)
      expect(result.current.error).toBe('Failed to refresh authentication.')
    })

    it('refreshes the token with the stored refresh token after the interval', async () => {
      window.localStorage.setItem('refreshToken', 'synthetic-refresh-token')
      authService.refreshToken.mockResolvedValue({ success: true })

      await renderSignedIn(customer, { refreshInterval: 30 })

      await waitFor(() =>
        expect(authService.refreshToken).toHaveBeenCalledWith(
          'synthetic-refresh-token'
        )
      )
    })

    it('logs out when the scheduled refresh fails', async () => {
      authService.refreshToken.mockRejectedValue(new Error('expired'))
      authService.logout.mockImplementation(async () => {
        tokensPresent = false
        return { success: true }
      })

      tokensPresent = true
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: customer,
      })
      const { result } = renderHook(() => useAuth(), {
        wrapper: wrapperWith({ refreshInterval: 30 }),
      })

      await waitFor(() => expect(authService.logout).toHaveBeenCalled())
      expect(authService.getCurrentUser).toHaveBeenCalled()
      expect(authService.refreshToken).toHaveBeenCalledWith('')
      await waitFor(() => expect(result.current.user).toBeNull())
    })

    it('schedules no refresh with refreshInterval 0', async () => {
      await renderSignedIn(customer, { refreshInterval: 0 })
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(authService.refreshToken).not.toHaveBeenCalled()
    })
  })

  describe('account actions', () => {
    it('changePassword passes current and new password', async () => {
      authService.changePassword.mockResolvedValue({ success: true })
      const { result } = await renderSignedIn(customer)

      await act(async () => {
        await result.current.changePassword({
          currentPassword: 'alt',
          newPassword: 'neu',
          confirmPassword: 'neu',
        })
      })

      expect(authService.changePassword).toHaveBeenCalledWith('alt', 'neu')
      expect(result.current.error).toBeNull()
    })

    it('changePassword stores the error and rethrows', async () => {
      authService.changePassword.mockRejectedValue(
        new Error('Falsches Passwort')
      )
      const { result } = await renderSignedIn(customer)

      let failed = false
      await act(async () => {
        await result.current
          .changePassword({
            currentPassword: 'x',
            newPassword: 'y',
            confirmPassword: 'y',
          })
          .catch(() => {
            failed = true
          })
      })

      expect(failed).toBe(true)
      expect(result.current.error).toBe('Falsches Passwort')
    })

    it('requestPasswordReset and resetPassword call the service', async () => {
      authService.requestPasswordReset.mockResolvedValue({ success: true })
      authService.resetPassword.mockResolvedValue({ success: true })
      const { result } = await renderAuth()

      await act(async () => {
        await result.current.requestPasswordReset('kundin@example.test')
        await result.current.resetPassword('synthetic-reset-token', 'neu')
      })

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'kundin@example.test'
      )
      expect(authService.resetPassword).toHaveBeenCalledWith(
        'synthetic-reset-token',
        'neu'
      )
    })

    it('password reset errors fall back to generic messages', async () => {
      authService.requestPasswordReset.mockRejectedValue({})
      authService.resetPassword.mockRejectedValue({})
      const { result } = await renderAuth()

      await act(async () => {
        await result.current
          .requestPasswordReset('kundin@example.test')
          .catch(() => undefined)
      })
      expect(result.current.error).toBe('Failed to request password reset.')

      await act(async () => {
        await result.current
          .resetPassword('synthetic-reset-token', 'neu')
          .catch(() => undefined)
      })
      expect(result.current.error).toBe('Failed to reset password.')
    })

    it('updateProfile keeps the user returned by the server', async () => {
      const updated = { ...customer, phoneNumber: '+49 000 000000' }
      authService.updateProfile.mockResolvedValue({
        success: true,
        data: updated,
      })
      const { result } = await renderSignedIn(customer)

      await act(async () => {
        await result.current.updateProfile({ phoneNumber: '+49 000 000000' })
      })

      expect(authService.updateProfile).toHaveBeenCalledWith({
        phoneNumber: '+49 000 000000',
      })
      expect(result.current.user).toEqual(updated)
    })

    it('updateProfile stores the error and keeps the user', async () => {
      authService.updateProfile.mockRejectedValue({})
      const { result } = await renderSignedIn(customer)

      await act(async () => {
        await result.current
          .updateProfile({ firstName: 'X' })
          .catch(() => undefined)
      })

      expect(result.current.error).toBe('Failed to update profile.')
      expect(result.current.user).toEqual(customer)
    })
  })

  describe('roles and permissions', () => {
    it('grants the default customer permissions', async () => {
      const { result } = await renderSignedIn(customer)

      expect(result.current.hasPermission('products.read')).toBe(true)
      expect(result.current.hasPermission('orders.read')).toBe(true)
      expect(result.current.hasPermission('orders.write')).toBe(false)
      expect(result.current.hasPermission('users.delete')).toBe(false)
      expect(result.current.hasRole(UserRole.Customer)).toBe(true)
      expect(result.current.hasRole(UserRole.Admin)).toBe(false)
    })

    it('grants the default admin permissions', async () => {
      const { result } = await renderSignedIn(admin)

      expect(result.current.hasPermission('users.delete')).toBe(true)
      expect(result.current.hasPermission('settings.write')).toBe(true)
      expect(result.current.hasRole(UserRole.Manager, UserRole.Admin)).toBe(
        true
      )
    })

    it('uses a custom permission mapping', async () => {
      const permissionMapping = {
        admin: [],
        manager: [],
        staff: [],
        customer: ['shop.checkout'],
      } as Record<UserRole, string[]>
      const { result } = await renderSignedIn(customer, { permissionMapping })

      expect(result.current.hasPermission('shop.checkout')).toBe(true)
      expect(result.current.hasPermission('products.read')).toBe(false)
    })

    it('has no role and no permission when signed out', async () => {
      const { result } = await renderAuth()

      expect(result.current.hasRole(UserRole.Customer)).toBe(false)
      expect(result.current.hasPermission('products.read')).toBe(false)
    })
  })

  describe('hooks', () => {
    it('useAuth throws outside the provider', () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider'
      )
    })

    it('useCurrentUser and useIsAuthenticated read the context', async () => {
      tokensPresent = true
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: customer,
      })
      const { result } = renderHook(
        () => ({ user: useCurrentUser(), signedIn: useIsAuthenticated() }),
        { wrapper: wrapperWith() }
      )

      await waitFor(() => expect(result.current.user).toEqual(customer))
      expect(result.current.signedIn).toBe(true)
    })

    it('useRequireAuth throws once loading finished without a session', async () => {
      // The hook throws during render; the error must surface from renderHook.
      const { result } = renderHook(
        () => {
          try {
            useRequireAuth()
            return 'ok'
          } catch (error) {
            return (error as Error).message
          }
        },
        { wrapper: wrapperWith() }
      )

      await waitFor(() =>
        expect(result.current).toBe('Authentication required')
      )
    })

    it('useRequirePermission and useRequireRole check the signed-in user', async () => {
      tokensPresent = true
      authService.getCurrentUser.mockResolvedValue({
        success: true,
        data: customer,
      })
      const attempt = (fn: () => unknown) => {
        try {
          fn()
          return 'ok'
        } catch (error) {
          return (error as Error).message
        }
      }
      const { result } = renderHook(
        () => ({
          auth: useAuth(),
          readProducts: attempt(() => useRequirePermission('products.read')),
          deleteUsers: attempt(() => useRequirePermission('users.delete')),
          customerRole: attempt(() => useRequireRole(UserRole.Customer)),
          adminRole: attempt(() =>
            useRequireRole(UserRole.Admin, UserRole.Manager)
          ),
        }),
        { wrapper: wrapperWith() }
      )

      await waitFor(() => expect(result.current.auth.user).toEqual(customer))
      expect(result.current.readProducts).toBe('ok')
      expect(result.current.deleteUsers).toBe('Permission denied: users.delete')
      expect(result.current.customerRole).toBe('ok')
      expect(result.current.adminRole).toBe('Role required: admin or manager')
    })
  })
})
