'use strict'

const {
  counterpartyKey,
  sanitizeTransaction,
} = require('./finance-transactions.core')
const {
  addDays,
  isIsoDate,
  normalizeIban,
  numberKey,
} = require('./invoice.core')

const DAYS_BEFORE_INVOICE = 3
const DAYS_AFTER_DUE = 14
const DAYS_WITHOUT_DUE = 45
const SNAPSHOT_DAYS = 3
const SIMILAR_SCORE = 8
const MAX_GROUP_SIZE = 6
const GROUP_SEARCH_BUDGET = 20000

function booking(raw) {
  const view = sanitizeTransaction(raw)
  if (!view || raw.amount == null || !isIsoDate(view.booking_date)) return null
  const cents = Math.round(view.amount * 100)
  if (!Number.isSafeInteger(cents) || cents === 0) return null
  return {
    ...view,
    cents,
    iban: normalizeIban(raw.counterparty_iban),
    key: counterpartyKey(view.counterparty),
    direct_debit:
      view.direct_debit || /lastschrift/i.test(view.booking_text || ''),
  }
}

function directionFits(target, tx) {
  const incoming =
    target.kind === 'invoice' || target.receipt_kind === 'gutschrift'
  return incoming ? tx.cents > 0 : tx.cents < 0
}

/** Datumsfenster als Ausschnitt der nach Buchungstag sortierten Bankdaten. */
function* inWindow(target, sorted) {
  if (!target.invoice_date) return
  const from = addDays(target.invoice_date, -DAYS_BEFORE_INVOICE)
  const to = target.due_date
    ? addDays(target.due_date, DAYS_AFTER_DUE)
    : addDays(target.invoice_date, DAYS_WITHOUT_DUE)
  let lower = 0
  let upper = sorted.length
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (sorted[middle].booking_date < from) lower = middle + 1
    else upper = middle
  }
  for (
    let index = lower;
    index < sorted.length && sorted[index].booking_date <= to;
    index++
  ) {
    yield sorted[index]
  }
}

function comparison(target) {
  const number = numberKey(target.invoice_number)
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return {
    iban: normalizeIban(target.supplier_iban),
    name: counterpartyKey(target.supplier_name),
    reference: number
      ? new RegExp(
          '(?:^|[^\\p{L}\\p{N}_])' + escaped + '(?:$|[^\\p{L}\\p{N}_])',
          'u'
        )
      : null,
  }
}

function evidence(expected, tx) {
  const iban = Boolean(tx.iban && expected.iban === tx.iban)
  const name = Boolean(tx.key && expected.name === tx.key)
  const reference = Boolean(expected.reference?.test(numberKey(tx.purpose)))
  return {
    iban,
    name,
    reference,
    score: (iban ? 42 : name ? 25 : 0) + (reference ? 65 : 0),
  }
}

function sameSnapshot(link, tx) {
  return Boolean(
    tx.currency === 'EUR' &&
      link.counterparty_key &&
      link.counterparty_key === tx.key &&
      link.booking_amount_cents === tx.cents &&
      tx.booking_date >= addDays(link.booking_date, -SNAPSHOT_DAYS) &&
      tx.booking_date <= addDays(link.booking_date, SNAPSHOT_DAYS)
  )
}

function replacementBookings(link, bookings) {
  return bookings.some((tx) => link.transaction_id === tx.id)
    ? []
    : bookings.filter((tx) => sameSnapshot(link, tx))
}

const targetKey = (target) => target.kind + ':' + target.target_id

function balances(links) {
  const byTarget = new Map()
  const byBooking = new Map()
  const byPair = new Map()
  for (const link of links) {
    const key = targetKey(link)
    if (!byPair.has(key)) byPair.set(key, [])
    byPair.get(key).push(link)
    if (link.status !== 'bestaetigt') continue
    byTarget.set(
      key,
      (byTarget.get(key) || 0) + link.amount_cents + (link.discount_cents || 0)
    )
    byBooking.set(
      link.transaction_id,
      (byBooking.get(link.transaction_id) || 0) + link.amount_cents
    )
  }
  return { byTarget, byBooking, byPair }
}

function availableTarget(target, amounts) {
  return Math.max(
    0,
    target.gross_cents - (amounts.byTarget.get(targetKey(target)) || 0)
  )
}

function availableBooking(tx, amounts) {
  return Math.max(0, Math.abs(tx.cents) - (amounts.byBooking.get(tx.id) || 0))
}

function eligible(target, tx) {
  return (
    target.currency === 'EUR' &&
    tx.currency === 'EUR' &&
    target.gross_cents > 0 &&
    target.payment !== 'bar' &&
    target.status !== 'verworfen' &&
    directionFits(target, tx)
  )
}

function matchingSubsets(entries, total, amount) {
  if (entries.length < 2) return []
  const found = []
  const sorted = [...entries].sort((a, b) => amount(a) - amount(b))
  let budget = GROUP_SEARCH_BUDGET
  function search(from, remaining, path) {
    if (remaining === 0) {
      if (path.length >= 2) found.push(path)
      return
    }
    if (path.length === MAX_GROUP_SIZE) return
    for (let index = from; index < sorted.length && budget > 0; index++) {
      budget--
      const entry = sorted[index]
      const cents = amount(entry)
      if (cents > remaining) break
      search(index + 1, remaining - cents, [...path, entry])
    }
  }
  search(0, total, [])
  return found
}

function part(target, tx, amount_cents, discount_cents = 0) {
  return {
    kind: target.kind,
    target_id: target.target_id,
    transaction_id: tx.id,
    amount_cents,
    discount_cents,
  }
}

function proposeMatches(targets, bookings, links) {
  const amounts = balances(links)
  const offers = []
  const bookingIds = new Set(bookings.map((tx) => tx.id))
  const sortedBookings = [...bookings].sort((a, b) =>
    a.booking_date.localeCompare(b.booking_date)
  )
  const byDebit = new Map()
  for (const target of targets) {
    const open = availableTarget(target, amounts)
    if (!open) continue
    const expected = comparison(target)
    const partials = []
    const related = amounts.byPair.get(targetKey(target)) || []
    for (const tx of inWindow(target, sortedBookings)) {
      const free = availableBooking(tx, amounts)
      if (!free || !eligible(target, tx)) continue
      if (
        related.some(
          (link) =>
            link.transaction_id === tx.id ||
            (link.status === 'abgelehnt' &&
              !bookingIds.has(link.transaction_id) &&
              sameSnapshot(link, tx))
        )
      )
        continue
      const proof = evidence(expected, tx)
      const known = proof.iban || proof.name || proof.reference
      const base = 12 + proof.score
      if (open === free && (target.kind === 'receipt' || known)) {
        offers.push({
          type: 'betrag',
          score: base + 60,
          parts: [part(target, tx, free)],
        })
        continue
      }
      const discount =
        target.skonto_rate > 0 &&
        target.skonto_rate < 100 &&
        target.skonto_due_date &&
        target.skonto_due_date >= target.invoice_date &&
        (!target.due_date || target.skonto_due_date <= target.due_date) &&
        tx.booking_date <= target.skonto_due_date &&
        open === target.gross_cents
          ? Math.round((open * target.skonto_rate) / 100)
          : 0
      if (discount && free === open - discount) {
        offers.push({
          type: 'skonto',
          score: base + 38,
          parts: [part(target, tx, free, discount)],
        })
        continue
      }
      if (free < open && known) {
        const entry = { target, tx, score: base, cents: free }
        partials.push(entry)
        offers.push({
          type: 'teilzahlung',
          score: base + 14,
          parts: [part(target, tx, free)],
        })
      }
      if (
        tx.direct_debit &&
        free > open &&
        target.kind === 'receipt' &&
        (proof.iban || proof.name)
      ) {
        if (!byDebit.has(tx.id)) byDebit.set(tx.id, [])
        byDebit
          .get(tx.id)
          .push({ target, tx, expected, score: base, cents: open })
      }
    }
    for (const group of matchingSubsets(
      partials,
      open,
      (entry) => entry.cents
    )) {
      offers.push({
        type: 'teilzahlungen',
        score: Math.min(...group.map((entry) => entry.score)) + 64,
        parts: group.map((entry) => part(target, entry.tx, entry.cents)),
      })
    }
  }

  for (const candidates of byDebit.values()) {
    const groups = new Map()
    for (const candidate of candidates) {
      const { expected, tx } = candidate
      const keys = []
      if (expected.name) keys.push('name:' + expected.name)
      if (expected.iban && expected.iban === tx.iban)
        keys.push('iban:' + expected.iban)
      for (const key of keys) {
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(candidate)
      }
    }
    const seen = new Set()
    for (const entries of groups.values()) {
      const total = availableBooking(entries[0].tx, amounts)
      for (const group of matchingSubsets(
        entries,
        total,
        (entry) => entry.cents
      )) {
        const key = group
          .map((entry) => entry.target.target_id)
          .sort()
          .join(':')
        if (seen.has(key)) continue
        seen.add(key)
        offers.push({
          type: 'sammellastschrift',
          score: Math.min(...group.map((entry) => entry.score)) + 62,
          parts: group.map((entry) =>
            part(entry.target, entry.tx, entry.cents)
          ),
        })
      }
    }
  }

  return offers.sort((a, b) => b.score - a.score)
}

function markAmbiguity(offers) {
  const byItem = new Map()
  for (const offer of offers) {
    const keys = new Set(
      offer.parts.flatMap((entry) => [targetKey(entry), entry.transaction_id])
    )
    for (const key of keys) {
      if (!byItem.has(key)) byItem.set(key, [])
      byItem.get(key).push(offer)
    }
  }
  const ambiguous = new Set()
  for (const ranked of byItem.values()) {
    for (let index = 1; index < ranked.length; index++) {
      if (ranked[index - 1].score - ranked[index].score <= SIMILAR_SCORE) {
        ambiguous.add(ranked[index - 1])
        ambiguous.add(ranked[index])
      }
    }
  }
  return offers.map((offer) => ({ ...offer, ambiguous: ambiguous.has(offer) }))
}

function expensesWithoutReceipt(bookings, links, exclusions) {
  const confirmed = balances(links).byBooking
  return bookings.filter(
    (tx) =>
      tx.cents < 0 && !confirmed.has(tx.id) && !exclusions.includes(tx.category)
  )
}

module.exports = {
  booking,
  targetKey,
  balances,
  availableTarget,
  availableBooking,
  eligible,
  replacementBookings,
  matchingSubsets,
  proposeMatches,
  markAmbiguity,
  expensesWithoutReceipt,
}
