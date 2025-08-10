import React from 'react'
import {
  Box,
  Container,
  CircularProgress,
  Typography,
  Skeleton,
} from '@mui/material'

export default function ProductsLoading() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumb Skeleton */}
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={250} height={24} />
      </Box>

      {/* Hero Section Skeleton */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Skeleton
          variant="text"
          width={300}
          height={56}
          sx={{ mx: 'auto', mb: 2 }}
        />
        <Skeleton variant="text" width={500} height={32} sx={{ mx: 'auto' }} />
      </Box>

      {/* Loading Indicator */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Produkte werden geladen...
        </Typography>
      </Box>

      {/* Product Grid Skeleton */}
      <Box sx={{ mt: 4 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 3,
          }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
              }}
            >
              <Skeleton
                variant="rectangular"
                width="100%"
                height={200}
                sx={{ borderRadius: 1, mb: 2 }}
              />
              <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                }}
              >
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="30%" height={24} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  )
}
