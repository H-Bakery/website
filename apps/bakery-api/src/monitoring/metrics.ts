import { Counter, Histogram, Gauge, register } from 'prom-client';
import { Application } from 'express';
import { logger } from '@bakery/api/core';

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Business metrics
export const orderTotal = new Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status', 'payment_method']
});

export const orderValue = new Histogram({
  name: 'order_value_eur',
  help: 'Order value in EUR',
  labelNames: ['customer_type'],
  buckets: [10, 25, 50, 100, 250, 500, 1000]
});

export const inventoryLevel = new Gauge({
  name: 'inventory_level',
  help: 'Current inventory level',
  labelNames: ['product_id', 'product_name', 'category']
});

export const lowInventoryItems = new Gauge({
  name: 'low_inventory_items_total',
  help: 'Number of items below low stock threshold'
});

// Production metrics
export const productionBatchesTotal = new Counter({
  name: 'production_batches_total',
  help: 'Total number of production batches',
  labelNames: ['recipe_name', 'status']
});

export const productionEfficiency = new Gauge({
  name: 'production_efficiency_percentage',
  help: 'Production efficiency percentage',
  labelNames: ['recipe_name']
});

// System metrics
export const activeConnections = new Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

export const databaseConnectionPool = new Gauge({
  name: 'database_connection_pool_size',
  help: 'Database connection pool metrics',
  labelNames: ['state'] // 'used', 'idle', 'total'
});

// Error metrics
export const errorTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'module']
});

// Authentication metrics
export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['result', 'method'] // result: 'success', 'failure'; method: 'login', 'token'
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(orderTotal);
register.registerMetric(orderValue);
register.registerMetric(inventoryLevel);
register.registerMetric(lowInventoryItems);
register.registerMetric(productionBatchesTotal);
register.registerMetric(productionEfficiency);
register.registerMetric(activeConnections);
register.registerMetric(databaseConnectionPool);
register.registerMetric(errorTotal);
register.registerMetric(authenticationAttempts);

// Middleware to track HTTP metrics
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
}

// Setup metrics endpoint
export function setupMetricsEndpoint(app: Application) {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      logger.error('Error generating metrics', error);
      res.status(500).end();
    }
  });
  
  logger.info('Metrics endpoint available at /metrics');
}

// Utility functions to update business metrics
export function recordOrder(status: string, paymentMethod: string, value: number, customerType: string) {
  orderTotal.labels(status, paymentMethod).inc();
  orderValue.labels(customerType).observe(value);
}

export function updateInventoryMetrics(productId: string, productName: string, category: string, level: number) {
  inventoryLevel.labels(productId, productName, category).set(level);
}

export function recordProductionBatch(recipeName: string, status: string) {
  productionBatchesTotal.labels(recipeName, status).inc();
}

export function recordError(type: string, severity: string, module: string) {
  errorTotal.labels(type, severity, module).inc();
}

export function recordAuthAttempt(result: 'success' | 'failure', method: 'login' | 'token') {
  authenticationAttempts.labels(result, method).inc();
}