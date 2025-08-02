import { Request, Response, NextFunction } from 'express'
export interface AuthRequest extends Request {
  userId?: number
  userRole?: string
  user?: any
}
export declare const authenticate: (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => void
export declare const requireAdmin: (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => void
export declare const requireStaff: (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => void
