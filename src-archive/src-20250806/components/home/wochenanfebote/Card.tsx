import React from 'react'
import { Typography, Box, Paper, Chip, Divider } from '@mui/material'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import CakeIcon from '@mui/icons-material/Cake'

// Export this interface so it can be imported in the index file
export interface SpecialOffer {
  type: 'bread' | 'meal' | 'pastry'
  name: string
  description?: string
  price?: string
}

export interface DailyOffer {
  name: string
  date: string
  specialOffers: SpecialOffer[]
}

const Card: React.FC<DailyOffer> = (props) => {
  const { name, date, specialOffers } = props

  // Get icon based on offer type
  const getIcon = (type: 'bread' | 'meal' | 'pastry') => {
    switch (type) {
      case 'bread':
        return <BakeryDiningIcon fontSize="small" />
      case 'meal':
        return <RestaurantIcon fontSize="small" />
      case 'pastry':
        return <CakeIcon fontSize="small" />
      default:
        return <BakeryDiningIcon fontSize="small" />
    }
  }

  // Get color based on offer type
  const getColor = (type: 'bread' | 'meal' | 'pastry') => {
    switch (type) {
      case 'bread':
        return 'primary'
      case 'meal':
        return 'secondary'
      case 'pastry':
        return 'success'
      default:
        return 'default'
    }
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        height: '100%',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: 4,
        },
      }}
    >
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h5" fontWeight="bold" color="primary.main">
          {name}
        </Typography>
        <Chip label={date} size="small" color="primary" variant="outlined" />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {specialOffers && specialOffers.length > 0 ? (
        specialOffers.map((offer, index) => (
          <Box key={index} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Chip
                icon={getIcon(offer.type)}
                label={offer.type.charAt(0).toUpperCase() + offer.type.slice(1)}
                size="small"
                color={getColor(offer.type) as any}
                sx={{ mr: 1 }}
              />
              <Typography variant="subtitle1" fontWeight="medium">
                {offer.name}
                {offer.price && ` - ${offer.price}`}
              </Typography>
            </Box>
            {offer.description && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {offer.description}
              </Typography>
            )}
          </Box>
        ))
      ) : (
        <Typography variant="body1" color="text.secondary" align="center">
          Geschlossen
        </Typography>
      )}
    </Paper>
  )
}

export default Card
