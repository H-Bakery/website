/**
 * Getippter Client für `/api/invoices` - Ausgangsrechnungen mit
 * ZUGFeRD/Factur-X-PDF (nur Inhaber).
 *
 * Gerechnet wird hier nichts: Positionsbeträge, Umsatzsteuer je Satz, Summen,
 * Rundung und die Liste „was zum Ausstellen fehlt“ (`missing`) kommen fertig
 * von der API (`apps/bakery-api/src/services/invoice.core.js`). Alle Beträge
 * sind ganze Cent. Die Formatierung (Euro, Datum, Menge, IBAN) kommt aus
 * demselben Kern.
 */

import { apiClient } from '@bakery/shared/data-access'
import { saveBlob } from './partnerApi'

// Die einzige Implementierung der Rechnungsregeln ist abhängigkeitsfreies
// CommonJS im API-Projekt; hier werden nur ihre Formatierer benutzt. Der
// Querverweis ist für Nx und die Modulgrenzen-Regel ausgeblendet (wie in
// `lib/finance.ts`).
interface InvoiceCore {
  formatEuro: (cents: number) => string
  formatDate: (isoDate: string | null) => string
  formatQuantity: (quantity: number | string) => string
  formatIban: (iban: string) => string
}
// nx-ignore-next-line
const invoiceCore: InvoiceCore = require('../../../bakery-api/src/services/invoice.core') // eslint-disable-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries

export const formatEuro = (cents: number): string =>
  invoiceCore.formatEuro(cents)
export const formatInvoiceDate = (isoDate: string | null): string =>
  invoiceCore.formatDate(isoDate) || '–'
export const formatQuantity = (quantity: number | string): string =>
  invoiceCore.formatQuantity(quantity)
export const formatIban = (iban: string): string => invoiceCore.formatIban(iban)

const BASE = '/api/invoices'

export type InvoiceStatus = 'entwurf' | 'ausgestellt' | 'storniert'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  entwurf: 'Entwurf',
  ausgestellt: 'Ausgestellt',
  storniert: 'Storniert',
}

export interface InvoiceFieldError {
  field: string
  message: string
}

export interface InvoiceSeller {
  name: string
  street: string
  postcode: string
  city: string
  countryCode: string
  vatId: string
  phone: string
  email: string
  iban: string
  bic: string
  accountHolder: string
  bankName: string
}

export interface InvoiceBuyer {
  name: string
  careOf: string
  street: string
  postcode: string
  city: string
  countryCode: string
}

export interface InvoiceLine {
  position: number
  productId: string
  name: string
  unit: string
  quantity: number
  unitPriceGrossCents: number
  vatRate: number
  grossCents: number
  netCents: number
  netUnitPrice: string
  netBasisQuantity: string
}

export interface InvoiceVatGroup {
  rate: number
  netCents: number
  vatCents: number
  grossCents: number
  roundingCents: number
}

export interface InvoiceTotals {
  netCents: number
  vatCents: number
  grandTotalCents: number
  roundingCents: number
  dueCents: number
  grossCents: number
}

export interface Invoice {
  id: number
  number: string | null
  status: InvoiceStatus
  preorderId: number | null
  preorderCode: string | null
  buyer: InvoiceBuyer
  invoiceDate: string | null
  deliveryDate: string | null
  paymentTermDays: number
  paymentText: string
  dueDate: string | null
  /** Fertiger Satz, z. B. „Zahlbar per Überweisung bis 29.11.2026 ohne Abzug.“ */
  paymentTerms: string
  note: string
  seller: InvoiceSeller
  lines: InvoiceLine[]
  vat: InvoiceVatGroup[]
  totals: InvoiceTotals
  /** Entwurf: alle Pflichtangaben sind da. */
  issuable: boolean
  /** Entwurf: was zum Ausstellen noch fehlt (deutsch). */
  missing: InvoiceFieldError[]
  issuedAt: string | null
  cancelledAt: string | null
  cancelReason: string
  createdAt: string | null
  updatedAt: string | null
}

export interface InvoiceListItem {
  id: number
  number: string | null
  status: InvoiceStatus
  preorderId: number | null
  preorderCode: string | null
  buyerName: string
  invoiceDate: string | null
  deliveryDate: string | null
  dueDate: string | null
  dueCents: number
  issuable: boolean
  issuedAt: string | null
  cancelledAt: string | null
}

export interface InvoiceConfig {
  vatRates: number[]
  defaultVatRate: number
  paymentTermDays: number
  paymentText: string
  today: string
  seller: InvoiceSeller
  bankConfigured: boolean
  bankMessage: string | null
}

/** Eine Position, wie sie gespeichert wird (Preis als Euro-Text, „1,20“). */
export interface InvoiceLineInput {
  productId?: string
  name: string
  unit: string
  quantity: string
  unitPriceGross: string
  vatRate: number
}

export interface InvoiceInput {
  number?: string
  invoiceDate?: string
  deliveryDate?: string
  paymentTermDays?: number | string
  paymentText?: string
  note?: string
  buyer?: Partial<InvoiceBuyer>
  lines?: InvoiceLineInput[]
}

function unwrap<T>(response: { data?: T } | undefined): T {
  return response?.data as T
}

function idPath(id: number | string): string {
  return `${BASE}/${encodeURIComponent(String(id))}`
}

export async function fetchInvoiceConfig(): Promise<InvoiceConfig> {
  return unwrap(await apiClient.get<InvoiceConfig>(`${BASE}/config`))
}

export async function listInvoices(): Promise<InvoiceListItem[]> {
  return unwrap(await apiClient.get<InvoiceListItem[]>(BASE)) ?? []
}

export async function getInvoice(id: number | string): Promise<Invoice> {
  return unwrap(await apiClient.get<Invoice>(idPath(id)))
}

/** Entwurf anlegen - leer oder aus einer Vorbestellung vorbelegt. */
export async function createInvoice(
  body: InvoiceInput & { preorderId?: number } = {}
): Promise<Invoice> {
  return unwrap(await apiClient.post<Invoice>(BASE, body))
}

export async function updateInvoice(
  id: number | string,
  body: InvoiceInput
): Promise<Invoice> {
  return unwrap(await apiClient.put<Invoice>(idPath(id), body))
}

export async function deleteInvoice(id: number | string): Promise<void> {
  await apiClient.delete(idPath(id))
}

export async function issueInvoice(id: number | string): Promise<Invoice> {
  return unwrap(await apiClient.post<Invoice>(`${idPath(id)}/issue`, {}))
}

export async function cancelInvoice(
  id: number | string,
  reason: string
): Promise<Invoice> {
  return unwrap(
    await apiClient.post<Invoice>(`${idPath(id)}/cancel`, { reason })
  )
}

/** Lädt PDF (mit eingebetteter XML) oder die XML allein und bietet sie an. */
export async function downloadInvoiceFile(
  invoice: Pick<Invoice, 'id' | 'number'>,
  kind: 'pdf' | 'xml',
  save: (blob: Blob, fileName: string) => void = saveBlob
): Promise<void> {
  const { blob, filename } = await apiClient.getBlob(
    `${idPath(invoice.id)}/${kind}`
  )
  save(blob, filename || `Rechnung-${invoice.number ?? invoice.id}.${kind}`)
}

// ------------------------------------------------------------------ Fehler

export function invoiceErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

/** Feldfehler aus dem Fehlerkörper (`fields`), sonst leer. */
export function invoiceFieldErrors(error: unknown): InvoiceFieldError[] {
  const fields = (error as { details?: { fields?: unknown } } | null)?.details
    ?.fields
  if (!Array.isArray(fields)) return []
  return fields.filter(
    (f): f is InvoiceFieldError =>
      !!f && typeof f.field === 'string' && typeof f.message === 'string'
  )
}

/** Bei 409 `invoice_exists`: die Rechnung, die es für die Vorbestellung schon gibt. */
export function existingInvoiceId(error: unknown): number | null {
  if (invoiceErrorCode(error) !== 'invoice_exists') return null
  const id = (error as { details?: { invoiceId?: unknown } } | null)?.details
    ?.invoiceId
  return typeof id === 'number' ? id : null
}

const TECHNICAL =
  /^(Failed to fetch|NetworkError.*|Load failed|Network request failed|Request timeout|HTTP \d{3}\b.*)$/i

export function invoiceErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : ''
  if (!message) return fallback
  if (
    /^(Failed to fetch|NetworkError|Load failed|Network request failed|Request timeout)/i.test(
      message
    )
  ) {
    return 'Der Server ist nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.'
  }
  return TECHNICAL.test(message) ? fallback : message
}
