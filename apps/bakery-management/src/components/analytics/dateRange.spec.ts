import {
  defaultReportRange,
  reportAnchor,
  reportArchiveNote,
  standardPresets,
  weekPresets,
} from './dateRange'

describe('Zeiträume der Zahlen-Seiten', () => {
  it('endet am jüngsten Tag mit Bericht, nicht an heute', () => {
    // Regression: Kassenberichte endeten am 06.11. (letzter Bericht), die
    // Analysen am 07.11. (heute, ohne Bericht) - „30 Tage“ ergab dort
    // einen anderen Umsatz.
    expect(reportAnchor('2026-11-06', '2026-11-07')).toBe('2026-11-06')
    expect(reportAnchor(null, '2026-11-07')).toBe('2026-11-07')
    // Ein Bericht „aus der Zukunft“ (Uhr falsch) verschiebt nichts.
    expect(reportAnchor('2026-11-09', '2026-11-07')).toBe('2026-11-07')
  })

  it('gibt Vorgabe und Schnellwahl „30 Tage“ denselben Zeitraum', () => {
    const anchor = reportAnchor('2026-11-06', '2026-11-07')
    const thirty = standardPresets(anchor).find((p) => p.label === '30 Tage')
    expect(defaultReportRange(anchor)).toEqual({
      from: '2026-10-08',
      to: '2026-11-06',
    })
    expect(thirty).toMatchObject(defaultReportRange(anchor))
  })

  it('hat eine Schnellwahl-Liste für Kassen- und eine für Wochen-Seiten', () => {
    expect(standardPresets('2026-11-06').map((p) => p.label)).toEqual([
      '7 Tage',
      '30 Tage',
      '90 Tage',
      'Dieser Monat',
      'Letzter Monat',
    ])
    expect(standardPresets('2026-11-06')[4]).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(weekPresets('2026-11-06')).toEqual([
      { label: '7 Tage', from: '2026-10-31', to: '2026-11-06' },
      { label: '4 Wochen', from: '2026-10-10', to: '2026-11-06' },
      { label: '12 Wochen', from: '2026-08-15', to: '2026-11-06' },
    ])
  })

  it('nennt den Umfang des Archivs', () => {
    expect(reportArchiveNote('2026-09-12', '2026-11-06')).toBe(
      'Kassenberichte vorhanden vom 12.09.2026 bis 06.11.2026'
    )
    expect(reportArchiveNote(null, null)).toBeUndefined()
  })
})
