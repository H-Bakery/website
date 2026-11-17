import React from 'react'
import { Box, ButtonBase, Grid, Typography } from '@mui/material'
import Brot from '../icons/products/Brot'
import Broetchen from '../icons/products/Broetchen'
import Teilchen from '../icons/products/Teilchen'
import Kuchen from '../icons/products/Kuchen'
import Torten from '../icons/products/Torten'
import GridViewIcon from '@mui/icons-material/GridView'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import LunchDiningIcon from '@mui/icons-material/LunchDining'

/** Die Kachel, die keine Kategorie auswählt. */
export const ALL_CATEGORIES = 'Alle'

/** Kategorie-Kacheln; `label` ist die Kategorie, wie sie am Produkt steht. */
export const FILTERS = [
  { label: ALL_CATEGORIES, icon: <GridViewIcon /> },
  { label: 'Brot', icon: <Brot /> },
  { label: 'Baguette', icon: <BakeryDiningIcon /> },
  { label: 'Brötchen', icon: <Broetchen /> },
  { label: 'Teilchen', icon: <Teilchen /> },
  { label: 'Snacks', icon: <LunchDiningIcon /> },
  { label: 'Kuchen', icon: <Kuchen /> },
  { label: 'Torten', icon: <Torten /> },
]

interface Props {
  /** Die gewählte Kategorie (`ALL_CATEGORIES` = alle). */
  value: string
  onChange: (category: string) => void
}

/**
 * Kategorie-Auswahl des Sortiments: echte Umschalt-Buttons (`aria-pressed`)
 * in einer Gruppe „Kategorie“ - per Tab erreichbar, mit Enter/Leertaste
 * auslösbar. Den Zustand hält die Produktliste, die damit Kategorie und
 * Suche zusammen kennt.
 */
const Filter: React.FC<Props> = ({ value, onChange }) => (
  <Box role="group" aria-label="Kategorie" sx={styles.root}>
    <Grid container spacing={2}>
      {FILTERS.map((item) => {
        const active = item.label === value
        return (
          <Grid key={item.label} item xs={4} sm={3} md={1.5}>
            <ButtonBase
              aria-pressed={active}
              onClick={() => onChange(item.label)}
              className={active ? 'active' : undefined}
              sx={styles.item}
            >
              <Box component="span" aria-hidden="true" sx={styles.icon}>
                {item.icon}
              </Box>
              <Typography component="span" sx={styles.label}>
                {item.label}
              </Typography>
            </ButtonBase>
          </Grid>
        )
      })}
    </Grid>
  </Box>
)

const styles = {
  root: {
    mb: 4,
  },
  item: {
    width: '100%',
    height: '100%',
    borderRadius: '8px',
    boxShadow: 1,
    px: 1,
    py: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    bgcolor: 'background.default',
    color: 'text.primary',
    transition: 'all ease-in-out 200ms',

    '&:hover': {
      bgcolor: 'action.hover',
      transform: 'translateY(-2px)',
    },

    '&.Mui-focusVisible': {
      outline: '3px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px',
    },

    '&.active': {
      bgcolor: 'primary.main',
      color: 'primary.contrastText',
      fontWeight: 'bold',
    },

    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': { transform: 'none' },
    },
  },
  // Feste Symbolbox: die eigenen Symbole sind 16px, die MUI-Symbole 24px -
  // ohne festen Rahmen wären die Kacheln unterschiedlich hoch.
  icon: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': {
      width: 24,
      height: 24,
    },
  },
  label: {
    fontSize: '1rem',
    lineHeight: 1.4,
    fontWeight: 'inherit',
    color: 'inherit',
  },
}

export default Filter
