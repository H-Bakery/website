import React, { useState, useEffect } from 'react'
import { Recipe, Ingredient } from '@/types/recipe'
import { Button, TextField, Paper, Typography, Grid, Box, IconButton } from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'

interface RecipeFormProps {
  recipe?: Recipe | null
  // The onSubmit prop already expects 'category' and 'prepTime' correctly
  onSubmit: (recipe: Omit<Recipe, 'id' | 'reviews'> & { category: string; prepTime: string }) => void
  onCancel: () => void
}

const RecipeForm: React.FC<RecipeFormProps> = ({ recipe, onSubmit, onCancel }) => {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('') // New state for category
  const [description, setDescription] = useState('') // For actual recipe description
  const [prepTime, setPrepTime] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '' }])
  const [instructions, setInstructions] = useState('')
  // cookTime and servings are also in RecipeType, could be added similarly if needed
  // const [cookTime, setCookTime] = useState('')
  // const [servings, setServings] = useState<number | string>('')


  useEffect(() => {
    if (recipe) {
      setName(recipe.name)
      setCategory(recipe.category || '') // Use recipe.category
      setDescription(recipe.description || '') // Use recipe.description
      setPrepTime(recipe.prepTime || '30 mins') // Use recipe.prepTime
      setIngredients(recipe.ingredients.length ? recipe.ingredients : [{ name: '', quantity: '' }])
      setInstructions(recipe.instructions.join('\n')) // Join for textarea, assuming instructions is string[]
      // setCookTime(recipe.cookTime || 'N/A')
      // setServings(recipe.servings || 'N/A')
    } else {
      setName('')
      setCategory('')
      setDescription('')
      setPrepTime('30 mins')
      setIngredients([{ name: '', quantity: '' }])
      setInstructions('')
      // setCookTime('')
      // setServings('')
    }
  }, [recipe])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      category, // Use category state
      description, // Use description state
      prepTime,
      ingredients,
      instructions: instructions.split('\n'), // Split back into array
      // cookTime,
      // servings: Number(servings) || undefined,
    })
  }

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = ingredients.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    )
    setIngredients(newIngredients)
  }

  const addIngredientField = () => {
    setIngredients([...ingredients, { name: '', quantity: '' }])
  }

  const removeIngredientField = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index))
    }
  }

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mt: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
        {recipe ? `Edit Recipe: ${recipe.name}` : 'Add New Recipe'}
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Recipe Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Category"
              value={category} // Bind to category state
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              required
              variant="outlined"
              helperText="e.g., Cakes, Breads, Pastries"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Preparation Time"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              fullWidth
              variant="outlined"
              helperText="e.g., 30 minutes, 1 hour"
            />
          </Grid>
          {/* Optional: Add Cook Time and Servings similarly if needed
          <Grid item xs={12} sm={6}>
            <TextField
              label="Cook Time"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Grid>
          */}
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={description} // Bind to description state
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              helperText="A brief summary of the recipe"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" component="h3" gutterBottom sx={{ mt: 2 }}>
              Ingredients
            </Typography>
            {ingredients.map((ingredient, index) => (
              <Grid container spacing={2} key={index} alignItems="center" sx={{ mb: 1 }}>
                <Grid item xs={5}>
                  <TextField
                    label="Ingredient Name"
                    value={ingredient.name}
                    onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={5}>
                  <TextField
                    label="Quantity"
                    value={ingredient.quantity}
                    onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton onClick={() => removeIngredientField(index)} color="error" disabled={ingredients.length === 1}>
                    <RemoveCircleOutlineIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddCircleOutlineIcon />}
              onClick={addIngredientField}
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Add Ingredient
            </Button>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Instructions"
              value={instructions} // Instructions are now a single string with newlines
              onChange={(e) => setInstructions(e.target.value)}
              fullWidth
              required
              multiline
              rows={6} // Increased rows for better UX
              variant="outlined"
              sx={{ mt: 2 }}
              helperText="Enter each step on a new line"
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button onClick={onCancel} sx={{ mr: 2 }} variant="outlined" color="secondary">
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary">
                {recipe ? 'Update Recipe' : 'Add Recipe'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  )
}

export default RecipeForm
