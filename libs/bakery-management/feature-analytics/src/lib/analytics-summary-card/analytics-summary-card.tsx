import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export interface AnalyticsSummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
  loading?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

export function AnalyticsSummaryCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  color = 'primary',
}: AnalyticsSummaryCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUpIcon color="success" />;
    if (trend.value < 0) return <TrendingDownIcon color="error" />;
    return <TrendingFlatIcon color="inherit" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'inherit';
    if (trend.value > 0) return 'success.main';
    if (trend.value < 0) return 'error.main';
    return 'text.secondary';
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            
            {loading ? (
              <Skeleton variant="text" width="60%" height={40} />
            ) : (
              <Typography variant="h4" component="div" color={`${color}.main`}>
                {value}
              </Typography>
            )}

            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {loading ? <Skeleton variant="text" width="80%" /> : subtitle}
              </Typography>
            )}

            {trend && !loading && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {getTrendIcon()}
                <Typography variant="body2" color={getTrendColor()}>
                  {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
                </Typography>
              </Box>
            )}
          </Box>

          {icon && !loading && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: `${color}.light`,
                color: `${color}.main`,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default AnalyticsSummaryCard;