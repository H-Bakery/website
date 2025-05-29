import React from 'react'
import { Recipe } from '../../../services/types' // Adjust import path if necessary

interface RecipeListItemProps {
  recipe: Recipe
  onClick: () => void
}

const RecipeListItem: React.FC<RecipeListItemProps> = ({ recipe, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        cursor: 'pointer',
        marginBottom: '10px',
        padding: '10px',
        border: '1px solid #ccc',
        background: 'none',
        borderRadius: '4px',
        textAlign: 'left',
      }}
    >
      <h3>{recipe.name}</h3>
      <p>{recipe.category}</p>
    </button>
  )
}

export default RecipeListItem
