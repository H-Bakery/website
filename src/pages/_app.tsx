import { AppProps } from 'next/app';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

import createEmotionCache from '../utils/createEmotionCache';
import theme from '../theme';
import CartProvider from '../context/CartContext';

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

const clientSideEmotionCache = createEmotionCache();

const lightTheme = createTheme(theme)

const MyApp: React.FC<MyAppProps> = (props) => {
  const {
    Component,
    emotionCache = clientSideEmotionCache,
    pageProps
  } = props
  
  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={lightTheme}>
        <CartProvider>
          <CssBaseline />
          <Component {...pageProps} />
        </CartProvider>
      </ThemeProvider>
    </CacheProvider>
  )
};

export default MyApp;
