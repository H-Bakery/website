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
import { runUserSeeder } from './user.seeder'
import { runProductSeeder } from './product.seeder'
import { runNotificationSeeder } from './notification.seeder'
import { runTemplateSeeder } from './template.seeder'

export async function runSeeders(): Promise<void> {
  logger.info('Running database seeders...')

  try {
    // Run seeders in order
    await runUserSeeder()
    await runProductSeeder()
    await runNotificationSeeder()
    await runTemplateSeeder()

    logger.info('All seeders completed successfully')
  } catch (error) {
    logger.error('Error running seeders:', error)
    throw error
  }
}
