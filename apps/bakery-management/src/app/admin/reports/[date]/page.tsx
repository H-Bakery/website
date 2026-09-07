import React from 'react'
import {
  getDailyReport,
  isValidReportDate,
  listReportDates,
} from '../../../../lib/reports'
import DayReportClient from './DayReportClient'

/**
 * Ein Kassentag im Detail: Kennzahlen, Zahlungsmix, Stundenverlauf und die
 * Bons aggregiert nach Produkt. Server-Komponente, liest über `lib/reports.ts`.
 */
export default async function DayReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const valid = isValidReportDate(date)
  const report = valid
    ? getDailyReport(date)
    : { status: 'no-data' as const, date, weekday: null }

  // Vor/Zurück springt zum nächsten Tag *mit Bericht*, nicht zum Kalendertag -
  // sonst klickt man sich durch Ruhetage.
  const dates = valid ? listReportDates() : []
  const index = dates.indexOf(date)
  let previous: string | null = null
  let next: string | null = null
  if (index >= 0) {
    previous = index > 0 ? dates[index - 1] : null
    next = index < dates.length - 1 ? dates[index + 1] : null
  } else if (valid) {
    previous = [...dates].reverse().find((d) => d < date) ?? null
    next = dates.find((d) => d > date) ?? null
  }

  return (
    <DayReportClient
      report={report}
      previousDate={previous}
      nextDate={next}
      invalidDate={!valid}
    />
  )
}
