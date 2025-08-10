# Bakery System Monitoring Stack

## Overview

This monitoring stack provides comprehensive observability for the bakery management system, including:

- **Metrics Collection** - Prometheus for metrics storage and querying
- **Visualization** - Grafana dashboards for real-time monitoring
- **Log Aggregation** - Loki for centralized logging
- **Distributed Tracing** - Jaeger for request tracing
- **Alerting** - AlertManager for alert routing and notifications

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check service status
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Monitoring Services

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger UI**: http://localhost:16686
- **AlertManager**: http://localhost:9093

### 3. Configure Your Application

Add these environment variables to your bakery API:

```bash
# Enable tracing
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Configure alerts (optional)
ALERT_WEBHOOK_URL=https://your-webhook-url
ALERT_EMAIL_ENABLED=true
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Bakery API    │────▶│   Prometheus    │────▶│    Grafana      │
│  (metrics)      │     │  (storage)      │     │ (visualization) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │               ┌─────────────────┐             │
        └──────────────▶│      Loki       │─────────────┘
        │   (logs)      │  (log storage)  │
        │               └─────────────────┘
        │
        │               ┌─────────────────┐
        └──────────────▶│     Jaeger      │
           (traces)     │ (trace storage) │
                        └─────────────────┘
```

## Metrics

### Business Metrics

- `orders_total` - Total number of orders by status
- `order_value_eur` - Order values histogram
- `inventory_level` - Current inventory levels by product
- `low_inventory_items_total` - Count of items below threshold
- `production_batches_total` - Production batch counts
- `production_efficiency_percentage` - Production efficiency

### Technical Metrics

- `http_requests_total` - HTTP request counts
- `http_request_duration_seconds` - Request latency histogram
- `websocket_active_connections` - Active WebSocket connections
- `database_connection_pool_size` - DB connection pool stats
- `errors_total` - Error counts by type and severity

### Security Metrics

- `authentication_attempts_total` - Auth attempts by result

## Dashboards

### Pre-configured Dashboards

1. **Bakery API Dashboard** - Overall system health

   - Request rate and latency
   - Error rates
   - Business metrics overview

2. **Order Management** - Order-specific metrics

   - Orders by status
   - Order values distribution
   - Peak ordering times

3. **Inventory Management** - Stock levels

   - Current inventory levels
   - Low stock alerts
   - Restock recommendations

4. **Production Tracking** - Production metrics
   - Batch status
   - Efficiency tracking
   - Production schedules

## Alerts

### Critical Alerts

- **Service Down** - API unreachable for >1 minute
- **High Error Rate** - >5% errors for 5 minutes
- **Database Connection Failure** - DB unreachable
- **High Auth Failure Rate** - Possible security issue

### Warning Alerts

- **Slow Response Time** - p95 latency >1s
- **Low Inventory** - Multiple items below threshold
- **High Memory Usage** - >1GB memory consumption
- **No Orders** - No orders received for 2 hours

## Log Management

### Log Format

All logs are structured JSON with consistent fields:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "bakery-api",
  "message": "Order created",
  "orderId": "123",
  "customerId": "456"
}
```

### Log Queries in Grafana

Example queries:

```logql
# All errors
{job="bakery-api"} |= "error"

# Orders in last hour
{job="bakery-api"} |= "order" | json | __error__="" | level="info"

# Authentication failures
{job="bakery-api"} |= "authentication" | json | result="failure"
```

## Distributed Tracing

### Trace Integration

The API automatically instruments:

- HTTP requests
- Database queries
- External API calls
- Message queue operations

### Viewing Traces

1. Open Jaeger UI: http://localhost:16686
2. Select service: `bakery-api`
3. Find traces by:
   - Operation name
   - Duration
   - Tags (orderId, customerId, etc.)

## Customization

### Adding Custom Metrics

```typescript
// In your application code
import { recordOrder, updateInventoryMetrics } from './monitoring'

// Record business events
recordOrder('completed', 'credit_card', 150.0, 'regular')
updateInventoryMetrics('prod-123', 'Croissants', 'pastry', 45)
```

### Creating New Dashboards

1. Open Grafana: http://localhost:3001
2. Create new dashboard
3. Add panels with PromQL queries
4. Save to `monitoring/grafana/dashboards/`

### Adding Alerts

Edit `monitoring/prometheus/alerts/bakery-alerts.yml`:

```yaml
- alert: CustomAlert
  expr: your_metric > threshold
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Alert description'
```

## Maintenance

### Backup

```bash
# Backup Prometheus data
docker run --rm -v bakery-monitoring_prometheus-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz -C /data .

# Backup Grafana dashboards
docker run --rm -v bakery-monitoring_grafana-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz -C /data .
```

### Log Rotation

Logs are automatically rotated:

- Application logs: Daily rotation, 14 days retention
- Container logs: Configured via Docker daemon

### Scaling

For production environments:

1. **Use external storage**:

   - Prometheus: Remote write to Cortex/Thanos
   - Loki: S3-compatible object storage
   - Jaeger: Elasticsearch backend

2. **High Availability**:
   - Run multiple Prometheus instances
   - Use Grafana in HA mode
   - Deploy AlertManager cluster

## Troubleshooting

### Common Issues

1. **No metrics showing**:

   - Check API is running: `curl http://localhost:5000/metrics`
   - Verify Prometheus scraping: http://localhost:9090/targets

2. **Logs not appearing**:

   - Check Promtail config matches log location
   - Verify log format is JSON

3. **Traces missing**:
   - Ensure `ENABLE_TRACING=true`
   - Check Jaeger endpoint configuration

### Debug Commands

```bash
# Check service logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs grafana

# Test metric endpoint
curl http://localhost:5000/metrics | grep http_requests_total

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

## Security Considerations

1. **Change default passwords**:

   - Grafana admin password
   - Add authentication to Prometheus

2. **Network isolation**:

   - Use internal Docker network
   - Expose only necessary ports

3. **Data retention**:
   - Configure appropriate retention periods
   - Implement data archival strategy

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry](https://opentelemetry.io/docs/)
