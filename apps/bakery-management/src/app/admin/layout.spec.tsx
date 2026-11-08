import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from '@testing-library/react'
import AdminLayout from './layout'

let mockPathname = '/admin/reports'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

/** The nav is rendered twice (mobile + desktop drawer); use the desktop one. */
function getDesktopNav() {
  const drawers = document.querySelectorAll('.MuiDrawer-paper')
  return within(drawers[drawers.length - 1] as HTMLElement)
}

function renderLayout(pathname = '/admin/reports') {
  mockPathname = pathname
  return render(
    <AdminLayout>
      <div data-testid="test-child">Admin Content</div>
    </AdminLayout>
  )
}

describe('AdminLayout', () => {
  it('lässt position: sticky unter <main> kleben (kein overflow hidden/auto)', () => {
    // Review r1: `overflow-x: hidden` machte <main> zum Scroll-Container, der
    // nie scrollt - Speichern-Leisten und Tabellenköpfe klebten nie.
    renderLayout()
    const main = document.querySelector('main') as HTMLElement
    const style = getComputedStyle(main)
    expect(['hidden', 'auto', 'scroll']).not.toContain(style.overflowX)
    expect(['hidden', 'auto', 'scroll']).not.toContain(style.overflowY)
    expect(style.overflowX).toBe('clip')
  })

  it('Sprunglink „Zum Inhalt springen“ führt auf <main> (Review r2)', () => {
    renderLayout()
    const skip = screen.getByRole('link', { name: 'Zum Inhalt springen' })
    const main = document.querySelector('main') as HTMLElement
    expect(skip).toHaveAttribute('href', `#${main.id}`)
    expect(main.id).not.toBe('')
    expect(main).toHaveAttribute('tabindex', '-1')
    // der erste Tab-Halt der Seite
    const focusables = document.querySelectorAll('a[href], button')
    expect(focusables[0]).toBe(skip)
  })

  it('Menü-Knopf meldet, ob die Navigation offen ist (Review r2)', () => {
    renderLayout()
    const toggle = screen.getByLabelText('Navigation öffnen')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const controls = toggle.getAttribute('aria-controls') as string
    expect(document.getElementById(controls)).not.toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('druckt ohne AppBar, Seitenleiste und Platzhalter (Review r2, Kassentag)', () => {
    renderLayout()
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .join('\n')
    const hiddenInPrint = (el: Element) => {
      const cls = Array.from(el.classList).filter((c) => c.startsWith('css-'))
      return cls.some((c) =>
        new RegExp(
          `@media print\\s*\\{\\s*\\.${c}\\s*\\{[^}]*display:\\s*none`
        ).test(css)
      )
    }
    const appBar = document.querySelector('.MuiAppBar-root') as Element
    const nav = document.querySelector('nav') as Element
    const spacer = document.querySelector('main > .MuiToolbar-root') as Element
    expect(hiddenInPrint(appBar)).toBe(true)
    expect(hiddenInPrint(nav)).toBe(true)
    expect(hiddenInPrint(spacer)).toBe(true)
  })

  it('renders children and the app bar', () => {
    renderLayout()
    expect(screen.getByTestId('test-child')).toBeInTheDocument()
    expect(screen.getByText('Verwaltung')).toBeInTheDocument()
  })

  it('renders the main navigation items', () => {
    renderLayout()
    const nav = getDesktopNav()
    ;[
      'Dashboard',
      'Produkte',
      'Sammelstelle Mörsbach',
      'Verkaufspartner',
      'Kassenberichte',
      'Analysen',
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
    expect(nav.getByText('Kassenberichte').closest('a')).not.toHaveClass(
      'Mui-selected'
    )
  })

  it('marks the active item for screen readers and keeps the description as tooltip', () => {
    renderLayout('/admin/products/new')
    const nav = getDesktopNav()
    const active = nav.getByText('Produkte').closest('a')
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active).toHaveAttribute('title', 'Produktverwaltung')
    expect(nav.getByText('Dashboard').closest('a')).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('does not highlight the dashboard on sub pages', () => {
    renderLayout('/admin/reports')
    const nav = getDesktopNav()
    expect(nav.getByText('Dashboard').closest('a')).not.toHaveClass(
      'Mui-selected'
    )
    expect(nav.getByText('Kassenberichte').closest('a')).toHaveClass(
      'Mui-selected'
    )
  })

  it('lists none of the pages deleted in B12', () => {
    renderLayout()
    const nav = getDesktopNav()
    ;[
      'Bestellungen',
      'Bäckerei',
      'Lagerbestand',
      'Kasse',
      'Personal',
      'Team-Chat',
      'Benachrichtigungen',
      'Lieferung',
      'Unverkaufte Produkte',
    ].forEach((label) => {
      expect(nav.queryByText(label)).not.toBeInTheDocument()
    })
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
      'Dashboard \u203a Verkaufspartner \u203a Partner \u203a Besuch erfassen'
    )
  })

  it('does not leave a bare id in the partner breadcrumb', () => {
    renderLayout('/admin/partners/1')
    // Review r1: endet wie jede Detailseite mit der aktuellen Seite
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard \u203a Verkaufspartner \u203a Partner'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toMatch(/\b1\b/)
  })

  it('names the Dienstplan pages and drops the employee id (TASK-042)', () => {
    renderLayout('/admin/dienstplan/mitarbeiter')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Dienstplan › Mitarbeiter'
    )
    cleanup()
    renderLayout('/admin/dienstplan/mitarbeiter/12')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Dienstplan › Mitarbeiter'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toMatch(/\b12\b/)
  })

  it('renders a readable breadcrumb', () => {
    renderLayout('/admin/products/new')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Produkte › Neues Produkt'
    )
  })

  it('shows no raw product id or ISO date in the breadcrumb (W4-verify r2)', () => {
    renderLayout('/admin/products/mustercroissant')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Produkte › Bearbeiten'
    )
    cleanup()
    renderLayout('/admin/backzettel/2026-11-07')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Samstag, 07.11.2026'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toContain(
      '2026-11-07'
    )
  })

  it('names analytics sub-pages and report days in German (W4-verify r3)', () => {
    renderLayout('/admin/analytics/products')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Analysen › Produkte'
    )
    cleanup()
    renderLayout('/admin/analytics/revenue')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Analysen › Umsatz'
    )
    cleanup()
    renderLayout('/admin/reports/2026-11-05')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Kassenberichte › Donnerstag, 05.11.2026'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toContain(
      '2026-11-05'
    )
  })

  it('drops the bare /admin/delivery segment (B12: no page of its own)', () => {
    renderLayout('/admin/delivery/preorders/backliste')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Sammelstelle Mörsbach › Backliste'
    )
    expect(screen.getByLabelText('Pfad').textContent).not.toContain('delivery')
  })

  it('zeigt auf dem Dashboard keinen Pfad „Dashboard“ über der h1 (Review r1)', () => {
    renderLayout('/admin')
    expect(screen.queryByLabelText('Pfad')).toBeNull()
  })

  it('endet bei Vorbestellungen mit der aktuellen Seite (Review r1)', () => {
    renderLayout('/admin/preorders/17')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Vorbestellungen › Vorbestellung'
    )
  })

  it('gibt Sammelstelle und Rest-Auswertung eigene Symbole (Review r1)', () => {
    renderLayout('/admin')
    const nav = getDesktopNav()
    const iconOf = (label: string) =>
      nav
        .getByText(label)
        .closest('a')
        ?.querySelector('svg')
        ?.getAttribute('data-testid')
    expect(iconOf('Sammelstelle Mörsbach')).not.toBe(iconOf('Vorbestellungen'))
    expect(iconOf('Rest-Auswertung')).not.toBe(iconOf('Analysen'))
  })
})
