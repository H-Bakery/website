import { isSafeInternalPath } from './safePath'
import { resolvePostLoginPath } from './roles'
import { safeNextPath } from './authSession'

describe('isSafeInternalPath (W4-verify r2: ?next= open redirect)', () => {
  it.each([
    '/admin',
    '/admin/preorders/abholliste?date=2026-11-07&point=laden',
    '/backstube',
    '/admin/backzettel/2026-11-07#hefeteig',
  ])('accepts %s', (path) => {
    expect(isSafeInternalPath(path)).toBe(true)
  })

  it.each([
    '/admin/..//127.0.0.1:59991/phish',
    '/admin/../\\example.com',
    '/admin/%2e%2e//example.com',
    '/admin/%2E%2E/x',
    '//example.com',
    '/admin//example.com',
    '/admin/./x',
    'https://example.com/admin',
    '/admin/\u0000x',
    '',
  ])('rejects %s', (path) => {
    expect(isSafeInternalPath(path)).toBe(false)
  })

  it('login falls back to the role start page', () => {
    expect(
      resolvePostLoginPath('inhaber', '/admin/..//127.0.0.1:59991/phish')
    ).toBe('/admin')
    expect(resolvePostLoginPath('inhaber', '/admin/%2e%2e//example.com')).toBe(
      '/admin'
    )
    expect(
      resolvePostLoginPath(
        'fahrer',
        '/admin/preorders/abholliste?date=2026-11-07&point=laden'
      )
    ).toBe('/admin/preorders/abholliste?date=2026-11-07&point=laden')
    expect(safeNextPath('/admin/../\\example.com')).toBe('/admin')
  })
})
