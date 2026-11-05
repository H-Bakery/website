/**
 * A shared device registered as a station (D5, B3): the shop and Backstube
 * tablets. Staff switch in there by PIN. Only the SHA-256 of the station
 * token is stored; `toJSON()` never includes it. Revoked, not deleted.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class Station extends Model<
  InferAttributes<Station>,
  InferCreationAttributes<Station>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare tokenHash: string
  declare createdBy: CreationOptional<number | null>
  declare lastUsedAt: CreationOptional<Date | null>
  declare revokedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON<T = any>(): T {
    const values: Record<string, unknown> = { ...this.get() }
    delete values['tokenHash']
    // A fresh `Station.create()` instance lacks the nullable columns.
    for (const key of ['createdBy', 'lastUsedAt', 'revokedAt']) {
      if (values[key] === undefined) values[key] = null
    }
    return values as T
  }

  static initModel(sequelize: Sequelize): typeof Station {
    Station.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(80), allowNull: false },
        tokenHash: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        lastUsedAt: { type: DataTypes.DATE, allowNull: true },
        revokedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Station',
        tableName: 'stations',
        underscored: true,
        timestamps: true,
      }
    )
    return Station
  }
}

export default Station
