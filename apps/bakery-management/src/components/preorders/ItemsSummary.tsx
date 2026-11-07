import React from 'react'
import { Box, Typography } from '@mui/material'
import {
  formatItems,
  itemName,
  type PreorderItem,
} from '../../lib/preordersTypes'

/**
 * Artikel einer Vorbestellung kurz: die ersten `max` Positionen je eine Zeile,
 * danach „+ 3 weitere Artikel“. Die ganze Liste steht im `title` (Tooltip am
 * PC) und für Screenreader - in der Liste lief die Spalte sonst über 4 bis 7
 * Zeilen je Bestellung, und die Tabelle wurde über 8.000 px hoch.
 */
export default function ItemsSummary({
  items,
  max = 2,
}: {
  items: PreorderItem[]
  max?: number
}) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        keine Artikel
      </Typography>
    )
  }
  const shown = items.length > max + 1 ? items.slice(0, max) : items
  const rest = items.length - shown.length
  const full = formatItems(items)
  return (
    <Box
      component="span"
      title={rest > 0 ? full : undefined}
      data-testid="items-summary"
      sx={{ display: 'block' }}
    >
      {shown.map((item, index) => (
        <Box
          component="span"
          key={`${item.productId}-${item.variant ?? ''}-${index}`}
          sx={{ display: 'block' }}
        >
          <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {item.quantity} ×
          </Box>{' '}
          {itemName(item)}
        </Box>
      ))}
      {rest > 0 && (
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          + {rest} weitere Artikel
        </Typography>
      )}
    </Box>
  )
}
