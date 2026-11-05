/**
 * One login (B3). `personal`: password login, slides to 14 days on every
 * refresh. `station`: PIN at a station, ends hard 12 hours after the PIN.
 * Every access token carries its session id (`sid`); the API checks the
 * session on each request, so revoking it (logout, refresh-token reuse,
 * deactivation, new password or PIN, revoked station) ends access at once.
 */
import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export const SESSION_KINDS = ['personal', 'station'] as const
export type SessionKind = (typeof SESSION_KINDS)[number]

export class AuthSession extends Model<
  InferAttributes<AuthSession>,
  InferCreationAttributes<AuthSession>
> {
  declare id: CreationOptional<number>
  declare userId: ForeignKey<number>
  declare kind: SessionKind
  declare stationId: CreationOptional<number | null>
  declare expiresAt: Date
  declare revokedAt: CreationOptional<Date | null>
  /** `logout`, `reuse`, `password`, `pin`, `deactivated`, `station_revoked` */
  declare revokeReason: CreationOptional<string | null>
  declare userAgent: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof AuthSession {
    AuthSession.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        kind: { type: DataTypes.ENUM(...SESSION_KINDS), allowNull: false },
        stationId: { type: DataTypes.INTEGER, allowNull: true },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE, allowNull: true },
        revokeReason: { type: DataTypes.STRING(32), allowNull: true },
        userAgent: { type: DataTypes.STRING, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'AuthSession',
        tableName: 'auth_sessions',
        underscored: true,
        timestamps: true,
      }
    )
    return AuthSession
  }
}

export default AuthSession
