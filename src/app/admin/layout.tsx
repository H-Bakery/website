'use client'
import React from 'react'
import { Box, Typography } from '@mui/material'
import BakeryLayout from '../../layouts/BakeryLayout'
import { ThemeProvider } from '../../context/ThemeContext'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <ThemeProvider>
      <BakeryLayout>
        <Box
          sx={{
            mb: 4,
          }}
        >
          <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
            Administration
          </Typography>
          <Box sx={{ mt: 1 }}>
            {children}
          </Box>
        </Box>
      </BakeryLayout>
    </ThemeProvider>
  )
}