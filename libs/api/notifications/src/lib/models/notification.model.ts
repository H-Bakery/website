import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

export interface NotificationAttributes {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'staff' | 'order' | 'system' | 'inventory' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  archived: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
  metadata: Record<string, any>;
  userId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationCreationAttributes extends Omit<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: number;
  public title!: string;
  public message!: string;
  public type!: 'info' | 'success' | 'warning' | 'error';
  public category!: 'staff' | 'order' | 'system' | 'inventory' | 'general';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public read!: boolean;
  public archived!: boolean;
  public archivedAt!: CreationOptional<Date | null>;
  public deletedAt!: CreationOptional<Date | null>;
  public metadata!: Record<string, any>;
  public userId!: CreationOptional<number | null>;

  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: any; // User who the notification is for

  public static override associations: {
    user: Association<Notification, any>;
  };

  // Instance methods
  public async markAsRead(): Promise<void> {
    this.read = true;
    await this.save();
    logger.info(`Notification ${this.id} marked as read`);
  }

  public async markAsUnread(): Promise<void> {
    this.read = false;
    await this.save();
    logger.info(`Notification ${this.id} marked as unread`);
  }

  public async archive(): Promise<void> {
    this.archived = true;
    this.archivedAt = new Date();
    await this.save();
    logger.info(`Notification ${this.id} archived`);
  }

  public async unarchive(): Promise<void> {
    this.archived = false;
    this.archivedAt = null;
    await this.save();
    logger.info(`Notification ${this.id} unarchived`);
  }

  public isHighPriority(): boolean {
    return this.priority === 'high' || this.priority === 'urgent';
  }

  public isUrgent(): boolean {
    return this.priority === 'urgent';
  }

  public static initModel(sequelize: Sequelize): typeof Notification {
    Notification.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
            len: [1, 255],
          },
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        type: {
          type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
          allowNull: false,
          defaultValue: 'info',
        },
        category: {
          type: DataTypes.ENUM('staff', 'order', 'system', 'inventory', 'general'),
          allowNull: false,
          defaultValue: 'general',
        },
        priority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          allowNull: false,
          defaultValue: 'medium',
        },
        read: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        archived: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        archivedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
      },
      {
        sequelize,
        modelName: 'Notification',
        tableName: 'notifications',
        timestamps: true,
        paranoid: true, // Enable soft deletes
        indexes: [
          {
            fields: ['userId'],
          },
          {
            fields: ['read'],
          },
          {
            fields: ['archived'],
          },
          {
            fields: ['category'],
          },
          {
            fields: ['priority'],
          },
          {
            fields: ['createdAt'],
          },
          {
            fields: ['archivedAt'],
          },
          {
            fields: ['deletedAt'],
          },
          {
            // Composite index for active notifications (most common query)
            fields: ['userId', 'archived', 'deletedAt'],
          },
          {
            // Composite index for archive queries
            fields: ['userId', 'archived', 'archivedAt'],
          },
        ],
        hooks: {
          beforeCreate: (notification) => {
            logger.info(`Creating notification: ${notification.title}`);
          },
          afterCreate: (notification) => {
            logger.info(`Notification created with ID: ${notification.id}`);
            // Here you could emit a socket event or trigger a push notification
          },
        },
      }
    );

    return Notification;
  }

  public static associate(models: any): void {
    // Notification belongs to User
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      Notification.belongsTo(UserModel, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }
}