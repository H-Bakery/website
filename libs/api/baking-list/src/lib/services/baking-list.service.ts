import { Op, Sequelize } from 'sequelize';
import {
  BakingList,
  BakingItem,
  BakingOrder,
  BakingListFilters,
  HefezopfOrders,
  ProductionPlan,
  CreateProductionPlanInput,
  BAKING_LIST_CONSTANTS,
  BAKING_LIST_ERROR_MESSAGES,
  isValidDate
} from '../models/baking-list.model';
// Temporary local logger until utils is fixed
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) => console.log(`[DB] ${message}`, ...args)
};

export class BakingListService {
  private Order: any;
  private OrderItem: any;
  private Product: any;
  private ProductionPlan: any; // If you have a production plan model

  constructor(models: {
    Order: any;
    OrderItem: any;
    Product: any;
    ProductionPlan?: any;
  }) {
    this.Order = models.Order;
    this.OrderItem = models.OrderItem;
    this.Product = models.Product;
    this.ProductionPlan = models.ProductionPlan;
  }

  /**
   * Generate baking list for a specific date
   */
  async getBakingList(filters: BakingListFilters): Promise<BakingList> {
    logger.info('Processing baking list request...');
    
    // Get the requested date or default to today
    const requestDate = filters.date || new Date().toISOString().split('T')[0];
    
    if (!isValidDate(requestDate)) {
      throw new Error(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE);
    }

    logger.info(`Generating baking list for date: ${requestDate}`);

    // Start and end of the requested date
    const dayStart = new Date(requestDate);
    const dayEnd = new Date(requestDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get all active orders for the date
    const orders = await this.Order.findAll({
      where: {
        pickupDate: {
          [Op.between]: [dayStart, dayEnd],
        },
        status: {
          [Op.in]: BAKING_LIST_CONSTANTS.ACTIVE_ORDER_STATUSES,
        },
      },
      include: [{ 
        model: this.OrderItem,
        as: 'OrderItems' // Adjust based on your model associations
      }],
    });

    logger.info(`Found ${orders.length} orders for date ${requestDate}`);

    // Get all active products
    const products = await this.Product.findAll({
      where: { isActive: true },
    });

    if (products.length === 0) {
      throw new Error(BAKING_LIST_ERROR_MESSAGES.NO_PRODUCTS_FOUND);
    }

    // Calculate quantities needed for shop inventory
    const shopItems: BakingItem[] = products.map((product: any) => ({
      productId: product.id,
      name: product.name,
      dailyTarget: product.dailyTarget || 0,
      currentStock: product.stock || 0,
      shopQuantity: Math.max(0, (product.dailyTarget || 0) - (product.stock || 0)),
      orderQuantity: 0,
      totalQuantity: Math.max(0, (product.dailyTarget || 0) - (product.stock || 0))
    }));

    // Calculate quantities needed for orders
    const orderItemsMap: Record<number, BakingItem> = {};
    
    orders.forEach((order: any) => {
      const orderItems = order.OrderItems || order.orderItems || [];
      orderItems.forEach((item: any) => {
        if (!orderItemsMap[item.productId]) {
          orderItemsMap[item.productId] = {
            productId: item.productId,
            name: item.productName,
            shopQuantity: 0,
            orderQuantity: 0,
            totalQuantity: 0
          };
        }
        orderItemsMap[item.productId].orderQuantity += item.quantity;
        orderItemsMap[item.productId].totalQuantity += item.quantity;
      });
    });

    // Combine shop and order requirements
    const allItemsMap: Record<number, BakingItem> = {};

    // Add shop items first
    shopItems.forEach((item) => {
      allItemsMap[item.productId] = { ...item };
    });

    // Add order items
    Object.values(orderItemsMap).forEach((item) => {
      if (!allItemsMap[item.productId]) {
        // Product only in orders, not in shop inventory
        allItemsMap[item.productId] = item;
      } else {
        // Product in both shop and orders
        allItemsMap[item.productId].orderQuantity = item.orderQuantity;
        allItemsMap[item.productId].totalQuantity += item.orderQuantity;
      }
    });

    // Format order data for the response
    const formattedOrders: BakingOrder[] = orders.map((order: any) => ({
      orderId: order.id,
      customerName: order.customerName,
      pickupDate: order.pickupDate,
      status: order.status,
      notes: order.notes,
      items: (order.OrderItems || order.orderItems || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      })),
    }));

    logger.info('Baking list generated successfully');

    return {
      date: requestDate,
      allItems: Object.values(allItemsMap),
      shopItems: shopItems,
      orderItems: formattedOrders,
    };
  }

  /**
   * Get Hefezopf-specific orders for a date
   */
  async getHefezopfOrders(date?: string): Promise<HefezopfOrders> {
    const requestDate = date || new Date().toISOString().split('T')[0];
    
    if (!isValidDate(requestDate)) {
      throw new Error(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE);
    }

    logger.info(`Fetching Hefezopf orders for date: ${requestDate}`);

    const dayStart = new Date(requestDate);
    const dayEnd = new Date(requestDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get orders with hefezopf products
    const orders = await this.Order.findAll({
      where: {
        pickupDate: {
          [Op.between]: [dayStart, dayEnd],
        },
        status: {
          [Op.in]: BAKING_LIST_CONSTANTS.ACTIVE_ORDER_STATUSES,
        },
      },
      include: [{
        model: this.OrderItem,
        as: 'OrderItems',
        where: {
          productName: {
            [Op.in]: BAKING_LIST_CONSTANTS.HEFEZOPF_PRODUCTS
          }
        },
        required: true
      }],
    });

    // Aggregate quantities by product name
    const hefezopfOrders: HefezopfOrders = {};
    
    BAKING_LIST_CONSTANTS.HEFEZOPF_PRODUCTS.forEach(product => {
      hefezopfOrders[product] = 0;
    });

    orders.forEach((order: any) => {
      const orderItems = order.OrderItems || order.orderItems || [];
      orderItems.forEach((item: any) => {
        if (hefezopfOrders.hasOwnProperty(item.productName)) {
          hefezopfOrders[item.productName] += item.quantity;
        }
      });
    });

    return hefezopfOrders;
  }

  /**
   * Save production plan
   */
  async saveProductionPlan(
    data: CreateProductionPlanInput,
    userId?: number
  ): Promise<{ success: boolean; message: string; id: string }> {
    const { date, plan, notes } = data;

    if (!isValidDate(date)) {
      throw new Error(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE);
    }

    logger.info(`Saving production plan for date: ${date}`);

    // Validate plan items
    for (const item of plan) {
      if (!item.productId || !item.productName || !item.plannedQuantity) {
        throw new Error('Invalid plan item: missing required fields');
      }
      if (item.plannedQuantity <= 0) {
        throw new Error(BAKING_LIST_ERROR_MESSAGES.INVALID_QUANTITY);
      }
    }

    // In a real implementation, save to database
    // For now, return mock response
    const planId = `plan-${Date.now()}`;

    // If you have a ProductionPlan model:
    /*
    if (this.ProductionPlan) {
      const existingPlan = await this.ProductionPlan.findOne({
        where: { date }
      });

      if (existingPlan) {
        throw new Error(BAKING_LIST_ERROR_MESSAGES.PLAN_ALREADY_EXISTS);
      }

      const newPlan = await this.ProductionPlan.create({
        date,
        items: JSON.stringify(plan),
        notes,
        createdBy: userId,
        status: 'draft'
      });

      planId = newPlan.id;
    }
    */

    logger.info(`Production plan saved with ID: ${planId}`);

    return {
      success: true,
      message: 'Production plan saved successfully',
      id: planId
    };
  }

  /**
   * Get production plan by date
   */
  async getProductionPlan(date: string): Promise<ProductionPlan | null> {
    if (!isValidDate(date)) {
      throw new Error(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE);
    }

    // In a real implementation, fetch from database
    // For now, return null
    /*
    if (this.ProductionPlan) {
      const plan = await this.ProductionPlan.findOne({
        where: { date }
      });

      if (!plan) {
        return null;
      }

      return {
        date: plan.date,
        items: JSON.parse(plan.items),
        notes: plan.notes,
        createdBy: plan.createdBy
      };
    }
    */

    return null;
  }
}