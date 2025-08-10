import { DataTypes, Model, Sequelize } from 'sequelize'

export interface NotificationCategoryAttributes {
  staff: boolean
  order: boolean
  system: boolean
  inventory: boolean
  general: boolean
}

export interface QuietHoursAttributes {
  enabled: boolean
  start: string // HH:MM format
  end: string // HH:MM format
}

export interface NotificationPreferencesAttributes {
  id: number
  userId: number
  emailEnabled: boolean
  browserEnabled: boolean
  soundEnabled: boolean
  categoryPreferences: NotificationCategoryAttributes
  priorityThreshold: 'low' | 'medium' | 'high' | 'urgent'
  quietHours: QuietHoursAttributes
  createdAt?: Date
  updatedAt?: Date
}

export interface NotificationPreferencesCreationAttributes
  extends Omit<NotificationPreferencesAttributes, 'id'> {}

class NotificationPreferences
  extends Model<
    NotificationPreferencesAttributes,
    NotificationPreferencesCreationAttributes
  >
  implements NotificationPreferencesAttributes
{
  public id!: number
  public userId!: number
  public emailEnabled!: boolean
  public browserEnabled!: boolean
  public soundEnabled!: boolean
  public categoryPreferences!: NotificationCategoryAttributes
  public priorityThreshold!: 'low' | 'medium' | 'high' | 'urgent'
  public quietHours!: QuietHoursAttributes
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof NotificationPreferences {
    NotificationPreferences.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
          references: {
            model: 'users',
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
          defaultValue: false,
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
            isValidCategory(value: any) {
              const required = ['staff', 'order', 'system', 'inventory', 'general']
              const hasAllKeys = required.every(key => key in value)
              if (!hasAllKeys) {
                throw new Error('categoryPreferences must contain all required categories')
              }
              const allBoolean = required.every(key => typeof value[key] === 'boolean')
              if (!allBoolean) {
                throw new Error('All category preference values must be boolean')
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
            end: '08:00',
          },
          validate: {
            isValidQuietHours(value: any) {
              if (!value || typeof value !== 'object') {
                throw new Error('quietHours must be an object')
              }
              if (typeof value.enabled !== 'boolean') {
                throw new Error('quietHours.enabled must be a boolean')
              }
              if (value.enabled) {
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
                if (!timeRegex.test(value.start) || !timeRegex.test(value.end)) {
                  throw new Error('quietHours start and end must be in HH:MM format')
                }
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
      }
    )
    return NotificationPreferences
  }
}

export default NotificationPreferences