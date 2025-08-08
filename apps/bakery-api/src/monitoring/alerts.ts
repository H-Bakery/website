// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}
import {
  orderTotal,
  errorTotal,
  httpRequestDuration,
  inventoryLevel,
  authenticationAttempts,
} from './metrics'

interface AlertRule {
  name: string
  condition: () => Promise<boolean>
  message: string
  severity: 'critical' | 'warning' | 'info'
  cooldown: number // minutes
}

interface AlertState {
  lastFired: Date | null
  count: number
}

class AlertManager {
  private rules: AlertRule[] = []
  private alertStates: Map<string, AlertState> = new Map()
  private alertHandlers: ((alert: any) => void)[] = []

  addRule(rule: AlertRule) {
    this.rules.push(rule)
    this.alertStates.set(rule.name, { lastFired: null, count: 0 })
  }

  addHandler(handler: (alert: any) => void) {
    this.alertHandlers.push(handler)
  }

  private async checkRule(rule: AlertRule) {
    try {
      const shouldAlert = await rule.condition()
      const state = this.alertStates.get(rule.name)!

      if (shouldAlert) {
        const now = new Date()
        const cooldownExpired =
          !state.lastFired ||
          now.getTime() - state.lastFired.getTime() > rule.cooldown * 60 * 1000

        if (cooldownExpired) {
          state.lastFired = now
          state.count++

          const alert = {
            rule: rule.name,
            message: rule.message,
            severity: rule.severity,
            timestamp: now,
            count: state.count,
          }

          logger.warn(`Alert triggered: ${rule.name}`, alert)

          // Call all alert handlers
          this.alertHandlers.forEach((handler) => {
            try {
              handler(alert)
            } catch (error) {
              logger.error('Alert handler error', error)
            }
          })
        }
      }
    } catch (error) {
      logger.error(`Error checking alert rule ${rule.name}`, error)
    }
  }

  async checkAllRules() {
    await Promise.all(this.rules.map((rule) => this.checkRule(rule)))
  }

  startMonitoring(intervalMinutes: number = 1) {
    setInterval(() => {
      this.checkAllRules()
    }, intervalMinutes * 60 * 1000)

    logger.info(
      `Alert monitoring started, checking every ${intervalMinutes} minutes`
    )
  }
}

// Create alert manager instance
export const alertManager = new AlertManager()

// Define alert rules
alertManager.addRule({
  name: 'HighErrorRate',
  condition: async () => {
    // Check if error rate is above 5% in the last 5 minutes
    // This is a simplified check - in production, you'd query Prometheus
    return false // Placeholder
  },
  message: 'High error rate detected (>5% in last 5 minutes)',
  severity: 'critical',
  cooldown: 5,
})

alertManager.addRule({
  name: 'SlowResponseTime',
  condition: async () => {
    // Check if p95 response time is above 1 second
    // This is a simplified check - in production, you'd query Prometheus
    return false // Placeholder
  },
  message: 'Slow response times detected (p95 > 1s)',
  severity: 'warning',
  cooldown: 10,
})

alertManager.addRule({
  name: 'LowInventory',
  condition: async () => {
    // Check if any inventory items are below threshold
    // This would query the database in production
    return false // Placeholder
  },
  message: 'Low inventory items detected',
  severity: 'warning',
  cooldown: 60,
})

alertManager.addRule({
  name: 'HighAuthFailureRate',
  condition: async () => {
    // Check if authentication failure rate is high
    // This could indicate a brute force attack
    return false // Placeholder
  },
  message: 'High authentication failure rate detected',
  severity: 'critical',
  cooldown: 5,
})

alertManager.addRule({
  name: 'DatabaseConnectionFailure',
  condition: async () => {
    // Check database connectivity
    try {
      const { sequelize } = await import('@bakery/api/database')
      await sequelize.authenticate()
      return false
    } catch {
      return true
    }
  },
  message: 'Database connection failure',
  severity: 'critical',
  cooldown: 1,
})

// Alert handlers
alertManager.addHandler(async (alert) => {
  // Log to monitoring system
  logger.error('Alert fired', alert)

  // In production, you would:
  // - Send to PagerDuty/OpsGenie
  // - Post to Slack/Discord
  // - Send email notifications
  // - Create incident tickets

  if (alert.severity === 'critical') {
    // Handle critical alerts
    logger.error('CRITICAL ALERT', alert)
  }
})

// Webhook notification handler
export async function sendWebhookAlert(alert: any) {
  if (!process.env['ALERT_WEBHOOK_URL']) {
    return
  }

  try {
    const response = await fetch(process.env['ALERT_WEBHOOK_URL'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
        alert,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      logger.error('Failed to send webhook alert', response.statusText)
    }
  } catch (error) {
    logger.error('Error sending webhook alert', error)
  }
}

// Email notification handler (placeholder)
export async function sendEmailAlert(alert: any) {
  // This would integrate with an email service like SendGrid
  logger.info('Email alert would be sent', alert)
}

// Initialize alert handlers based on environment
export function initializeAlertHandlers() {
  if (process.env['ALERT_WEBHOOK_URL']) {
    alertManager.addHandler(sendWebhookAlert)
  }

  if (process.env['ALERT_EMAIL_ENABLED'] === 'true') {
    alertManager.addHandler(sendEmailAlert)
  }

  // Start monitoring
  alertManager.startMonitoring(1) // Check every minute
}
