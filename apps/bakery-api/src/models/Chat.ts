import { 
  Model, 
  DataTypes, 
  Sequelize, 
  InferAttributes, 
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  BelongsToGetAssociationMixin
} from 'sequelize';
import { logger } from '@bakery/api/core';

export interface ChatAttributes {
  id: number;
  message: string;
  timestamp: Date;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Chat extends Model<
  InferAttributes<Chat>,
  InferCreationAttributes<Chat>
> {
  declare id: CreationOptional<number>;
  declare message: string;
  declare timestamp: Date;
  declare userId: ForeignKey<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare getUser: BelongsToGetAssociationMixin<any>;
  declare user?: any;

  static initModel(sequelize: Sequelize): typeof Chat {
    Chat.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Message cannot be empty',
            },
          },
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Chat',
        tableName: 'Chats',
        timestamps: true,
        hooks: {
          beforeCreate: (chat: Chat) => {
            logger.info(`Creating chat message from user ${chat.userId}`);
          },
        },
      }
    );

    return Chat;
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() };
    return values;
  }
}

// For backward compatibility
export default Chat;