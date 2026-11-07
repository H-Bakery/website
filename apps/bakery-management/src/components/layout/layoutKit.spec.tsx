import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import {
  DayNavigator,
  EmptyState,
  HEADER_TITLE_MIN_WIDTH,
  ErrorState,
  KeyFigures,
  LoadingState,
  PAGE_MAX_WIDTH,
  PageLayout,
  PageSection,
  ResponsiveList,
  shiftIsoDate,
  pageDocumentTitle,
  type ResponsiveColumn,
} from './index'

describe('PageLayout', () => {
  it('hat genau eine h1, Untertitel, Rücklink, Status und Aktionen', () => {
    renderWithTheme(
      <PageLayout
        title="Benutzer"
        subtitle="Konten und PINs"
        back={{ href: '/admin', label: 'Zum Dashboard' }}
        status={<span>Freigegeben</span>}
        actions={<button type="button">Neuer Benutzer</button>}
      >
        <p>Inhalt</p>
      </PageLayout>
    )
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Benutzer')
    expect(screen.getByText('Konten und PINs')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toHaveAttribute(
      'href',
      '/admin'
    )
    expect(screen.getByTestId('page-status')).toHaveTextContent('Freigegeben')
    expect(
      within(screen.getByTestId('page-actions')).getByRole('button', {
        name: 'Neuer Benutzer',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })

  it('setzt die Breite je Seitentyp (Standard: default)', () => {
    const { container, rerender } = renderWithTheme(
      <PageLayout title="A">x</PageLayout>
    )
    expect(container.querySelector('[data-page-width]')).toHaveAttribute(
      'data-page-width',
      'default'
    )
    rerender(
      <PageLayout title="A" width="narrow">
        x
      </PageLayout>
    )
    expect(container.querySelector('[data-page-width]')).toHaveAttribute(
      'data-page-width',
      'narrow'
    )
    expect(PAGE_MAX_WIDTH.narrow).toBeLessThan(PAGE_MAX_WIDTH.default as number)
    expect(PAGE_MAX_WIDTH.full).toBe('none')
  })

  it('lässt ohne Aktionen/Status/Untertitel nichts Leeres stehen', () => {
    renderWithTheme(<PageLayout title="Hilfe" />)
    expect(screen.queryByTestId('page-actions')).toBeNull()
    expect(screen.queryByTestId('page-status')).toBeNull()
  })
})

describe('PageSection', () => {
  it('ist eine benannte Region mit h2', () => {
    renderWithTheme(
      <PageSection title="Konten" description="Nie gelöscht.">
        Tabelle
      </PageSection>
    )
    const region = screen.getByRole('region', { name: 'Konten' })
    expect(
      within(region).getByRole('heading', { level: 2, name: 'Konten' })
    ).toBeInTheDocument()
    expect(within(region).getByText('Nie gelöscht.')).toBeInTheDocument()
  })

  it('level 3 für Unterabschnitte', () => {
    renderWithTheme(<PageSection title="Brot" level={3} />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Brot' })
    ).toBeInTheDocument()
  })

  it('klappt Details erst auf Tipp auf', () => {
    renderWithTheme(
      <PageSection title="Kostenbasis" details="Annahmen: …">
        40 %
      </PageSection>
    )
    const toggle = screen.getByRole('button', { name: 'Details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Annahmen: …')).not.toBeVisible()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Annahmen: …')).toBeVisible()
  })

  it('plain: ohne Fläche', () => {
    const { container } = renderWithTheme(
      <PageSection title="Liste" variant="plain">
        x
      </PageSection>
    )
    expect(container.querySelector('.MuiPaper-root')).toBeNull()
  })

  it('printHidden: Abschnitt ist als Bildschirm-only markiert', () => {
    renderWithTheme(
      <PageSection title="Filter" printHidden data-testid="filter" />
    )
    expect(screen.getByTestId('filter')).toHaveAttribute('data-print', 'hide')
  })
})

describe('KeyFigures', () => {
  it('zeigt Bezeichnung, Wert und Hinweis als Beschreibungsliste', () => {
    renderWithTheme(
      <KeyFigures
        aria-label="Kasse"
        items={[
          { label: 'Umsatz', value: '259,80 €', hint: 'Freitag' },
          { label: 'Bons', value: '47', tone: 'success' },
        ]}
      />
    )
    const list = screen.getByLabelText('Kasse')
    expect(list.tagName).toBe('DL')
    expect(within(list).getAllByRole('term')).toHaveLength(2)
    expect(within(list).getByText('259,80 €')).toBeInTheDocument()
    expect(within(list).getByText('Freitag')).toBeInTheDocument()
  })

  it('gültige Beschreibungsliste: je Kennzahl ein div mit dt + dd, Badge im dt (Review r2)', () => {
    // axe meldete auf ~15 Seiten „definition-list“/„dlitem“: das <dt> stand
    // zwei divs tief, der Badge zwischen <dt> und <dd>.
    renderWithTheme(
      <KeyFigures
        aria-label="Kennzahlen des Zeitraums"
        items={[
          {
            label: 'Umsatz',
            value: '259,80 €',
            hint: 'Freitag',
            badge: <span data-testid="badge">vorläufig</span>,
          },
          { label: 'Bons', value: '47' },
        ]}
      />
    )
    const list = screen.getByLabelText('Kennzahlen des Zeitraums')
    const groups = Array.from(list.children)
    expect(groups).toHaveLength(2)
    groups.forEach((group) => {
      expect(group.tagName).toBe('DIV')
      const tags = Array.from(group.children).map((child) => child.tagName)
      expect(tags[0]).toBe('DT')
      expect(tags.slice(1).every((tag) => tag === 'DD')).toBe(true)
      expect(tags.slice(1).length).toBeGreaterThan(0)
    })
    const term = within(list).getAllByRole('term')[0]
    expect(term).toContainElement(screen.getByTestId('badge'))
    expect(term).toHaveTextContent('Umsatzvorläufig')
  })

  it('plain: ohne Schatten-Fläche, für Kennzahlen in einer Karte', () => {
    renderWithTheme(
      <KeyFigures
        aria-label="Tag"
        variant="plain"
        dense
        items={[{ label: 'Bestellungen', value: '12' }]}
      />
    )
    const list = screen.getByLabelText('Tag')
    expect(list.querySelector('.MuiPaper-elevation0')).not.toBeNull()
    expect(within(list).getByText('12')).toBeInTheDocument()
  })
})

describe('Zustände', () => {
  it('LoadingState meldet sich als Status mit Text', () => {
    renderWithTheme(<LoadingState label="Benutzer werden geladen …" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Benutzer werden geladen …'
    )
  })

  it('EmptyState: Satz plus eine Aktion', () => {
    renderWithTheme(
      <EmptyState
        title="Noch keine Vorbestellungen."
        description="Neue erfassen Sie oben rechts."
        action={<button type="button">Erfassen</button>}
      />
    )
    expect(screen.getByText('Noch keine Vorbestellungen.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erfassen' })).toBeInTheDocument()
  })

  it('ErrorState: „Erneut versuchen“ ruft onRetry', () => {
    const onRetry = jest.fn()
    renderWithTheme(
      <ErrorState message="Keine Verbindung." onRetry={onRetry} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Keine Verbindung.')
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it.each([
    'Failed to fetch',
    'Load failed',
    'HTTP 502: Bad Gateway',
    'Request timeout',
  ])('ErrorState zeigt statt „%s“ den deutschen Verbindungssatz', (raw) => {
    renderWithTheme(<ErrorState message={raw} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Keine Verbindung zum Server – bitte WLAN prüfen.'
    )
  })

  it('ErrorState lässt deutsche API-Meldungen stehen', () => {
    renderWithTheme(<ErrorState message="PIN falsch." />)
    expect(screen.getByRole('alert')).toHaveTextContent('PIN falsch.')
  })
})

interface Row {
  id: number
  name: string
  role: string
  pin: boolean
}

const ROWS: Row[] = [
  { id: 1, name: 'Ines', role: 'Inhaber', pin: true },
  { id: 2, name: 'Vera', role: 'Verkauf', pin: false },
]

const COLUMNS: ResponsiveColumn<Row>[] = [
  { key: 'name', header: 'Name', primary: true, cell: (r) => r.name },
  { key: 'role', header: 'Rolle', inline: true, cell: (r) => r.role },
  {
    key: 'pin',
    header: 'PIN',
    cell: (r) => (r.pin ? 'gesetzt' : '–'),
    cardCell: (r) => (r.pin ? 'PIN gesetzt' : 'keine PIN'),
  },
]

function renderList(rows: Row[] = ROWS) {
  return renderWithTheme(
    <ResponsiveList
      aria-label="Benutzer"
      rows={rows}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      rowTestId={(r) => `row-${r.id}`}
      empty="Noch keine Benutzer."
      actions={(r) => <button type="button">{`${r.name} bearbeiten`}</button>}
    />
  )
}

describe('ResponsiveList', () => {
  const originalMatchMedia = window.matchMedia
  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('am PC eine Tabelle mit Aktionsspalte', () => {
    renderList()
    const table = screen.getByRole('table', { name: 'Benutzer' })
    expect(
      within(table).getByRole('columnheader', { name: 'Aktionen' })
    ).toBeInTheDocument()
    const row = screen.getByTestId('row-2')
    expect(row.tagName).toBe('TR')
    expect(within(row).getByText('–')).toBeInTheDocument()
    expect(
      within(row).getByRole('button', { name: 'Vera bearbeiten' })
    ).toBeInTheDocument()
  })

  it('leer: der Leertext statt einer leeren Tabelle', () => {
    renderList([])
    expect(screen.getByText('Noch keine Benutzer.')).toBeInTheDocument()
  })

  it('am Handy Karten: Titel, Aktionen, inline-Werte und Kartentext', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    renderList()
    expect(screen.queryByRole('table')).toBeNull()
    const card = screen.getByTestId('row-2')
    expect(card.tagName).toBe('LI')
    expect(within(card).getByText('Vera')).toBeInTheDocument()
    expect(within(card).getByText('Verkauf')).toBeInTheDocument()
    expect(within(card).getByText('keine PIN')).toBeInTheDocument()
    expect(within(card).queryByText('–')).toBeNull()
    expect(
      within(card).getByRole('button', { name: 'Vera bearbeiten' })
    ).toBeInTheDocument()
  })
})

describe('Kopf und Abschnitte: sticky und Umbruch (Review r1)', () => {
  it('die Fläche von PageSection schneidet mit clip ab, nicht mit hidden', () => {
    // `overflow: hidden` auf der Fläche fing jedes `position: sticky` darin
    // ein (Speichern-Leiste der Standard-Bestückung blieb am Seitenende).
    renderWithTheme(
      <PageSection title="Bestückung" data-testid="sec">
        <div style={{ position: 'sticky', bottom: 0 }}>Speichern</div>
      </PageSection>
    )
    const paper = screen
      .getByTestId('sec')
      .querySelector('.MuiPaper-root') as HTMLElement
    expect(getComputedStyle(paper).overflow).toBe('clip')
  })

  it('Aktionen rutschen unter den Titel, statt ihn zu zerquetschen', () => {
    renderWithTheme(
      <PageLayout
        title="LA-2026-11-14-01"
        actions={
          <>
            <button type="button">Rest kassiert</button>
            <button type="button">Bearbeiten</button>
            <button type="button">Bereitgestellt</button>
          </>
        }
      />
    )
    const title = getComputedStyle(screen.getByTestId('page-title-block'))
    // Mindestbreite des Titels als flex-basis, Umbruch im Kopf erlaubt
    expect(title.flexBasis).toBe(HEADER_TITLE_MIN_WIDTH)
    const row = screen.getByTestId('page-title-block')
      .parentElement as HTMLElement
    expect(getComputedStyle(row).flexWrap).toBe('wrap')
    // der Aktionsblock darf schrumpfen (kein flexShrink 0 mehr)
    expect(
      getComputedStyle(screen.getByTestId('page-actions')).flexShrink
    ).not.toBe('0')
  })
})

describe('DayNavigator', () => {
  it('rechnet Kalendertage ohne Zeitzone, auch über Monats- und Zeitumstellung', () => {
    expect(shiftIsoDate('2026-11-07', 1)).toBe('2026-11-08')
    expect(shiftIsoDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftIsoDate('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftIsoDate('2026-02-30', 1)).toBeNull()
    expect(shiftIsoDate('kein Datum', 1)).toBeNull()
  })

  it('Pfeile wechseln den Tag, Grenzen sperren sie', () => {
    const onChange = jest.fn()
    renderWithTheme(
      <DayNavigator
        value="2026-11-07"
        onChange={onChange}
        label="Abholtag"
        max="2026-11-07"
      />
    )
    expect(
      screen.getByRole('group', { name: 'Abholtag wechseln' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Tag' }))
    expect(onChange).toHaveBeenCalledWith('2026-11-06')
    expect(screen.getByRole('button', { name: 'Nächster Tag' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Abholtag'), {
      target: { value: '2026-11-03' },
    })
    expect(onChange).toHaveBeenLastCalledWith('2026-11-03')
  })

  it('step überspringt Ruhetage, null sperrt; „Heute“ nur mit today', () => {
    const onChange = jest.fn()
    const { rerender } = renderWithTheme(
      <DayNavigator
        value="2026-11-10"
        onChange={onChange}
        prevLabel="Vorheriger Backtag"
        nextLabel="Nächster Backtag"
        step={(date, direction) => (direction === -1 ? '2026-11-08' : null)}
        today="2026-11-07"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriger Backtag' }))
    expect(onChange).toHaveBeenCalledWith('2026-11-08')
    expect(
      screen.getByRole('button', { name: 'Nächster Backtag' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Heute' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-07')
    rerender(<DayNavigator value="2026-11-07" onChange={onChange} />)
    expect(screen.queryByRole('button', { name: 'Heute' })).toBeNull()
  })
})

describe('Fenstertitel aus dem Seitentitel (Review r2)', () => {
  it('pageDocumentTitle: Text mit Endung, Elemente ohne', () => {
    expect(pageDocumentTitle('Kassenberichte')).toBe(
      'Kassenberichte - Bäckerei Heusser'
    )
    expect(pageDocumentTitle('  Vorbestellungen   Sa, 07.11.2026 ')).toBe(
      'Vorbestellungen Sa, 07.11.2026 - Bäckerei Heusser'
    )
    expect(pageDocumentTitle(<span>x</span>)).toBeNull()
    expect(pageDocumentTitle('')).toBeNull()
  })

  it('setzt document.title und stellt den vorigen beim Verlassen wieder her', () => {
    document.title = 'Bäckerei Heusser - Verwaltung'
    const { rerender, unmount } = renderWithTheme(
      <PageLayout title="Kassenberichte">x</PageLayout>
    )
    expect(document.title).toBe('Kassenberichte - Bäckerei Heusser')
    rerender(
      <PageLayout title={<span>Tag</span>} documentTitle="Kassentag">
        x
      </PageLayout>
    )
    expect(document.title).toBe('Kassentag - Bäckerei Heusser')
    unmount()
    expect(document.title).toBe('Bäckerei Heusser - Verwaltung')
  })
})
