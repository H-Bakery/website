import { apiClient } from '@bakery/shared/data-access'

export const RECEIPTS_PATH = '/admin/finance/belege'
const API = '/api/receipts'

export type ReceiptStatus = 'neu' | 'erkannt' | 'geprueft' | 'verworfen'
export type ReceiptKind = 'eingangsrechnung' | 'kassenbeleg' | 'gutschrift'
export type ReceiptPayment =
  | 'ueberweisung'
  | 'lastschrift'
  | 'bar'
  | 'karte'
  | 'offen'

export interface VatLine {
  rate: number
  net_cents: number
  vat_cents: number
}

export interface ReceiptFields {
  kind: ReceiptKind
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  gross_cents: number | null
  currency: string
  payment: ReceiptPayment
  skonto_rate: number | null
  skonto_due_date: string | null
  vat_lines: VatLine[]
}

export interface ReceiptSummary extends Omit<ReceiptFields, 'vat_lines'> {
  id: number
  status: ReceiptStatus
  created_at: string
  field_flags: Record<string, string>
}

export interface ReceiptFile {
  id: number
  mime: string
  page: number
  size: number
}

export interface ReceiptDetail extends ReceiptSummary {
  vat_lines: VatLine[]
  files: ReceiptFile[]
  supplier_iban_masked: string | null
  extraction_pending: boolean
  extraction_errors: string[]
  duplicates: number[]
  booking_hint: ReceiptBookingHint | null
}

export interface ReceiptBooking {
  id: string
  booking_date: string
  amount: number
  currency: string
  status: 'gebucht' | 'vorgemerkt'
  counterparty: string | null
  booking_text: string | null
  purpose: string | null
}

export interface ReceiptBookingHint extends ReceiptBooking {
  allocation: {
    max_cents: number
    booking_open_cents: number
    receipt_open_cents: number
  } | null
}

export interface UncoveredExpense extends ReceiptBooking {
  remaining_cents: number
}

export interface ReceiptTarget {
  target_id: number
  kind: 'invoice' | 'receipt'
  name: string | null
  invoice_number: string | null
}

export interface ReceiptMatch {
  id: string
  type:
    | 'betrag'
    | 'skonto'
    | 'teilzahlung'
    | 'teilzahlungen'
    | 'sammellastschrift'
  ambiguous: boolean
  estimated_skonto_rate?: number
  parts: {
    amount_cents: number
    booking: ReceiptBooking
    target: ReceiptTarget
  }[]
}

export interface ConfirmedReceiptLink {
  id: number
  transaction_id: string
  target_id: number
  kind: ReceiptTarget['kind']
  amount_cents: number
  booking_date: string
  booking: ReceiptBooking | null
  target: ReceiptTarget | null
  review_required: boolean
  replacements: ReceiptBooking[]
}

export interface ReceiptMatches {
  available: boolean
  proposals: ReceiptMatch[]
  links: ConfirmedReceiptLink[]
}

function dataOf<T>(response: { data?: T }): T {
  if (response.data === undefined)
    throw new Error('Die Belegdaten fehlen in der Antwort.')
  return response.data
}

export function receiptHref(id: number) {
  return RECEIPTS_PATH + '/' + id
}

export async function uploadReceipt(
  file: File,
  options: { receiptId?: number; bookingId?: string } = {}
) {
  const path = options.receiptId
    ? `${API}/${options.receiptId}/files`
    : options.bookingId
    ? API + '?buchung=' + encodeURIComponent(options.bookingId)
    : API
  return dataOf(
    await apiClient.postFile<{ id: number; file_id: number }>(path, file, {
      // Das Dateiformat ermittelt der Server am Inhalt. Manche Dateiauswahlen
      // melden für HEIC oder XML einen plattformspezifischen MIME-Typ.
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  )
}

export async function fetchReceipts(month: string, withoutBooking: boolean) {
  const data = dataOf(
    await apiClient.get<{ receipts: ReceiptSummary[] }>(
      withoutBooking ? API + '/without-booking' : API,
      { monat: month }
    )
  )
  return data.receipts
}

export async function fetchReceipt(id: number) {
  return dataOf(await apiClient.get<ReceiptDetail>(`${API}/${id}`))
}

export async function fetchReceiptMatches(scope: {
  beleg?: number
  buchung?: string
}) {
  return dataOf(await apiClient.get<ReceiptMatches>(`${API}/matches`, scope))
}

export async function fetchExpensesWithoutReceipt(month: string) {
  return dataOf(
    await apiClient.get<{
      transactions: UncoveredExpense[]
      available: boolean
    }>('/api/finance/transactions/without-receipt', { monat: month })
  )
}

export async function patchReceipt(
  id: number,
  fields: Partial<ReceiptFields> & {
    supplier_iban?: string | null
    supplier_vat_id?: string | null
  }
) {
  await apiClient.patch(`${API}/${id}`, fields)
}

export async function transitionReceipt(
  id: number,
  action: 'confirm' | 'discard' | 'delete'
) {
  if (action === 'delete') await apiClient.delete(`${API}/${id}`)
  else await apiClient.post(`${API}/${id}/${action}`)
}

export async function linkReceipt(
  input:
    | { proposal_id: string }
    | {
        transaction_id: string
        target_id: number
        kind: ReceiptTarget['kind']
        replace_link_id?: number
        amount_cents?: number
      }
) {
  await apiClient.post('/api/transaction-links', input)
}

export async function rejectReceiptMatch(id: string) {
  await apiClient.post(`/api/transaction-links/${id}/reject`)
}

export const downloadReceiptFile = (id: number, fileId: number) =>
  apiClient.getBlob(`${API}/${id}/files/${fileId}`)

export function currentReceiptMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts()
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

export const RECEIPT_STATUS: Record<ReceiptStatus, string> = {
  neu: 'Neu',
  erkannt: 'Bitte prüfen',
  geprueft: 'Geprüft',
  verworfen: 'Verworfen',
}

export function formatReceiptMoney(euros: number, currency: string) {
  if (currency === 'XXX' || !/^[A-Z]{3}$/.test(currency))
    return new Intl.NumberFormat('de-DE').format(euros)
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(
    euros
  )
}
