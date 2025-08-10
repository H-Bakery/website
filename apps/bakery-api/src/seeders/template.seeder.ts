import { promises as fs } from 'fs'
import * as path from 'path'
// TODO: Import from @bakery/api/notifications when library is created
// import { NotificationTemplate } from '@bakery/api/notifications';
import { NotificationTemplate } from '../models'
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

async function loadTemplatesFromFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    logger.error(`Error loading template file ${filePath}:`, error)
    return []
  }
}

export async function runTemplateSeeder(): Promise<void> {
  try {
    logger.info('Starting notification template seeder...')

    // Check if templates already exist
    const existingCount = await NotificationTemplate.count()
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing templates. Skipping seed.`)
      return
    }

    // Template files to load
    const templateFiles = [
      'inventory.json',
      'order.json',
      'production.json',
      'staff.json',
      'financial.json',
      'system.json',
      'customer.json',
    ]

    let totalTemplates = 0

    // Load and create templates from each file
    for (const file of templateFiles) {
      const filePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'notifications',
        file
      )
      const templates = await loadTemplatesFromFile(filePath)

      for (const templateData of templates) {
        try {
          await NotificationTemplate.create(templateData)
          totalTemplates++
          logger.info(`Created template: ${templateData.key}`)
        } catch (error) {
          logger.error(`Error creating template ${templateData.key}:`, error)
        }
      }
    }

    logger.info(
      `Notification template seeder completed. Created ${totalTemplates} templates.`
    )
  } catch (error) {
    logger.error('Error in notification template seeder:', error)
    throw error
  }
}
