'use client'
import { AppProps } from 'next/app'
import { CacheProvider, EmotionCache } from '@emotion/react'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'

import createEmotionCache from '../utils/createEmotionCache'
import theme from '../theme'
import CartProvider from '../context/CartContext'

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache
  children: React.ReactNode
}

const clientSideEmotionCache = createEmotionCache()

const lightTheme = createTheme(theme)

const MyApp: React.FC<MyAppProps> = (props) => {
  const {
    Component,
    emotionCache = clientSideEmotionCache,
    pageProps,
    children,
  } = props

  return (
    <html lang="de">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={lightTheme}>
            <CartProvider>
              <CssBaseline />
              {children}
            </CartProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}

export default MyApp
