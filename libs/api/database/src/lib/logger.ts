// Local logger to avoid cross-library dependency issues
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  db: (message: string, ...args: any[]) => {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`[DB] ${message}`, ...args);
    }
  }
};