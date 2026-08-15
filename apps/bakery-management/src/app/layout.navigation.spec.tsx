import { MANAGEMENT_NAVIGATION, isNavItemActive } from './admin/navigation'

describe('management navigation model', () => {
  const flat = MANAGEMENT_NAVIGATION.flatMap((item) => [
    item,
    ...(item.submenu ?? []),
  ])
  const internal = flat.filter((item) => item.href && !item.external)

  it('has unique hrefs', () => {
    const hrefs = flat.map((item) => item.href).filter(Boolean)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('keeps all internal routes under /admin', () => {
    internal.forEach((item) => {
      expect(item.href).toMatch(/^\/admin(\/|$)/)
    })
  })

  it('links the shop to the shop app, not the management app', () => {
    const shop = flat.find((item) => item.external)
    expect(shop).toBeDefined()
    expect(shop?.href).toBe('http://localhost:4200')
  })

  it('exposes the main sections', () => {
    const labels = MANAGEMENT_NAVIGATION.map((item) => item.label)
    expect(labels).toEqual(
      expect.arrayContaining([
        'Dashboard',
        'Bestellungen',
        'Bäckerei',
        'Produkte',
        'Berichte',
        'Analysen',
        'Team-Chat',
        'Einstellungen',
      ])
    )
  })

  it('has German labels and descriptions everywhere', () => {
    flat.forEach((item) => {
      expect(item.label).toBeTruthy()
      expect(item.description).toBeTruthy()
    })
  })
})

describe('isNavItemActive', () => {
  it('matches the dashboard only exactly', () => {
    expect(isNavItemActive('/admin', '/admin')).toBe(true)
    expect(isNavItemActive('/admin/orders', '/admin')).toBe(false)
  })

  it('matches nested routes for other items', () => {
    expect(isNavItemActive('/admin/products', '/admin/products')).toBe(true)
    expect(isNavItemActive('/admin/products/new', '/admin/products')).toBe(true)
    expect(isNavItemActive('/admin/products/abc', '/admin/products')).toBe(true)
  })

  it('does not match sibling routes with a common prefix', () => {
    expect(isNavItemActive('/admin/products-archive', '/admin/products')).toBe(
      false
    )
    expect(isNavItemActive('/admin/orders', '/admin/products')).toBe(false)
  })

  it('handles missing hrefs', () => {
    expect(isNavItemActive('/admin', undefined)).toBe(false)
  })
})
