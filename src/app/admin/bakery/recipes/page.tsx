'use client' // Required for using client-side features like useState

import React, { useState } from 'react'
import { Container, Typography, Button, Box } from '@mui/material' // Or other UI library
import {
  Recipe as RecipeType,
  Review as ReviewType,
} from '../../../../services/types'
import { mockRecipes as initialMockRecipes } from '../../../../mocks/recipes' // Assuming reviews are embedded
import RecipeListItem from '../../../../components/bakery/recipes/RecipeListItem'
import RecipeDetailView from '../../../../components/bakery/recipes/RecipeDetailView'
// Potentially a RecipeForm component here as well for adding/editing recipes

export default function RecipeManagementPage() {
  const [recipes, setRecipes] = useState<RecipeType[]>(initialMockRecipes)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeType | null>(null)
  // Add state for showing a recipe creation/edit form if not part of RecipeDetailView
  // const [showRecipeForm, setShowRecipeForm] = useState(false);
  // const [editingRecipe, setEditingRecipe] = useState<RecipeType | null>(null);

  const handleSelectRecipe = (recipe: RecipeType) => {
    setSelectedRecipe(recipe)
  }

  const handleBackToList = () => {
    setSelectedRecipe(null)
  }

  // --- Recipe CRUD Placeholder Functions ---
  const handleAddRecipe = (
    newRecipeData: Omit<RecipeType, 'id' | 'reviews'>
  ) => {
    const newRecipe: RecipeType = {
      ...newRecipeData,
      id: `recipe${Date.now()}`,
      reviews: [],
    }
    setRecipes((prev) => [...prev, newRecipe])
    // Potentially close a form: setShowRecipeForm(false); setEditingRecipe(null);
  }

  const handleUpdateRecipe = (updatedRecipe: RecipeType) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === updatedRecipe.id ? updatedRecipe : r))
    )
    setSelectedRecipe(updatedRecipe) // Keep viewing the updated recipe
    // Potentially close a form: setShowRecipeForm(false); setEditingRecipe(null);
  }

  const handleDeleteRecipe = (recipeId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId))
    setSelectedRecipe(null) // Go back to list
  }

  // --- Review CRUD Placeholder Functions (to be passed to RecipeDetailView) ---
  // These will operate on the 'selectedRecipe' and then update the main 'recipes' list
  const handleAddReviewToRecipe = (
    recipeId: string,
    reviewData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>
  ) => {
    const newReview: ReviewType = {
      ...reviewData,
      id: `rev${Date.now()}`,
      recipeId: recipeId,
      date: new Date().toISOString(),
    }
    let updatedSelectedRecipe: RecipeType | null = null
    setRecipes((prevRecipes) =>
      prevRecipes.map((recipe) => {
        if (recipe.id === recipeId) {
          const updatedReviews = [...(recipe.reviews || []), newReview]
          updatedSelectedRecipe = { ...recipe, reviews: updatedReviews }
          return updatedSelectedRecipe
        }
        return recipe
      })
    )
    if (updatedSelectedRecipe) {
      setSelectedRecipe(updatedSelectedRecipe) // Update the view separately
    }
  }

  const handleUpdateReviewInRecipe = (
    recipeId: string,
    updatedReview: ReviewType
  ) => {
    let updatedSelectedRecipe: RecipeType | null = null
    setRecipes((prevRecipes) =>
      prevRecipes.map((recipe) => {
        if (recipe.id === recipeId) {
          const updatedReviews = (recipe.reviews || []).map((r) =>
            r.id === updatedReview.id ? updatedReview : r
          )
          updatedSelectedRecipe = { ...recipe, reviews: updatedReviews }
          return updatedSelectedRecipe
        }
        return recipe
      })
    )
    if (updatedSelectedRecipe) {
      setSelectedRecipe(updatedSelectedRecipe) // Update the view separately
    }
  }

  const handleDeleteReviewFromRecipe = (recipeId: string, reviewId: string) => {
    setRecipes((prevRecipes) =>
      prevRecipes.map((recipe) => {
        if (recipe.id === recipeId) {
          const updatedReviews = (recipe.reviews || []).filter(
            (r) => r.id !== reviewId
          )
          const updatedSelectedRecipe = { ...recipe, reviews: updatedReviews }
          setSelectedRecipe(updatedSelectedRecipe) // Update the view immediately
          return updatedSelectedRecipe
        }
        return recipe
      })
    )
  }

  if (selectedRecipe) {
    return (
      <RecipeDetailView
        recipe={selectedRecipe}
        onBack={handleBackToList}
        onAddReview={(reviewData) =>
          handleAddReviewToRecipe(selectedRecipe.id, reviewData)
        }
        onUpdateReview={(reviewData) =>
          handleUpdateReviewInRecipe(selectedRecipe.id, reviewData)
        }
        onDeleteReview={(reviewId) =>
          handleDeleteReviewFromRecipe(selectedRecipe.id, reviewId)
        }
        // Pass handlers for editing/deleting the recipe itself if those buttons are in RecipeDetailView
        onUpdateRecipe={handleUpdateRecipe} // Assuming RecipeDetailView might have an "Edit Recipe" button
        onDeleteRecipe={handleDeleteRecipe} // Assuming RecipeDetailView might have a "Delete Recipe" button
      />
    )
  }

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom>
        Recipe Management
      </Typography>
      {/* Button to trigger adding a new recipe - will need a form */}
      {/* <Button variant="contained" onClick={() => { setEditingRecipe(null); setShowRecipeForm(true); }}>Add New Recipe</Button> */}
      {/* Render RecipeForm here if showRecipeForm is true */}

      <Box marginTop={2}>
        {recipes.map((recipe) => (
          <RecipeListItem
            key={recipe.id}
            recipe={recipe}
            onClick={() => handleSelectRecipe(recipe)}
          />
        ))}
      </Box>
    </Container>
  )
}
