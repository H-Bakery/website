'use client'

/**
 * @fileoverview Der Katalog – die eigentliche Verkaufsfläche des Shops.
 *
 * Der Zustand steht in der URL (`?q=`, `?category=`, `?sort=`): Ergebnisse sind
 * teilbar, der Zurück-Knopf funktioniert, und die Kategorie-Links aus dem
 * Kopfbereich landen genau hier.
 *
 * Drei Dinge sind hier absichtlich so gebaut:
 *
 * - **Die Suche faltet Umlaute** (siehe {@link foldSearchText}). Wer am Handy
 *   „broetchen“ tippt, meint „Brötchen“ – vorher fand er null von fünfzehn,
 *   heute alle fünfzehn (nachgemessen an den 103 Produkten der API).
 * - **Am Handy steht die Bedienleiste in einer Zeile pro Sache.** Vorher fraßen
 *   Überschrift, Suchfeld, Sortierung und drei Reihen Kategorie-Chips 625 px:
 *   auf einem 375 × 667-Display war *kein einziges* Produkt zu sehen, ohne zu
 *   scrollen.
 *
 *   Das Budget ist knapp, also hier die Messung (375 × 667, Stand 2026-08-30),
 *   damit der nächste Eingriff nicht raten muss:
 *
 *   | Bis                     |  px |
 *   | ----------------------- | --- |
 *   | Kopfzeile des Shops     | 144 |
 *   | Titel + Sortierung      |  39 |
 *   | Suchfeld                |  48 |
 *   | Kategorie-Chips         |  42 |
 *   | Zählzeile               |  22 |
 *   | **Oberkante Raster**    | **305** |
 *   | Karte (Bild + Fuß)      | 357 |
 *   | **Unterkante 1. Reihe** | **662** |
 *
 *   Fünf Pixel Luft. Wer hier eine Zeile hinzufügt, schiebt die erste
 *   Kartenreihe unter die Falz – also vorher an derselben Stelle messen
 *   (`[data-testid="product-card"]`, `getBoundingClientRect().bottom`).
 * - **Eine leere Trefferliste sagt, wo die Treffer stattdessen liegen.** Siehe
 *   {@link emptyHint}.
 */

import * as React from 'react'
import NextLink from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'

import {
  SHOP_CATEGORIES,
  isShopCategory,
  shopCategoryLabel,
  type ShopCategory,
  type ShopProduct,
} from '@bakery/shared/data-access'

import { ProductGrid, ProductGridSkeleton } from './product-grid'
import { EmptyState, LoadErrorState } from './states'
import { useShopProducts } from './use-shop-products'

/** Wie viele Karten pro Nachschlag sichtbar werden. */
const PAGE_SIZE = 24

/** Wie viele Bilder der ersten Reihe sofort geladen werden (über der Falz). */
const EAGER_IMAGES = 4

/** Verzögerung, bis eine Sucheingabe in die URL geschrieben wird. */
const URL_SYNC_MS = 350

/* -------------------------------------------------------------------------- */
/* Suche                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Faltet Text auf die Form, in der gesucht wird.
 *
 * Am Handy tippt niemand Umlaute. „broetchen“, „brotchen“ und „Brötchen“
 * müssen deshalb dieselbe Zeichenkette ergeben – und „weissbrot“ dasselbe wie
 * „Weißbrot“. Der Reihe nach:
 *
 * 1. `ß` → `ss`, Umlaute → `ae`/`oe`/`ue` (die Schreibweise ohne Umlautpunkte),
 * 2. übrige diakritische Zeichen abziehen (`é` → `e`),
 * 3. `ae`/`oe`/`ue` auf einen Buchstaben zusammenziehen.
 *
 * Nach Schritt 3 fallen alle drei Schreibweisen auf *eine* zusammen. Dass dabei
 * auch echte Vokalfolgen zusammenschrumpfen („Baguette“ → `bagutte`), ist
 * harmlos: Suchbegriff und Produktname laufen durch dieselbe Funktion.
 *
 * `ss` wird bewusst **nicht** weiter auf `s` verkürzt. Es klänge nach mehr
 * Nachsicht, brächte aber falsche Treffer: „Nuss“ fände dann „K-nus-perweck“.
 * Wer „weisbrot“ mit einem s tippt, landet stattdessen in der
 * Tippfehlernachsicht – die sagt wenigstens, dass sie geraten hat.
 *
 * Was übrig bleibt, sind Kleinbuchstaben, Ziffern und einfache Leerzeichen.
 */
export function foldSearchText(value: string): string {
  if (!value) return ''
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Zerlegt eine Eingabe in gefaltete Wörter. Leere Eingabe ⇒ leere Liste. */
export function searchTokens(query: string): string[] {
  const folded = foldSearchText(query)
  return folded ? folded.split(' ') : []
}

/** Ab dieser Wortlänge verzeiht die Suche einen Tippfehler. */
const FUZZY_MIN_LENGTH = 4

/**
 * Optimal String Alignment (Levenshtein plus Vertauschung benachbarter
 * Buchstaben), abgebrochen, sobald `max` überschritten ist.
 *
 * Die Vertauschung ist der Grund für die eigene Umsetzung: „bort“ statt „brot“
 * ist ein Tippfehler, kein anderes Wort – reines Levenshtein zählt dafür zwei.
 */
export function withinEditDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > max) return false

  let twoBack: number[] = []
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  let current: number[] = []

  for (let i = 1; i <= a.length; i += 1) {
    current = new Array<number>(b.length + 1)
    current[0] = i
    let rowMin = current[0]

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(
        current[j - 1] + 1, // Einfügen
        previous[j] + 1, // Löschen
        previous[j - 1] + cost // Ersetzen
      )
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1] &&
        twoBack.length > 0
      ) {
        value = Math.min(value, twoBack[j - 2] + 1) // Vertauschung
      }
      current[j] = value
      if (value < rowMin) rowMin = value
    }

    // Keine Zelle der Zeile liegt noch im Rahmen – es kann nichts mehr werden.
    if (rowMin > max) return false
    twoBack = previous
    previous = current
  }

  return previous[b.length] <= max
}

/** Ein Produkt, gefaltet und für die Suche vorbereitet. */
export interface SearchEntry {
  product: ShopProduct
  /** Name, Anrisstext und Kategorie – ohne Trennzeichen, für Teilwortsuche. */
  haystack: string
  /** Nur der Name, ohne Trennzeichen. Grundlage der Sortierung nach Treffer. */
  nameCompact: string
  /** Einzelwörter aus Name und Kategorie – Grundlage der Tippfehlernachsicht. */
  words: string[]
}

/**
 * Baut den Suchindex einmal pro Produktliste.
 *
 * Die Kategorie steht bewusst mit im Heuhaufen: „Brötchen“ ist für Kundschaft
 * ein Suchbegriff, aber nur acht der fünfzehn Brötchen tragen das Wort im
 * Namen. Ohne die Kategorie fände „broetchen“ nur die Hälfte.
 */
export function buildSearchIndex(products: ShopProduct[]): SearchEntry[] {
  return products.map((product) => {
    const name = foldSearchText(product.name)
    const category = foldSearchText(shopCategoryLabel(product.category))
    const teaser = foldSearchText(product.shortDescription ?? '')
    const words = Array.from(
      new Set([...name.split(' '), ...category.split(' ')])
    ).filter(Boolean)

    return {
      product,
      haystack: `${name} ${category} ${teaser}`.replace(/ /g, ''),
      nameCompact: name.replace(/ /g, ''),
      words,
    }
  })
}

/** 0 = bester Treffer. Bestimmt die Reihenfolge bei „Beste Treffer“. */
function relevanceRank(
  entry: SearchEntry,
  tokens: string[],
  compactQuery: string
): number {
  if (entry.nameCompact.startsWith(compactQuery)) return 0
  if (entry.nameCompact.includes(compactQuery)) return 1
  if (tokens.every((token) => entry.nameCompact.includes(token))) return 2
  return 3
}

const collator = new Intl.Collator('de-DE', { sensitivity: 'base' })

export interface SearchOutcome {
  products: ShopProduct[]
  /**
   * `true`, wenn erst die Tippfehlernachsicht Treffer gebracht hat. Die
   * Oberfläche muss das sagen – sonst sieht es aus, als hätte die Kundschaft
   * genau das gesucht, was sie jetzt sieht.
   */
  approximate: boolean
}

/**
 * Sucht in zwei Durchgängen.
 *
 * 1. **Streng**: jedes Wort der Eingabe muss als Teilzeichenkette vorkommen.
 *    Mehrere Wörter dürfen in beliebiger Reihenfolge stehen („kuchen apfel“).
 * 2. **Nachsichtig**, und nur wenn Durchgang 1 *nichts* findet: ein Tippfehler
 *    je Wort ab vier Buchstaben („croisant“ → Croissant). Enger gefasst wäre
 *    die Alternative eine leere Seite; weiter gefasst würden falsche Treffer
 *    echte verdrängen – deshalb greift die Nachsicht nie zusätzlich.
 */
export function searchIndex(
  entries: SearchEntry[],
  query: string
): SearchOutcome {
  const tokens = searchTokens(query)
  if (tokens.length === 0) {
    return {
      products: entries.map((entry) => entry.product),
      approximate: false,
    }
  }

  const compactQuery = tokens.join('')

  const strict = entries.filter((entry) =>
    tokens.every((token) => entry.haystack.includes(token))
  )

  const byRelevance = (list: SearchEntry[]) =>
    [...list]
      .sort((a, b) => {
        const rank =
          relevanceRank(a, tokens, compactQuery) -
          relevanceRank(b, tokens, compactQuery)
        return rank !== 0
          ? rank
          : collator.compare(a.product.name, b.product.name)
      })
      .map((entry) => entry.product)

  if (strict.length > 0) {
    return { products: byRelevance(strict), approximate: false }
  }

  const fuzzy = entries.filter((entry) =>
    tokens.every(
      (token) =>
        token.length >= FUZZY_MIN_LENGTH &&
        entry.words.some(
          (word) =>
            word.length >= FUZZY_MIN_LENGTH &&
            withinEditDistance(token, word, 1)
        )
    )
  )

  return {
    products: fuzzy
      .map((entry) => entry.product)
      .sort((a, b) => collator.compare(a.name, b.name)),
    approximate: fuzzy.length > 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Sortierung                                                                  */
/* -------------------------------------------------------------------------- */

type CategoryFilter = ShopCategory | 'all'
type SortKey = 'relevance' | 'name' | 'price-asc' | 'price-desc'

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Beste Treffer',
  name: 'Name A–Z',
  'price-asc': 'Preis aufsteigend',
  'price-desc': 'Preis absteigend',
}

/** `null`, wenn nichts oder Unbekanntes in der URL steht. */
export function parseSort(value: string | null): SortKey | null {
  if (
    value === 'relevance' ||
    value === 'name' ||
    value === 'price-asc' ||
    value === 'price-desc'
  ) {
    return value
  }
  return null
}

/**
 * Sortiert die Trefferliste. `relevance` lässt die Reihenfolge stehen, in der
 * {@link searchIndex} sie geliefert hat.
 */
export function sortProducts(
  products: ShopProduct[],
  sort: SortKey
): ShopProduct[] {
  if (sort === 'relevance') return products
  const sorted = [...products]
  if (sort === 'price-asc') {
    sorted.sort((a, b) => a.price - b.price || collator.compare(a.name, b.name))
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => b.price - a.price || collator.compare(a.name, b.name))
  } else {
    sorted.sort((a, b) => collator.compare(a.name, b.name))
  }
  return sorted
}

/* -------------------------------------------------------------------------- */
/* Leere Theke                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Der Satz unter „Dazu ist die Theke leer“.
 *
 * Der wichtige Fall ist der erste Zweig: Wer „Nuss“ sucht, während „Brot“ als
 * Kategorie steht, bekam vorher eine leere Seite – und erfuhr nicht, dass
 * nebenan die Nusskuchen liegen. Die Zahl kommt aus der Suche *vor* dem
 * Kategoriefilter, ist also keine Behauptung, sondern gezählt.
 */
export function emptyHint(input: {
  /** Der getippte Suchbegriff, oder `null`, wenn nicht gesucht wurde. */
  query: string | null
  category: CategoryFilter
  /** Treffer derselben Suche außerhalb der gewählten Kategorie. */
  hitsElsewhere: number
}): string {
  const { query, category, hitsElsewhere } = input

  if (query && hitsElsewhere > 0 && category !== 'all') {
    const treffer =
      hitsElsewhere === 1 ? '1 Treffer' : `${hitsElsewhere} Treffer`
    return `Unter „${shopCategoryLabel(
      category
    )}“ finden wir zu „${query}“ nichts. In anderen Kategorien gibt es ${treffer}.`
  }

  if (query) {
    return `Zu „${query}“ finden wir hier nichts. Versuchen Sie es mit einem anderen Wort – oder setzen Sie die Filter zurück.`
  }

  return 'In dieser Kategorie liegt gerade nichts. Schauen Sie in einer anderen nach.'
}

/* -------------------------------------------------------------------------- */
/* Seite                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Überschrift. Am Handy klein und einzeilig: dort zählt jeder Pixel über der
 * Falz, und wo man ist, sagt schon die Kopfzeile.
 */
function CatalogHeading() {
  return (
    <Typography
      variant="h1"
      component="h1"
      sx={{
        fontSize: { xs: '1.125rem', sm: '1.75rem', md: '2.25rem' },
        lineHeight: 1.2,
        m: 0,
      }}
    >
      Frisch gebacken
    </Typography>
  )
}

/**
 * Greift, solange Next die Suchparameter auf dem Client nachreicht. Die
 * Suspense-Grenze steht bewusst hier in der Bibliothek, damit der Build der
 * Route nicht davon abhängt, wie die App sie einbindet.
 */
function CatalogFallback() {
  return (
    <Container sx={{ py: { xs: 1, md: 5 } }}>
      <CatalogHeading />
      <Box sx={{ mt: 2 }}>
        <ProductGridSkeleton count={12} />
      </Box>
    </Container>
  )
}

function CatalogContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { products, status, error, reload } = useShopProducts()

  const urlQuery = searchParams.get('q') ?? ''
  const rawCategory = searchParams.get('category')
  const category: CategoryFilter = isShopCategory(rawCategory)
    ? rawCategory
    : 'all'

  // Getippt wird lokal (sofortige Trefferliste), die URL folgt verzögert nach.
  const [queryInput, setQueryInput] = React.useState(urlQuery)
  const syncedQueryRef = React.useRef(urlQuery)

  const writeParams = React.useCallback(
    (next: Record<string, string | null>, mode: 'push' | 'replace') => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const queryString = params.toString()
      const href = queryString ? `${pathname}?${queryString}` : pathname
      if (mode === 'push') router.push(href, { scroll: false })
      else router.replace(href, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Zurück-Knopf oder ein Link von außen: Eingabefeld der URL nachziehen.
  React.useEffect(() => {
    if (urlQuery !== syncedQueryRef.current) {
      syncedQueryRef.current = urlQuery
      setQueryInput(urlQuery)
    }
  }, [urlQuery])

  // Tippen schreibt verzögert in die URL – ohne die History vollzuschreiben.
  React.useEffect(() => {
    if (queryInput === urlQuery) return
    const timer = setTimeout(() => {
      syncedQueryRef.current = queryInput
      writeParams({ q: queryInput.trim() || null }, 'replace')
    }, URL_SYNC_MS)
    return () => clearTimeout(timer)
  }, [queryInput, urlQuery, writeParams])

  const trimmedQuery = queryInput.trim()
  const hasQuery = trimmedQuery.length > 0

  /**
   * Ohne Suchbegriff ist „Beste Treffer“ sinnlos – dann ist A–Z die
   * Voreinstellung, mit Suchbegriff der beste Treffer.
   */
  const sort: SortKey =
    parseSort(searchParams.get('sort')) ?? (hasQuery ? 'relevance' : 'name')
  const effectiveSort: SortKey =
    sort === 'relevance' && !hasQuery ? 'name' : sort

  const sortOptions: SortKey[] = hasQuery
    ? ['relevance', 'name', 'price-asc', 'price-desc']
    : ['name', 'price-asc', 'price-desc']

  const selectCategory = (next: CategoryFilter) => {
    writeParams({ category: next === 'all' ? null : next }, 'push')
  }

  const selectSort = (next: SortKey) => {
    const isDefault = next === (hasQuery ? 'relevance' : 'name')
    writeParams({ sort: isDefault ? null : next }, 'push')
  }

  const resetFilters = () => {
    setQueryInput('')
    syncedQueryRef.current = ''
    writeParams({ q: null, category: null }, 'push')
  }

  /**
   * Nimmt die Kategorie weg und lässt den Suchbegriff stehen. Der Rückweg aus
   * „hier nichts, woanders schon“ – „Filter zurücksetzen“ würde dafür auch die
   * mühsam getippte Suche wegwerfen.
   */
  const searchEverywhere = () => {
    writeParams({ category: null }, 'push')
  }

  const index = React.useMemo(() => buildSearchIndex(products), [products])

  // Erst suchen, dann Kategorie – die Zähler an den Chips zeigen dadurch, wo
  // die Treffer der laufenden Suche liegen, nicht das ganze Angebot.
  const found = React.useMemo(
    () => searchIndex(index, trimmedQuery),
    [index, trimmedQuery]
  )

  const countByCategory = React.useMemo(() => {
    const counts = new Map<ShopCategory, number>()
    for (const product of found.products) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
    }
    return counts
  }, [found])

  const filtered = React.useMemo(() => {
    const list =
      category === 'all'
        ? found.products
        : found.products.filter((product) => product.category === category)
    return sortProducts(list, effectiveSort)
  }, [found, category, effectiveSort])

  const [visible, setVisible] = React.useState(PAGE_SIZE)

  React.useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [category, trimmedQuery, effectiveSort])

  const shown = filtered.slice(0, visible)
  const hasFilters = hasQuery || category !== 'all'

  /**
   * Treffer, die es gibt – nur nicht in der gewählten Kategorie. Sie stehen
   * schon an den Chips, aber nicht dort, wo gerade die leere Seite steht.
   * Siehe {@link emptyHint}.
   */
  const hitsElsewhere =
    hasQuery && filtered.length === 0 && category !== 'all'
      ? found.products.length
      : 0

  return (
    <Container sx={{ py: { xs: 1, md: 5 } }}>
      {/* Kopfzeile der Seite: Titel links, Sortierung rechts. Am Handy teilen
          sie sich eine Zeile, damit die Karten höher rutschen. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: { xs: 1, md: 1.5 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <CatalogHeading />
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              display: { xs: 'none', md: 'block' },
              mt: 0.5,
            }}
          >
            Alles aus unserer Backstube. Aussuchen, in den Warenkorb legen,
            Abholzeit wählen – fertig.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          id="catalog-sort"
          label="Sortierung"
          value={effectiveSort}
          onChange={(event) => selectSort(event.target.value as SortKey)}
          sx={{
            flexShrink: 0,
            width: { xs: 148, sm: 200 },
            '& .MuiInputBase-root': { bgcolor: 'background.paper' },
            '& .MuiSelect-select': {
              // Am Handy flacher als MUIs 40 px: jeder Pixel hier ist ein
              // Pixel weniger vom Produktbild über der Falz.
              py: { xs: 0.5, sm: 1 },
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            },
          }}
        >
          {sortOptions.map((key) => (
            <MenuItem key={key} value={key}>
              {SORT_LABELS[key]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Such- und Filterleiste. Sie bleibt immer stehen – auch bei null
          Treffern, sonst käme man aus einer erfolglosen Suche nicht heraus. */}
      <Box sx={{ mb: { xs: 1, md: 2 } }}>
        <TextField
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Suchen: Brot, Kuchen, Croissant …"
          aria-label="Produkte durchsuchen"
          size="small"
          fullWidth
          InputProps={{
            sx: { bgcolor: 'background.paper' },
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'grey.400' }} />
              </InputAdornment>
            ),
            endAdornment: queryInput ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Suche löschen"
                  onClick={() => setQueryInput('')}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          inputProps={{
            'data-testid': 'catalog-search-input',
            enterKeyHint: 'search',
          }}
        />

        {/*
         * Am Handy eine einzige scrollbare Zeile statt drei umbrechender:
         * acht Chips über drei Reihen kosteten 112 px – mehr als ein Drittel
         * dessen, was zwischen Kopfzeile und Falz überhaupt übrig ist.
         * Der negative Rand lässt die Zeile bis an den Displayrand laufen,
         * damit sichtbar ist, dass dort weitergeht.
         */}
        <Box
          data-testid="category-filter"
          role="group"
          aria-label="Nach Kategorie filtern"
          sx={{
            display: 'flex',
            gap: { xs: 0.75, md: 1 },
            mt: { xs: 1, md: 1.5 },
            flexWrap: { xs: 'nowrap', md: 'wrap' },
            overflowX: { xs: 'auto', md: 'visible' },
            mx: { xs: -2, sm: -3, md: 0 },
            px: { xs: 2, sm: 3, md: 0 },
            pb: { xs: 0.25, md: 0 },
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Chip
            data-testid="category-all"
            label={
              products.length > 0 ? `Alle (${found.products.length})` : 'Alle'
            }
            clickable
            onClick={() => selectCategory('all')}
            color={category === 'all' ? 'primary' : 'default'}
            variant={category === 'all' ? 'filled' : 'outlined'}
            aria-pressed={category === 'all'}
            sx={{ flexShrink: 0 }}
          />
          {SHOP_CATEGORIES.map((entry) => {
            const active = category === entry.key
            const count = countByCategory.get(entry.key) ?? 0
            return (
              <Chip
                key={entry.key}
                data-testid={`category-${entry.key}`}
                label={
                  products.length > 0
                    ? `${entry.label} (${count})`
                    : entry.label
                }
                clickable
                onClick={() => selectCategory(entry.key)}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                aria-pressed={active}
                sx={{
                  flexShrink: 0,
                  // Leere Kategorie: sichtbar, aber leiser. Wegblenden würde
                  // den Filter unter der Hand verschieben.
                  opacity: count === 0 && products.length > 0 ? 0.55 : 1,
                }}
              />
            )
          })}
        </Box>
      </Box>

      {status === 'error' && (
        <LoadErrorState
          message={error ?? 'Produkte konnten nicht geladen werden.'}
          onRetry={reload}
        />
      )}

      {status === 'loading' && <ProductGridSkeleton count={12} />}

      {status === 'ready' && (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1,
              mb: { xs: 0.75, md: 2 },
            }}
          >
            <Typography
              component="p"
              aria-live="polite"
              sx={{
                color: 'text.secondary',
                fontSize: { xs: '0.8125rem', md: '0.875rem' },
                lineHeight: 1.4,
              }}
            >
              {filtered.length === 1
                ? '1 Produkt'
                : `${filtered.length} Produkte`}
              {filtered.length > shown.length
                ? ` · ${shown.length} angezeigt`
                : ''}
            </Typography>

            {hasFilters && (
              <Button
                size="small"
                onClick={resetFilters}
                sx={{
                  // Ohne diese Maße wächst die Zeile um 16 px, sobald der
                  // Knopf erscheint – und schiebt die erste Kartenreihe genau
                  // dann unter die Falz, wenn jemand gesucht hat.
                  py: 0,
                  px: 0.5,
                  minWidth: 0,
                  minHeight: 0,
                  fontSize: { xs: '0.8125rem', md: '0.875rem' },
                  lineHeight: 1.4,
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </Box>

          {/* Nachsichtige Treffer werden als solche benannt. Wer „croisant“
              tippt, soll sehen, dass wir geraten haben. */}
          {found.approximate && filtered.length > 0 && (
            <Typography
              data-testid="catalog-approximate"
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: { xs: '0.8125rem', md: '0.875rem' },
                mb: { xs: 0.75, md: 2 },
              }}
            >
              Zu „{trimmedQuery}“ gibt es keinen genauen Treffer. Das kommt am
              nächsten:
            </Typography>
          )}

          {shown.length > 0 ? (
            <ProductGrid
              products={shown}
              testId="product-grid"
              eagerCount={EAGER_IMAGES}
            />
          ) : (
            <EmptyState
              testId="catalog-empty"
              headline="Dazu ist die Theke leer"
              hint={emptyHint({
                query: hasQuery ? trimmedQuery : null,
                category,
                hitsElsewhere,
              })}
              action={
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  {hitsElsewhere > 0 && (
                    <Button variant="contained" onClick={searchEverywhere}>
                      In allen Kategorien suchen
                    </Button>
                  )}
                  <Button
                    variant={hitsElsewhere > 0 ? 'outlined' : 'contained'}
                    onClick={resetFilters}
                  >
                    Filter zurücksetzen
                  </Button>
                  {hitsElsewhere === 0 && (
                    <Button
                      component={NextLink}
                      href="/products"
                      variant="outlined"
                    >
                      Alles ansehen
                    </Button>
                  )}
                </Box>
              }
            />
          )}

          {filtered.length > shown.length && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                size="large"
                endIcon={<ExpandMoreIcon />}
                onClick={() => setVisible((current) => current + PAGE_SIZE)}
              >
                Mehr anzeigen ({filtered.length - shown.length} weitere)
              </Button>
            </Box>
          )}
        </>
      )}
    </Container>
  )
}

export function CatalogPage() {
  return (
    <React.Suspense fallback={<CatalogFallback />}>
      <CatalogContent />
    </React.Suspense>
  )
}

export default CatalogPage
