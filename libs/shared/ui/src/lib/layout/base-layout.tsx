'use client'
import { Box } from '@mui/material'
import React from 'react'

interface BaseLayoutProps {
  children: React.ReactNode
}

export const BaseLayout: React.FC<BaseLayoutProps> = ({ children }) => (
  <Box
    sx={{
      background:
        'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
      minHeight: '100vh',
    }}
  >
    {children}
  </Box>
)