/**
 * Server-side refresh token (B3). Only the hash is stored. Rotation: a
 * refresh revokes the token (`revokedAt`) and points `replacedBy` at the id
 * of its successor; a revoked token presented again means theft, and the
 * whole chain - its session (`sessionId`) with every token in it - is revoked.
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

export class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<number>
  declare tokenHash: string
  declare userId: ForeignKey<number>
  /** Session of the rotation chain (migration 20261106000000, B3). */
  declare sessionId: CreationOptional<number | null>
  declare expiresAt: Date
  declare revokedAt: CreationOptional<Date | null>
  declare replacedBy: CreationOptional<number | null>
  declare userAgent: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof RefreshToken {
    RefreshToken.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        sessionId: { type: DataTypes.INTEGER, allowNull: true },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE, allowNull: true },
        replacedBy: { type: DataTypes.INTEGER, allowNull: true },
        userAgent: { type: DataTypes.STRING, allowNull: true },
        createdAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'RefreshToken',
        tableName: 'refresh_tokens',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      }
    )
    return RefreshToken
  }
}

export default RefreshToken
