'use client'
import React from 'react'
import {
  Box,
  BoxProps,
  Button,
  Container,
  Grid,
  Typography,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  TextField,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import EnhancedProductCard from './EnhancedProductCard'
import Filter, { ALL_CATEGORIES, FILTERS } from '../../products/Filter'
import { HEADER_SPACE } from '../../header'
import { Product } from '../../../types/product'

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

/**
 * Kleinbuchstaben, Umlaute ausgeschrieben (ä → ae, ö → oe, ü → ue, ß → ss),
 * andere Akzente weg (é → e). Damit finden „Brötchen“, „BRÖTCHEN“ und
 * „broetchen“ dasselbe, „weissbrot“ findet „Weißbrot“.
 */
function spellOut(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Toleranter: der blanke Vokal statt Umlaut („brotchen“ → Brötchen). */
function bareVowels(spelled: string): string {
  return spelled.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
}

/**
 * Suchbegriff → die Wörter, die alle vorkommen müssen: getrimmt, klein,
 * Umlaute und ß ausgeschrieben, an Leerzeichen und Bindestrichen getrennt.
 * Leer = keine Einschränkung.
 */
export function normalizeSearch(query: string): string[] {
  return spellOut(query)
    .split(/[\s-]+/)
    .filter(Boolean)
}

/**
 * Die Produkte, bei denen jedes Wort des Suchbegriffs im Namen oder in der
 * Kategorie steht (Bindestriche zählen nicht: „kirschtorte“ findet
 * „Schwarzwälder-Kirsch-Torte“). Findet das nichts, gilt der blanke Vokal
 * für den Umlaut („brotchen“, „kase“). Nur dann - sonst brächte „Brot“ alle
 * Brötchen mit.
 */
export function searchProducts<T extends Pick<Product, 'name' | 'category'>>(
  items: T[],
  query: string
): T[] {
  const words = normalizeSearch(query)
  if (words.length === 0) return items

  const fields = items.map((item) =>
    [item.name, item.category].map((f) => spellOut(f).replace(/-/g, ''))
  )
  const matching = (ws: string[], fold: (s: string) => string) =>
    items.filter((_, i) =>
      ws.every((w) => fields[i].some((f) => fold(f).includes(w)))
    )

  const exact = matching(words, (f) => f)
  return exact.length > 0 ? exact : matching(words.map(bareVowels), bareVowels)
}

// ---------------------------------------------------------------------------
// Adresse (?kategorie=…&search=…&seite=…)
// ---------------------------------------------------------------------------

/** Was die Sortiment-Seite in der Adresse festhält. */
export interface SortimentView {
  category: string
  search: string
  page: number
}

// `search` ist auch der Parameter der SearchAction in app/layout.tsx.
const PARAM = { category: 'kategorie', search: 'search', page: 'seite' }

/**
 * Liest Kategorie, Suche und Seite aus einem Query-String. Unbekannte
 * Kategorien und ungültige Seiten fallen weg; die Kategorie darf auch
 * ausgeschrieben kommen (`broetchen`).
 */
export function readViewFromUrl(query: string): Partial<SortimentView> {
  const params = new URLSearchParams(query)
  const view: Partial<SortimentView> = {}

  const category = params.get(PARAM.category)?.trim()
  const known =
    category && FILTERS.find((f) => spellOut(f.label) === spellOut(category))
  if (known) view.category = known.label

  const search = params.get(PARAM.search)
  if (search?.trim()) view.search = search

  const page = Number(params.get(PARAM.page))
  if (Number.isInteger(page) && page > 1) view.page = page

  return view
}

/**
 * Der Query-String für eine Ansicht. Standardwerte (Alle, keine Suche,
 * Seite 1) fallen weg, fremde Parameter bleiben stehen.
 */
export function writeViewToUrl(query: string, view: SortimentView): string {
  const params = new URLSearchParams(query)
  const set = (key: string, value: string | null) =>
    value ? params.set(key, value) : params.delete(key)

  set(PARAM.category, view.category === ALL_CATEGORIES ? null : view.category)
  set(PARAM.search, view.search.trim() ? view.search : null)
  set(PARAM.page, view.page > 1 ? String(view.page) : null)

  const next = params.toString()
  return next ? `?${next}` : ''
}

// ---------------------------------------------------------------------------
// Seitennavigation
// ---------------------------------------------------------------------------

/** Deutsche Namen für die Buttons der Seitennavigation. */
export function paginationLabel(
  type:
    | 'page'
    | 'first'
    | 'last'
    | 'next'
    | 'previous'
    | 'start-ellipsis'
    | 'end-ellipsis',
  page: number | null,
  selected: boolean
): string {
  switch (type) {
    case 'first':
      return 'Zur ersten Seite'
    case 'last':
      return 'Zur letzten Seite'
    case 'previous':
      return 'Vorherige Seite'
    case 'next':
      return 'Nächste Seite'
    default:
      return selected ? `Seite ${page}, aktuelle Seite` : `Seite ${page}`
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches)
  )
}

/** Nur für Screenreader sichtbar. */
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const

function countLabel(count: number): string {
  return count === 1 ? '1 Produkt' : `${count} Produkte`
}

const SORT_LABELS: Record<string, string> = {
  '': 'Standard',
  'price-asc': 'Preis aufsteigend',
  'price-desc': 'Preis absteigend',
  name: 'Name',
}

// ---------------------------------------------------------------------------
// Produktliste
// ---------------------------------------------------------------------------

interface Props extends BoxProps {
  header?: React.ReactNode
  items: Product[]
  showControls?: boolean
  /** Kategorie-Kacheln über Suche und Liste (Sortiment-Seite). */
  showCategoryFilter?: boolean
  /**
   * Kategorie, Suche und Seite in der Adresse spiegeln und nach dem Laden
   * daraus übernehmen - so stellt „Zurück“ von einer Produktseite die
   * Ansicht wieder her, und `/products?search=…` sucht gleich.
   */
  syncUrl?: boolean
  title?: string
}

const ITEMS_PER_PAGE = 8

const Products: React.FC<Props> = (props) => {
  const {
    items,
    header,
    showControls = false,
    showCategoryFilter = false,
    syncUrl = false,
    title,
    sx,
  } = props
  const [category, setCategory] = React.useState(ALL_CATEGORIES)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [sortBy, setSortBy] = React.useState('')
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const resultsHeadingRef = React.useRef<HTMLHeadingElement>(null)

  // Auf dem Handy passen erste/letzte Seite und Nachbarseiten nicht in eine
  // Zeile; Seite 1 und die letzte Seite stehen ohnehin als Zahl da.
  const theme = useTheme()
  const compactPagination = useMediaQuery(theme.breakpoints.down('sm'))

  // Eine neue Produktliste beginnt auf Seite 1.
  const [prevItems, setPrevItems] = React.useState(items)
  if (items !== prevItems) {
    setPrevItems(items)
    setPage(1)
  }

  const changeCategory = (next: string) => {
    setCategory(next)
    setPage(1)
  }
  const changeSearch = (next: string) => {
    setSearchTerm(next)
    setPage(1)
  }
  const changeSort = (next: string) => {
    setSortBy(next)
    setPage(1)
  }

  // Beide Löschen-Buttons verschwinden mit dem Begriff; der Fokus soll dann
  // im Suchfeld landen und nicht auf dem Body.
  const clearSearch = () => {
    changeSearch('')
    searchInputRef.current?.focus()
  }

  // Suche über alle Kategorien; die Kategorie grenzt danach ein. So weiß die
  // Liste, ob es außerhalb der gewählten Kategorie Treffer gäbe.
  const searchHits = React.useMemo(
    () => searchProducts(items, searchTerm),
    [items, searchTerm]
  )

  const filteredItems = React.useMemo(() => {
    const result =
      category === ALL_CATEGORIES
        ? [...searchHits]
        : searchHits.filter((item) => item.category === category)

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    }
    return result
  }, [searchHits, category, sortBy])

  const hasSearch = searchTerm.trim().length > 0
  const hitsElsewhere =
    hasSearch && category !== ALL_CATEGORIES && filteredItems.length === 0
      ? searchHits.length
      : 0

  // Seite auf den gültigen Bereich klemmen: eine alte Seitenzahl (Seite 5,
  // dann Wechsel in eine Kategorie mit einer Seite, oder `?seite=99`) darf
  // nie ein leeres Raster zeigen.
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  const safePage = Math.min(page, Math.max(totalPages, 1))
  const displayedItems = filteredItems.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  // Nach einem Seitenwechsel steht der Kunde sonst unten an der
  // Seitennavigation, die neuen Karten liegen weit darüber.
  const goToPage = (next: number) => {
    setPage(next)
    const heading = resultsHeadingRef.current
    if (!heading) return
    heading.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    })
    heading.focus({ preventScroll: true })
  }

  // Adresse -> Ansicht, erst nach der Hydrierung: Der statische Export
  // rendert Seite 1 von „Alle“ ins HTML (useSearchParams mit Suspense würde
  // die Karten daraus entfernen).
  const [restored, setRestored] = React.useState(false)
  React.useEffect(() => {
    if (!syncUrl) return
    const view = readViewFromUrl(window.location.search)
    if (view.category) setCategory(view.category)
    if (view.search) setSearchTerm(view.search)
    if (view.page) setPage(view.page)
    setRestored(true)
  }, [syncUrl])

  // Ansicht -> Adresse, ohne neuen Verlaufseintrag.
  React.useEffect(() => {
    if (!syncUrl || !restored) return
    const { pathname, search, hash } = window.location
    const next = writeViewToUrl(search, {
      category,
      search: searchTerm,
      page: safePage,
    })
    if (next === search) return
    try {
      // `null`, nicht `history.state`: Next.js übernimmt seinen Zustand dann
      // selbst und führt seine Adresse nach. Mit dem alten Zustand (`__NA`)
      // hielte der Router die alte Adresse und schriebe sie beim nächsten
      // Update zurück.
      window.history.replaceState(null, '', `${pathname}${next}${hash}`)
    } catch {
      // Safari wirft bei sehr vielen Aufrufen in kurzer Zeit; die Adresse
      // ist Komfort, die Liste stimmt trotzdem.
    }
  }, [syncUrl, restored, category, searchTerm, safePage])

  const statusText =
    filteredItems.length === 0
      ? 'Kein Produkt gefunden'
      : `${countLabel(filteredItems.length)} gefunden`

  return (
    <Box
      sx={{
        py: 4,
        ...sx,
      }}
      component="section"
      aria-label="Produkt Liste"
    >
      <Container>
        {header ||
          (title && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h4"
                component="h2"
                fontWeight="bold"
                gutterBottom
              >
                {title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
          ))}

        {showCategoryFilter && (
          <Filter value={category} onChange={changeCategory} />
        )}

        {/* Search and Filter Controls - bleiben auch ohne Treffer stehen,
            sonst kann der Kunde den Suchbegriff nicht mehr korrigieren */}
        {showControls && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              mb: 3,
              gap: 2,
            }}
          >
            <TextField
              label="Produkte suchen"
              variant="outlined"
              size="small"
              value={searchTerm}
              inputRef={searchInputRef}
              onChange={(e) => changeSearch(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: { sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Suche löschen"
                      size="small"
                      edge="end"
                      onClick={clearSearch}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-select-label" shrink>
                Sortieren nach
              </InputLabel>
              <Select
                labelId="sort-select-label"
                value={sortBy}
                label="Sortieren nach"
                notched
                displayEmpty
                renderValue={(value) => SORT_LABELS[value] ?? SORT_LABELS['']}
                onChange={(e) => changeSort(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon />
                  </InputAdornment>
                }
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Für Screenreader: meldet jede Änderung der Trefferzahl. Ersetzt
            aria-live auf dem Raster, das jede Karte einzeln vorlas. */}
        <Box component="p" role="status" sx={visuallyHidden}>
          {statusText}
        </Box>

        {/* Product Grid */}
        {displayedItems.length > 0 ? (
          <>
            <Box sx={styles.resultsBar}>
              <Typography
                ref={resultsHeadingRef}
                component="h2"
                variant="h6"
                tabIndex={-1}
                sx={styles.resultsHeading}
              >
                {category === ALL_CATEGORIES ? 'Alle Produkte' : category}
                {totalPages > 1 && (
                  <Box component="span" sx={visuallyHidden}>
                    {`, Seite ${safePage} von ${totalPages}`}
                  </Box>
                )}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                aria-hidden="true"
              >
                {countLabel(filteredItems.length)}
                {totalPages > 1 && ` · Seite ${safePage} von ${totalPages}`}
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {displayedItems.map((item) => (
                <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
                  <EnhancedProductCard {...item} />
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            {hitsElsewhere > 0 ? (
              <>
                <Typography variant="h6" component="p" color="text.secondary">
                  In „{category}“ nichts zu „{searchTerm.trim()}“ gefunden
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  In anderen Kategorien gibt es {hitsElsewhere} Treffer.
                </Typography>
                <Box sx={styles.emptyActions}>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={() => changeCategory(ALL_CATEGORIES)}
                  >
                    In allen Kategorien suchen
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={clearSearch}
                  >
                    Suche zurücksetzen
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Typography variant="h6" color="text.secondary">
                  Keine Produkte gefunden
                </Typography>
                {hasSearch && (
                  <>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      Zu „{searchTerm.trim()}“ passt kein Produkt.
                    </Typography>
                    <Box sx={styles.emptyActions}>
                      <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={clearSearch}
                      >
                        Suche zurücksetzen
                      </Button>
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 4,
            }}
          >
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, newPage) => goToPage(newPage)}
              color="primary"
              size="large"
              siblingCount={compactPagination ? 0 : 1}
              showFirstButton={!compactPagination}
              showLastButton={!compactPagination}
              getItemAriaLabel={paginationLabel}
              aria-label="Produkt-Seitennavigation"
              sx={styles.pagination}
            />
          </Box>
        )}
      </Container>
    </Box>
  )
}

const styles = {
  resultsBar: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: 2,
    mb: 2,
  },
  resultsHeading: {
    // Ziel nach einem Seitenwechsel (Scrollen und Fokus, tabIndex -1). Der
    // Header ist fixiert: beim Hochscrollen nicht darunter verschwinden.
    scrollMarginTop: {
      xs: `${HEADER_SPACE.xs + 16}px`,
      sm: `${HEADER_SPACE.sm + 16}px`,
    },
    '&:focus': { outline: 'none' },
    '&:focus-visible': {
      outline: '3px solid',
      outlineColor: 'primary.main',
      outlineOffset: '4px',
      borderRadius: '4px',
    },
  },
  emptyActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    mt: 2,
  },
  pagination: {
    // Mindestens 44px Trefferfläche (WCAG 2.5.5).
    '& .MuiPaginationItem-root': {
      minWidth: 44,
      height: 44,
    },
  },
}

export default Products
