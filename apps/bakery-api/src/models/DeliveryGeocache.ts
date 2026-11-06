/**
 * Address → coordinates (B8), the mock's `store.geocache`: a Nominatim hit is
 * kept for good, so an address is looked up exactly once. The key is
 * `normalizeAddress()` of `delivery-tours.core.js`. Misses are not stored -
 * the service remembers them in memory for 5 minutes only.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class DeliveryGeocache extends Model<
  InferAttributes<DeliveryGeocache>,
  InferCreationAttributes<DeliveryGeocache>
> {
  declare key: string
  declare lat: number
  declare lon: number
  declare displayName: CreationOptional<string | null>
  /** `'house'` | `'street'` | null (unknown, older entries). */
  declare precision: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof DeliveryGeocache {
    DeliveryGeocache.init(
      {
        key: { type: DataTypes.STRING(300), primaryKey: true },
        lat: { type: DataTypes.FLOAT, allowNull: false },
        lon: { type: DataTypes.FLOAT, allowNull: false },
        displayName: { type: DataTypes.TEXT, allowNull: true },
        precision: { type: DataTypes.STRING(16), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'DeliveryGeocache',
        tableName: 'delivery_geocache',
        underscored: true,
        timestamps: true,
      }
    )
    return DeliveryGeocache
  }
}

export default DeliveryGeocache
