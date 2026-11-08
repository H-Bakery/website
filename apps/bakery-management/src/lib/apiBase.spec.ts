import {
  apiProxyTarget,
  DEFAULT_SERVER_API_URL,
  isApiPath,
  resolveBrowserApiBase,
  resolveServerApiUrl,
} from './apiBase'

describe('apiBase (F4)', () => {
  it('Browser: ohne NEXT_PUBLIC_API_URL die eigene Origin', () => {
    expect(resolveBrowserApiBase(undefined)).toBe('')
    expect(resolveBrowserApiBase('')).toBe('')
    expect(resolveBrowserApiBase('  ')).toBe('')
    expect(resolveBrowserApiBase('https://intern.baeckerei.test/')).toBe(
      'https://intern.baeckerei.test'
    )
  })

  it('Server: API_URL, sonst die lokale API', () => {
    expect(resolveServerApiUrl(undefined)).toBe(DEFAULT_SERVER_API_URL)
    expect(resolveServerApiUrl('http://127.0.0.1:5000/')).toBe(
      'http://127.0.0.1:5000'
    )
  })

  it('nur /api und /api/... gehen an die API', () => {
    expect(isApiPath('/api')).toBe(true)
    expect(isApiPath('/api/auth/me')).toBe(true)
    expect(isApiPath('/apidoc')).toBe(false)
    expect(isApiPath('/admin/api')).toBe(false)
    expect(apiProxyTarget('/admin', '', 'http://a')).toBeNull()
    expect(apiProxyTarget('/api/x', '?a=1', 'http://a/')).toBe(
      'http://a/api/x?a=1'
    )
  })
})
