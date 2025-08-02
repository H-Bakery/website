import { Notification, NotificationFilters, NotificationStats } from '../types/notification';

const API_BASE_URL = 'http://localhost:5000';

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Mock data for fallback when backend is unavailable
const mockNotifications: Notification[] = [
  {
    id: 1,
    title: 'Krankmeldung',
    message: 'Lisa Wagner hat sich für den morgigen Tag krank gemeldet',
    type: 'warning',
    category: 'staff',
    priority: 'high',
    read: false,
    archived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Neue Bestellung',
    message: 'Neue Bestellung #4528 wurde aufgegeben',
    type: 'info',
    category: 'order',
    priority: 'medium',
    read: false,
    archived: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    title: 'System Update',
    message: 'Systemupdate erfolgreich abgeschlossen',
    type: 'success',
    category: 'system',
    priority: 'low',
    read: true,
    archived: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    title: 'Lagerbestand niedrig',
    message: 'Mehl Type 550 unterschreitet Mindestbestand',
    type: 'warning',
    category: 'inventory',
    priority: 'urgent',
    read: false,
    archived: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

class NotificationService {
  private notifications: Notification[] = [...mockNotifications];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private nextId = mockNotifications.length + 1;
  private useMockData = false;
  private apiAvailable = true;

  constructor() {
    // Check if API is available on initialization
    this.checkAPIAvailability();
  }

  private async checkAPIAvailability() {
    try {
      // Try to reach the API
      await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'HEAD',
        headers: getAuthHeaders(),
      });
      this.apiAvailable = true;
      this.useMockData = false;
    } catch (error) {
      console.warn('Notification API not available, using mock data');
      this.apiAvailable = false;
      this.useMockData = true;
    }
  }

  // Subscribe to notification changes
  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  // Get all notifications with optional filters
  async getNotifications(filters?: NotificationFilters): Promise<Notification[]> {
    if (this.useMockData) {
      return this.getMockNotifications(filters);
    }

    try {
      const params = new URLSearchParams();
      if (filters?.unreadOnly) params.append('unreadOnly', 'true');
      if (filters?.categories?.length === 1) params.append('category', filters.categories[0]);
      if (filters?.priorities?.length === 1) params.append('priority', filters.priorities[0]);

      const response = await fetch(`${API_BASE_URL}/api/notifications?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      this.notifications = data.notifications || [];
      this.notifyListeners();
      return this.notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      this.useMockData = true;
      return this.getMockNotifications(filters);
    }
  }

  private getMockNotifications(filters?: NotificationFilters): Notification[] {
    let filtered = [...this.notifications];

    if (filters) {
      if (filters.unreadOnly) {
        filtered = filtered.filter(n => !n.read);
      }
      if (filters.categories && filters.categories.length > 0) {
        filtered = filtered.filter(n => filters.categories!.includes(n.category));
      }
      if (filters.priorities && filters.priorities.length > 0) {
        filtered = filtered.filter(n => filters.priorities!.includes(n.priority));
      }
      if (filters.dateRange) {
        filtered = filtered.filter(n => {
          const date = new Date(n.createdAt);
          return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
        });
      }
    }

    // Sort by createdAt descending (newest first)
    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Get notification statistics
  async getStats(): Promise<NotificationStats> {
    if (this.useMockData) {
      return this.getMockStats();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notification stats');
      }

      const data = await response.json();
      return data.stats || this.getMockStats();
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      return this.getMockStats();
    }
  }

  private getMockStats(): NotificationStats {
    const stats: NotificationStats = {
      total: this.notifications.length,
      unread: this.notifications.filter(n => !n.read).length,
      byCategory: {},
      byPriority: {},
    };

    // Count by category and priority
    this.notifications.forEach(n => {
      stats.byCategory[n.category] = (stats.byCategory[n.category] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    });

    return stats;
  }

  // Mark notification as read
  async markAsRead(id: number): Promise<Notification | null> {
    if (this.useMockData) {
      return this.markAsReadMock(id);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      const updatedNotification = await response.json();
      
      // Update local state
      const index = this.notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        this.notifications[index] = updatedNotification;
        this.notifyListeners();
      }

      return updatedNotification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return this.markAsReadMock(id);
    }
  }

  private markAsReadMock(id: number): Notification | null {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      notification.updatedAt = new Date().toISOString();
      this.notifyListeners();
      return notification;
    }
    return null;
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    if (this.useMockData) {
      return this.markAllAsReadMock();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      this.notifications.forEach(n => {
        if (!n.read) {
          n.read = true;
          n.updatedAt = new Date().toISOString();
        }
      });
      this.notifyListeners();
    } catch (error) {
      console.error('Error marking all as read:', error);
      this.markAllAsReadMock();
    }
  }

  private markAllAsReadMock(): void {
    this.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        n.updatedAt = new Date().toISOString();
      }
    });
    this.notifyListeners();
  }

  // Delete a notification
  async deleteNotification(id: number): Promise<boolean> {
    if (this.useMockData) {
      return this.deleteNotificationMock(id);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      const index = this.notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        this.notifications.splice(index, 1);
        this.notifyListeners();
      }

      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return this.deleteNotificationMock(id);
    }
  }

  private deleteNotificationMock(id: number): boolean {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Create a new notification (admin only)
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'archived'>): Promise<Notification> {
    if (this.useMockData) {
      return this.createNotificationMock(notification);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        throw new Error('Failed to create notification');
      }

      const newNotification = await response.json();
      this.notifications.unshift(newNotification);
      this.notifyListeners();
      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return this.createNotificationMock(notification);
    }
  }

  private createNotificationMock(notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'archived'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: this.nextId++,
      read: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(newNotification);
    this.notifyListeners();
    return newNotification;
  }

  // Simulate real-time notifications (for demo)
  startSimulation() {
    const messages = [
      { title: 'Neue Bestellung', message: 'Bestellung #', category: 'order' as const, priority: 'medium' as const },
      { title: 'Mitarbeiter Update', message: 'Schichtänderung für ', category: 'staff' as const, priority: 'high' as const },
      { title: 'Lagerwarnung', message: 'Niedrig: ', category: 'inventory' as const, priority: 'urgent' as const },
      { title: 'System Info', message: 'Backup abgeschlossen', category: 'system' as const, priority: 'low' as const },
    ];

    setInterval(() => {
      const random = Math.random();
      if (random < 0.3) { // 30% chance of new notification
        const template = messages[Math.floor(Math.random() * messages.length)];
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        
        this.createNotification({
          title: template.title,
          message: template.message + (template.category === 'order' ? randomNum : 
                   template.category === 'staff' ? 'heute' :
                   template.category === 'inventory' ? 'Zucker' : ''),
          type: template.priority === 'urgent' ? 'error' : 
                template.priority === 'high' ? 'warning' : 
                template.priority === 'low' ? 'success' : 'info',
          category: template.category,
          priority: template.priority,
        });
      }
    }, 30000); // Check every 30 seconds
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export API-like interface
export const notificationAPI = {
  getNotifications: (filters?: NotificationFilters) => notificationService.getNotifications(filters),
  getStats: () => notificationService.getStats(),
  markAsRead: (id: number) => notificationService.markAsRead(id),
  markAllAsRead: () => notificationService.markAllAsRead(),
  deleteNotification: (id: number) => notificationService.deleteNotification(id),
  createNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'archived'>) => 
    notificationService.createNotification(notification),
  subscribe: (listener: (notifications: Notification[]) => void) => 
    notificationService.subscribe(listener),
};

// Start simulation in development
if (process.env.NODE_ENV === 'development') {
  // Only start simulation if using mock data
  setTimeout(() => {
    if (notificationService['useMockData']) {
      notificationService.startSimulation();
    }
  }, 2000);
}