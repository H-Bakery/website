'use client'

/**
 * @fileoverview Die Produktkarte des Shops – und das Preis-Token, das überall
 * im Laden dieselbe Zahl gleich aussehen lässt.
 *
 * Bewusst eigenständig statt `EnhancedProductCard` aus `@bakery/shared/ui`:
 * jene Karte erfindet Sterne-Bewertungen und Badges über `Math.random()` in
 * Default-Parametern – das erzeugt Hydration-Fehler und behauptet Daten, die es
 * nicht gibt. Hier steht nur, was im hq-Inhalt wirklich steht.
 *
 * Drei Dinge sind hier absichtlich so gebaut:
 *
 * - **Die Bildfläche ist quadratisch.** Alle 15 tatsächlich benutzten
 *   Produkt-SVGs haben `viewBox="0 0 250 250"`. In einer 4:3-Bahn blieb rechts
 *   und links ein Viertel Luft, und die Zeichnung wurde unnötig klein.
 * - **Name und Beschreibung halten ihre Höhe frei** (`minHeight` in `rem`), damit
 *   die Preiszeile über eine ganze Rasterreihe hinweg auf einer Linie liegt.
 * - **Das Skelett benutzt dieselben Maße** (`cardContentSx`, `cardFooterSx`,
 *   `cardNameSx`), deshalb springt beim Eintreffen der Daten nichts.
 */

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'
import AddIcon from '@mui/icons-material/Add'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import CheckIcon from '@mui/icons-material/Check'
import RemoveIcon from '@mui/icons-material/Remove'

import { useCart } from '@bakery/shared/contexts'
import {
  formatEuro,
  shopCategoryLabel,
  toCartProduct,
  unitPriceLabel,
  type ShopProduct,
} from '@bakery/shared/data-access'

import { ProductImage, PRODUCT_IMAGE_MEDIA_CLASS } from './product-image'

/* -------------------------------------------------------------------------- */
/* Preis-Token                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Vier Größen, sonst nichts. Ein Preis darf im Laden nicht fünfmal anders
 * aussehen – Karte, Detailseite, Warenkorbzeile, Summe und Bestätigung teilen
 * sich diese Skala.
 *
 * | Größe | Wofür                                        |
 * | ----- | -------------------------------------------- |
 * | `sm`  | Zeilenpreise, Nebenbeträge, Zusammenfassungen |
 * | `md`  | Produktkarte                                  |
 * | `lg`  | Warenkorbsumme, Bestellbestätigung            |
 * | `xl`  | Produktdetailseite                            |
 */
export type ShopPriceSize = 'sm' | 'md' | 'lg' | 'xl'

const SHOP_PRICE_SCALE: Record<
  ShopPriceSize,
  { fontSize: string; letterSpacing: string }
> = {
  sm: { fontSize: '0.9375rem', letterSpacing: '0' },
  md: { fontSize: '1.1875rem', letterSpacing: '-0.01em' },
  lg: { fontSize: '1.5rem', letterSpacing: '-0.015em' },
  xl: { fontSize: '2rem', letterSpacing: '-0.02em' },
}

export interface ShopPriceProps {
  /** Bruttobetrag in Euro. Wird immer über `formatEuro` gesetzt. */
  value: number
  size?: ShopPriceSize
  /**
   * `brand` (Standard) ist das Markenbraun für den eigentlichen Preis,
   * `plain` die Textfarbe für Nebenbeträge, damit nicht alles gleich laut ist.
   */
  tone?: 'brand' | 'plain'
  /** Kleiner Zusatz direkt hinter dem Betrag, z. B. „pro Stück". */
  note?: string
  /** `data-testid` – der Betrag selbst, ohne `note`, bleibt so prüfbar. */
  testId?: string
  component?: React.ElementType
  sx?: SxProps<Theme>
}

/**
 * Ein Preis, überall gleich: halbfett, Ziffern in gleicher Breite
 * (`tabular-nums`), leicht negativ spationiert, nie umbrechend.
 *
 * ```tsx
 * import { ShopPrice } from '@bakery/shop/feature-catalog'
 *
 * <ShopPrice value={product.price} size="xl" testId="product-detail-price" />
 * <ShopPrice value={line.price} size="sm" tone="plain" />
 * ```
 */
export function ShopPrice({
  value,
  size = 'md',
  tone = 'brand',
  note,
  testId,
  component = 'p',
  sx,
}: ShopPriceProps) {
  return (
    <Typography
      component={component}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 0.75,
          m: 0,
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
          color: tone === 'brand' ? 'primary.main' : 'text.primary',
          ...SHOP_PRICE_SCALE[size],
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Der Betrag trägt die testid, damit `note` den Text nicht verfälscht. */}
      <Box component="span" data-testid={testId}>
        {formatEuro(value)}
      </Box>
      {note ? (
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 400,
            letterSpacing: 0,
            color: 'grey.500',
          }}
        >
          {note}
        </Box>
      ) : null}
    </Typography>
  )
}

/* -------------------------------------------------------------------------- */
/* Maße, die Karte und Skelett teilen                                          */
/* -------------------------------------------------------------------------- */

/** Alle benutzten Produktzeichnungen sind 250×250 – die Bahn ist quadratisch. */
export const CARD_IMAGE_RATIO = '1 / 1'

/** Der Warenkorb deckelt bei 99; die Karte darf nichts anderes behaupten. */
const MAX_CARD_QUANTITY = 99

/** Wie lange die Bestätigung am Button stehen bleibt. */
const FEEDBACK_MS = 1800

const cardContentSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
  flexGrow: 1,
  width: '100%',
  p: { xs: 1.5, sm: 2 },
  '&:last-child': { pb: { xs: 1.5, sm: 2 } },
} as const

const cardFooterSx = {
  px: { xs: 1.5, sm: 2 },
  pb: { xs: 1.5, sm: 2 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
} as const

/**
 * Zwei Zeilen Titel bzw. Anrisstext bleiben immer reserviert, damit die
 * Preiszeilen einer Rasterreihe auf einer Linie liegen. In `rem`, nicht in `em`:
 * das Skelett kennt die Schriftgröße der Überschrift nicht.
 * h6 = 1rem × 1,45 × 2 Zeilen, ab `md` 1,125rem. body2 = 0,9375rem × 1,6 × 2.
 */
const NAME_BLOCK_MIN_HEIGHT = { xs: '2.9rem', md: '3.27rem' }
const TEASER_BLOCK_MIN_HEIGHT = '3rem'

const cardNameSx = {
  color: 'text.primary',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  minHeight: NAME_BLOCK_MIN_HEIGHT,
} as const

/** Zwei Zeilen Anrisstext, ab `sm`. Am Handy zählt die Dichte. */
const cardTeaserSx = {
  display: { xs: 'none', sm: 'block' },
  minHeight: TEASER_BLOCK_MIN_HEIGHT,
} as const

/**
 * Endpreis links, Grundpreis bzw. „pro Stück" rechts. Die Zeile darf
 * umbrechen: auf 320 px breiten Geräten passen „2,90 €" und „5,80 € / kg"
 * nicht nebeneinander, und ein abgeschnittener Grundpreis wäre keiner. Der
 * Spaltenabstand ist knapp bemessen, damit bei 360 px auch „18,00 € pro Stück"
 * noch auf einer Zeile bleibt.
 */
const priceRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: 0.5,
  rowGap: 0.25,
  borderTop: '1px solid',
  borderColor: 'divider',
  pt: 1.5,
} as const

/** Mindestgröße jeder Bedienfläche in CSS-Pixeln. */
const TOUCH_TARGET = 44

/* -------------------------------------------------------------------------- */
/* Karte                                                                       */
/* -------------------------------------------------------------------------- */

export interface ShopProductCardProps {
  product: ShopProduct
  /** Bildseitenverhältnis. Standard quadratisch – siehe Dateikopf. */
  imageRatio?: string
  /** Bild sofort laden (erste Reihe über der Falz). */
  eagerImage?: boolean
}

export function ShopProductCard({
  product,
  imageRatio = CARD_IMAGE_RATIO,
  eagerImage = false,
}: ShopProductCardProps) {
  const { addToCart, getQuantity, updateQuantity } = useCart()
  const [justAdded, setJustAdded] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const inCart = getQuantity(product.numericId)

  /**
   * Beim Tippen zählt der lokale Text, sonst der Warenkorb. Sonst würde ein
   * kurzzeitig leeres Feld sofort auf „0" zurückspringen.
   */
  const [draft, setDraft] = React.useState<string | null>(null)
  const quantityText = draft ?? String(inCart)

  const commitQuantity = (next: number) => {
    updateQuantity(
      product.numericId,
      Math.min(Math.max(next, 0), MAX_CARD_QUANTITY)
    )
  }

  const handleAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Der Button liegt außerhalb der Klickfläche, aber ein versehentlich
    // durchgereichtes Event darf niemals zusätzlich navigieren.
    event.preventDefault()
    event.stopPropagation()
    if (!product.available) return

    addToCart(toCartProduct(product))
    setDraft(null)
    setJustAdded(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setJustAdded(false), FEEDBACK_MS)
  }

  const handleQuantityInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
    setDraft(digits)
    if (digits !== '') commitQuantity(Number(digits))
  }

  /**
   * § 4 PAngV: Wer nach Gewicht anbietet, nennt den Grundpreis neben dem
   * Endpreis – und die Karte ist der Ort, an dem 500 g und 1000 g nebeneinander
   * liegen. Trägt der Name kein Gewicht, gibt es keinen Grundpreis; dann bleibt
   * es bei „pro Stück", und nichts wird erfunden.
   */
  const grundpreis = unitPriceLabel({
    name: product.name,
    price: product.price,
  })

  return (
    <Card
      data-testid="product-card"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition:
          'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        // Der Zoom sitzt hier, nicht im Bildmodul: die Karte kennt den Hover.
        [`&:hover .${PRODUCT_IMAGE_MEDIA_CLASS}`]: {
          transform: 'scale(1.05)',
        },
        '&:focus-within': {
          borderColor: 'primary.main',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
          [`&:hover .${PRODUCT_IMAGE_MEDIA_CLASS}`]: { transform: 'none' },
        },
      }}
    >
      <CardActionArea
        component={NextLink}
        href={`/products/${product.id}`}
        aria-label={`${product.name} ansehen`}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          flexGrow: 1,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            borderBottom: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            category={product.category}
            ratio={imageRatio}
            eager={eagerImage}
          />

          {product.seasonal && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: 1,
              }}
            >
              Saisonal
            </Box>
          )}

          {!product.available && (
            <Box
              sx={(theme) => ({
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
                textAlign: 'center',
                backgroundColor: alpha(theme.palette.grey[50], 0.82),
              })}
            >
              <Box
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.primary',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                Zur Zeit nicht verfügbar
              </Box>
            </Box>
          )}
        </Box>

        <CardContent sx={cardContentSx}>
          <Typography
            variant="overline"
            component="p"
            sx={{ color: 'grey.500', lineHeight: 1.4 }}
          >
            {shopCategoryLabel(product.category)}
          </Typography>

          <Typography
            data-testid="product-card-name"
            variant="h6"
            component="h3"
            sx={cardNameSx}
          >
            {product.name}
          </Typography>

          <Box sx={cardTeaserSx}>
            {product.shortDescription && (
              <Typography
                variant="body2"
                sx={{
                  color: 'grey.500',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {product.shortDescription}
              </Typography>
            )}
          </Box>
        </CardContent>
      </CardActionArea>

      <Box sx={cardFooterSx}>
        <Box sx={priceRowSx}>
          <ShopPrice
            value={product.price}
            size="md"
            testId="product-card-price"
          />
          <Typography
            data-testid="product-card-unit-price"
            variant="caption"
            // `ml: auto` hält den Zusatz auch dann rechts, wenn er umbricht.
            sx={{ color: 'grey.500', whiteSpace: 'nowrap', ml: 'auto' }}
          >
            {grundpreis ?? 'pro Stück'}
          </Typography>
        </Box>

        <Button
          data-testid="add-to-cart"
          fullWidth
          variant="contained"
          color={justAdded ? 'success' : 'primary'}
          disabled={!product.available}
          onClick={handleAdd}
          startIcon={
            justAdded ? (
              <CheckIcon fontSize="small" />
            ) : (
              <AddShoppingCartIcon fontSize="small" />
            )
          }
          aria-label={`${product.name} in den Warenkorb legen`}
          sx={{
            minHeight: TOUCH_TARGET,
            px: { xs: 1, sm: 2 },
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            lineHeight: 1.3,
            transition: 'background-color 200ms ease',
            // Am Handy ist der Platz knapp; die Beschriftung ist wichtiger.
            '& .MuiButton-startIcon': {
              display: { xs: 'none', sm: 'inline-flex' },
            },
          }}
        >
          {justAdded ? 'Hinzugefügt' : 'In den Warenkorb'}
        </Button>

        {/*
         * Der Mengenregler erscheint erst, wenn wirklich etwas im Warenkorb
         * liegt. Vorher wäre er nur Rauschen auf 103 Karten – und der schnelle
         * Ein-Klick-Fall (genau eins) bleibt so der kürzeste Weg.
         */}
        {inCart > 0 && (
          <Box
            role="group"
            aria-label={`Menge im Warenkorb: ${product.name}`}
            data-testid="card-quantity"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: TOUCH_TARGET,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              '&:focus-within': { borderColor: 'primary.main' },
            }}
          >
            <IconButton
              data-testid="card-quantity-decrease"
              aria-label={`Menge verringern: ${product.name}`}
              onClick={() => {
                setDraft(null)
                commitQuantity(inCart - 1)
              }}
              sx={{
                width: TOUCH_TARGET,
                height: TOUCH_TARGET,
                borderRadius: 0,
                flexShrink: 0,
              }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>

            <Box
              component="input"
              data-testid="card-quantity-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Menge von ${product.name} im Warenkorb`}
              value={quantityText}
              onChange={handleQuantityInput}
              onFocus={(event: React.FocusEvent<HTMLInputElement>) =>
                event.target.select()
              }
              onBlur={() => setDraft(null)}
              sx={{
                flex: 1,
                minWidth: 0,
                height: TOUCH_TARGET,
                px: 0.5,
                border: 0,
                background: 'transparent',
                textAlign: 'center',
                fontFamily: 'inherit',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'text.primary',
                fontVariantNumeric: 'tabular-nums',
                '&:focus': { outline: 'none' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '-2px',
                },
              }}
            />

            <IconButton
              data-testid="card-quantity-increase"
              aria-label={`Menge erhöhen: ${product.name}`}
              disabled={inCart >= MAX_CARD_QUANTITY}
              onClick={() => {
                setDraft(null)
                commitQuantity(inCart + 1)
              }}
              sx={{
                width: TOUCH_TARGET,
                height: TOUCH_TARGET,
                borderRadius: 0,
                flexShrink: 0,
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Box component="span" role="status" sx={visuallyHidden}>
          {inCart > 0 ? `${inCart} × ${product.name} im Warenkorb.` : ''}
        </Box>
      </Box>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Skelett                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Platzhalterkarte während des Ladens.
 *
 * Sie benutzt exakt dieselben Abstände und Mindesthöhen wie die echte Karte,
 * deshalb rückt beim Eintreffen der Daten nichts. Der Ton ist bewusst kräftiger
 * als MUIs Standard (`grey.100`, 1,13:1 auf Weiß – praktisch unsichtbar):
 * `grey.200` für die Bildbahn, `grey.300` für Text und Bedienfläche.
 */
export function ShopProductCardSkeleton({
  imageRatio = CARD_IMAGE_RATIO,
}: {
  imageRatio?: string
}) {
  return (
    <Card
      sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      aria-hidden="true"
    >
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{
          width: '100%',
          aspectRatio: imageRatio,
          bgcolor: 'grey.200',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />

      <CardContent sx={cardContentSx}>
        <Skeleton
          variant="rounded"
          animation="wave"
          width="38%"
          height={11}
          sx={{ bgcolor: 'grey.300', my: 0.4 }}
        />
        <Box sx={{ minHeight: NAME_BLOCK_MIN_HEIGHT }}>
          <Skeleton
            variant="rounded"
            animation="wave"
            width="92%"
            height={13}
            sx={{ bgcolor: 'grey.300', mb: 0.75 }}
          />
          <Skeleton
            variant="rounded"
            animation="wave"
            width="58%"
            height={13}
            sx={{ bgcolor: 'grey.300' }}
          />
        </Box>
        <Box sx={cardTeaserSx}>
          <Skeleton
            variant="rounded"
            animation="wave"
            width="100%"
            height={10}
            sx={{ bgcolor: 'grey.300', mb: 0.75 }}
          />
          <Skeleton
            variant="rounded"
            animation="wave"
            width="72%"
            height={10}
            sx={{ bgcolor: 'grey.300' }}
          />
        </Box>
      </CardContent>

      <Box sx={cardFooterSx}>
        <Box sx={priceRowSx}>
          <Skeleton
            variant="rounded"
            animation="wave"
            width="42%"
            height={19}
            sx={{ bgcolor: 'grey.300' }}
          />
          <Skeleton
            variant="rounded"
            animation="wave"
            width="24%"
            height={11}
            sx={{ bgcolor: 'grey.300' }}
          />
        </Box>
        <Skeleton
          variant="rounded"
          animation="wave"
          height={TOUCH_TARGET}
          sx={{ bgcolor: 'grey.300', borderRadius: 1 }}
        />
      </Box>
    </Card>
  )
}

export default ShopProductCard
