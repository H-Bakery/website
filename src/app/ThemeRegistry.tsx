// src/app/ThemeRegistry.tsx
'use client'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import { Box } from '@mui/material'

import { lightTheme } from '../theme'
import CartProvider from '../context/CartContext'
import { Header } from '../components/header'
import Footer from '../components/footer/Index'
import { ThemeProvider as CustomThemeProvider } from '../context/ThemeContext'

// Inner component that always uses light theme for main site
function ThemedContent({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={lightTheme}>
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
    </MuiThemeProvider>
  )
}

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemedContent>{children}</ThemedContent>
    </AppRouterCacheProvider>
  )
}
