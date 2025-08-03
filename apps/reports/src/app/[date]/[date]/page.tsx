'use client'

/**
 * Report detail page - displays transactions and summary for a specific date
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { reportService } from '@bakery/shared/data-access'
import type { DailyReport, Transaction } from '@bakery/shared/types'
import styles from './page.module.css'

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const date = params.date as string

  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(
    null
  )

  useEffect(() => {
    if (date) {
      fetchReport()
    }
  }, [date])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await reportService.getReportByDate(date)

      if (response.success && response.data) {
        setReport(response.data)
      } else {
        setError(response.message || 'Failed to load report')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error fetching report:', err)
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Lade Bericht...</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Fehler beim Laden des Berichts:</p>
          <p>{error || 'Bericht nicht gefunden'}</p>
          <button onClick={() => router.back()} className={styles.backButton}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    )
  }

  const stats = reportService.calculateReportStats(report)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backLink}>
          ← Zurück zur Übersicht
        </button>
        <h1>Tagesbericht: {formatDate(report.date)}</h1>
        <p className={styles.subtitle}>
          {report.company} | Kasse: {report.register_id} | Bericht Nr.{' '}
          {report.report_number}
        </p>
      </header>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <h3>Gesamtumsatz</h3>
          <p className={styles.summaryValue}>
            {formatCurrency(report.daily_summary.total_revenue)}
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Barumsatz</h3>
          <p className={styles.summaryValue}>
            {formatCurrency(report.daily_summary.cash_revenue)}
          </p>
          <p className={styles.summarySubtext}>
            {stats.cashPercentage.toFixed(1)}% des Gesamtumsatzes
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Transaktionen</h3>
          <p className={styles.summaryValue}>
            {report.daily_summary.transaction_count}
          </p>
          <p className={styles.summarySubtext}>
            Ø {formatCurrency(stats.averageTransactionValue)}
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>MwSt.</h3>
          {Object.entries(report.daily_summary.vat_totals).map(([rate, amount]) => (
            <p key={rate} className={styles.vatLine}>
              {rate}: {formatCurrency(amount || 0)}
            </p>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className={styles.chartsSection}>
        <div className={styles.chart}>
          <h3>Stündliche Verteilung</h3>
          <div className={styles.hourlyChart}>
            {stats.hourlyDistribution.map(([hour, count]) => (
              <div key={hour} className={styles.hourBar}>
                <div className={styles.hourLabel}>{hour}:00</div>
                <div
                  className={styles.hourValue}
                  style={{
                    width: `${(count / report.transactions.length) * 100}%`,
                  }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chart}>
          <h3>Top 10 Produkte</h3>
          <div className={styles.productList}>
            {stats.topProducts.map((product, index) => (
              <div key={product.productId} className={styles.productItem}>
                <span className={styles.productRank}>#{index + 1}</span>
                <span className={styles.productId}>ID: {product.productId}</span>
                <span className={styles.productQuantity}>
                  {product.quantity} Stück
                </span>
                <span className={styles.productRevenue}>
                  {formatCurrency(product.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className={styles.transactionsSection}>
        <h2>Transaktionen</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.transactionsTable}>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>ID</th>
                <th>Verkäufer</th>
                <th>Artikel</th>
                <th>Zahlung</th>
                <th>Betrag</th>
              </tr>
            </thead>
            <tbody>
              {report.transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  onClick={() => setSelectedTransaction(transaction)}
                  className={styles.transactionRow}
                >
                  <td>{formatTime(transaction.timestamp)}</td>
                  <td>{transaction.id}</td>
                  <td>{transaction.user}</td>
                  <td>{transaction.items.length} Artikel</td>
                  <td>{transaction.payment}</td>
                  <td className={styles.amount}>
                    {formatCurrency(transaction.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div
          className={styles.modal}
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Transaktion #{selectedTransaction.id}</h3>
            <p>
              Zeit: {formatTime(selectedTransaction.timestamp)} | Verkäufer:{' '}
              {selectedTransaction.user}
            </p>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>ID</th>
                  <th>Menge</th>
                  <th>Preis</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {selectedTransaction.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.product}</td>
                    <td>{item.product_id}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Gesamt ({selectedTransaction.payment}):</td>
                  <td>{formatCurrency(selectedTransaction.total)}</td>
                </tr>
              </tfoot>
            </table>
            <button
              onClick={() => setSelectedTransaction(null)}
              className={styles.closeButton}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}