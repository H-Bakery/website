/**
 * A personal staff account (D5). Table `users` from the pilot baseline.
 *
 * Hashes only - scrypt via `node:crypto` (D12); the format is B3's. The
 * default scope leaves both hashes out, so a serialised user never carries
 * them. A user
 * without `pin_hash` cannot switch in at a station by PIN. Users are
 * deactivated, not deleted: preorders, visits and the audit log point at
 * them.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export const USER_ROLES = ['inhaber', 'verkauf', 'backstube', 'fahrer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>
  declare username: string
  declare displayName: string
  declare role: UserRole
  declare passwordHash: string
  declare pinHash: CreationOptional<string | null>
  declare active: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        username: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        },
        displayName: { type: DataTypes.STRING(120), allowNull: false },
        role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false },
        passwordHash: { type: DataTypes.STRING, allowNull: false },
        pinHash: { type: DataTypes.STRING, allowNull: true },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: true,
        timestamps: true,
        defaultScope: {
          attributes: { exclude: ['passwordHash', 'pinHash'] },
        },
        // `User.scope('withSecrets')` replaces the default scope: login only.
        scopes: { withSecrets: {} },
      }
    )
    return User
  }
}

export default User
