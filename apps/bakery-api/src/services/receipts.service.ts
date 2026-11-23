import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import type { Request } from 'express'
import { QueryTypes, type Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { getSequelize } from '../models'
import { insert, ReceiptError, select, update, write } from './receipt-db'
import {
  parseReceiptXmlBytes,
  readReceiptFile,
  type Extraction,
} from './receipt-extractors'
import {
  detectExtension,
  FILE_TYPES,
  MAX_RECEIPT_PAGES,
  ReceiptFileStore,
  type StoredReceiptFile,
} from './receipt-files'
import type {
  LinkRow,
  ReceiptFields,
  ReceiptRow,
  VatLine,
} from './receipt-types'

import * as extract from './receipt-extract.core'
import { berlinToday } from './backzettel-reference.core'
import { isValidIban, normalizeIban, numberKey } from './invoice.core'
import {
  counterpartyKey,
  isValidMonth,
  maskIban,
} from './finance-transactions.core'
import { balances, targetKey } from './receipt-matching.core'

const EDITABLE: readonly (keyof Omit<ReceiptFields, 'vat_lines'>)[] =
  extract.FIELDS
const STATUSES = ['neu', 'erkannt', 'geprueft', 'verworfen']
const RECEIPT_MONTH = 'substr(COALESCE(invoice_date, upload_date), 1, 7)'

export interface ReceiptsOptions {
  directory?: string
  now?: () => Date
  pdftotext?: string
}

export function parseReceiptMonth(input: unknown, fallback: string): string {
  if (input === undefined || input === '') return fallback
  if (typeof input !== 'string' || !isValidMonth(input)) {
    throw new ReceiptError(
      400,
      'invalid_month',
      'Bitte einen Monat im Format JJJJ-MM angeben.'
    )
  }
  return input
}

export function receiptId(value: unknown): number {
  const id =
    (typeof value === 'string' && /^\d+$/.test(value)) ||
    typeof value === 'number'
      ? Number(value)
      : 0
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ReceiptError(400, 'invalid_id', 'Die Nummer ist ungültig.')
  }
  return id
}

export function receiptNotFound() {
  return new ReceiptError(
    404,
    'receipt_not_found',
    'Der Beleg wurde nicht gefunden.'
  )
}

/** Freitext in JSON kann ebenfalls eine IBAN enthalten. Originale werden als Dateien ausgeliefert. */
export function redactIban(text: string | null): string | null {
  if (text === null) return null
  // Wie normalizeIban auch Unicode-Leerraum an jeder Zeichenposition zulassen.
  const starts = /[A-Z]\s*[A-Z]\s*\d\s*\d(?:\s*[A-Z0-9]){11,30}/gi
  let result = ''
  let copied = 0
  for (let match = starts.exec(text); match; match = starts.exec(text)) {
    const candidate = match[0]
    // Nach einem Treffer ab dem wirklichen IBAN-Ende weitersuchen. Der
    // Kandidat kann schon Zeichen aus nachfolgendem Freitext enthalten.
    starts.lastIndex = match.index + 1
    for (let end = candidate.length; end >= 15; end--) {
      if (!/[A-Z0-9]/i.test(candidate[end - 1])) continue
      const prefix = candidate.slice(0, end)
      if (!isValidIban(prefix)) continue
      result += text.slice(copied, match.index) + maskIban(prefix)
      copied = match.index + end
      starts.lastIndex = copied
      break
    }
  }
  return result + text.slice(copied)
}

function fieldsOf(row: ReceiptRow, vat_lines: VatLine[]): ReceiptFields {
  const fields = Object.fromEntries(
    EDITABLE.map((key) => [key, row[key]])
  ) as Omit<ReceiptFields, 'vat_lines'>
  return { ...fields, vat_lines }
}

function changed(before: ReceiptFields, after: ReceiptFields) {
  return Object.fromEntries(
    [...EDITABLE, 'vat_lines' as const]
      .filter(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
      )
      .map((key) => [key, { alt: before[key], neu: after[key] }])
  )
}

/** Felder, an denen eine bestätigte Buchungsverknüpfung hängt. */
const LINK_FIELDS = ['gross_cents', 'currency', 'kind', 'payment'] as const

/** Passt der neue Stand nicht mehr zu den bestätigten Verknüpfungen? */
function linkConflict(
  before: ReceiptFields,
  after: ReceiptFields,
  allocated: number
) {
  return (
    after.gross_cents == null ||
    after.gross_cents < allocated ||
    after.currency !== before.currency ||
    after.kind !== before.kind ||
    after.payment === 'bar'
  )
}

function publicReceipt(row: ReceiptRow) {
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    supplier_name: redactIban(row.supplier_name),
    supplier_iban_masked: maskIban(row.supplier_iban),
    invoice_number: redactIban(row.invoice_number),
    invoice_date: row.invoice_date,
    due_date: row.due_date,
    gross_cents: row.gross_cents,
    currency: row.currency,
    payment: row.payment,
    skonto_rate: row.skonto_rate,
    skonto_due_date: row.skonto_due_date,
    extracted_by: row.extracted_by,
    confidence: row.confidence,
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at,
    created_by: row.created_by,
    created_at: row.created_at,
    booking_hint: row.booking_hint,
    field_flags: JSON.parse(row.field_flags) as Record<string, string>,
  }
}

function readPatch(input: unknown): Partial<ReceiptFields> {
  function invalid(): never {
    throw new ReceiptError(
      422,
      'invalid_receipt_fields',
      'Bitte prüfe die Belegfelder, Beträge und Steuersätze.'
    )
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return invalid()
  const result: Record<string, string | number | VatLine[] | null> = {}
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'kind':
        if (typeof value !== 'string' || !extract.KINDS.includes(value))
          return invalid()
        result[key] = value
        break
      case 'payment':
        if (typeof value !== 'string' || !extract.PAYMENTS.includes(value))
          return invalid()
        result[key] = value
        break
      case 'currency':
        if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))
          return invalid()
        result[key] = value
        break
      case 'supplier_name':
      case 'invoice_number':
        if (
          value !== null &&
          (typeof value !== 'string' ||
            value.length > 200 ||
            /[\p{Cc}\p{Cf}]/u.test(value))
        )
          return invalid()
        result[key] = typeof value === 'string' ? value.trim() || null : null
        break
      case 'supplier_iban':
        if (
          value !== null &&
          (typeof value !== 'string' || !isValidIban(value))
        )
          return invalid()
        result[key] = value === null ? null : normalizeIban(value)
        break
      case 'supplier_vat_id':
        if (value !== null && !extract.vatId(value)) return invalid()
        result[key] = extract.vatId(value)
        break
      case 'invoice_date':
      case 'due_date':
      case 'skonto_due_date':
        if (value !== null && !extract.date(value)) return invalid()
        result[key] = extract.date(value)
        break
      case 'gross_cents':
        if (
          value !== null &&
          (typeof value !== 'number' ||
            !Number.isSafeInteger(value) ||
            value < 0)
        )
          return invalid()
        result[key] = typeof value === 'number' ? value : null
        break
      case 'skonto_rate':
        if (
          value !== null &&
          (typeof value !== 'number' || !extract.rate(value) || value >= 100)
        )
          return invalid()
        result[key] = typeof value === 'number' ? value : null
        break
      case 'vat_lines':
        if (
          !Array.isArray(value) ||
          value.length > 100 ||
          value.some(
            (line) =>
              !line ||
              typeof line.rate !== 'number' ||
              extract.rate(line.rate) == null ||
              !Number.isSafeInteger(line.net_cents) ||
              !Number.isSafeInteger(line.vat_cents)
          )
        )
          return invalid()
        result[key] = value.map(({ rate, net_cents, vat_cents }) => ({
          rate,
          net_cents,
          vat_cents,
        }))
        break
      default:
        return invalid()
    }
  }
  return result
}

function requireOpen(row: ReceiptRow, allowDiscarded = false) {
  if (
    row.confirmed_at ||
    row.status === 'geprueft' ||
    (row.status === 'verworfen' && !allowDiscarded)
  ) {
    throw new ReceiptError(
      409,
      'receipt_closed',
      'Dieser Beleg ist bereits geprüft oder verworfen.'
    )
  }
}

function requireConfirmable(
  fields: Pick<
    ReceiptFields,
    'supplier_name' | 'invoice_date' | 'gross_cents' | 'currency'
  >,
  today: string
) {
  if (extract.missingRequiredFields(fields, today)) {
    throw new ReceiptError(
      422,
      'incomplete_receipt',
      'Bitte Lieferant, Rechnungsdatum, Bruttobetrag und Währung prüfen und ergänzen.'
    )
  }
}

export class ReceiptsService {
  private readonly store: ReceiptFileStore
  private readonly now: () => Date
  private readonly pending = new Set<number>()
  private tail: Promise<void> = Promise.resolve()

  constructor(private readonly options: ReceiptsOptions = {}) {
    this.store = new ReceiptFileStore(options.directory)
    this.now = options.now ?? (() => new Date())
  }

  today() {
    return berlinToday(this.now())
  }
  timestamp() {
    return this.now().toISOString()
  }
  idle() {
    return this.tail
  }

  async row(id: number, transaction?: Transaction) {
    const [row] = await select<ReceiptRow>(
      'SELECT * FROM receipts WHERE id = $id',
      { id },
      transaction
    )
    if (!row) throw receiptNotFound()
    return row
  }

  private vat(id: number, transaction?: Transaction) {
    return select<VatLine>(
      'SELECT rate, net_cents, vat_cents FROM receipt_vat_lines WHERE receipt_id = $id ORDER BY id',
      { id },
      transaction
    )
  }

  private async saveFields(
    id: number,
    fields: ReceiptFields,
    metadata: {
      field_flags: string
      extracted_by: string
      confidence: number | null
      status: string
    },
    transaction: Transaction
  ) {
    const { vat_lines, ...fieldsToSave } = fields
    await update('receipts', id, { ...fieldsToSave, ...metadata }, transaction)
    await write(
      'DELETE FROM receipt_vat_lines WHERE receipt_id = $id',
      { id },
      transaction
    )
    for (const line of vat_lines)
      await insert(
        'receipt_vat_lines',
        { receipt_id: id, ...line },
        transaction
      )
  }

  listRows(month: string, status: unknown) {
    if (
      status !== undefined &&
      (typeof status !== 'string' || !STATUSES.includes(status))
    ) {
      throw new ReceiptError(
        400,
        'invalid_status',
        'Der Belegstatus ist ungültig.'
      )
    }
    const filter = status === undefined ? '' : ' AND status = $status'
    return select<ReceiptRow>(
      `SELECT * FROM receipts WHERE ${RECEIPT_MONTH} = $month${filter}
       ORDER BY COALESCE(invoice_date, upload_date) DESC, id DESC`,
      status === undefined ? { month } : { month, status: String(status) }
    )
  }

  summarize(row: ReceiptRow) {
    return publicReceipt(row)
  }

  detail(id: number) {
    // Belegfelder und USt-Zeilen müssen aus demselben Stand kommen, auch
    // wenn direkt nach dem Upload gerade die Erkennung gespeichert wird.
    return getSequelize().transaction(async (transaction) => {
      const row = await this.row(id, transaction)
      const [vat_lines, files, attempts, peers] = await Promise.all([
        this.vat(id, transaction),
        select<StoredReceiptFile>(
          'SELECT * FROM receipt_files WHERE receipt_id = $id ORDER BY page',
          { id },
          transaction
        ),
        select<{ error: string | null }>(
          'SELECT error FROM receipt_extractions WHERE receipt_id = $id AND error IS NOT NULL ORDER BY id',
          { id },
          transaction
        ),
        row.invoice_number && row.supplier_name
          ? select<ReceiptRow>(
              "SELECT id, supplier_name, invoice_number FROM receipts WHERE id != $id AND status != 'verworfen' AND invoice_number IS NOT NULL",
              { id },
              transaction
            )
          : [],
      ])
      const duplicates = peers
        .filter(
          (peer) =>
            counterpartyKey(peer.supplier_name) ===
              counterpartyKey(row.supplier_name) &&
            numberKey(peer.invoice_number) === numberKey(row.invoice_number)
        )
        .map((peer) => peer.id)
      return {
        ...publicReceipt(row),
        vat_lines,
        files: files.map(({ id, page, mime, role, sha256, size }) => ({
          id,
          page,
          mime,
          role,
          sha256,
          size,
        })),
        duplicates,
        extraction_pending: files.some((file) => this.pending.has(file.id)),
        extraction_errors: attempts.map((attempt) => attempt.error),
      }
    })
  }

  async upload(
    bytes: Buffer,
    receipt: number | null,
    bookingHint: string | null,
    req: Request
  ) {
    const extension = detectExtension(bytes)
    if (!extension)
      throw new ReceiptError(
        415,
        'invalid_receipt_file',
        'Erlaubt sind JPEG, PNG, HEIC, PDF und XML.'
      )
    if (extension === 'xml') {
      try {
        parseReceiptXmlBytes(bytes)
      } catch {
        throw new ReceiptError(
          415,
          'invalid_receipt_file',
          'Die Datei enthält keine gültige Beleg-XML ohne DTD.'
        )
      }
    }
    const now = this.now()
    const day = berlinToday(now)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const mime = FILE_TYPES[extension]
    const role = extension === 'xml' ? 'xml' : 'original'
    return getSequelize().transaction(async (transaction) => {
      const [duplicate] = await select<StoredReceiptFile>(
        'SELECT receipt_id FROM receipt_files WHERE sha256 = $sha256',
        { sha256 },
        transaction
      )
      if (duplicate)
        throw new ReceiptError(
          409,
          'duplicate_receipt_file',
          'Diese Datei ist bereits als Beleg gespeichert.',
          { receipt_id: duplicate.receipt_id }
        )
      let id = receipt
      let page = 1
      if (id !== null) {
        const row = await this.row(id, transaction)
        requireOpen(row)
        const [latest] = await select<{ page: number | null }>(
          'SELECT MAX(page) AS page FROM receipt_files WHERE receipt_id = $id',
          { id },
          transaction
        )
        page = (latest.page ?? 0) + 1
        if (page > MAX_RECEIPT_PAGES)
          throw new ReceiptError(
            422,
            'too_many_receipt_files',
            'Ein Beleg kann höchstens zehn Dateien enthalten.'
          )
      } else {
        id = await insert(
          'receipts',
          {
            status: 'neu',
            kind: 'eingangsrechnung',
            payment: 'offen',
            currency: extract.UNKNOWN_CURRENCY,
            created_by: req.user?.id ?? null,
            created_at: now.toISOString(),
            upload_date: day,
            booking_hint: bookingHint,
            field_flags: JSON.stringify(
              extract.checkFields(
                {
                  currency: extract.UNKNOWN_CURRENCY,
                  kind: 'eingangsrechnung',
                },
                day
              )
            ),
          },
          transaction
        )
      }
      const path = await this.store.save(bytes, sha256, extension, day)
      const file = {
        receipt_id: id,
        page,
        mime,
        role,
        sha256,
        path,
        size: bytes.length,
      } as const
      const fileId = await insert('receipt_files', file, transaction)
      await audit(
        req,
        receipt === null ? 'create' : 'add_file',
        'receipt',
        id,
        { fileId, sha256, page },
        { transaction }
      )
      return { ...file, id: fileId }
    })
  }

  scheduleExtraction(file: StoredReceiptFile) {
    this.pending.add(file.id)
    this.tail = this.tail
      .then(async () => {
        const reading = await readReceiptFile(
          file,
          this.store.absolute(file.path),
          this.today(),
          this.options.pdftotext
        )
        await getSequelize().transaction(async (transaction) => {
          const [row] = await select<ReceiptRow>(
            'SELECT * FROM receipts WHERE id = $id',
            { id: file.receipt_id },
            transaction
          )
          if (!row) return
          await insert(
            'receipt_extractions',
            {
              receipt_id: row.id,
              file_id: file.id,
              engine: reading.engine,
              version: reading.version,
              raw:
                reading.raw === undefined ? null : JSON.stringify(reading.raw),
              fields: reading.result ? JSON.stringify(reading.result) : null,
              duration_ms: reading.duration_ms,
              error: reading.error ?? null,
              created_at: this.timestamp(),
            },
            transaction
          )
          if (reading.result)
            await this.applyExtraction(row, reading.result, transaction)
        })
      })
      .catch(() => {
        console.error(
          '[ERROR] Belegerkennung konnte nicht gespeichert werden.',
          file.id
        )
      })
      .finally(() => {
        this.pending.delete(file.id)
      })
  }

  private async applyExtraction(
    row: ReceiptRow,
    result: Extraction,
    transaction: Transaction
  ) {
    if (
      row.confirmed_at ||
      row.status === 'verworfen' ||
      row.extracted_by === 'manuell' ||
      row.extracted_by === 'xml'
    )
      return
    const before = fieldsOf(row, await this.vat(row.id, transaction))
    const { fields, extracted_by, confidence, field_flags } =
      row.extracted_by === 'textlayer' && result.extracted_by === 'textlayer'
        ? (extract.mergeTextResult(
            before,
            JSON.parse(row.field_flags),
            result,
            this.today()
          ) as Extraction)
        : result
    // Bestätigte Buchungsverknüpfungen gelten: Die Erkennung darf die Felder,
    // an denen sie hängen, nicht still ändern. Sie meldet die Abweichung, der
    // Inhaber entscheidet per Korrektur (PATCH, mit Audit).
    if ((await this.confirmedLinks(row.id, transaction)).length) {
      for (const field of LINK_FIELDS) {
        const extracted = fields[field]
        if (extracted === before[field]) continue
        Object.assign(fields, { [field]: before[field] })
        field_flags[field] =
          'Die Erkennung ergab einen anderen Wert (' +
          String(extracted ?? 'leer') +
          '). Die bestätigte Buchungsverknüpfung bleibt bestehen - bitte prüfen.'
      }
    }
    await this.saveFields(
      row.id,
      fields,
      {
        status: 'erkannt',
        extracted_by,
        confidence,
        field_flags: JSON.stringify(field_flags),
      },
      transaction
    )
    await audit(
      null,
      'extract',
      'receipt',
      row.id,
      { changes: changed(before, fields), engine: extracted_by },
      { transaction }
    )
  }

  private confirmedLinks(id: number, transaction: Transaction) {
    return select<LinkRow>(
      "SELECT * FROM transaction_links WHERE kind = 'receipt' AND target_id = $id AND status = 'bestaetigt'",
      { id },
      transaction
    )
  }

  private allocated(links: LinkRow[], id: number) {
    return (
      balances(links).byTarget.get(
        targetKey({ kind: 'receipt', target_id: id })
      ) ?? 0
    )
  }

  async patch(id: number, input: unknown, req: Request) {
    const patch = readPatch(input)
    await getSequelize().transaction(async (transaction) => {
      const row = await this.row(id, transaction)
      if (row.status === 'verworfen') requireOpen(row)
      const before = fieldsOf(row, await this.vat(id, transaction))
      const after = { ...before, ...patch }
      if (row.confirmed_at || row.status === 'geprueft') {
        requireConfirmable(after, this.today())
      }
      const changes = changed(before, after)
      if (!Object.keys(changes).length) return

      const links = await this.confirmedLinks(id, transaction)
      if (links.length) {
        if (linkConflict(before, after, this.allocated(links, id))) {
          throw new ReceiptError(
            409,
            'receipt_has_links',
            'Die Änderung passt nicht zu den bestätigten Buchungsverknüpfungen.'
          )
        }
      }

      const flags = JSON.parse(row.field_flags)
      for (const field of Object.keys(changes)) delete flags[field]
      if ('gross_cents' in changes || 'vat_lines' in changes)
        delete flags.vat_lines
      if ('invoice_date' in changes || 'due_date' in changes)
        delete flags.due_date
      if ('skonto_rate' in changes || 'skonto_due_date' in changes) {
        delete flags.skonto_rate
        delete flags.skonto_due_date
      }
      Object.assign(flags, extract.checkFields(after, this.today()))
      await this.saveFields(
        id,
        after,
        {
          status: row.status,
          extracted_by: 'manuell',
          confidence: null,
          field_flags: JSON.stringify(flags),
        },
        transaction
      )
      await audit(req, 'update', 'receipt', id, { changes }, { transaction })
    })
    return this.detail(id)
  }

  async transition(
    id: number,
    action: 'confirm' | 'discard' | 'delete',
    req: Request
  ) {
    await getSequelize().transaction(async (transaction) => {
      const row = await this.row(id, transaction)
      if (action === 'confirm' && row.status === 'geprueft') return
      requireOpen(row, action === 'delete')

      if (action === 'confirm') {
        requireConfirmable(row, this.today())
        await update(
          'receipts',
          id,
          {
            status: 'geprueft',
            confirmed_by: req.user?.id ?? null,
            confirmed_at: this.timestamp(),
            extracted_by: row.extracted_by ?? 'manuell',
          },
          transaction
        )
      } else {
        const confirmed = await select<LinkRow>(
          "SELECT id FROM transaction_links WHERE kind = 'receipt' AND target_id = $id AND status = 'bestaetigt'",
          { id },
          transaction
        )
        for (const link of confirmed) {
          await audit(
            req,
            'withdraw',
            'transaction_link',
            link.id,
            { receiptId: id, action },
            { transaction }
          )
        }
        if (action === 'discard') {
          await write(
            "UPDATE transaction_links SET status = 'abgelehnt' WHERE kind = 'receipt' AND target_id = $id",
            { id },
            transaction
          )
          await update('receipts', id, { status: 'verworfen' }, transaction)
        } else {
          await write(
            "DELETE FROM transaction_links WHERE kind = 'receipt' AND target_id = $id",
            { id },
            transaction
          )
          await write(
            'DELETE FROM receipts WHERE id = $id',
            { id },
            transaction
          )
        }
      }
      await audit(
        req,
        action,
        'receipt',
        id,
        { before: row.status },
        { transaction }
      )
    })
    return action === 'delete' ? null : this.detail(id)
  }

  async file(id: number, fileId: number) {
    const [file] = await select<StoredReceiptFile>(
      'SELECT * FROM receipt_files WHERE receipt_id = $id AND id = $fileId',
      { id, fileId }
    )
    if (!file)
      throw new ReceiptError(
        404,
        'receipt_file_not_found',
        'Die Belegdatei wurde nicht gefunden.'
      )
    try {
      const handle = await open(this.store.absolute(file.path), 'r')
      return { file, stream: handle.createReadStream() }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      throw new ReceiptError(
        404,
        'receipt_file_missing',
        'Das Belegoriginal fehlt im Ablageordner.'
      )
    }
  }

  /** Für eine spätere regelmäßige Ausführung. Meldet fehlende und veränderte Originale. */
  async verifyFileHashes(db = getSequelize()) {
    const files = await db.query<StoredReceiptFile>(
      'SELECT id, receipt_id, path, sha256 FROM receipt_files ORDER BY id',
      { type: QueryTypes.SELECT }
    )
    const issues: { file_id: number; receipt_id: number; reason: string }[] = []
    for (const file of files) {
      try {
        if ((await this.store.hash(file.path)) === file.sha256) continue
        issues.push({
          file_id: file.id,
          receipt_id: file.receipt_id,
          reason: 'Hash weicht ab.',
        })
      } catch {
        issues.push({
          file_id: file.id,
          receipt_id: file.receipt_id,
          reason: 'Datei fehlt oder ist nicht lesbar.',
        })
      }
    }
    return { checked: files.length, issues }
  }
}
