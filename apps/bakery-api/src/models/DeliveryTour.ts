/**
 * A delivery tour (B8): one day, optionally one driver, stops in driven
 * order. Fields follow the mock's `store.tours[]` (D3); the decorated answer
 * (progress, ETAs, handover lists) is computed per request by the service,
 * never stored.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export interface LastPosition {
  lat: number
  lon: number
  accuracy: number | null
  speed: number | null
  at: string
}

export class DeliveryTour extends Model<
  InferAttributes<DeliveryTour>,
  InferCreationAttributes<DeliveryTour>
> {
  declare id: CreationOptional<number>
  /** `YYYY-MM-DD` */
  declare date: string
  declare driverId: CreationOptional<number | null>
  declare name: string
  /** `planned` | `active` | `done` (`TOUR_STATUS` of the core). */
  declare status: CreationOptional<string>
  declare vehicleType: CreationOptional<string>
  /** `HH:MM` - base of the arrival estimate of a planned tour. */
  declare plannedStart: CreationOptional<string>
  declare startedAt: CreationOptional<Date | null>
  declare finishedAt: CreationOptional<Date | null>
  /** Metres. */
  declare distance: CreationOptional<number | null>
  /** Seconds. */
  declare duration: CreationOptional<number | null>
  declare isEstimate: CreationOptional<boolean>
  declare geometry: CreationOptional<Array<[number, number]> | null>
  declare routedAt: CreationOptional<Date | null>
  declare lastPosition: CreationOptional<LastPosition | null>
  declare importKey: CreationOptional<string | null>
  declare createdBy: CreationOptional<number | null>
  declare updatedBy: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof DeliveryTour {
    DeliveryTour.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        driverId: { type: DataTypes.INTEGER, allowNull: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        status: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'planned',
        },
        vehicleType: {
          type: DataTypes.STRING(8),
          allowNull: false,
          defaultValue: 'car',
        },
        plannedStart: {
          type: DataTypes.STRING(5),
          allowNull: false,
          defaultValue: '06:30',
        },
        startedAt: { type: DataTypes.DATE, allowNull: true },
        finishedAt: { type: DataTypes.DATE, allowNull: true },
        distance: { type: DataTypes.FLOAT, allowNull: true },
        duration: { type: DataTypes.FLOAT, allowNull: true },
        isEstimate: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        geometry: { type: DataTypes.JSON, allowNull: true },
        routedAt: { type: DataTypes.DATE, allowNull: true },
        lastPosition: { type: DataTypes.JSON, allowNull: true },
        importKey: {
          type: DataTypes.STRING(64),
          allowNull: true,
          unique: true,
        },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'DeliveryTour',
        tableName: 'delivery_tours',
        underscored: true,
        timestamps: true,
      }
    )
    return DeliveryTour
  }
}

export default DeliveryTour
