# @bakery/management/feature-analytics

This library provides reusable analytics components for the bakery management application, including charts, data tables, and interactive filters.

## Components

### Charts
- **RevenueTrendChart** - Line/Bar chart for revenue trends over time
- **PaymentMethodsChart** - Pie chart for payment method distribution

### Tables
- **ProductRankingTable** - Data grid for product performance with sorting and pagination

### Input Components
- **DateRangePicker** - Date range selector with preset options
- **ExportButton** - Multi-format export functionality (CSV, PDF, Excel)

### Display Components
- **AnalyticsSummaryCard** - Summary metric card with trend indicators

## Usage

```typescript
import {
  RevenueTrendChart,
  ProductRankingTable,
  DateRangePicker,
  ExportButton,
  AnalyticsSummaryCard,
  PaymentMethodsChart,
} from '@bakery/management/feature-analytics';
```

## Running unit tests

Run `nx test bakery-management-feature-analytics` to execute the unit tests via [Jest](https://jestjs.io).
