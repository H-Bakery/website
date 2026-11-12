import React from 'react'
import RecipeDetailClient from './RecipeDetailClient'
import {
  recipeSavedFlashFromQuery,
  type RecipeQuery,
} from '../../../../../lib/recipeQuery'

/**
 * Ein Rezept zum Lesen und Drucken. Die Kennung `<kategorie>/<kennung>`
 * kommt aus `GET /api/recipes`; der Client lädt das Rezept zur Laufzeit.
 */
export default async function RezeptPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; slug: string }>
  searchParams: Promise<RecipeQuery>
}) {
  const { category, slug } = await params
  return (
    <RecipeDetailClient
      category={category}
      slug={slug}
      flash={recipeSavedFlashFromQuery(await searchParams)}
    />
  )
}
