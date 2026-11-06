import {
  SPICKZETTEL,
  SPICKZETTEL_ORDER,
  spickzettelOrderFor,
} from './spickzettel'
import { PAPIER_REGEL, PAPIER_SCHWELLE_MINUTEN } from './papierbetrieb'
import { PILOT_ROLES } from '../../lib/roles'

/**
 * Grobe Längengrenze je Blatt. Gedruckt passt ein Spickzettel mit dieser
 * Länge auf EINE A4-Seite (zwei Spalten, 9,5 pt) - geprüft im Smoke mit einem
 * echten PDF (Seitenzahl 1). Wer mehr Text braucht, kürzt woanders oder prüft
 * den Druck neu.
 */
const MAX_CHARS_PER_SHEET = 3000
const MAX_STEPS_PER_SHEET = 40

const text = (role: keyof typeof SPICKZETTEL) =>
  SPICKZETTEL[role].blocks
    .flatMap((block) => [block.title, ...block.steps])
    .join('\n')

describe('Spickzettel (P6)', () => {
  it('gibt es für jede Pilot-Rolle, in fester Reihenfolge', () => {
    expect(Object.keys(SPICKZETTEL).sort()).toEqual([...PILOT_ROLES].sort())
    expect([...SPICKZETTEL_ORDER].sort()).toEqual([...PILOT_ROLES].sort())
    for (const role of PILOT_ROLES) expect(SPICKZETTEL[role].role).toBe(role)
  })

  it.each(PILOT_ROLES)(
    '%s passt in die Längengrenze einer A4-Seite',
    (role) => {
      const steps = SPICKZETTEL[role].blocks.flatMap((block) => block.steps)
      expect(steps.length).toBeLessThanOrEqual(MAX_STEPS_PER_SHEET)
      expect(steps.join('').length).toBeLessThanOrEqual(MAX_CHARS_PER_SHEET)
    }
  )

  it.each(PILOT_ROLES)(
    '%s: jedes ** ist geschlossen, kein Abschnitt leer',
    (role) => {
      for (const block of SPICKZETTEL[role].blocks) {
        expect(block.steps.length).toBeGreaterThan(0)
        for (const step of block.steps) {
          expect(step.split('**').length % 2).toBe(1)
        }
      }
    }
  )

  it('Verkauf: Station, Erfassen, Code, Abholliste, nicht abgeholt, Storno, Abmelden, Verbindung', () => {
    const t = text('verkauf')
    for (const needle of [
      'PIN',
      'Neue Vorbestellung',
      'Sorte',
      'Menge',
      'Bezahlt',
      'Vorbestellung speichern',
      'Code',
      'Abholliste',
      'Bezahlt und übergeben',
      'Nicht abgeholt',
      'Stornieren',
      'Abmelden',
      'Keine Verbindung',
    ]) {
      expect(t).toContain(needle)
    }
  })

  it('Backstube: Heute/Morgen, Abhaken, Nachträge, Vorbereitung, Drucken, nicht freigegeben', () => {
    const t = text('backstube')
    for (const needle of [
      'Heute',
      'Morgen',
      'Kästchen',
      'Nachträge seit der Freigabe',
      'Gesehen',
      'Vorbereitung heute',
      'Drucken',
      'Noch nicht freigegeben',
      'Notfallblatt',
    ]) {
      expect(t).toContain(needle)
    }
  })

  it('Fahrer: Abholliste der Sammelstelle, übergeben + bezahlt, nicht abgeholt, nur im WLAN', () => {
    const t = `${SPICKZETTEL.fahrer.intro}\n${text('fahrer')}`
    for (const needle of [
      'Abholliste',
      'Kindergarten Mörsbach',
      'Bezahlt und übergeben',
      'Nicht abgeholt',
      'WLAN',
      'Drucken',
    ]) {
      expect(t).toContain(needle)
    }
  })

  it('Inhaber: Benutzer/PIN/Station, Backzettel, Grundmengen, Produkte, Finanzen, Papierbetrieb', () => {
    const t = text('inhaber')
    for (const needle of [
      'Neuer Benutzer',
      'PIN setzen',
      'Gerät als Station einrichten',
      'Jetzt freigeben',
      'Wieder öffnen',
      'Grundmengen',
      'Wartet auf Freigabe',
      'Passwort-Anmeldung',
      '10 Minuten',
    ]) {
      expect(t).toContain(needle)
    }
  })

  it('Reiter: die eigene Rolle zuerst, ohne Rolle die feste Reihenfolge', () => {
    expect(spickzettelOrderFor('fahrer')).toEqual([
      'fahrer',
      'verkauf',
      'backstube',
      'inhaber',
    ])
    expect(spickzettelOrderFor(null)).toEqual([...SPICKZETTEL_ORDER])
  })
})

describe('Papierbetrieb-Regel (P6)', () => {
  const all = PAPIER_REGEL.flatMap((block) => [
    block.title,
    ...block.steps,
  ]).join('\n')

  it('nennt Schwelle, wer entscheidet und das Nachtragen mit Code', () => {
    expect(PAPIER_SCHWELLE_MINUTEN).toBe(10)
    expect(all).toContain('10 Minuten')
    expect(all).toContain('Wer entscheidet')
    expect(all).toContain('Laden bzw. in der Backstube')
    expect(all).toContain('Neue Vorbestellung')
    expect(all).toContain('Code')
    expect(all).toContain('in App übertragen')
    expect(all).toContain('letzten freigegebenen Ausdruck')
  })

  it('bleibt in der Längengrenze', () => {
    const steps = PAPIER_REGEL.flatMap((block) => block.steps)
    expect(steps.join('').length).toBeLessThanOrEqual(MAX_CHARS_PER_SHEET)
  })
})
