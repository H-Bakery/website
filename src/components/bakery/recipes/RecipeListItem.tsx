import React from 'react'
import { Recipe } from '../../../services/types' // Adjust import path if necessary

interface RecipeListItemProps {
  recipe: Recipe
  onClick: () => void
}

const RecipeListItem: React.FC<RecipeListItemProps> = ({ recipe, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        marginBottom: '10px',
        padding: '10px',
        border: '1px solid #ccc',
      }}
    >
      <h3>{recipe.name}</h3>
      <p>{recipe.category}</p>
    </div>
  )
}

export default RecipeListItem
