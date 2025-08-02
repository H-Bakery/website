import { Model, DataTypes, Sequelize, CreationOptional, Association } from 'sequelize';
import { logger } from '@bakery/api/core';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  type?: string;
  notes?: string;
}

interface ProductionStep {
  name: string;
  description: string;
  duration: number;
  temperature?: number;
  notes?: string;
}

export interface RecipeAttributes {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  ingredients: Ingredient[];
  steps: ProductionStep[];
  totalDuration: number;
  difficulty: 'easy' | 'medium' | 'hard';
  yieldAmount: number;
  yieldUnit: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  allergens: string[];
  equipment: string[];
  storageInstructions: string | null;
  shelfLife: number | null;
  costEstimate: number | null;
  isActive: boolean;
  version: number;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface RecipeCreationAttributes extends Omit<RecipeAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id?: number;
}

export class Recipe extends Model<RecipeAttributes, RecipeCreationAttributes> implements RecipeAttributes {
  public id!: number;
  public name!: string;
  public slug!: string;
  public description!: CreationOptional<string | null>;
  public ingredients!: Ingredient[];
  public steps!: ProductionStep[];
  public totalDuration!: number;
  public difficulty!: 'easy' | 'medium' | 'hard';
  public yieldAmount!: number;
  public yieldUnit!: string;
  public category!: string;
  public subcategory!: CreationOptional<string | null>;
  public tags!: string[];
  public allergens!: string[];
  public equipment!: string[];
  public storageInstructions!: CreationOptional<string | null>;
  public shelfLife!: CreationOptional<number | null>;
  public costEstimate!: CreationOptional<number | null>;
  public isActive!: boolean;
  public version!: number;
  public notes!: CreationOptional<string | null>;
  public createdBy!: CreationOptional<number | null>;
  public updatedBy!: CreationOptional<number | null>;
  
  // timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  // Associations
  public readonly creator?: any; // User who created
  public readonly updater?: any; // User who updated
  public readonly products?: any[]; // Products using this recipe

  public static override associations: {
    creator: Association<Recipe, any>;
    updater: Association<Recipe, any>;
    products: Association<Recipe, any>;
  };

  // Getter methods
  public get activeTime(): number {
    return this.steps.reduce((total, step) => total + (step.duration || 0), 0);
  }

  public get ingredientCount(): number {
    return this.ingredients.length;
  }

  public get hasAllergens(): boolean {
    return this.allergens.length > 0;
  }

  public get estimatedCostPerUnit(): number | null {
    if (!this.costEstimate || !this.yieldAmount) return null;
    return this.costEstimate / this.yieldAmount;
  }

  // Instance methods
  public async updateVersion(): Promise<void> {
    this.version = this.version + 1;
    await this.save();
    logger.info(`Recipe ${this.id} version updated to ${this.version}`);
  }

  public async scale(factor: number): Promise<{ ingredients: Ingredient[]; yieldAmount: number }> {
    const scaledIngredients = this.ingredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.quantity * factor
    }));
    
    const scaledYield = this.yieldAmount * factor;
    
    logger.info(`Recipe ${this.id} scaled by factor ${factor}`);
    
    return {
      ingredients: scaledIngredients,
      yieldAmount: scaledYield
    };
  }

  public async calculateCost(ingredientPrices: Record<string, number>): Promise<number> {
    let totalCost = 0;
    
    for (const ingredient of this.ingredients) {
      const price = ingredientPrices[ingredient.name];
      if (price) {
        totalCost += price * ingredient.quantity;
      }
    }
    
    this.costEstimate = totalCost;
    await this.save();
    
    logger.info(`Recipe ${this.id} cost calculated: ${totalCost}`);
    return totalCost;
  }

  public static initModel(sequelize: Sequelize): typeof Recipe {
    Recipe.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
          },
        },
        slug: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: true,
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        ingredients: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('Ingredients must be an array');
              }
              // Validate each ingredient has name and quantity
              value.forEach((ingredient: any, index: number) => {
                if (!ingredient.name || !ingredient.quantity) {
                  throw new Error(`Ingredient at index ${index} must have name and quantity`);
                }
              });
            },
          },
        },
        steps: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('Steps must be an array');
              }
              // Validate each step has name and description
              value.forEach((step: any, index: number) => {
                if (!step.name || !step.description) {
                  throw new Error(`Step at index ${index} must have name and description`);
                }
              });
            },
          },
        },
        totalDuration: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Total duration in minutes',
        },
        difficulty: {
          type: DataTypes.ENUM('easy', 'medium', 'hard'),
          allowNull: false,
          defaultValue: 'medium',
        },
        yieldAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 1,
        },
        yieldUnit: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'pieces',
        },
        category: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        subcategory: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        tags: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        allergens: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        equipment: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        storageInstructions: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        shelfLife: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: 'Shelf life in days',
        },
        costEstimate: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          comment: 'Estimated cost per batch',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        updatedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Recipe',
        tableName: 'recipes',
        timestamps: true,
        paranoid: true,
        hooks: {
          beforeCreate: (recipe) => {
            logger.info(`Creating new recipe: ${recipe.name}`);
          },
          afterCreate: (recipe) => {
            logger.info(`Recipe created with ID: ${recipe.id}`);
          },
          beforeUpdate: (recipe) => {
            // Auto-increment version on update
            if (recipe.changed()) {
              recipe.version = (recipe.version || 1) + 1;
            }
          },
        },
      }
    );

    return Recipe;
  }

  public static associate(models: any): void {
    // Recipe belongs to User (creator)
    if (models.User || models.Customer) {
      const UserModel = models.User || models.Customer;
      Recipe.belongsTo(UserModel, {
        foreignKey: 'createdBy',
        as: 'creator',
      });
      Recipe.belongsTo(UserModel, {
        foreignKey: 'updatedBy',
        as: 'updater',
      });
    }

    // Recipe has many Products (if Product model exists)
    if (models.Product) {
      Recipe.hasMany(models.Product, {
        foreignKey: 'recipeId',
        as: 'products',
      });
    }
  }
}