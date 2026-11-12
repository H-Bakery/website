import React from 'react'
import RecipeEditClient from './RecipeEditClient'

/**
 * Rezept ändern - nur Inhaber und Backstubenleitung (`ROLE_ACCESS`,
 * `RECIPE_WRITE_PATHS`; die API verlangt dasselbe bei `PUT /api/recipes/…`).
 */
export default async function RezeptBearbeitenPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  return <RecipeEditClient category={category} slug={slug} />
}
