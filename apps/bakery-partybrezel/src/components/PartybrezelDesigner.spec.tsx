import React from 'react'
import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeRegistry from './ThemeRegistry'
import PartybrezelDesigner from './PartybrezelDesigner'
import { BANNER_TEXT } from './PrototypeBanner'
import { partybrezelConfig as config } from '../config/partybrezel.config'
import { DRAFT_STORAGE_KEY } from '../lib/draftStorage'

// Freitag, 06.11.2026: frühester Abholtag So 08.11., Mo 09.11. ist Ruhetag.
const TODAY = '2026-11-06'

function setup(
  props: Partial<React.ComponentProps<typeof PartybrezelDesigner>> = {}
) {
  const user = userEvent.setup()
  const utils = render(
    <ThemeRegistry>
      <PartybrezelDesigner today={TODAY} persistDraft={false} {...props} />
    </ThemeRegistry>
  )
  return { user, ...utils }
}

const heading = () =>
  screen.getByRole('heading', { level: 2, name: /^Schritt/ })
const next = () => screen.getByRole('button', { name: 'Weiter' })
const back = () => screen.getByRole('button', { name: 'Zurück' })
const runningPrice = () =>
  (screen.getByTestId('running-price').textContent ?? '').replace(
    /\u00a0/g,
    ' '
  )
/** Datums-Chip über den langen Namen; der zugängliche Name beginnt mit dem sichtbaren "So, 08.11.". */
const dateChipName = (long: string) =>
  new RegExp(`^[A-Z][a-z], \\d{2}\\.\\d{2}\\. \\(${long}\\)$`)
const dateChip = (long: string) =>
  screen.getByRole('button', { name: dateChipName(long) })
const json = () =>
  JSON.parse(screen.getByTestId('payload-json').textContent ?? '{}')

// Der Durchklick-Test bedient ~40 Elemente; getByRole ist in jsdom langsam.
jest.setTimeout(60_000)

beforeEach(() => {
  window.localStorage.clear()
})

describe('PartybrezelDesigner', () => {
  it('zeigt den Prototyp-Hinweis mit den offenen Fragen', async () => {
    const { user } = setup()
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Offene Fragen ansehen' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Was noch offen ist',
    })
    for (const q of config.openQuestions) {
      expect(
        within(dialog).getByText(`${q.id}: ${q.title}`)
      ).toBeInTheDocument()
    }
    expect(config.openQuestions.map((q) => q.id)).toEqual([
      'Q-P1',
      'Q-P2',
      'Q-P3',
      'Q-P4',
      'Q-P5',
      'Q-P6',
      'Q-P7',
    ])
  })

  it('führt durch alle vier Schritte bis zur Payload-Vorschau', async () => {
    const { user } = setup()
    // nach userEvent.setup(), das sonst seine eigene Zwischenablage einsetzt
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    // --- 1. Größe & Anzahl
    expect(heading()).toHaveTextContent('Schritt 1 von 4: Größe & Anzahl')
    expect(screen.getByText(/3 Teile × 300 g Flitteig/)).toBeInTheDocument()
    expect(screen.getByText(/3 Teile × 400 g Flitteig/)).toBeInTheDocument()
    expect(screen.getAllByText(/Personen \(Platzhalter\)/)).toHaveLength(2)
    await user.click(next())
    expect(screen.getByTestId('step-errors')).toHaveTextContent(
      /mindestens eine Brezel/
    )
    // schon beim ERSTEN Fehlversuch fokussiert (die Meldung entsteht erst da)
    expect(screen.getByTestId('step-errors')).toHaveFocus()
    expect(heading()).toHaveTextContent('Schritt 1')

    await user.click(
      screen.getByRole('button', { name: 'Anzahl groß erhöhen' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Anzahl groß erhöhen' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Anzahl klein erhöhen' })
    )
    expect(screen.getByLabelText('Anzahl groß: 2')).toBeInTheDocument()
    expect(runningPrice()).toContain('73,70 €') // 19,90 + 2 × 26,90 (Platzhalter)
    expect(screen.queryByTestId('step-errors')).not.toBeInTheDocument()

    // --- 2. Belag
    await user.click(next())
    expect(heading()).toHaveTextContent('Schritt 2 von 4: Belag')
    expect(heading()).toHaveFocus()
    await user.click(next())
    expect(screen.getByTestId('step-errors')).toHaveTextContent(
      /belegen Sie jedes Teil/
    )
    expect(screen.getByTestId('step-errors')).toHaveFocus()
    // der Aufpreis am Chip ist der eines Klicks: je Teil
    expect(
      screen.getByRole('button', {
        name: /^Käse \+1,00\s€ je Teil für Brezel 2 \(groß\), Teil 1$/,
      })
    ).toBeInTheDocument()

    const part = (label: string, pretzel: string, n: number) =>
      screen.getByRole('button', {
        name: new RegExp(`^${label}.* für ${pretzel}, Teil ${n}$`),
      })
    await user.click(part('Käse', 'Brezel 2 \\(groß\\)', 1))
    await user.click(part('Schinken', 'Brezel 2 \\(groß\\)', 2))
    await user.click(part('Butter', 'Brezel 2 \\(groß\\)', 3))
    expect(part('Käse', 'Brezel 2 \\(groß\\)', 1)).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('img', {
        name: 'Brezel 2 (groß) – Teil 1: Käse, Teil 2: Schinken, Teil 3: Butter',
      })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Belag von Brezel 2 (groß) für alle Brezeln übernehmen',
      })
    )
    expect(
      screen.getByRole('img', {
        name: 'Brezel 3 (klein) – Teil 1: Käse, Teil 2: Schinken, Teil 3: Butter',
      })
    ).toBeInTheDocument()
    // Käse 1,00 + Schinken 1,50 je Brezel (Platzhalter)
    expect(runningPrice()).toContain('81,20 €')

    // --- 3. Abholung & Kontakt
    await user.click(next())
    expect(heading()).toHaveTextContent('Schritt 3 von 4: Abholung & Kontakt')
    expect(
      screen.queryByRole('button', {
        name: dateChipName('Montag, 9. November 2026'),
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: dateChipName('Samstag, 7. November 2026'),
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'So, 08.11. (Sonntag, 8. November 2026)',
      })
    ).toBeInTheDocument()
    await user.click(next())
    const errors = screen.getByTestId('step-errors')
    expect(errors).toHaveTextContent(/Abholtag/)
    expect(errors).toHaveTextContent(/Namen/)

    await user.click(dateChip('Sonntag, 8. November 2026'))
    expect(screen.queryByTestId('dough-ruhetag')).not.toBeInTheDocument()
    // Dienstag: der Teigtag wäre der Ruhetag - offen, kein erfundenes Datum
    await user.click(dateChip('Dienstag, 10. November 2026'))
    expect(screen.getByTestId('dough-ruhetag')).toHaveTextContent(
      /Vortag \(Montag\) ist Ruhetag.*noch offen \(Fragen Q-P4 und Q-P7\)/
    )
    await user.type(
      screen.getByRole('textbox', { name: /^Name/ }),
      'Erika Beispiel'
    )
    await user.type(screen.getByRole('textbox', { name: /Telefon/ }), '123')
    await user.click(next())
    expect(screen.getByTestId('step-errors')).toHaveTextContent(/5 Ziffern/)
    await user.type(screen.getByRole('textbox', { name: /Telefon/ }), '45')
    await user.type(
      screen.getByRole('textbox', { name: /Anmerkung/ }),
      'Bitte geschnitten'
    )

    // --- 4. Übersicht
    await user.click(next())
    expect(heading()).toHaveTextContent('Schritt 4 von 4: Übersicht')
    expect(
      (screen.getByTestId('total-price').textContent ?? '').replace(
        /\u00a0/g,
        ' '
      )
    ).toBe('81,20 €')
    expect(screen.getByText('Dienstag, 10. November 2026')).toBeInTheDocument()
    expect(screen.getByTestId('dough-summary')).toHaveTextContent(
      '3 Teile × 300 g = 900 g Flitteig'
    )
    expect(screen.getByTestId('dough-summary')).not.toHaveTextContent(
      /Teig am Montag/
    )
    expect(screen.getByTestId('dough-summary')).toHaveTextContent(
      'Teig am Vortag – der Vortag (Montag) ist Ruhetag; wann der Teig angesetzt wird, ist offen (Q-P4/Q-P7).'
    )
    expect(screen.getByText(/Es wurde nichts gesendet/)).toBeInTheDocument()

    const a = json()
    expect(a).toMatchObject({
      channel: 'shop',
      customerName: 'Erika Beispiel',
      customerPhone: '12345',
      pickupDate: '2026-11-10',
      items: [
        { productId: 'partybrezel-gross', quantity: 2 },
        { productId: 'partybrezel-klein', quantity: 1 },
      ],
    })
    expect(a.note).toContain(
      'Brezel 1, 2 (groß): Käse, Schinken, Butter; Brezel 3 (klein): Käse, Schinken, Butter'
    )
    expect(a.note).toContain('Anmerkung: Bitte geschnitten')
    expect(screen.getByTestId('payload-json').textContent).not.toMatch(/price/i)

    await user.click(screen.getByRole('button', { name: 'B: Teile mit Sorte' }))
    expect(json().items).toEqual([
      { productId: 'partybrezel-teil-gross', variant: 'kaese', quantity: 2 },
      { productId: 'partybrezel-teil-gross', variant: 'schinken', quantity: 2 },
      { productId: 'partybrezel-teil-gross', variant: 'butter', quantity: 2 },
      { productId: 'partybrezel-teil-klein', variant: 'kaese', quantity: 1 },
      { productId: 'partybrezel-teil-klein', variant: 'schinken', quantity: 1 },
      { productId: 'partybrezel-teil-klein', variant: 'butter', quantity: 1 },
    ])
    expect(screen.getByTestId('mapping-description')).toHaveTextContent(
      /Backzettel/
    )

    await user.click(screen.getByRole('button', { name: 'Kopieren' }))
    expect(writeText).toHaveBeenCalledWith(
      screen.getByTestId('payload-json').textContent
    )
    expect(
      await screen.findByText('In die Zwischenablage kopiert.')
    ).toBeInTheDocument()

    // --- Modus umschalten (Prototyp-Einstellungen) und zurück zum Belag
    await user.click(
      screen.getByRole('button', { name: 'Prototyp-Einstellungen' })
    )
    await user.click(screen.getByRole('radio', { name: /Ein Belag je Brezel/ }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Prototyp-Einstellungen' })
    ).toBeInTheDocument()
    // die Übersicht sagt, dass sie nicht mehr gilt, und kopiert nichts
    expect(heading()).toHaveTextContent('Schritt 4 von 4')
    expect(screen.getByTestId('summary-incomplete')).toHaveTextContent(
      /für jede Brezel einen Belag \(offen: Brezel 1, 2, 3\)/
    )
    expect(
      screen.getByRole('heading', {
        name: 'So würde die Vorbestellung aussehen (unvollständig)',
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Zu Schritt 2: Belag' })
    )
    expect(heading()).toHaveTextContent('Schritt 2 von 4: Belag')
    expect(screen.getAllByText(/unterschiedlich belegt/)).toHaveLength(3)
    // je Brezel: der Chip nennt den Aufpreis für die ganze Brezel (3 × 1,50)
    await user.click(
      screen.getByRole('button', {
        name: /^Salami \+4,50\s€ je Brezel für Brezel 2 \(groß\)$/,
      })
    )
    expect(
      screen.getByRole('img', {
        name: 'Brezel 2 (groß) – Teil 1: Salami, Teil 2: Salami, Teil 3: Salami',
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText(/unterschiedlich belegt/)).toHaveLength(2)
    await user.click(next())
    expect(screen.getByTestId('step-errors')).toHaveTextContent(
      /für jede Brezel einen Belag \(offen: Brezel 1, 3\)/
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Belag von Brezel 2 (groß) für alle Brezeln übernehmen',
      })
    )
    await user.click(next())
    await user.click(next())
    expect(heading()).toHaveTextContent('Schritt 4 von 4')
    expect(json().note).toContain(
      'Brezel 1, 2 (groß): Salami (ganze Brezel); Brezel 3 (klein): Salami (ganze Brezel)'
    )
    expect(screen.queryByTestId('summary-incomplete')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeEnabled()

    // "Neu beginnen" fragt nach; Abbrechen lässt alles stehen
    await user.click(screen.getByRole('button', { name: 'Neu beginnen' }))
    const confirm = await screen.findByRole('dialog', {
      name: 'Zusammenstellung verwerfen?',
    })
    await user.click(within(confirm).getByRole('button', { name: 'Abbrechen' }))
    await waitForElementToBeRemoved(confirm)
    expect(heading()).toHaveTextContent('Schritt 4 von 4')
    expect(runningPrice()).not.toContain('0,00')
  })

  it('Kopieren ohne Zwischenablage markiert den Text und sagt das', async () => {
    const { user } = setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    await user.click(
      screen.getByRole('button', { name: 'Anzahl klein erhöhen' })
    )
    await user.click(next())
    await user.click(
      screen.getByRole('button', {
        name: /^Butter für Brezel 1 \(klein\), Teil 1$/,
      })
    )
    await user.click(
      screen.getByRole('button', {
        name: /^Butter für Brezel 1 \(klein\), Teil 2$/,
      })
    )
    await user.click(
      screen.getByRole('button', {
        name: /^Butter für Brezel 1 \(klein\), Teil 3$/,
      })
    )
    await user.click(next())
    await user.click(dateChip('Sonntag, 8. November 2026'))
    await user.type(
      screen.getByRole('textbox', { name: /^Name/ }),
      'Max Muster'
    )
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Kopieren' }))
    expect(await screen.findByText(/Strg\+C/)).toBeInTheDocument()
  })

  it('Weiter in der Schrittleiste springt nicht über einen offenen Schritt', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Belag' }))
    expect(heading()).toHaveTextContent('Schritt 1')
    expect(screen.getByTestId('step-errors')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Übersicht' })).toBeDisabled()
    expect(back()).toBeDisabled()
  })

  it('merkt sich den Entwurf im Browser und verwirft ihn auf Wunsch', async () => {
    const first = setup({ persistDraft: true })
    await first.user.click(
      screen.getByRole('button', { name: 'Anzahl groß erhöhen' })
    )
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('"gross"')
    first.unmount()

    const second = setup({ persistDraft: true })
    expect(await screen.findByLabelText('Anzahl groß: 1')).toBeInTheDocument()
    await second.user.click(
      screen.getByRole('button', { name: 'Prototyp-Einstellungen' })
    )
    await second.user.click(
      screen.getByRole('button', { name: 'Zusammenstellung verwerfen' })
    )
    const confirm = await screen.findByRole('dialog', {
      name: 'Zusammenstellung verwerfen?',
    })
    await second.user.click(
      within(confirm).getByRole('button', { name: 'Verwerfen' })
    )
    expect(screen.getByLabelText('Anzahl groß: 0')).toBeInTheDocument()
  })

  it('stellt den Entwurf auch unter React.StrictMode wieder her (next dev)', async () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        pretzels: [{ size: 'gross', toppings: ['kaese', null, null] }],
        toppingMode: 'per-part',
        name: 'Erika Beispiel',
      })
    )
    render(
      <React.StrictMode>
        <ThemeRegistry>
          <PartybrezelDesigner today={TODAY} />
        </ThemeRegistry>
      </React.StrictMode>
    )
    expect(await screen.findByLabelText('Anzahl groß: 1')).toBeInTheDocument()
    const stored = JSON.parse(
      window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}'
    )
    expect(stored.pretzels).toHaveLength(1)
    expect(stored.pretzels[0].toppings[0]).toBe('kaese')
    expect(stored.name).toBe('Erika Beispiel')
  })

  it('öffnet einen wiederhergestellten Entwurf auf dem gemerkten Schritt', async () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        pretzels: [{ size: 'klein', toppings: ['butter', 'butter', 'butter'] }],
        toppingMode: 'per-part',
        pickupDate: '2026-11-08',
        name: 'Erika Beispiel',
        step: 3,
      })
    )
    setup({ persistDraft: true })
    expect(await screen.findByText(/Schritt 4 von 4/)).toBeInTheDocument()
    expect(heading()).not.toHaveFocus()
    expect(screen.queryByTestId('summary-incomplete')).not.toBeInTheDocument()
    expect(json().pickupDate).toBe('2026-11-08')
  })

  it('bleibt beim Wiederherstellen vor einem inzwischen offenen Schritt stehen', async () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        pretzels: [{ size: 'klein', toppings: ['butter', 'butter', 'butter'] }],
        toppingMode: 'per-part',
        pickupDate: '2026-10-31', // abgelaufen
        name: 'Erika Beispiel',
        step: 3,
      })
    )
    setup({ persistDraft: true })
    expect(
      await screen.findByText(/Schritt 3 von 4: Abholung/)
    ).toBeInTheDocument()
    expect(
      JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}').step
    ).toBe(2)
  })

  it('läuft auch, wenn der Browser-Speicher wirft', async () => {
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const set = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const { user } = setup({ persistDraft: true })
    await user.click(
      screen.getByRole('button', { name: 'Anzahl klein erhöhen' })
    )
    expect(screen.getByLabelText('Anzahl klein: 1')).toBeInTheDocument()
    spy.mockRestore()
    set.mockRestore()
  })
})
