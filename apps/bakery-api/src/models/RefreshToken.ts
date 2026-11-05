/**
 * Server-side refresh token (B3). Only the hash is stored. Rotation: a
 * refresh revokes the token (`revokedAt`) and points `replacedBy` at the id
 * of its successor; a revoked token presented again means theft.
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
