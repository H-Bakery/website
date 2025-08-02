'use client'

// Production Metrics Card - Key performance indicators for production dashboard
// Shows efficiency, throughput, quality, and timing metrics with trends

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  Avatar,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Schedule,
  CheckCircle,
  Warning,
  Error,
  Speed,
  Assessment,
  Info,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  ProductionMetrics,
  EfficiencyMetrics,
  QualityMetrics,
  TimingMetrics,
  ThroughputMetrics,
} from '../../types/production'

interface ProductionMetricsCardProps {
  metrics: ProductionMetrics
  title?: string
  showTrends?: boolean
  compact?: boolean
}

export const ProductionMetricsCard: React.FC<ProductionMetricsCardProps> = ({
  metrics,
  title = 'Produktionsmetriken',
  showTrends = true,
  compact = false,
}) => {
  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving': return <TrendingUp color="success" />
      case 'declining': return <TrendingDown color="error" />
      case 'stable': return <TrendingFlat color="info" />
    }
  }

  const getTrendColor = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving': return 'success.main'
      case 'declining': return 'error.main'
      case 'stable': return 'info.main'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success'
    if (score >= 70) return 'warning'
    return 'error'
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatNumber = (value: number) => {
    return value.toLocaleString('de-DE')
  }

  if (compact) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {formatPercentage(metrics.efficiency.overall)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Effizienz
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {formatPercentage(metrics.quality.overallQualityScore)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Qualität
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main">
                  {formatPercentage(metrics.timing.onTimePercentage)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pünktlichkeit
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {formatNumber(metrics.overview.completedBatches)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Abgeschlossen
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            {title}
          </Typography>
          <Tooltip title="Metriken Info">
            <IconButton size="small">
              <Info />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Overview Section */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom color="text.secondary">
            Produktionsübersicht
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center" p={1} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="h5" color="primary">
                  {formatNumber(metrics.overview.totalBatches)}
                </Typography>
                <Typography variant="caption">
                  Gesamt Chargen
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center" p={1} bgcolor="success.light" borderRadius={1}>
                <Typography variant="h5" color="success.contrastText">
                  {formatNumber(metrics.overview.completedBatches)}
                </Typography>
                <Typography variant="caption" color="success.contrastText">
                  Abgeschlossen
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center" p={1} bgcolor="primary.light" borderRadius={1}>
                <Typography variant="h5" color="primary.contrastText">
                  {formatNumber(metrics.overview.inProgressBatches)}
                </Typography>
                <Typography variant="caption" color="primary.contrastText">
                  Aktiv
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Box textAlign="center" p={1} bgcolor="error.light" borderRadius={1}>
                <Typography variant="h5" color="error.contrastText">
                  {formatNumber(metrics.overview.failedBatches)}
                </Typography>
                <Typography variant="caption" color="error.contrastText">
                  Fehlgeschlagen
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Key Metrics */}
        <Grid container spacing={3}>
          {/* Efficiency */}
          <Grid item xs={12} md={6}>
            <Box>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}>
                  <Speed fontSize="small" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2">
                    Gesamteffizienz
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {formatPercentage(metrics.efficiency.overall)}
                  </Typography>
                </Box>
                {showTrends && (
                  <Box textAlign="center">
                    {getTrendIcon(metrics.trends.efficiency.trend)}
                    <Typography variant="caption" color={getTrendColor(metrics.trends.efficiency.trend)}>
                      {metrics.trends.efficiency.change > 0 ? '+' : ''}{formatPercentage(metrics.trends.efficiency.change)}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Box mb={1}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption">Produktion</Typography>
                  <Typography variant="caption">{formatPercentage(metrics.efficiency.production)}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={metrics.efficiency.production}
                  color={getScoreColor(metrics.efficiency.production)}
                />
              </Box>
              
              <Box mb={1}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption">Zeit</Typography>
                  <Typography variant="caption">{formatPercentage(metrics.efficiency.time)}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={metrics.efficiency.time}
                  color={getScoreColor(metrics.efficiency.time)}
                />
              </Box>
              
              <Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption">Qualität</Typography>
                  <Typography variant="caption">{formatPercentage(metrics.efficiency.quality)}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={metrics.efficiency.quality}
                  color={getScoreColor(metrics.efficiency.quality)}
                />
              </Box>
            </Box>
          </Grid>

          {/* Quality */}
          <Grid item xs={12} md={6}>
            <Box>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2, width: 32, height: 32 }}>
                  <CheckCircle fontSize="small" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2">
                    Qualitätsbewertung
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {formatPercentage(metrics.quality.overallQualityScore)}
                  </Typography>
                </Box>
                {showTrends && (
                  <Box textAlign="center">
                    {getTrendIcon(metrics.trends.quality.trend)}
                    <Typography variant="caption" color={getTrendColor(metrics.trends.quality.trend)}>
                      {metrics.trends.quality.change > 0 ? '+' : ''}{formatPercentage(metrics.trends.quality.change)}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Box textAlign="center" p={1} bgcolor="success.light" borderRadius={1}>
                    <Typography variant="body2" color="success.contrastText">
                      {formatNumber(metrics.quality.totalQualityChecks)}
                    </Typography>
                    <Typography variant="caption" color="success.contrastText">
                      Kontrollen
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box textAlign="center" p={1} bgcolor="warning.light" borderRadius={1}>
                    <Typography variant="body2" color="warning.contrastText">
                      {formatNumber(metrics.quality.totalIssues)}
                    </Typography>
                    <Typography variant="caption" color="warning.contrastText">
                      Probleme
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box textAlign="center" p={1} bgcolor="info.light" borderRadius={1}>
                    <Typography variant="body2" color="info.contrastText">
                      {formatPercentage(metrics.quality.qualityCheckCompletionRate)}
                    </Typography>
                    <Typography variant="caption" color="info.contrastText">
                      Vollständig
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Timing */}
          <Grid item xs={12} md={6}>
            <Box>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2, width: 32, height: 32 }}>
                  <Schedule fontSize="small" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2">
                    Zeitmanagement
                  </Typography>
                  <Typography variant="h5" color="info.main">
                    {formatPercentage(metrics.timing.onTimePercentage)}
                  </Typography>
                </Box>
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Box display="flex" alignItems="center" p={1} bgcolor="success.light" borderRadius={1}>
                    <CheckCircle fontSize="small" sx={{ mr: 1, color: 'success.contrastText' }} />
                    <Box>
                      <Typography variant="body2" color="success.contrastText">
                        {formatNumber(metrics.timing.onTimeBatches)}
                      </Typography>
                      <Typography variant="caption" color="success.contrastText">
                        Pünktlich
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box display="flex" alignItems="center" p={1} bgcolor="warning.light" borderRadius={1}>
                    <Warning fontSize="small" sx={{ mr: 1, color: 'warning.contrastText' }} />
                    <Box>
                      <Typography variant="body2" color="warning.contrastText">
                        {formatNumber(metrics.timing.delayedBatches)}
                      </Typography>
                      <Typography variant="caption" color="warning.contrastText">
                        Verspätet
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={4}>
                  <Box display="flex" alignItems="center" p={1} bgcolor="info.light" borderRadius={1}>
                    <TrendingUp fontSize="small" sx={{ mr: 1, color: 'info.contrastText' }} />
                    <Box>
                      <Typography variant="body2" color="info.contrastText">
                        {formatNumber(metrics.timing.earlyBatches)}
                      </Typography>
                      <Typography variant="caption" color="info.contrastText">
                        Früh
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
              
              {metrics.timing.averageDelayMinutes > 0 && (
                <Box mt={1} p={1} bgcolor="warning.light" borderRadius={1}>
                  <Typography variant="caption" color="warning.contrastText">
                    Durchschnittliche Verspätung: {Math.round(metrics.timing.averageDelayMinutes)} Minuten
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Throughput */}
          <Grid item xs={12} md={6}>
            <Box>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2, width: 32, height: 32 }}>
                  <Assessment fontSize="small" />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2">
                    Durchsatz
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {formatNumber(metrics.throughput.summary.averageBatchesPerPeriod)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Chargen/Tag
                  </Typography>
                </Box>
                {showTrends && (
                  <Box textAlign="center">
                    {getTrendIcon(metrics.trends.throughput.trend)}
                    <Typography variant="caption" color={getTrendColor(metrics.trends.throughput.trend)}>
                      {metrics.trends.throughput.change > 0 ? '+' : ''}{formatPercentage(metrics.trends.throughput.change)}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="primary.light" borderRadius={1}>
                    <Typography variant="body2" color="primary.contrastText">
                      {formatNumber(metrics.throughput.summary.peakBatches)}
                    </Typography>
                    <Typography variant="caption" color="primary.contrastText">
                      Peak Chargen
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="secondary.light" borderRadius={1}>
                    <Typography variant="body2" color="secondary.contrastText">
                      {formatNumber(metrics.throughput.summary.averageQuantityPerPeriod)}
                    </Typography>
                    <Typography variant="caption" color="secondary.contrastText">
                      Ø Menge/Tag
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Recommendations */}
        {metrics.recommendations.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Empfehlungen ({metrics.recommendations.length})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {metrics.recommendations.slice(0, 3).map((rec, index) => (
                <Chip
                  key={index}
                  label={rec.title}
                  size="small"
                  color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'}
                  variant="outlined"
                />
              ))}
              {metrics.recommendations.length > 3 && (
                <Chip
                  label={`+${metrics.recommendations.length - 3} weitere`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}

        {/* Period Info */}
        <Box mt={2} textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Zeitraum: {format(new Date(metrics.period.start), 'dd.MM.yyyy', { locale: de })} - 
            {format(new Date(metrics.period.end), 'dd.MM.yyyy', { locale: de })} 
            ({metrics.period.days} Tage)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ProductionMetricsCard