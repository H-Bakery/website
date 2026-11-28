import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Request } from 'express'
import type { Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { AuditLog, getSequelize, Invoice } from '../models'
import { insert, ReceiptError, select, update } from './receipt-db'
import type {
  Booking,
  LinkPart,
  LinkRow,
  MatchTarget,
  Offer,
  ReceiptRow,
} from './receipt-types'
import { receiptId, redactIban } from './receipts.service'

import { createFinanceTransactionSource } from './finance-transaction-source'
import { isValidId } from './finance-transactions.core'
import * as core from './receipt-matching.core'

export interface ReceiptLinksOptions {
  financeDir?: string
  log?: Pick<Console, 'warn'>
}

export function bookingId(value: unknown): string {
  if (!isValidId(value))
    throw new ReceiptError(
      400,
      'invalid_booking_id',
      'Die Buchungs-ID ist ungültig.'
    )
  return value as string
}

function publicBooking(tx: Booking) {
  return {
    id: tx.id,
    booking_date: tx.booking_date,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    category: redactIban(tx.category),
    counterparty: redactIban(tx.counterparty),
    booking_text: redactIban(tx.booking_text),
    purpose: redactIban(tx.purpose),
  }
}

function publicTarget(target: MatchTarget) {
  return {
    kind: target.kind,
    target_id: target.target_id,
    name: redactIban(target.supplier_name),
    invoice_number: redactIban(target.invoice_number),
  }
}

function proposalId(offer: Offer) {
  const entries = offer.parts
    .map((part) =>
      [
        part.kind,
        part.target_id,
        part.transaction_id,
        part.amount_cents,
        part.discount_cents,
      ].join(':')
    )
    .sort()
  return createHash('sha256').update(entries.join('|')).digest('hex')
}

const GROUP_REJECTION_ENTITY = 'transaction_link_proposal'

interface MatchScope {
  month?: string
  receiptId?: number
  bookingId?: string
}

export class ReceiptLinksService {
  private readonly source: ReturnType<typeof createFinanceTransactionSource>

  constructor(options: ReceiptLinksOptions = {}) {
    this.source = createFinanceTransactionSource(options)
  }

  private readBookings() {
    const months = new Set<string>()
    const byId = new Map<string, Booking>()
    for (const month of this.source.transactionMonths()) {
      const rows = this.source.readMonth(month)
      if (!rows) continue
      months.add(month)
      for (const row of rows) {
        const tx = core.booking(row) as Booking | null
        if (tx) byId.set(tx.id, tx)
      }
    }
    return { months, byId, bookings: [...byId.values()] }
  }

  private async state(transaction?: Transaction) {
    const { months, byId, bookings } = this.readBookings()
    const [receipts, invoices, links, rejections] = await Promise.all([
      select<ReceiptRow>(
        "SELECT * FROM receipts WHERE status != 'verworfen'",
        {},
        transaction
      ),
      Invoice.findAll({
        where: { status: 'ausgestellt', paid: false },
        attributes: [
          'id',
          'number',
          'buyerName',
          'invoiceDate',
          'dueDate',
          'totals',
        ],
        transaction,
      }),
      select<LinkRow>(
        'SELECT * FROM transaction_links ORDER BY id',
        {},
        transaction
      ),
      AuditLog.findAll({
        where: { entity: GROUP_REJECTION_ENTITY, action: 'reject' },
        attributes: ['entityId'],
        transaction,
      }),
    ])
    const targets: MatchTarget[] = [
      ...receipts.map((row) => ({
        ...row,
        kind: 'receipt' as const,
        receipt_kind: row.kind,
        target_id: row.id,
      })),
      ...invoices.map((invoice) => {
        const totals = invoice.totals?.['totals'] as
          | Record<string, number | undefined>
          | undefined
        return {
          kind: 'invoice' as const,
          target_id: invoice.id,
          status: 'ausgestellt',
          supplier_name: invoice.buyerName,
          supplier_iban: null,
          invoice_number: invoice.number,
          invoice_date: invoice.invoiceDate,
          due_date: invoice.dueDate,
          gross_cents: totals?.['payableCents'] ?? totals?.['dueCents'] ?? null,
          currency: 'EUR',
          payment: 'ueberweisung',
        }
      }),
    ]
    const byTarget = new Map(
      targets.map((target) => [core.targetKey(target) as string, target])
    )
    const rejectedGroups = new Set(rejections.map((entry) => entry.entityId))
    return { months, byId, bookings, links, targets, byTarget, rejectedGroups }
  }

  private offers(
    state: Awaited<ReturnType<ReceiptLinksService['state']>>,
    scope: MatchScope
  ) {
    const { targets, bookings, links, byId, byTarget, rejectedGroups } = state
    const sorted = core.proposeMatches(targets, bookings, links) as Offer[]
    const visible = sorted.filter(
      (offer) =>
        !(offer.parts.length > 1 && rejectedGroups.has(proposalId(offer))) &&
        offer.parts.some((part) => {
          if (
            scope.receiptId !== undefined &&
            (part.kind !== 'receipt' || part.target_id !== scope.receiptId)
          )
            return false
          if (scope.bookingId && part.transaction_id !== scope.bookingId)
            return false
          if (!scope.month) return true
          return (
            byId
              .get(part.transaction_id)
              ?.booking_date.startsWith(scope.month) ||
            byTarget
              .get(core.targetKey(part))
              ?.invoice_date?.startsWith(scope.month)
          )
        })
    )
    return core.markAmbiguity(visible) as Offer[]
  }

  async matches(scope: MatchScope) {
    const state = await this.state()
    const { byId, byTarget, links, bookings, months } = state
    const proposals = this.offers(state, scope).map((offer) => ({
      ...offer,
      id: proposalId(offer),
      status: 'vorgeschlagen' as const,
      parts: offer.parts.map((part) => ({
        ...part,
        booking: publicBooking(byId.get(part.transaction_id)),
        target: publicTarget(byTarget.get(core.targetKey(part))),
      })),
    }))
    const confirmed = links.filter(
      (link) =>
        link.status === 'bestaetigt' &&
        (scope.receiptId === undefined ||
          (link.kind === 'receipt' && link.target_id === scope.receiptId)) &&
        (!scope.month || link.booking_date.startsWith(scope.month))
    )
    const displayed = confirmed
      .map((link) => {
        const current = byId.get(link.transaction_id)
        const replacements = current
          ? []
          : (core.replacementBookings(link, bookings) as Booking[])
        if (
          scope.bookingId &&
          link.transaction_id !== scope.bookingId &&
          !replacements.some((tx) => tx.id === scope.bookingId)
        )
          return null
        const target = byTarget.get(core.targetKey(link))
        return {
          id: link.id,
          transaction_id: link.transaction_id,
          kind: link.kind,
          target_id: link.target_id,
          amount_cents: link.amount_cents,
          discount_cents: link.discount_cents,
          booking_date: link.booking_date,
          booking: current ? publicBooking(current) : null,
          target: target ? publicTarget(target) : null,
          review_required: !current,
          replacements: replacements.map(publicBooking),
        }
      })
      .filter(Boolean)
    return {
      month: scope.month ?? null,
      available: scope.month ? months.has(scope.month) : months.size > 0,
      proposals,
      links: displayed,
    }
  }

  async receiptWithoutBooking<
    T extends Pick<ReceiptRow, 'id' | 'status' | 'payment'>
  >(receipts: T[]): Promise<T[]> {
    const [links, bank] = await Promise.all([
      select<LinkRow>(
        "SELECT * FROM transaction_links WHERE kind = 'receipt' AND status = 'bestaetigt'"
      ),
      this.readBookings(),
    ])
    const linked = new Set(
      links
        .filter((link) => bank.byId.has(link.transaction_id))
        .map((link) => link.target_id)
    )
    return receipts.filter(
      (row) =>
        row.status !== 'verworfen' &&
        row.payment !== 'bar' &&
        !linked.has(row.id)
    )
  }

  expensesWithoutReceipt(month: string) {
    const raw = this.source.readMonth(month)
    if (!raw)
      return Promise.resolve({ month, available: false, transactions: [] })
    const bookings = raw
      .map((row: unknown) => core.booking(row))
      .filter(Boolean) as Booking[]
    return select<LinkRow>(
      "SELECT * FROM transaction_links WHERE status = 'bestaetigt'"
    ).then((links) => ({
      month,
      available: true,
      transactions: (
        core.expensesWithoutReceipt(
          bookings,
          links,
          this.excludedCategories()
        ) as (Booking & { remaining_cents: number })[]
      ).map((tx) => ({
        ...publicBooking(tx),
        remaining_cents: tx.remaining_cents,
      })),
    }))
  }

  private excludedCategories(): string[] {
    try {
      const config = JSON.parse(
        readFileSync(
          path.join(
            this.source.financeDir,
            'config',
            'receipt-exclusions.json'
          ),
          'utf8'
        )
      )
      if (
        Array.isArray(config.excluded_categories) &&
        config.excluded_categories.every(
          (category: unknown) =>
            typeof category === 'string' && /^[a-z0-9_-]{1,80}$/.test(category)
        )
      )
        return config.excluded_categories
      this.source.log.warn(
        '[finance] Konfiguration für Belegausnahmen ist ungültig.'
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.source.log.warn(
          '[finance] Konfiguration für Belegausnahmen konnte nicht gelesen werden.'
        )
    }
    return []
  }

  bookingHint(id: string) {
    const tx = this.readBookings().byId.get(id)
    return tx ? publicBooking(tx) : null
  }

  async receiptBookingHint(
    id: string,
    receipt: Pick<
      ReceiptRow,
      'id' | 'kind' | 'status' | 'gross_cents' | 'currency' | 'payment'
    >
  ) {
    const tx = this.readBookings().byId.get(id)
    if (!tx) return null
    const target = {
      ...receipt,
      kind: 'receipt',
      target_id: receipt.id,
      receipt_kind: receipt.kind,
    }
    let allocation = null
    if (core.eligible(target, tx)) {
      const links = await select<LinkRow>(
        `SELECT * FROM transaction_links WHERE status = 'bestaetigt'
         AND (transaction_id = $id OR (kind = 'receipt' AND target_id = $receipt))`,
        { id, receipt: receipt.id }
      )
      allocation = core.allocationAmounts(target, tx, core.balances(links))
    }
    return { ...publicBooking(tx), allocation }
  }

  async decide(
    body: Record<string, unknown> | undefined,
    rejectedId: string | null,
    req: Request,
    now: string
  ) {
    return getSequelize().transaction(async (transaction) => {
      const state = await this.state(transaction)
      const proposal = rejectedId ?? body?.['proposal_id']
      if (proposal !== undefined) {
        if (typeof proposal !== 'string' || !/^[a-f0-9]{64}$/.test(proposal)) {
          throw new ReceiptError(
            400,
            'invalid_proposal_id',
            'Die Vorschlags-ID ist ungültig.'
          )
        }
        const offer = this.offers(state, {}).find(
          (candidate) => proposalId(candidate) === proposal
        )
        if (!offer)
          throw new ReceiptError(
            409,
            'proposal_changed',
            'Der Vorschlag hat sich geändert. Bitte lade die Ansicht neu.'
          )
        if (rejectedId && offer.parts.length > 1) {
          // Den Gruppenvorschlag als Ganzes ablehnen. Seine Einzelteile
          // können weiterhin zu anderen plausiblen Vorschlägen gehören.
          await audit(
            req,
            'reject',
            GROUP_REJECTION_ENTITY,
            proposal,
            {
              type: offer.type,
              parts: offer.parts,
            },
            { transaction }
          )
          return { ids: [] }
        }
        const ids: number[] = []
        for (const part of offer.parts) {
          ids.push(
            await this.record(
              part,
              state.byId.get(part.transaction_id),
              rejectedId ? 'abgelehnt' : 'bestaetigt',
              'auto',
              offer.score,
              req,
              now,
              transaction
            )
          )
        }
        return { ids }
      }

      const id = bookingId(body?.['transaction_id'])
      const kind = body?.['kind']
      if (kind !== 'invoice' && kind !== 'receipt')
        throw new ReceiptError(
          422,
          'invalid_link_kind',
          'Bitte Beleg oder Rechnung auswählen.'
        )
      const target_id = receiptId(body?.['target_id'])
      const target = state.byTarget.get(core.targetKey({ kind, target_id }))
      const tx = state.byId.get(id)
      if (!target || !tx)
        throw new ReceiptError(
          404,
          'link_target_not_found',
          'Beleg, Rechnung oder Buchung wurde nicht gefunden.'
        )
      if (!core.eligible(target, tx))
        throw new ReceiptError(
          422,
          'link_ineligible',
          'Bitte prüfe Betrag, Währung, Richtung und Zahlungsart.'
        )
      const previous = state.links.find(
        (link) =>
          link.transaction_id === id &&
          link.kind === kind &&
          link.target_id === target_id
      )
      if (previous?.status === 'bestaetigt') return { ids: [previous.id] }

      const replace = body?.['replace_link_id']
      let stale: LinkRow | undefined
      if (replace !== undefined) {
        stale = state.links.find((link) => link.id === receiptId(replace))
        if (
          !stale ||
          stale.kind !== kind ||
          stale.target_id !== target_id ||
          stale.status !== 'bestaetigt' ||
          !core
            .replacementBookings(stale, state.bookings)
            .some((item: Booking) => item.id === id)
        ) {
          throw new ReceiptError(
            409,
            'invalid_replacement',
            'Die Ersatzbuchung passt nicht zur bisherigen Verknüpfung.'
          )
        }
      }
      const amounts = core.balances(
        state.links.filter((link) => link !== stale)
      )
      const { max_cents, receipt_open_cents } = core.allocationAmounts(
        target,
        tx,
        amounts
      )
      const amount = stale?.amount_cents ?? body?.['amount_cents'] ?? max_cents
      const discount = stale?.discount_cents ?? 0
      if (
        typeof amount !== 'number' ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > max_cents ||
        amount + discount > receipt_open_cents
      ) {
        throw new ReceiptError(
          422,
          'invalid_link_amount',
          'Der Teilbetrag muss in den offenen Betrag von Buchung und Beleg passen.'
        )
      }
      if (stale) {
        await update(
          'transaction_links',
          stale.id,
          { status: 'abgelehnt' },
          transaction
        )
        await audit(
          req,
          'replace',
          'transaction_link',
          stale.id,
          { before: stale.transaction_id, after: id },
          { transaction }
        )
      }
      return {
        ids: [
          await this.record(
            {
              transaction_id: id,
              kind,
              target_id,
              amount_cents: amount,
              discount_cents: discount,
            },
            tx,
            'bestaetigt',
            'manual',
            null,
            req,
            now,
            transaction,
            previous
          ),
        ],
      }
    })
  }

  private async record(
    part: LinkPart,
    booking: Booking,
    status: 'bestaetigt' | 'abgelehnt',
    by: 'auto' | 'manual',
    score: number | null,
    req: Request,
    now: string,
    transaction: Transaction,
    previous?: LinkRow
  ) {
    const row = {
      ...part,
      status,
      matched_by: by,
      score,
      confirmed_by: req.user?.id ?? null,
      confirmed_at: now,
      booking_date: booking.booking_date,
      booking_amount_cents: booking.cents,
      counterparty_key: booking.key,
    }
    let id: number
    if (previous) {
      id = previous.id
      await update('transaction_links', id, row, transaction)
    } else {
      id = await insert('transaction_links', row, transaction)
    }
    await audit(
      req,
      status === 'bestaetigt' ? 'confirm' : 'reject',
      'transaction_link',
      id,
      { previous_status: previous?.status ?? null, ...part },
      { transaction }
    )
    return id
  }
}
