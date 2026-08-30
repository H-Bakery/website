import { render, screen, fireEvent, within } from '@testing-library/react'
import AdminLayout from './layout'

let mockPathname = '/admin/orders'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

/**
 * jsdom evaluates responsive `display` rules at the smallest breakpoint, so
 * the permanent drawer itself is `display: none`. Check the submenu list's own
 * computed display instead of `toBeVisible()`.
 */
function isSubmenuShown(item: HTMLElement) {
  const list = item.closest('.MuiList-root') as HTMLElement
  return window.getComputedStyle(list).display !== 'none'
}

/** The nav is rendered twice (mobile + desktop drawer); use the desktop one. */
function getDesktopNav() {
  const drawers = document.querySelectorAll('.MuiDrawer-paper')
  return within(drawers[drawers.length - 1] as HTMLElement)
}

function renderLayout(pathname = '/admin/orders') {
  mockPathname = pathname
  return render(
    <AdminLayout>
      <div data-testid="test-child">Admin Content</div>
    </AdminLayout>
  )
}

describe('AdminLayout', () => {
  it('renders children and the app bar', () => {
    renderLayout()
    expect(screen.getByTestId('test-child')).toBeInTheDocument()
    expect(screen.getByText('Management System')).toBeInTheDocument()
  })

  it('renders the main navigation items', () => {
    renderLayout()
    const nav = getDesktopNav()
    ;[
      'Dashboard',
      'Bestellungen',
      'Bäckerei',
      'Produkte',
      'Kasse',
      'Personal',
      'Berichte',
      'Analysen',
      'Team-Chat',
      'Einstellungen',
    ].forEach((label) => {
      expect(nav.getByText(label)).toBeInTheDocument()
    })
  })

  it('links to the shop app in a new tab', () => {
    renderLayout()
    const link = getDesktopNav().getByText('Shop').closest('a')
    expect(link).toHaveAttribute('href', 'http://localhost:4200')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('highlights the active item, including nested routes', () => {
    renderLayout('/admin/products/new')
    const nav = getDesktopNav()
    expect(nav.getByText('Produkte').closest('a')).toHaveClass('Mui-selected')
    expect(nav.getByText('Bestellungen').closest('a')).not.toHaveClass(
      'Mui-selected'
    )
  })

  it('does not highlight the dashboard on sub pages', () => {
    renderLayout('/admin/orders')
    const nav = getDesktopNav()
    expect(nav.getByText('Dashboard').closest('a')).not.toHaveClass(
      'Mui-selected'
    )
    expect(nav.getByText('Bestellungen').closest('a')).toHaveClass(
      'Mui-selected'
    )
  })

  it('toggles the Bäckerei submenu', () => {
    renderLayout('/admin/orders')
    const nav = getDesktopNav()
    const toggle = nav
      .getByText('Bäckerei')
      .closest('[role="button"]') as HTMLElement
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(isSubmenuShown(nav.getByText('Rezepte'))).toBe(false)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(isSubmenuShown(nav.getByText('Rezepte'))).toBe(true)

    fireEvent.click(toggle)
    expect(isSubmenuShown(nav.getByText('Rezepte'))).toBe(false)
  })

  it('opens the submenu automatically when a child route is active', () => {
    renderLayout('/admin/bakery/recipes')
    const nav = getDesktopNav()
    expect(isSubmenuShown(nav.getByText('Rezepte'))).toBe(true)
    expect(nav.getByText('Rezepte').closest('a')).toHaveClass('Mui-selected')
  })

  it('opens the mobile drawer via the menu button', () => {
    renderLayout()
    const modal = document.querySelector('.MuiDrawer-modal') as HTMLElement
    expect(modal).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(screen.getByLabelText('Navigation öffnen'))
    expect(modal).not.toHaveAttribute('aria-hidden')
  })

  it('names the partner sub-pages in the breadcrumb and drops the id', () => {
    renderLayout('/admin/partners/1/visit/new')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard \u203a Verkaufspartner \u203a Besuch erfassen'
    )
  })

  it('does not leave a bare id in the partner breadcrumb', () => {
    renderLayout('/admin/partners/1')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard \u203a Verkaufspartner'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toMatch(/\b1\b/)
  })

  it('renders a readable breadcrumb', () => {
    renderLayout('/admin/products/new')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Produkte › new'
    )
  })
})
