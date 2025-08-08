/**
 * Response Utilities - Standard API response formatting
 * Bakery Management System
 */

import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: string[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export class ResponseFormatter {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200
  ): Response<ApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      data,
      message,
    });
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    error: string | Error,
    statusCode = 500,
    errors?: string[]
  ): Response<ApiResponse> {
    const errorMessage = error instanceof Error ? error.message : error;

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      errors,
    });
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: string[]): Response<ApiResponse> {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors,
    });
  }

  /**
   * Send not found response
   */
  static notFound(res: Response, resource = 'Resource'): Response<ApiResponse> {
    return res.status(404).json({
      success: false,
      error: `${resource} not found`,
    });
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(res: Response, message = 'Unauthorized'): Response<ApiResponse> {
    return res.status(401).json({
      success: false,
      error: message,
    });
  }

  /**
   * Send forbidden response
   */
  static forbidden(res: Response, message = 'Forbidden'): Response<ApiResponse> {
    return res.status(403).json({
      success: false,
      error: message,
    });
  }

  /**
   * Send bad request response
   */
  static badRequest(res: Response, message: string): Response<ApiResponse> {
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  /**
   * Send created response
   */
  static created<T>(res: Response, data: T, message?: string): Response<ApiResponse<T>> {
    return res.status(201).json({
      success: true,
      data,
      message: message || 'Resource created successfully',
    });
  }

  /**
   * Send no content response
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationParams,
    message?: string
  ): Response<ApiResponse<T[]>> {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data,
      message,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  }
}

// Export convenience functions
export const successResponse = ResponseFormatter.success;
export const errorResponse = ResponseFormatter.error;
export const validationErrorResponse = ResponseFormatter.validationError;
export const notFoundResponse = ResponseFormatter.notFound;
export const unauthorizedResponse = ResponseFormatter.unauthorized;
export const forbiddenResponse = ResponseFormatter.forbidden;
export const badRequestResponse = ResponseFormatter.badRequest;
export const createdResponse = ResponseFormatter.created;
export const noContentResponse = ResponseFormatter.noContent;
export const paginatedResponse = ResponseFormatter.paginated;

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler<T = any>(
  fn: (req: any, res: Response, next: any) => Promise<T>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Calculate pagination parameters
 */
export function getPaginationParams(
  page?: number | string,
  limit?: number | string
): { offset: number; limit: number; page: number } {
  const pageNum = Math.max(1, parseInt(String(page || 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || 10), 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  return {
    offset,
    limit: limitNum,
    page: pageNum,
  };
}

/**
 * Build pagination meta data
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): ApiResponse['meta'] {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}