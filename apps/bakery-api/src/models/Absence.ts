/**
 * An absence (TASK-042): `urlaub | frei | abwesend` - deliberately neutral,
 * no sickness and no health data. `geplant | genehmigt`; whole days from
 * `startDate` to `endDate`, `halfDay` only for a single day. Only `urlaub`
 * uses up vacation days (`vacation.core.js`).
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class Absence extends Model<
  InferAttributes<Absence>,
  InferCreationAttributes<Absence>
> {
  declare id: CreationOptional<number>
  declare employeeId: number
  declare type: string
  declare status: CreationOptional<string>
  declare startDate: string
  declare endDate: string
  declare halfDay: CreationOptional<boolean>
  declare note: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof Absence {
    Absence.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        employeeId: { type: DataTypes.INTEGER, allowNull: false },
        type: { type: DataTypes.STRING(16), allowNull: false },
        status: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'geplant',
        },
        startDate: { type: DataTypes.DATEONLY, allowNull: false },
        endDate: { type: DataTypes.DATEONLY, allowNull: false },
        halfDay: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        note: { type: DataTypes.TEXT, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Absence',
        tableName: 'absences',
        underscored: true,
        timestamps: true,
      }
    )
    return Absence
  }
}

export default Absence
