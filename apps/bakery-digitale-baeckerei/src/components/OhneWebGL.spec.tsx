import React from 'react'
import { screen, within } from '@testing-library/react'
import OhneWebGL, {
  BEREICH_LEER_TEXT,
  OHNE_WEBGL_TEXT,
  OHNE_WEBGL_TITEL,
} from './OhneWebGL'
import { BLICKPUNKTE, EINTRAEGE, PROBEWECK, VERBOTEN, zeige } from './testdaten'

const EINTRAEGE_JE = {
  theke: EINTRAEGE,
  brotregal: [{ slot: 'brotregal/ebene-1/platz-01', produkt: PROBEWECK }],
  // 'regale' fehlt absichtlich
}

function setup(props: Partial<React.ComponentProps<typeof OhneWebGL>> = {}) {
  zeige(
    <OhneWebGL
      blickpunkte={BLICKPUNKTE}
      eintraegeJe={EINTRAEGE_JE}
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
      'Testbrot · 500 gEin erfundenes Brot mit kräftiger Kruste.',
      'ZimtkringelEin erfundener Kringel.',
    ])
  })

  it('sagt bei einem Blickpunkt ohne Produkte, dass dort nichts liegt', () => {
    setup()
    const regale = screen.getByRole('region', { name: 'Regale' })
    expect(within(regale).getByText(BEREICH_LEER_TEXT)).toBeInTheDocument()
    expect(within(regale).queryByRole('list')).not.toBeInTheDocument()
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
