/**
 * One line of a Backzettel day: item × variant (roadmap §5.3, Z3).
 *
 * On a draft day a row exists only where a correction was entered (the rest
 * is computed live). On confirmation every line is written with its frozen
 * numbers and a snapshot of name/section/unit. `variant` is '' for "no
 * variant", never null (unique index `date, bake_date, item_id, variant`).
 *
 * Z10 (docs/backzettel-v2.md §5.1): `date` is the sheet = dough day,
 * `bakeDate` the day the line is baked. Saturday's sheet holds Sunday's and
 * Tuesday's rolls (bakeDate ≠ date); rows from before Z10 were backfilled
 * with `bakeDate = date`.
 *
 * `cap` is the CAP-Markt delivery template quantity (§5.4 `capTemplate`),
 * not an upper limit - the baseline column comment predates the plan.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class BackzettelLine extends Model<
  InferAttributes<BackzettelLine>,
  InferCreationAttributes<BackzettelLine>
> {
  declare id: CreationOptional<number>
  declare date: string
  declare bakeDate: string
  declare itemId: string
  declare variant: CreationOptional<string>
  declare name: CreationOptional<string | null>
  declare section: CreationOptional<string | null>
  declare unit: CreationOptional<string | null>
  declare base: CreationOptional<number>
  declare seasonal: CreationOptional<number>
  declare preorders: CreationOptional<number>
  declare cap: CreationOptional<number | null>
  declare correction: CreationOptional<number>
  declare correctionReason: CreationOptional<string | null>
  declare correctionBy: CreationOptional<number | null>
  declare total: CreationOptional<number>
  declare doneAt: CreationOptional<Date | null>
  declare doneBy: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof BackzettelLine {
    const qty = () => ({
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    })
    BackzettelLine.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        bakeDate: { type: DataTypes.DATEONLY, allowNull: false },
        itemId: { type: DataTypes.STRING(128), allowNull: false },
        variant: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: '',
        },
        name: { type: DataTypes.STRING, allowNull: true },
        section: { type: DataTypes.STRING(32), allowNull: true },
        unit: { type: DataTypes.STRING(16), allowNull: true },
        base: qty(),
        seasonal: qty(),
        preorders: qty(),
        cap: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        correction: qty(),
        correctionReason: { type: DataTypes.TEXT, allowNull: true },
        correctionBy: { type: DataTypes.INTEGER, allowNull: true },
        total: qty(),
        doneAt: { type: DataTypes.DATE, allowNull: true },
        doneBy: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'BackzettelLine',
        tableName: 'backzettel_lines',
        underscored: true,
        timestamps: true,
      }
    )
    return BackzettelLine
  }
}

export default BackzettelLine
