# Monitoring Guide

## Success Metrics Overview

Key performance indicators to track the success of the Nx monorepo migration and ongoing operations.

### Development Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Build Time | <5 min for affected | GitHub Actions logs |
| Test Coverage | >80% | Jest coverage reports |
| Deployment Frequency | Daily | GitHub deployments API |
| Lead Time | <2 hours | PR merge to production |
| Code Duplication | <5% | SonarQube analysis |

### Application Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page Load Time | <2s | Lighthouse CI |
| API Response Time | <200ms p95 | Application metrics |
| Error Rate | <0.1% | Error tracking |
| Uptime | 99.9% | Uptime monitoring |
| SEO Score | >90 | Lighthouse |

## Monitoring Stack

### Application Monitoring

```typescript
// libs/shared/monitoring/src/lib/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

// Request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Request counter
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Business metrics
export const orderTotal = new Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status', 'payment_method'],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(orderTotal);
```

### Error Tracking

```typescript
// libs/shared/monitoring/src/lib/error-tracking.ts
import * as Sentry from '@sentry/node';

export function initErrorTracking() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
  });
}

export function captureError(error: Error, context?: any) {
  Sentry.captureException(error, {
    extra: context,
  });
}
```

### Performance Monitoring

```typescript
// apps/bakery-shop/src/app/layout.tsx
import { WebVitals } from '@bakery/shared/monitoring';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}

// libs/shared/monitoring/src/lib/web-vitals.tsx
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to analytics
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(metric);
    }
  });

  return null;
}
```

## Dashboard Setup

### Grafana Configuration

```json
// monitoring/dashboards/bakery-overview.json
{
  "dashboard": {
    "title": "Bakery System Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "title": "Order Volume",
        "targets": [
          {
            "expr": "rate(orders_total[1h])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### Alert Configuration

```yaml
# monitoring/alerts/rules.yml
groups:
  - name: bakery_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow response times"
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: LowInventory
        expr: inventory_level < 10
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low inventory for {{ $labels.product }}"
          description: "Current level: {{ $value }}"
```

## Build Performance Tracking

### Nx Cloud Dashboard

```typescript
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "accessToken": "your-nx-cloud-access-token",
        "cacheableOperations": ["build", "test", "lint"],
        "canTrackAnalytics": true,
        "showUsageWarnings": true
      }
    }
  }
}
```

### GitHub Actions Metrics

```yaml
# .github/workflows/metrics.yml
name: Collect Metrics
on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types: [completed]

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Collect build metrics
        uses: actions/github-script@v6
        with:
          script: |
            const workflow = context.payload.workflow_run;
            const duration = new Date(workflow.updated_at) - new Date(workflow.created_at);
            
            // Send to monitoring service
            await fetch('https://api.monitoring.com/metrics', {
              method: 'POST',
              body: JSON.stringify({
                metric: 'build_duration',
                value: duration,
                tags: {
                  workflow: workflow.name,
                  status: workflow.conclusion,
                  branch: workflow.head_branch
                }
              })
            });
```

## Business Metrics

### Order Analytics

```typescript
// apps/bakery-api/src/modules/orders/order.service.ts
import { orderTotal } from '@bakery/shared/monitoring';

export class OrderService {
  async createOrder(data: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.create(data);
    
    // Track business metrics
    orderTotal.inc({
      status: order.status,
      payment_method: order.paymentMethod,
    });

    // Track revenue
    await this.analytics.track({
      event: 'order_created',
      properties: {
        orderId: order.id,
        revenue: order.total,
        itemCount: order.items.length,
        customerType: order.customer.type,
      },
    });

    return order;
  }
}
```

### Customer Analytics

```typescript
// libs/bakery-shop/feature-analytics/src/lib/analytics.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export function Analytics() {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Track page views
      window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_path: url,
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return null;
}

// Track custom events
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}
```

## Log Management

### Structured Logging

```typescript
// libs/shared/logger/src/lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Add cloud logging in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Http({
    host: 'logs.example.com',
    path: '/collect',
    ssl: true,
  }));
}
```

### Log Aggregation

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: logstash:8.8.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.8.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

## Synthetic Monitoring

### API Health Checks

```typescript
// monitoring/health-checks/api-health.ts
import { CronJob } from 'cron';
import axios from 'axios';

const healthChecks = [
  { name: 'API Health', url: 'https://api.yourdomain.com/health' },
  { name: 'Shop Homepage', url: 'https://shop.yourdomain.com' },
  { name: 'Management Login', url: 'https://manage.yourdomain.com/login' },
];

new CronJob('*/5 * * * *', async () => {
  for (const check of healthChecks) {
    try {
      const start = Date.now();
      const response = await axios.get(check.url);
      const duration = Date.now() - start;

      await reportMetric({
        metric: 'health_check',
        value: response.status === 200 ? 1 : 0,
        tags: {
          name: check.name,
          duration,
          status: response.status,
        },
      });
    } catch (error) {
      await reportMetric({
        metric: 'health_check',
        value: 0,
        tags: {
          name: check.name,
          error: error.message,
        },
      });
    }
  }
}).start();
```

## Development Metrics

### Code Quality Tracking

```yaml
# .github/workflows/code-quality.yml
name: Code Quality
on: [push]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      
      - name: Track metrics
        run: |
          echo "::notice::Code coverage: $(cat coverage/lcov-report/index.html | grep -oP '(?<=<span class="strong">)\d+.\d+(?=%</span>)' | head -1)%"
```

### Sprint Velocity

```typescript
// scripts/sprint-metrics.ts
import { Octokit } from '@octokit/rest';

async function calculateVelocity() {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const { data: issues } = await octokit.issues.listForRepo({
    owner: 'your-org',
    repo: 'bakery-monorepo',
    state: 'closed',
    labels: 'sprint-current',
  });

  const velocity = issues.reduce((total, issue) => {
    const points = issue.labels.find(l => l.name.startsWith('points:'));
    return total + (points ? parseInt(points.name.split(':')[1]) : 0);
  }, 0);

  console.log(`Sprint velocity: ${velocity} points`);
}
```

## Cost Monitoring

### Infrastructure Costs

```typescript
// scripts/cost-tracking.ts
import { CostExplorer } from 'aws-sdk';

async function trackMonthlyCosts() {
  const ce = new CostExplorer();
  
  const result = await ce.getCostAndUsage({
    TimePeriod: {
      Start: '2024-01-01',
      End: '2024-01-31',
    },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'SERVICE' },
    ],
  }).promise();

  const costs = result.ResultsByTime[0].Groups.map(group => ({
    service: group.Keys[0],
    cost: parseFloat(group.Metrics.UnblendedCost.Amount),
  }));

  console.table(costs);
}
```

## Success Criteria Summary

Track these metrics monthly to ensure project success:

1. **Performance**: Page load <2s, API response <200ms
2. **Reliability**: 99.9% uptime, <0.1% error rate
3. **Development**: <5min builds, >80% test coverage
4. **Business**: Order completion rate >95%, Customer satisfaction >4.5/5
5. **Cost**: Infrastructure <$100/month, Cost per order <$0.10