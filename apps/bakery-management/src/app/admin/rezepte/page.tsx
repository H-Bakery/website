import React from 'react'
import RecipeListClient from './RecipeListClient'
import {
  recipeFiltersFromQuery,
  recipeListFlashFromQuery,
  type RecipeQuery,
} from '../../../lib/recipeQuery'

/**
 * Rezepte aus hq (`docs/domains/rezepte.md`): Liste nach Kategorie mit Suche.
 * Server-Hülle - die Daten lädt der Client über `GET /api/recipes`.
 */
export default async function RezeptePage({
  searchParams,
}: {
  searchParams: Promise<RecipeQuery>
}) {
  const query = await searchParams
  return (
    <RecipeListClient
      initialFilters={recipeFiltersFromQuery(query)}
      flash={recipeListFlashFromQuery(query)}
    />
  )
}
