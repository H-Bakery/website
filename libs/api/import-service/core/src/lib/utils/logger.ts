import { Request } from 'express';

interface Logger {
  info: (message: string) => void;
  error: (message: string, error?: any) => void;
  warn: (message: string) => void;
  db: (message: string) => void;
  debug: (message: string) => void;
  request: (req: Request) => void;
}

export const logger: Logger = {
  info: (message: string): void => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`);
  },
  error: (message: string, error?: any): void => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`);
    if (error) console.error(error);
  },
  warn: (message: string): void => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`);
  },
  db: (message: string): void => {
    console.log(`[DB] [${new Date().toISOString()}] ${message}`);
  },
  debug: (message: string): void => {
    console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`);
  },
  request: (req: Request): void => {
    console.log(
      `[REQUEST] [${new Date().toISOString()}] ${req.method} ${req.url}`
    );
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      // Sanitize sensitive data
      if (sanitizedBody.password) sanitizedBody.password = '********';
      console.log('Request Body:', sanitizedBody);
    }
  },
};