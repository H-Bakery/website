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
// No user seeder (B3): accounts come from the create-user CLI, in
// development optionally from BOOTSTRAP_ADMIN_* (auth/users.service.ts).
import { runProductSeeder } from './product.seeder'
import { runNotificationSeeder } from './notification.seeder'
import { runTemplateSeeder } from './template.seeder'
import { runPartnerSeeder } from './partner.seeder'

export async function runSeeders(): Promise<void> {
  logger.info('Running database seeders...')

  try {
    // Run seeders in order
    await runProductSeeder()
    await runNotificationSeeder()
    await runTemplateSeeder()
    await runPartnerSeeder()

    logger.info('All seeders completed successfully')
  } catch (error) {
    logger.error('Error running seeders:', error)
    throw error
  }
}
