// TODO: Import from domain libraries when created
// import { Notification } from '@bakery/api/notifications';
// import { Customer } from '@bakery/api/customers';
import { Notification, Customer } from '../models'
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

const sampleNotifications = [
  {
    title: 'Willkommen im Admin-Bereich',
    message:
      'Herzlich willkommen im neuen Benachrichtigungssystem. Hier erhalten Sie wichtige Updates.',
    type: 'info' as const,
    category: 'system' as const,
    priority: 'medium' as const,
  },
  {
    title: 'Neue Bestellung eingegangen',
    message:
      'Eine neue Online-Bestellung (#12345) wurde aufgegeben und wartet auf Bestätigung.',
    type: 'success' as const,
    category: 'order' as const,
    priority: 'high' as const,
  },
  {
    title: 'Niedriger Lagerbestand: Mehl',
    message:
      'Der Lagerbestand für Weizenmehl Type 550 ist niedrig (nur noch 10kg). Bitte nachbestellen.',
    type: 'warning' as const,
    category: 'inventory' as const,
    priority: 'high' as const,
  },
  {
    title: 'Mitarbeiter-Update',
    message: 'Max Müller hat sich für die Frühschicht am Samstag eingetragen.',
    type: 'info' as const,
    category: 'staff' as const,
    priority: 'low' as const,
  },
  {
    title: 'System-Wartung geplant',
    message:
      'Am Sonntag, 03.02.2025, wird zwischen 02:00 und 04:00 Uhr eine Systemwartung durchgeführt.',
    type: 'warning' as const,
    category: 'system' as const,
    priority: 'medium' as const,
  },
]

export async function runNotificationSeeder(): Promise<void> {
  try {
    logger.info('Starting notification seeder...')

    // Check if notifications already exist
    const existingNotifications = await Notification.count()
    if (existingNotifications > 0) {
      logger.info(
        `Found ${existingNotifications} existing notifications, skipping seeder`
      )
      return
    }

    // Get the first admin user
    const adminUser = await Customer.findOne({
      where: { role: 'admin' },
    })

    if (!adminUser) {
      logger.warn(
        'No admin user found, creating notifications without user association'
      )
    }

    // Create notifications
    const notificationsToCreate = sampleNotifications.map((notification) => ({
      ...notification,
      userId: adminUser?.id || null,
      read: false,
      metadata: {},
    }))

    const created = await Notification.bulkCreate(notificationsToCreate)
    logger.info(`Created ${created.length} sample notifications`)

    // Mark some as read for variety
    if (created.length > 2) {
      await created[0].update({ read: true })
      await created[1].update({ read: true })
      logger.info('Marked first 2 notifications as read')
    }
  } catch (error) {
    logger.error('Error in notification seeder:', error)
    throw error
  }
}
