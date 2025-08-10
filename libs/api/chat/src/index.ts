/**
 * Chat domain library exports
 */

// Models and types
export * from './lib/models/chat.model';

// Services
export { chatService } from './lib/services/chat.service';

// Controllers
export { chatController } from './lib/controllers/chat.controller';

// Routes
export { createChatRoutes, chatRoutes } from './lib/routes/chat.routes';