/**
 * Authentication service
 */

import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import {
  User,
  CreateUserInput,
  LoginInput,
  AuthResponse,
  JwtPayload,
  UserRole,
  UpdateUserInput,
  ChangePasswordInput,
} from '../models/user.model'

export class AuthService {
  private users: Map<number, User> = new Map()
  private usersByUsername: Map<string, User> = new Map()
  private usersByEmail: Map<string, User> = new Map()
  private nextId = 1
  private jwtSecret: string
  private saltRounds = 10

  constructor() {
    this.jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key'
    if (!process.env['JWT_SECRET']) {
      console.warn('WARNING: JWT_SECRET not set in environment variables')
    }
  }

  /**
   * Register a new user
   */
  async register(input: CreateUserInput): Promise<AuthResponse> {
    // Validate input
    if (
      !input.username ||
      !input.password ||
      !input.email ||
      !input.firstName ||
      !input.lastName
    ) {
      throw new Error('All fields are required')
    }

    // Check if username already exists
    if (this.usersByUsername.has(input.username)) {
      throw new Error('Username already exists')
    }

    // Check if email already exists
    if (this.usersByEmail.has(input.email)) {
      throw new Error('Email already exists')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, this.saltRounds)

    // Create user
    const user: User = {
      id: this.nextId++,
      username: input.username,
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role || UserRole.User,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Store user
    this.users.set(user.id, user)
    this.usersByUsername.set(user.username, user)
    this.usersByEmail.set(user.email, user)

    // Generate token
    const token = this.generateToken(user)

    // Return response without password
    const { password, ...userWithoutPassword } = user
    return {
      token,
      user: userWithoutPassword,
    }
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { username, password } = input

    // Find user
    const user = this.usersByUsername.get(username)
    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated')
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      throw new Error('Invalid credentials')
    }

    // Update last login
    user.lastLogin = new Date().toISOString()
    user.updatedAt = new Date().toISOString()

    // Generate token
    const token = this.generateToken(user)

    // Return response without password
    const { password: _, ...userWithoutPassword } = user
    return {
      token,
      user: userWithoutPassword,
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<Omit<User, 'password'> | null> {
    const user = this.users.get(id)
    if (!user) {
      return null
    }

    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    return Array.from(this.users.values()).map((user) => {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    })
  }

  /**
   * Update user
   */
  async updateUser(
    id: number,
    input: UpdateUserInput
  ): Promise<Omit<User, 'password'>> {
    const user = this.users.get(id)
    if (!user) {
      throw new Error('User not found')
    }

    // Update email if provided and different
    if (input.email && input.email !== user.email) {
      // Check if new email already exists
      if (this.usersByEmail.has(input.email)) {
        throw new Error('Email already exists')
      }
      // Remove old email mapping
      this.usersByEmail.delete(user.email)
      // Update user email
      user.email = input.email
      // Add new email mapping
      this.usersByEmail.set(input.email, user)
    }

    // Update other fields
    if (input.firstName !== undefined) user.firstName = input.firstName
    if (input.lastName !== undefined) user.lastName = input.lastName
    if (input.role !== undefined) user.role = input.role
    if (input.isActive !== undefined) user.isActive = input.isActive

    user.updatedAt = new Date().toISOString()

    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Change user password
   */
  async changePassword(id: number, input: ChangePasswordInput): Promise<void> {
    const user = this.users.get(id)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const validPassword = await bcrypt.compare(
      input.currentPassword,
      user.password
    )
    if (!validPassword) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    user.password = await bcrypt.hash(input.newPassword, this.saltRounds)
    user.updatedAt = new Date().toISOString()
  }

  /**
   * Delete user (soft delete by deactivating)
   */
  async deleteUser(id: number): Promise<void> {
    const user = this.users.get(id)
    if (!user) {
      throw new Error('User not found')
    }

    user.isActive = false
    user.updatedAt = new Date().toISOString()
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload: JwtPayload = {
      id: user.id,
      role: user.role,
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h',
    })
  }

  /**
   * Seed initial admin user (for testing)
   */
  async seedAdminUser(): Promise<void> {
    try {
      await this.register({
        username: 'admin',
        email: 'admin@bakery.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.Admin,
      })
      console.log('Admin user seeded successfully')
    } catch (error) {
      // User might already exist
      console.log('Admin user already exists or error seeding:', error)
    }
  }
}
