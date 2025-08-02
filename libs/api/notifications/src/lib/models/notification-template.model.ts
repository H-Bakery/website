import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

interface LocalizedText {
  de: string;
  en: string;
}

export interface NotificationTemplateAttributes {
  id: number;
  key: string;
  name: string;
  category: 'production' | 'inventory' | 'order' | 'staff' | 'financial' | 'system' | 'customer';
  defaultTitle: LocalizedText;
  defaultMessage: LocalizedText;
  variables: string[];
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  defaultType: 'info' | 'success' | 'warning' | 'error';
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationTemplateCreationAttributes extends Omit<NotificationTemplateAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: number;
}

export class NotificationTemplate extends Model<NotificationTemplateAttributes, NotificationTemplateCreationAttributes> implements NotificationTemplateAttributes {
  public id!: number;
  public key!: string;
  public name!: string;
  public category!: 'production' | 'inventory' | 'order' | 'staff' | 'financial' | 'system' | 'customer';
  public defaultTitle!: LocalizedText;
  public defaultMessage!: LocalizedText;
  public variables!: string[];
  public defaultPriority!: 'low' | 'medium' | 'high' | 'urgent';
  public defaultType!: 'info' | 'success' | 'warning' | 'error';
  public isActive!: boolean;
  public metadata!: Record<string, any>;

  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public getTitle(language: 'de' | 'en' = 'de'): string {
    return this.defaultTitle[language] || this.defaultTitle.de;
  }

  public getMessage(language: 'de' | 'en' = 'de'): string {
    return this.defaultMessage[language] || this.defaultMessage.de;
  }

  public formatTitle(variables: Record<string, any>, language: 'de' | 'en' = 'de'): string {
    let title = this.getTitle(language);
    
    // Replace variables in the format {{variable}}
    this.variables.forEach(variable => {
      const value = variables[variable] || '';
      title = title.replace(new RegExp(`{{${variable}}}`, 'g'), value.toString());
    });
    
    return title;
  }

  public formatMessage(variables: Record<string, any>, language: 'de' | 'en' = 'de'): string {
    let message = this.getMessage(language);
    
    // Replace variables in the format {{variable}}
    this.variables.forEach(variable => {
      const value = variables[variable] || '';
      message = message.replace(new RegExp(`{{${variable}}}`, 'g'), value.toString());
    });
    
    return message;
  }

  public validateVariables(variables: Record<string, any>): string[] {
    const missing: string[] = [];
    
    this.variables.forEach(variable => {
      if (!(variable in variables)) {
        missing.push(variable);
      }
    });
    
    return missing;
  }

  public createNotification(userId: number, variables: Record<string, any>, language: 'de' | 'en' = 'de'): any {
    // This would be used with the Notification model
    return {
      userId,
      title: this.formatTitle(variables, language),
      message: this.formatMessage(variables, language),
      type: this.defaultType,
      category: this.mapCategoryToNotificationCategory(),
      priority: this.defaultPriority,
      metadata: {
        templateId: this.id,
        templateKey: this.key,
        language,
        variables
      }
    };
  }

  private mapCategoryToNotificationCategory(): 'staff' | 'order' | 'system' | 'inventory' | 'general' {
    const mapping: Record<string, any> = {
      production: 'system',
      inventory: 'inventory',
      order: 'order',
      staff: 'staff',
      financial: 'system',
      system: 'system',
      customer: 'general'
    };
    
    return mapping[this.category] || 'general';
  }

  public static initModel(sequelize: Sequelize): typeof NotificationTemplate {
    NotificationTemplate.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        key: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: true,
            is: /^[a-z]+\.[a-z_]+$/, // Format: category.event_name
          },
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        category: {
          type: DataTypes.ENUM(
            'production',
            'inventory',
            'order',
            'staff',
            'financial',
            'system',
            'customer'
          ),
          allowNull: false,
        },
        defaultTitle: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {
            de: '',
            en: '',
          },
          validate: {
            hasRequiredLanguages(value: any) {
              if (!value.de || !value.en) {
                throw new Error('Template must have both German and English titles');
              }
            },
          },
        },
        defaultMessage: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {
            de: '',
            en: '',
          },
          validate: {
            hasRequiredLanguages(value: any) {
              if (!value.de || !value.en) {
                throw new Error('Template must have both German and English messages');
              }
            },
          },
        },
        variables: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArrayOfStrings(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('Variables must be an array');
              }
              if (!value.every(v => typeof v === 'string')) {
                throw new Error('All variables must be strings');
              }
            },
          },
        },
        defaultPriority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          allowNull: false,
          defaultValue: 'medium',
        },
        defaultType: {
          type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
          allowNull: false,
          defaultValue: 'info',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
      },
      {
        sequelize,
        modelName: 'NotificationTemplate',
        tableName: 'notification_templates',
        timestamps: true,
        indexes: [
          {
            unique: true,
            fields: ['key'],
          },
          {
            fields: ['category'],
          },
          {
            fields: ['isActive'],
          },
        ],
        hooks: {
          beforeCreate: (template) => {
            logger.info(`Creating notification template: ${template.key}`);
          },
          afterCreate: (template) => {
            logger.info(`Notification template created: ${template.key}`);
          },
          beforeUpdate: (template) => {
            if (template.changed('key')) {
              throw new Error('Cannot change template key after creation');
            }
          },
        },
      }
    );

    return NotificationTemplate;
  }

  public static associate(models: any): void {
    // NotificationTemplate doesn't have direct associations
    // It's used as a reference for creating notifications
  }
}