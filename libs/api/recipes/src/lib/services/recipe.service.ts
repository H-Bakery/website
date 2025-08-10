/**
 * Recipe service - business logic for recipe management
 */

import { marked } from 'marked';
import { 
  Recipe, 
  CreateRecipeInput, 
  UpdateRecipeInput, 
  RecipeFilters,
  RECIPE_CATEGORIES,
  RecipeCategory
} from '../models/recipe.model';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true
});

export class RecipeService {
  private recipes: Map<number, Recipe> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with sample data
    this.initializeSampleData();
  }

  /**
   * Helper function to convert instructions array to markdown format
   */
  private instructionsToMarkdown(instructions: string | string[]): string {
    if (Array.isArray(instructions)) {
      return instructions.map((step, index) => `${index + 1}. ${step}`).join('\n');
    }
    return instructions;
  }

  /**
   * Helper function to parse markdown instructions to HTML
   */
  private parseInstructions(markdownText: string): string {
    // Type assertion for older marked API
    return (marked as any)(markdownText) as string;
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Get all recipes with optional filters
   */
  async getAllRecipes(filters?: RecipeFilters): Promise<Recipe[]> {
    let recipes = Array.from(this.recipes.values());

    // Apply filters
    if (filters?.category) {
      recipes = recipes.filter(r => r.category === filters.category);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      recipes = recipes.filter(r => 
        r.name.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower) ||
        r.category.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    recipes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      recipes = recipes.slice(filters.offset, filters.offset + filters.limit);
    }

    // Add parsed HTML instructions
    return recipes.map(recipe => ({
      ...recipe,
      instructionsHtml: this.parseInstructions(recipe.instructions)
    }));
  }

  /**
   * Get recipe by ID
   */
  async getRecipeById(id: number): Promise<Recipe | null> {
    const recipe = this.recipes.get(id);
    if (!recipe) return null;

    return {
      ...recipe,
      instructionsHtml: this.parseInstructions(recipe.instructions)
    };
  }

  /**
   * Get recipe by slug
   */
  async getRecipeBySlug(slug: string): Promise<Recipe | null> {
    const recipe = Array.from(this.recipes.values()).find(r => r.slug === slug);
    if (!recipe) return null;

    return {
      ...recipe,
      instructionsHtml: this.parseInstructions(recipe.instructions)
    };
  }

  /**
   * Create new recipe
   */
  async createRecipe(input: CreateRecipeInput): Promise<Recipe> {
    // Validate ingredients
    if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
      throw new Error('Ingredients must be a non-empty array');
    }

    for (const [index, ingredient] of input.ingredients.entries()) {
      if (!ingredient.name || !ingredient.quantity) {
        throw new Error(`Ingredient at index ${index} must have name and quantity`);
      }
    }

    const now = new Date().toISOString();
    const markdownInstructions = this.instructionsToMarkdown(input.instructions);
    
    const recipe: Recipe = {
      id: this.nextId++,
      name: input.name,
      slug: this.generateSlug(input.name),
      description: input.description,
      ingredients: input.ingredients,
      instructions: markdownInstructions,
      category: input.category,
      prepTime: input.prepTime,
      cookTime: input.cookTime,
      servings: input.servings,
      image: input.image,
      createdAt: now,
      updatedAt: now
    };

    // Check for duplicate slug
    if (Array.from(this.recipes.values()).some(r => r.slug === recipe.slug)) {
      recipe.slug = `${recipe.slug}-${recipe.id}`;
    }

    this.recipes.set(recipe.id, recipe);

    return {
      ...recipe,
      instructionsHtml: this.parseInstructions(recipe.instructions)
    };
  }

  /**
   * Update recipe
   */
  async updateRecipe(id: number, input: UpdateRecipeInput): Promise<Recipe | null> {
    const recipe = this.recipes.get(id);
    if (!recipe) return null;

    // Validate ingredients if provided
    if (input.ingredients) {
      if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
        throw new Error('Ingredients must be a non-empty array');
      }

      for (const [index, ingredient] of input.ingredients.entries()) {
        if (!ingredient.name || !ingredient.quantity) {
          throw new Error(`Ingredient at index ${index} must have name and quantity`);
        }
      }
    }

    // Apply updates
    if (input.name !== undefined) {
      recipe.name = input.name;
      recipe.slug = this.generateSlug(input.name);
      
      // Check for duplicate slug
      const existingWithSlug = Array.from(this.recipes.values())
        .find(r => r.id !== id && r.slug === recipe.slug);
      if (existingWithSlug) {
        recipe.slug = `${recipe.slug}-${recipe.id}`;
      }
    }

    if (input.description !== undefined) recipe.description = input.description;
    if (input.ingredients !== undefined) recipe.ingredients = input.ingredients;
    if (input.instructions !== undefined) {
      recipe.instructions = this.instructionsToMarkdown(input.instructions);
    }
    if (input.category !== undefined) recipe.category = input.category;
    if (input.prepTime !== undefined) recipe.prepTime = input.prepTime;
    if (input.cookTime !== undefined) recipe.cookTime = input.cookTime;
    if (input.servings !== undefined) recipe.servings = input.servings;
    if (input.image !== undefined) recipe.image = input.image;

    recipe.updatedAt = new Date().toISOString();

    return {
      ...recipe,
      instructionsHtml: this.parseInstructions(recipe.instructions)
    };
  }

  /**
   * Update recipe by slug
   */
  async updateRecipeBySlug(slug: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const recipe = Array.from(this.recipes.values()).find(r => r.slug === slug);
    if (!recipe) return null;

    return this.updateRecipe(recipe.id, input);
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(id: number): Promise<boolean> {
    return this.recipes.delete(id);
  }

  /**
   * Delete recipe by slug
   */
  async deleteRecipeBySlug(slug: string): Promise<boolean> {
    const recipe = Array.from(this.recipes.values()).find(r => r.slug === slug);
    if (!recipe) return false;

    return this.recipes.delete(recipe.id);
  }

  /**
   * Get all recipe categories
   */
  async getCategories(): Promise<RecipeCategory[]> {
    const categoryCounts = new Map<string, number>();

    // Count recipes per category
    for (const recipe of this.recipes.values()) {
      const count = categoryCounts.get(recipe.category) || 0;
      categoryCounts.set(recipe.category, count + 1);
    }

    // Return categories with counts
    return RECIPE_CATEGORIES.map(category => ({
      ...category,
      count: categoryCounts.get(category.name) || 0
    }));
  }

  /**
   * Scale recipe ingredients
   */
  async scaleRecipe(id: number, newServings: number): Promise<Recipe | null> {
    const recipe = await this.getRecipeById(id);
    if (!recipe || !recipe.servings) return null;

    const scaleFactor = newServings / recipe.servings;
    
    const scaledIngredients = recipe.ingredients.map(ingredient => {
      // Try to parse and scale numeric quantities
      const match = ingredient.quantity.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
      if (match) {
        const amount = parseFloat(match[1]);
        const unit = match[2] || '';
        const scaledAmount = (amount * scaleFactor).toFixed(2).replace(/\.00$/, '');
        return {
          ...ingredient,
          quantity: `${scaledAmount} ${unit}`.trim()
        };
      }
      
      // If not numeric, return as-is with a note
      return {
        ...ingredient,
        quantity: ingredient.quantity,
        notes: `(für ${recipe.servings} Portionen)`
      };
    });

    return {
      ...recipe,
      servings: newServings,
      ingredients: scaledIngredients
    };
  }

  /**
   * Initialize with sample data
   */
  private initializeSampleData() {
    const sampleRecipes: CreateRecipeInput[] = [
      {
        name: 'Klassisches Sauerteigbrot',
        description: 'Ein traditionelles Sauerteigbrot mit knuspriger Kruste und lockerer Krume',
        ingredients: [
          { name: 'Weizenmehl Type 550', quantity: '500g' },
          { name: 'Wasser', quantity: '375ml' },
          { name: 'Sauerteig-Starter', quantity: '100g' },
          { name: 'Salz', quantity: '10g' }
        ],
        instructions: [
          'Mehl und Wasser vermischen und 30 Minuten ruhen lassen (Autolyse)',
          'Sauerteig-Starter und Salz hinzufügen und gut verkneten',
          'Teig in eine geölte Schüssel geben und 4-6 Stunden bei Raumtemperatur gehen lassen',
          'Teig falten und formen, dann für 8-12 Stunden im Kühlschrank gehen lassen',
          'Bei 230°C für 20 Minuten mit Dampf backen, dann weitere 25 Minuten ohne Dampf'
        ],
        category: 'bread',
        prepTime: '30 Minuten',
        cookTime: '45 Minuten',
        servings: 1
      },
      {
        name: 'Schoko-Croissants',
        description: 'Buttrige Croissants gefüllt mit feiner Schokolade',
        ingredients: [
          { name: 'Mehl', quantity: '500g' },
          { name: 'Milch', quantity: '300ml' },
          { name: 'Butter', quantity: '250g', notes: 'kalt' },
          { name: 'Zucker', quantity: '50g' },
          { name: 'Salz', quantity: '10g' },
          { name: 'Hefe', quantity: '20g', notes: 'frisch' },
          { name: 'Schokoladensticks', quantity: '16 Stück' }
        ],
        instructions: [
          'Milch leicht erwärmen und Hefe darin auflösen',
          'Mehl, Zucker und Salz in einer Schüssel mischen',
          'Hefemilch hinzufügen und zu einem glatten Teig kneten',
          'Teig 1 Stunde bei Raumtemperatur gehen lassen',
          'Teig ausrollen und kalte Butter einschlagen',
          'Dreimal falten und ausrollen, dazwischen jeweils 30 Minuten kühlen',
          'Teig in Dreiecke schneiden, Schokolade einrollen',
          'Geformte Croissants 2 Stunden gehen lassen',
          'Mit Ei bestreichen und bei 200°C für 15-18 Minuten backen'
        ],
        category: 'pastries',
        prepTime: '4 Stunden',
        cookTime: '18 Minuten',
        servings: 8
      }
    ];

    for (const recipeInput of sampleRecipes) {
      this.createRecipe(recipeInput);
    }
  }
}

// Export singleton instance
export const recipeService = new RecipeService();