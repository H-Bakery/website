'use client'

/**
 * Analytics dashboard page - displays aggregated sales analytics with charts
 */

import { useEffect, useState } from 'react'
import { reportService } from '@bakery/shared/data-access'
import styles from './page.module.css'

// Define types for analytics data
interface RevenueData {
  date: string
  revenue: number
  transactionCount: number
}

interface ProductPerformance {
  productId: string
  productName: string
  quantitySold: number
  revenue: number
}

interface PaymentMethodData {
  method: string
  count: number
  amount: number
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  })

  // Analytics data states
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([])
  const [bottomProducts, setBottomProducts] = useState<ProductPerformance[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([])
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    cashPercentage: 0,
  })

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange])

  function getDefaultStartDate() {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split('T')[0]
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split('T')[0]
  }

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // For now, use mock data since the backend integration is pending
      // TODO: Replace with actual API calls when backend is ready

      // Mock revenue trends
      const mockRevenueData: RevenueData[] = []
      const startDate = new Date(dateRange.startDate)
      const endDate = new Date(dateRange.endDate)
      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        mockRevenueData.push({
          date: currentDate.toISOString().split('T')[0],
          revenue: Math.floor(Math.random() * 2000) + 1000,
          transactionCount: Math.floor(Math.random() * 100) + 50,
        })
        currentDate.setDate(currentDate.getDate() + 1)
      }
      setRevenueData(mockRevenueData)

      // Mock product performance
      const mockTopProducts: ProductPerformance[] = [
        {
          productId: '1',
          productName: 'Baguette',
          quantitySold: 450,
          revenue: 855,
        },
        {
          productId: '2',
          productName: 'Croissant',
          quantitySold: 320,
          revenue: 1280,
        },
        {
          productId: '3',
          productName: 'Sauerteigbrot',
          quantitySold: 180,
          revenue: 810,
        },
        {
          productId: '4',
          productName: 'Brezel',
          quantitySold: 280,
          revenue: 420,
        },
        {
          productId: '5',
          productName: 'Apfelkuchen',
          quantitySold: 90,
          revenue: 315,
        },
      ]
      setTopProducts(mockTopProducts)

      const mockBottomProducts: ProductPerformance[] = [
        {
          productId: '101',
          productName: 'Rosinenbrot',
          quantitySold: 12,
          revenue: 48,
        },
        {
          productId: '102',
          productName: 'Pumpernickel',
          quantitySold: 8,
          revenue: 24,
        },
        {
          productId: '103',
          productName: 'Zwiebelbrot',
          quantitySold: 15,
          revenue: 67.5,
        },
      ]
      setBottomProducts(mockBottomProducts)

      // Mock payment methods
      const mockPaymentMethods: PaymentMethodData[] = [
        { method: 'Bargeld', count: 450, amount: 12500 },
        { method: 'EC-Karte', count: 320, amount: 18900 },
        { method: 'Kreditkarte', count: 80, amount: 4200 },
      ]
      setPaymentMethods(mockPaymentMethods)

      // Calculate summary
      const totalRevenue = mockRevenueData.reduce(
        (sum, d) => sum + d.revenue,
        0
      )
      const totalTransactions = mockRevenueData.reduce(
        (sum, d) => sum + d.transactionCount,
        0
      )
      const cashAmount =
        mockPaymentMethods.find((p) => p.method === 'Bargeld')?.amount || 0
      const totalPayments = mockPaymentMethods.reduce(
        (sum, p) => sum + p.amount,
        0
      )

      setSummary({
        totalRevenue,
        totalTransactions,
        avgTransactionValue:
          totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        cashPercentage:
          totalPayments > 0 ? (cashAmount / totalPayments) * 100 : 0,
      })
    } catch (err) {
      setError('Fehler beim Laden der Analytics-Daten')
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1>Analytics Dashboard</h1>
        <div className={styles.loading}>Lade Analytics-Daten...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Analytics Dashboard</h1>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={fetchAnalyticsData} className={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  // Find max revenue for chart scaling
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue))

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <a href="/" className={styles.backLink}>
            ← Zurück zur Übersicht
          </a>
          <h1>Analytics Dashboard</h1>
        </div>
        <div className={styles.dateFilter}>
          <label>
            Von:
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className={styles.dateInput}
            />
          </label>
          <label>
            Bis:
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className={styles.dateInput}
            />
          </label>
        </div>
      </header>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <h3>Gesamtumsatz</h3>
          <p className={styles.summaryValue}>
            {formatCurrency(summary.totalRevenue)}
          </p>
          <p className={styles.summarySubtext}>{revenueData.length} Tage</p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Transaktionen</h3>
          <p className={styles.summaryValue}>{summary.totalTransactions}</p>
          <p className={styles.summarySubtext}>
            Ø {formatCurrency(summary.avgTransactionValue)} pro Transaktion
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Bargeldanteil</h3>
          <p className={styles.summaryValue}>
            {summary.cashPercentage.toFixed(1)}%
          </p>
          <p className={styles.summarySubtext}>des Gesamtumsatzes</p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Täglicher Durchschnitt</h3>
          <p className={styles.summaryValue}>
            {formatCurrency(summary.totalRevenue / revenueData.length)}
          </p>
          <p className={styles.summarySubtext}>Umsatz pro Tag</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className={styles.chartSection}>
        <h2>Umsatzentwicklung</h2>
        <div className={styles.revenueChart}>
          <div className={styles.chartYAxis}>
            <span>{formatCurrency(maxRevenue)}</span>
            <span>{formatCurrency(maxRevenue * 0.75)}</span>
            <span>{formatCurrency(maxRevenue * 0.5)}</span>
            <span>{formatCurrency(maxRevenue * 0.25)}</span>
            <span>{formatCurrency(0)}</span>
          </div>
          <div className={styles.chartBars}>
            {revenueData.map((data) => (
              <div key={data.date} className={styles.chartBar}>
                <div
                  className={styles.bar}
                  style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                  title={`${formatDate(data.date)}: ${formatCurrency(
                    data.revenue
                  )}`}
                />
                <span className={styles.barLabel}>{formatDate(data.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Performance */}
      <div className={styles.performanceGrid}>
        <div className={styles.performanceSection}>
          <h2>Top Produkte</h2>
          <div className={styles.productList}>
            {topProducts.map((product, index) => (
              <div key={product.productId} className={styles.productItem}>
                <span className={styles.rank}>#{index + 1}</span>
                <div className={styles.productInfo}>
                  <span className={styles.productName}>
                    {product.productName}
                  </span>
                  <span className={styles.productId}>
                    ID: {product.productId}
                  </span>
                </div>
                <div className={styles.productStats}>
                  <span>{product.quantitySold} Stück</span>
                  <span className={styles.revenue}>
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.performanceSection}>
          <h2>Schwache Produkte</h2>
          <div className={styles.productList}>
            {bottomProducts.map((product) => (
              <div key={product.productId} className={styles.productItem}>
                <span className={styles.rankLow}>!</span>
                <div className={styles.productInfo}>
                  <span className={styles.productName}>
                    {product.productName}
                  </span>
                  <span className={styles.productId}>
                    ID: {product.productId}
                  </span>
                </div>
                <div className={styles.productStats}>
                  <span>{product.quantitySold} Stück</span>
                  <span className={styles.revenue}>
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className={styles.paymentSection}>
        <h2>Zahlungsmethoden</h2>
        <div className={styles.paymentGrid}>
          {paymentMethods.map((payment) => {
            const percentage =
              (payment.amount /
                paymentMethods.reduce((sum, p) => sum + p.amount, 0)) *
              100
            return (
              <div key={payment.method} className={styles.paymentCard}>
                <h3>{payment.method}</h3>
                <div className={styles.paymentBar}>
                  <div
                    className={styles.paymentFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className={styles.paymentStats}>
                  {payment.count} Transaktionen
                </p>
                <p className={styles.paymentAmount}>
                  {formatCurrency(payment.amount)} ({percentage.toFixed(1)}%)
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
