/**
 * A shift (TASK-042): any area (since 2026-11-08), one day, end after start (no
 * shift past midnight), no two overlapping shifts of the same person - the
 * API checks all of it (`vacation.core.js`).
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class Shift extends Model<
  InferAttributes<Shift>,
  InferCreationAttributes<Shift>
> {
  declare id: CreationOptional<number>
  declare employeeId: number
  declare date: string
  declare startTime: string
  declare endTime: string
  declare breakMinutes: CreationOptional<number>
  declare note: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof Shift {
    Shift.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        employeeId: { type: DataTypes.INTEGER, allowNull: false },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        startTime: { type: DataTypes.STRING(5), allowNull: false },
        endTime: { type: DataTypes.STRING(5), allowNull: false },
        breakMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        note: { type: DataTypes.TEXT, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Shift',
        tableName: 'shifts',
        underscored: true,
        timestamps: true,
      }
    )
    return Shift
  }
}

export default Shift
