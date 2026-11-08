/**
 * A member of staff (TASK-042 Dienstplan) - not a login. `displayName` is
 * authoritative; `userId` is only an optional link to a `users` row.
 * Deactivated (`active: false`), never deleted. No phone, address, IBAN, tax
 * id or health data - that belongs to payroll, not here. Personal data stays
 * in SQLite (D13), never in hq.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class Employee extends Model<
  InferAttributes<Employee>,
  InferCreationAttributes<Employee>
> {
  declare id: CreationOptional<number>
  declare displayName: string
  /** `verkauf | backstube | fahrer | buero` (`vacation.core.js` AREAS). */
  declare area: string
  /** `#RRGGBB` for the calendar, or null. */
  declare color: CreationOptional<string | null>
  /** `vollzeit | teilzeit | minijob | aushilfe`, or null. */
  declare employmentType: CreationOptional<string | null>
  declare weeklyHours: CreationOptional<number | null>
  declare entryDate: CreationOptional<string | null>
  declare exitDate: CreationOptional<string | null>
  declare active: CreationOptional<boolean>
  declare userId: CreationOptional<number | null>
  /** Owner only; never written to the audit log. */
  declare note: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof Employee {
    Employee.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        displayName: { type: DataTypes.STRING(80), allowNull: false },
        area: { type: DataTypes.STRING(16), allowNull: false },
        color: { type: DataTypes.STRING(7), allowNull: true },
        employmentType: { type: DataTypes.STRING(16), allowNull: true },
        weeklyHours: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        entryDate: { type: DataTypes.DATEONLY, allowNull: true },
        exitDate: { type: DataTypes.DATEONLY, allowNull: true },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        userId: { type: DataTypes.INTEGER, allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Employee',
        tableName: 'employees',
        underscored: true,
        timestamps: true,
      }
    )
    return Employee
  }
}

export default Employee
