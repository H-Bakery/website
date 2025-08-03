/**
 * Service types for the bakery landing page
 */

export interface Ingredient {
  name: string
  quantity: string
}

export interface Recipe {
  id: string
  name?: string
  title?: string
  slug?: string
  category: string
  difficulty?: 'easy' | 'medium' | 'hard'
  prepTime: number | string
  cookTime: number | string
  servings: number | string
  ingredients: Ingredient[]
  instructions: string[] | string
  image?: string
  description?: string
  reviews?: Review[]
}

export interface Review {
  id: string
  recipeId: string
  author: string
  rating: number
  comment: string
  date: string
}