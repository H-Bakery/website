import { DataTypes, Model, Sequelize } from 'sequelize'

export interface LocalizedTextAttributes {
  de: string
  en: string
}

export interface NotificationTemplateAttributes {
  id: number
  key: string
  name: string
  category: 'production' | 'inventory' | 'order' | 'staff' | 'financial' | 'system' | 'customer'
  defaultTitle: LocalizedTextAttributes
  defaultMessage: LocalizedTextAttributes
  variables: string[]
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent'
  defaultType: 'info' | 'success' | 'warning' | 'error'
  isActive: boolean
  metadata?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export interface NotificationTemplateCreationAttributes
  extends Omit<NotificationTemplateAttributes, 'id'> {}

class NotificationTemplate
  extends Model<
    NotificationTemplateAttributes,
    NotificationTemplateCreationAttributes
  >
  implements NotificationTemplateAttributes
{
  public id!: number
  public key!: string
  public name!: string
  public category!: 'production' | 'inventory' | 'order' | 'staff' | 'financial' | 'system' | 'customer'
  public defaultTitle!: LocalizedTextAttributes
  public defaultMessage!: LocalizedTextAttributes
  public variables!: string[]
  public defaultPriority!: 'low' | 'medium' | 'high' | 'urgent'
  public defaultType!: 'info' | 'success' | 'warning' | 'error'
  public isActive!: boolean
  public metadata?: Record<string, any>
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof NotificationTemplate {
    NotificationTemplate.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        key: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: true,
            is: /^[A-Z_]+$/i, // Uppercase letters and underscores only
          },
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
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
          validate: {
            isValidLocalization(value: any) {
              if (!value || typeof value !== 'object') {
                throw new Error('defaultTitle must be an object')
              }
              if (!value.de || !value.en) {
                throw new Error('defaultTitle must contain both "de" and "en" translations')
              }
              if (typeof value.de !== 'string' || typeof value.en !== 'string') {
                throw new Error('defaultTitle translations must be strings')
              }
            },
          },
        },
        defaultMessage: {
          type: DataTypes.JSON,
          allowNull: false,
          validate: {
            isValidLocalization(value: any) {
              if (!value || typeof value !== 'object') {
                throw new Error('defaultMessage must be an object')
              }
              if (!value.de || !value.en) {
                throw new Error('defaultMessage must contain both "de" and "en" translations')
              }
              if (typeof value.de !== 'string' || typeof value.en !== 'string') {
                throw new Error('defaultMessage translations must be strings')
              }
            },
          },
        },
        variables: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('variables must be an array')
              }
              if (!value.every((v: any) => typeof v === 'string')) {
                throw new Error('All variables must be strings')
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
          {
            fields: ['defaultPriority'],
          },
        ],
      }
    )
    return NotificationTemplate
  }

  // Helper method to render template with variables
  public renderTemplate(
    locale: 'de' | 'en',
    variables: Record<string, any> = {}
  ): { title: string; message: string } {
    let title = this.defaultTitle[locale] || this.defaultTitle.en
    let message = this.defaultMessage[locale] || this.defaultMessage.en

    // Replace variables in format {{variableName}}
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      title = title.replace(regex, String(variables[key]))
      message = message.replace(regex, String(variables[key]))
    })

    return { title, message }
  }
}

export default NotificationTemplate