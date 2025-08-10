/**
 * WebSocket Models - Type definitions for WebSocket events and payloads
 * Bakery Management System
 */

export interface WebSocketUser {
  userId: number;
  userRole: string;
  socketId: string;
  connectedAt: Date;
}

export interface WebSocketConfig {
  port?: number;
  cors?: {
    origin: string | string[];
    methods?: string[];
    credentials?: boolean;
  };
  jwtSecret?: string;
}

export enum WebSocketEvents {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Notification events
  NOTIFICATION_NEW = 'notification:new',
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_DELETE = 'notification:delete',
  NOTIFICATION_UPDATED = 'notification:updated',
  NOTIFICATION_DELETED = 'notification:deleted',
  
  // Production events
  PRODUCTION_SUBSCRIBE_SCHEDULE = 'production:subscribe:schedule',
  PRODUCTION_UNSUBSCRIBE_SCHEDULE = 'production:unsubscribe:schedule',
  PRODUCTION_SUBSCRIBE_BATCH = 'production:subscribe:batch',
  PRODUCTION_UNSUBSCRIBE_BATCH = 'production:unsubscribe:batch',
  PRODUCTION_SUBSCRIBE_STATUS = 'production:subscribe:status',
  PRODUCTION_UNSUBSCRIBE_STATUS = 'production:unsubscribe:status',
  PRODUCTION_BATCH_UPDATE = 'production:batch:update',
  PRODUCTION_STEP_UPDATE = 'production:step:update',
  PRODUCTION_SCHEDULE_UPDATE = 'production:schedule:update',
  PRODUCTION_STATUS_UPDATE = 'production:status:update',
  PRODUCTION_ISSUE_REPORTED = 'production:issue:reported',
  PRODUCTION_QUALITY_CHECK = 'production:quality:check',
  
  // Order events
  ORDER_NEW = 'order:new',
  ORDER_UPDATE = 'order:update',
  ORDER_CANCEL = 'order:cancel',
  
  // Inventory events
  INVENTORY_LOW = 'inventory:low',
  INVENTORY_UPDATE = 'inventory:update',
  
  // Staff events
  STAFF_CHECKIN = 'staff:checkin',
  STAFF_CHECKOUT = 'staff:checkout',
  STAFF_BREAK = 'staff:break'
}

export interface NotificationPayload {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  userId?: number;
  role?: string;
  data?: any;
  createdAt: Date;
}

export interface ProductionBatchUpdate {
  batchId: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;
  currentStep?: number;
  temperature?: number;
  humidity?: number;
  notes?: string;
  updatedAt: Date;
}

export interface ProductionStepUpdate {
  batchId: number;
  stepId: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  actualDuration?: number;
  temperature?: number;
  notes?: string;
}

export interface ProductionScheduleUpdate {
  date: string;
  scheduleId?: number;
  changes?: Array<{
    productId: number;
    oldQuantity: number;
    newQuantity: number;
  }>;
  addedBatches?: number[];
  removedBatches?: number[];
}

export interface ProductionStatusUpdate {
  activeBatches: number;
  pendingBatches: number;
  completedToday: number;
  issuesReported: number;
  efficiency: number;
  timestamp: Date;
}

export interface ProductionIssue {
  batchId: number;
  stepId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reportedBy: number;
  reportedAt: Date;
}

export interface QualityCheckData {
  batchId: number;
  stepId: number;
  passed: boolean;
  metrics: {
    temperature?: number;
    humidity?: number;
    ph?: number;
    weight?: number;
    texture?: string;
    color?: string;
    taste?: string;
  };
  notes?: string;
  checkedBy: number;
  checkedAt: Date;
}

export interface OrderUpdate {
  orderId: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  estimatedTime?: Date;
  completedItems?: number[];
  notes?: string;
}

export interface InventoryUpdate {
  productId: number;
  previousQuantity: number;
  currentQuantity: number;
  minimumQuantity: number;
  isLow: boolean;
  lastUpdated: Date;
}

export interface StaffActivity {
  staffId: number;
  action: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  timestamp: Date;
  location?: string;
  notes?: string;
}