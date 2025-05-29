'use client'

import React, { useState } from 'react'
import { Container, Button, Typography, Box, Paper } from '@mui/material'
import { Recipe as RecipeType, Review as ReviewType } from '../../../../services/types' // Added ReviewType for handlers
import { mockRecipes as initialMockRecipes } from '../../../../mocks/recipes'
import RecipeList from '../../../../components/bakery/recipes/RecipeList'
import RecipeForm from '../../../../components/bakery/recipes/RecipeForm'
import RecipeDetailView from '../../../../components/bakery/recipes/RecipeDetailView' // Import RecipeDetailView
import AddIcon from '@mui/icons-material/Add'

export default function RecipeManagementPage() {
  const [recipes, setRecipes] = useState<RecipeType[]>(initialMockRecipes)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeType | null>(null)
  const [viewingRecipe, setViewingRecipe] = useState<RecipeType | null>(null) // State for viewing recipe

  // --- Form Submission Handlers ---
  const handleAddRecipeSubmit = (
    // RecipeForm submits 'category' and 'description' distinctly now
    newRecipeData: Omit<RecipeType, 'id' | 'reviews' | 'instructions'> & { instructions: string[] } // instructions as string[]
  ) => {
    const newRecipe: RecipeType = {
      ...newRecipeData, // name, category, description, prepTime, ingredients
      id: `recipe${Date.now()}`,
      instructions: newRecipeData.instructions, // Ensure instructions are string[]
      reviews: [],
      // cookTime and servings can be added if they are part of newRecipeData
    }
    setRecipes((prev) => [...prev, newRecipe])
    setShowRecipeForm(false)
    setEditingRecipe(null)
  }

  const handleUpdateRecipeSubmit = (
    updatedRecipeData: Omit<RecipeType, 'id' | 'reviews' | 'instructions'> & { instructions: string[] }
  ) => {
    if (!editingRecipe) return

    const updatedRecipe: RecipeType = {
      ...editingRecipe, // Retain original ID, reviews, etc.
      ...updatedRecipeData, // Apply new data: name, category, description, prepTime, ingredients
      instructions: updatedRecipeData.instructions, // Ensure instructions are string[]
    }
    
    setRecipes((prev) =>
      prev.map((r) => (r.id === updatedRecipe.id ? updatedRecipe : r))
    )
    setShowRecipeForm(false)
    setEditingRecipe(null)
  }

  // --- Recipe Action Handlers ---
  const handleDeleteRecipe = (recipeId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId))
    if (editingRecipe && editingRecipe.id === recipeId) {
      setEditingRecipe(null)
      setShowRecipeForm(false)
    }
    if (viewingRecipe && viewingRecipe.id === recipeId) {
      setViewingRecipe(null) // Stop viewing if deleted
    }
    // No need to call onBack from RecipeDetailView if it's already handled by setViewingRecipe(null)
  }

  const handleEditRecipeRequest = (recipe: RecipeType) => {
    setViewingRecipe(null) // Close detail view if open
    setEditingRecipe(recipe)
    setShowRecipeForm(true)
  }
  
  const handleSelectRecipeForViewing = (recipe: RecipeType) => {
    setShowRecipeForm(false) // Close form if open
    setEditingRecipe(null)
    setViewingRecipe(recipe)
  }

  const handleCancelForm = () => {
    setShowRecipeForm(false)
    setEditingRecipe(null)
  }

  const handleBackToListFromDetailView = () => {
    setViewingRecipe(null)
  }

  // --- Review Handlers (to be passed to RecipeDetailView) ---
  // These are simplified placeholders. A real app might involve API calls.
  const handleAddReview = (recipeId: string, reviewData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>) => {
    const newReview: ReviewType = {
      ...reviewData,
      id: `rev${Date.now()}`,
      recipeId: recipeId,
      date: new Date().toISOString(),
    }
    setRecipes(prevRecipes => prevRecipes.map(recipe => {
      if (recipe.id === recipeId) {
        const updatedReviews = [...(recipe.reviews || []), newReview]
        const updatedRecipe = { ...recipe, reviews: updatedReviews }
        if (viewingRecipe && viewingRecipe.id === recipeId) {
          setViewingRecipe(updatedRecipe) // Update viewing recipe with new review
        }
        return updatedRecipe
      }
      return recipe
    }))
  }

  const handleUpdateReview = (recipeId: string, updatedReview: ReviewType) => {
    setRecipes(prevRecipes => prevRecipes.map(recipe => {
      if (recipe.id === recipeId) {
        const updatedReviews = (recipe.reviews || []).map(r => r.id === updatedReview.id ? updatedReview : r)
        const updatedRecipe = { ...recipe, reviews: updatedReviews }
        if (viewingRecipe && viewingRecipe.id === recipeId) {
          setViewingRecipe(updatedRecipe) // Update viewing recipe
        }
        return updatedRecipe
      }
      return recipe
    }))
  }

  const handleDeleteReview = (recipeId: string, reviewId: string) => {
    setRecipes(prevRecipes => prevRecipes.map(recipe => {
      if (recipe.id === recipeId) {
        const updatedReviews = (recipe.reviews || []).filter(r => r.id !== reviewId)
        const updatedRecipe = { ...recipe, reviews: updatedReviews }
        if (viewingRecipe && viewingRecipe.id === recipeId) {
          setViewingRecipe(updatedRecipe) // Update viewing recipe
        }
        return updatedRecipe
      }
      return recipe
    }))
  }

  // --- Render Logic ---
  if (viewingRecipe) {
    return (
      <RecipeDetailView
        recipe={viewingRecipe}
        onBack={handleBackToListFromDetailView}
        onEditRequest={handleEditRecipeRequest}
        onDeleteRecipe={handleDeleteRecipe}
        onAddReview={(reviewData) => handleAddReview(viewingRecipe.id, reviewData)}
        onUpdateReview={(reviewData) => handleUpdateReview(viewingRecipe.id, reviewData)}
        onDeleteReview={(reviewId) => handleDeleteReview(viewingRecipe.id, reviewId)}
      />
    )
  }

  if (showRecipeForm) {
    return (
      <RecipeForm
        recipe={editingRecipe}
        onSubmit={editingRecipe ? handleUpdateRecipeSubmit : handleAddRecipeSubmit}
        onCancel={handleCancelForm}
      />
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, backgroundColor: 'transparent' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, md: 3 } }}>
          <Typography variant="h4" component="h1">
            Recipe Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingRecipe(null) // Clear any recipe being edited
              setViewingRecipe(null) // Clear any recipe being viewed
              setShowRecipeForm(true) // Show the form for adding
            }}
          >
            Add New Recipe
          </Button>
        </Box>
        <RecipeList
          recipes={recipes}
          onSelectRecipe={handleSelectRecipeForViewing} // For viewing details
          onEditRecipe={handleEditRecipeRequest}      // For editing
        />
      </Paper>
    </Container>
  )
}
