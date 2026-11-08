import { render, screen, within } from '@testing-library/react'
import AdminLayout from './layout'

let mockPathname = '/admin'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

/** The nav is rendered twice (mobile + desktop drawer); use the desktop one. */
function getDesktopNav() {
  const drawers = document.querySelectorAll('.MuiDrawer-paper')
  return within(drawers[drawers.length - 1] as HTMLElement)
}

function renderLayout(pathname: string) {
  mockPathname = pathname
  return render(
    <AdminLayout>
      <div data-testid="page-content">Seiteninhalt</div>
    </AdminLayout>
  )
}

describe('AdminLayout im Pilotbetrieb (NEXT_PUBLIC_PILOT_MODE=1)', () => {
  const original = process.env.NEXT_PUBLIC_PILOT_MODE
  beforeEach(() => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
  })
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PILOT_MODE
    else process.env.NEXT_PUBLIC_PILOT_MODE = original
  })

  it('zeigt nur die Pilot-Seiten in der Navigation', () => {
    renderLayout('/admin')
    const nav = getDesktopNav()
    ;[
      'Dashboard',
      'Produkte',
      'Sammelstelle Mörsbach',
      'Verkaufspartner',
      'Kassenberichte',
      'Analysen',
      'Finanzen',
      'Tagesziel',
      'Social Media',
      'Einstellungen',
      'Anmeldung',
      'Hilfe',
      'Dienstplan', // TASK-042, für den Inhaber freigegeben (2026-11-08)
      'Rest am Abend', // M4, im Pilot freigegeben (2026-11-08)
      'Rest-Auswertung',
    ].forEach((label) => expect(nav.getByText(label)).toBeInTheDocument())
    ;[
      'Bestellungen',
      'Bäckerei',
      'Backliste',
      'Lagerbestand',
      'Unverkaufte Produkte',
      'Lieferung',
      'Kasse',
      'Personal',
      'Benachrichtigungen',
      'Team-Chat',
      'Shop',
    ].forEach((label) => expect(nav.queryByText(label)).not.toBeInTheDocument())
  })

  it('kennzeichnet den Pilotbetrieb in der Kopfzeile', () => {
    renderLayout('/admin')
    expect(screen.getByText('Pilotbetrieb')).toBeInTheDocument()
    expect(screen.queryByText('Entwicklung')).not.toBeInTheDocument()
  })

  it.each(['/admin/sitzung-pruefen', '/admin/cash'])(
    'sperrt %s mit einem deutschen Hinweis',
    (route) => {
      renderLayout(route)
      expect(screen.queryByTestId('page-content')).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Im Pilotbetrieb nicht verfügbar' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Zum Dashboard' })
      ).toHaveAttribute('href', '/admin')
    }
  )

  it.each([
    '/admin',
    '/admin/products/new',
    '/admin/delivery/preorders/backliste',
    '/admin/finance/tagesziel',
    '/admin/partners/1',
    '/admin/dienstplan',
    '/admin/dienstplan/mitarbeiter/3',
    '/admin/rest',
    '/admin/rest/auswertung',
  ])('zeigt die erlaubte Seite %s', (route) => {
    renderLayout(route)
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
    expect(
      screen.queryByText('Im Pilotbetrieb nicht verfügbar')
    ).not.toBeInTheDocument()
  })
})

describe('AdminLayout ohne Pilotbetrieb', () => {
  const original = process.env.NEXT_PUBLIC_PILOT_MODE
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_PILOT_MODE
  })
  afterEach(() => {
    if (original !== undefined) process.env.NEXT_PUBLIC_PILOT_MODE = original
  })

  it('sperrt nichts und zeigt alle Einträge', () => {
    renderLayout('/admin/rest')
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
    expect(getDesktopNav().getByText('Rest am Abend')).toBeInTheDocument()
    expect(screen.queryByText('Pilotbetrieb')).not.toBeInTheDocument()
  })
})
