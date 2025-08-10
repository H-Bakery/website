/**
 * Chat service - business logic for chat messaging
 */

import {
  ChatMessage,
  ChatMessageWithUser,
  CreateChatMessageInput,
  ChatMessageFilters,
  ChatStatistics,
  CHAT_CONSTANTS,
  CHAT_ERROR_MESSAGES
} from '../models/chat.model';

// Mock user data for in-memory implementation
interface MockUser {
  id: number;
  username: string;
  email: string;
}

// Mock chat message for internal storage
interface MockChatMessage {
  id: number;
  message: string;
  timestamp: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export class ChatService {
  private mockMessages: MockChatMessage[] = [];
  private mockUsers: MockUser[] = [];
  private nextId = 1;

  constructor() {
    this.initializeMockData();
  }

  /**
   * Validate message input
   */
  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new Error(CHAT_ERROR_MESSAGES.MESSAGE_REQUIRED);
    }

    if (message.length < CHAT_CONSTANTS.MIN_MESSAGE_LENGTH) {
      throw new Error(CHAT_ERROR_MESSAGES.MESSAGE_TOO_SHORT);
    }

    if (message.length > CHAT_CONSTANTS.MAX_MESSAGE_LENGTH) {
      throw new Error(CHAT_ERROR_MESSAGES.MESSAGE_TOO_LONG);
    }
  }

  /**
   * Validate user exists
   */
  private validateUser(userId: number): void {
    const user = this.mockUsers.find(u => u.id === userId);
    if (!user) {
      throw new Error(CHAT_ERROR_MESSAGES.INVALID_USER);
    }
  }

  /**
   * Get user by ID
   */
  private getUserById(userId: number): MockUser | undefined {
    return this.mockUsers.find(u => u.id === userId);
  }

  /**
   * Convert mock message to ChatMessage format
   */
  private formatMessage(mockMessage: MockChatMessage): ChatMessage {
    const user = this.getUserById(mockMessage.userId);
    return {
      id: mockMessage.id,
      message: mockMessage.message,
      timestamp: mockMessage.timestamp,
      userId: mockMessage.userId,
      username: user?.username,
      createdAt: mockMessage.createdAt,
      updatedAt: mockMessage.updatedAt
    };
  }

  /**
   * Convert mock message to ChatMessageWithUser format
   */
  private formatMessageWithUser(mockMessage: MockChatMessage): ChatMessageWithUser {
    const user = this.getUserById(mockMessage.userId);
    if (!user) {
      throw new Error(CHAT_ERROR_MESSAGES.INVALID_USER);
    }

    return {
      id: mockMessage.id,
      message: mockMessage.message,
      timestamp: mockMessage.timestamp,
      userId: mockMessage.userId,
      username: user.username,
      createdAt: mockMessage.createdAt,
      updatedAt: mockMessage.updatedAt,
      user: {
        id: user.id,
        username: user.username
      }
    };
  }

  /**
   * Get all chat messages with optional filtering
   */
  async getChatMessages(filters: ChatMessageFilters = {}): Promise<ChatMessageWithUser[]> {
    let filteredMessages = [...this.mockMessages];

    // Apply filters
    if (filters.userId) {
      filteredMessages = filteredMessages.filter(msg => msg.userId === filters.userId);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredMessages = filteredMessages.filter(msg => new Date(msg.timestamp) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredMessages = filteredMessages.filter(msg => new Date(msg.timestamp) <= endDate);
    }

    // Sort by timestamp (ascending - chronological order)
    filteredMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Apply pagination
    const limit = Math.min(filters.limit || CHAT_CONSTANTS.DEFAULT_LIMIT, CHAT_CONSTANTS.MAX_LIMIT);
    const offset = filters.offset || 0;
    
    const paginatedMessages = filteredMessages.slice(offset, offset + limit);

    return paginatedMessages.map(msg => this.formatMessageWithUser(msg));
  }

  /**
   * Create a new chat message
   */
  async createChatMessage(userId: number, input: CreateChatMessageInput): Promise<ChatMessage> {
    // Validation
    this.validateMessage(input.message);
    this.validateUser(userId);

    const now = new Date().toISOString();
    const newMessage: MockChatMessage = {
      id: this.nextId++,
      message: input.message.trim(),
      timestamp: now,
      userId,
      createdAt: now,
      updatedAt: now
    };

    this.mockMessages.push(newMessage);

    return this.formatMessage(newMessage);
  }

  /**
   * Get chat message by ID
   */
  async getChatMessageById(id: number): Promise<ChatMessageWithUser | null> {
    const message = this.mockMessages.find(msg => msg.id === id);
    if (!message) {
      return null;
    }

    return this.formatMessageWithUser(message);
  }

  /**
   * Delete chat message by ID (admin only functionality)
   */
  async deleteChatMessage(id: number): Promise<boolean> {
    const index = this.mockMessages.findIndex(msg => msg.id === id);
    if (index === -1) {
      return false;
    }

    this.mockMessages.splice(index, 1);
    return true;
  }

  /**
   * Get chat statistics
   */
  async getChatStatistics(): Promise<ChatStatistics> {
    const totalMessages = this.mockMessages.length;
    
    // Messages from the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const messagesThisWeek = this.mockMessages.filter(
      msg => new Date(msg.timestamp) >= weekAgo
    ).length;

    // Most active user
    const userMessageCounts = new Map<number, number>();
    this.mockMessages.forEach(msg => {
      userMessageCounts.set(msg.userId, (userMessageCounts.get(msg.userId) || 0) + 1);
    });

    let mostActiveUserId = 0;
    let maxCount = 0;
    userMessageCounts.forEach((count, userId) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveUserId = userId;
      }
    });

    const mostActiveUser = this.getUserById(mostActiveUserId)?.username || 'Unknown';

    // Average messages per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const messagesLast30Days = this.mockMessages.filter(
      msg => new Date(msg.timestamp) >= thirtyDaysAgo
    ).length;
    const averageMessagesPerDay = Math.round((messagesLast30Days / 30) * 100) / 100;

    return {
      totalMessages,
      messagesThisWeek,
      mostActiveUser,
      averageMessagesPerDay
    };
  }

  /**
   * Clear all messages (admin functionality)
   */
  async clearAllMessages(): Promise<void> {
    this.mockMessages = [];
  }

  /**
   * Initialize mock data for testing
   */
  private initializeMockData(): void {
    // Mock users
    this.mockUsers = [
      { id: 1, username: 'admin', email: 'admin@bakery.com' },
      { id: 2, username: 'baker.john', email: 'john@bakery.com' },
      { id: 3, username: 'baker.maria', email: 'maria@bakery.com' },
      { id: 4, username: 'cashier.alice', email: 'alice@bakery.com' },
      { id: 5, username: 'manager.bob', email: 'bob@bakery.com' }
    ];

    // Mock chat messages (last 3 days)
    const now = new Date();
    const messages = [
      {
        message: "Good morning team! Ready for today's production.",
        userId: 5,
        hoursAgo: 48
      },
      {
        message: "We need to increase croissant production today - had high demand yesterday.",
        userId: 2,
        hoursAgo: 47
      },
      {
        message: "Roger that! I'll prepare extra butter for the croissants.",
        userId: 3,
        hoursAgo: 46
      },
      {
        message: "Customer asking about gluten-free options. Do we have any today?",
        userId: 4,
        hoursAgo: 24
      },
      {
        message: "Yes, we have gluten-free bread and some muffins available.",
        userId: 2,
        hoursAgo: 23
      },
      {
        message: "Great! Customer was very happy with the options.",
        userId: 4,
        hoursAgo: 22
      },
      {
        message: "Team meeting at 2 PM today to discuss new recipes.",
        userId: 1,
        hoursAgo: 8
      },
      {
        message: "I'll be there! Excited to share the new sourdough variations.",
        userId: 2,
        hoursAgo: 7
      },
      {
        message: "Looking forward to the meeting! I have ideas for seasonal pastries.",
        userId: 3,
        hoursAgo: 6
      },
      {
        message: "Don't forget to update the inventory after today's production.",
        userId: 5,
        hoursAgo: 2
      }
    ];

    messages.forEach((msg, index) => {
      const messageTime = new Date(now);
      messageTime.setHours(messageTime.getHours() - msg.hoursAgo);
      const timestamp = messageTime.toISOString();

      this.mockMessages.push({
        id: this.nextId++,
        message: msg.message,
        timestamp,
        userId: msg.userId,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });
  }
}

// Export singleton instance
export const chatService = new ChatService();