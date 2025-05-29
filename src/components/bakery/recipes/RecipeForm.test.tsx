import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import RecipeForm from './RecipeForm'
import { Recipe, Ingredient } from '../../../services/types' // Adjust path

// Mock initial recipe for edit mode
const mockRecipeToEdit: Recipe = {
  id: 'recipe1',
  name: 'Existing Pancakes',
  category: 'Breakfast',
  prepTime: '15 mins',
  description: 'Fluffy pancakes',
  ingredients: [
    { name: 'Flour', quantity: '1 cup' },
    { name: 'Milk', quantity: '1 cup' },
  ],
  instructions: ['Mix ingredients', 'Cook on griddle'],
  reviews: [],
}

describe('RecipeForm Component', () => {
  const mockOnSubmit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
    mockOnCancel.mockClear()
  })

  describe('Add Mode', () => {
    beforeEach(() => {
      render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    })

    test('renders correctly with empty fields', () => {
      expect(screen.getByText('Add New Recipe')).toBeInTheDocument()
      expect(screen.getByLabelText(/recipe name/i)).toHaveValue('')
      expect(screen.getByLabelText(/category/i)).toHaveValue('')
      expect(screen.getByLabelText(/preparation time/i)).toHaveValue('30 mins') // Default value
      expect(screen.getByLabelText(/description/i)).toHaveValue('')
      // Initial ingredient row
      expect(screen.getByLabelText(/ingredient name/i)).toHaveValue('')
      expect(screen.getByLabelText(/quantity/i)).toHaveValue('')
      expect(screen.getByLabelText(/instructions/i)).toHaveValue('')
    })

    test('allows input into fields', () => {
      fireEvent.change(screen.getByLabelText(/recipe name/i), { target: { value: 'New Cake' } })
      expect(screen.getByLabelText(/recipe name/i)).toHaveValue('New Cake')

      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Dessert' } })
      expect(screen.getByLabelText(/category/i)).toHaveValue('Dessert')
      
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A tasty cake' } })
      expect(screen.getByLabelText(/description/i)).toHaveValue('A tasty cake')

      fireEvent.change(screen.getAllByLabelText(/ingredient name/i)[0], { target: { value: 'Sugar' } })
      expect(screen.getAllByLabelText(/ingredient name/i)[0]).toHaveValue('Sugar')

      fireEvent.change(screen.getAllByLabelText(/quantity/i)[0], { target: { value: '1 cup' } })
      expect(screen.getAllByLabelText(/quantity/i)[0]).toHaveValue('1 cup')

      fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Mix well\nBake at 180C' } })
      expect(screen.getByLabelText(/instructions/i)).toHaveValue('Mix well\nBake at 180C')
    })

    test('adds and removes ingredient fields', () => {
      const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i })
      fireEvent.click(addIngredientButton)
      
      expect(screen.getAllByLabelText(/ingredient name/i)).toHaveLength(2)
      expect(screen.getAllByLabelText(/quantity/i)).toHaveLength(2)

      // Change one of the new fields
      fireEvent.change(screen.getAllByLabelText(/ingredient name/i)[1], { target: { value: 'Eggs' } })
      expect(screen.getAllByLabelText(/ingredient name/i)[1]).toHaveValue('Eggs')

      // Find by Tooltip title or a more specific aria-label if available
      // For now, assuming the IconButton wrapping RemoveCircleOutlineIcon gets a generic "remove" label part
      const ingredientRows = screen.getAllByText(/ingredient name/i).map(el => el.closest('.MuiGrid-container')) // Get all ingredient rows
      const lastIngredientRow = ingredientRows[ingredientRows.length -1]
      
      if (!lastIngredientRow) throw new Error("Could not find the last ingredient row")

      const removeButtonInLastRow = within(lastIngredientRow).getByRole('button', {name: /remove/i})
      fireEvent.click(removeButtonInLastRow) // Remove the second ingredient field (the one just added)


      expect(screen.getAllByLabelText(/ingredient name/i)).toHaveLength(1)
    })

    test('submits correct data for a new recipe', () => {
      fireEvent.change(screen.getByLabelText(/recipe name/i), { target: { value: 'Spaghetti Bolognese' } })
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Main Course' } })
      fireEvent.change(screen.getByLabelText(/preparation time/i), { target: { value: '45 mins' } })
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Classic Italian dish' } })
      fireEvent.change(screen.getAllByLabelText(/ingredient name/i)[0], { target: { value: 'Minced Beef' } })
      fireEvent.change(screen.getAllByLabelText(/quantity/i)[0], { target: { value: '500g' } })
      fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Sauté onions\nAdd beef\nSimmer with tomatoes' } })
      
      fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))

      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Spaghetti Bolognese',
        category: 'Main Course',
        prepTime: '45 mins',
        description: 'Classic Italian dish',
        ingredients: [{ name: 'Minced Beef', quantity: '500g' }],
        instructions: ['Sauté onions', 'Add beef', 'Simmer with tomatoes'],
      })
    })
  })

  describe('Edit Mode', () => {
    beforeEach(() => {
      render(<RecipeForm recipe={mockRecipeToEdit} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    })

    test('renders correctly with pre-filled fields', () => {
      expect(screen.getByText(`Edit Recipe: ${mockRecipeToEdit.name}`)).toBeInTheDocument()
      expect(screen.getByLabelText(/recipe name/i)).toHaveValue(mockRecipeToEdit.name)
      expect(screen.getByLabelText(/category/i)).toHaveValue(mockRecipeToEdit.category)
      expect(screen.getByLabelText(/preparation time/i)).toHaveValue(mockRecipeToEdit.prepTime)
      expect(screen.getByLabelText(/description/i)).toHaveValue(mockRecipeToEdit.description)
      
      expect(screen.getAllByLabelText(/ingredient name/i)[0]).toHaveValue(mockRecipeToEdit.ingredients[0].name)
      expect(screen.getAllByLabelText(/quantity/i)[0]).toHaveValue(mockRecipeToEdit.ingredients[0].quantity)
      expect(screen.getAllByLabelText(/ingredient name/i)[1]).toHaveValue(mockRecipeToEdit.ingredients[1].name)
      expect(screen.getAllByLabelText(/quantity/i)[1]).toHaveValue(mockRecipeToEdit.ingredients[1].quantity)
      
      expect(screen.getByLabelText(/instructions/i)).toHaveValue(mockRecipeToEdit.instructions.join('\n'))
    })

    test('submits correct data for an existing recipe (maintaining ID, etc.)', () => {
      // User changes the category
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Quick Meals' } })
      // User changes one ingredient
      fireEvent.change(screen.getAllByLabelText(/quantity/i)[0], { target: { value: '1.5 cups' } })


      fireEvent.click(screen.getByRole('button', { name: /update recipe/i }))
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      
      // The component itself doesn't add 'id' or 'reviews', that's handled by the parent page
      // The onSubmit prop for RecipeForm is Omit<Recipe, 'id' | 'reviews'> & { category: string, prepTime: string }
      // So we check that the modified fields and other existing fields are passed up
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: mockRecipeToEdit.name,
        category: 'Quick Meals', // Changed
        prepTime: mockRecipeToEdit.prepTime,
        description: mockRecipeToEdit.description,
        ingredients: [
          { name: 'Flour', quantity: '1.5 cups' }, // Changed
          { name: 'Milk', quantity: '1 cup' },
        ],
        instructions: mockRecipeToEdit.instructions, // Submitted as array
      })
    })
  })

  test('calls onCancel when "Cancel" button is clicked', () => {
    render(<RecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })
})
