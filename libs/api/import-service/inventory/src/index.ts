// Models
export { Inventory } from './lib/models/inventory.model';
export type { 
  InventoryAttributes, 
  InventoryCreationAttributes 
} from './lib/models/inventory.model';

// Controllers
export { InventoryController } from './lib/controllers/inventory.controller';

// Services
export { InventoryService } from './lib/services/inventory.service';
export { InventoryEventService, inventoryEventService } from './lib/services/inventory-event.service';

// Routes
export { default as inventoryRoutes } from './lib/routes/inventory.routes';

// Validators
export {
  inventoryCreationRules,
  inventoryUpdateRules,
  inventoryDeleteRules,
  stockAdjustmentRules,
  bulkStockAdjustmentRules
} from './lib/validators/inventory.validator';