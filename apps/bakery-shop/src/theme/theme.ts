'use client'

import { createTheme } from '@mui/material/styles'
import type { Shadows } from '@mui/material/styles'

/**
 * Shop-Theme der Bäckerei Heusser.
 *
 * Die Markenfarben, die Schriften und die warme Grauskala sind identisch mit
 * der Landingpage (apps/bakery-landing/src/theme/theme.ts) — es ist dieselbe
 * Bäckerei. Der Charakter ist aber ein anderer: kompaktere Typo-Skala,
 * ruhigere Flächen, klare Bedienelemente. Ein Laden, keine Broschüre.
 *
 * Bewusst nur Light Mode: der Storefront-Look ist cremefarben-warm.
 *
 * ## Barrierefreiheit (Stand 2026-08-30)
 *
 * Die Farbwerte unten sind gerechnet, nicht geschätzt: jeder geänderte Wert
 * trägt sein WCAG-Kontrastverhältnis gegen die drei Flächen des Shops als
 * Kommentar — `background.default` #FFF3E6 (Creme), `background.paper`
 * #FFFFFF (Karte) und `grey[100]` #F5EDE4 (warme Fläche). Schwellen:
 * 4,5:1 für Fließtext, 3:1 für Icons, Rahmen bedienbarer Elemente und
 * Fokusringe (WCAG 2.1 AA, 1.4.3 / 1.4.11).
 *
 * Die Markenfarbtöne selbst bleiben unangetastet — geändert wurde nur die
 * Helligkeit innerhalb desselben Farbtons. Magenta behält exakt seinen
 * Farbwinkel (308,7°), Blattgrün seinen (101,2°); das ursprüngliche
 * #d038ba lebt als `secondary.light` weiter, das ursprüngliche #7A9B6B als
 * `success.light`, und beide werden dort weiter benutzt, wo sie keine
 * kleine Schrift tragen (Fokusring, Tab-Indikator).
 */

const headlines = {
  fontFamily: '"Cinzel", "Iowan Old Style", Georgia, serif',
  fontWeight: 700,
}

const bodyFont =
  '"Merriweather", Georgia, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif'

/** Markenpalette — 1:1 aus der Landingpage übernommen. */
const brandColors = {
  // Primär – Dunkelbraun
  primary: {
    main: '#5A2E2A', // dark-brown
    light: '#928168', // macchiato
    dark: '#3B2B28', // text
    contrastText: '#FFFFFF',
  },
  // Sekundär – Marken-Highlight Magenta
  secondary: {
    // Derselbe Farbton (H 308,7°), nur dunkler: #d038ba trug als Textfarbe
    // (Overline in „Fertige Tüten“) und als Fläche unter weißer Schrift
    // (Warenkorb-Badge, „Suchen“-Button) nur 3,88 / 4,24 / 3,65:1.
    // Vorher #d038ba: 3,88 / 4,24 / 3,65 · Nachher: 4,90 / 5,36 / 4,62
    // Weiß auf der Fläche: 4,24 → 5,36:1.
    main: '#B82BA4',
    // Das unveränderte Marken-Magenta. Bleibt im Theme und wird dort
    // eingesetzt, wo es keine kleine Schrift trägt: Fokusring (3,88 / 4,24 /
    // 3,65:1 – über der 3:1-Schwelle für Nicht-Text) und Tab-Indikator.
    light: '#d038ba',
    dark: '#A82994', // deep magenta · 5,64 / 6,16 / 5,31
    contrastText: '#FFFFFF',
  },
  // Warme Skala, die MUIs graue Skala ersetzt
  warmScale: {
    50: '#FFF3E6', // cream (background)
    100: '#F5EDE4', // soft beige (surface)
    200: '#E6D8C3', // beige
    300: '#D4C4B0', // warm sand
    400: '#928168', // macchiato
    500: '#7A6B5D', // warm grey
    600: '#5A2E2A', // dark-brown
    700: '#4A3A35', // medium warm
    800: '#3B2B28', // text
    900: '#2A1F18', // dark warm (footer)
  },
  gold: '#D4A574', // Sterne, Hinweise – lebt auf dunklen Flächen (7,21:1 auf grey[900])
  goldDark: '#7E5322', // dieselbe Goldfamilie für Schrift auf hellem Grund
  leafGreen: '#7A9B6B', // verfügbar / erfolgreich
  leafGreenText: '#58724D', // derselbe Farbton (H 101,2°), texttauglich
  leafGreenDeep: '#3F5535',
  /**
   * Textfarbe zweiter Ordnung. War #928168 (macchiato) und lag mit
   * 3,45 / 3,78 / 3,26:1 unter der 4,5:1-Schwelle — und das auf fast jeder
   * Nebenzeile des Shops. Gleicher Farbton (H ~36°), gleiche Sättigung,
   * nur dunkler: 5,11 / 5,59 / 4,82:1.
   */
  textSecondary: '#746650',
  /**
   * Rahmen bedienbarer Elemente (Eingabefelder, Outlined-Buttons, Chips).
   * `divider` #E6D8C3 schafft nur 1,28 / 1,40 / 1,21:1 und darf das auch —
   * für rein trennende Linien gilt keine Kontrastschwelle. Ein Rahmen, der
   * die Grenze eines Bedienelements zeigt, braucht 3:1 (WCAG 1.4.11).
   * Dieser Ton ist warmScale[400] eine Spur dunkler: 3,86 / 4,22 / 3,64:1.
   */
  borderInteractive: '#8A795F',
}

/**
 * Warm getönte Schatten (Braun statt Schwarz) über die komplette
 * MUI-Elevation-Skala – Schwarz wirkt auf Creme schmutzig.
 */
const warmShadows = Array.from({ length: 25 }, (_, index) => {
  if (index === 0) return 'none'
  const y = Math.max(1, Math.round(index * 0.9))
  const blur = Math.round(4 + index * 2.2)
  const spreadAlpha = (0.05 + index * 0.004).toFixed(3)
  const ambientAlpha = (0.04 + index * 0.003).toFixed(3)
  return [
    `0px ${y}px ${blur}px rgba(90, 46, 42, ${spreadAlpha})`,
    `0px ${Math.round(y / 2)}px ${Math.round(
      blur / 2
    )}px rgba(59, 43, 40, ${ambientAlpha})`,
  ].join(', ')
}) as unknown as Shadows

const base = createTheme({
  palette: {
    mode: 'light',
    common: {
      black: brandColors.warmScale[900],
      white: '#FFFFFF',
    },
    primary: brandColors.primary,
    secondary: brandColors.secondary,
    success: {
      // Vorher #7A9B6B: 2,86 / 3,12 / 2,69:1 — verfehlte selbst die 3:1 für
      // das große Häkchen-Icon der Bestellbestätigung. Nachher: 4,89 / 5,34 /
      // 4,61:1. Weiß auf der Fläche: 3,12 → 5,34:1.
      main: brandColors.leafGreenText,
      // Das unveränderte Blattgrün, jetzt als heller Ton der Familie.
      light: brandColors.leafGreen,
      // Trägt Text: „geöffnet“ im Warenkorb und die Erfolgsmeldung.
      // Vorher #5C7A4E: 4,42 / 4,83 / 4,17:1 · Nachher: 7,50 / 8,20 / 7,07:1
      // (auf der getönten Alert-Fläche 4,22 → 7,16:1).
      dark: brandColors.leafGreenDeep,
      // Weiß statt Dunkelbraun: auf dem dunkleren Grün käme #2A1F18 nur noch
      // auf 3,00:1, Weiß auf 5,34:1.
      contrastText: '#FFFFFF',
    },
    warning: {
      // Unverändert: Gold steht im Shop auf dunklem Grund (Hero-Overline und
      // Fußzeilen-Label auf grey[900] = 7,21:1) und als Plakettenfläche mit
      // dunkler Schrift (#3B2B28 darauf = 6,04:1). Dunkler wäre dort ein
      // Rückschritt.
      main: brandColors.gold,
      light: '#E7C7A2',
      // Trägt Text im Hinweis-Alert. Vorher #B07F4C: 3,21 / 3,51 / 3,03:1
      // (auf der getönten Alert-Fläche 3,08:1) · Nachher: 6,10 / 6,67 /
      // 5,76:1 (auf der Alert-Fläche 5,86:1).
      dark: brandColors.goldDark,
      contrastText: brandColors.warmScale[800], // 6,04:1 auf dem Gold
    },
    error: {
      main: '#B3261E',
      light: '#E5534B',
      dark: '#7F1B15',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#5D7A85',
      light: '#8AA8B2',
      dark: '#3F5A63',
      contrastText: '#FFFFFF',
    },
    grey: {
      50: brandColors.warmScale[50],
      100: brandColors.warmScale[100],
      200: brandColors.warmScale[200],
      300: brandColors.warmScale[300],
      400: brandColors.warmScale[400],
      500: brandColors.warmScale[500],
      600: brandColors.warmScale[600],
      700: brandColors.warmScale[700],
      800: brandColors.warmScale[800],
      900: brandColors.warmScale[900],
    },
    background: {
      default: brandColors.warmScale[50], // cream
      paper: '#FFFFFF',
    },
    text: {
      primary: brandColors.warmScale[800], // #3B2B28 · 12,30 / 13,44 / 11,60
      // #928168 → #746650: 3,45 / 3,78 / 3,26 → 5,11 / 5,59 / 4,82:1
      secondary: brandColors.textSecondary,
      // Deaktivierte Beschriftungen sind von der Kontrastschwelle
      // ausgenommen (WCAG 1.4.3, „inactive“).
      disabled: brandColors.warmScale[300],
    },
    // Bleibt hell: rein trennende Linien (Karten, Dialoge, Kopfzeile)
    // brauchen keine 3:1. Bedienbare Rahmen benutzen `borderInteractive`.
    divider: brandColors.warmScale[200], // #E6D8C3
    action: {
      active: brandColors.warmScale[600],
      hover: 'rgba(90, 46, 42, 0.05)',
      hoverOpacity: 0.05,
      selected: 'rgba(90, 46, 42, 0.1)',
      selectedOpacity: 0.1,
      disabled: brandColors.warmScale[300],
      disabledBackground: brandColors.warmScale[100],
      focus: 'rgba(208, 56, 186, 0.16)',
      focusOpacity: 0.16,
    },
    // 4,5 statt 3,2: wo MUI `contrastText` selbst errechnet, soll es die
    // Textschwelle treffen und nicht die für große Flächen.
    contrastThreshold: 4.5,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 8,
  },
  shadows: warmShadows,
  typography: {
    fontFamily: bodyFont,
    // Kompaktere Skala als die Landingpage: im Shop zählt Dichte, nicht Pathos.
    h1: { ...headlines, fontSize: '2.25rem', lineHeight: 1.2 },
    h2: { ...headlines, fontSize: '1.875rem', lineHeight: 1.25 },
    h3: { ...headlines, fontSize: '1.5rem', lineHeight: 1.3 },
    h4: { ...headlines, fontSize: '1.25rem', lineHeight: 1.35 },
    h5: { ...headlines, fontSize: '1.125rem', lineHeight: 1.4 },
    h6: { ...headlines, fontSize: '1rem', lineHeight: 1.45 },
    subtitle1: { fontFamily: bodyFont, fontWeight: 700, lineHeight: 1.5 },
    subtitle2: {
      fontFamily: bodyFont,
      fontWeight: 700,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body1: { fontSize: '1rem', lineHeight: 1.65 },
    body2: { fontSize: '0.9375rem', lineHeight: 1.6 },
    button: {
      fontFamily: bodyFont,
      fontWeight: 700,
      letterSpacing: '0.01em',
      textTransform: 'none',
    },
    caption: { fontSize: '0.8125rem', lineHeight: 1.5 },
    overline: {
      fontFamily: bodyFont,
      fontWeight: 700,
      fontSize: '0.6875rem',
      letterSpacing: '0.12em',
      lineHeight: 1.6,
      textTransform: 'uppercase',
    },
  },
})

/** Responsive Kopfzeilen: auf großen Viewports darf es etwas mehr sein. */
const responsiveHeadings = {
  h1: {
    [base.breakpoints.up('md')]: { fontSize: '2.75rem' },
  },
  h2: {
    [base.breakpoints.up('md')]: { fontSize: '2.25rem' },
  },
  h3: {
    [base.breakpoints.up('md')]: { fontSize: '1.75rem' },
  },
  h4: {
    [base.breakpoints.up('md')]: { fontSize: '1.5rem' },
  },
  h5: {
    [base.breakpoints.up('md')]: { fontSize: '1.25rem' },
  },
  h6: {
    [base.breakpoints.up('md')]: { fontSize: '1.125rem' },
  },
}

/**
 * Der Fokusring — eine Definition für den ganzen Shop.
 *
 * Warum er hier steht und nicht in `global.css`: MUIs `ButtonBase` setzt
 * `outline: 0` (node_modules/@mui/material/ButtonBase/ButtonBase.js). Diese
 * Regel hat dieselbe Spezifität wie ein `:focus-visible` in der globalen
 * CSS-Datei, wird aber später eingehängt — Emotion schreibt seine
 * `<style>`-Tags hinter das Stylesheet von Next. Der Ring aus `global.css`
 * verlor deshalb gegen jeden Button, IconButton, Chip und jede
 * CardActionArea: der Shop war per Tastatur praktisch unbedienbar.
 *
 * Farbe ist das unveränderte Marken-Magenta (`secondary.light` = #d038ba):
 * 3,88:1 auf Creme, 4,24:1 auf Weiß, 3,65:1 auf der warmen Fläche und
 * 3,79:1 auf dem dunklen Fußzeilen-Braun — überall über der 3:1-Schwelle
 * für Nicht-Text-Kontrast, also auch auf dem Hero-Foto und auf einem
 * magentafarbenen Button (der 2px-Abstand legt den Ring auf den
 * Seitenhintergrund, nicht auf die Schaltfläche).
 *
 * `:focus-visible`, nicht `:focus` — mit der Maus bleibt alles ruhig.
 */
const FOCUS_RING_WIDTH = '2px'

const focusRing = {
  outline: `${FOCUS_RING_WIDTH} solid ${base.palette.secondary.light}`,
  outlineOffset: '2px',
} as const

/**
 * Variante für Elemente in `overflow: hidden`-Kartenrahmen (MUI `Card`).
 * Ein außenliegender Ring würde dort abgeschnitten, deshalb liegt er innen.
 */
const focusRingInset = {
  outline: `${FOCUS_RING_WIDTH} solid ${base.palette.secondary.light}`,
  outlineOffset: '-4px',
} as const

/** Selektoren, unter denen MUI bzw. der Browser den Tastaturfokus meldet. */
const focusVisible = {
  '&:focus-visible': focusRing,
  '&.Mui-focusVisible': focusRing,
}

export const shopTheme = createTheme(base, {
  typography: responsiveHeadings,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        body: {
          backgroundColor: base.palette.background.default,
          color: base.palette.text.primary,
        },

        // Auffangnetz für alles, was kein MUI-Bedienelement ist: nackte
        // Links (Fußzeile), `component="a"`-Boxen, Elemente mit tabindex.
        'a:focus-visible': focusRing,
        'area:focus-visible': focusRing,
        'summary:focus-visible': focusRing,
        // `:not(.MuiButtonBase-root)` ist kein Zierrat: MUI rendert auf jedem
        // Button, Chip und jeder CardActionArea ein `tabindex="0"`. Ohne den
        // Ausschluss wäre dieser Selektor spezifischer als die Regeln der
        // Komponenten — und würde den innenliegenden Ring der CardActionArea
        // wieder durch einen außenliegenden ersetzen, den der Kartenrahmen
        // abschneidet.
        '[tabindex]:not([tabindex="-1"]):not(.MuiButtonBase-root):focus-visible':
          focusRing,

        /**
         * Wer im Betriebssystem „Bewegung reduzieren“ gewählt hat, bekommt
         * keine.
         *
         * `!important` ist hier kein Faulheitszeichen: MUI setzt seine
         * Übergänge als Klassenregel (`.MuiButtonBase-root { transition: … }`),
         * und eine Klasse schlägt den Universalselektor. Dieselbe Regel steht
         * ohne `!important` in `global.css` und war damit wirkungslos.
         */
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationDelay: '0ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            transitionDelay: '0ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },

    MuiContainer: {
      defaultProps: {
        maxWidth: 'lg' as const,
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius,
          paddingInline: base.spacing(2.5),
          paddingBlock: base.spacing(1),
          minHeight: 42,
          ...focusVisible,
        },
        sizeSmall: {
          paddingInline: base.spacing(1.75),
          paddingBlock: base.spacing(0.5),
          minHeight: 34,
          fontSize: '0.875rem',
        },
        sizeLarge: {
          paddingInline: base.spacing(3.5),
          paddingBlock: base.spacing(1.5),
          minHeight: 52,
          fontSize: '1.0625rem',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: base.palette.primary.dark,
          },
        },
        containedSecondary: {
          '&:hover': {
            backgroundColor: base.palette.secondary.dark,
          },
        },
        outlined: {
          // Rahmen eines Bedienelements: 3,86 / 4,22 / 3,64:1 statt der
          // 1,28 / 1,40 / 1,21:1 von `divider`.
          borderColor: brandColors.borderInteractive,
          '&:hover': {
            borderColor: base.palette.primary.main,
            backgroundColor: base.palette.action.hover,
          },
        },
        text: {
          '&:hover': {
            backgroundColor: base.palette.action.hover,
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: base.palette.primary.main,
          '&:hover': {
            backgroundColor: base.palette.action.hover,
          },
          ...focusVisible,
        },
      },
    },

    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: base.palette.divider,
        },
        rounded: {
          borderRadius: base.shape.borderRadius * 1.5,
        },
      },
    },

    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius * 1.5,
          border: `1px solid ${base.palette.divider}`,
          backgroundColor: base.palette.background.paper,
          boxShadow: base.shadows[1],
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: base.spacing(2),
          '&:last-child': {
            paddingBottom: base.spacing(2),
          },
        },
      },
    },

    MuiCardActionArea: {
      styleOverrides: {
        root: {
          // Innenliegender Ring: `MuiCard` hat `overflow: hidden`, ein
          // außenliegender würde am Kartenrand abgeschnitten.
          '&:focus-visible': focusRingInset,
          '&.Mui-focusVisible': focusRingInset,
        },
        focusHighlight: {
          backgroundColor: base.palette.primary.main,
        },
      },
    },

    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'inherit' as const,
      },
      styleOverrides: {
        root: {
          backgroundColor: base.palette.background.paper,
          color: base.palette.text.primary,
          borderBottom: `1px solid ${base.palette.divider}`,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined' as const,
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: base.palette.background.paper,
          borderRadius: base.shape.borderRadius,
          '& .MuiOutlinedInput-notchedOutline': {
            // Die Grenze eines Eingabefelds muss sichtbar sein: 3,86 / 4,22 /
            // 3,64:1 statt 1,28 / 1,40 / 1,21:1 (`divider`).
            borderColor: brandColors.borderInteractive,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: base.palette.primary.main,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: base.palette.primary.main,
          },
          // Der Ring liegt am Feldrahmen, den Fokus hat das innere <input>.
          '&:has(input:focus-visible), &:has(textarea:focus-visible)':
            focusRing,
          // Deaktiviert = nicht bedienbar, also zurück auf die stille Linie
          // (deaktivierte Elemente sind von der 3:1-Schwelle ausgenommen).
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
            borderColor: base.palette.divider,
          },
        },
        input: {
          '&::placeholder': {
            color: base.palette.text.secondary,
            opacity: 1,
          },
        },
      },
    },

    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: base.palette.grey[100],
          borderRadius: base.shape.borderRadius,
          '&:hover': {
            backgroundColor: base.palette.grey[200],
          },
          '&.Mui-focused': {
            backgroundColor: base.palette.grey[100],
          },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: base.palette.text.secondary,
          '&.Mui-focused': {
            color: base.palette.primary.main,
          },
        },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginInline: 0,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius,
          fontWeight: 700,
          ...focusVisible,
        },
        outlined: {
          // Chips sind im Shop Filter, also bedienbar → 3:1.
          borderColor: brandColors.borderInteractive,
        },
        filled: {
          backgroundColor: base.palette.grey[100],
          color: base.palette.text.primary,
        },
        label: {
          paddingInline: base.spacing(1.25),
        },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: {
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: '0.6875rem',
        },
      },
    },

    MuiLink: {
      defaultProps: {
        underline: 'hover' as const,
      },
      styleOverrides: {
        root: {
          color: base.palette.primary.main,
          fontWeight: 700,
          ...focusVisible,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: base.palette.divider,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius,
        },
        standardError: {
          backgroundColor: 'rgba(179, 38, 30, 0.08)',
          color: base.palette.error.dark,
        },
        standardSuccess: {
          backgroundColor: 'rgba(122, 155, 107, 0.14)',
          color: base.palette.success.dark,
        },
        standardInfo: {
          backgroundColor: base.palette.grey[100],
          color: base.palette.text.primary,
        },
        standardWarning: {
          backgroundColor: 'rgba(212, 165, 116, 0.18)',
          color: base.palette.warning.dark,
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: base.palette.grey[800],
          color: base.palette.common.white,
          fontSize: '0.75rem',
          borderRadius: base.shape.borderRadius,
        },
        arrow: {
          color: base.palette.grey[800],
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 3,
          // Das unveränderte Marken-Magenta: reine Fläche, kein Text —
          // 3,88 / 4,24 / 3,65:1 und damit über der 3:1-Schwelle.
          backgroundColor: base.palette.secondary.light,
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: bodyFont,
          fontWeight: 700,
          textTransform: 'none',
          minHeight: 44,
          color: base.palette.text.secondary,
          ...focusVisible,
          '&.Mui-selected': {
            color: base.palette.primary.main,
          },
        },
      },
    },

    /**
     * Sterne: Farbe darf nicht das einzige Signal sein (WCAG 1.4.1).
     *
     * Gemessen war der gefüllte Stern (MUIs Standardgold #faaf00) mit 1,88:1
     * auf der weißen Bewertungskarte und der leere Stern (`action.disabled`
     * #D4C4B0) mit 1,70:1 — beide praktisch unsichtbar, und unterscheidbar
     * nur über den Farbton.
     *
     * Jetzt trägt die Kontur die Information: dunkelbraune Umrandung
     * (`primary.main`) mit 10,34 / 11,30 / 9,75:1 gegen die Flächen und
     * 5,07:1 gegen die Goldfüllung. Das Gold bleibt Füllung, die Sternform
     * ist auch ohne Farbwahrnehmung lesbar; gefüllt vs. leer unterscheidet
     * sich zusätzlich in der Helligkeit der Fläche.
     */
    MuiRating: {
      styleOverrides: {
        root: {
          color: brandColors.gold,
          ...focusVisible,
        },
        icon: {
          '& svg': {
            stroke: base.palette.primary.main,
            strokeWidth: 1.2,
            strokeLinejoin: 'round',
          },
        },
        iconEmpty: {
          color: base.palette.grey[100],
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius,
          borderColor: brandColors.borderInteractive,
          color: base.palette.text.primary,
          textTransform: 'none',
          fontWeight: 700,
          ...focusVisible,
          '&.Mui-selected': {
            backgroundColor: base.palette.primary.main,
            color: base.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: base.palette.primary.dark,
            },
          },
        },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: base.palette.grey[100],
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: base.shape.borderRadius,
          ...focusVisible,
          '&.Mui-selected': {
            backgroundColor: base.palette.action.selected,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: base.shape.borderRadius * 1.5,
          border: `1px solid ${base.palette.divider}`,
        },
      },
    },
  },
})

export default shopTheme
