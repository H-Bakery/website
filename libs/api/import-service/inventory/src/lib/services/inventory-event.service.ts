import { eventBus } from '@bakery/api/event-bus';
import { ORDER_EVENTS, OrderCreatedEvent, OrderUpdatedEvent } from '@bakery/api/types';
import { logger } from '@bakery/api/core';
import { InventoryService } from './inventory.service';

/**
 * Service that handles inventory-related event subscriptions
 * This service listens to order events and automatically adjusts inventory levels
 */
export class InventoryEventService {
  private inventoryService: InventoryService;
  private isInitialized = false;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  /**
   * Initialize event subscriptions
   * Call this once when the application starts
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('InventoryEventService already initialized');
      return;
    }

    this.subscribeToOrderEvents();
    this.isInitialized = true;
    logger.info('InventoryEventService initialized successfully');
  }

  /**
   * Subscribe to order-related events
   */
  private subscribeToOrderEvents(): void {
    // Subscribe to order created events
    eventBus.safeOn(ORDER_EVENTS.CREATED, this.handleOrderCreated.bind(this));
    
    // Subscribe to order updated events (for status changes that might affect inventory)
    eventBus.safeOn(ORDER_EVENTS.UPDATED, this.handleOrderUpdated.bind(this));

    logger.info('Subscribed to order events for inventory management');
  }

  /**
   * Handle order created event by reducing inventory for ordered items
   */
  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    logger.info(`Processing order created event for order ${event.orderId}`);

    try {
      // Process each item in the order
      for (const item of event.items) {
        try {
          // Find inventory item by product ID
          const inventoryItem = await this.inventoryService.getItemById(Number(item.productId));
          
          if (!inventoryItem) {
            logger.warn(`Inventory item not found for product ID: ${item.productId} in order ${event.orderId}`);
            continue;
          }

          // Reduce inventory quantity
          const adjustedItem = await this.inventoryService.adjustStockLevel(
            inventoryItem.id,
            -item.quantity, // Negative to reduce stock
            `Order created: ${event.orderId} - ${event.customerName}`
          );

          if (adjustedItem) {
            logger.info(
              `Reduced inventory for ${adjustedItem.name} by ${item.quantity} units (Order: ${event.orderId})`
            );
          }

        } catch (error: any) {
          if (error.code === 'INSUFFICIENT_STOCK') {
            logger.error(
              `Insufficient stock for product ${item.productId} in order ${event.orderId}: ${error.message}`
            );
            // TODO: Consider implementing compensation logic or order status updates
          } else {
            logger.error(
              `Error adjusting inventory for product ${item.productId} in order ${event.orderId}:`,
              error
            );
          }
        }
      }

      logger.info(`Completed inventory adjustments for order ${event.orderId}`);

    } catch (error) {
      logger.error(`Error processing order created event for order ${event.orderId}:`, error);
    }
  }

  /**
   * Handle order updated event - currently monitors for cancellations
   * In the future, this could handle more complex scenarios like item modifications
   */
  private async handleOrderUpdated(event: OrderUpdatedEvent): Promise<void> {
    logger.info(`Processing order updated event for order ${event.orderId}`);

    try {
      // If order was cancelled, restore inventory
      if (event.status === 'cancelled' && event.previousStatus !== 'cancelled') {
        await this.restoreInventoryForCancelledOrder(event);
      }

      // TODO: Handle other status changes if needed
      // - If order status changes from 'confirmed' to 'completed', no inventory action needed
      // - If items are modified in an order, calculate the difference and adjust accordingly

    } catch (error) {
      logger.error(`Error processing order updated event for order ${event.orderId}:`, error);
    }
  }

  /**
   * Restore inventory levels when an order is cancelled
   */
  private async restoreInventoryForCancelledOrder(event: OrderUpdatedEvent): Promise<void> {
    logger.info(`Restoring inventory for cancelled order ${event.orderId}`);

    try {
      // Process each item in the cancelled order
      for (const item of event.items) {
        try {
          // Find inventory item by product ID
          const inventoryItem = await this.inventoryService.getItemById(Number(item.productId));
          
          if (!inventoryItem) {
            logger.warn(`Inventory item not found for product ID: ${item.productId} in cancelled order ${event.orderId}`);
            continue;
          }

          // Restore inventory quantity
          const adjustedItem = await this.inventoryService.adjustStockLevel(
            inventoryItem.id,
            item.quantity, // Positive to increase stock back
            `Order cancelled: ${event.orderId} - ${event.customerName}`
          );

          if (adjustedItem) {
            logger.info(
              `Restored inventory for ${adjustedItem.name} by ${item.quantity} units (Cancelled Order: ${event.orderId})`
            );
          }

        } catch (error) {
          logger.error(
            `Error restoring inventory for product ${item.productId} in cancelled order ${event.orderId}:`,
            error
          );
        }
      }

      logger.info(`Completed inventory restoration for cancelled order ${event.orderId}`);

    } catch (error) {
      logger.error(`Error restoring inventory for cancelled order ${event.orderId}:`, error);
    }
  }

  /**
   * Clean up event subscriptions
   * Call this when shutting down the application
   */
  public destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    eventBus.removeAllListeners(ORDER_EVENTS.CREATED);
    eventBus.removeAllListeners(ORDER_EVENTS.UPDATED);
    
    this.isInitialized = false;
    logger.info('InventoryEventService destroyed');
  }

  /**
   * Get service status for monitoring/debugging
   */
  public getStatus(): {
    initialized: boolean;
    subscribedEvents: string[];
  } {
    return {
      initialized: this.isInitialized,
      subscribedEvents: this.isInitialized 
        ? [ORDER_EVENTS.CREATED, ORDER_EVENTS.UPDATED]
        : [],
    };
  }
}

// Export singleton instance
export const inventoryEventService = new InventoryEventService();