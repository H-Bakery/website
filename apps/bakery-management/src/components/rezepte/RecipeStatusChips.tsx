'use client'
import React from 'react'
import { Box, Chip } from '@mui/material'
import {
  PENDING_LABELS,
  backzettelUseText,
  type RecipeSummary,
} from '../../lib/recipesApi'

/**
 * Marker eines Rezepts, in Liste und Rezeptansicht gleich:
 *
 * - „wartet auf Freigabe“ (neu / geändert / gelöscht) - die Änderung steht in
 *   der hq-PR und ist noch nicht übernommen,
 * - „Backzettel“ - `config/backzettel.yaml` rechnet mit diesem Rezept,
 * - „nur lesen“ - die Verwaltung ändert diese Datei nicht (Teig-Rezepte,
 *   Dateien, die der Parser nicht verlustfrei schreiben kann). Nur für
 *   Rollen, die sonst ändern dürften (`showReadOnly`).
 *
 * Farbe ist nie der einzige Träger: jeder Marker trägt seinen Text.
 */
export function RecipeStatusChips({
  recipe,
  showReadOnly = false,
}: {
  recipe: Pick<
    RecipeSummary,
    'pending' | 'usedByBackzettel' | 'editable' | 'readOnlyReason'
  >
  showReadOnly?: boolean
}) {
  const used = recipe.usedByBackzettel.length > 0
  const readOnly =
    showReadOnly && !recipe.editable && recipe.pending !== 'deleted'
  if (!recipe.pending && !used && !readOnly) return null
  return (
    <Box
      data-testid="recipe-status"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
    >
      {recipe.pending && (
        <Chip
          size="small"
          variant="outlined"
          color={recipe.pending === 'deleted' ? 'warning' : 'info'}
          label={PENDING_LABELS[recipe.pending]}
          data-testid="recipe-pending"
        />
      )}
      {used && (
        <Chip
          size="small"
          variant="outlined"
          label="Backzettel"
          title={`Der Backzettel verwendet dieses Rezept: ${backzettelUseText(
            recipe.usedByBackzettel
          )}`}
          data-testid="recipe-backzettel"
        />
      )}
      {readOnly && (
        <Chip
          size="small"
          variant="outlined"
          label="nur lesen"
          title={recipe.readOnlyReason ?? undefined}
          data-testid="recipe-readonly"
        />
      )}
    </Box>
  )
}

export default RecipeStatusChips
