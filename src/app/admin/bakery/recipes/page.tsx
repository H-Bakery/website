'use client'

import React, { useState, useEffect } from 'react'
import { Container, Button, Typography, Box, Paper, CircularProgress, Alert } from '@mui/material'
import { Recipe as RecipeType, Review as ReviewType } from '../../../../services/types' // Added ReviewType for handlers
import RecipeList from '../../../../components/bakery/recipes/RecipeList'
import RecipeForm from '../../../../components/bakery/recipes/RecipeForm'
import RecipeDetailView from '../../../../components/bakery/recipes/RecipeDetailView' // Import RecipeDetailView
import AddIcon from '@mui/icons-material/Add'
import bakeryAPI from '../../../../services/bakeryAPI'

export default function RecipeManagementPage() {
  const [recipes, setRecipes] = useState<RecipeType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeType | null>(null)
  const [viewingRecipe, setViewingRecipe] = useState<RecipeType | null>(null) // State for viewing recipe

  // Fetch recipes on component mount
  useEffect(() => {
    fetchRecipes()
  }, [])

  const fetchRecipes = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedRecipes = await bakeryAPI.getRecipes()
      setRecipes(fetchedRecipes)
    } catch (err) {
      console.error('Error fetching recipes:', err)
      setError('Failed to load recipes. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // --- Form Submission Handlers ---
  const handleAddRecipeSubmit = async (
    // RecipeForm submits 'category' and 'description' distinctly now
    newRecipeData: Omit<RecipeType, 'id' | 'reviews' | 'instructions' | 'slug' | 'instructionsHtml'> & { instructions: string[] } // instructions as string[]
  ) => {
    try {
      setError(null)
      const createdRecipe = await bakeryAPI.createRecipe({
        ...newRecipeData,
        instructions: newRecipeData.instructions as string[],
      })
      
      // Add the new recipe to the list
      setRecipes((prev) => [createdRecipe, ...prev])
      setShowRecipeForm(false)
      setEditingRecipe(null)
    } catch (err) {
      console.error('Error creating recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to create recipe')
    }
  }

  const handleUpdateRecipeSubmit = async (
    updatedRecipeData: Omit<RecipeType, 'id' | 'reviews' | 'instructions' | 'slug' | 'instructionsHtml'> & { instructions: string[] }
  ) => {
    if (!editingRecipe) return

    try {
      setError(null)
      const updatedRecipe = await bakeryAPI.updateRecipe(editingRecipe.slug, {
        ...updatedRecipeData,
        instructions: updatedRecipeData.instructions as string[],
      })
      
      // Update the recipe in the list
      setRecipes((prev) =>
        prev.map((r) => (r.slug === updatedRecipe.slug ? updatedRecipe : r))
      )
      setShowRecipeForm(false)
      setEditingRecipe(null)
    } catch (err) {
      console.error('Error updating recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to update recipe')
    }
  }

  // --- Recipe Action Handlers ---
  const handleDeleteRecipe = async (recipeId: string | number) => {
    try {
      setError(null)
      // Find the recipe to get its slug
      const recipeToDelete = recipes.find(r => r.id === recipeId)
      if (!recipeToDelete) return

      await bakeryAPI.deleteRecipe(recipeToDelete.slug)
      
      // Remove from local state
      setRecipes((prev) => prev.filter((r) => r.id !== recipeId))
      if (editingRecipe && editingRecipe.id === recipeId) {
        setEditingRecipe(null)
        setShowRecipeForm(false)
      }
      if (viewingRecipe && viewingRecipe.id === recipeId) {
        setViewingRecipe(null) // Stop viewing if deleted
      }
    } catch (err) {
      console.error('Error deleting recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete recipe')
    }
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
            disabled={loading}
          >
            Add New Recipe
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <RecipeList
            recipes={recipes}
            onSelectRecipe={handleSelectRecipeForViewing} // For viewing details
            onEditRecipe={handleEditRecipeRequest}      // For editing
          />
        )}
      </Paper>
    </Container>
  )
}
