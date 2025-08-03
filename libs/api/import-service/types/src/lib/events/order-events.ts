/**
 * Order-related event definitions for the event bus
 */

// Event names as constants to prevent typos
export const ORDER_EVENTS = {
  CREATED: 'order.created',
  UPDATED: 'order.updated',
  CANCELLED: 'order.cancelled',
  COMPLETED: 'order.completed',
  ITEM_ADDED: 'order.item.added',
  ITEM_REMOVED: 'order.item.removed',
  ITEM_UPDATED: 'order.item.updated',
} as const;

// Type for order event names
export type OrderEventName = typeof ORDER_EVENTS[keyof typeof ORDER_EVENTS];

// Base order information
export interface BaseOrderInfo {
  orderId: string | number;
  customerName: string;
  customerEmail?: string;
  totalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Order item information
export interface OrderItemInfo {
  productId: string | number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

// Event payload interfaces
export interface OrderCreatedEvent extends BaseOrderInfo {
  items: OrderItemInfo[];
  status: string;
  pickupDate?: Date;
  notes?: string;
}

export interface OrderUpdatedEvent extends BaseOrderInfo {
  items: OrderItemInfo[];
  status: string;
  previousStatus?: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface OrderCancelledEvent extends BaseOrderInfo {
  reason?: string;
  cancelledAt: Date;
  refundAmount?: number;
}

export interface OrderCompletedEvent extends BaseOrderInfo {
  completedAt: Date;
  deliveredBy?: string;
  customerSatisfaction?: number;
}

export interface OrderItemAddedEvent {
  orderId: string | number;
  item: OrderItemInfo;
  addedAt: Date;
}

export interface OrderItemRemovedEvent {
  orderId: string | number;
  item: OrderItemInfo;
  removedAt: Date;
}

export interface OrderItemUpdatedEvent {
  orderId: string | number;
  item: OrderItemInfo;
  previousQuantity: number;
  updatedAt: Date;
}

// Union type for all order events
export type OrderEvent = 
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderCancelledEvent
  | OrderCompletedEvent
  | OrderItemAddedEvent
  | OrderItemRemovedEvent
  | OrderItemUpdatedEvent;

// Event handler types
export type OrderCreatedHandler = (event: OrderCreatedEvent) => void | Promise<void>;
export type OrderUpdatedHandler = (event: OrderUpdatedEvent) => void | Promise<void>;
export type OrderCancelledHandler = (event: OrderCancelledEvent) => void | Promise<void>;
export type OrderCompletedHandler = (event: OrderCompletedEvent) => void | Promise<void>;
export type OrderItemAddedHandler = (event: OrderItemAddedEvent) => void | Promise<void>;
export type OrderItemRemovedHandler = (event: OrderItemRemovedEvent) => void | Promise<void>;
export type OrderItemUpdatedHandler = (event: OrderItemUpdatedEvent) => void | Promise<void>;

// Combined event handler type
export type OrderEventHandler = 
  | OrderCreatedHandler
  | OrderUpdatedHandler
  | OrderCancelledHandler
  | OrderCompletedHandler
  | OrderItemAddedHandler
  | OrderItemRemovedHandler
  | OrderItemUpdatedHandler;