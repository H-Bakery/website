import React from 'react'
import { Recipe } from '@/types/recipe'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  Tooltip
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'

interface RecipeListProps {
  recipes: Recipe[]
  onSelectRecipe: (recipe: Recipe) => void // For viewing details
  onEditRecipe: (recipe: Recipe) => void   // For jumping to edit form
  // onDeleteRecipe: (recipeId: string) => void // Placeholder
}

const RecipeList: React.FC<RecipeListProps> = ({ recipes, onSelectRecipe, onEditRecipe }) => {
  if (!recipes.length) {
    return (
      <Paper elevation={1} sx={{ p: 3, textAlign: 'center', mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>No recipes found.</Typography>
        <Typography variant="body2">Try adding a new recipe to get started!</Typography>
      </Paper>
    )
  }

  return (
    <TableContainer component={Paper} elevation={3} sx={{ mt: 2 }}>
      <Table sx={{ minWidth: 650 }} aria-label="recipes table">
        <TableHead sx={{ backgroundColor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Recipe Name</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Prep Time</TableCell>
            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow
              key={recipe.id}
              hover
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {recipe.name}
              </TableCell>
              <TableCell>{recipe.category || 'N/A'}</TableCell>
              <TableCell>{recipe.prepTime || 'N/A'}</TableCell>
              <TableCell align="center">
                <Tooltip title="View Details">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onSelectRecipe(recipe)}
                    sx={{ mr: 1 }}
                    startIcon={<VisibilityIcon />}
                  >
                    View
                  </Button>
                </Tooltip>
                <Tooltip title="Edit Recipe">
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    onClick={() => onEditRecipe(recipe)}
                    startIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                </Tooltip>
                {/* Example for future delete button
                <Tooltip title="Delete Recipe">
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => onDeleteRecipe(recipe.id)} // Assuming onDeleteRecipe prop is added
                    sx={{ ml: 1 }}
                    startIcon={<DeleteIcon />}
                  >
                    Delete
                  </Button>
                </Tooltip>
                */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default RecipeList
