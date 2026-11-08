/**
 * „Rest am Abend“ (roadmap §6 M4): what was left in the shop at closing for
 * one count line - business day × Backzettel item × variant × product.
 *
 * `variant` / `productId` are '' for "none", never null (unique index
 * `business_date, item_id, variant, product_id`). A row exists only when
 * something was counted: `qty` 0 = "nichts übrig", no row = not counted (a
 * gap). `name`, `itemName`, `unit`, `itemUnit` and `factor` are snapshots
 * taken when counting; `rest-am-abend.core.js` converts with the stored
 * `factor`. Every change is audited (`audit_log`, action `rest_count`).
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class RestCount extends Model<
  InferAttributes<RestCount>,
  InferCreationAttributes<RestCount>
> {
  declare id: CreationOptional<number>
  declare businessDate: string
  declare itemId: string
  declare variant: CreationOptional<string>
  declare productId: CreationOptional<string>
  declare name: CreationOptional<string | null>
  declare itemName: CreationOptional<string | null>
  declare unit: string
  declare itemUnit: string
  declare factor: number
  declare qty: number
  declare revision: CreationOptional<number>
  declare countedBy: CreationOptional<number | null>
  /** JSON array of the line's product ids when counted (`null` = before the column). */
  declare lineRows: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof RestCount {
    RestCount.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        businessDate: { type: DataTypes.DATEONLY, allowNull: false },
        itemId: { type: DataTypes.STRING(128), allowNull: false },
        variant: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: '',
        },
        productId: {
          type: DataTypes.STRING(128),
          allowNull: false,
          defaultValue: '',
        },
        name: { type: DataTypes.STRING, allowNull: true },
        itemName: { type: DataTypes.STRING, allowNull: true },
        unit: { type: DataTypes.STRING(16), allowNull: false },
        itemUnit: { type: DataTypes.STRING(16), allowNull: false },
        factor: {
          type: DataTypes.DECIMAL(12, 6),
          allowNull: false,
          defaultValue: 1,
        },
        qty: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        revision: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        countedBy: { type: DataTypes.INTEGER, allowNull: true },
        lineRows: { type: DataTypes.TEXT, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'RestCount',
        tableName: 'rest_counts',
        underscored: true,
        timestamps: true,
      }
    )
    return RestCount
  }
}

export default RestCount
