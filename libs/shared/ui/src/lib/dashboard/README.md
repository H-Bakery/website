# Dashboard Components

A collection of data visualization and dashboard components for the bakery management system.

## Components

### MetricCard

Displays key performance indicators (KPIs) and metrics.

```tsx
import { MetricCard } from '@bakery/shared/ui'

;<MetricCard
  title="Daily Sales"
  value="€1,250"
  trend={+15.2}
  icon={<TrendingUpIcon />}
/>
```

### DataTable

Configurable data table with sorting, filtering, and pagination.

```tsx
import { DataTable } from '@bakery/shared/ui'

;<DataTable
  data={orders}
  columns={orderColumns}
  sortable
  filterable
  pagination
/>
```

### ChartComponent

Flexible chart wrapper supporting various chart types.

```tsx
import { ChartComponent } from '@bakery/shared/ui'

;<ChartComponent type="line" data={salesData} title="Sales Trend" />
```

### DateRangeSelector

Date range picker for filtering dashboard data.

```tsx
import { DateRangeSelector } from '@bakery/shared/ui'

;<DateRangeSelector
  startDate={startDate}
  endDate={endDate}
  onChange={handleDateChange}
/>
```

### ProductivityChart

Specialized chart for displaying productivity metrics.

```tsx
import { ProductivityChart } from '@bakery/shared/ui'

;<ProductivityChart data={productivityData} period="weekly" />
```

### StatsComparison

Component for comparing statistics across different periods.

```tsx
import { StatsComparison } from '@bakery/shared/ui'

;<StatsComparison
  current={currentStats}
  previous={previousStats}
  metrics={['sales', 'orders', 'customers']}
/>
```

## Usage Notes

- All dashboard components are designed to work with the bakery's theming system
- Components expect data in specific formats - check individual component documentation
- Most components are responsive and work well on both desktop and mobile displays
