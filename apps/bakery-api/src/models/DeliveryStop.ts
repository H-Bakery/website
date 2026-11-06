/**
 * A stop of a tour (B8), in driven order (`position`). Fields follow the
 * mock's `tour.stops[]` (D3). With `pickupPointId` the stop is a
 * Sammelstelle: its handover list comes from `preorders` (B7), not from the
 * stop.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export interface StopItem {
  name: string
  qty: number
  unit: string
}

export class DeliveryStop extends Model<
  InferAttributes<DeliveryStop>,
  InferCreationAttributes<DeliveryStop>
> {
  declare id: CreationOptional<number>
  declare tourId: number
  /** 0-based place in the driven order. */
  declare position: number
  declare customer: string
  declare street: CreationOptional<string>
  declare zip: CreationOptional<string>
  declare city: CreationOptional<string>
  declare phone: CreationOptional<string | null>
  declare timeWindow: CreationOptional<string | null>
  declare notes: CreationOptional<string | null>
  declare items: CreationOptional<StopItem[]>
  declare pickupPointId: CreationOptional<string | null>
  /** `open` | `done` | `failed` (`STOP_STATUS` of the core). */
  declare status: CreationOptional<string>
  declare completedAt: CreationOptional<Date | null>
  declare failureReason: CreationOptional<string | null>
  declare goodsDisposition: CreationOptional<string | null>
  declare lat: CreationOptional<number | null>
  declare lon: CreationOptional<number | null>
  declare geocodeSource: CreationOptional<string | null>
  declare geocodePrecision: CreationOptional<string | null>
  declare importKey: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof DeliveryStop {
    DeliveryStop.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tourId: { type: DataTypes.INTEGER, allowNull: false },
        position: { type: DataTypes.INTEGER, allowNull: false },
        customer: { type: DataTypes.STRING(200), allowNull: false },
        street: {
          type: DataTypes.STRING(200),
          allowNull: false,
          defaultValue: '',
        },
        zip: { type: DataTypes.STRING(16), allowNull: false, defaultValue: '' },
        city: {
          type: DataTypes.STRING(120),
          allowNull: false,
          defaultValue: '',
        },
        phone: { type: DataTypes.STRING(40), allowNull: true },
        timeWindow: { type: DataTypes.STRING(64), allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        items: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        pickupPointId: { type: DataTypes.STRING(64), allowNull: true },
        status: {
          type: DataTypes.STRING(8),
          allowNull: false,
          defaultValue: 'open',
        },
        completedAt: { type: DataTypes.DATE, allowNull: true },
        failureReason: { type: DataTypes.STRING(200), allowNull: true },
        goodsDisposition: { type: DataTypes.STRING(32), allowNull: true },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lon: { type: DataTypes.FLOAT, allowNull: true },
        geocodeSource: { type: DataTypes.STRING(32), allowNull: true },
        geocodePrecision: { type: DataTypes.STRING(16), allowNull: true },
        importKey: {
          type: DataTypes.STRING(64),
          allowNull: true,
          unique: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'DeliveryStop',
        tableName: 'delivery_stops',
        underscored: true,
        timestamps: true,
      }
    )
    return DeliveryStop
  }
}

export default DeliveryStop
