/**
 * Preference Service Tests
 * Bakery Management System
 */

import { PreferenceService } from './preference.service';
import { DEFAULT_PREFERENCES } from '../models/preference.model';

describe('PreferenceService', () => {
  let service: PreferenceService;
  let mockNotificationPreferences: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock database model
    mockNotificationPreferences = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create service instance
    service = new PreferenceService({
      NotificationPreferences: mockNotificationPreferences,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPreference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreference);

      const result = await service.getPreferences('user123');

      expect(mockNotificationPreferences.findOne).toHaveBeenCalledWith({
        where: { userId: 'user123' },
      });
      expect(result).toEqual(mockPreference);
    });

    it('should create default preferences if none exist', async () => {
      const mockCreatedPreference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationPreferences.findOne.mockResolvedValue(null);
      mockNotificationPreferences.create.mockResolvedValue(mockCreatedPreference);

      const result = await service.getPreferences('user123');

      expect(mockNotificationPreferences.create).toHaveBeenCalledWith({
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
      });
      expect(result).toEqual(mockCreatedPreference);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created default notification preferences for user user123'
      );
    });

    it('should handle errors', async () => {
      mockNotificationPreferences.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getPreferences('user123')).rejects.toThrow(
        'Failed to fetch notification preferences'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', async () => {
      const mockPreference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        categoryPreferences: { ...DEFAULT_PREFERENCES.categoryPreferences },
        quietHours: { ...DEFAULT_PREFERENCES.quietHours },
        update: jest.fn(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreference);

      const input = {
        emailEnabled: false,
        priorityThreshold: 'high' as const,
        categoryPreferences: { staff: false },
      };

      await service.updatePreferences('user123', input);

      expect(mockPreference.update).toHaveBeenCalledWith({
        emailEnabled: false,
        priorityThreshold: 'high',
        categoryPreferences: {
          ...DEFAULT_PREFERENCES.categoryPreferences,
          staff: false,
        },
      });
    });

    it('should validate quiet hours format', async () => {
      const mockPreference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        quietHours: { ...DEFAULT_PREFERENCES.quietHours },
        update: jest.fn(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreference);

      const input = {
        quietHours: {
          enabled: true,
          start: '20:00',
          end: '08:00',
        },
      };

      await service.updatePreferences('user123', input);

      expect(mockPreference.update).toHaveBeenCalledWith({
        quietHours: {
          enabled: true,
          start: '20:00',
          end: '08:00',
        },
      });
    });
  });

  describe('resetPreferences', () => {
    it('should reset existing preferences to defaults', async () => {
      const mockPreference = {
        id: '123',
        userId: 'user123',
        update: jest.fn(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationPreferences.findOne.mockResolvedValue(mockPreference);

      await service.resetPreferences('user123');

      expect(mockPreference.update).toHaveBeenCalledWith(DEFAULT_PREFERENCES);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reset notification preferences to defaults for user user123'
      );
    });
  });

  describe('isWithinQuietHours', () => {
    beforeEach(() => {
      // Mock current time to 23:00
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01 23:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true when within quiet hours', () => {
      const preference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isWithinQuietHours(preference);
      expect(result).toBe(true);
    });

    it('should return false when quiet hours disabled', () => {
      const preference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isWithinQuietHours(preference);
      expect(result).toBe(false);
    });

    it('should handle quiet hours spanning midnight', () => {
      const preference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Set time to 23:00 - should be within quiet hours
      const result1 = service.isWithinQuietHours(preference);
      expect(result1).toBe(true);

      // Set time to 06:00 - should be within quiet hours
      jest.setSystemTime(new Date('2024-01-01 06:00:00'));
      const result2 = service.isWithinQuietHours(preference);
      expect(result2).toBe(true);

      // Set time to 08:00 - should be outside quiet hours
      jest.setSystemTime(new Date('2024-01-01 08:00:00'));
      const result3 = service.isWithinQuietHours(preference);
      expect(result3).toBe(false);
    });
  });

  describe('isCategoryEnabled', () => {
    it('should return true for enabled category', () => {
      const preference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isCategoryEnabled(preference, 'staff');
      expect(result).toBe(true);
    });

    it('should return false for disabled category', () => {
      const preference = {
        id: '123',
        userId: 'user123',
        ...DEFAULT_PREFERENCES,
        categoryPreferences: {
          ...DEFAULT_PREFERENCES.categoryPreferences,
          staff: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.isCategoryEnabled(preference, 'staff');
      expect(result).toBe(false);
    });
  });
});