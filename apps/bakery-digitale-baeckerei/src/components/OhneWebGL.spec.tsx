import React from 'react'
import { screen, within } from '@testing-library/react'
import OhneWebGL, {
  BEREICH_LEER_TEXT,
  OHNE_WEBGL_TEXT,
  OHNE_WEBGL_TITEL,
} from './OhneWebGL'
import { MEHR_LESEN_TEXT, WEBSITE_LINK_TEXT } from './ProduktSheet'
import {
  AEPFELTASCHE,
  BLICKPUNKTE,
  EINTRAEGE,
  PROBEWECK,
  TESTBROT,
  VERBOTEN,
  zeige,
} from './testdaten'

const EINTRAEGE_JE = {
  theke: EINTRAEGE,
  brotregal: [{ slot: 'brotregal/ebene-1/platz-01', produkt: PROBEWECK }],
  // 'regale' fehlt absichtlich
}

function setup(props: Partial<React.ComponentProps<typeof OhneWebGL>> = {}) {
  return zeige(
    <OhneWebGL
      raeume={[
        {
          id: 'laden',
          name: 'Laden',
          blickpunkte: BLICKPUNKTE,
          eintraegeJe: EINTRAEGE_JE,
        },
      ]}
      {...props}
    />
  )
}

describe('OhneWebGL', () => {
  it('meldet in einer Status-Region, dass 3D hier nicht geht', () => {
    setup()
    expect(OHNE_WEBGL_TEXT).toBe(
      'Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar.'
    )
    expect(screen.getByRole('status')).toHaveTextContent(OHNE_WEBGL_TEXT)
    expect(
      screen.getByRole('heading', { name: OHNE_WEBGL_TITEL })
    ).toBeInTheDocument()
  })

  it('hat je Blickpunkt einen Abschnitt mit Überschrift', () => {
    setup()
    for (const name of ['Theke', 'Brotregal', 'Regale']) {
      const bereich = screen.getByRole('region', { name })
      expect(within(bereich).getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('listet die Produkte mit Name, Einheit und Kurztext - jedes einmal, sortiert', () => {
    setup()
    const theke = screen.getByRole('region', { name: 'Theke' })
    const zeilen = within(theke).getAllByRole('listitem')
    expect(zeilen.map((z) => z.textContent)).toEqual([
      'Äpfeltasche · 1 StückEin erfundenes Teilchen.',
      'ProbeweckEin erfundenes Brötchen.',
      // dazu der lange Text (zum Aufklappen) und der Link auf die Website
      `Testbrot · 500 gEin erfundenes Brot mit kräftiger Kruste.${MEHR_LESEN_TEXT}${TESTBROT.text}${WEBSITE_LINK_TEXT}`,
      'ZimtkringelEin erfundener Kringel.',
    ])
  })

  it('klappt den langen Text unter „Mehr lesen“ auf - nur wenn er mehr sagt als der Kurztext', () => {
    setup()
    const theke = screen.getByRole('region', { name: 'Theke' })
    const zeile = (name: string) =>
      within(theke)
        .getAllByRole('listitem')
        .find((z) => z.textContent?.startsWith(name)) as HTMLElement

    const details = zeile(TESTBROT.name).querySelectorAll('details')
    expect(details).toHaveLength(1)
    const [mehr] = details
    expect(mehr.open).toBe(false)
    expect(mehr.querySelector('summary')).toHaveTextContent(MEHR_LESEN_TEXT)
    // Absätze bleiben Absätze.
    const text = within(mehr).getByText(/Der Teig ruht lange/)
    expect(text.textContent).toBe(TESTBROT.text)
    expect(getComputedStyle(text).whiteSpace).toBe('pre-line')

    // Langer Text = Kurztext, oder gar keiner: nichts zum Aufklappen.
    expect(AEPFELTASCHE.text).toBe(AEPFELTASCHE.kurztext)
    expect(zeile(AEPFELTASCHE.name).querySelector('details')).toBeNull()
    expect(PROBEWECK.text).toBe('')
    expect(zeile(PROBEWECK.name).querySelector('details')).toBeNull()
  })

  it('verlinkt die Produktseite, wenn es sie gibt - in einem neuen Tab', () => {
    setup()
    const links = screen.getAllByRole('link', { name: WEBSITE_LINK_TEXT })
    // Nur das Testbrot hat eine Seite (es liegt zweimal, ist aber eine Zeile).
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', TESTBROT.seite)
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('hat unten Impressum und Datenschutz der Landingpage', () => {
    const { container } = setup()
    const fuss = container.querySelector('footer') as HTMLElement
    expect(fuss).not.toBeNull()
    expect(
      within(fuss).getByRole('link', { name: 'Impressum' })
    ).toHaveAttribute('href', '/imprint')
    expect(
      within(fuss).getByRole('link', { name: 'Datenschutz' })
    ).toHaveAttribute('href', '/datenschutz')
    for (const link of within(fuss).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })

  it('sagt bei einem Blickpunkt ohne Produkte, dass dort nichts liegt', () => {
    setup()
    const regale = screen.getByRole('region', { name: 'Regale' })
    expect(within(regale).getByText(BEREICH_LEER_TEXT)).toBeInTheDocument()
    expect(within(regale).queryByRole('list')).not.toBeInTheDocument()
  })

  it('als Screenreader-Weg: mit dem langen Text, aber ohne Link und ohne Tab-Halt', () => {
    const { container } = setup({ variante: 'screenreader' })
    const liste = screen.getByTestId('ohne-webgl')
    // Die Liste ist unsichtbar: Jeder Link, jedes <summary> wäre ein
    // Tab-Halt, den niemand sieht.
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(
      liste.querySelectorAll('button, summary, details, input, [tabindex]')
    ).toHaveLength(0)
    expect(container.querySelector('footer')).toBeNull()
    // Der lange Text ist trotzdem da - ohne Aufklappen.
    expect(liste.textContent).toContain(TESTBROT.text)
    expect(liste.textContent).not.toContain(MEHR_LESEN_TEXT)
    expect(liste.textContent).not.toContain(WEBSITE_LINK_TEXT)
  })

  it('als Screenreader-Weg: dieselbe Liste, aber ohne die Meldung', () => {
    setup({ variante: 'screenreader' })
    // Dort meldet die Status-Region der App - keine zweite, dauerhaft leere.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Brotregal' })).getAllByRole(
        'listitem'
      )
    ).toHaveLength(1)
  })

  it('nennt weder Kosten noch Inhaltsstoff-Hinweise', () => {
    setup()
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })

  it('nimmt eine andere Meldung und ein Bedienelement auf (Ladefehler)', () => {
    setup({
      meldung: 'Der Laden konnte nicht geladen werden.',
      aktion: <button type="button">Noch einmal</button>,
    })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Der Laden konnte nicht geladen werden.')
    expect(status).not.toHaveTextContent(OHNE_WEBGL_TEXT)
    expect(
      within(status).getByRole('button', { name: 'Noch einmal' })
    ).toBeInTheDocument()
  })

  it('schreibt den Kurztext in Lesegröße, nicht klein', () => {
    setup()
    const [kurztext] = screen.getAllByText(PROBEWECK.kurztext)
    expect(kurztext.className).toContain('MuiTypography-body1')
  })
})
