/**
 * Recipe-related types shared between frontend and backend
 */

import { BaseEntity } from './common'

export interface Ingredient {
  name: string
  quantity: string
  unit?: string
  notes?: string
}

export interface Recipe extends BaseEntity {
  name: string
  slug: string
  description?: string
  ingredients: Ingredient[]
  instructions: string
  instructionsHtml?: string
  category: string
  prepTime?: string
  cookTime?: string
  servings?: number
  image?: string
}

export interface RecipeFormData {
  name: string
  description: string
  category: string
  prepTime: string
  ingredients: Ingredient[]
  instructions: string
}

export interface CreateRecipeInput {
  name: string
  description?: string
  ingredients: Ingredient[]
  instructions: string | string[]
  category: string
  prepTime?: string
  cookTime?: string
  servings?: number
  image?: string
}

export interface UpdateRecipeInput {
  name?: string
  description?: string
  ingredients?: Ingredient[]
  instructions?: string | string[]
  category?: string
  prepTime?: string
  cookTime?: string
  servings?: number
  image?: string
}
