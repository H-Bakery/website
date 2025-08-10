/**
 * Authentication validators
 */

import { Request, Response, NextFunction } from 'express';

// Simple validation helpers
const isEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password: string): boolean => {
  // At least 6 characters
  return password.length >= 6;
};

/**
 * Validate registration request
 */
export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  const errors: string[] = [];
  const { username, email, password, firstName, lastName } = req.body;

  // Required fields
  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!isEmail(email)) {
    errors.push('Invalid email format');
  }

  if (!password) {
    errors.push('Password is required');
  } else if (!isValidPassword(password)) {
    errors.push('Password must be at least 6 characters');
  }

  if (!firstName || firstName.trim().length === 0) {
    errors.push('First name is required');
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.push('Last name is required');
  }

  // Check for errors
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      errors
    });
    return;
  }

  next();
};

/**
 * Validate login request
 */
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const errors: string[] = [];
  const { username, password } = req.body;

  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      errors
    });
    return;
  }

  next();
};

/**
 * Validate update profile request
 */
export const validateUpdateProfile = (req: Request, res: Response, next: NextFunction): void => {
  const errors: string[] = [];
  const { email, firstName, lastName } = req.body;

  // Optional fields, but validate if provided
  if (email !== undefined) {
    if (email.trim().length === 0) {
      errors.push('Email cannot be empty');
    } else if (!isEmail(email)) {
      errors.push('Invalid email format');
    }
  }

  if (firstName !== undefined && firstName.trim().length === 0) {
    errors.push('First name cannot be empty');
  }

  if (lastName !== undefined && lastName.trim().length === 0) {
    errors.push('Last name cannot be empty');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      errors
    });
    return;
  }

  next();
};

/**
 * Validate change password request
 */
export const validateChangePassword = (req: Request, res: Response, next: NextFunction): void => {
  const errors: string[] = [];
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    errors.push('Current password is required');
  }

  if (!newPassword) {
    errors.push('New password is required');
  } else if (!isValidPassword(newPassword)) {
    errors.push('New password must be at least 6 characters');
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      errors
    });
    return;
  }

  next();
};