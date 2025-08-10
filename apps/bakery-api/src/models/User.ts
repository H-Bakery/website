import { DataTypes, Model, Sequelize } from 'sequelize'

export interface UserAttributes {
  id: number
  username: string
  email: string
  role: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface UserCreationAttributes extends Omit<UserAttributes, 'id'> {}

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number
  public username!: string
  public email!: string
  public role!: string
  public isActive!: boolean
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        role: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'staff',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
      }
    )
    return User
  }
}

export default User
