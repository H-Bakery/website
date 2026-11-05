/**
 * One line of a preorder. `productId` is the hq slug; name, unit and price are
 * snapshots taken at entry, so a later hq price change does not alter old
 * orders. `variant` (filling etc.) is validated against the Backzettel item's
 * `variants` (§5.3).
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

export class PreorderItem extends Model<
  InferAttributes<PreorderItem>,
  InferCreationAttributes<PreorderItem>
> {
  declare id: CreationOptional<number>
  declare preorderId: ForeignKey<number>
  declare productId: string
  declare productName: string
  declare unit: CreationOptional<string>
  /** SQLite returns DECIMAL as a number; other dialects as a string. */
  declare unitPrice: number
  declare quantity: number
  declare variant: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof PreorderItem {
    PreorderItem.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        preorderId: { type: DataTypes.INTEGER, allowNull: false },
        productId: { type: DataTypes.STRING(128), allowNull: false },
        productName: { type: DataTypes.STRING, allowNull: false },
        unit: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'Stück',
        },
        unitPrice: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: { min: 0 },
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: { min: 1, isInt: true },
        },
        variant: { type: DataTypes.STRING(64), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'PreorderItem',
        tableName: 'preorder_items',
        underscored: true,
        timestamps: true,
      }
    )
    return PreorderItem
  }
}

export default PreorderItem
