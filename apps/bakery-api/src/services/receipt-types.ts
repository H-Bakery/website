export interface VatLine {
  rate: number
  net_cents: number
  vat_cents: number
}

export interface ReceiptFields {
  kind: 'eingangsrechnung' | 'kassenbeleg' | 'gutschrift'
  supplier_name: string | null
  supplier_vat_id: string | null
  supplier_iban: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  gross_cents: number | null
  currency: string
  payment: 'ueberweisung' | 'lastschrift' | 'bar' | 'karte' | 'offen'
  skonto_rate: number | null
  skonto_due_date: string | null
  vat_lines: VatLine[]
}

export type ReceiptStatus = 'neu' | 'erkannt' | 'geprueft' | 'verworfen'

export interface ReceiptRow extends Omit<ReceiptFields, 'vat_lines'> {
  id: number
  status: ReceiptStatus
  extracted_by: string | null
  confidence: number | null
  field_flags: string
  confirmed_by: number | null
  confirmed_at: string | null
  created_by: number | null
  created_at: string
  upload_date: string
  booking_hint: string | null
}

export interface LinkPart {
  transaction_id: string
  kind: 'invoice' | 'receipt'
  target_id: number
  amount_cents: number
  discount_cents: number
}

export interface LinkRow extends LinkPart {
  id: number
  matched_by: 'auto' | 'manual'
  score: number | null
  status: 'vorgeschlagen' | 'bestaetigt' | 'abgelehnt'
  confirmed_by: number | null
  confirmed_at: string | null
  booking_date: string
  booking_amount_cents: number
  counterparty_key: string
}

export interface MatchTarget {
  kind: LinkPart['kind']
  target_id: number
  receipt_kind?: ReceiptFields['kind']
  status: string
  supplier_name: string | null
  supplier_iban: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  gross_cents: number
  currency: string
  payment: string
  skonto_rate?: number | null
  skonto_due_date?: string | null
}

export interface Booking {
  id: string
  booking_date: string
  amount: number
  currency: string
  cents: number
  key: string
  iban: string
  counterparty: string | null
  purpose: string | null
  booking_text: string | null
  status: 'gebucht' | 'vorgemerkt'
  category: string
}

export interface Offer {
  type:
    | 'betrag'
    | 'skonto'
    | 'teilzahlung'
    | 'teilzahlungen'
    | 'sammellastschrift'
  score: number
  ambiguous: boolean
  parts: LinkPart[]
}
