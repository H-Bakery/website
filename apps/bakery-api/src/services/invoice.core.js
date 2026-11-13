'use strict'

/**
 * Ausgangsrechnungen - die eine Stelle für Beträge, Umsatzsteuer, Pflichtangaben
 * und die ZUGFeRD/Factur-X-XML (CII, Profil EN 16931). Abhängigkeitsfreies
 * CommonJS: API, Verwaltung und Tests benutzen dieselben Funktionen.
 *
 * ## Geld
 *
 * Alle Beträge sind ganze Cent (Integer). Es wird kaufmännisch gerundet
 * (`divRound`, halbe Cent aufwärts); Gleitkomma kommt nur beim Einlesen einer
 * Eingabe vor (`toCents`).
 *
 * ## Von Bruttopreisen zur Netto-Rechnung nach EN 16931
 *
 * Die Katalogpreise sind Verbraucherpreise (brutto). EN 16931 rechnet netto:
 * Positionen netto, je Steuersatz `USt = Netto × Satz` (BR-CO-17), Summe =
 * Netto + USt (BR-CO-15). Die Rechnung muss trotzdem auf den Bruttobetrag
 * enden, den der Kunde kennt. Deshalb wird **je Steuersatz von der Bruttosumme
 * zurückgerechnet**, nicht je Position gerundet:
 *
 * 1. Position brutto `g = Menge × Brutto-Einzelpreis` (auf Cent gerundet).
 * 2. Je Steuersatz `G = Σ g`. Netto `N = G − runde(G × Satz / (100 + Satz))`,
 *    Steuer `U = runde(N × Satz / 100)` - genau die Formel, die BR-CO-17 prüft.
 * 3. `N` wird nach dem Verfahren der größten Reste auf die Positionen
 *    verteilt (`Σ n = N` exakt, BR-CO-10 / BR-S-08).
 * 4. Netto-Einzelpreis (BT-146) mit vier Nachkommastellen, sodass
 *    `Menge × Preis` gerundet wieder `n` ergibt. Geht das bei großen Mengen
 *    nicht auf, gilt der Preis je 10, 100 oder 1000 Einheiten (BT-149).
 * 5. `N + U = G` gilt für fast alle Beträge. Bei 7 % sind 7 von 107, bei 19 %
 *    19 von 119 Bruttobeträgen so **nicht darstellbar** (z. B. 0,08 € bei 7 %:
 *    aus 0,07 € netto werden 0,07 €, aus 0,08 € netto 0,09 €). Dann weicht
 *    `N + U` um genau einen Cent ab; dieser Cent steht als Rundungsbetrag
 *    (BT-114) in der Rechnung, und der Zahlbetrag (BT-115) ist wieder `G`
 *    (BR-CO-16). Kein Betrag wird „passend gemacht“.
 *
 * `checkBusinessRules()` rechnet die BR-CO-Regeln auf dem Ergebnis nach; die
 * Tests laufen damit über alle Bruttobeträge eines Bereichs.
 */

/**
 * ANNAHME, vom Steuerberater zu bestätigen: Backwaren zum Mitnehmen mit dem
 * ermäßigten Satz von 7 %. Die einzige Stelle, an der die Vorgabe steht; je
 * Position kann 19 % gewählt werden (z. B. Getränke, Verzehr an Ort und Stelle).
 */
const DEFAULT_VAT_RATE = 7
/** Zulässige Sätze (Kategorie S, Regelbesteuerung). */
const VAT_RATES = [7, 19]
const VAT_CATEGORY = 'S'

const DEFAULT_PAYMENT_TERM_DAYS = 14
const DEFAULT_PAYMENT_TEXT = 'Zahlbar per Überweisung'
const CURRENCY = 'EUR'
/** UNTDID 1001: 380 = Handelsrechnung. */
const TYPE_CODE_INVOICE = '380'
/** UNTDID 4461: 58 = SEPA-Überweisung. */
const PAYMENT_MEANS_SEPA_TRANSFER = '58'
/** BT-24: Profil EN 16931 (ZUGFeRD „COMFORT“). */
const GUIDELINE_EN16931 = 'urn:cen.eu:en16931:2017'
/** Wert für `fx:ConformanceLevel` in den XMP-Metadaten der PDF. */
const FACTURX_CONFORMANCE_LEVEL = 'EN 16931'
const FACTURX_FILENAME = 'factur-x.xml'

const STATUS = {
  DRAFT: 'entwurf',
  ISSUED: 'ausgestellt',
  CANCELLED: 'storniert',
}

/**
 * „Bereits bezahlt“: Zahlart mit Anzeige und UNTDID-4461-Code für die XML
 * (10 = bar, 48 = Bankkarte). Eine bezahlte Rechnung weist den vollen Betrag
 * als bereits gezahlt aus (BT-113), der Zahlbetrag ist 0.
 */
const PAYMENT_METHODS = {
  bar: { label: 'bar', code: '10' },
  karte: { label: 'Karte', code: '48' },
}

/** Grenzen für plausible Daten beim Ausstellen (Tage relativ zu heute). */
const DATE_BOUNDS = {
  invoiceFutureDays: 7,
  invoicePastDays: 366,
  deliveryFutureDays: 31,
  deliveryPastDays: 731,
}

/** ISO 3166-1 alpha-2, offiziell zugewiesene Codes. */
const COUNTRY_CODES = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ ' +
    'BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR ' +
    'CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ' +
    'ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ ' +
    'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ ' +
    'MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF ' +
    'PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI ' +
    'SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR ' +
    'TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' ')
)

const MAX_NUMBER_LENGTH = 40
const MAX_LINES = 200
const MAX_CENTS = 99999999 // 999.999,99 €
const MAX_QUANTITY = 100000

/** UN/ECE Recommendation 20 für BT-130; unbekannt = C62 („Einheit“). */
const UNIT_CODES = {
  stück: 'H87',
  stueck: 'H87',
  stk: 'H87',
  'stk.': 'H87',
  st: 'H87',
  kg: 'KGM',
  g: 'GRM',
  l: 'LTR',
  liter: 'LTR',
  ml: 'MLT',
  m: 'MTR',
  h: 'HUR',
  std: 'HUR',
  stunde: 'HUR',
  stunden: 'HUR',
  pauschal: 'LS',
  paket: 'XPK',
  blech: 'C62',
}

// ---------------------------------------------------------------- Zahlen

/** Kaufmännisch gerundete Division nicht negativer ganzer Zahlen. */
function divRound(numerator, denominator) {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  ) {
    throw new RangeError('divRound: nicht negative ganze Zahlen erwartet')
  }
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

/**
 * Euro-Eingabe (Zahl oder Text mit `,`/`.`, höchstens zwei Nachkommastellen)
 * in Cent; `null`, wenn das kein gültiger Betrag ist.
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') return null
  const text = (typeof value === 'number' ? String(value) : String(value))
    .trim()
    .replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) {
    // Zahlen wie 1.1 * 3 = 3.3000000000000003 bewusst nicht „reparieren“.
    return null
  }
  const [euros, fraction = ''] = text.split('.')
  return Number(euros) * 100 + Number((fraction + '00').slice(0, 2))
}

/**
 * Ein gespeicherter Preis (Zahl aus der Datenbank, z. B. der Einzelpreis einer
 * Vorbestellung) in Cent. Anders als `toCents` verzeiht das Gleitkomma-Reste
 * (`0.1 + 0.2`), aber keine echten Bruchteile von Cent (`0.333`): dann `null`.
 */
function priceToCents(value) {
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) {
    return null
  }
  const cents = Math.round(number * 100)
  if (Math.abs(number * 100 - cents) > 1e-6 || cents > MAX_CENTS) return null
  return cents
}

/** Menge (höchstens drei Nachkommastellen) in Tausendstel; sonst `null`. */
function toMilli(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim().replace(',', '.')
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const milli = Number(whole) * 1000 + Number((fraction + '000').slice(0, 3))
  if (milli <= 0 || milli > MAX_QUANTITY * 1000) return null
  return milli
}

/** Cent als XML-Dezimalzahl mit zwei Nachkommastellen (`1234` -> `12.34`). */
function centsToDecimal(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Tausendstel als Dezimalzahl ohne überflüssige Nullen (`2500` -> `2.5`). */
function milliToDecimal(milli) {
  const whole = Math.floor(milli / 1000)
  const fraction = String(milli % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}

/** Zehntausendstel Euro als Dezimalzahl mit vier Nachkommastellen. */
function tenThousandthsToDecimal(value) {
  return `${Math.floor(value / 10000)}.${String(value % 10000).padStart(
    4,
    '0'
  )}`
}

/** Deutsche Anzeige `1.234,56 €`. */
function formatEuro(cents) {
  const sign = cents < 0 ? '−' : ''
  const abs = Math.abs(cents)
  const euros = String(Math.floor(abs / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  )
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')} €`
}

/** Menge für die Anzeige (`2500` Tausendstel -> `2,5`). */
function formatQuantity(quantity) {
  const milli = toMilli(quantity)
  return milli === null ? '' : milliToDecimal(milli).replace('.', ',')
}

function unitCode(unit) {
  const key = String(unit || '')
    .trim()
    .toLowerCase()
  return UNIT_CODES[key] || (key === '' ? 'H87' : 'C62')
}

// ----------------------------------------------------------------- Datum

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

/** `YYYY-MM-DD` plus Tage (Kalendertage). */
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** `2026-11-15` -> `15.11.2026`. */
function formatDate(isoDate) {
  if (!isIsoDate(isoDate)) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

/** CII-Datumsformat 102 (`YYYYMMDD`). */
function ciiDate(isoDate) {
  return isoDate.replace(/-/g, '')
}

// ------------------------------------------------------------------- Bank

function normalizeIban(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

/** ISO 13616: Länge, Zeichen und Prüfziffer (mod 97). */
function isValidIban(value) {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith('DE') && iban.length !== 22) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

/** `DE02120300000000202051` -> `DE02 1203 0000 0000 2020 51`. */
function formatIban(value) {
  return normalizeIban(value)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

function isValidBic(value) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(
    String(value || '')
      .trim()
      .toUpperCase()
  )
}

// --------------------------------------------------------------- Rechnen

function isVatRate(rate) {
  return VAT_RATES.includes(rate)
}

/**
 * Rechnet eine Rechnung aus ihren Positionen (siehe Kopfkommentar).
 *
 * `lines`: `[{ quantity, unitPriceGrossCents, vatRate }]` - weitere Felder
 * werden durchgereicht. Wirft `RangeError` bei ungültigen Zahlen; die
 * Eingabeprüfung mit deutschen Meldungen macht `validateLines()`.
 *
 * Ergebnis (alles Cent):
 *   lines[]     … + `quantityMilli`, `grossCents`, `netCents`,
 *                 `netUnitPrice` (Dezimaltext, BT-146), `netBasisQuantity`
 *                 (Dezimaltext, BT-149; „1“ außer bei großen Mengen)
 *   vat[]       je Satz `{ rate, netCents, vatCents, grossCents, roundingCents }`
 *   totals      `netCents` (BT-106 = BT-109), `vatCents` (BT-110),
 *               `grandTotalCents` (BT-112), `roundingCents` (BT-114),
 *               `dueCents` (BT-115) = `grossCents` (Summe der Bruttopositionen)
 */
function computeInvoice(lines) {
  const computed = (lines || []).map((line) => {
    const quantityMilli = toMilli(line.quantity)
    const unit = line.unitPriceGrossCents
    if (quantityMilli === null) {
      throw new RangeError('Menge ungültig')
    }
    if (!Number.isSafeInteger(unit) || unit < 0 || unit > MAX_CENTS) {
      throw new RangeError('Einzelpreis ungültig')
    }
    if (!isVatRate(line.vatRate)) {
      throw new RangeError('Steuersatz ungültig')
    }
    const grossCents = divRound(quantityMilli * unit, 1000)
    if (grossCents > MAX_CENTS) throw new RangeError('Betrag zu groß')
    return { ...line, quantityMilli, grossCents, netCents: 0 }
  })

  const rates = [...new Set(computed.map((l) => l.vatRate))].sort(
    (a, b) => a - b
  )
  const vat = rates.map((rate) => {
    const group = computed.filter((l) => l.vatRate === rate)
    const grossCents = group.reduce((sum, l) => sum + l.grossCents, 0)
    const netCents = grossCents - divRound(grossCents * rate, 100 + rate)
    const vatCents = divRound(netCents * rate, 100)
    apportion(group, netCents, rate)
    return {
      rate,
      netCents,
      vatCents,
      grossCents,
      roundingCents: grossCents - (netCents + vatCents),
    }
  })

  for (const line of computed) {
    const price = netUnitPrice(line.netCents, line.quantityMilli)
    line.netUnitPrice = price.netUnitPrice
    line.netBasisQuantity = price.netBasisQuantity
  }

  const netCents = vat.reduce((sum, v) => sum + v.netCents, 0)
  const vatCents = vat.reduce((sum, v) => sum + v.vatCents, 0)
  const grossCents = vat.reduce((sum, v) => sum + v.grossCents, 0)
  const grandTotalCents = netCents + vatCents
  return {
    lines: computed,
    vat,
    totals: {
      netCents,
      vatCents,
      grandTotalCents,
      roundingCents: grossCents - grandTotalCents,
      dueCents: grossCents,
      grossCents,
    },
  }
}

/**
 * Verteilt `netCents` eines Steuersatzes auf dessen Positionen: jede bekommt
 * den abgerundeten Anteil `g × 100 / (100 + Satz)`, die fehlenden Cent gehen
 * an die größten Reste (bei Gleichstand an die frühere Position).
 */
function apportion(group, netCents, rate) {
  const divisor = 100 + rate
  let assigned = 0
  const order = group.map((line, index) => {
    const scaled = line.grossCents * 100
    line.netCents = Math.floor(scaled / divisor)
    assigned += line.netCents
    return { line, index, remainder: scaled % divisor }
  })
  order.sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  let missing = netCents - assigned
  for (let i = 0; missing > 0 && order.length > 0; i += 1, missing -= 1) {
    order[i % order.length].line.netCents += 1
  }
}

/**
 * Netto-Einzelpreis mit vier Nachkommastellen, sodass `Menge × Preis /
 * Basismenge` gerundet den Positionsbetrag trifft. Bei kleinen Mengen ist die
 * Basismenge 1; ab etwa 100 Stück reicht die Genauigkeit von vier Stellen
 * nicht mehr, dann gilt der Preis je 10, 100 oder 1000 (BT-149), zuletzt für
 * die ganze Menge. So stimmt `BT-131 = BT-129 × BT-146 / BT-149` immer.
 */
function netUnitPrice(netCents, quantityMilli) {
  for (const basis of [1, 10, 100, 1000]) {
    // netCents [1/100 €] × basis / (quantityMilli / 1000), in 1/10000 €
    const price = divRound(netCents * 100 * 1000 * basis, quantityMilli)
    if (divRound(price * quantityMilli, 100 * 1000 * basis) === netCents) {
      return {
        netUnitPrice: tenThousandthsToDecimal(price),
        netBasisQuantity: String(basis),
      }
    }
  }
  return {
    netUnitPrice: `${centsToDecimal(netCents)}00`,
    netBasisQuantity: milliToDecimal(quantityMilli),
  }
}

/**
 * Rechnet die EN-16931-Regeln nach, die Beträge betreffen. Leeres Array =
 * alles stimmt. Für Tests und als Sicherung vor dem Ausstellen.
 */
function checkBusinessRules(computed) {
  const failures = []
  const { lines, vat, totals } = computed
  const sum = (list, key) => list.reduce((s, x) => s + x[key], 0)

  if (sum(lines, 'netCents') !== totals.netCents) failures.push('BR-CO-10')
  for (const group of vat) {
    const groupLines = lines.filter((l) => l.vatRate === group.rate)
    if (sum(groupLines, 'netCents') !== group.netCents) failures.push('BR-S-08')
    if (divRound(group.netCents * group.rate, 100) !== group.vatCents) {
      failures.push('BR-CO-17')
    }
  }
  if (sum(vat, 'vatCents') !== totals.vatCents) failures.push('BR-CO-14')
  if (totals.netCents + totals.vatCents !== totals.grandTotalCents) {
    failures.push('BR-CO-15')
  }
  if (totals.grandTotalCents + totals.roundingCents !== totals.dueCents) {
    failures.push('BR-CO-16')
  }
  if (totals.dueCents !== sum(lines, 'grossCents')) failures.push('brutto')
  if (Math.abs(totals.roundingCents) > vat.length) failures.push('rundung')
  for (const line of lines) {
    const [whole, fraction] = line.netUnitPrice.split('.')
    const price = Number(whole) * 10000 + Number(fraction)
    const basisMilli = toMilli(line.netBasisQuantity)
    // Menge × Preis / Basismenge, in Cent gerundet
    const expected = divRound(
      price * line.quantityMilli,
      100 * (basisMilli === null ? 1000 : basisMilli)
    )
    if (expected !== line.netCents) failures.push('BT-131')
    if (line.netCents > line.grossCents) failures.push('netto>brutto')
  }
  return failures
}

// ---------------------------------------------------------- Eingabeprüfung

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
/**
 * Steuerzeichen (auch Tab und Zeilenumbruch), unsichtbare Zeichen (Zero-Width,
 * Richtungsmarken, BOM, weiches Trennzeichen) und alle Leerzeichen außer dem
 * gewöhnlichen.
 */
const INVISIBLE_CHARS =
  // eslint-disable-next-line no-control-regex, no-misleading-character-class
  /[\u0000-\u001f\u007f-\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb]/

/** Prüft eine Rechnungsnummer (frei wählbar, aber druck- und XML-tauglich). */
function validateNumber(value) {
  const number = text(value)
  if (!number) return 'Bitte eine Rechnungsnummer eintragen.'
  if (number.length > MAX_NUMBER_LENGTH) {
    return `Die Rechnungsnummer darf höchstens ${MAX_NUMBER_LENGTH} Zeichen haben.`
  }
  if (INVISIBLE_CHARS.test(String(value))) {
    return 'Die Rechnungsnummer enthält unsichtbare Zeichen oder besondere Leerzeichen (z. B. vom Kopieren). Bitte neu eintippen.'
  }
  if (/[<>&"']/.test(number)) {
    return 'Die Rechnungsnummer enthält unzulässige Zeichen (< > & " \').'
  }
  return null
}

/**
 * Vergleichsform einer Rechnungsnummer: zwei Nummern, die gleich aussehen,
 * sind dieselbe („re-7“ = „RE-7“ = „ＲＥ-7“ = „RE-7 “). Gespeichert und gedruckt
 * wird, was der Inhaber getippt hat; eindeutig sein muss diese Form.
 */
function numberKey(value) {
  return String(value === null || value === undefined ? '' : value)
    .normalize('NFKC')
    .replace(new RegExp(INVISIBLE_CHARS.source, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .toLowerCase()
}

/** Ob ein einzeiliges Textfeld (Name, Ort …) Steuer- oder unsichtbare Zeichen enthält. */
function hasUnprintable(value) {
  return INVISIBLE_CHARS.test(String(value || ''))
}

function isCountryCode(value) {
  return COUNTRY_CODES.has(String(value || ''))
}

function isPaid(invoice) {
  return !!invoice && invoice.paid === true
}

/**
 * Was vom Rechnungsbetrag schon gezahlt ist (BT-113) und was noch zu zahlen
 * bleibt (BT-115). Bezahlt heißt hier immer: der volle Betrag - Teilzahlungen
 * weist die Rechnung nicht aus.
 */
function settlement(invoice, totals) {
  const prepaidCents = isPaid(invoice) ? totals.dueCents : 0
  return { prepaidCents, payableCents: totals.dueCents - prepaidCents }
}

/**
 * Prüft Positionen, wie sie gespeichert werden. Ergebnis: Liste von
 * `{ field, message }` (deutsch), leer = gültig.
 */
function validateLines(lines) {
  const errors = []
  if (!Array.isArray(lines)) {
    return [{ field: 'lines', message: 'Die Positionen fehlen.' }]
  }
  if (lines.length > MAX_LINES) {
    errors.push({
      field: 'lines',
      message: `Eine Rechnung kann höchstens ${MAX_LINES} Positionen haben.`,
    })
  }
  lines.forEach((line, index) => {
    const at = `Position ${index + 1}`
    const field = (name) => `lines[${index}].${name}`
    if (!line || typeof line !== 'object') {
      errors.push({ field: `lines[${index}]`, message: `${at} ist ungültig.` })
      return
    }
    const name = text(line.name)
    if (!name) {
      errors.push({
        field: field('name'),
        message: `${at}: Bitte eine Bezeichnung eintragen.`,
      })
    } else if (name.length > 200 || CONTROL_CHARS.test(name)) {
      errors.push({
        field: field('name'),
        message: `${at}: Die Bezeichnung ist zu lang oder enthält Steuerzeichen.`,
      })
    }
    if (toMilli(line.quantity) === null) {
      errors.push({
        field: field('quantity'),
        message: `${at}: Die Menge muss größer als 0 sein (höchstens drei Nachkommastellen).`,
      })
    }
    if (
      !Number.isSafeInteger(line.unitPriceGrossCents) ||
      line.unitPriceGrossCents < 0 ||
      line.unitPriceGrossCents > MAX_CENTS
    ) {
      errors.push({
        field: field('unitPriceGross'),
        message: `${at}: Bitte einen Einzelpreis (brutto) in Euro und Cent eintragen.`,
      })
    }
    const quantityMilli = toMilli(line.quantity)
    if (
      quantityMilli !== null &&
      Number.isSafeInteger(line.unitPriceGrossCents) &&
      line.unitPriceGrossCents >= 0 &&
      line.unitPriceGrossCents <= MAX_CENTS &&
      // ohne divRound: das Produkt kann den sicheren Ganzzahlbereich verlassen
      quantityMilli * line.unitPriceGrossCents > (MAX_CENTS + 0.5) * 1000
    ) {
      errors.push({
        field: field('quantity'),
        message: `${at}: Menge × Einzelpreis ist zu groß (höchstens ${formatEuro(
          MAX_CENTS
        )} je Position).`,
      })
    }
    if (!isVatRate(line.vatRate)) {
      errors.push({
        field: field('vatRate'),
        message: `${at}: Der Steuersatz muss ${VAT_RATES.join(
          ' % oder '
        )} % sein.`,
      })
    }
    if (text(line.unit).length > 32) {
      errors.push({
        field: field('unit'),
        message: `${at}: Die Einheit ist zu lang.`,
      })
    }
  })
  return errors
}

/**
 * Was zum Ausstellen fehlt (§ 14 Abs. 4 UStG und EN 16931). `invoice` ist der
 * vollständige Stand: `{ number, invoiceDate, deliveryDate, dueDate,
 * paymentText, paid, paidOn, paidMethod, buyer, seller, lines }`. Leeres
 * Array = ausstellbar. Mit `options.today` (`YYYY-MM-DD`) werden Rechnungs-
 * und Leistungsdatum zusätzlich auf Plausibilität geprüft (`DATE_BOUNDS`).
 */
function validateForIssue(invoice, options = {}) {
  const errors = []
  const push = (field, message) => errors.push({ field, message })
  const inv = invoice || {}
  const paid = isPaid(inv)
  const today = isIsoDate(options.today) ? options.today : null

  const numberError = validateNumber(inv.number)
  if (numberError) push('number', numberError)

  if (!isIsoDate(inv.invoiceDate)) {
    push('invoiceDate', 'Bitte das Rechnungsdatum eintragen.')
  } else if (today) {
    if (inv.invoiceDate > addDays(today, DATE_BOUNDS.invoiceFutureDays)) {
      push(
        'invoiceDate',
        `Das Rechnungsdatum liegt mehr als ${DATE_BOUNDS.invoiceFutureDays} Tage in der Zukunft.`
      )
    } else if (inv.invoiceDate < addDays(today, -DATE_BOUNDS.invoicePastDays)) {
      push(
        'invoiceDate',
        'Das Rechnungsdatum liegt mehr als ein Jahr zurück. Bitte prüfen.'
      )
    }
  }
  if (!isIsoDate(inv.deliveryDate)) {
    push(
      'deliveryDate',
      'Bitte das Liefer- bzw. Leistungsdatum eintragen (Tag der Abholung).'
    )
  } else if (today) {
    if (inv.deliveryDate > addDays(today, DATE_BOUNDS.deliveryFutureDays)) {
      push(
        'deliveryDate',
        `Das Liefer- bzw. Leistungsdatum liegt mehr als ${DATE_BOUNDS.deliveryFutureDays} Tage in der Zukunft.`
      )
    } else if (
      inv.deliveryDate < addDays(today, -DATE_BOUNDS.deliveryPastDays)
    ) {
      push(
        'deliveryDate',
        'Das Liefer- bzw. Leistungsdatum liegt mehr als zwei Jahre zurück. Bitte prüfen.'
      )
    }
  }
  if (paid) {
    if (!isIsoDate(inv.paidOn)) {
      push('paidOn', 'Bitte eintragen, wann die Rechnung bezahlt wurde.')
    } else if (isIsoDate(inv.invoiceDate) && inv.paidOn > inv.invoiceDate) {
      push(
        'paidOn',
        'Das Zahlungsdatum liegt nach dem Rechnungsdatum - „bereits bezahlt“ passt dann nicht.'
      )
    }
    if (!PAYMENT_METHODS[inv.paidMethod]) {
      push('paidMethod', 'Bitte die Zahlart wählen (bar oder Karte).')
    }
  } else {
    if (!isIsoDate(inv.dueDate)) {
      push('paymentTermDays', 'Bitte ein Zahlungsziel eintragen.')
    } else if (isIsoDate(inv.invoiceDate) && inv.dueDate < inv.invoiceDate) {
      push('paymentTermDays', 'Das Zahlungsziel liegt vor dem Rechnungsdatum.')
    }
    if (!text(inv.paymentText)) {
      push('paymentText', 'Bitte die Zahlungsbedingung eintragen.')
    }
  }

  const buyer = inv.buyer || {}
  if (!text(buyer.name)) {
    push('buyer.name', 'Bitte den Namen des Rechnungsempfängers eintragen.')
  }
  if (!text(buyer.street)) {
    push(
      'buyer.street',
      'Bitte Straße und Hausnummer des Empfängers eintragen.'
    )
  }
  if (!text(buyer.postcode)) {
    push('buyer.postcode', 'Bitte die Postleitzahl des Empfängers eintragen.')
  } else if (
    text(buyer.countryCode || 'DE') === 'DE' &&
    !/^\d{5}$/.test(text(buyer.postcode))
  ) {
    push('buyer.postcode', 'Die Postleitzahl muss fünf Ziffern haben.')
  }
  if (!text(buyer.city)) {
    push('buyer.city', 'Bitte den Ort des Empfängers eintragen.')
  }
  if (!isCountryCode(text(buyer.countryCode))) {
    push('buyer.countryCode', 'Bitte das Land des Empfängers wählen.')
  }
  for (const key of ['name', 'careOf', 'street', 'postcode', 'city']) {
    if (hasUnprintable(text(buyer[key]))) {
      push(
        `buyer.${key}`,
        'Die Anschrift des Empfängers enthält Zeilenumbrüche, Tabulatoren oder unsichtbare Zeichen.'
      )
      break
    }
  }

  const seller = inv.seller || {}
  for (const key of ['name', 'street', 'postcode', 'city', 'countryCode']) {
    if (!text(seller[key])) {
      push(
        `seller.${key}`,
        'Die Angaben der Bäckerei (Name und Anschrift) sind unvollständig.'
      )
      break
    }
  }
  if (!text(seller.vatId) && !text(seller.taxNumber)) {
    push('seller.vatId', 'Die USt-IdNr. oder Steuernummer der Bäckerei fehlt.')
  }
  // Die Bankverbindung braucht nur, wer überweisen soll.
  if (!paid) errors.push(...bankErrors(seller))

  if (!Array.isArray(inv.lines) || inv.lines.length === 0) {
    push('lines', 'Die Rechnung hat keine Positionen.')
  } else {
    const lineErrors = validateLines(inv.lines)
    errors.push(...lineErrors)
    if (lineErrors.length === 0) {
      const computed = computeInvoice(inv.lines)
      if (computed.totals.dueCents <= 0) {
        push('lines', 'Der Rechnungsbetrag muss größer als 0 sein.')
      }
      const failed = checkBusinessRules(computed)
      if (failed.length > 0) {
        push(
          'lines',
          `Die Beträge lassen sich nicht regelkonform darstellen (${failed.join(
            ', '
          )}).`
        )
      }
    }
  }
  return errors
}

/**
 * Bankverbindung für die Überweisung. Fehlt sie, wird nicht ausgestellt -
 * nie ein Platzhalter.
 */
function bankErrors(seller) {
  const s = seller || {}
  const missing = []
  if (!text(s.iban)) missing.push('IBAN')
  if (!text(s.bic)) missing.push('BIC')
  if (!text(s.accountHolder)) missing.push('Kontoinhaber')
  if (missing.length > 0) {
    return [
      {
        field: 'seller.bank',
        message: `Die Bankverbindung der Bäckerei ist auf der Box nicht eingerichtet (es fehlt: ${missing.join(
          ', '
        )}). Ohne sie kann keine Rechnung ausgestellt werden.`,
      },
    ]
  }
  if (!isValidIban(s.iban)) {
    return [
      {
        field: 'seller.bank',
        message:
          'Die eingerichtete IBAN der Bäckerei ist ungültig (Prüfziffer). Bitte die Einstellung auf der Box prüfen.',
      },
    ]
  }
  if (!isValidBic(s.bic)) {
    return [
      {
        field: 'seller.bank',
        message:
          'Der eingerichtete BIC der Bäckerei ist ungültig. Bitte die Einstellung auf der Box prüfen.',
      },
    ]
  }
  return []
}

/** `Zahlbar per Überweisung bis 29.11.2026 ohne Abzug.` */
function paymentTermsText(invoice) {
  if (isPaid(invoice)) {
    const method = PAYMENT_METHODS[invoice.paidMethod]
    const on = formatDate(invoice.paidOn)
    return `Betrag bereits bezahlt${on ? ` am ${on}` : ''}${
      method ? ` (${method.label})` : ''
    }.`
  }
  const base = text(invoice.paymentText).replace(/[.\s]+$/, '')
  const due = formatDate(invoice.dueDate)
  if (!base) return due ? `Zahlbar bis ${due} ohne Abzug.` : ''
  return due ? `${base} bis ${due} ohne Abzug.` : `${base}.`
}

// -------------------------------------------------------------------- XML

function escapeXml(value) {
  return (
    String(value === null || value === undefined ? '' : value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  )
}

function element(name, value, attributes = '') {
  return `<${name}${attributes}>${escapeXml(value)}</${name}>`
}

function dateElement(isoDate) {
  return `<udt:DateTimeString format="102">${ciiDate(
    isoDate
  )}</udt:DateTimeString>`
}

function postalAddress(party) {
  const lines = [
    element('ram:PostcodeCode', text(party.postcode)),
    // BT-35/BT-50 Zeile 1: Straße; ein c/o-Zusatz steht davor, die Straße
    // rückt dann in Zeile 2 (BT-36/BT-51).
    text(party.careOf)
      ? element('ram:LineOne', text(party.careOf)) +
        element('ram:LineTwo', text(party.street))
      : element('ram:LineOne', text(party.street)),
    element('ram:CityName', text(party.city)),
    element('ram:CountryID', text(party.countryCode)),
  ]
  return `<ram:PostalTradeAddress>${lines.join('')}</ram:PostalTradeAddress>`
}

/**
 * Baut die Factur-X/ZUGFeRD-XML (`rsm:CrossIndustryInvoice`, Typ 380, Profil
 * EN 16931) aus einem vollständigen Rechnungsstand. Reine Funktion: gleiche
 * Eingabe, gleiche Bytes. Prüft nicht - vorher `validateForIssue()` aufrufen.
 *
 * Die Reihenfolge der Elemente ist die des XSD (Sequenzen); die Tests prüfen
 * das Ergebnis gegen das offizielle Schema.
 */
function buildCiiXml(invoice) {
  const computed = computeInvoice(invoice.lines)
  const { totals } = computed
  const paid = isPaid(invoice)
  const paidUp = settlement(invoice, totals)
  const seller = invoice.seller
  const buyer = invoice.buyer
  const out = []
  const add = (line) => out.push(line)

  add('<?xml version="1.0" encoding="UTF-8"?>')
  add(
    '<rsm:CrossIndustryInvoice' +
      ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
      ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"' +
      ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
      ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">'
  )
  add('<rsm:ExchangedDocumentContext>')
  add(
    `<ram:GuidelineSpecifiedDocumentContextParameter>${element(
      'ram:ID',
      GUIDELINE_EN16931
    )}</ram:GuidelineSpecifiedDocumentContextParameter>`
  )
  add('</rsm:ExchangedDocumentContext>')

  add('<rsm:ExchangedDocument>')
  add(element('ram:ID', text(invoice.number)))
  add(element('ram:TypeCode', TYPE_CODE_INVOICE))
  add(
    `<ram:IssueDateTime>${dateElement(invoice.invoiceDate)}</ram:IssueDateTime>`
  )
  if (text(invoice.note)) {
    add(
      `<ram:IncludedNote>${element(
        'ram:Content',
        text(invoice.note)
      )}</ram:IncludedNote>`
    )
  }
  add('</rsm:ExchangedDocument>')

  add('<rsm:SupplyChainTradeTransaction>')
  computed.lines.forEach((line, index) => {
    const code = unitCode(line.unit)
    add('<ram:IncludedSupplyChainTradeLineItem>')
    add(
      `<ram:AssociatedDocumentLineDocument>${element(
        'ram:LineID',
        String(index + 1)
      )}</ram:AssociatedDocumentLineDocument>`
    )
    add(
      `<ram:SpecifiedTradeProduct>${element(
        'ram:Name',
        text(line.name)
      )}</ram:SpecifiedTradeProduct>`
    )
    add(
      '<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>' +
        element('ram:ChargeAmount', line.netUnitPrice) +
        element(
          'ram:BasisQuantity',
          line.netBasisQuantity,
          ` unitCode="${code}"`
        ) +
        '</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>'
    )
    add(
      `<ram:SpecifiedLineTradeDelivery>${element(
        'ram:BilledQuantity',
        milliToDecimal(line.quantityMilli),
        ` unitCode="${code}"`
      )}</ram:SpecifiedLineTradeDelivery>`
    )
    add(
      '<ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax>' +
        element('ram:TypeCode', 'VAT') +
        element('ram:CategoryCode', VAT_CATEGORY) +
        element('ram:RateApplicablePercent', String(line.vatRate)) +
        '</ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation>' +
        element('ram:LineTotalAmount', centsToDecimal(line.netCents)) +
        '</ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>'
    )
    add('</ram:IncludedSupplyChainTradeLineItem>')
  })

  add('<ram:ApplicableHeaderTradeAgreement>')
  add('<ram:SellerTradeParty>')
  add(element('ram:Name', text(seller.name)))
  add(postalAddress(seller))
  if (text(seller.email)) {
    add(
      `<ram:URIUniversalCommunication>${element(
        'ram:URIID',
        text(seller.email),
        ' schemeID="EM"'
      )}</ram:URIUniversalCommunication>`
    )
  }
  if (text(seller.taxNumber)) {
    add(
      `<ram:SpecifiedTaxRegistration>${element(
        'ram:ID',
        text(seller.taxNumber),
        ' schemeID="FC"'
      )}</ram:SpecifiedTaxRegistration>`
    )
  }
  if (text(seller.vatId)) {
    add(
      `<ram:SpecifiedTaxRegistration>${element(
        'ram:ID',
        text(seller.vatId),
        ' schemeID="VA"'
      )}</ram:SpecifiedTaxRegistration>`
    )
  }
  add('</ram:SellerTradeParty>')
  add('<ram:BuyerTradeParty>')
  add(element('ram:Name', text(buyer.name)))
  add(postalAddress(buyer))
  add('</ram:BuyerTradeParty>')
  if (text(invoice.preorderCode)) {
    add(
      `<ram:BuyerOrderReferencedDocument>${element(
        'ram:IssuerAssignedID',
        text(invoice.preorderCode)
      )}</ram:BuyerOrderReferencedDocument>`
    )
  }
  add('</ram:ApplicableHeaderTradeAgreement>')

  add('<ram:ApplicableHeaderTradeDelivery>')
  add(
    `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${dateElement(
      invoice.deliveryDate
    )}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`
  )
  add('</ram:ApplicableHeaderTradeDelivery>')

  add('<ram:ApplicableHeaderTradeSettlement>')
  add(element('ram:PaymentReference', text(invoice.number)))
  add(element('ram:InvoiceCurrencyCode', CURRENCY))
  if (paid) {
    // Bereits bezahlt: nur die Zahlart, kein Konto.
    add(
      '<ram:SpecifiedTradeSettlementPaymentMeans>' +
        element('ram:TypeCode', PAYMENT_METHODS[invoice.paidMethod].code) +
        '</ram:SpecifiedTradeSettlementPaymentMeans>'
    )
  } else {
    add(
      '<ram:SpecifiedTradeSettlementPaymentMeans>' +
        element('ram:TypeCode', PAYMENT_MEANS_SEPA_TRANSFER) +
        '<ram:PayeePartyCreditorFinancialAccount>' +
        element('ram:IBANID', normalizeIban(seller.iban)) +
        element('ram:AccountName', text(seller.accountHolder)) +
        '</ram:PayeePartyCreditorFinancialAccount>' +
        '<ram:PayeeSpecifiedCreditorFinancialInstitution>' +
        element('ram:BICID', text(seller.bic).toUpperCase()) +
        '</ram:PayeeSpecifiedCreditorFinancialInstitution>' +
        '</ram:SpecifiedTradeSettlementPaymentMeans>'
    )
  }
  for (const group of computed.vat) {
    add(
      '<ram:ApplicableTradeTax>' +
        element('ram:CalculatedAmount', centsToDecimal(group.vatCents)) +
        element('ram:TypeCode', 'VAT') +
        element('ram:BasisAmount', centsToDecimal(group.netCents)) +
        element('ram:CategoryCode', VAT_CATEGORY) +
        element('ram:RateApplicablePercent', String(group.rate)) +
        '</ram:ApplicableTradeTax>'
    )
  }
  add(
    '<ram:SpecifiedTradePaymentTerms>' +
      element('ram:Description', paymentTermsText(invoice)) +
      (paid
        ? ''
        : `<ram:DueDateDateTime>${dateElement(
            invoice.dueDate
          )}</ram:DueDateDateTime>`) +
      '</ram:SpecifiedTradePaymentTerms>'
  )
  add(
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
      element('ram:LineTotalAmount', centsToDecimal(totals.netCents)) +
      element('ram:TaxBasisTotalAmount', centsToDecimal(totals.netCents)) +
      element(
        'ram:TaxTotalAmount',
        centsToDecimal(totals.vatCents),
        ` currencyID="${CURRENCY}"`
      ) +
      (totals.roundingCents !== 0
        ? element('ram:RoundingAmount', centsToDecimal(totals.roundingCents))
        : '') +
      element('ram:GrandTotalAmount', centsToDecimal(totals.grandTotalCents)) +
      (paid
        ? element('ram:TotalPrepaidAmount', centsToDecimal(paidUp.prepaidCents))
        : '') +
      element('ram:DuePayableAmount', centsToDecimal(paidUp.payableCents)) +
      '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>'
  )
  add('</ram:ApplicableHeaderTradeSettlement>')
  add('</rsm:SupplyChainTradeTransaction>')
  add('</rsm:CrossIndustryInvoice>')
  return `${out.join('\n')}\n`
}

module.exports = {
  DEFAULT_VAT_RATE,
  VAT_RATES,
  VAT_CATEGORY,
  DEFAULT_PAYMENT_TERM_DAYS,
  DEFAULT_PAYMENT_TEXT,
  CURRENCY,
  GUIDELINE_EN16931,
  FACTURX_CONFORMANCE_LEVEL,
  FACTURX_FILENAME,
  STATUS,
  MAX_NUMBER_LENGTH,
  MAX_LINES,
  MAX_CENTS,
  PAYMENT_METHODS,
  DATE_BOUNDS,
  divRound,
  toCents,
  priceToCents,
  numberKey,
  hasUnprintable,
  isCountryCode,
  isPaid,
  settlement,
  toMilli,
  centsToDecimal,
  milliToDecimal,
  formatEuro,
  formatQuantity,
  formatDate,
  unitCode,
  isIsoDate,
  addDays,
  normalizeIban,
  isValidIban,
  isValidBic,
  formatIban,
  isVatRate,
  computeInvoice,
  checkBusinessRules,
  validateNumber,
  validateLines,
  validateForIssue,
  bankErrors,
  paymentTermsText,
  escapeXml,
  buildCiiXml,
}
