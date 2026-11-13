import React from 'react'
import InvoiceListClient from './InvoiceListClient'

/** Rechnungen (nur Inhaber): Liste; Daten kommen über `/api/invoices`. */
export default function InvoicesPage() {
  return <InvoiceListClient />
}
