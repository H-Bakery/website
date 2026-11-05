/**
 * A Sammelstelle such as Kindergarten Mörsbach: one stop, many preorders.
 * Field set follows the mock contract (`normalizePickupPointInput` in
 * `delivery-preorders.core.js`, D3).
 *
 * `weekday` and `orderDeadline.weekday` are JavaScript weekdays
 * (0 = Sunday ... 6 = Saturday), unlike the ISO weekdays of partners.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export interface OrderDeadline {
  weekday: number
  time: string
}

export class PickupPoint extends Model<
  InferAttributes<PickupPoint>,
  InferCreationAttributes<PickupPoint>
> {
  /** Slug, e.g. `kindergarten-moersbach`. */
  declare id: string
  declare name: string
  declare street: CreationOptional<string>
  declare zip: CreationOptional<string>
  declare city: CreationOptional<string>
  declare weekday: number
  /** Handover window `HH:MM-HH:MM`. */
  declare window: CreationOptional<string | null>
  declare orderDeadline: CreationOptional<OrderDeadline | null>
  declare notes: CreationOptional<string | null>
  declare active: CreationOptional<boolean>
  declare lat: CreationOptional<number | null>
  declare lon: CreationOptional<number | null>
  declare geocodeSource: CreationOptional<string | null>
  declare geocodePrecision: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof PickupPoint {
    PickupPoint.init(
      {
        id: { type: DataTypes.STRING(64), primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        street: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
        zip: { type: DataTypes.STRING(10), allowNull: false, defaultValue: '' },
        city: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
        weekday: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: { min: 0, max: 6 },
        },
        window: { type: DataTypes.STRING(11), allowNull: true },
        orderDeadline: { type: DataTypes.JSON, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lon: { type: DataTypes.FLOAT, allowNull: true },
        geocodeSource: { type: DataTypes.STRING(32), allowNull: true },
        geocodePrecision: { type: DataTypes.STRING(32), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'PickupPoint',
        tableName: 'pickup_points',
        underscored: true,
        timestamps: true,
      }
    )
    return PickupPoint
  }
}

export default PickupPoint
