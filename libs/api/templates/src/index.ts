/**
 * Templates Domain - Public API
 * Bakery Management System
 */

// Models
export {
  NotificationTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  RenderTemplateInput,
  RenderedTemplate,
  TemplateValidationResult,
  NotificationPriority,
  NotificationType,
  TemplateCategory,
  LocalizedText,
  CATEGORY_MAP,
  VARIABLE_REGEX,
} from './models/template.model';

// Services
export { TemplateService, TemplateServiceDeps } from './services/template.service';

// Controllers
export { TemplateController } from './controllers/template.controller';

// Routes
export { createTemplateRoutes, TemplateRoutesDeps } from './routes/template.routes';

// Validators
export {
  getTemplatesValidator,
  templateKeyValidator,
  previewTemplateValidator,
  createTemplateValidator,
  updateTemplateValidator,
  validateTemplateValidator,
} from './validators/template.validators';
