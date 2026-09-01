/**
 * @fileoverview Öffentliche Oberfläche der Katalog-Bibliothek des Shops.
 * @module @bakery/shop/feature-catalog
 *
 * Genau drei Flächen. Keine davon rendert Header oder Footer – die Chrome
 * gehört dem App-Layout (apps/bakery-shop/src/app/layout.tsx).
 */

export { StorefrontHome } from './lib/storefront-home'
export { CatalogPage } from './lib/catalog-page'
export {
  ProductDetailPage,
  type ProductDetailPageProps,
} from './lib/product-detail-page'

/* -------------------------------------------------------------------------- */
/* Bausteine, die der ganze Laden teilt                                        */
/* -------------------------------------------------------------------------- */

/**
 * `ShopPrice` ist das **einzige** Preis-Token des Shops. Jeder Betrag – Karte,
 * Detailseite, Warenkorbzeile, Summe, Bestellbestätigung – geht hier durch,
 * damit dieselbe Zahl nicht fünfmal anders aussieht. Es setzt `formatEuro`,
 * `tabular-nums` und die vier erlaubten Größen (`sm` | `md` | `lg` | `xl`).
 *
 * ```tsx
 * import { ShopPrice } from '@bakery/shop/feature-catalog'
 *
 * <ShopPrice value={product.price} size="xl" testId="product-detail-price" />
 * <ShopPrice value={line.price} size="sm" tone="plain" note="pro Stück" />
 * ```
 */
export {
  ShopPrice,
  type ShopPriceProps,
  type ShopPriceSize,
  ShopProductCard,
  type ShopProductCardProps,
  ShopProductCardSkeleton,
  CARD_IMAGE_RATIO,
} from './lib/product-card'

export {
  ProductImage,
  type ProductImageProps,
  type ProductImageFit,
  CategoryMotif,
  type CategoryMotifProps,
  isUsableProductImage,
  NO_PHOTO_LABEL,
} from './lib/product-image'

export {
  ProductGrid,
  type ProductGridProps,
  ProductGridSkeleton,
  productGridSx,
} from './lib/product-grid'

/**
 * Ladezustände: `ShopSkeleton` / `ShopSkeletonText` ersetzen die verbliebenen
 * `CircularProgress` im Laden. Sie tragen den sichtbaren Skelett-Ton –
 * MUIs Voreinstellung liegt bei 1,13:1 auf Weiß und ist damit unsichtbar.
 */
export {
  ShopSkeleton,
  type ShopSkeletonProps,
  ShopSkeletonText,
  type ShopSkeletonTextProps,
  SHOP_SKELETON_BAR,
  SHOP_SKELETON_BLOCK,
  EmptyState,
  type EmptyStateProps,
  LoadErrorState,
  type LoadErrorStateProps,
} from './lib/states'
