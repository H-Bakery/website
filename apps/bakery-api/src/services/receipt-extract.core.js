'use strict'

const { isIsoDate, isValidIban, normalizeIban } = require('./invoice.core')

const KINDS = ['eingangsrechnung', 'kassenbeleg', 'gutschrift']
const PAYMENTS = ['ueberweisung', 'lastschrift', 'bar', 'karte', 'offen']
const FIELDS = [
  'kind',
  'supplier_name',
  'supplier_vat_id',
  'supplier_iban',
  'invoice_number',
  'invoice_date',
  'due_date',
  'gross_cents',
  'currency',
  'payment',
  'skonto_rate',
  'skonto_due_date',
]

/** Textbeträge sind deutsch; XML-Beträge sind Dezimalzahlen mit Punkt. */
function cents(value, german = false) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const pattern = german
    ? /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/
    : /^[+-]?\d+(?:\.\d{1,2}0*)?$/
  if (!pattern.test(text)) return null
  const normalized = german ? text.replace(/\./g, '').replace(',', '.') : text
  const [whole, fraction = ''] = normalized.replace(/^[+-]/, '').split('.')
  const amount =
    Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'))
  return Number.isSafeInteger(amount)
    ? text.startsWith('-')
      ? -amount
      : amount
    : null
}

function date(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text)
  const iso = german
    ? [german[3], german[2].padStart(2, '0'), german[1].padStart(2, '0')].join(
        '-'
      )
    : text.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  return isIsoDate(iso) ? iso : null
}

function vatId(value) {
  const compact =
    typeof value === 'string' ? value.toUpperCase().replace(/\s+/g, '') : ''
  return /^(?:DE\d{9}|(?!DE)[A-Z]{2}[A-Z0-9]{5,14})$/.test(compact)
    ? compact
    : null
}

function paymentCode(value) {
  if (['30', '42', '58'].includes(value)) return 'ueberweisung'
  if (['49', '59'].includes(value)) return 'lastschrift'
  if (value === '10') return 'bar'
  if (['48', '54', '55'].includes(value)) return 'karte'
  return 'offen'
}

function rate(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim().replace(',', '.')
  const number = Number(text)
  return /^\d{1,3}(?:\.\d{1,3}0*)?$/.test(text) && number <= 100 ? number : null
}

const UNKNOWN_CURRENCY = 'XXX'
const MISSING_GROSS = 'Der Bruttobetrag fehlt oder ist ungültig.'

function knownCurrency(currency) {
  return (
    typeof currency === 'string' &&
    /^[A-Z]{3}$/.test(currency) &&
    currency !== UNKNOWN_CURRENCY
  )
}

function missingRequiredFields(fields, today) {
  return (
    !fields.supplier_name?.trim() ||
    !isIsoDate(fields.invoice_date) ||
    fields.invoice_date > today ||
    !Number.isSafeInteger(fields.gross_cents) ||
    fields.gross_cents < 0 ||
    !knownCurrency(fields.currency)
  )
}

function checkFields(fields, today) {
  const flags = {}
  if (!fields.supplier_name) flags.supplier_name = 'Lieferant fehlt.'
  if (!fields.invoice_number && fields.kind !== 'kassenbeleg')
    flags.invoice_number = 'Rechnungsnummer fehlt.'
  if (!date(fields.invoice_date))
    flags.invoice_date = 'Rechnungsdatum fehlt oder ist ungültig.'
  else if (fields.invoice_date > today)
    flags.invoice_date = 'Das Rechnungsdatum liegt in der Zukunft.'
  if (
    fields.due_date &&
    fields.invoice_date &&
    fields.due_date < fields.invoice_date
  ) {
    flags.due_date = 'Die Fälligkeit liegt vor dem Rechnungsdatum.'
  }
  if (fields.gross_cents == null || fields.gross_cents < 0)
    flags.gross_cents = MISSING_GROSS
  if (!knownCurrency(fields.currency))
    flags.currency = 'Währung fehlt oder ist unklar.'
  else if (fields.currency !== 'EUR')
    flags.currency = 'Fremdwährung. Der Bankabgleich ist auf Euro beschränkt.'
  if (fields.supplier_iban && !isValidIban(fields.supplier_iban))
    flags.supplier_iban = 'Die IBAN-Prüfziffer ist ungültig.'
  if (fields.supplier_vat_id && !vatId(fields.supplier_vat_id))
    flags.supplier_vat_id = 'Die USt-IdNr. hat ein ungültiges Format.'
  if (
    (fields.skonto_rate != null) !== Boolean(fields.skonto_due_date) ||
    (fields.skonto_due_date &&
      (fields.skonto_due_date < fields.invoice_date ||
        (fields.skonto_due_date > fields.due_date && fields.due_date)))
  ) {
    flags.skonto_rate = 'Skontosatz und Skontofrist prüfen.'
  }

  const lines = fields.vat_lines || []
  if (!lines.length) {
    flags.vat_lines = 'USt-Aufteilung fehlt.'
  } else {
    const gross = lines.reduce(
      (sum, line) => sum + line.net_cents + line.vat_cents,
      0
    )
    if (
      lines.some(
        (line) =>
          Math.abs(
            Math.round((line.net_cents * line.rate) / 100) - line.vat_cents
          ) > 1
      )
    ) {
      flags.vat_lines =
        'Netto und Umsatzsteuer passen in mindestens einem Steuersatz nicht zusammen.'
    } else if (
      fields.gross_cents != null &&
      Math.abs(gross - fields.gross_cents) > 1
    ) {
      flags.vat_lines =
        'Netto plus Umsatzsteuer weicht um mehr als einen Cent vom Brutto ab.'
    }
  }
  return flags
}

function result(fields, source, today, extraFlags = {}) {
  const field_flags = { ...checkFields(fields, today), ...extraFlags }
  const confidence =
    source === 'manuell'
      ? null
      : Math.max(
          0,
          (source === 'xml' ? 1 : 0.75) - Object.keys(field_flags).length * 0.1
        )
  return { fields, field_flags, confidence, extracted_by: source }
}

function mergeTextResult(previous, previousFlags, next, today) {
  const fields = { ...previous }
  const contextual = { ...previousFlags }
  for (const key of Object.keys(checkFields(previous, today)))
    delete contextual[key]
  for (const key of FIELDS) {
    const missing =
      previous[key] == null ||
      previous[key] === 'XXX' ||
      (key === 'payment' && previous[key] === 'offen')
    if (!missing || next.fields[key] == null) continue
    fields[key] = next.fields[key]
    delete contextual[key]
    if (next.field_flags[key]) contextual[key] = next.field_flags[key]
  }
  if (!previous.vat_lines.length && next.fields.vat_lines.length) {
    fields.vat_lines = next.fields.vat_lines
    delete contextual.vat_lines
    if (
      next.field_flags.vat_lines &&
      next.field_flags.vat_lines !== checkFields(next.fields, today).vat_lines
    ) {
      contextual.vat_lines = next.field_flags.vat_lines
    }
  }
  return result(fields, 'textlayer', today, contextual)
}

const TEXT_MONEY = '([+-]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})(?![\\d,.])'
const TEXT_DATE = '(\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{4}-\\d{2}-\\d{2})'

function textGross(text) {
  const currency = '(?:[A-Z]{3}|[€$£])'
  const amount = '[ \\t:]*' + '(?:' + currency + '[ \\t]*)?' + TEXT_MONEY
  const explicit = new RegExp(
    '\\b(?:Gesamtbetrag(?:[ \\t]+brutto)?|Bruttobetrag|Brutto(?:summe)?|Summe[ \\t]+brutto|Endbetrag)\\b(?:' +
      amount +
      ')?',
    'gi'
  )
  const generic = new RegExp('^[ \\t]*(?:Summe|Total)\\b' + amount, 'gim')
  const labels = [...text.matchAll(explicit)]
  const preferred = labels.length > 0
  const amounts = [
    ...new Set(
      (preferred ? labels : [...text.matchAll(generic)]).map((match) =>
        cents(match[1], true)
      )
    ),
  ]
  if (preferred && amounts.includes(null)) {
    return {
      gross: null,
      reason: 'Ein Brutto- oder Gesamtbetrag konnte nicht gelesen werden.',
    }
  }
  if (amounts.length > 1) {
    return { gross: null, reason: 'Mehrere unterschiedliche Summen gefunden.' }
  }
  return { gross: amounts[0] ?? null }
}

function textCurrency(text) {
  const explicit = /\bWährung[ \t]*:?[ \t]*([A-Z]{3})\b/.exec(text)?.[1]
  if (explicit) return explicit
  const tokens = new Set(
    text.match(/\b(?:EUR|USD|GBP|CHF|CAD|AUD|JPY|PLN|DKK|NOK|SEK|CZK)\b/g) || []
  )
  if (text.includes('€')) tokens.add('EUR')
  return tokens.size === 1 ? [...tokens][0] : 'XXX'
}

function normalizeCredit(fields) {
  if (fields.kind === 'gutschrift' && fields.gross_cents < 0) {
    fields.gross_cents = -fields.gross_cents
    for (const line of fields.vat_lines) {
      if (line.net_cents != null) line.net_cents = -line.net_cents
      if (line.vat_cents != null) line.vat_cents = -line.vat_cents
    }
  }
}

function extractText(text, today) {
  const capture = (pattern) => pattern.exec(text)?.[1] || null
  const supplier =
    capture(/^[ \t]*(?:Lieferant|Verkäufer|Aussteller)\s*:\s*([^\r\n]+)/im) ||
    capture(
      /^\s*(.{2,160}\b(?:GmbH(?:\s*&\s*Co\.\s*KG)?|UG|e\.\s*K\.|AG|KG))\s*$/im
    )
  const ibanToken =
    capture(/\b(DE\s*\d{2}(?:\s*\d{4}){4}\s*\d{2})(?!\d)/i) ||
    capture(/\bIBAN[^\S\r\n]*:?[ \t]*([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/i)
  const vatToken = capture(
    /(?:USt[-.\s]*Id(?:Nr)?\.?|Umsatzsteuer[-\s]*Identifikationsnummer|VAT[ \t]+ID)[ \t.:]*([A-Z]{2}(?:[ \t]*[0-9]){9}|[A-Z]{2}[A-Z0-9]{5,14})\b/i
  )
  const documentDate = capture(
    new RegExp(
      '(?:Rechnungsdatum|Belegdatum|Ausstellungsdatum|^\\s*Datum)[: \\t]*' +
        TEXT_DATE,
      'im'
    )
  )
  const due = capture(
    new RegExp(
      '(?:Fällig(?:keitsdatum|[ \\t]+am)?|Zahlbar[ \\t]+bis)[: \\t]*' +
        TEXT_DATE,
      'i'
    )
  )
  const { gross, reason: grossReason } = textGross(text)
  const discount = /\b(\d{1,2}(?:,\d{1,3})?)\s*%\s+Skonto\b/i.exec(text)
  const discountDate = capture(
    new RegExp('Skonto[^\\r\\n]*?\\bbis[ \\t]+' + TEXT_DATE, 'i')
  )
  const vat_lines = []
  const vatRow = new RegExp(
    '^\\s*(?:USt\\.?|MwSt\\.?|Umsatzsteuer)?[ \\t]*(\\d{1,3}(?:,\\d{1,3})?)[ \\t]*%[ \\t]+' +
      TEXT_MONEY +
      '[ \\t]+' +
      TEXT_MONEY +
      '(?:[ \\t]+' +
      TEXT_MONEY +
      ')?[ \\t]*€?[ \\t]*$',
    'gim'
  )
  const flags = {}
  if (grossReason) flags.gross_cents = grossReason
  for (const row of text.matchAll(vatRow)) {
    const net_cents = cents(row[2], true)
    const vat_cents = cents(row[3], true)
    const vatRate = rate(row[1])
    if (vatRate == null || net_cents == null || vat_cents == null) continue
    const rowGross = cents(row[4], true)
    if (rowGross != null && Math.abs(net_cents + vat_cents - rowGross) > 1) {
      flags.vat_lines =
        'Netto plus Umsatzsteuer weicht im ausgewiesenen Steuersatz vom Brutto ab.'
    }
    vat_lines.push({ rate: vatRate, net_cents, vat_cents })
  }
  const kind =
    gross < 0 || /^\s*Gutschrift\b/im.test(text)
      ? 'gutschrift'
      : /^\s*(Kassenbeleg|Kassenbon)\b/im.test(text)
      ? 'kassenbeleg'
      : 'eingangsrechnung'
  const fields = {
    kind,
    supplier_name: supplier?.trim() || null,
    supplier_vat_id: vatId(vatToken),
    supplier_iban: isValidIban(ibanToken) ? normalizeIban(ibanToken) : null,
    invoice_number: capture(
      /(?:Rechnungs[-\s]*(?:nummer|nr\.?|#)|Beleg[-\s]*(?:nummer|nr\.?))[ \t:]*([\p{L}\p{N}][\p{L}\p{N}./_-]{0,99})/iu
    ),
    invoice_date: date(documentDate),
    due_date: date(due),
    gross_cents: gross,
    currency: textCurrency(text),
    payment: /\bLastschrift\b/i.test(text)
      ? 'lastschrift'
      : /\b(?:Bar bezahlt|Barzahlung)\b/i.test(text)
      ? 'bar'
      : /\b(?:Kartenzahlung|Kartenzahlung erfolgt)\b/i.test(text)
      ? 'karte'
      : /\bÜberweisung\b/i.test(text)
      ? 'ueberweisung'
      : 'offen',
    skonto_rate: discountDate ? rate(discount?.[1]) : null,
    skonto_due_date: date(discountDate),
    vat_lines,
  }
  if (ibanToken && !fields.supplier_iban)
    flags.supplier_iban = 'Die IBAN-Prüfziffer ist ungültig.'
  if (vatToken && !fields.supplier_vat_id)
    flags.supplier_vat_id = 'Die USt-IdNr. hat ein ungültiges Format.'
  if (due && !fields.due_date) flags.due_date = 'Die Fälligkeit ist ungültig.'
  if (discount && !fields.skonto_due_date)
    flags.skonto_rate = 'Zum Skonto wurde keine eindeutige Frist gefunden.'
  normalizeCredit(fields)
  return result(fields, 'textlayer', today, flags)
}

const children = (node, name) =>
  node?.children.filter((item) => item.name === name) || []
const at = (node, ...names) =>
  names.reduce((current, name) => children(current, name)[0], node)
const value = (node, ...names) => at(node, ...names)?.text.trim() || null

function mappedVat(nodes, names, isVat) {
  return nodes.filter(isVat).map((node) => ({
    rate: rate(value(node, ...names[0])),
    net_cents: cents(value(node, names[1])),
    vat_cents: cents(value(node, names[2])),
  }))
}

function mapUbl(root) {
  const supplier = at(root, 'AccountingSupplierParty', 'Party')
  const means = at(root, 'PaymentMeans')
  const totals = at(root, 'LegalMonetaryTotal')
  const taxTotal = children(root, 'TaxTotal').find(
    (node) => children(node, 'TaxSubtotal').length > 0
  )
  const taxScheme = children(supplier, 'PartyTaxScheme').find(
    (node) => value(node, 'TaxScheme', 'ID') === 'VAT'
  )
  return {
    kind:
      root.name === 'CreditNote' || value(root, 'InvoiceTypeCode') === '381'
        ? 'gutschrift'
        : 'eingangsrechnung',
    supplier_name:
      value(supplier, 'PartyLegalEntity', 'RegistrationName') ||
      value(supplier, 'PartyName', 'Name'),
    supplier_vat_id: value(taxScheme, 'CompanyID'),
    supplier_iban: value(means, 'PayeeFinancialAccount', 'ID'),
    invoice_number: value(root, 'ID'),
    invoice_date: value(root, 'IssueDate'),
    due_date:
      value(root, 'DueDate') ||
      value(means, 'PaymentDueDate') ||
      value(root, 'PaymentTerms', 'PaymentDueDate'),
    gross_cents: cents(value(totals, 'TaxInclusiveAmount')),
    currency:
      value(root, 'DocumentCurrencyCode') ||
      at(totals, 'TaxInclusiveAmount')?.attrs.currencyID,
    payment: paymentCode(value(means, 'PaymentMeansCode')),
    vat_lines: mappedVat(
      children(taxTotal, 'TaxSubtotal'),
      [['TaxCategory', 'Percent'], 'TaxableAmount', 'TaxAmount'],
      (item) => value(item, 'TaxCategory', 'TaxScheme', 'ID') === 'VAT'
    ),
  }
}

function mapCii(root) {
  const document = at(root, 'ExchangedDocument')
  const trade = at(root, 'SupplyChainTradeTransaction')
  const supplier = at(
    trade,
    'ApplicableHeaderTradeAgreement',
    'SellerTradeParty'
  )
  const settlement = at(trade, 'ApplicableHeaderTradeSettlement')
  const means = at(settlement, 'SpecifiedTradeSettlementPaymentMeans')
  const terms = at(settlement, 'SpecifiedTradePaymentTerms')
  const taxRegistration = children(supplier, 'SpecifiedTaxRegistration').find(
    (node) => at(node, 'ID')?.attrs.schemeID === 'VA'
  )
  const total = at(
    settlement,
    'SpecifiedTradeSettlementHeaderMonetarySummation'
  )
  return {
    kind:
      value(document, 'TypeCode') === '381' ? 'gutschrift' : 'eingangsrechnung',
    supplier_name: value(supplier, 'Name'),
    supplier_vat_id: value(taxRegistration, 'ID'),
    supplier_iban: value(means, 'PayeePartyCreditorFinancialAccount', 'IBANID'),
    invoice_number: value(document, 'ID'),
    invoice_date: value(document, 'IssueDateTime', 'DateTimeString'),
    due_date: value(terms, 'DueDateDateTime', 'DateTimeString'),
    gross_cents: cents(value(total, 'GrandTotalAmount')),
    currency:
      value(settlement, 'InvoiceCurrencyCode') ||
      at(total, 'GrandTotalAmount')?.attrs.currencyID,
    payment: paymentCode(value(means, 'TypeCode')),
    vat_lines: mappedVat(
      children(settlement, 'ApplicableTradeTax'),
      [['RateApplicablePercent'], 'BasisAmount', 'CalculatedAmount'],
      (item) => value(item, 'TypeCode') === 'VAT'
    ),
  }
}

function extractXml(root, today) {
  const fields =
    root.name === 'CrossIndustryInvoice' &&
    root.uri === 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'
      ? mapCii(root)
      : ['Invoice', 'CreditNote'].includes(root.name) &&
        root.uri ===
          'urn:oasis:names:specification:ubl:schema:xsd:' + root.name + '-2'
      ? mapUbl(root)
      : null
  if (!fields) return null
  fields.skonto_rate = null
  const flags = {}
  const terms =
    root.name === 'CrossIndustryInvoice'
      ? at(
          root,
          'SupplyChainTradeTransaction',
          'ApplicableHeaderTradeSettlement',
          'SpecifiedTradePaymentTerms'
        )
      : at(root, 'PaymentTerms')
  if (
    at(terms, 'ApplicableTradePaymentDiscountTerms') ||
    at(terms, 'SettlementDiscountPercent') ||
    /skonto/i.test(value(terms, 'Description') || value(terms, 'Note') || '')
  ) {
    flags.skonto_rate =
      'Im Original ist Skonto angegeben. Bitte Satz und Frist prüfen.'
  }
  for (const key of ['invoice_date', 'due_date', 'skonto_due_date']) {
    if (fields[key] && !date(fields[key]))
      flags[key] = 'Das Datum in der XML ist ungültig.'
    fields[key] = date(fields[key])
  }
  if (fields.supplier_iban && !isValidIban(fields.supplier_iban)) {
    flags.supplier_iban = 'Die IBAN-Prüfziffer in der XML ist ungültig.'
    fields.supplier_iban = null
  } else if (fields.supplier_iban)
    fields.supplier_iban = normalizeIban(fields.supplier_iban)
  if (fields.supplier_vat_id && !vatId(fields.supplier_vat_id)) {
    flags.supplier_vat_id =
      'Die USt-IdNr. in der XML hat ein ungültiges Format.'
    fields.supplier_vat_id = null
  }
  if (!fields.currency || !/^[A-Z]{3}$/.test(fields.currency)) {
    flags.currency = 'Keine gültige Währung in der XML ausgewiesen.'
    fields.currency = 'XXX'
  }
  normalizeCredit(fields)
  if (
    fields.vat_lines.some((line) =>
      Object.values(line).some((item) => item == null)
    )
  ) {
    flags.vat_lines = 'Mindestens eine USt-Zeile der XML ist unvollständig.'
    fields.vat_lines = fields.vat_lines.filter((line) =>
      Object.values(line).every((item) => item != null)
    )
  }
  return result(fields, 'xml', today, flags)
}

module.exports = {
  KINDS,
  UNKNOWN_CURRENCY,
  MISSING_GROSS,
  PAYMENTS,
  FIELDS,
  checkFields,
  missingRequiredFields,
  mergeTextResult,
  extractText,
  extractXml,
  cents,
  date,
  rate,
  vatId,
}
