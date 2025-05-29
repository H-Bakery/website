import React, { useState } from 'react'
import {
  Recipe as RecipeType,
  Review as ReviewType,
  Ingredient,
} from '../../../services/types'
import ReviewListItem from '../reviews/ReviewListItem' // Path confirmed
import ReviewForm from '../reviews/ReviewForm' // Path confirmed
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Rating, // For displaying rating
  Chip,
  Avatar,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu' // For ingredients
import NotesIcon from '@mui/icons-material/Notes' // For instructions
import CategoryIcon from '@mui/icons-material/Category'
import TimerIcon from '@mui/icons-material/Timer'
import PeopleIcon from '@mui/icons-material/People'
import CakeIcon from '@mui/icons-material/Cake' // Placeholder for image

interface RecipeDetailViewProps {
  recipe: RecipeType
  onBack: () => void
  onAddReview: (
    reviewData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>
  ) => void
  onUpdateReview: (reviewData: ReviewType) => void
  onDeleteReview: (reviewId: string) => void
  onEditRequest: (recipe: RecipeType) => void // Changed from onUpdateRecipe
  onDeleteRecipe: (recipeId: string) => void
}

const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  onBack,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
  onEditRequest,
  onDeleteRecipe,
}) => {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editingReview, setEditingReview] = useState<ReviewType | undefined>(
    undefined
  )
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)

  const handleEditReviewClick = (review: ReviewType) => {
    setEditingReview(review)
    setShowReviewForm(true)
  }

  const handleSaveReview = (
    reviewFormData: Omit<ReviewType, 'id' | 'recipeId' | 'date'>
  ) => {
    if (editingReview) {
      onUpdateReview({
        ...editingReview,
        ...reviewFormData,
        rating: Number(reviewFormData.rating),
      })
    } else {
      onAddReview({ ...reviewFormData, rating: Number(reviewFormData.rating) })
    }
    setShowReviewForm(false)
    setEditingReview(undefined)
  }

  const handleCancelReviewForm = () => {
    setShowReviewForm(false)
    setEditingReview(undefined)
  }

  const handleDeleteRecipeClick = () => {
    setOpenDeleteDialog(true)
  }

  const handleDeleteRecipeConfirm = () => {
    onDeleteRecipe(recipe.id)
    setOpenDeleteDialog(false)
    // onBack() // Optionally go back to list after delete
  }

  const handleDeleteDialogClose = () => {
    setOpenDeleteDialog(false)
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3, md: 4 }, mt: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
          >
            Back to List
          </Button>
          <Box>
            <IconButton
              aria-label="edit recipe"
              color="primary"
              onClick={() => onEditRequest(recipe)}
              sx={{ mr: 1 }}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              aria-label="delete recipe"
              color="error"
              onClick={handleDeleteRecipeClick}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={recipe.image ? 7 : 12}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 'bold' }}
            >
              {recipe.name}
            </Typography>
            <Chip
              icon={<CategoryIcon />}
              label={recipe.category || 'Uncategorized'}
              sx={{ mb: 1, mr: 1 }}
            />
            <Chip
              icon={<TimerIcon />}
              label={`Prep: ${recipe.prepTime || 'N/A'}`}
              sx={{ mb: 1, mr: 1 }}
            />
            {recipe.cookTime && (
              <Chip
                icon={<TimerIcon />}
                label={`Cook: ${recipe.cookTime}`}
                sx={{ mb: 1, mr: 1 }}
              />
            )}
            {recipe.servings && (
              <Chip
                icon={<PeopleIcon />}
                label={`Serves: ${recipe.servings}`}
                sx={{ mb: 1 }}
              />
            )}

            <Typography
              variant="body1"
              paragraph
              sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}
            >
              {recipe.description || 'No description available.'}
            </Typography>
          </Grid>

          {recipe.image && (
            <Grid
              item
              xs={12}
              md={5}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {/* Replace with actual image rendering */}
              <Avatar
                sx={{ width: 150, height: 150, bgcolor: 'primary.light' }}
                variant="rounded"
              >
                <CakeIcon sx={{ fontSize: 80 }} />
              </Avatar>
              {/* <img src={recipe.image} alt={recipe.name} style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'cover' }} /> */}
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h5" component="h2" gutterBottom>
              Ingredients
            </Typography>
            <List dense>
              {recipe.ingredients.map(
                (ing: { name: string; quantity: string }, index: number) => (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon sx={{ minWidth: '30px' }}>
                      <RestaurantMenuIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={`${ing.quantity} ${ing.name}`} />
                  </ListItem>
                )
              )}
            </List>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="h5" component="h2" gutterBottom>
              Instructions
            </Typography>
            <List dense>
              {recipe.instructions.map((step: string, index: number) => (
                <ListItem
                  key={index}
                  disablePadding
                  sx={{ alignItems: 'flex-start' }}
                >
                  <ListItemIcon sx={{ minWidth: '30px', mt: '5px' }}>
                    <NotesIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={`${index + 1}. ${step}`} />
                </ListItem>
              ))}
            </List>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Reviews
          </Typography>
          {recipe.reviews && recipe.reviews.length > 0 ? (
            recipe.reviews.map((review) => (
              <Paper
                key={review.id}
                elevation={1}
                sx={{ p: 2, mb: 2, backgroundColor: 'background.default' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    component="span"
                    sx={{ fontWeight: 'bold' }}
                  >
                    {review.author}
                  </Typography>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleEditReviewClick(review)}
                      aria-label="edit review"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onDeleteReview(review.id)}
                      aria-label="delete review"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Rating
                  name={`rating-${review.id}`}
                  value={review.rating}
                  readOnly
                  size="small"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  ({new Date(review.date).toLocaleDateString()})
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {review.comment}
                </Typography>
              </Paper>
            ))
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: 'italic' }}
            >
              No reviews yet.
            </Typography>
          )}

          {showReviewForm ? (
            <Box
              sx={{
                mt: 2,
                p: 2,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                {editingReview ? 'Edit Your Review' : 'Add Your Review'}
              </Typography>
              <ReviewForm
                recipeId={recipe.id}
                initialData={editingReview}
                onSubmit={handleSaveReview}
                onCancel={handleCancelReviewForm}
              />
            </Box>
          ) : (
            <Button
              variant="outlined"
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
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleDeleteDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete the recipe &quot;{recipe.name}
            &quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteDialogClose}
            color="primary"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteRecipeConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default RecipeDetailView
