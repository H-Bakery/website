import React from 'react'
import { Recipe } from '@bakery/shared/types'

export interface RecipeListProps {
  recipes: Recipe[]
  onSelectRecipe: (recipe: Recipe) => void
  onEditRecipe: (recipe: Recipe) => void
}

// Placeholder component - actual implementation will be migrated later
const RecipeList: React.FC<RecipeListProps> = ({
  recipes,
  onSelectRecipe,
  onEditRecipe,
}) => {
  if (recipes.length === 0) {
    return (
      <div>
        <p>No recipes found.</p>
        <p>Try adding a new recipe to get started!</p>
      </div>
    )
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Recipe Name</th>
          <th>Category</th>
          <th>Prep Time</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {recipes.map((recipe) => (
          <tr key={recipe.id}>
            <td>{recipe.name}</td>
            <td>{recipe.category}</td>
            <td>{recipe.prepTime}</td>
            <td>
              <button onClick={() => onSelectRecipe(recipe)}>View</button>
              <button onClick={() => onEditRecipe(recipe)}>Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default RecipeList
