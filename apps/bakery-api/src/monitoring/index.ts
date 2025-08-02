// Export all monitoring utilities
export * from './metrics';
export * from './health';
export * from './tracing';
export * from './logging';
export * from './alerts';

import { Application } from 'express';
import { setupMetricsEndpoint, metricsMiddleware } from './metrics';
import { setupHealthEndpoints, setupGracefulShutdown } from './health';
import { initializeTracing } from './tracing';
import { requestLoggingMiddleware, errorLoggingMiddleware, setupLogRotation } from './logging';
import { initializeAlertHandlers } from './alerts';
import { logger } from '@bakery/api/core';

export interface MonitoringOptions {
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableHealthChecks?: boolean;
  enableRequestLogging?: boolean;
  enableAlerts?: boolean;
}

export function setupMonitoring(app: Application, server: any, options: MonitoringOptions = {}) {
  const {
    enableTracing = true,
    enableMetrics = true,
    enableHealthChecks = true,
    enableRequestLogging = true,
    enableAlerts = true
  } = options;
  
  logger.info('Setting up monitoring and observability...');
  
  // Initialize OpenTelemetry tracing
  if (enableTracing) {
    initializeTracing();
  }
  
  // Setup request logging
  if (enableRequestLogging) {
    app.use(requestLoggingMiddleware);
    setupLogRotation();
  }
  
  // Setup metrics
  if (enableMetrics) {
    app.use(metricsMiddleware);
    setupMetricsEndpoint(app);
  }
  
  // Setup health checks
  if (enableHealthChecks) {
    setupHealthEndpoints(app);
    setupGracefulShutdown(server);
  }
  
  // Setup alerts
  if (enableAlerts) {
    initializeAlertHandlers();
  }
  
  // Error logging middleware (should be last)
  app.use(errorLoggingMiddleware);
  
  logger.info('Monitoring and observability setup complete');
}

// Utility function to create monitoring dashboard config
export function generateGrafanaDashboard() {
  return {
    dashboard: {
      title: 'Bakery API Monitoring',
      panels: [
        {
          title: 'Request Rate',
          targets: [{
            expr: 'rate(http_requests_total[5m])',
            legendFormat: '{{method}} {{route}}'
          }]
        },
        {
          title: 'Response Time (p95)',
          targets: [{
            expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
            legendFormat: 'p95'
          }]
        },
        {
          title: 'Error Rate',
          targets: [{
            expr: 'rate(http_requests_total{status_code=~"5.."}[5m])',
            legendFormat: '5xx errors'
          }]
        },
        {
          title: 'Orders by Status',
          targets: [{
            expr: 'rate(orders_total[1h])',
            legendFormat: '{{status}}'
          }]
        },
        {
          title: 'Low Inventory Items',
          targets: [{
            expr: 'low_inventory_items_total',
            legendFormat: 'Low stock items'
          }]
        },
        {
          title: 'Active WebSocket Connections',
          targets: [{
            expr: 'websocket_active_connections',
            legendFormat: 'Active connections'
          }]
        }
      ]
    }
  };
}

// Prometheus scrape config generator
export function generatePrometheusConfig(targets: string[]) {
  return {
    global: {
      scrape_interval: '15s',
      evaluation_interval: '15s'
    },
    scrape_configs: [
      {
        job_name: 'bakery-api',
        static_configs: [
          {
            targets: targets
          }
        ]
      }
    ]
  };
}