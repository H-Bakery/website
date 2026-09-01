'use client'

/**
 * @fileoverview „Fertige Tüten“ — der kürzeste Weg von der Startseite zu einer
 * Bestellung.
 *
 * Die meisten Besucher wissen nicht, was sie wollen; sie wissen, *wozu*. Eine
 * Tüte beantwortet das mit einem Klick statt mit sieben Kategorien.
 *
 * Wichtig für die Ehrlichkeit dieser Sektion:
 *
 * - Eine Tüte ist eine **Zusammenstellung aus echten Produkten**, kein eigener
 *   Artikel. Was drin ist, steht auf der Karte, und der Preis wird aus den
 *   echten Einzelpreisen summiert.
 * - Es wird **kein Rabatt behauptet**. Es gibt keinen; eine durchgestrichene
 *   „Statt“-Zahl wäre schlicht erfunden.
 * - Die Zusammenstellung ist ein Vorschlag und im Warenkorb änderbar — das
 *   steht auch so auf der Karte.
 * - Wo eine Zeile **nach Gewicht** verkauft wird, steht der Grundpreis dabei
 *   (§ 4 PAngV). Ohne ihn lassen sich 2,50 € für 500 g und 4,40 € für 1000 g
 *   nicht vergleichen — genau darum verlangt die Norm ihn.
 *
 * Rückmeldung nach dem Klick: der Knopf selbst (sichtbar) und der Hinweis
 * unten links auf der Seite (`CartToast` in `storefront-home.tsx`), der die
 * Meldung auch vorlesen lässt. Hier steht deshalb **keine** eigene
 * `aria-live`-Zone mehr — zwei würden dieselbe Bestätigung doppelt ansagen.
 */

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import CheckIcon from '@mui/icons-material/Check'
import ShoppingBasketOutlinedIcon from '@mui/icons-material/ShoppingBasketOutlined'

import { useCart } from '@bakery/shared/contexts'
import {
  toCartProduct,
  unitPriceLabel,
  type ShopCategory,
  type ShopProduct,
} from '@bakery/shared/data-access'

import { isPortion } from '@bakery/shop/feature-cart'

import { ShopPrice } from './product-card'
import { GRID_GAP } from './storefront-rhythm'

/** Wie lange die Bestätigung am Button stehen bleibt. */
const FEEDBACK_MS = 2400

interface BundleLine {
  /** Fallback-Kategorie, falls {@link BundleLine.prefer} nicht (mehr) existiert. */
  category: ShopCategory
  quantity: number
  /**
   * Der eigentlich gemeinte Artikel (hq-Slug).
   *
   * Ohne diese Angabe griffe die Auflösung zum erstbesten Produkt der
   * Kategorie — und in `kuchen` ist das ein *ganzer* Rahmkuchen für 18 €.
   * Eine „Kaffeetafel“ für 44 € schreckt ab, statt zu verkaufen. Eine Tüte
   * ist eine kuratierte Auswahl; die Auswahl steht deshalb hier.
   */
  prefer?: string
}

interface BundleSpec {
  key: string
  title: string
  /** Der Anlass, nicht der Inhalt — der Inhalt steht darunter. */
  occasion: string
  lines: ReadonlyArray<BundleLine>
}

/**
 * Die drei Tüten. Jede Zeile nennt den gemeinten Artikel *und* eine Kategorie:
 * verschwindet ein Produkt aus `hq`, rutscht die Zeile auf das nächste Produkt
 * derselben Kategorie, statt die ganze Sektion zu sprengen.
 */
const BUNDLES: ReadonlyArray<BundleSpec> = [
  {
    key: 'fruehstueck',
    title: 'Frühstückstüte',
    occasion: 'Für zwei am Wochenende',
    lines: [
      { category: 'broetchen', quantity: 6, prefer: 'sternweck' },
      { category: 'teilchen', quantity: 2, prefer: 'croissant' },
    ],
  },
  {
    key: 'kaffeetafel',
    title: 'Kaffeetafel',
    occasion: 'Wenn Besuch kommt',
    lines: [
      { category: 'kuchen', quantity: 4, prefer: 'kaesekuchen-1-stueck' },
      { category: 'kuchen', quantity: 4, prefer: 'marmorkuchen-1-stueck' },
    ],
  },
  {
    key: 'brotkorb',
    title: 'Brotkorb',
    occasion: 'Vorrat für die Woche',
    lines: [
      { category: 'brot', quantity: 1, prefer: 'kornbrot-500g' },
      { category: 'baguette', quantity: 1, prefer: 'baguette-klein' },
      { category: 'broetchen', quantity: 4, prefer: 'sternweck' },
    ],
  },
]

interface ResolvedLine {
  product: ShopProduct
  quantity: number
}

interface ResolvedBundle {
  spec: BundleSpec
  lines: ResolvedLine[]
  total: number
}

/**
 * Füllt eine Tüte mit echten Produkten.
 *
 * Deterministisch — erst der kuratierte Artikel, sonst das erste noch nicht
 * verwendete Produkt der Kategorie; nichts gewürfelt (das bräche die
 * Hydration). Lässt sich eine Zeile gar nicht füllen, fällt die **ganze** Tüte
 * weg: eine halbe Zusammenstellung hätte einen Preis, der nicht zum Titel
 * passt.
 */
function resolveBundle(
  spec: BundleSpec,
  available: ShopProduct[]
): ResolvedBundle | null {
  const lines: ResolvedLine[] = []
  const used = new Set<string>()

  for (const line of spec.lines) {
    const preferred = line.prefer
      ? available.find(
          (entry) => entry.id === line.prefer && !used.has(entry.id)
        )
      : undefined
    // Ersatz nur in derselben Darreichung: für ein Stück Kuchen wieder ein
    // Stück, nie der ganze Kuchen. Sonst stünde die „Kaffeetafel“ mit
    // 4 × Rahmkuchen für 72 € da – genau der Fall, den `prefer` verhindern soll.
    const wantsPortion = line.prefer ? isPortion({ id: line.prefer }) : null
    const product =
      preferred ??
      available.find(
        (entry) =>
          entry.category === line.category &&
          !used.has(entry.id) &&
          (wantsPortion === null || isPortion(entry) === wantsPortion)
      )
    if (!product) return null
    used.add(product.id)
    lines.push({ product, quantity: line.quantity })
  }

  const total = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  )
  return { spec, lines, total }
}

export interface BundleOffersProps {
  products: ShopProduct[]
}

export function BundleOffers({ products }: BundleOffersProps) {
  const { addToCart } = useCart()
  const [added, setAdded] = React.useState<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const available = React.useMemo(
    () => products.filter((product) => product.available),
    [products]
  )

  const bundles = React.useMemo(
    () =>
      BUNDLES.map((spec) => resolveBundle(spec, available)).filter(
        (bundle): bundle is ResolvedBundle => bundle !== null
      ),
    [available]
  )

  if (bundles.length === 0) return null

  const handleAdd = (bundle: ResolvedBundle) => {
    for (const line of bundle.lines) {
      addToCart(toCartProduct(line.product), line.quantity)
    }
    setAdded(bundle.spec.key)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setAdded(null), FEEDBACK_MS)
  }

  return (
    <Box
      data-testid="bundle-offers"
      sx={{
        display: 'grid',
        gap: GRID_GAP,
        gridTemplateColumns: {
          xs: '1fr',
          md: 'repeat(3, minmax(0, 1fr))',
        },
      }}
    >
      {bundles.map((bundle) => {
        const isAdded = added === bundle.spec.key
        return (
          <Paper
            key={bundle.spec.key}
            data-testid="bundle-card"
            variant="outlined"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              p: { xs: 2, md: 2.5 },
              transition: 'border-color 160ms ease, box-shadow 160ms ease',
              '&:hover': { borderColor: 'primary.light', boxShadow: 4 },
            }}
          >
            <Typography
              variant="overline"
              component="p"
              sx={{ color: 'secondary.main' }}
            >
              {bundle.spec.occasion}
            </Typography>
            <Typography variant="h4" component="h3" sx={{ mb: 2 }}>
              {bundle.spec.title}
            </Typography>

            <Box
              component="ul"
              sx={{ listStyle: 'none', m: 0, p: 0, flexGrow: 1 }}
            >
              {bundle.lines.map((line) => {
                // Nur Ware mit Gewicht im Namen hat einen Grundpreis; für
                // alles andere gibt `unitPriceLabel` `null` zurück, und dann
                // steht dort auch nichts.
                const perKilo = unitPriceLabel(line.product)
                return (
                  <Box
                    component="li"
                    key={line.product.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      py: 0.5,
                      fontSize: '0.9375rem',
                      lineHeight: 1.5,
                      color: 'text.primary',
                    }}
                  >
                    <Box component="span" sx={{ minWidth: 0 }}>
                      <Box component="span" sx={{ fontWeight: 700, mr: 0.75 }}>
                        {line.quantity}×
                      </Box>
                      {line.product.name}
                      {perKilo ? (
                        <Box
                          component="span"
                          sx={{
                            display: 'block',
                            fontSize: '0.75rem',
                            lineHeight: 1.5,
                            color: 'text.secondary',
                          }}
                        >
                          {perKilo}
                        </Box>
                      ) : null}
                    </Box>
                    <ShopPrice
                      value={line.product.price * line.quantity}
                      size="sm"
                      tone="plain"
                      component="span"
                      sx={{ flexShrink: 0 }}
                    />
                  </Box>
                )
              })}
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 1,
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <ShopPrice value={bundle.total} size="lg" />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                inkl. MwSt.
              </Typography>
            </Box>

            <Button
              data-testid="bundle-add"
              fullWidth
              size="large"
              variant={isAdded ? 'outlined' : 'contained'}
              color={isAdded ? 'success' : 'primary'}
              onClick={() => handleAdd(bundle)}
              // Drei Knöpfe mit demselben Text: der Screenreader braucht den
              // Namen der Tüte, sonst sind sie nicht zu unterscheiden.
              aria-label={
                isAdded
                  ? `${bundle.spec.title} liegt im Warenkorb`
                  : `${bundle.spec.title} in den Warenkorb legen`
              }
              startIcon={
                isAdded ? <CheckIcon /> : <ShoppingBasketOutlinedIcon />
              }
              sx={{ mt: 2 }}
            >
              {isAdded ? 'Liegt im Warenkorb' : 'Tüte in den Warenkorb'}
            </Button>

            {isAdded ? (
              <Button
                component={NextLink}
                href="/cart"
                size="small"
                sx={{ mt: 0.5 }}
              >
                Zum Warenkorb
              </Button>
            ) : (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textAlign: 'center',
                  mt: 1,
                }}
              >
                Vorschlag – im Warenkorb änderbar
              </Typography>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}

export default BundleOffers
