import { io, Socket } from 'socket.io-client';
import { Notification } from '../types/notification';

type NotificationCallback = (notification: Notification) => void;
type NotificationUpdateCallback = (update: { id: number; [key: string]: any }) => void;
type NotificationDeleteCallback = (id: number) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: {
    onNewNotification: NotificationCallback[];
    onNotificationUpdate: NotificationUpdateCallback[];
    onNotificationDelete: NotificationDeleteCallback[];
  } = {
    onNewNotification: [],
    onNotificationUpdate: [],
    onNotificationDelete: [],
  };

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io('http://localhost:5000', {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    // Notification events
    this.socket.on('notification:new', (notification: Notification) => {
      this.listeners.onNewNotification.forEach(callback => callback(notification));
    });

    this.socket.on('notification:updated', (update: { id: number; [key: string]: any }) => {
      this.listeners.onNotificationUpdate.forEach(callback => callback(update));
    });

    this.socket.on('notification:deleted', (id: number) => {
      this.listeners.onNotificationDelete.forEach(callback => callback(id));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event listeners
  onNewNotification(callback: NotificationCallback) {
    this.listeners.onNewNotification.push(callback);
    return () => {
      this.listeners.onNewNotification = this.listeners.onNewNotification.filter(
        cb => cb !== callback
      );
    };
  }

  onNotificationUpdate(callback: NotificationUpdateCallback) {
    this.listeners.onNotificationUpdate.push(callback);
    return () => {
      this.listeners.onNotificationUpdate = this.listeners.onNotificationUpdate.filter(
        cb => cb !== callback
      );
    };
  }

  onNotificationDelete(callback: NotificationDeleteCallback) {
    this.listeners.onNotificationDelete.push(callback);
    return () => {
      this.listeners.onNotificationDelete = this.listeners.onNotificationDelete.filter(
        cb => cb !== callback
      );
    };
  }

  // Emit events
  markAsRead(notificationId: number) {
    if (this.socket?.connected) {
      this.socket.emit('notification:read', notificationId);
    }
  }

  deleteNotification(notificationId: number) {
    if (this.socket?.connected) {
      this.socket.emit('notification:delete', notificationId);
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket instance (for advanced usage)
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();