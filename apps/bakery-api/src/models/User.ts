/**
 * A personal staff account (D5). Table `users` from the pilot baseline.
 *
 * Hashes only - scrypt via `node:crypto` (D12); the format is B3's. Two
 * guards keep them in the database:
 * - the default scope leaves both hashes out of finder queries; login reads
 *   them through `User.scope('withSecrets')`;
 * - `toJSON()` always drops them, because the scope does not cover the
 *   instance `User.create()` returns, nor `findAll({ attributes: [...] })`
 *   with explicit attributes, nor `withSecrets` rows. So `res.json(user)` is
 *   safe however the instance was obtained.
 * A user without `pin_hash` cannot switch in at a station by PIN. Users are
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

/**
 * `backstubenleiter` (Backstubenleitung) = `backstube` plus creating and
 * editing recipes; the inclusion lives in `auth-crypto.core.js`
 * (`ROLE_INCLUDES`). The column is TEXT in SQLite (no CHECK), so a new role
 * needs no migration.
 */
export const USER_ROLES = [
  'inhaber',
  'verkauf',
  'backstube',
  'backstubenleiter',
  'fahrer',
] as const
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

  /** Attributes that never leave the server, whatever the scope. */
  static readonly SECRET_ATTRIBUTES = ['passwordHash', 'pinHash'] as const

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON<T = any>(): T {
    const values: Record<string, unknown> = { ...this.get() }
    for (const key of User.SECRET_ATTRIBUTES) delete values[key]
    return values as T
  }

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
          attributes: { exclude: [...User.SECRET_ATTRIBUTES] },
        },
        // `User.scope('withSecrets')` replaces the default scope: login only.
        scopes: { withSecrets: {} },
      }
    )
    return User
  }
}

export default User
