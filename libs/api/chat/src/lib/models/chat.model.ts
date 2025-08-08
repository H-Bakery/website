/**
 * Chat domain models and types
 */

// Base interface
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// Chat message interface
export interface ChatMessage extends BaseEntity {
  message: string;
  timestamp: string;
  userId: number;
  username?: string; // Populated from user relation
}

// Create chat message input
export interface CreateChatMessageInput {
  message: string;
}

// Update chat message input (if needed for future features)
export interface UpdateChatMessageInput {
  message?: string;
}

// Chat message filters for querying
export interface ChatMessageFilters {
  userId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Chat message with user info
export interface ChatMessageWithUser extends ChatMessage {
  user: {
    id: number;
    username: string;
  };
}

// Chat statistics
export interface ChatStatistics {
  totalMessages: number;
  messagesThisWeek: number;
  mostActiveUser: string;
  averageMessagesPerDay: number;
}

// Constants
export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200
} as const;

// Error messages
export const CHAT_ERROR_MESSAGES = {
  MESSAGE_REQUIRED: "Message is required",
  MESSAGE_TOO_LONG: `Message cannot exceed ${CHAT_CONSTANTS.MAX_MESSAGE_LENGTH} characters`,
  MESSAGE_TOO_SHORT: `Message must be at least ${CHAT_CONSTANTS.MIN_MESSAGE_LENGTH} character long`,
  INVALID_USER: "Invalid user ID",
  UNAUTHORIZED: "Authentication required",
  DATABASE_ERROR: "Database error occurred",
  MESSAGE_NOT_FOUND: "Message not found"
} as const;