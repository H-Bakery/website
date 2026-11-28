import {
  aendereEinrichtung,
  aendereImText,
  leereEinrichtung,
  leseEinrichtung,
  pruefeEinrichtung,
  schreibeEinrichtung,
  wendeAn,
} from './einrichtung'

// Alles erfunden: Plätze eines Testregals, Produkte wie „testbrot“.
const DATEI = `# Kopf der Datei

raeume:
  laden:
    # das Brot nach vorn
    testregal/ebene-1/platz-01:
      produkt: testbrot-500g
      anzahl: 2
    testregal/ebene-1/platz-02: leer # heute nichts
`

const MODELL = {
  slots: [
    { slot: 'testregal/ebene-1/platz-01', produkt: 'testweck', anzahl: 6 },
    { slot: 'testregal/ebene-1/platz-02', produkt: 'testbrezel', anzahl: 1 },
    { slot: 'testregal/ebene-1/platz-03', produkt: 'testkuchen' },
  ],
}
const O = {
  raum: 'laden',
  // platz-04 trägt im Modell neutrale Ware.
  bekannt: MODELL.slots.map((s) => s.slot).concat('testregal/ebene-1/platz-04'),
  produkte: ['testbrot-500g', 'testweck', 'testbrezel', 'testkuchen'],
}

describe('einrichtung.yaml lesen', () => {
  it('liest Räume, Plätze, Produkt mit Anzahl und „leer“', () => {
    expect(leseEinrichtung(DATEI)).toEqual({
      raeume: {
        laden: {
          'testregal/ebene-1/platz-01': { produkt: 'testbrot-500g', anzahl: 2 },
          'testregal/ebene-1/platz-02': 'leer',
        },
      },
    })
  })

  it('eine leere Datei, nur Kommentare oder ein Raum ohne Plätze: nichts eingerichtet', () => {
    expect(leseEinrichtung('')).toEqual(leereEinrichtung())
    expect(leseEinrichtung('# nur ein Kommentar\n')).toEqual({ raeume: {} })
    expect(leseEinrichtung('raeume:\n  laden:\n')).toEqual({
      raeume: { laden: {} },
    })
    expect(leseEinrichtung('raeume: {}\n')).toEqual({ raeume: {} })
  })

  it.each([
    ['kein YAML', 'raeume: [', /kein gültiges YAML/],
    ['eine Liste statt eines Objekts', '- a\n', /kein Objekt/],
    ['fremdes Feld oben', 'version: 1\n', /unbekanntes Feld "version"/],
    ['raeume ist kein Objekt', 'raeume: 3\n', /raeume muss ein Objekt/],
    ['Raum ist keine ID', 'raeume:\n  Mein Laden: {}\n', /keine Raum-ID/],
    [
      'Platz ist keine ID',
      'raeume:\n  laden:\n    "Regal 1": leer\n',
      /kein Platz/,
    ],
    [
      'Platz doppelt',
      'raeume:\n  laden:\n    a/b: leer\n    a/b: leer\n',
      /Zeile 4\) - der Platz "a\/b" steht doppelt \(Raum laden\)/,
    ],
    [
      'Raum doppelt',
      'raeume:\n  laden:\n    a/b: leer\n  laden:\n    c/d: leer\n',
      /der Raum "laden" steht doppelt/,
    ],
    [
      'Feld eines Eintrags doppelt',
      'raeume:\n  laden:\n    a/b:\n      produkt: x\n      anzahl: 1\n      anzahl: 2\n',
      /das Feld "anzahl" steht doppelt \(Raum laden, a\/b\)/,
    ],
    [
      'raeume doppelt',
      'raeume: {}\nraeume: {}\n',
      /das Feld "raeume" steht doppelt/,
    ],
    [
      'weder leer noch Produkt',
      'raeume:\n  laden:\n    a/b: voll\n',
      /erwartet „leer“ oder ein Produkt/,
    ],
    [
      'Produkt ohne Anzahl',
      'raeume:\n  laden:\n    a/b:\n      produkt: testbrot\n',
      /anzahl muss eine ganze Zahl/,
    ],
    [
      'Anzahl 0',
      'raeume:\n  laden:\n    a/b:\n      produkt: testbrot\n      anzahl: 0\n',
      /anzahl/,
    ],
    [
      'Anzahl mit Komma',
      'raeume:\n  laden:\n    a/b:\n      produkt: testbrot\n      anzahl: 1.5\n',
      /anzahl/,
    ],
    [
      'Produkt mit Nummer und Großbuchstaben',
      'raeume:\n  laden:\n    a/b:\n      produkt: 1-Testbrot\n      anzahl: 1\n',
      /keine Produkt-ID/,
    ],
    [
      'ein Preis',
      'raeume:\n  laden:\n    a/b:\n      produkt: testbrot\n      anzahl: 1\n      preis: 3\n',
      /unbekanntes Feld "preis"/,
    ],
  ])('lehnt ab: %s', (_name, text, meldung) => {
    expect(() => leseEinrichtung(text)).toThrow(meldung)
  })

  it('die Meldung nennt Datei, Raum und Platz', () => {
    expect(() =>
      leseEinrichtung(
        'raeume:\n  laden:\n    a/b: voll\n',
        'hq/einrichtung.yaml'
      )
    ).toThrow('hq/einrichtung.yaml: Raum laden, a/b:')
  })

  it('pruefeEinrichtung: null ist eine leere Einrichtung', () => {
    expect(pruefeEinrichtung(null)).toEqual({ raeume: {} })
  })
})

describe('Einrichtung über die Belegung des Modells legen', () => {
  const laden = leseEinrichtung(DATEI).raeume.laden

  it('ohne Einrichtung bleibt die Belegung des Modells - dieselben Einträge', () => {
    const r = wendeAn(MODELL, undefined, O)
    expect(r.slots).toEqual(MODELL.slots)
    expect(r.slots[0]).toBe(MODELL.slots[0])
    expect(r.leer).toEqual([])
    expect(r.geaendert).toBe(0)
  })

  it('ersetzt genannte Plätze, leert „leer“, lässt die anderen wie im Modell', () => {
    const r = wendeAn(MODELL, laden, O)
    expect(r.slots).toEqual([
      {
        slot: 'testregal/ebene-1/platz-01',
        produkt: 'testbrot-500g',
        anzahl: 2,
        quelle: 'einrichtung',
      },
      { slot: 'testregal/ebene-1/platz-03', produkt: 'testkuchen' },
    ])
    expect(r.leer).toEqual(['testregal/ebene-1/platz-02'])
    expect(r.geaendert).toBe(2)
  })

  it('ein Platz mit neutraler Ware bekommt ein Produkt - hinter den Plätzen des Modells', () => {
    const r = wendeAn(
      MODELL,
      { 'testregal/ebene-1/platz-04': { produkt: 'testweck', anzahl: 3 } },
      O
    )
    expect(r.slots.map((s) => s.slot)).toEqual([
      'testregal/ebene-1/platz-01',
      'testregal/ebene-1/platz-02',
      'testregal/ebene-1/platz-03',
      'testregal/ebene-1/platz-04',
    ])
    expect(r.slots[3]).toEqual({
      slot: 'testregal/ebene-1/platz-04',
      produkt: 'testweck',
      anzahl: 3,
      quelle: 'einrichtung',
    })
  })

  it('neutrale Ware lässt sich leeren', () => {
    const r = wendeAn(MODELL, { 'testregal/ebene-1/platz-04': 'leer' }, O)
    expect(r.slots).toEqual(MODELL.slots)
    expect(r.leer).toEqual(['testregal/ebene-1/platz-04'])
  })

  it('ein unbekannter Platz bricht ab - die Meldung nennt Raum und Platz', () => {
    expect(() =>
      wendeAn(MODELL, { 'testregal/ebene-9/platz-01': 'leer' }, O)
    ).toThrow(
      'einrichtung.yaml: Raum laden: den Platz "testregal/ebene-9/platz-01" gibt es im Modell nicht. Nichts geschrieben.'
    )
  })

  it('ein unbekanntes Produkt bricht ab - die Meldung nennt Produkt und Platz', () => {
    expect(() =>
      wendeAn(
        MODELL,
        { 'testregal/ebene-1/platz-01': { produkt: 'gibtsnicht', anzahl: 1 } },
        O
      )
    ).toThrow(
      /das Produkt "gibtsnicht" auf Platz "testregal\/ebene-1\/platz-01" gibt es in hq nicht/
    )
  })

  it('nennt alle Fehler auf einmal', () => {
    expect(() =>
      wendeAn(
        MODELL,
        {
          'x/y': 'leer',
          'testregal/ebene-1/platz-01': { produkt: 'gibtsnicht', anzahl: 1 },
        },
        O
      )
    ).toThrow(/"x\/y".*; das Produkt "gibtsnicht"/)
  })
})

describe('einrichtung.yaml schreiben (Einrichten-Modus)', () => {
  it('ohne Änderung kommt der Text Zeichen für Zeichen zurück', () => {
    expect(aendereEinrichtung(DATEI, {})).toBe(DATEI)
    // Auch eine „Änderung“, die nichts ändert.
    expect(
      aendereEinrichtung(DATEI, {
        laden: {
          'testregal/ebene-1/platz-01': { produkt: 'testbrot-500g', anzahl: 2 },
          'testregal/ebene-1/platz-02': 'leer',
          'testregal/ebene-1/platz-03': null,
        },
      })
    ).toBe(DATEI)
    // Selbst eine eigenwillig formatierte Datei bleibt unangetastet.
    const eigen = 'raeume:   {laden: {a/b:   leer}}   # eng\n'
    expect(aendereEinrichtung(eigen, { laden: { 'a/b': 'leer' } })).toBe(eigen)
  })

  it('eine Änderung fasst nur ihren Platz an: Kommentare und Reihenfolge bleiben', () => {
    const neu = aendereEinrichtung(DATEI, {
      laden: {
        'testregal/ebene-1/platz-01': { produkt: 'testbrot-500g', anzahl: 3 },
      },
    })
    expect(neu).toBe(DATEI.replace('anzahl: 2', 'anzahl: 3'))
    // Auch eigenwillige Abstände in anderen Zeilen bleiben, wie sie sind.
    const weit = DATEI.replace('leer # heute', 'leer     # heute')
    expect(
      aendereEinrichtung(weit, {
        laden: {
          'testregal/ebene-1/platz-01': { produkt: 'testbrot-500g', anzahl: 3 },
        },
      })
    ).toBe(weit.replace('anzahl: 2', 'anzahl: 3'))
  })

  describe('von Hand gepflegte Datei: jede andere Zeile bleibt Byte für Byte', () => {
    // Kommentare im Eintrag, lange und eingerückte Kommentare, Leerzeilen,
    // Abstände vor Kommentaren - alles, was ein Mensch so schreibt.
    const HAND = [
      '# Einrichtung - gepflegt von Hand. Diese Zeile ist absichtlich sehr lang, länger als achtzig Zeichen, damit ein Umbruch auffiele.',
      '',
      'raeume:',
      '  laden:',
      '',
      '    # erstes Fach',
      '    a/platz-01:   # der Chef will es so',
      '      produkt: testbrot-500g   # das Helle',
      '      # mittwochs nur eins',
      '      anzahl: 2',
      '',
      '    a/platz-02: leer      # montags',
      '',
      '        # ein eingerückter Kommentar mitten in der Datei',
      '    a/platz-03:',
      '      produkt: testweck',
      '      anzahl: 12',
      '',
      '# Fuß',
      '',
    ].join('\n')
    const zeilen = (text: string) => text.split(/\r?\n/)

    it('Stückzahl ändern: nur diese eine Zahl - Kommentare im und am Eintrag bleiben', () => {
      const neu = aendereEinrichtung(HAND, {
        laden: { 'a/platz-01': { produkt: 'testbrot-500g', anzahl: 5 } },
      })
      expect(neu).toBe(HAND.replace('      anzahl: 2', '      anzahl: 5'))
      expect(neu).toContain('produkt: testbrot-500g   # das Helle')
      expect(neu).toContain('      # mittwochs nur eins')
    })

    it('Produkt und Stückzahl ändern: nur diese beiden Werte', () => {
      const neu = aendereEinrichtung(HAND, {
        laden: { 'a/platz-01': { produkt: 'testkuchen', anzahl: 1 } },
      })
      expect(neu).toBe(
        HAND.replace(
          'produkt: testbrot-500g   # das Helle',
          'produkt: testkuchen   # das Helle'
        ).replace('      anzahl: 2', '      anzahl: 1')
      )
    })

    it('ändern und zurückändern ergibt wieder genau die Datei', () => {
      const hin = aendereEinrichtung(HAND, {
        laden: { 'a/platz-01': { produkt: 'testkuchen', anzahl: 9 } },
      })
      expect(hin).not.toBe(HAND)
      expect(
        aendereEinrichtung(hin, {
          laden: { 'a/platz-01': { produkt: 'testbrot-500g', anzahl: 2 } },
        })
      ).toBe(HAND)
    })

    it('leer → Produkt und zurück: der Kommentar am Zeilenende bleibt, alle anderen Zeilen auch', () => {
      const hin = aendereEinrichtung(HAND, {
        laden: { 'a/platz-02': { produkt: 'testweck', anzahl: 3 } },
      })
      expect(hin).toBe(
        HAND.replace(
          '    a/platz-02: leer      # montags',
          '    a/platz-02:\n      produkt: testweck\n      anzahl: 3      # montags'
        )
      )
      expect(aendereEinrichtung(hin, { laden: { 'a/platz-02': 'leer' } })).toBe(
        HAND
      )
    })

    it('Produkt → leer: der Eintrag wird ein Wort; seine inneren Kommentare gehen mit den Zeilen', () => {
      const neu = aendereEinrichtung(HAND, { laden: { 'a/platz-01': 'leer' } })
      expect(neu).toBe(
        HAND.replace(
          [
            '    a/platz-01:   # der Chef will es so',
            '      produkt: testbrot-500g   # das Helle',
            '      # mittwochs nur eins',
            '      anzahl: 2',
          ].join('\n'),
          '    a/platz-01: leer'
        )
      )
    })

    it('den ersten Eintrag entfernen: samt seinem Kommentar darüber, ohne leere Zeile voller Leerzeichen', () => {
      const neu = aendereEinrichtung(HAND, { laden: { 'a/platz-01': null } })
      expect(neu).toBe(
        HAND.replace(
          [
            '    # erstes Fach',
            '    a/platz-01:   # der Chef will es so',
            '      produkt: testbrot-500g   # das Helle',
            '      # mittwochs nur eins',
            '      anzahl: 2',
            '',
          ].join('\n'),
          ''
        )
      )
      expect(zeilen(neu).filter((z) => z !== '' && z.trim() === '')).toEqual([])
      expect(leseEinrichtung(neu).raeume.laden).not.toHaveProperty('a/platz-01')
    })

    it('einen mittleren und den letzten Eintrag entfernen: die übrigen Zeilen bleiben', () => {
      const neu = aendereEinrichtung(HAND, {
        laden: { 'a/platz-02': null, 'a/platz-03': null },
      })
      expect(Object.keys(leseEinrichtung(neu).raeume.laden)).toEqual([
        'a/platz-01',
      ])
      for (const zeile of [
        '# Einrichtung - gepflegt von Hand. Diese Zeile ist absichtlich sehr lang, länger als achtzig Zeichen, damit ein Umbruch auffiele.',
        '    # erstes Fach',
        '    a/platz-01:   # der Chef will es so',
        '      # mittwochs nur eins',
        '# Fuß',
      ]) {
        expect(zeilen(neu)).toContain(zeile)
      }
    })

    it('ein neuer Eintrag: einsortiert, im Einzug der Datei - sonst ändert sich keine Zeile', () => {
      const neu = aendereEinrichtung(HAND, {
        laden: {
          'a/platz-00': 'leer',
          'a/platz-025': { produkt: 'testkuchen', anzahl: 1 },
          'z/platz-01': 'leer',
        },
      })
      expect(Object.keys(leseEinrichtung(neu).raeume.laden)).toEqual([
        'a/platz-00',
        'a/platz-01',
        'a/platz-02',
        'a/platz-025',
        'a/platz-03',
        'z/platz-01',
      ])
      // Alle alten Zeilen stehen noch da, in derselben Reihenfolge.
      const neuZeilen = zeilen(neu)
      let ab = 0
      for (const zeile of zeilen(HAND)) {
        const at = neuZeilen.indexOf(zeile, ab)
        expect(at).toBeGreaterThanOrEqual(ab)
        ab = at + 1
      }
      expect(neu).toContain(
        '    a/platz-025:\n      produkt: testkuchen\n      anzahl: 1\n'
      )
      // Der neue Eintrag steht vor dem Kommentar des nächsten, nicht dazwischen.
      expect(neu).toContain('    a/platz-00: leer\n    # erstes Fach\n')
    })

    it('mehrere Änderungen auf einmal sind dasselbe wie nacheinander', () => {
      const a = { 'a/platz-01': { produkt: 'testbrot-500g', anzahl: 4 } }
      const b = { 'a/platz-02': null }
      const c = { 'b/platz-01': 'leer' as const }
      const aufEinmal = aendereEinrichtung(HAND, {
        laden: { ...a, ...b, ...c },
      })
      const nacheinander = [a, b, c].reduce<string>(
        (text, laden) => aendereEinrichtung(text, { laden }),
        HAND
      )
      expect(aufEinmal).toBe(nacheinander)
    })

    it('Zeilenenden bleiben: eine Datei mit CRLF behält CRLF - auch in neuen Zeilen', () => {
      const crlf = HAND.replace(/\n/g, '\r\n')
      const neu = aendereEinrichtung(crlf, {
        laden: {
          'a/platz-01': { produkt: 'testbrot-500g', anzahl: 5 },
          'a/platz-02': { produkt: 'testweck', anzahl: 3 },
          'a/platz-04': 'leer',
        },
      })
      expect(neu.replace(/\r\n/g, '')).not.toContain('\n')
      expect(neu).toContain('      anzahl: 5\r\n')
      expect(neu).toContain('    a/platz-04: leer\r\n')
      expect(leseEinrichtung(neu).raeume.laden['a/platz-02']).toEqual({
        produkt: 'testweck',
        anzahl: 3,
      })
      // … und ändern + zurückändern ergibt wieder genau die Datei.
      const hin = aendereEinrichtung(crlf, {
        laden: { 'a/platz-01': { produkt: 'testbrot-500g', anzahl: 5 } },
      })
      expect(
        aendereEinrichtung(hin, {
          laden: { 'a/platz-01': { produkt: 'testbrot-500g', anzahl: 2 } },
        })
      ).toBe(crlf)
    })

    it('eine Datei ohne Zeilenende am Schluss bekommt den neuen Eintrag auf eine eigene Zeile', () => {
      const ohne = 'raeume:\n  laden:\n    a/b: leer'
      expect(aendereEinrichtung(ohne, { laden: { 'c/d': 'leer' } })).toBe(
        'raeume:\n  laden:\n    a/b: leer\n    c/d: leer\n'
      )
    })

    it('unsortierte Plätze: ein neuer kommt ans Ende des Raums', () => {
      const unsortiert =
        'raeume:\n  laden:\n    z/1: leer\n    a/1: leer\n  lager:\n    b/1: leer\n'
      expect(aendereEinrichtung(unsortiert, { laden: { 'm/1': 'leer' } })).toBe(
        'raeume:\n  laden:\n    z/1: leer\n    a/1: leer\n    m/1: leer\n  lager:\n    b/1: leer\n'
      )
    })
  })

  describe('ungewöhnlich gebaute Datei: über das YAML-Dokument neu geschrieben', () => {
    it('aendereImText gibt dann auf', () => {
      const leer: [string, string, 'leer'][] = [['laden', 'c/d', 'leer']]
      // Fluss-Schreibweise, neuer Raum, leere Datei, uneinheitlicher Einzug
      expect(aendereImText('raeume: {laden: {a/b: leer}}\n', leer)).toBeNull()
      expect(
        aendereImText('raeume:\n  lager:\n    a/b: leer\n', leer)
      ).toBeNull()
      expect(aendereImText('', leer)).toBeNull()
      expect(
        aendereImText(
          'raeume:\n  laden:\n    a/b: leer\n    ? x/y\n    : leer\n',
          leer
        )
      ).toBeNull()
      // der Raum verlöre seinen letzten Platz
      expect(
        aendereImText('raeume:\n  laden:\n    a/b: leer\n', [
          ['laden', 'a/b', null],
        ])
      ).toBeNull()
    })

    it('Inhalt, Reihenfolge und Kommentare bleiben - auch die im geänderten Eintrag', () => {
      const fluss =
        '# Kopf\nraeume:\n  laden:\n    a/b:\n      produkt: testweck # frisch\n      anzahl: 2\n  lager: {c/d: leer} # eng\n'
      const neu = aendereEinrichtung(fluss, {
        laden: { 'a/b': { produkt: 'testweck', anzahl: 3 } },
        lager: { 'e/f': 'leer' },
      })
      expect(neu).toContain('# Kopf')
      expect(neu).toContain('produkt: testweck # frisch')
      expect(leseEinrichtung(neu)).toEqual({
        raeume: {
          laden: { 'a/b': { produkt: 'testweck', anzahl: 3 } },
          lager: { 'c/d': 'leer', 'e/f': 'leer' },
        },
      })
    })
  })

  it('ein neuer Platz steht nach Name einsortiert, ein entfernter verschwindet', () => {
    const neu = aendereEinrichtung(DATEI, {
      laden: {
        'testregal/ebene-0/platz-09': 'leer',
        'testregal/ebene-1/platz-02': null,
      },
    })
    expect(neu).toContain('# Kopf der Datei')
    expect(neu).toContain('# das Brot nach vorn')
    expect(Object.keys(leseEinrichtung(neu).raeume.laden)).toEqual([
      'testregal/ebene-0/platz-09',
      'testregal/ebene-1/platz-01',
    ])
  })

  it('legt eine neue Datei mit Kopf an und einen neuen Raum dazu', () => {
    const neu = aendereEinrichtung('', {
      laden: { 'a/b': { produkt: 'testweck', anzahl: 4 } },
    })
    expect(neu).toMatch(/^# Einrichtung der Digitalen Bäckerei/)
    expect(neu).toContain(
      'raeume:\n  laden:\n    a/b:\n      produkt: testweck\n      anzahl: 4\n'
    )
    const zwei = aendereEinrichtung(neu, { lager: { 'c/d': 'leer' } })
    expect(leseEinrichtung(zwei)).toEqual({
      raeume: {
        laden: { 'a/b': { produkt: 'testweck', anzahl: 4 } },
        lager: { 'c/d': 'leer' },
      },
    })
  })

  it('ein Raum ohne Plätze bleibt nicht als leere Hülle stehen', () => {
    const neu = aendereEinrichtung(DATEI, {
      laden: {
        'testregal/ebene-1/platz-01': null,
        'testregal/ebene-1/platz-02': null,
      },
    })
    expect(leseEinrichtung(neu)).toEqual({ raeume: {} })
    expect(neu).toContain('# Kopf der Datei')
  })

  it('Rundlauf: schreiben → lesen → schreiben ergibt dieselbe Datei', () => {
    const einrichtung = leseEinrichtung(DATEI)
    const einmal = schreibeEinrichtung(einrichtung)
    expect(leseEinrichtung(einmal)).toEqual(einrichtung)
    expect(schreibeEinrichtung(leseEinrichtung(einmal))).toBe(einmal)
    // … und was das Werkzeug schreibt, ändert es ohne Änderung nicht.
    expect(aendereEinrichtung(einmal, {})).toBe(einmal)
  })

  it('lehnt eine Änderung außerhalb des Vertrags ab', () => {
    expect(() =>
      aendereEinrichtung('', {
        // @ts-expect-error Anzahl fehlt
        laden: { 'a/b': { produkt: 'testweck' } },
      })
    ).toThrow(/anzahl/)
    expect(() => aendereEinrichtung('', { laden: { 'A B': 'leer' } })).toThrow(
      /kein Platz/
    )
  })
})
