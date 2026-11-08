/**
 * A preorder change after the day was confirmed (roadmap §5.3/§5.4, Z3).
 *
 * One row per change and preorder: `qty` is the increment in item units
 * (a quarter = 0.25) against what earlier rows already recorded, so the sum of
 * a preorder's rows is its change since confirmation. Rows are written when the
 * confirmed day is read (idempotent), shown highlighted and acknowledged by the
 * Backstube; they are never merged into the frozen lines.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

/** `removed`/`moved` seit W4-Verifikation Runde 5 (Zeile auf 0, Tag gewechselt). */
export const BACKZETTEL_DELTA_KINDS = [
  'added',
  'changed',
  'cancelled',
  'removed',
  'moved',
] as const
export type BackzettelDeltaKind = (typeof BACKZETTEL_DELTA_KINDS)[number]

export class BackzettelDelta extends Model<
  InferAttributes<BackzettelDelta>,
  InferCreationAttributes<BackzettelDelta>
> {
  declare id: CreationOptional<number>
  declare date: string
  declare itemId: string
  declare variant: CreationOptional<string>
  declare qty: number
  declare preorderId: CreationOptional<number | null>
  declare kind: CreationOptional<BackzettelDeltaKind | null>
  declare acknowledgedAt: CreationOptional<Date | null>
  declare acknowledgedBy: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof BackzettelDelta {
    BackzettelDelta.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        itemId: { type: DataTypes.STRING(128), allowNull: false },
        variant: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: '',
        },
        qty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        preorderId: { type: DataTypes.INTEGER, allowNull: true },
        kind: { type: DataTypes.STRING(16), allowNull: true },
        acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
        acknowledgedBy: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'BackzettelDelta',
        tableName: 'backzettel_deltas',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      }
    )
    return BackzettelDelta
  }
}

export default BackzettelDelta
