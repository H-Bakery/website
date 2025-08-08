/**
 * Baking List domain models and types
 */

// Base interfaces
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// Product requirement for baking
export interface BakingItem {
  productId: number;
  name: string;
  shopQuantity: number;      // Quantity needed for shop display
  orderQuantity: number;     // Quantity needed for customer orders
  totalQuantity: number;     // Total quantity to bake
  dailyTarget?: number;      // Daily target for shop
  currentStock?: number;     // Current stock level
}

// Order item in baking list
export interface BakingOrderItem {
  productId: number;
  productName: string;
  quantity: number;
}

// Order summary for baking list
export interface BakingOrder {
  orderId: number;
  customerName: string;
  pickupDate: Date | string;
  status: string;
  notes?: string;
  items: BakingOrderItem[];
}

// Complete baking list response
export interface BakingList {
  date: string;
  allItems: BakingItem[];       // Combined shop and order requirements
  shopItems: BakingItem[];      // Items for shop display only
  orderItems: BakingOrder[];    // Customer orders breakdown
}

// Production plan for saving
export interface ProductionPlan {
  date: string;
  items: ProductionPlanItem[];
  notes?: string;
  createdBy?: number;
}

// Individual item in production plan
export interface ProductionPlanItem {
  productId: number;
  productName: string;
  plannedQuantity: number;
  actualQuantity?: number;
  notes?: string;
}

// Hefezopf (yeast bread) specific order summary
export interface HefezopfOrders {
  [productName: string]: number;
}

// Request filters for baking list
export interface BakingListFilters {
  date?: string;  // YYYY-MM-DD format
}

// Production plan request
export interface CreateProductionPlanInput {
  date: string;
  plan: ProductionPlanItem[];
  notes?: string;
}

// Constants
export const BAKING_LIST_CONSTANTS = {
  DEFAULT_DATE_FORMAT: 'YYYY-MM-DD',
  HEFEZOPF_PRODUCTS: [
    'Hefezopf Plain',
    'Hefekranz Nuss',
    'Hefekranz Schoko',
    'Hefekranz Pudding',
    'Hefekranz Marzipan',
    'Mini Hefezopf',
    'Hefeschnecken Nuss',
    'Hefeschnecken Schoko'
  ],
  ACTIVE_ORDER_STATUSES: ['Pending', 'Confirmed'],
  VALID_PLAN_STATUSES: ['draft', 'confirmed', 'in_progress', 'completed']
} as const;

// Error messages
export const BAKING_LIST_ERROR_MESSAGES = {
  INVALID_DATE: 'Invalid date format. Use YYYY-MM-DD',
  DATE_REQUIRED: 'Date is required',
  NO_ORDERS_FOUND: 'No orders found for the specified date',
  NO_PRODUCTS_FOUND: 'No active products found',
  PLAN_NOT_FOUND: 'Production plan not found',
  PLAN_ALREADY_EXISTS: 'Production plan already exists for this date',
  INVALID_QUANTITY: 'Quantity must be a positive number',
  PRODUCT_NOT_FOUND: 'Product not found',
  DATABASE_ERROR: 'Database error occurred',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions'
} as const;

// Helper type for date validation
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}