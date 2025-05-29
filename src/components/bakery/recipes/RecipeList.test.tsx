import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import RecipeList from './RecipeList'
import { Recipe } from '../../../services/types' // Adjust path as necessary

const mockRecipes: Recipe[] = [
  {
    id: 'recipe1',
    name: 'Chocolate Cake',
    category: 'Cakes',
    prepTime: '30 mins',
    description: 'Delicious chocolate cake',
    ingredients: [{ name: 'Flour', quantity: '2 cups' }],
    instructions: ['Mix ingredients', 'Bake'],
    cookTime: '40 mins',
    servings: 8,
    reviews: [],
  },
  {
    id: 'recipe2',
    name: 'Sourdough Bread',
    category: 'Breads',
    prepTime: '3 hours',
    description: 'Crusty sourdough bread',
    ingredients: [{ name: 'Sourdough Starter', quantity: '1 cup' }],
    instructions: ['Feed starter', 'Mix dough'],
    cookTime: '50 mins',
    servings: 12,
    reviews: [],
  },
]

describe('RecipeList Component', () => {
  const mockOnSelectRecipe = jest.fn()
  const mockOnEditRecipe = jest.fn()

  beforeEach(() => {
    // Clear mock call counts before each test
    mockOnSelectRecipe.mockClear()
    mockOnEditRecipe.mockClear()
  })

  test('renders correctly with a list of recipes', () => {
    render(
      <RecipeList
        recipes={mockRecipes}
        onSelectRecipe={mockOnSelectRecipe}
        onEditRecipe={mockOnEditRecipe}
      />
    )

    // Check for table headers
    expect(screen.getByText('Recipe Name')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Prep Time')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()

    // Check for recipe data
    expect(screen.getByText(mockRecipes[0].name)).toBeInTheDocument()
    expect(screen.getByText(mockRecipes[0].category)).toBeInTheDocument()
    expect(screen.getByText(mockRecipes[0].prepTime as string)).toBeInTheDocument()

    expect(screen.getByText(mockRecipes[1].name)).toBeInTheDocument()
    expect(screen.getByText(mockRecipes[1].category)).toBeInTheDocument()
    expect(screen.getByText(mockRecipes[1].prepTime as string)).toBeInTheDocument()
  })

  test('displays a message when the recipe list is empty', () => {
    render(
      <RecipeList
        recipes={[]}
        onSelectRecipe={mockOnSelectRecipe}
        onEditRecipe={mockOnEditRecipe}
      />
    )

    expect(screen.getByText('No recipes found.')).toBeInTheDocument()
    expect(screen.getByText('Try adding a new recipe to get started!')).toBeInTheDocument()
  })

  test('calls onSelectRecipe with the correct recipe when "View" button is clicked', () => {
    render(
      <RecipeList
        recipes={mockRecipes}
        onSelectRecipe={mockOnSelectRecipe}
        onEditRecipe={mockOnEditRecipe}
      />
    )

    const firstRecipeRow = screen.getByText(mockRecipes[0].name).closest('tr')
    if (!firstRecipeRow) throw new Error('Row not found for first recipe')
    const viewButton = within(firstRecipeRow).getByRole('button', { name: /view/i })
    
    fireEvent.click(viewButton)
    expect(mockOnSelectRecipe).toHaveBeenCalledTimes(1)
    expect(mockOnSelectRecipe).toHaveBeenCalledWith(mockRecipes[0])
  })

  test('calls onEditRecipe with the correct recipe when "Edit" button is clicked', () => {
    render(
      <RecipeList
        recipes={mockRecipes}
        onSelectRecipe={mockOnSelectRecipe}
        onEditRecipe={mockOnEditRecipe}
      />
    )
    
    const secondRecipeRow = screen.getByText(mockRecipes[1].name).closest('tr')
    if (!secondRecipeRow) throw new Error('Row not found for second recipe')
    const editButton = within(secondRecipeRow).getByRole('button', { name: /edit/i })

    fireEvent.click(editButton)
    expect(mockOnEditRecipe).toHaveBeenCalledTimes(1)
    expect(mockOnEditRecipe).toHaveBeenCalledWith(mockRecipes[1])
  })
})
