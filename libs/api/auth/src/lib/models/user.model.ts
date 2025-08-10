/**
 * User model for authentication
 */

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  Admin = 'admin',
  Staff = 'staff',
  User = 'user'
}

export interface User extends BaseEntity {
  username: string;
  email: string;
  password: string; // Hashed password
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date | string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

export interface JwtPayload {
  id: number;
  role: UserRole;
}

export interface RegisterInput extends CreateUserInput {
  confirmPassword?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}