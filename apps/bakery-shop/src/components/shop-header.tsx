'use client'

import React, { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
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

/**
 * Kopfzeile des Online-Shops.
 *
 * Nicht die schwebende Marketing-Navigation der Landingpage, sondern
 * Ladenchrome: Wortmarke, echte Produktsuche, Warenkorb mit Zähler und eine
 * immer erreichbare Kategorieleiste. Klebt oben am Viewport.
 */
export function ShopHeader() {
  const router = useRouter()
  const { summary } = useCart()
  const [term, setTerm] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Der Warenkorb kommt aus dem localStorage. Erst nach dem Mount zählen,
    // sonst weicht das Client-Rendering vom Server-HTML ab (Hydration).
    setMounted(true)

    // Suchbegriff aus der URL übernehmen (Direktaufruf oder Reload).
    const query = new URLSearchParams(window.location.search).get('q')
    if (query) {
      setTerm(query)
    }
  }, [])

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

        {/* Produktsuche — echtes Formular, damit Enter absendet. */}
        <Box
          component="form"
          role="search"
          onSubmit={handleSubmit}
          data-testid="shop-search"
          sx={{
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
          }}
        >
          <InputBase
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Brot, Brötchen, Kuchen …"
            inputProps={{
              'data-testid': 'shop-search-input',
              'aria-label': 'Produkte durchsuchen',
              enterKeyHint: 'search',
              type: 'search',
            }}
            sx={{
              flexGrow: 1,
              fontSize: '0.9375rem',
              color: 'text.primary',
              '& input::-webkit-search-cancel-button': { display: 'none' },
            }}
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
            sx={{
              color: 'primary.contrastText',
              bgcolor: 'primary.main',
              borderRadius: 1,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Box>

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
