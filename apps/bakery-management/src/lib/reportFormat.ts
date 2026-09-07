/**
 * Anzeige-Helfer für Kassenberichte. Client-sicher (kein Dateisystem), damit
 * Server- und Client-Komponenten dieselbe Formatierung benutzen.
 */

const currency = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEuro(value: number): string {
  return currency.format(value)
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

export function formatQuantity(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** `2026-05-05` → `05.05.2026` */
export function formatReportDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

/** `2026-05-05` → `Dienstag, 05.05.2026` */
export function formatReportDateLong(date: string, weekday?: string | null) {
  return weekday
    ? `${weekday}, ${formatReportDate(date)}`
    : formatReportDate(date)
}

/** `2026-05` → `Mai 2026` */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Heutiges Datum als `YYYY-MM-DD` in lokaler Zeit. */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
