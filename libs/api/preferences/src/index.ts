/**
 * Preferences Domain - Public API
 * Bakery Management System
 */

// Models
export {
  NotificationPreference,
  CreateNotificationPreferenceInput,
  UpdateNotificationPreferenceInput,
  NotificationPriority,
  NotificationCategoryPreferences,
  QuietHoursConfig,
  DEFAULT_PREFERENCES,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
  TIME_REGEX,
} from './models/preference.model';

// Services
export { PreferenceService, PreferenceServiceDeps } from './services/preference.service';

// Controllers
export { PreferenceController } from './controllers/preference.controller';

// Routes
export { createPreferenceRoutes, PreferenceRoutesDeps } from './routes/preference.routes';

// Validators
export { updatePreferencesValidator } from './validators/preference.validators';
