/**
 * A shift template (TASK-042), e.g. „Früh“ 06:00-12:00, for quick entry. A
 * shift copies the times; changing or deleting a template does not touch
 * existing shifts.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class ShiftTemplate extends Model<
  InferAttributes<ShiftTemplate>,
  InferCreationAttributes<ShiftTemplate>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare startTime: string
  declare endTime: string
  declare breakMinutes: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof ShiftTemplate {
    ShiftTemplate.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(40), allowNull: false },
        startTime: { type: DataTypes.STRING(5), allowNull: false },
        endTime: { type: DataTypes.STRING(5), allowNull: false },
        breakMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'ShiftTemplate',
        tableName: 'shift_templates',
        underscored: true,
        timestamps: true,
      }
    )
    return ShiftTemplate
  }
}

export default ShiftTemplate
