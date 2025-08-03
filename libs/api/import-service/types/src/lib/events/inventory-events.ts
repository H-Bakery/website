/**
 * Inventory-related event definitions for the event bus
 */

// Event names as constants to prevent typos
export const INVENTORY_EVENTS = {
  STOCK_UPDATED: 'inventory.stock.updated',
  STOCK_LOW: 'inventory.stock.low',
  STOCK_OUT: 'inventory.stock.out',
  ITEM_CREATED: 'inventory.item.created',
  ITEM_UPDATED: 'inventory.item.updated',
  ITEM_DELETED: 'inventory.item.deleted',
  REORDER_NEEDED: 'inventory.reorder.needed',
  STOCK_ADJUSTED: 'inventory.stock.adjusted',
} as const;

// Type for inventory event names
export type InventoryEventName = typeof INVENTORY_EVENTS[keyof typeof INVENTORY_EVENTS];

// Base inventory item information
export interface BaseInventoryInfo {
  itemId: string | number;
  name: string;
  sku?: string;
  category?: string;
  supplier?: string;
}

// Stock level information
export interface StockInfo {
  quantity: number;
  lowStockThreshold?: number;
  reorderLevel?: number;
  unit?: string;
}

// Event payload interfaces
export interface StockUpdatedEvent extends BaseInventoryInfo, StockInfo {
  previousQuantity: number;
  change: number;
  reason?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface StockLowEvent extends BaseInventoryInfo, StockInfo {
  alertLevel: 'low' | 'critical';
  suggestedReorderQuantity?: number;
  lastRestockDate?: Date;
}

export interface StockOutEvent extends BaseInventoryInfo {
  lastQuantity: number;
  outOfStockSince: Date;
  affectedOrders?: string[];
  suggestedActions?: string[];
}

export interface InventoryItemCreatedEvent extends BaseInventoryInfo, StockInfo {
  description?: string;
  price?: number;
  createdAt: Date;
  createdBy?: string;
}

export interface InventoryItemUpdatedEvent extends BaseInventoryInfo {
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  updatedAt: Date;
  updatedBy?: string;
}

export interface InventoryItemDeletedEvent extends BaseInventoryInfo {
  finalQuantity: number;
  deletedAt: Date;
  deletedBy?: string;
  reason?: string;
}

export interface ReorderNeededEvent extends BaseInventoryInfo, StockInfo {
  urgency: 'low' | 'medium' | 'high';
  suggestedQuantity: number;
  estimatedCost?: number;
  leadTime?: number;
  preferredSupplier?: string;
}

export interface StockAdjustedEvent extends BaseInventoryInfo {
  adjustmentType: 'increase' | 'decrease' | 'set';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  adjustedAt: Date;
  adjustedBy?: string;
  batchId?: string;
}

// Union type for all inventory events
export type InventoryEvent = 
  | StockUpdatedEvent
  | StockLowEvent
  | StockOutEvent
  | InventoryItemCreatedEvent
  | InventoryItemUpdatedEvent
  | InventoryItemDeletedEvent
  | ReorderNeededEvent
  | StockAdjustedEvent;

// Event handler types
export type StockUpdatedHandler = (event: StockUpdatedEvent) => void | Promise<void>;
export type StockLowHandler = (event: StockLowEvent) => void | Promise<void>;
export type StockOutHandler = (event: StockOutEvent) => void | Promise<void>;
export type InventoryItemCreatedHandler = (event: InventoryItemCreatedEvent) => void | Promise<void>;
export type InventoryItemUpdatedHandler = (event: InventoryItemUpdatedEvent) => void | Promise<void>;
export type InventoryItemDeletedHandler = (event: InventoryItemDeletedEvent) => void | Promise<void>;
export type ReorderNeededHandler = (event: ReorderNeededEvent) => void | Promise<void>;
export type StockAdjustedHandler = (event: StockAdjustedEvent) => void | Promise<void>;

// Combined event handler type
export type InventoryEventHandler = 
  | StockUpdatedHandler
  | StockLowHandler
  | StockOutHandler
  | InventoryItemCreatedHandler
  | InventoryItemUpdatedHandler
  | InventoryItemDeletedHandler
  | ReorderNeededHandler
  | StockAdjustedHandler;