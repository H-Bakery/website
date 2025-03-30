// src/app/ThemeRegistry.tsx
'use client'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import { Box } from '@mui/material'

import theme from '../theme'
import CartProvider from '../context/CartContext'
import { Header } from '../components/header'
import Footer from '../components/footer/Index'

// Create theme
const muiTheme = createTheme(theme)

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={muiTheme}>
        <CartProvider>
          <CssBaseline />
          <Box
            sx={{
              background:
                'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4',
            }}
          >
            <Header />
            <Box sx={{ minHeight: 'calc(100vh - 332px)' }}>{children}</Box>
            <Footer />
          </Box>
        </CartProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
