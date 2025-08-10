import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Box,
  Typography,
  Paper,
  Skeleton,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingCart as ShoppingCartIcon,
  Euro as EuroIcon,
  Assessment as AssessmentIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import {
  AnalyticsSummaryCard,
  ProductRankingTable,
} from '@bakery/management/feature-analytics';
import { analyticsService } from '@bakery/shared/data-access';
import type {
  AnalyticsSummary,
  ProductAnalyticsPerformance,
  RevenueData,
} from '@bakery/shared/types';

export function DashboardOverview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topProducts, setTopProducts] = useState<ProductAnalyticsPerformance[]>([]);
  const [todayRevenue, setTodayRevenue] = useState<RevenueData | null>(null);
  const [yesterdayRevenue, setYesterdayRevenue] = useState<RevenueData | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Fetch all data in parallel
      const [summaryData, productsData, revenueTrends] = await Promise.all([
        analyticsService.getSummary({
          startDate: todayStr,
          endDate: todayStr,
        }),
        analyticsService.getProductPerformance({
          startDate: todayStr,
          endDate: todayStr,
          type: 'top',
          limit: 5,
        }),
        analyticsService.getRevenueTrends({
          startDate: yesterdayStr,
          endDate: todayStr,
          granularity: 'daily',
        }),
      ]);

      setSummary(summaryData);
      setTopProducts(productsData);
      
      // Extract today and yesterday revenue from trends
      const todayData = revenueTrends.find(d => d.date === todayStr);
      const yesterdayData = revenueTrends.find(d => d.date === yesterdayStr);
      
      setTodayRevenue(todayData || null);
      setYesterdayRevenue(yesterdayData || null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const navigateToAnalytics = (path: string) => {
    router.push(`/analytics${path}`);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Dashboard Übersicht
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Box onClick={() => navigateToAnalytics('/revenue')} sx={{ cursor: 'pointer' }}>
            <AnalyticsSummaryCard
              title="Umsatz Heute"
              value={loading ? '-' : formatCurrency(todayRevenue?.revenue || 0)}
              subtitle={loading ? '-' : `${todayRevenue?.transactionCount || 0} Transaktionen`}
              trend={
                todayRevenue && yesterdayRevenue
                  ? {
                      value: calculatePercentageChange(
                        todayRevenue.revenue,
                        yesterdayRevenue.revenue
                      ),
                      label: 'vs. gestern',
                    }
                  : undefined
              }
              icon={<EuroIcon />}
              loading={loading}
              color="success"
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box onClick={() => navigateToAnalytics('/summary')} sx={{ cursor: 'pointer' }}>
            <AnalyticsSummaryCard
              title="Transaktionen"
              value={loading ? '-' : summary?.totalTransactions.toString() || '0'}
              subtitle={
                loading
                  ? '-'
                  : `Ø ${formatCurrency(summary?.avgTransactionValue || 0)}`
              }
              icon={<ShoppingCartIcon />}
              loading={loading}
              color="primary"
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box onClick={() => navigateToAnalytics('/products')} sx={{ cursor: 'pointer' }}>
            <AnalyticsSummaryCard
              title="Meistverkauft"
              value={loading ? '-' : summary?.topSellingProduct?.productName || '-'}
              subtitle={
                loading
                  ? '-'
                  : `${summary?.topSellingProduct?.quantitySold || 0} Stück`
              }
              icon={<TrendingUpIcon />}
              loading={loading}
              color="info"
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Box onClick={() => navigateToAnalytics('/summary')} sx={{ cursor: 'pointer' }}>
            <AnalyticsSummaryCard
              title="Bargeldanteil"
              value={loading ? '-' : `${summary?.cashPercentage.toFixed(1) || 0}%`}
              subtitle="des Gesamtumsatzes"
              icon={<AssessmentIcon />}
              loading={loading}
              color="warning"
            />
          </Box>
        </Grid>
      </Grid>

      {/* Period Comparison */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                Umsatzvergleich
              </Typography>
              <IconButton size="small" onClick={() => navigateToAnalytics('/revenue')}>
                <ArrowForwardIcon />
              </IconButton>
            </Box>
            
            {loading ? (
              <Box>
                <Skeleton height={60} sx={{ mb: 2 }} />
                <Skeleton height={60} />
              </Box>
            ) : (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Heute
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(todayRevenue?.revenue || 0)}
                    </Typography>
                  </Box>
                  {todayRevenue && yesterdayRevenue && (
                    <Box display="flex" alignItems="center" gap={1}>
                      {todayRevenue.revenue > yesterdayRevenue.revenue ? (
                        <TrendingUpIcon color="success" />
                      ) : (
                        <TrendingDownIcon color="error" />
                      )}
                      <Typography
                        variant="body1"
                        color={
                          todayRevenue.revenue > yesterdayRevenue.revenue
                            ? 'success.main'
                            : 'error.main'
                        }
                      >
                        {calculatePercentageChange(
                          todayRevenue.revenue,
                          yesterdayRevenue.revenue
                        ).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Gestern
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(yesterdayRevenue?.revenue || 0)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Top Products Mini List */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                Top Produkte Heute
              </Typography>
              <IconButton size="small" onClick={() => navigateToAnalytics('/products')}>
                <ArrowForwardIcon />
              </IconButton>
            </Box>
            
            {loading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : (
              <List>
                {topProducts.slice(0, 3).map((product, index) => (
                  <ListItem key={product.productId} divider={index < 2}>
                    <ListItemText
                      primary={`${index + 1}. ${product.productName}`}
                      secondary={`${product.quantitySold} Stück verkauft`}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="body2" color="primary">
                        {formatCurrency(product.revenue)}
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Product Table */}
      <Box>
        <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 2 }}>
          Produktleistung im Detail
        </Typography>
        <ProductRankingTable
          products={topProducts}
          title=""
          showRank={true}
          pageSize={5}
          height={300}
        />
      </Box>
    </Box>
  );
}