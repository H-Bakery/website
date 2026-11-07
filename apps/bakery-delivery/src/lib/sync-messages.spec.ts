import type { Preorder, RejectedUpdate, Stop, Tour } from './delivery-api'
import { describeRejected, syncNotice } from './sync-messages'

describe('syncNotice', () => {
  it('sagt „Kein Netz“ nur ohne Netz', () => {
    expect(syncNotice(false, false, 1)).toBe(
      'Kein Netz. Änderungen werden gespeichert und automatisch nachgesendet (1 offen).'
    )
  })

  it('nennt einen Serverfehler als solchen (UI-Runde 2)', () => {
    const text = syncNotice(true, true, 1)
    expect(text).toMatch(/^Der Server hat einen Fehler gemeldet/)
    expect(text).toContain(
      'die Änderung wird automatisch erneut gesendet (1 offen)'
    )
    expect(text).not.toMatch(/Kein Netz/)
    expect(syncNotice(true, true, 2)).toContain('die Änderungen werden')
  })

  it('schreibt Einzahl und Mehrzahl aus statt „Änderung(en)“', () => {
    expect(syncNotice(true, false, 1)).toBe(
      '1 Änderung wartet noch auf den Server und wird automatisch nachgesendet.'
    )
    expect(syncNotice(true, false, 3)).toBe(
      '3 Änderungen warten noch auf den Server und werden automatisch nachgesendet.'
    )
    expect(syncNotice(true, false, 0)).toBeNull()
  })
})

describe('describeRejected', () => {
  const preorder = {
    id: 5,
    customer: 'Testkundin Faulbaum',
    status: 'handed_over',
  } as Preorder
  const stop = (id: number, customer: string, extra: Partial<Stop> = {}) =>
    ({ id, customer, pickupPointId: null, ...extra } as Stop)
  const tours = [
    {
      id: 4,
      stops: [
        stop(1, 'Kindergarten Mörsbach', {
          pickupPointId: 'kindergarten-moersbach',
          preorders: [preorder],
        }),
        stop(2, 'Testkundin Amsel'),
      ],
    } as Tour,
  ]
  const at = '2026-11-07T08:00:00.000Z'

  it('nennt Handlung, Person und den Grund des Servers', () => {
    const rejected: RejectedUpdate[] = [
      {
        id: 'a',
        queuedAt: at,
        kind: 'preorder',
        preorderId: 5,
        body: { status: 'handed_over' },
        reason: 'Die Bestellung wurde storniert.',
      },
    ]
    expect(describeRejected(rejected, tours)).toBe(
      'Übergabe an Testkundin Faulbaum nicht gespeichert: Die Bestellung wurde storniert. Angezeigt ist jetzt der Stand des Servers.'
    )
  })

  it('beschreibt Stopps und ergänzt den fehlenden Punkt', () => {
    const rejected: RejectedUpdate[] = [
      {
        id: 'b',
        queuedAt: at,
        kind: 'stop',
        tourId: 4,
        stopId: 1,
        body: { status: 'done' },
        reason: 'Der Zeitpunkt muss zum Tourtag passen.',
      },
      {
        id: 'c',
        queuedAt: at,
        kind: 'stop',
        tourId: 4,
        stopId: 2,
        body: { status: 'failed' },
        reason: 'Fehler 400',
      },
    ]
    expect(describeRejected(rejected, tours)).toBe(
      'Abschluss der Sammelstelle Kindergarten Mörsbach nicht gespeichert: Der Zeitpunkt muss zum Tourtag passen. „Nicht angetroffen“ bei Testkundin Amsel nicht gespeichert: Fehler 400. Angezeigt ist jetzt der Stand des Servers.'
    )
  })

  it('kommt ohne angezeigte Tour aus', () => {
    const rejected: RejectedUpdate[] = [
      {
        id: 'd',
        queuedAt: at,
        kind: 'preorder',
        preorderId: 99,
        body: { status: 'not_collected' },
        reason: 'Nicht erlaubt.',
      },
    ]
    expect(describeRejected(rejected, [])).toMatch(
      /^„Nicht abgeholt“ bei einer Vorbestellung nicht gespeichert/
    )
  })
})
