import React from 'react'
import NewRecipeClient from './NewRecipeClient'
import {
  recipeFiltersFromQuery,
  type RecipeQuery,
} from '../../../../lib/recipeQuery'

/**
 * Neues Rezept - nur Inhaber und Backstubenleitung (`ROLE_ACCESS`,
 * `RECIPE_WRITE_PATHS`; die API verlangt dasselbe bei `POST /api/recipes`).
 */
export default async function NeuesRezeptPage({
  searchParams,
}: {
  searchParams: Promise<RecipeQuery>
}) {
  return (
    <NewRecipeClient
      initialCategory={recipeFiltersFromQuery(await searchParams).category}
    />
  )
}
