import React from 'react'
import { Recipe, RecipeFormData } from '@bakery/shared/types'

export interface RecipeFormProps {
  recipe?: Recipe
  onSubmit: (data: RecipeFormData) => void
  onCancel: () => void
}

// Placeholder component - actual implementation will be migrated later
const RecipeForm: React.FC<RecipeFormProps> = ({
  recipe,
  onSubmit,
  onCancel,
}) => {
  return (
    <div>
      <h1>{recipe ? `Edit Recipe: ${recipe.name}` : 'Add New Recipe'}</h1>
      <form>
        <label htmlFor="recipe-name">Recipe Name</label>
        <input id="recipe-name" />

        <label htmlFor="category">Category</label>
        <input id="category" />

        <label htmlFor="prep-time">Preparation Time</label>
        <input id="prep-time" defaultValue="30 mins" />

        <label htmlFor="description">Description</label>
        <textarea id="description" />

        <label htmlFor="ingredient-name">Ingredient Name</label>
        <input id="ingredient-name" />

        <label htmlFor="quantity">Quantity</label>
        <input id="quantity" />

        <button type="button">Add Ingredient</button>

        <label htmlFor="instructions">Instructions</label>
        <textarea id="instructions" />

        <button type="submit">{recipe ? 'Update Recipe' : 'Add Recipe'}</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  )
}

export default RecipeForm
