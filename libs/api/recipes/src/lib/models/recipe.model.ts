/**
 * Recipe model types and interfaces
 */

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit?: string;
  notes?: string;
}

export interface Recipe extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string; // Markdown format
  instructionsHtml?: string; // Parsed HTML (added in responses)
  category: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  image?: string;
}

export interface CreateRecipeInput {
  name: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string | string[]; // Can accept array for conversion
  category: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  image?: string;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  ingredients?: Ingredient[];
  instructions?: string | string[];
  category?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  image?: string;
}

export interface RecipeFilters {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RecipeCategory {
  name: string;
  displayName: string;
  count?: number;
}

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  { name: 'bread', displayName: 'Brot' },
  { name: 'pastries', displayName: 'Gebäck' },
  { name: 'cakes', displayName: 'Kuchen' },
  { name: 'cookies', displayName: 'Kekse' },
  { name: 'seasonal', displayName: 'Saisonal' },
  { name: 'special', displayName: 'Spezialitäten' }
];