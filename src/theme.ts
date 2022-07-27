import { ThemeOptions } from "@mui/material";

const headlines = {
  fontFamily: 'Averia Serif Libre'
}

const buttons = {
  fontFamily: 'Averia Serif Libre'
}

const theme: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#D038BA'
    },
    grey: {
      50: '#F6F8FC',
      100: '#F2F5FB',
      200: '#E8EEFB',
      300: '#D8E1F4',
      400: '#B0BFD9',
      500: '#909FBE',
      600: '#677695',
      700: '#485776',
      800: '#293858',
      900: '#131F37',
    },
    background: {
      paper: '#FFFFFF',
      default: '#F6F8FC',
    },
    text: {
      primary: '#131F37',
      secondary: '#485776',
      disabled: '#909FBE',
    },
  },
  typography: {
    fontFamily: "'Ubuntu', sans-serif",
    h1: { ...headlines },
    h2: { ...headlines },
    h3: { ...headlines },
    h4: { ...headlines },
    h5: { ...headlines },
    h6: { ...headlines },
    button: { ...buttons },
  }
}

export default theme