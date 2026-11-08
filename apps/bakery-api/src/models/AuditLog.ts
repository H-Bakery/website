/**
 * Append-only audit trail (D5: every write is attributed to a user). Shared by
 * preorders, the Backzettel and user administration. Never updated.
 *
 * `data` holds what changed; keep personal data out of it where the entity
 * itself gets anonymised (P4), or it outlives the anonymisation here.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class AuditLog extends Model<
  InferAttributes<AuditLog>,
  InferCreationAttributes<AuditLog>
> {
  declare id: CreationOptional<number>
  declare userId: number | null
  /** e.g. `create`, `update`, `cancel`, `confirm`, `login` */
  declare action: string
  /** e.g. `preorder`, `backzettel_day`, `user` */
  declare entity: string
  declare entityId: CreationOptional<string | null>
  declare data: CreationOptional<Record<string, unknown> | null>
  declare createdAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof AuditLog {
    AuditLog.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: true },
        action: { type: DataTypes.STRING(64), allowNull: false },
        entity: { type: DataTypes.STRING(64), allowNull: false },
        entityId: { type: DataTypes.STRING(64), allowNull: true },
        data: { type: DataTypes.JSON, allowNull: true },
        createdAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'AuditLog',
        tableName: 'audit_log',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      }
    )
    return AuditLog
  }
}

export default AuditLog
