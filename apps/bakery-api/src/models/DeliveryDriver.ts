/**
 * A driver of the Saturday tour (B8). Mock shape `{ id, name, phone,
 * vehicle, active }` (D3) plus `userId`: the login of a `fahrer` - their
 * own tours are the tours of the driver linked to them.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export const VEHICLES = ['bike', 'car', 'van'] as const
export type Vehicle = (typeof VEHICLES)[number]

export class DeliveryDriver extends Model<
  InferAttributes<DeliveryDriver>,
  InferCreationAttributes<DeliveryDriver>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare phone: CreationOptional<string | null>
  declare vehicle: CreationOptional<string>
  declare active: CreationOptional<boolean>
  declare userId: CreationOptional<number | null>
  /** Set by `cli.js import-deliveries` only (idempotent import). */
  declare importKey: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof DeliveryDriver {
    DeliveryDriver.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        phone: { type: DataTypes.STRING(40), allowNull: true },
        vehicle: {
          type: DataTypes.STRING(8),
          allowNull: false,
          defaultValue: 'car',
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        userId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
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
        modelName: 'DeliveryDriver',
        tableName: 'delivery_drivers',
        underscored: true,
        timestamps: true,
      }
    )
    return DeliveryDriver
  }
}

export default DeliveryDriver
