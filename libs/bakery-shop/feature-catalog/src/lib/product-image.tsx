'use client'

/**
 * @fileoverview Produktbild und der Platzhalter, wenn es (noch) keines gibt.
 *
 * 43 der 103 hq-Produkte tragen im Frontmatter den Müllwert `images/`, andere
 * zeigen auf Dateien, die es nicht gibt. Beides darf nie als kaputtes Bild-Icon
 * erscheinen: unbrauchbare Pfade werden gar nicht erst angefragt, 404er fallen
 * über `onError` auf denselben Platzhalter.
 *
 * Der Platzhalter ist bewusst **gestaltet**, nicht leer. Ein blasses Kästchen
 * liest sich als Fehler; hier steht stattdessen eine warme Fläche mit einem
 * Strichmotiv der jeweiligen Kategorie und der ehrlichen Zeile „Noch ohne
 * Foto". Er behauptet kein Produktfoto — er zeigt, dass an dieser Stelle
 * absichtlich eine Zeichnung steht.
 */

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'

import {
  shopCategoryLabel,
  type ShopCategory,
} from '@bakery/shared/data-access'

/** Nur absolute Pfade mit Bild-Endung sind brauchbar. */
const USABLE_IMAGE_PATH = /^\/\S+\.(svg|jpg|jpeg|png|webp|avif)$/i

/** Vektorgrafiken werden vollständig gezeigt, Fotos füllen die Fläche. */
const VECTOR_PATH = /\.svg$/i

/**
 * Klasse auf dem eigentlichen Bild. Die Produktkarte hängt daran ihren
 * Hover-Zoom auf — so bleibt die Animation dort, wo das Layout sitzt.
 */
export const PRODUCT_IMAGE_MEDIA_CLASS = 'ShopProductImage-media'

/** Beschriftung des Platzhalters. Steht genau einmal. */
export const NO_PHOTO_LABEL = 'Noch ohne Foto'

/** Prüft, ob ein `image`-Feld überhaupt eine anfragbare Bildquelle ist. */
export function isUsableProductImage(
  src: string | null | undefined
): src is string {
  return typeof src === 'string' && USABLE_IMAGE_PATH.test(src.trim())
}

/* -------------------------------------------------------------------------- */
/* Kategorie-Motive                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Strichzeichnungen im 64er-Raster, alle im selben Duktus wie die echten
 * Produkt-SVGs: nur Konturen, keine Flächen, keine Farbe. Sie sagen „Brot" oder
 * „Torte", ohne ein bestimmtes Produkt zu behaupten.
 */
const CATEGORY_MOTIFS: Record<ShopCategory, React.ReactElement> = {
  // Laib mit drei Einschnitten
  brot: (
    <>
      <path d="M10 38c0-10.5 9.8-17.5 22-17.5S54 27.5 54 38v3.5A4.5 4.5 0 0 1 49.5 46h-35A4.5 4.5 0 0 1 10 41.5z" />
      <path d="M22.5 26 18.5 33.5M32 24.5 28 33M41.5 26 37.5 33.5" />
    </>
  ),
  // Runder Weck mit Schnitt
  broetchen: (
    <>
      <circle cx="32" cy="32" r="16.5" />
      <path d="M17 30c4.5 3.2 9.5 4.8 15 4.8s10.5-1.6 15-4.8" />
    </>
  ),
  // Schräg liegende Stange mit Einschnitten
  baguette: (
    <g transform="rotate(-45 32 32)">
      <rect x="25" y="5" width="14" height="54" rx="7" />
      <path d="M28 19l8 4M28 29l8 4M28 39l8 4" />
    </g>
  ),
  // Schnecke
  teilchen: (
    <path d="M32 14A18 18 0 0 1 32 50A14 14 0 0 1 32 22A10 10 0 0 1 32 42A6 6 0 0 1 32 30A3 3 0 0 1 32 36" />
  ),
  // Brezel: Bauch als U, darüber die beiden Schlaufen, die sich in der Mitte
  // kreuzen und als Enden auf dem Bauch aufliegen.
  snacks: (
    <>
      <path d="M14 30C14 44 22 50 32 50C42 50 50 44 50 30" />
      <path d="M14 30C13 20 16 14 23 14C30 14 30 21 32 26C34 30 37 32 40 34" />
      <path d="M50 30C51 20 48 14 41 14C34 14 34 21 32 26C30 30 27 32 24 34" />
    </>
  ),
  // Stück Blechkuchen: mit dem Messer geschnitten, oben Streuselkruste
  kuchen: (
    <>
      <path d="M13 28h38v20H13z" />
      <path d="M13 28c2.5-4.5 5-4.5 7.5 0s5 4.5 7.5 0 5-4.5 7.5 0 5 4.5 7.5 0 5-4.5 7.5 0" />
      <path d="M13 38h38" />
    </>
  ),
  // Torte: rund, gewölbter Deckel, eine Sahneschicht, Kirsche obenauf
  torten: (
    <>
      <path d="M12 27h40v17a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" />
      <path d="M12 27c0-5.5 9-9.5 20-9.5s20 4 20 9.5" />
      <path d="M12 37h40" />
      <circle cx="32" cy="14" r="3" />
    </>
  ),
}

/** Ohne Kategorie: der Laib als neutrales Bäckereimotiv. */
const FALLBACK_MOTIF = CATEGORY_MOTIFS.brot

export interface CategoryMotifProps {
  category?: ShopCategory
  /** Strichstärke im 64er-Raster. */
  strokeWidth?: number
  sx?: SxProps<Theme>
}

/** Das reine Motiv – dekorativ, nie mit eigener Bedeutung für Screenreader. */
export function CategoryMotif({
  category,
  strokeWidth = 1.6,
  sx,
}: CategoryMotifProps) {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      role="presentation"
      focusable="false"
      aria-hidden="true"
      sx={{
        display: 'block',
        width: '100%',
        height: 'auto',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...sx,
      }}
    >
      {(category && CATEGORY_MOTIFS[category]) || FALLBACK_MOTIF}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Bildfläche                                                                  */
/* -------------------------------------------------------------------------- */

export type ProductImageFit = 'auto' | 'contain' | 'cover'

export interface ProductImageProps {
  src: string | null
  /** Produktname – nur als Alternativtext, nie sichtbar. */
  alt: string
  /** Kategorie des Produkts. Wählt das Motiv des Platzhalters. */
  category?: ShopCategory
  /** CSS `aspect-ratio` der Bildfläche. Standard ist quadratisch. */
  ratio?: string
  /**
   * `auto` (Standard): SVG-Strichzeichnungen werden vollständig gezeigt
   * (`contain`), Fotos füllen die Fläche (`cover`). Explizit überschreibbar.
   */
  fit?: ProductImageFit
  /** Feste Motivbreite in px. Ohne Angabe skaliert es mit der Fläche mit. */
  placeholderSize?: number
  /** Erstes Bild einer Seite darf sofort laden. */
  eager?: boolean
  sx?: SxProps<Theme>
}

/**
 * Bildfläche einer Backware. Der Grund ist ein weicher, cremefarbener Verlauf –
 * flaches Weiß lässt die freigestellten Zeichnungen schweben.
 */
export function ProductImage({
  src,
  alt,
  category,
  ratio = '1 / 1',
  fit = 'auto',
  placeholderSize,
  eager = false,
  sx,
}: ProductImageProps) {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [src])

  const showImage = isUsableProductImage(src) && !failed
  const isVector = VECTOR_PATH.test(src ?? '')
  const objectFit = fit === 'auto' ? (isVector ? 'contain' : 'cover') : fit

  const motifWidth = placeholderSize
    ? `${placeholderSize}px`
    : 'min(44%, 112px)'

  return (
    <Box
      sx={[
        (theme) => ({
          position: 'relative',
          width: '100%',
          aspectRatio: ratio,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: theme.palette.grey[50],
          backgroundImage: `radial-gradient(112% 88% at 50% 12%, ${
            theme.palette.background.paper
          } 0%, ${theme.palette.grey[50]} 58%, ${alpha(
            theme.palette.grey[200],
            0.55
          )} 100%)`,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {showImage ? (
        <Box
          component="img"
          className={PRODUCT_IMAGE_MEDIA_CLASS}
          src={src as string}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit,
            padding: objectFit === 'contain' ? 'clamp(8px, 7%, 28px)' : 0,
            transition: 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        />
      ) : (
        <Box
          role="img"
          aria-label={
            category
              ? `${shopCategoryLabel(category)} – ${NO_PHOTO_LABEL}`
              : NO_PHOTO_LABEL
          }
          sx={(theme) => ({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            px: 1,
            textAlign: 'center',
            // Feine Diagonalen wie auf Bäckerpapier – sie machen die Fläche zu
            // einer Absicht statt zu einer Lücke.
            backgroundImage: `repeating-linear-gradient(135deg, ${alpha(
              theme.palette.primary.main,
              0.05
            )} 0 1px, transparent 1px 10px)`,
          })}
        >
          <CategoryMotif
            category={category}
            sx={{ width: motifWidth, color: 'grey.500' }}
          />
          <Typography
            component="span"
            sx={{
              fontSize: { xs: '0.6875rem', sm: '0.75rem' },
              lineHeight: 1.3,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'grey.500',
            }}
          >
            {NO_PHOTO_LABEL}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default ProductImage
