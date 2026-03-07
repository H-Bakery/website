import { DataTypes, Model, Sequelize } from 'sequelize'

export interface NotificationAttributes {
  id: number
  userId: number
  type: string
  title: string
  message: string
  priority: string
  isRead: boolean
  category?: string
  readAt?: Date | null
  metadata?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export interface NotificationCreationAttributes
  extends Omit<NotificationAttributes, 'id'> {}

class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  public id!: number
  public userId!: number
  public type!: string
  public title!: string
  public message!: string
  public priority!: string
  public isRead!: boolean
  public category?: string
  public readAt?: Date | null
  public metadata?: Record<string, any>
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof Notification {
    Notification.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        priority: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'normal',
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        category: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        readAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
      },
      {
        sequelize,
        modelName: 'Notification',
        tableName: 'notifications',
        timestamps: true,
      }
    )
    return Notification
  }
}

export default Notification
