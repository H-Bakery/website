'use client'

/**
 * @fileoverview Echte Fotos aus der Bäckerei, responsiv ausgeliefert.
 *
 * Für Backwaren verkauft das Bild, nicht der Text — deshalb stehen hier echte
 * Aufnahmen und keine Illustrationen. Jede Datei liegt als WebP *und* JPEG in
 * 400 px und 800 px unter `/assets/images/bakery`; ohne `sizes` lüde der
 * Browser immer die größte Variante und verschenkte den halben Nutzen.
 */

import * as React from 'react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

const BASE = '/assets/images/bakery'

/** Die Breiten, die von jedem Motiv vorliegen. */
const WIDTHS = [
  { suffix: 'small', width: 400 },
  { suffix: 'medium', width: 800 },
] as const

/**
 * Klasse auf dem eigentlichen Bild — dasselbe Muster wie
 * `PRODUCT_IMAGE_MEDIA_CLASS` bei der Produktkarte.
 *
 * Der Zoom beim Überfahren gehört dorthin, wo das Layout sitzt (die Kachel
 * kennt ihren Hover, das Bildmodul nicht). Hier steht nur der Übergang; die
 * globale `prefers-reduced-motion`-Regel des Themes dreht ihn ab.
 */
export const BAKERY_PHOTO_MEDIA_CLASS = 'BakeryPhoto-media'

function srcSet(name: string, extension: 'webp' | 'jpg'): string {
  return WIDTHS.map(
    ({ suffix, width }) => `${BASE}/${name}-${suffix}.${extension} ${width}w`
  ).join(', ')
}

export interface BakeryPhotoProps {
  /** Basisname ohne Größe und Endung, z. B. `'artisan-croissants'`. */
  name: string
  /** Was zu sehen ist – nie leer, die Fotos tragen Bedeutung. */
  alt: string
  /** CSS `aspect-ratio` der Bildfläche. */
  ratio: string
  /** `sizes`-Attribut, passend zum Layout an der Einbaustelle. */
  sizes: string
  /** Für das Bild über der Falz: sofort laden statt lazy. */
  eager?: boolean
  sx?: SxProps<Theme>
}

/**
 * Ein Foto in fester Bildfläche, formatfüllend beschnitten (`cover`).
 *
 * Anders als {@link ProductImage} gibt es hier keinen Platzhalterpfad: diese
 * Motive sind Teil des Repos, sie fehlen nicht.
 */
export function BakeryPhoto({
  name,
  alt,
  ratio,
  sizes,
  eager = false,
  sx,
}: BakeryPhotoProps) {
  return (
    <Box
      sx={[
        {
          position: 'relative',
          width: '100%',
          aspectRatio: ratio,
          overflow: 'hidden',
          bgcolor: 'grey.100',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box component="picture">
        <source type="image/webp" srcSet={srcSet(name, 'webp')} sizes={sizes} />
        <Box
          component="img"
          className={BAKERY_PHOTO_MEDIA_CLASS}
          src={`${BASE}/${name}-medium.jpg`}
          srcSet={srcSet(name, 'jpg')}
          sizes={sizes}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? 'sync' : 'async'}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 320ms ease',
          }}
        />
      </Box>
    </Box>
  )
}

export default BakeryPhoto
