import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import * as jwt from 'jsonwebtoken'
// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

interface DecodedToken {
  id: string
  email: string
  role: string
}

interface AuthenticatedSocket extends Socket {
  userId?: string
  userEmail?: string
  userRole?: string
}

class SocketService {
  private io: SocketIOServer | null = null
  private connectedUsers: Map<string, Set<string>> = new Map() // userId -> Set of socket IDs

  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      },
    })

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication error: No token provided'))
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET!
        ) as DecodedToken
        socket.userId = decoded.id
        socket.userEmail = decoded.email
        socket.userRole = decoded.role
        next()
      } catch (err) {
        logger.error('Socket authentication error:', err)
        next(new Error('Authentication error'))
      }
    })

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.userEmail} connected via WebSocket`)

      // Track connected users
      if (socket.userId) {
        if (!this.connectedUsers.has(socket.userId)) {
          this.connectedUsers.set(socket.userId, new Set())
        }
        this.connectedUsers.get(socket.userId)!.add(socket.id)
      }

      // Join user-specific room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`)
      }

      // Join role-specific room
      if (socket.userRole) {
        socket.join(`role:${socket.userRole}`)
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User ${socket.userEmail} disconnected from WebSocket`)

        // Remove from connected users tracking
        if (socket.userId) {
          const userSockets = this.connectedUsers.get(socket.userId)
          if (userSockets) {
            userSockets.delete(socket.id)
            if (userSockets.size === 0) {
              this.connectedUsers.delete(socket.userId)
            }
          }
        }
      })

      // Handle ping for connection keep-alive
      socket.on('ping', () => {
        socket.emit('pong')
      })

      // Chat functionality
      socket.on('chat:join', (room: string) => {
        socket.join(`chat:${room}`)
        logger.debug(`User ${socket.userEmail} joined chat room: ${room}`)
      })

      socket.on('chat:leave', (room: string) => {
        socket.leave(`chat:${room}`)
        logger.debug(`User ${socket.userEmail} left chat room: ${room}`)
      })

      socket.on('chat:message', (data: { room: string; message: any }) => {
        this.io?.to(`chat:${data.room}`).emit('chat:message', {
          ...data.message,
          userId: socket.userId,
          userEmail: socket.userEmail,
          timestamp: new Date(),
        })
      })

      // Production updates
      socket.on('production:subscribe', () => {
        socket.join('production:updates')
        logger.debug(
          `User ${socket.userEmail} subscribed to production updates`
        )
      })

      socket.on('production:unsubscribe', () => {
        socket.leave('production:updates')
        logger.debug(
          `User ${socket.userEmail} unsubscribed from production updates`
        )
      })

      // Order updates
      socket.on('orders:subscribe', () => {
        socket.join('orders:updates')
        logger.debug(`User ${socket.userEmail} subscribed to order updates`)
      })

      socket.on('orders:unsubscribe', () => {
        socket.leave('orders:updates')
        logger.debug(`User ${socket.userEmail} unsubscribed from order updates`)
      })
    })

    logger.info('WebSocket server initialized')
  }

  // Send notification to specific user
  sendToUser(userId: string, event: string, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(`user:${userId}`).emit(event, data)
  }

  // Send notification to users with specific role
  sendToRole(role: string, event: string, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(`role:${role}`).emit(event, data)
  }

  // Broadcast to all connected users
  broadcast(event: string, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.emit(event, data)
  }

  // Send to specific room
  sendToRoom(room: string, event: string, data: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized')
      return
    }

    this.io.to(room).emit(event, data)
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId)
  }

  // Get number of connected users
  getConnectedUsersCount(): number {
    return this.connectedUsers.size
  }

  // Get socket server instance
  getIO(): SocketIOServer | null {
    return this.io
  }
}

export const socketService = new SocketService()
