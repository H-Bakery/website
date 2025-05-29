import React, { useState } from 'react'
import {
  Recipe as RecipeType,
  Review as ReviewType,
} from '../../../services/types' // Adjust import path if necessary
import ReviewListItem from '../reviews/ReviewListItem'
import ReviewForm from '../reviews/ReviewForm'
import { Button, Typography, Box } from '@mui/material' // Example using Material UI

interface RecipeDetailViewProps {
  recipe: RecipeType
  onBack: () => void
  onAddReview: (
    reviewData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>
  ) => void
  onUpdateReview: (reviewData: ReviewType) => void
  onDeleteReview: (reviewId: string) => void
  onUpdateRecipe: (recipe: RecipeType) => void // For editing recipe details
  onDeleteRecipe: (recipeId: string) => void // For deleting the current recipe
}

const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  onBack,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
  onUpdateRecipe,
  onDeleteRecipe,
}) => {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editingReview, setEditingReview] = useState<ReviewType | undefined>(
    undefined
  )

  const handleEditReviewClick = (review: ReviewType) => {
    setEditingReview(review)
    setShowReviewForm(true)
  }

  const handleSaveReview = (
    reviewFormData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>
  ) => {
    if (editingReview) {
      // Ensure rating is a number before calling onUpdateReview
      onUpdateReview({
        ...editingReview,
        ...reviewFormData,
        rating: Number(reviewFormData.rating),
      })
    } else {
      // Ensure rating is a number before calling onAddReview
      onAddReview({ ...reviewFormData, rating: Number(reviewFormData.rating) })
    }
    setShowReviewForm(false)
    setEditingReview(undefined)
  }

  const handleCancelReviewForm = () => {
    setShowReviewForm(false)
    setEditingReview(undefined)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button variant="outlined" onClick={onBack} sx={{ mb: 2 }}>
        Back to List
      </Button>
      {/*
        Placeholder buttons for Edit/Delete Recipe.
        These would typically trigger a separate form or confirmation modal.
      */}
      {/*
      <Button variant="contained" onClick={() => onUpdateRecipe(recipe)} sx={{ mr: 1, mb: 2 }}>Edit Recipe</Button>
      <Button variant="contained" color="error" onClick={() => onDeleteRecipe(recipe.id)} sx={{ mb: 2 }}>Delete Recipe</Button>
      */}

      <Typography variant="h5" component="h2" gutterBottom>
        {recipe.name}
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {recipe.category}
      </Typography>
      <Typography variant="body2" paragraph>
        {recipe.description || 'No description available.'}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">
          <strong>Prep Time:</strong> {recipe.prepTime || 'N/A'}
        </Typography>
        <Typography variant="subtitle1">
          <strong>Cook Time:</strong> {recipe.cookTime || 'N/A'}
        </Typography>
        <Typography variant="subtitle1">
          <strong>Servings:</strong> {recipe.servings || 'N/A'}
        </Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6">Ingredients</Typography>
        <ul>
          {recipe.ingredients.map((ing, index) => (
            <li key={index}>
              <Typography variant="body2">
                {ing.quantity} {ing.name}
              </Typography>
            </li>
          ))}
        </ul>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6">Instructions</Typography>
        <ol>
          {recipe.instructions.map((step, index) => (
            <li key={index}>
              <Typography variant="body2">{step}</Typography>
            </li>
          ))}
        </ol>
      </Box>

      {recipe.image && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Image</Typography>
          {/* In a real app, you'd use an <img> tag with proper styling */}
          <Typography variant="body2">
            Image placeholder: {recipe.image}
          </Typography>
          {/* <img src={recipe.image} alt={recipe.name} style={{ maxWidth: '100%', height: 'auto', marginTop: '10px' }} /> */}
        </Box>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Reviews
        </Typography>
        {(recipe.reviews || []).length === 0 && (
          <Typography variant="body2">No reviews yet.</Typography>
        )}
        {(recipe.reviews || []).map((review) => (
          <ReviewListItem
            key={review.id}
            review={review}
            onEdit={() => handleEditReviewClick(review)}
            onDelete={() => onDeleteReview(review.id)}
          />
        ))}

        {showReviewForm ? (
          <Box sx={{ mt: 2 }}>
            <ReviewForm
              recipeId={recipe.id}
              initialData={editingReview}
              onSubmit={handleSaveReview}
              onCancel={handleCancelReviewForm}
            />
          </Box>
        ) : (
          <Button
            variant="contained"
            onClick={() => {
              setEditingReview(undefined)
              setShowReviewForm(true)
            }}
            sx={{ mt: 2 }}
          >
            Add Review
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default RecipeDetailView
