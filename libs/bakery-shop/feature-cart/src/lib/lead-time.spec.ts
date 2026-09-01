import {
  earliestPickupIsoDate,
  isPortion,
  leadTimeRuleFor,
  leadTimeRuleForItems,
} from './lead-time'

describe('lead-time', () => {
  describe('isPortion', () => {
    it('erkennt Stück- und Viertel-Artikel an der ID', () => {
      expect(isPortion({ id: 'kaesekuchen-1-stueck' })).toBe(true)
      expect(isPortion({ id: 'streuselkuchen-gross-1-4-stueck' })).toBe(true)
      expect(isPortion({ id: 'sahnerollen-1-stueck' })).toBe(true)
    })

    it('hält ganze Artikel davon auseinander', () => {
      expect(isPortion({ id: 'kaesekuchen' })).toBe(false)
      expect(isPortion({ id: 'schwarzwaelder-kirsch-torte' })).toBe(false)
      expect(isPortion({ id: 'blechkuchen' })).toBe(false)
    })
  })

  describe('leadTimeRuleFor', () => {
    it('verlangt für eine ganze Torte zwei Tage Vorlauf', () => {
      const rule = leadTimeRuleFor({
        id: 'schwarzwaelder-kirsch-torte',
        category: 'torten',
      })
      expect(rule.hours).toBe(48)
      expect(rule.reason).toMatch(/Torten/)
    })

    it('verlangt für einen ganzen Kuchen einen Tag Vorlauf', () => {
      expect(
        leadTimeRuleFor({ id: 'kaesekuchen', category: 'kuchen' }).hours
      ).toBe(24)
    })

    it('lässt ein einzelnes Stück Kuchen ohne Vorlauf — das liegt in der Theke', () => {
      expect(
        leadTimeRuleFor({ id: 'kaesekuchen-1-stueck', category: 'kuchen' })
          .hours
      ).toBe(0)
      // Der 2-€-Artikel in der Kategorie "torten" ist ebenfalls Thekenware.
      expect(
        leadTimeRuleFor({ id: 'sahnerollen-1-stueck', category: 'torten' })
          .hours
      ).toBe(0)
    })

    it('lässt Brot und Brötchen unangetastet', () => {
      expect(
        leadTimeRuleFor({ id: 'kornbrot-500g', category: 'brot' }).hours
      ).toBe(0)
      expect(
        leadTimeRuleFor({ id: 'sternweck', category: 'broetchen' }).hours
      ).toBe(0)
    })

    it('fällt bei unbekannter Kategorie oder fehlender ID auf 0 zurück', () => {
      expect(
        leadTimeRuleFor({ id: 'irgendwas', category: 'faelscht' }).hours
      ).toBe(0)
      expect(
        leadTimeRuleFor({ id: undefined as unknown as string }).hours
      ).toBe(0)
    })
  })

  describe('leadTimeRuleForItems', () => {
    it('nimmt den längsten Vorlauf im Warenkorb', () => {
      const rule = leadTimeRuleForItems([
        { id: 'kornbrot-500g', category: 'brot' },
        { id: 'kaesekuchen', category: 'kuchen' },
        { id: 'buttercreme-torte', category: 'torten' },
      ])
      // Ein Brötchen daneben macht die Torte nicht schneller.
      expect(rule.hours).toBe(48)
    })

    it('ist bei einem reinen Thekenwarenkorb ohne Vorlauf', () => {
      expect(
        leadTimeRuleForItems([
          { id: 'kornbrot-500g', category: 'brot' },
          { id: 'kaesekuchen-1-stueck', category: 'kuchen' },
        ]).hours
      ).toBe(0)
    })

    it('verträgt einen leeren Warenkorb', () => {
      expect(leadTimeRuleForItems([]).hours).toBe(0)
    })
  })

  describe('earliestPickupIsoDate', () => {
    // Mittwoch, 2026-09-02, 15:00 Uhr.
    const now = new Date(2026, 8, 2, 15, 0)

    it('erlaubt Thekenware noch am selben Tag', () => {
      expect(
        earliestPickupIsoDate([{ id: 'kornbrot-500g', category: 'brot' }], now)
      ).toBe('2026-09-02')
    })

    it('schiebt einen ganzen Kuchen auf den Folgetag', () => {
      expect(
        earliestPickupIsoDate([{ id: 'kaesekuchen', category: 'kuchen' }], now)
      ).toBe('2026-09-03')
    })

    it('schiebt eine ganze Torte auf übermorgen', () => {
      expect(
        earliestPickupIsoDate(
          [{ id: 'buttercreme-torte', category: 'torten' }],
          now
        )
      ).toBe('2026-09-04')
    })

    it('rechnet über einen Monatswechsel hinweg richtig', () => {
      const silvester = new Date(2026, 8, 30, 9, 0) // 30.09.2026
      expect(
        earliestPickupIsoDate(
          [{ id: 'buttercreme-torte', category: 'torten' }],
          silvester
        )
      ).toBe('2026-10-02')
    })
  })
})
