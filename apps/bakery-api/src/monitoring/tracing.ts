import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { logger } from '@bakery/api/core';

// Create resource identifying the service
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'bakery-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env['APP_VERSION'] || '0.0.0',
    environment: process.env['NODE_ENV'] || 'development',
  })
);

// Configure Jaeger exporter (if enabled)
function createTraceExporter() {
  if (process.env['JAEGER_ENDPOINT']) {
    return new JaegerExporter({
      endpoint: process.env['JAEGER_ENDPOINT'],
    });
  }
  return null;
}

// Initialize OpenTelemetry
export function initializeTracing() {
  try {
    const traceExporter = createTraceExporter();
    
    const sdk = new NodeSDK({
      resource,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
      metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 60000, // Export metrics every minute
      }),
    });

    // Add span processor if Jaeger is configured
    if (traceExporter) {
      sdk.configureSdkRegistration();
      const provider = sdk['_tracerProvider'];
      if (provider) {
        provider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
      }
    }

    // Initialize the SDK
    sdk.start()
      .then(() => {
        logger.info('OpenTelemetry tracing initialized');
        if (process.env['JAEGER_ENDPOINT']) {
          logger.info(`Sending traces to Jaeger at ${process.env['JAEGER_ENDPOINT']}`);
        }
      })
      .catch((error) => {
        logger.error('Error initializing OpenTelemetry', error);
      });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => logger.info('OpenTelemetry terminated'))
        .catch((error) => logger.error('Error terminating OpenTelemetry', error));
    });
  } catch (error) {
    logger.error('Failed to initialize tracing', error);
  }
}

// Custom span creation utilities
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('bakery-api');

export function createSpan(name: string, fn: () => Promise<any>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function traceAsync<T>(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return createSpan(`${target.constructor.name}.${propertyKey}`, async () => {
        return await originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}