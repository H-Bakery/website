'use client'

/**
 * Reports list page - displays all available daily reports
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { reportService } from '@bakery/shared/data-access'
import type { ReportMetadata } from '@bakery/shared/types'
import styles from './page.module.css'

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await reportService.getReports()

      if (response.success && response.data) {
        setReports(response.data.reports)
      } else {
        setError(response.message || 'Failed to load reports')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '-'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (bytes === undefined) return '-'
    const kb = bytes / 1024
    return `${kb.toFixed(1)} KB`
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1>Tagesberichte</h1>
        <div className={styles.loading}>Lade Berichte...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Tagesberichte</h1>
        <div className={styles.error}>
          <p>Fehler beim Laden der Berichte:</p>
          <p>{error}</p>
          <button onClick={fetchReports} className={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Tagesberichte</h1>
        <p className={styles.subtitle}>
          {reports.length} {reports.length === 1 ? 'Bericht' : 'Berichte'} verfügbar
        </p>
      </header>

      {reports.length === 0 ? (
        <div className={styles.empty}>
          <p>Keine Berichte gefunden</p>
        </div>
      ) : (
        <div className={styles.reportGrid}>
          {reports.map((report) => (
            <Link
              key={report.filename}
              href={`/${report.date}`}
              className={styles.reportCard}
            >
              <div className={styles.reportDate}>{formatDate(report.date)}</div>
              <div className={styles.reportStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Umsatz:</span>
                  <span className={styles.statValue}>
                    {formatCurrency(report.total_revenue)}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Transaktionen:</span>
                  <span className={styles.statValue}>
                    {report.transaction_count || '-'}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Dateigröße:</span>
                  <span className={styles.statValue}>
                    {formatFileSize(report.filesize)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}