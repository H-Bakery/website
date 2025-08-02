import { logger } from '@bakery/api/core';
import { runUserSeeder } from './user.seeder';
import { runProductSeeder } from './product.seeder';
import { runNotificationSeeder } from './notification.seeder';
import { runTemplateSeeder } from './template.seeder';

export async function runSeeders(): Promise<void> {
  logger.info('Running database seeders...');

  try {
    // Run seeders in order
    await runUserSeeder();
    await runProductSeeder();
    await runNotificationSeeder();
    await runTemplateSeeder();
    
    logger.info('All seeders completed successfully');
  } catch (error) {
    logger.error('Error running seeders:', error);
    throw error;
  }
}