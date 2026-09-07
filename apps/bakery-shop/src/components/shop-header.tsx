'use client'

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import NextLink from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AppBar from '@mui/material/AppBar'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import { useCart } from '@bakery/shared/contexts'
import { SHOP_CATEGORIES } from '@bakery/shared/data-access'
import { HeusserLogo } from '@bakery/shared/ui'

/**
 * Kategorie-Schnellnavigation der Ladenzeile.
 *
 * Bewusst *ohne* die `category-*` Test-IDs: die gehören dem Filter auf der
 * Katalogseite. Zwei Elemente mit derselben ID würden jede E2E-Abfrage
 * mehrdeutig machen.
 */
const CATEGORY_LINKS: ReadonlyArray<{
  key: string
  label: string
  href: string
}> = [
  { key: 'all', label: 'Alle Produkte', href: '/products' },
  ...SHOP_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    href: `/products?category=${category.key}`,
  })),
]

/* -------------------------------------------------------------------------- */
/* Produktsuche                                                                */
/* -------------------------------------------------------------------------- */

const SEARCH_PLACEHOLDER = 'Brot, Brötchen, Kuchen …'

const searchFormSx = {
  order: { xs: 3, md: 2 },
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  flexGrow: 1,
  flexBasis: { xs: '100%', md: 0 },
  maxWidth: { md: 520 },
  pl: 1.5,
  pr: 0.5,
  py: 0.25,
  borderRadius: 1,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'grey.50',
  transition: 'border-color 120ms ease, background-color 120ms ease',
  '&:focus-within': {
    borderColor: 'primary.main',
    bgcolor: 'background.paper',
  },
} as const

const searchInputSx = {
  flexGrow: 1,
  fontSize: '0.9375rem',
  color: 'text.primary',
  '& input::-webkit-search-cancel-button': { display: 'none' },
} as const

const searchButtonSx = {
  color: 'primary.contrastText',
  bgcolor: 'primary.main',
  borderRadius: 1,
  '&:hover': { bgcolor: 'primary.dark' },
} as const

/**
 * Produktsuche — echtes Formular, damit Enter absendet.
 *
 * Das Feld zeigt die **aktive** Suche, nicht die zuletzt getippte: Der
 * Begriff kommt aus `useSearchParams()`, also aus der URL, und folgt jeder
 * Navigation — dem Zurück-Knopf, „Filter zurücksetzen" im Katalog, einem
 * Kategorie-Link. Vorher wurde `window.location.search` genau einmal beim
 * Mount gelesen; weil die Kopfzeile im Layout über jede clientseitige
 * Navigation hinweg bestehen bleibt, stand danach dauerhaft „Brot" im Feld,
 * während der Katalog längst „Kuchen" oder gar nichts mehr zeigte.
 *
 * Getippt wird lokal; überschrieben wird das Feld nur, wenn sich `q` in der
 * URL tatsächlich ändert — eine halb getippte Suche überlebt so eine
 * Navigation, bei der `q` gleich bleibt.
 */
function ShopSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [term, setTerm] = useState(urlQuery)
  const syncedQueryRef = useRef(urlQuery)

  useEffect(() => {
    if (urlQuery !== syncedQueryRef.current) {
      syncedQueryRef.current = urlQuery
      setTerm(urlQuery)
    }
  }, [urlQuery])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const value = term.trim()
      router.push(
        value ? `/products?q=${encodeURIComponent(value)}` : '/products'
      )
    },
    [router, term]
  )

  return (
    <Box
      component="form"
      role="search"
      onSubmit={handleSubmit}
      data-testid="shop-search"
      sx={searchFormSx}
    >
      <InputBase
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        inputProps={{
          'data-testid': 'shop-search-input',
          'aria-label': 'Produkte durchsuchen',
          enterKeyHint: 'search',
          type: 'search',
        }}
        sx={searchInputSx}
      />
      {term ? (
        <IconButton
          type="button"
          size="small"
          aria-label="Suche zurücksetzen"
          onClick={() => setTerm('')}
          sx={{ color: 'text.secondary' }}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      ) : null}
      <IconButton
        type="submit"
        size="small"
        aria-label="Suchen"
        sx={searchButtonSx}
      >
        <SearchIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

/**
 * Was steht, solange `useSearchParams()` auf dem Server noch nichts weiß
 * (statisch vorgerenderte Seiten). Dasselbe Formular, nur ohne Begriff und
 * ohne Verhalten — damit die Kopfzeile nicht springt, sobald die echte Suche
 * hydriert.
 */
function ShopSearchFallback() {
  return (
    <Box component="form" role="search" sx={searchFormSx}>
      <InputBase
        value=""
        readOnly
        placeholder={SEARCH_PLACEHOLDER}
        inputProps={{ 'aria-label': 'Produkte durchsuchen', type: 'search' }}
        sx={searchInputSx}
      />
      <IconButton
        type="button"
        size="small"
        aria-label="Suchen"
        sx={searchButtonSx}
      >
        <SearchIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Kopfzeile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Kopfzeile des Online-Shops.
 *
 * Nicht die schwebende Marketing-Navigation der Landingpage, sondern
 * Ladenchrome: Wortmarke, echte Produktsuche, Warenkorb mit Zähler und eine
 * immer erreichbare Kategorieleiste. Klebt oben am Viewport.
 */
export function ShopHeader() {
  const { summary } = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Der Warenkorb kommt aus dem localStorage. Erst nach dem Mount zählen,
    // sonst weicht das Client-Rendering vom Server-HTML ab (Hydration).
    setMounted(true)
  }, [])

  const itemCount = mounted ? summary.totalCount : 0

  return (
    <AppBar position="sticky" data-testid="shop-header" component="header">
      <Toolbar
        sx={{
          gap: { xs: 1, md: 2 },
          rowGap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          py: 1,
          px: { xs: 1.5, sm: 2, md: 3 },
          minHeight: { xs: 'auto', md: 72 },
        }}
      >
        {/* Wortmarke — dieselbe Marke wie die Website, eigener Laden. */}
        <Box
          component={NextLink}
          href="/"
          aria-label="Bäckerei Heusser – zur Startseite des Online-Shops"
          sx={{
            order: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            textDecoration: 'none',
            color: 'primary.main',
            flexShrink: 0,
            '& svg': { height: { xs: 26, sm: 32 }, width: 'auto' },
          }}
        >
          <HeusserLogo
            color="currentColor"
            width={116}
            height={36}
            aria-label="Bäckerei Heusser"
          />
          <Typography
            component="span"
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontFamily: 'Cinzel, serif',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              borderLeft: 1,
              borderColor: 'divider',
              pl: 1.25,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            Online-Shop
          </Typography>
        </Box>

        {/*
          Die Suche liest die URL. Auf statisch vorgerenderten Seiten kennt
          der Server sie nicht — ohne Suspense-Grenze bräche dort der Build ab.
        */}
        <Suspense fallback={<ShopSearchFallback />}>
          <ShopSearch />
        </Suspense>

        {/* Warenkorb mit Live-Zähler. */}
        <Box
          sx={{
            order: { xs: 2, md: 3 },
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <IconButton
            component={NextLink}
            href="/cart"
            data-testid="cart-link"
            aria-label={
              itemCount === 1
                ? 'Warenkorb, 1 Artikel'
                : `Warenkorb, ${itemCount} Artikel`
            }
            sx={{ color: 'primary.main' }}
          >
            <Badge
              data-testid="cart-badge"
              badgeContent={itemCount}
              color="secondary"
              overlap="circular"
            >
              <ShoppingCartOutlinedIcon />
            </Badge>
          </IconButton>
          <Box
            component={NextLink}
            href="/cart"
            sx={{
              display: { xs: 'none', md: 'block' },
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            Warenkorb
          </Box>
        </Box>
      </Toolbar>

      {/* Kategorien — auf schmalen Displays horizontal scrollbar statt umbrechend. */}
      <Box
        component="nav"
        aria-label="Produktkategorien"
        data-testid="shop-category-nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.25, md: 0.5 },
          px: { xs: 1, sm: 1.5, md: 2.5 },
          py: 0.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {CATEGORY_LINKS.map((link) => (
          <Box
            key={link.key}
            component={NextLink}
            href={link.href}
            sx={{
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            {link.label}
          </Box>
        ))}
      </Box>
    </AppBar>
  )
}

export default ShopHeader
