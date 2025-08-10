/**
 * WebSocket Service - Real-time communication service
 * Bakery Management System
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
// Temporary local logger until utils is fixed
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) => console.log(`[DB] ${message}`, ...args),
  child: (name: string) => ({
    info: (message: string, ...args: any[]) => console.log(`[INFO] [${name}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] [${name}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] [${name}] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.log(`[DEBUG] [${name}] ${message}`, ...args),
    db: (message: string, ...args: any[]) => console.log(`[DB] [${name}] ${message}`, ...args)
  })
};
import {
  WebSocketConfig,
  WebSocketUser,
  WebSocketEvents,
  NotificationPayload,
  ProductionBatchUpdate,
  ProductionStepUpdate,
  ProductionScheduleUpdate,
  ProductionStatusUpdate,
  ProductionIssue,
  QualityCheckData,
  OrderUpdate,
  InventoryUpdate,
  StaffActivity
} from '../models/websocket.model';

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connections: Map<number, string> = new Map(); // userId -> socketId mapping
  private config: WebSocketConfig;
  private contextLogger = logger.child('WebSocketService');

  constructor(config?: WebSocketConfig) {
    this.config = {
      cors: {
        origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      jwtSecret: process.env['JWT_SECRET'],
      ...config
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: this.config.cors
    });

    // Authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth['token'];
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, this.config.jwtSecret!) as any;
        (socket as any).userId = decoded.id;
        (socket as any).userRole = decoded.role;
        next();
      } catch (err) {
        this.contextLogger.error('Socket authentication error:', err);
        next(new Error('Authentication error'));
      }
    });

    // Connection handling
    this.io.on(WebSocketEvents.CONNECTION, (socket) => {
      const userId = (socket as any).userId;
      const userRole = (socket as any).userRole;
      
      this.contextLogger.info(`User ${userId} connected via WebSocket`);
      this.connections.set(userId, socket.id);

      // Join user-specific room
      socket.join(`user-${userId}`);
      
      // Join role-specific room
      if (userRole) {
        socket.join(`role-${userRole}`);
      }

      // Handle disconnection
      socket.on(WebSocketEvents.DISCONNECT, () => {
        this.contextLogger.info(`User ${userId} disconnected from WebSocket`);
        this.connections.delete(userId);
      });

      // Register event handlers
      this.registerNotificationHandlers(socket, userId);
      this.registerProductionHandlers(socket, userId);
    });

    this.contextLogger.info('WebSocket server initialized');
  }

  /**
   * Register notification event handlers
   */
  private registerNotificationHandlers(socket: Socket, userId: number): void {
    // Handle notification read event
    socket.on(WebSocketEvents.NOTIFICATION_READ, async (notificationId: number) => {
      try {
        // Broadcast to all user's connections
        this.io!.to(`user-${userId}`).emit(WebSocketEvents.NOTIFICATION_UPDATED, {
          id: notificationId,
          read: true
        });
      } catch (error) {
        this.contextLogger.error('Error handling notification read:', error);
      }
    });

    // Handle notification delete event
    socket.on(WebSocketEvents.NOTIFICATION_DELETE, async (notificationId: number) => {
      try {
        // Broadcast to all user's connections
        this.io!.to(`user-${userId}`).emit(WebSocketEvents.NOTIFICATION_DELETED, notificationId);
      } catch (error) {
        this.contextLogger.error('Error handling notification delete:', error);
      }
    });
  }

  /**
   * Register production event handlers
   */
  private registerProductionHandlers(socket: Socket, userId: number): void {
    // Production room management
    socket.on(WebSocketEvents.PRODUCTION_SUBSCRIBE_SCHEDULE, (date: string) => {
      const room = `production-schedule-${date}`;
      socket.join(room);
      this.contextLogger.info(`User ${userId} joined ${room}`);
    });

    socket.on(WebSocketEvents.PRODUCTION_UNSUBSCRIBE_SCHEDULE, (date: string) => {
      const room = `production-schedule-${date}`;
      socket.leave(room);
      this.contextLogger.info(`User ${userId} left ${room}`);
    });

    socket.on(WebSocketEvents.PRODUCTION_SUBSCRIBE_BATCH, (batchId: number) => {
      const room = `production-batch-${batchId}`;
      socket.join(room);
      this.contextLogger.info(`User ${userId} joined ${room}`);
    });

    socket.on(WebSocketEvents.PRODUCTION_UNSUBSCRIBE_BATCH, (batchId: number) => {
      const room = `production-batch-${batchId}`;
      socket.leave(room);
      this.contextLogger.info(`User ${userId} left ${room}`);
    });

    socket.on(WebSocketEvents.PRODUCTION_SUBSCRIBE_STATUS, () => {
      socket.join('production-status');
      this.contextLogger.info(`User ${userId} joined production-status room`);
    });

    socket.on(WebSocketEvents.PRODUCTION_UNSUBSCRIBE_STATUS, () => {
      socket.leave('production-status');
      this.contextLogger.info(`User ${userId} left production-status room`);
    });
  }

  // Notification methods

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId: number, notification: NotificationPayload): void {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(WebSocketEvents.NOTIFICATION_NEW, notification);
      this.contextLogger.info(`Sent notification to user ${userId}`);
    }
  }

  /**
   * Send notification to all users with specific role
   */
  sendNotificationToRole(role: string, notification: NotificationPayload): void {
    if (this.io) {
      this.io.to(`role-${role}`).emit(WebSocketEvents.NOTIFICATION_NEW, notification);
      this.contextLogger.info(`Sent notification to role ${role}`);
    }
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcastNotification(notification: NotificationPayload): void {
    if (this.io) {
      this.io.emit(WebSocketEvents.NOTIFICATION_NEW, notification);
      this.contextLogger.info('Broadcast notification to all users');
    }
  }

  /**
   * Update notification for specific user
   */
  updateNotificationForUser(userId: number, notificationId: number, updates: Partial<NotificationPayload>): void {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(WebSocketEvents.NOTIFICATION_UPDATED, {
        id: notificationId,
        ...updates
      });
    }
  }

  /**
   * Delete notification for specific user
   */
  deleteNotificationForUser(userId: number, notificationId: number): void {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(WebSocketEvents.NOTIFICATION_DELETED, notificationId);
    }
  }

  // Production event emitters

  /**
   * Emit batch update event
   */
  emitBatchUpdate(batchId: number, update: Partial<ProductionBatchUpdate>): void {
    if (this.io) {
      this.io.to(`production-batch-${batchId}`).emit(WebSocketEvents.PRODUCTION_BATCH_UPDATE, {
        batchId,
        ...update,
        updatedAt: new Date()
      });
      this.contextLogger.info(`Emitted batch update for batch ${batchId}`);
    }
  }

  /**
   * Emit step update event
   */
  emitStepUpdate(batchId: number, stepId: number, update: Partial<ProductionStepUpdate>): void {
    if (this.io) {
      this.io.to(`production-batch-${batchId}`).emit(WebSocketEvents.PRODUCTION_STEP_UPDATE, {
        batchId,
        stepId,
        ...update
      });
      this.contextLogger.info(`Emitted step update for batch ${batchId}, step ${stepId}`);
    }
  }

  /**
   * Emit schedule update event
   */
  emitScheduleUpdate(date: string, update: Partial<ProductionScheduleUpdate>): void {
    if (this.io) {
      this.io.to(`production-schedule-${date}`).emit(WebSocketEvents.PRODUCTION_SCHEDULE_UPDATE, {
        date,
        ...update
      });
      this.contextLogger.info(`Emitted schedule update for date ${date}`);
    }
  }

  /**
   * Emit production status update
   */
  emitProductionStatus(status: ProductionStatusUpdate): void {
    if (this.io) {
      this.io.to('production-status').emit(WebSocketEvents.PRODUCTION_STATUS_UPDATE, status);
      this.contextLogger.info('Emitted production status update');
    }
  }

  /**
   * Emit issue reported event
   */
  emitIssueReported(batchId: number, issue: ProductionIssue): void {
    if (this.io) {
      this.io.to(`production-batch-${batchId}`).emit(WebSocketEvents.PRODUCTION_ISSUE_REPORTED, {
        batchId,
        issue
      });
      this.contextLogger.info(`Emitted issue report for batch ${batchId}`);
    }
  }

  /**
   * Emit quality check event
   */
  emitQualityCheck(batchId: number, stepId: number, qualityData: QualityCheckData): void {
    if (this.io) {
      this.io.to(`production-batch-${batchId}`).emit(WebSocketEvents.PRODUCTION_QUALITY_CHECK, {
        batchId,
        stepId,
        qualityData
      });
      this.contextLogger.info(`Emitted quality check for batch ${batchId}, step ${stepId}`);
    }
  }

  // Order event emitters

  /**
   * Emit new order event
   */
  emitNewOrder(order: any): void {
    if (this.io) {
      this.io.emit(WebSocketEvents.ORDER_NEW, order);
      this.contextLogger.info(`Emitted new order: ${order.id}`);
    }
  }

  /**
   * Emit order update event
   */
  emitOrderUpdate(orderId: number, update: OrderUpdate): void {
    if (this.io) {
      this.io.emit(WebSocketEvents.ORDER_UPDATE, { ...update, orderId });
      this.contextLogger.info(`Emitted order update for order ${orderId}`);
    }
  }

  // Inventory event emitters

  /**
   * Emit low inventory alert
   */
  emitLowInventory(productId: number, inventory: InventoryUpdate): void {
    if (this.io) {
      this.io.emit(WebSocketEvents.INVENTORY_LOW, { ...inventory, productId });
      this.contextLogger.info(`Emitted low inventory alert for product ${productId}`);
    }
  }

  /**
   * Emit inventory update
   */
  emitInventoryUpdate(productId: number, update: InventoryUpdate): void {
    if (this.io) {
      this.io.emit(WebSocketEvents.INVENTORY_UPDATE, { ...update, productId });
      this.contextLogger.info(`Emitted inventory update for product ${productId}`);
    }
  }

  // Staff event emitters

  /**
   * Emit staff activity event
   */
  emitStaffActivity(activity: StaffActivity): void {
    if (this.io) {
      const event = activity.action === 'checkin' ? WebSocketEvents.STAFF_CHECKIN :
                    activity.action === 'checkout' ? WebSocketEvents.STAFF_CHECKOUT :
                    WebSocketEvents.STAFF_BREAK;
      
      this.io.emit(event, activity);
      this.contextLogger.info(`Emitted staff ${activity.action} for staff ${activity.staffId}`);
    }
  }

  // Utility methods

  /**
   * Get connection status for a user
   */
  isUserConnected(userId: number): boolean {
    return this.connections.has(userId);
  }

  /**
   * Get all connected users
   */
  getConnectedUsers(): number[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get WebSocket server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Broadcast custom event
   */
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
      this.contextLogger.info(`Broadcast event: ${event}`);
    }
  }

  /**
   * Emit to specific room
   */
  emitToRoom(room: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
      this.contextLogger.info(`Emitted ${event} to room ${room}`);
    }
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.connections.size;
  }

  /**
   * Get rooms for a user
   */
  getUserRooms(userId: number): string[] {
    const socketId = this.connections.get(userId);
    if (!socketId || !this.io) return [];
    
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return [];
    
    return Array.from(socket.rooms);
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();