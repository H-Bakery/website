import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { RevenueData, Granularity } from '@bakery/shared/types';

export interface RevenueTrendChartProps {
  data: RevenueData[];
  granularity?: Granularity;
  chartType?: 'line' | 'bar';
  height?: number;
  title?: string;
  showTransactions?: boolean;
}

export function RevenueTrendChart({
  data,
  granularity = 'daily',
  chartType = 'line',
  height = 400,
  title = 'Umsatzentwicklung',
  showTransactions = false,
}: RevenueTrendChartProps) {
  const [currentChartType, setChartType] = React.useState(chartType);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    switch (granularity) {
      case 'daily':
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      case 'weekly':
        return `KW ${Math.ceil(date.getDate() / 7)}`;
      case 'monthly':
        return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
      default:
        return dateString;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const chartData = data.map((item) => ({
    ...item,
    date: formatDate(item.date),
  }));

  const Chart = currentChartType === 'line' ? LineChart : BarChart;
  const DataComponent = currentChartType === 'line' ? Line : Bar;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <ToggleButtonGroup
          value={currentChartType}
          exclusive
          onChange={(_, value) => value && setChartType(value)}
          size="small"
        >
          <ToggleButton value="line">Linie</ToggleButton>
          <ToggleButton value="bar">Balken</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="revenue" tickFormatter={formatCurrency} />
          {showTransactions && (
            <YAxis yAxisId="transactions" orientation="right" />
          )}
          <Tooltip
            formatter={(value: any, name: string) => {
              if (name === 'revenue') return formatCurrency(value);
              return value;
            }}
            labelFormatter={(label) => `Datum: ${label}`}
          />
          <Legend />
          <DataComponent
            yAxisId="revenue"
            dataKey="revenue"
            name="Umsatz"
            stroke="#007bff"
            fill="#007bff"
            strokeWidth={currentChartType === 'line' ? 2 : undefined}
          />
          {showTransactions && (
            <DataComponent
              yAxisId="transactions"
              dataKey="transactionCount"
              name="Transaktionen"
              stroke="#28a745"
              fill="#28a745"
              strokeWidth={currentChartType === 'line' ? 2 : undefined}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </Paper>
  );
}

export default RevenueTrendChart;