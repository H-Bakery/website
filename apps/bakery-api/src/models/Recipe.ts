import { DataTypes, Model, Sequelize } from 'sequelize'

export interface RecipeAttributes {
  id: number
  name: string
  category: string
  description?: string
  ingredients: any
  instructions: any
  prepTime?: number
  cookTime?: number
  yield?: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface RecipeCreationAttributes
  extends Omit<RecipeAttributes, 'id'> {}

class Recipe
  extends Model<RecipeAttributes, RecipeCreationAttributes>
  implements RecipeAttributes
{
  public id!: number
  public name!: string
  public category!: string
  public description?: string
  public ingredients!: any
  public instructions!: any
  public prepTime?: number
  public cookTime?: number
  public yield?: string
  public isActive!: boolean
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof Recipe {
    Recipe.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        category: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        ingredients: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        instructions: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        prepTime: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        cookTime: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        yield: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: 'Recipe',
        tableName: 'recipes',
        timestamps: true,
      }
    )
    return Recipe
  }
}

export default Recipe
