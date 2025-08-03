import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

interface CategoryPreferences {
  staff: boolean;
  order: boolean;
  system: boolean;
  inventory: boolean;
  general: boolean;
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationPreferencesAttributes {
  id: number;
  userId: number;
  emailEnabled: boolean;
  browserEnabled: boolean;
  soundEnabled: boolean;
  categoryPreferences: CategoryPreferences;
  priorityThreshold: 'low' | 'medium' | 'high' | 'urgent';
  quietHours: QuietHours;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationPreferencesCreationAttributes extends Omit<NotificationPreferencesAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

export class NotificationPreferences extends Model<NotificationPreferencesAttributes, NotificationPreferencesCreationAttributes> implements NotificationPreferencesAttributes {
  public id!: number;
  public userId!: number;
  public emailEnabled!: boolean;
  public browserEnabled!: boolean;
  public soundEnabled!: boolean;
  public categoryPreferences!: CategoryPreferences;
  public priorityThreshold!: 'low' | 'medium' | 'high' | 'urgent';
  public quietHours!: QuietHours;

  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: any; // User who owns these preferences

  public static override associations: {
    user: Association<NotificationPreferences, any>;
  };

  // Instance methods
  public isInQuietHours(): boolean {
    if (!this.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle case where quiet hours span midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }

  public shouldNotifyForCategory(category: keyof CategoryPreferences): boolean {
    return this.categoryPreferences[category] || false;
  }

  public shouldNotifyForPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): boolean {
    const priorityValues = { low: 1, medium: 2, high: 3, urgent: 4 };
    const thresholdValue = priorityValues[this.priorityThreshold];
    const messageValue = priorityValues[priority];
    return messageValue >= thresholdValue;
  }

  public canSendNotification(category: keyof CategoryPreferences, priority: 'low' | 'medium' | 'high' | 'urgent'): boolean {
    // Check if in quiet hours (unless urgent)
    if (priority !== 'urgent' && this.isInQuietHours()) {
      return false;
    }

    // Check category preference
    if (!this.shouldNotifyForCategory(category)) {
      return false;
    }

    // Check priority threshold
    if (!this.shouldNotifyForPriority(priority)) {
      return false;
    }

    return true;
  }

  public static initModel(sequelize: Sequelize): typeof NotificationPreferences {
    NotificationPreferences.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        emailEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        browserEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        soundEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        categoryPreferences: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {
            staff: true,
            order: true,
            system: true,
            inventory: true,
            general: true,
          },
          validate: {
            isValidCategories(value: any) {
              const validCategories = ['staff', 'order', 'system', 'inventory', 'general'];
              const keys = Object.keys(value);
              for (const key of keys) {
                if (!validCategories.includes(key)) {
                  throw new Error(`Invalid category: ${key}`);
                }
                if (typeof value[key] !== 'boolean') {
                  throw new Error(`Category preference must be boolean: ${key}`);
                }
              }
            },
          },
        },
        priorityThreshold: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          allowNull: false,
          defaultValue: 'low',
        },
        quietHours: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {
            enabled: false,
            start: '22:00',
            end: '07:00',
          },
          validate: {
            isValidQuietHours(value: any) {
              if (typeof value.enabled !== 'boolean') {
                throw new Error('Quiet hours enabled must be boolean');
              }
              if (value.start && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value.start)) {
                throw new Error('Invalid start time format. Use HH:MM');
              }
              if (value.end && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value.end)) {
                throw new Error('Invalid end time format. Use HH:MM');
              }
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'NotificationPreferences',
        tableName: 'notification_preferences',
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ['userId'],
          },
        ],
        hooks: {
          beforeCreate: async (preferences) => {
            logger.info(`Creating notification preferences for user ${preferences.userId}`);
          },
          afterCreate: async (preferences) => {
            logger.info(`Notification preferences created for user ${preferences.userId}`);
          },
          beforeUpdate: async (preferences) => {
            logger.info(`Updating notification preferences for user ${preferences.userId}`);
          },
        },
      }
    );

    return NotificationPreferences;
  }

  public static associate(models: any): void {
    // NotificationPreferences belongs to User
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      NotificationPreferences.belongsTo(UserModel, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }
}