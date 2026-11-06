/**
 * The Backstube as start of every tour (B8): one row, id 1, seeded by the
 * B8 migration. Shape follows the mock's `store.depot` (D3).
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export const DEPOT_ID = 1

export class DeliveryDepot extends Model<
  InferAttributes<DeliveryDepot>,
  InferCreationAttributes<DeliveryDepot>
> {
  declare id: number
  declare name: string
  declare street: string
  declare zip: CreationOptional<string>
  declare city: string
  declare phone: CreationOptional<string | null>
  declare lat: CreationOptional<number | null>
  declare lon: CreationOptional<number | null>
  declare geocodeSource: CreationOptional<string | null>
  declare geocodePrecision: CreationOptional<string | null>
  declare updatedBy: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof DeliveryDepot {
    DeliveryDepot.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        street: { type: DataTypes.STRING(200), allowNull: false },
        zip: { type: DataTypes.STRING(16), allowNull: false, defaultValue: '' },
        city: { type: DataTypes.STRING(120), allowNull: false },
        phone: { type: DataTypes.STRING(40), allowNull: true },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lon: { type: DataTypes.FLOAT, allowNull: true },
        geocodeSource: { type: DataTypes.STRING(32), allowNull: true },
        geocodePrecision: { type: DataTypes.STRING(16), allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'DeliveryDepot',
        tableName: 'delivery_depot',
        underscored: true,
        timestamps: true,
      }
    )
    return DeliveryDepot
  }
}

export default DeliveryDepot
