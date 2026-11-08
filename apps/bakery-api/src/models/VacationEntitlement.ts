/**
 * Vacation entitlement of one employee for one year (TASK-042): annual
 * entitlement and carryover from the previous year, in days. Both nullable -
 * a missing entitlement is "offen" (`status: 'no-config'`), never 0. One row
 * per year, so a later change does not rewrite old years.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class VacationEntitlement extends Model<
  InferAttributes<VacationEntitlement>,
  InferCreationAttributes<VacationEntitlement>
> {
  declare id: CreationOptional<number>
  declare employeeId: number
  declare year: number
  declare entitlementDays: CreationOptional<number | null>
  declare carryoverDays: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof VacationEntitlement {
    VacationEntitlement.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        employeeId: { type: DataTypes.INTEGER, allowNull: false },
        year: { type: DataTypes.INTEGER, allowNull: false },
        entitlementDays: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        carryoverDays: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'VacationEntitlement',
        tableName: 'vacation_entitlements',
        underscored: true,
        timestamps: true,
      }
    )
    return VacationEntitlement
  }
}

export default VacationEntitlement
