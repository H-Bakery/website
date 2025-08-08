import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export class FileStorageService {
  private readonly storageDir = path.join(process.cwd(), 'generated-reports');
  private readonly baseUrl = process.env.API_BASE_URL || 'http://localhost:3333';
  private downloadTokens: Map<string, { filePath: string; expiresAt: Date }> = new Map();

  constructor() {
    this.ensureStorageDirectory();
    // Clean up expired tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  /**
   * Generate a secure download URL for a file
   */
  public async generateDownloadUrl(filePath: string): Promise<string> {
    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token with expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    this.downloadTokens.set(token, { filePath, expiresAt });

    // Return the download URL
    return `${this.baseUrl}/api/reports/download/${token}`;
  }

  /**
   * Validate and retrieve file path for a download token
   */
  public async validateDownloadToken(token: string): Promise<string | null> {
    const tokenData = this.downloadTokens.get(token);
    
    if (!tokenData) {
      return null;
    }

    // Check if token has expired
    if (new Date() > tokenData.expiresAt) {
      this.downloadTokens.delete(token);
      return null;
    }

    // Verify file still exists
    try {
      await fs.access(tokenData.filePath);
      return tokenData.filePath;
    } catch {
      // File no longer exists
      this.downloadTokens.delete(token);
      return null;
    }
  }

  /**
   * Store a file securely
   */
  public async storeFile(sourceFilePath: string, fileName: string): Promise<string> {
    const destinationPath = path.join(this.storageDir, fileName);
    
    // Copy file to storage directory
    await fs.copyFile(sourceFilePath, destinationPath);
    
    // Set proper permissions (read-only for others)
    await fs.chmod(destinationPath, 0o644);
    
    return destinationPath;
  }

  /**
   * Delete a stored file
   */
  public async deleteFile(filePath: string): Promise<void> {
    // Ensure the file is within our storage directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(this.storageDir)) {
      throw new Error('Invalid file path');
    }

    try {
      await fs.unlink(filePath);
      console.log(`[FileStorageService] Deleted file: ${filePath}`);
    } catch (error) {
      console.error(`[FileStorageService] Error deleting file ${filePath}:`, error);
    }
  }

  /**
   * Clean up old report files (older than 30 days)
   */
  public async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && stats.mtime < thirtyDaysAgo) {
          await this.deleteFile(filePath);
        }
      }

      console.log('[FileStorageService] Cleanup completed');
    } catch (error) {
      console.error('[FileStorageService] Error during cleanup:', error);
    }
  }

  /**
   * Get file metadata
   */
  public async getFileMetadata(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    mimeType: string;
  }> {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
    };

    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
    };
  }

  /**
   * Clean up expired download tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    this.downloadTokens.forEach((data, token) => {
      if (now > data.expiresAt) {
        expiredTokens.push(token);
      }
    });

    expiredTokens.forEach(token => this.downloadTokens.delete(token));
    
    if (expiredTokens.length > 0) {
      console.log(`[FileStorageService] Cleaned up ${expiredTokens.length} expired tokens`);
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    try {
      const files = await fs.readdir(this.storageDir);
      let totalSize = 0;
      let oldestFile: Date | null = null;
      let newestFile: Date | null = null;

      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          totalSize += stats.size;

          if (!oldestFile || stats.mtime < oldestFile) {
            oldestFile = stats.mtime;
          }

          if (!newestFile || stats.mtime > newestFile) {
            newestFile = stats.mtime;
          }
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile,
        newestFile,
      };
    } catch (error) {
      console.error('[FileStorageService] Error getting storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      };
    }
  }
}