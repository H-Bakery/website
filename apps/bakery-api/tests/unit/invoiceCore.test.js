'use strict'

/**
 * `invoice.core.js` - Beträge, Umsatzsteuer, Pflichtangaben und die
 * Factur-X-XML. Nur synthetische Daten (tests/fixtures/invoice.synthetic.js).
 *
 * Die XML wird gegen das offizielle XSD des Profils EN 16931 geprüft
 * (`xmllint`, tests/fixtures/facturx-en16931). Fehlt `xmllint`, wird dieser
 * eine Test übersprungen - außer mit `REQUIRE_XMLLINT=1` (CI), dann ist das
 * ein Fehler.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const core = require('../../src/services/invoice.core')
const fixture = require('../fixtures/invoice.synthetic')

const XSD = path.join(
  __dirname,
  '../fixtures/facturx-en16931/Factur-X_EN16931.xsd'
)
const GOLDEN = path.join(__dirname, '../fixtures/invoice-golden.xml')

const line = (quantity, unitPriceGrossCents, vatRate = 7) => ({
  name: 'Testartikel',
  unit: 'Stück',
  quantity,
  unitPriceGrossCents,
  vatRate,
})

describe('Geld und Eingaben', () => {
  it('rundet kaufmännisch mit ganzen Zahlen', () => {
    expect(core.divRound(5, 10)).toBe(1)
    expect(core.divRound(4, 10)).toBe(0)
    expect(core.divRound(15, 10)).toBe(2)
    expect(core.divRound(0, 7)).toBe(0)
    expect(() => core.divRound(-1, 2)).toThrow(RangeError)
    expect(() => core.divRound(1.5, 2)).toThrow(RangeError)
  })

  it('liest Euro-Eingaben als Cent, ohne Gleitkomma-Reste zu reparieren', () => {
    expect(core.toCents('12,34')).toBe(1234)
    expect(core.toCents('12.3')).toBe(1230)
    expect(core.toCents(0.95)).toBe(95)
    expect(core.toCents(33.33)).toBe(3333)
    expect(core.toCents('0')).toBe(0)
    expect(core.toCents('')).toBeNull()
    expect(core.toCents('1,234')).toBeNull()
    expect(core.toCents(1.1 * 3)).toBeNull()
    expect(core.toCents(-1)).toBeNull()
    expect(core.toCents('abc')).toBeNull()
  })

  it('liest Mengen mit bis zu drei Nachkommastellen', () => {
    expect(core.toMilli('1,25')).toBe(1250)
    expect(core.toMilli(120)).toBe(120000)
    expect(core.toMilli('0.001')).toBe(1)
    expect(core.toMilli(0)).toBeNull()
    expect(core.toMilli('1.2345')).toBeNull()
    expect(core.toMilli(-2)).toBeNull()
  })

  it('formatiert für Anzeige und XML', () => {
    expect(core.formatEuro(123456)).toBe('1.234,56 €')
    expect(core.formatEuro(5)).toBe('0,05 €')
    expect(core.formatEuro(-1)).toBe('−0,01 €')
    expect(core.centsToDecimal(1234)).toBe('12.34')
    expect(core.centsToDecimal(-1)).toBe('-0.01')
    expect(core.milliToDecimal(2500)).toBe('2.5')
    expect(core.formatQuantity('1.250')).toBe('1,25')
    expect(core.formatDate('2026-11-15')).toBe('15.11.2026')
    expect(core.addDays('2026-11-15', 14)).toBe('2026-11-29')
    expect(core.addDays('2026-12-25', 14)).toBe('2027-01-08')
    expect(core.isIsoDate('2026-02-30')).toBe(false)
  })

  it('ordnet Einheiten den UN/ECE-Codes zu', () => {
    expect(core.unitCode('Stück')).toBe('H87')
    expect(core.unitCode('kg')).toBe('KGM')
    expect(core.unitCode('')).toBe('H87')
    expect(core.unitCode('Kiste')).toBe('C62')
  })

  it('prüft IBAN (Prüfziffer) und BIC', () => {
    expect(core.isValidIban('DE02 1203 0000 0000 2020 51')).toBe(true)
    expect(core.isValidIban('DE02120300000000202052')).toBe(false)
    expect(core.isValidIban('DE0212030000000020205')).toBe(false)
    expect(core.isValidIban('')).toBe(false)
    expect(core.formatIban('de02120300000000202051')).toBe(
      'DE02 1203 0000 0000 2020 51'
    )
    expect(core.isValidBic('BYLADEM1001')).toBe(true)
    expect(core.isValidBic('BYLADEM1')).toBe(true)
    expect(core.isValidBic('nope')).toBe(false)
  })
})

describe('Von Bruttopreisen zur Netto-Rechnung', () => {
  it('hat 7 % als Vorgabe und lässt 19 % zu', () => {
    expect(core.DEFAULT_VAT_RATE).toBe(7)
    expect(core.VAT_RATES).toEqual([7, 19])
  })

  it('rechnet eine einfache Rechnung: Summe = Brutto, USt = Netto × Satz', () => {
    const result = core.computeInvoice([line(10, 107)])
    expect(result.totals).toEqual({
      netCents: 1000,
      vatCents: 70,
      grandTotalCents: 1070,
      roundingCents: 0,
      dueCents: 1070,
      grossCents: 1070,
    })
    expect(result.lines[0].netUnitPrice).toBe('1.0000')
    expect(result.lines[0].netBasisQuantity).toBe('1')
    expect(core.checkBusinessRules(result)).toEqual([])
  })

  it('rundet je Steuersatz, nicht je Position (kein Cent-Drift)', () => {
    // 3 × 0,99 € brutto: je Position gerundet wären es 3 × 0,93 = 2,79 netto
    // + 0,20 USt = 2,99. Aus der Summe gerechnet: 2,97 brutto bleibt 2,97.
    const result = core.computeInvoice([line(1, 99), line(1, 99), line(1, 99)])
    expect(result.totals.dueCents).toBe(297)
    expect(result.totals.netCents + result.totals.vatCents).toBe(297)
    expect(result.vat).toEqual([
      {
        rate: 7,
        netCents: 278,
        vatCents: 19,
        grossCents: 297,
        roundingCents: 0,
      },
    ])
    // Größte Reste: die Cent gehen an die früheren Positionen
    expect(result.lines.map((l) => l.netCents)).toEqual([93, 93, 92])
    expect(core.checkBusinessRules(result)).toEqual([])
  })

  it('trennt die Steuersätze und summiert sie', () => {
    const result = core.computeInvoice(fixture.mixedInvoice().lines)
    expect(result.vat).toEqual([
      {
        rate: 7,
        netCents: 21507,
        vatCents: 1505,
        grossCents: 23012,
        roundingCents: 0,
      },
      {
        rate: 19,
        netCents: 1171,
        vatCents: 222,
        grossCents: 1393,
        roundingCents: 0,
      },
    ])
    expect(result.totals.dueCents).toBe(24405)
    expect(result.totals.netCents).toBe(22678)
    expect(result.totals.vatCents).toBe(1727)
    expect(core.checkBusinessRules(result)).toEqual([])
  })

  it('weist nicht darstellbare Bruttobeträge als Rundung (BT-114) aus', () => {
    // 4,81 € bei 7 %: 4,49 netto -> 4,80; 4,50 netto -> 4,82. Kein Netto ergibt 4,81.
    const result = core.computeInvoice([line(1, 481)])
    expect(result.vat[0]).toEqual({
      rate: 7,
      netCents: 450,
      vatCents: 32,
      grossCents: 481,
      roundingCents: -1,
    })
    expect(result.totals.grandTotalCents).toBe(482)
    expect(result.totals.roundingCents).toBe(-1)
    expect(result.totals.dueCents).toBe(481)
    expect(core.checkBusinessRules(result)).toEqual([])
  })

  it.each([7, 19])(
    'hält die BR-CO-Regeln für jeden Bruttobetrag bis 300 € (%i %%)',
    (rate) => {
      let rounded = 0
      for (let gross = 1; gross <= 30000; gross += 1) {
        const result = core.computeInvoice([line(1, gross, rate)])
        const { netCents, vatCents } = result.vat[0]
        expect(result.totals.dueCents).toBe(gross)
        if (core.checkBusinessRules(result).length > 0) {
          throw new Error(`Regel verletzt bei ${gross} Cent, ${rate} %`)
        }
        if (result.totals.roundingCents !== 0) {
          rounded += 1
          expect(Math.abs(result.totals.roundingCents)).toBe(1)
          // Wirklich nicht darstellbar: kein Netto in der Nähe trifft den Betrag.
          for (let net = netCents - 3; net <= netCents + 3; net += 1) {
            if (net >= 0 && net + core.divRound(net * rate, 100) === gross) {
              throw new Error(`${gross} Cent wäre mit ${net} darstellbar`)
            }
          }
        } else {
          expect(netCents + vatCents).toBe(gross)
        }
      }
      // 7 von 107 bzw. 19 von 119 Beträgen
      const expected = Math.round((30000 * rate) / (100 + rate))
      expect(Math.abs(rounded - expected)).toBeLessThanOrEqual(1)
    }
  )

  it('hält die Regeln für krumme Mengen, Preise und gemischte Sätze', () => {
    let seed = 20261115
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let i = 0; i < 4000; i += 1) {
      const lines = []
      const count = 1 + Math.floor(random() * 8)
      for (let j = 0; j < count; j += 1) {
        lines.push(
          line(
            random() < 0.2
              ? String((Math.floor(random() * 5000) + 1) / 1000)
              : 1 + Math.floor(random() * 400),
            Math.floor(random() * 2500),
            random() < 0.7 ? 7 : 19
          )
        )
      }
      const result = core.computeInvoice(lines)
      const failed = core.checkBusinessRules(result)
      if (failed.length > 0) {
        throw new Error(`${failed.join(',')} bei ${JSON.stringify(lines)}`)
      }
      expect(result.totals.dueCents).toBe(
        result.lines.reduce((sum, l) => sum + l.grossCents, 0)
      )
    }
  })

  it('weicht bei großen Mengen auf einen Preis je 10/100 Einheiten aus', () => {
    // 250 × 0,37 € = 92,50 € brutto -> 86,45 € netto; 0,3458 × 250 = 86,45
    const exact = core.computeInvoice([line(250, 37)])
    expect(core.checkBusinessRules(exact)).toEqual([])
    // 999 × 0,01 €: vier Nachkommastellen je Stück reichen nicht
    const coarse = core.computeInvoice([line(999, 1)])
    expect(coarse.lines[0].netCents).toBe(934)
    expect(coarse.lines[0].netBasisQuantity).not.toBe('1')
    expect(core.checkBusinessRules(coarse)).toEqual([])
  })

  it('lehnt ungültige Zahlen ab', () => {
    expect(() => core.computeInvoice([line(0, 100)])).toThrow(RangeError)
    expect(() => core.computeInvoice([line(1, 1.5)])).toThrow(RangeError)
    expect(() => core.computeInvoice([line(1, -5)])).toThrow(RangeError)
    expect(() => core.computeInvoice([line(1, 100, 5)])).toThrow(RangeError)
    expect(core.computeInvoice([]).totals.dueCents).toBe(0)
  })
})

describe('Pflichtangaben', () => {
  it('lässt eine vollständige Rechnung zu', () => {
    expect(core.validateForIssue(fixture.mixedInvoice())).toEqual([])
    expect(core.validateForIssue(fixture.roundingInvoice())).toEqual([])
  })

  it('nennt jede fehlende Angabe auf Deutsch', () => {
    const invoice = fixture.mixedInvoice()
    invoice.number = ''
    invoice.invoiceDate = null
    invoice.deliveryDate = ''
    invoice.buyer = { name: 'Nur Name', countryCode: 'DE' }
    const errors = core.validateForIssue(invoice)
    expect(errors.map((e) => e.field)).toEqual([
      'number',
      'invoiceDate',
      'deliveryDate',
      'buyer.street',
      'buyer.postcode',
      'buyer.city',
    ])
    for (const error of errors) expect(error.message).toMatch(/Bitte/)
  })

  it('verweigert das Ausstellen ohne Bankverbindung - ohne Platzhalter', () => {
    const invoice = fixture.mixedInvoice()
    invoice.seller.iban = ''
    invoice.seller.bic = ''
    const errors = core.validateForIssue(invoice)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('seller.bank')
    expect(errors[0].message).toContain('IBAN, BIC')
    expect(errors[0].message).toContain('nicht eingerichtet')

    invoice.seller.iban = 'DE02120300000000202052'
    invoice.seller.bic = 'BYLADEM1001'
    expect(core.validateForIssue(invoice)[0].message).toContain('Prüfziffer')
  })

  it('prüft Nummer, Positionen und Beträge', () => {
    expect(core.validateNumber('RE 2026/17')).toBeNull()
    expect(core.validateNumber('')).toMatch(/Rechnungsnummer/)
    expect(core.validateNumber('A<B')).toMatch(/unzulässige Zeichen/)
    expect(core.validateNumber('x'.repeat(41))).toMatch(/höchstens 40/)

    const invoice = fixture.mixedInvoice()
    invoice.lines = []
    expect(core.validateForIssue(invoice)[0].message).toBe(
      'Die Rechnung hat keine Positionen.'
    )
    invoice.lines = [{ ...line(1, 0) }]
    expect(core.validateForIssue(invoice)[0].message).toMatch(/größer als 0/)
    expect(
      core
        .validateLines([
          { name: '', quantity: 0, unitPriceGrossCents: 1.5, vatRate: 5 },
        ])
        .map((e) => e.field)
    ).toEqual([
      'lines[0].name',
      'lines[0].quantity',
      'lines[0].unitPriceGross',
      'lines[0].vatRate',
    ])
    invoice.lines = fixture.mixedInvoice().lines
    invoice.dueDate = '2026-11-01'
    expect(core.validateForIssue(invoice)[0].field).toBe('paymentTermDays')
  })

  it('formuliert die Zahlungsbedingung', () => {
    expect(core.paymentTermsText(fixture.mixedInvoice())).toBe(
      'Zahlbar per Überweisung bis 29.11.2026 ohne Abzug.'
    )
    expect(
      core.paymentTermsText({ paymentText: '', dueDate: '2026-11-29' })
    ).toBe('Zahlbar bis 29.11.2026 ohne Abzug.')
  })
})

describe('Nachbesserungen: Nummer, Plausibilität, bezahlt', () => {
  it('bildet die Vergleichsform einer Rechnungsnummer', () => {
    expect(core.numberKey('RE-7')).toBe('re-7')
    expect(core.numberKey('  re-7 ')).toBe('re-7')
    expect(core.numberKey('ＲＥ-７')).toBe('re-7')
    expect(core.numberKey('RE\u200b-7')).toBe('re -7')
    expect(core.numberKey('RE   2026 / 7')).toBe('re 2026 / 7')
    expect(core.numberKey('STRASSE')).toBe(core.numberKey('strasse'))
    expect(core.numberKey(null)).toBe('')
  })

  it('lehnt unsichtbare Zeichen in der Nummer ab, gewöhnliche Leerzeichen nicht', () => {
    expect(core.validateNumber('RE 2026/17')).toBeNull()
    for (const bad of [
      'RE\u200b7',
      'RE\u00a07',
      '\ufeffRE7',
      'RE\u202e7',
      'RE\n7',
    ]) {
      expect(core.validateNumber(bad)).toMatch(/unsichtbare Zeichen/)
    }
    expect(core.hasUnprintable('Müller & Söhne e. V.')).toBe(false)
    expect(core.hasUnprintable('Zeile\nzwei')).toBe(true)
  })

  it('liest gespeicherte Preise verzeihend, aber nie Bruchteile von Cent', () => {
    expect(core.priceToCents(0.1 + 0.2)).toBe(30)
    expect(core.priceToCents(12.9)).toBe(1290)
    expect(core.priceToCents('0.45')).toBe(45)
    expect(core.priceToCents(0.333)).toBeNull()
    expect(core.priceToCents(-1)).toBeNull()
    expect(core.priceToCents(NaN)).toBeNull()
  })

  it('kennt die ISO-Ländercodes', () => {
    expect(core.isCountryCode('DE')).toBe(true)
    expect(core.isCountryCode('FR')).toBe(true)
    expect(core.isCountryCode('XX')).toBe(false)
    expect(core.isCountryCode('de')).toBe(false)
    const invoice = fixture.mixedInvoice()
    invoice.buyer.countryCode = 'ZZ'
    expect(core.validateForIssue(invoice)[0].field).toBe('buyer.countryCode')
  })

  it('meldet zu große Positionen als Eingabefehler, ohne zu werfen', () => {
    const errors = core.validateLines([line(100000, 99999999)])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/zu groß/)
    expect(core.validateLines([line(1, 99999999)])).toEqual([])
    expect(core.validateLines([line('1.001', 99999999)])).toHaveLength(1)
  })

  it('prüft Daten nur mit „heute“ auf Plausibilität', () => {
    const invoice = fixture.mixedInvoice() // Rechnung und Leistung 15.11.2026
    expect(core.validateForIssue(invoice)).toEqual([])
    expect(core.validateForIssue(invoice, { today: '2026-11-13' })).toEqual([])
    expect(core.validateForIssue(invoice, { today: '2026-11-08' })).toEqual([])
    expect(
      core
        .validateForIssue(invoice, { today: '2026-11-07' })
        .map((e) => e.field)
    ).toEqual(['invoiceDate'])
    expect(
      core
        .validateForIssue(invoice, { today: '2027-11-17' })
        .map((e) => e.field)
    ).toEqual(['invoiceDate'])
    invoice.deliveryDate = '2026-12-20'
    expect(
      core.validateForIssue(invoice, { today: '2026-11-13' })[0].message
    ).toMatch(/31 Tage in der Zukunft/)
  })

  it('weist eine bezahlte Rechnung mit Zahlbetrag 0 aus - ohne Bankverbindung', () => {
    const invoice = fixture.paidInvoice()
    expect(core.validateForIssue(invoice, { today: '2026-11-15' })).toEqual([])
    const totals = core.computeInvoice(invoice.lines).totals
    expect(core.settlement(invoice, totals)).toEqual({
      prepaidCents: 481,
      payableCents: 0,
    })
    expect(core.settlement(fixture.roundingInvoice(), totals)).toEqual({
      prepaidCents: 0,
      payableCents: 481,
    })
    expect(core.paymentTermsText(invoice)).toBe(
      'Betrag bereits bezahlt am 15.11.2026 (bar).'
    )
    const xml = core.buildCiiXml(invoice)
    // BR-CO-16: 4,82 − 4,81 + (−0,01) = 0,00
    expect(xml).toContain(
      '<ram:RoundingAmount>-0.01</ram:RoundingAmount>' +
        '<ram:GrandTotalAmount>4.82</ram:GrandTotalAmount>' +
        '<ram:TotalPrepaidAmount>4.81</ram:TotalPrepaidAmount>' +
        '<ram:DuePayableAmount>0.00</ram:DuePayableAmount>'
    )
    expect(xml).toContain('<ram:TypeCode>10</ram:TypeCode>')
    expect(xml).not.toContain('IBANID')
    expect(xml).not.toContain('DueDateDateTime')
    expect(core.buildCiiXml({ ...invoice, paidMethod: 'karte' })).toContain(
      '<ram:TypeCode>48</ram:TypeCode>'
    )

    expect(
      core
        .validateForIssue({ ...invoice, paidOn: null, paidMethod: '' })
        .map((e) => e.field)
    ).toEqual(['paidOn', 'paidMethod'])
    expect(
      core.validateForIssue({ ...invoice, paidOn: '2026-11-16' })[0].message
    ).toMatch(/nach dem Rechnungsdatum/)
  })
})

describe('Factur-X-XML (CII, EN 16931)', () => {
  const xml = core.buildCiiXml(fixture.mixedInvoice())

  it('entspricht der Golden-Datei', () => {
    if (process.env.UPDATE_INVOICE_GOLDEN === '1') {
      fs.writeFileSync(GOLDEN, xml)
    }
    expect(xml).toBe(fs.readFileSync(GOLDEN, 'utf8'))
  })

  it('ist eine reine Funktion', () => {
    expect(core.buildCiiXml(fixture.mixedInvoice())).toBe(xml)
  })

  it('trägt Profil, Typ 380 und die Pflichtangaben', () => {
    expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>')
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
    expect(xml).toContain('<ram:ID>TEST-2026-0042</ram:ID>')
    expect(xml).toContain(
      '<udt:DateTimeString format="102">20261115</udt:DateTimeString>'
    )
    expect(xml).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>')
    expect(xml).toContain('<ram:IBANID>DE02120300000000202051</ram:IBANID>')
    expect(xml).toContain(
      '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>'
    )
    expect(xml).toContain('<ram:DuePayableAmount>244.05</ram:DuePayableAmount>')
    expect(xml).toContain(
      '<ram:TaxTotalAmount currencyID="EUR">17.27</ram:TaxTotalAmount>'
    )
    // c/o in Zeile 1, Straße in Zeile 2
    expect(xml).toContain(
      '<ram:LineOne>z. Hd. Max Muster</ram:LineOne><ram:LineTwo>Testgasse 7</ram:LineTwo>'
    )
    expect(xml).not.toContain('RoundingAmount')
  })

  it('maskiert Sonderzeichen', () => {
    expect(xml).toContain(
      '<ram:Name>Partybrezel groß &amp; belegt &lt;Käse&gt;</ram:Name>'
    )
    expect(core.escapeXml('a\u0001b "c"')).toBe('ab &quot;c&quot;')
  })

  it('schreibt den Rundungsbetrag nur, wenn es einen gibt', () => {
    const rounding = core.buildCiiXml(fixture.roundingInvoice())
    expect(rounding).toContain(
      '<ram:TaxTotalAmount currencyID="EUR">0.32</ram:TaxTotalAmount>' +
        '<ram:RoundingAmount>-0.01</ram:RoundingAmount>' +
        '<ram:GrandTotalAmount>4.82</ram:GrandTotalAmount>' +
        '<ram:DuePayableAmount>4.81</ram:DuePayableAmount>'
    )
  })

  const xmllint = spawnSync('xmllint', ['--version'])
  const hasXmllint = !xmllint.error
  const requireXmllint = process.env.REQUIRE_XMLLINT === '1'
  const xsdTest = hasXmllint || requireXmllint ? it : it.skip

  xsdTest('ist gültig gegen das offizielle XSD (xmllint)', () => {
    expect(hasXmllint).toBe(true)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-xsd-'))
    try {
      const samples = {
        gemischt: xml,
        rundung: core.buildCiiXml(fixture.roundingInvoice()),
        lang: core.buildCiiXml(fixture.longInvoice()),
        bezahlt: core.buildCiiXml(fixture.paidInvoice()),
        karte: core.buildCiiXml({
          ...fixture.mixedInvoice(),
          paid: true,
          paidOn: '2026-11-14',
          paidMethod: 'karte',
        }),
        notiz: core.buildCiiXml({
          ...fixture.mixedInvoice(),
          note: 'Vielen Dank für Ihre Bestellung.',
          seller: { ...fixture.SELLER, taxNumber: '040/123/45678' },
        }),
      }
      for (const [name, content] of Object.entries(samples)) {
        const file = path.join(dir, `${name}.xml`)
        fs.writeFileSync(file, content)
        const result = spawnSync(
          'xmllint',
          ['--noout', '--schema', XSD, file],
          {
            encoding: 'utf8',
          }
        )
        if (result.status !== 0) {
          throw new Error(`${name}: ${result.stderr}`)
        }
      }
      // Gegenprobe: das Schema greift wirklich
      const broken = path.join(dir, 'kaputt.xml')
      fs.writeFileSync(
        broken,
        xml.replace('<ram:TypeCode>380</ram:TypeCode>', '')
      )
      expect(
        spawnSync('xmllint', ['--noout', '--schema', XSD, broken]).status
      ).not.toBe(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
