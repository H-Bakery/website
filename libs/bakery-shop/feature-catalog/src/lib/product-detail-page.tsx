'use client'

/**
 * @fileoverview Produktseite – ein Gebäck, eine Entscheidung.
 *
 * Kurzbeschreibung (Frontmatter) und Fließtext (Markdown-Rumpf) sind zwei
 * verschiedene Felder und bleiben es auch: die eine führt ein, der andere
 * erklärt.
 *
 * Vier Dinge sind hier absichtlich so gebaut und sollten so bleiben:
 *
 * - **Der Server entscheidet, ob es das Produkt gibt.** `initialProduct` kennt
 *   drei Zustände, und der Unterschied zwischen zweien davon ist der ganze
 *   Punkt: `undefined` heißt „der Server konnte nicht nachsehen" (API weg) und
 *   führt in den Browser-Ladepfad mit Wiederholen-Knopf; `null` heißt „der
 *   Server hat nachgesehen, es gibt das nicht" und führt sofort in den
 *   Leerzustand. Ein Netzwerkfehler darf nie wie ein gelöschtes Produkt
 *   aussehen. Kommt ein Produkt mit, rendert die Seite es ohne einen einzigen
 *   Ladezustand — und genau deshalb steht der Produktname auch im HTML, das
 *   ein Crawler zu sehen bekommt.
 * - **Die Allergene stehen in einem eigenen Block, nicht im Fließtext.** Das
 *   ist eine Pflichtangabe (Anhang II LMIV, § 4 LMIDV), keine Werbung. Es gibt
 *   dort ausschließlich positive Aussagen: „enthält …". Nie „frei von", nie
 *   „glutenfrei" — und ein Produkt ohne geprüfte Angabe wird nie so gerendert,
 *   als wäre es allergenfrei. Der Unterschied zwischen `null` (nicht
 *   deklariert) und `[]` läuft von `hq` bis hierher durch; siehe
 *   {@link readAllergenDeclaration}.
 * - **Die Vorbestellfrist steht über dem Knopf, nicht dahinter.** Wer eine
 *   Torte für 45 € in den Warenkorb legt, muss vorher wissen, dass sie zwei
 *   Tage braucht — sonst erfährt er es erst an der Kasse.
 * - **„Passt dazu" ist gerechnet, nicht gewürfelt.** {@link selectRelatedProducts}
 *   ist eine reine Funktion über dem echten Katalog: gleiche Eingabe, gleiche
 *   Ausgabe. `Math.random()` bräche die Hydration und die e2e-Suite.
 */

import * as React from 'react'
import NextLink from 'next/link'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import RemoveIcon from '@mui/icons-material/Remove'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

import { useCart } from '@bakery/shared/contexts'
import {
  productUnit,
  shopCategoryLabel,
  toCartProduct,
  unitPriceLabel,
  type ShopCategory,
  type ShopProduct,
} from '@bakery/shared/data-access'
import { leadTimeRuleFor } from '@bakery/shop/feature-cart'
import {
  ALLERGEN_SOURCE_NOTES,
  CROSS_CONTAMINATION_NOTE,
  NO_DECLARATION_NOTE,
  formatAllergens,
  readAllergenDeclaration,
} from '@bakery/shared/utils'

import { ProductDescription } from './product-description'
import { ShopPrice } from './product-card'
import { ProductGrid } from './product-grid'
import { ProductImage, isUsableProductImage } from './product-image'
import { EmptyState, LoadErrorState } from './states'
import { useShopProduct, useShopProducts } from './use-shop-products'

/** Obergrenze des Warenkorbs pro Position (CartProvider: `maxQuantityPerItem`). */
const MAX_QUANTITY = 99

/** Lesebreite für die Textblöcke unter dem Kaufkasten. */
const READING_WIDTH = 860

const detailLayoutSx = {
  display: 'grid',
  gap: { xs: 3, md: 5 },
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    md: 'minmax(0, 5fr) minmax(0, 6fr)',
  },
  alignItems: 'start',
}

/* -------------------------------------------------------------------------- */
/* „Passt dazu"                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Was zu einer Kategorie auf denselben Tisch gehört.
 *
 * Kuratiert, nicht gerechnet: es gibt keine Verkaufsdaten im Shop, also gibt es
 * auch kein „wird oft zusammen gekauft" — das wäre eine erfundene Behauptung
 * (§ 5 UWG). Was hier steht, ist die Frühstücks- und Kaffeetisch-Logik einer
 * Bäckerei, mehr nicht.
 *
 * Die eigene Kategorie steht bewusst **nicht** in der Liste: sie wird ohnehin
 * als letzter Eimer angehängt, wenn die ergänzenden nicht genug hergeben.
 */
const COMPLEMENTARY_CATEGORIES: Readonly<
  Record<ShopCategory, readonly ShopCategory[]>
> = {
  brot: ['broetchen', 'teilchen'],
  broetchen: ['teilchen', 'snacks'],
  baguette: ['snacks', 'broetchen'],
  teilchen: ['broetchen', 'kuchen'],
  snacks: ['broetchen', 'baguette'],
  kuchen: ['teilchen', 'torten'],
  torten: ['kuchen', 'teilchen'],
}

/** So viele Karten passt die Reihe auf einer Rasterzeile (md: vier Spalten). */
const RELATED_LIMIT = 4

/**
 * Unter zwei Treffern entfällt die Reihe.
 *
 * Eine einzelne Karte unter der Überschrift „Passt dazu" sieht nach Rest aus,
 * nicht nach Empfehlung. Lieber nichts als Füllmaterial.
 */
const RELATED_MINIMUM = 2

/** Größen- und Portionsendungen: `-500g`, `-1000g`, `-1-stueck`, `-1-4-stueck`. */
const SIZE_SUFFIX = /-(?:\d+(?:-\d+)?-stueck|\d+(?:g|kg))$/

/**
 * Der Artikel ohne seine Größenangabe: `kornbrot-500g` → `kornbrot`,
 * `sahnerollen-1-stueck` → `sahnerollen`.
 *
 * Damit unter „Passt dazu" nicht dasselbe Gebäck in einer anderen Größe steht —
 * das ist eine Alternative, keine Ergänzung.
 */
export function baseProductId(id: string): string {
  return typeof id === 'string' ? id.replace(SIZE_SUFFIX, '') : ''
}

/**
 * Reihenfolge innerhalb einer Kategorie: erst was ein Bild hat, dann nach
 * Artikelnummer.
 *
 * 43 der 103 `hq`-Produkte tragen den Müllwert `image: "images/"` und rendern
 * einen Platzhalter. Das Bild zu bevorzugen versteckt nichts — jeder Kandidat
 * ist gleich passend — es stellt nur die brauchbarere Karte nach vorn. Die
 * Artikelnummer als zweiter Schlüssel macht die Reihenfolge total: gleiche
 * Eingabe, gleiche Ausgabe, auf Server und Client.
 */
function rankRelated(list: readonly ShopProduct[]): ShopProduct[] {
  return [...list].sort((left, right) => {
    const pictures =
      Number(isUsableProductImage(right.image)) -
      Number(isUsableProductImage(left.image))
    if (pictures !== 0) return pictures
    return left.numericId - right.numericId
  })
}

/**
 * Wählt bis zu {@link RELATED_LIMIT} passende Produkte zu einem Artikel.
 *
 * Reihum je ein Treffer aus den ergänzenden Kategorien und aus der eigenen —
 * so steht nie viermal dasselbe Regal in der Reihe. Ausgeschlossen sind das
 * Produkt selbst, jede andere Größe desselben Gebäcks und alles, was gerade
 * nicht verfügbar ist.
 *
 * @returns eine leere Liste, wenn weniger als {@link RELATED_MINIMUM} Treffer
 * zusammenkommen. Der Aufrufer rendert dann nichts.
 */
export function selectRelatedProducts(
  product: ShopProduct,
  catalog: readonly ShopProduct[],
  limit = RELATED_LIMIT
): ShopProduct[] {
  if (!product || !Array.isArray(catalog)) return []

  const base = baseProductId(product.id)
  const usable = catalog.filter(
    (candidate) =>
      candidate &&
      candidate.available &&
      candidate.id !== product.id &&
      baseProductId(candidate.id) !== base
  )

  const categories: ShopCategory[] = [
    ...(COMPLEMENTARY_CATEGORIES[product.category] ?? []),
    product.category,
  ]
  const buckets = categories.map((category) =>
    rankRelated(usable.filter((candidate) => candidate.category === category))
  )

  const picked: ShopProduct[] = []
  const seen = new Set<string>()

  for (let round = 0; picked.length < limit; round += 1) {
    let addedThisRound = false

    for (const bucket of buckets) {
      const candidate = bucket[round]
      if (!candidate || seen.has(candidate.id)) continue
      seen.add(candidate.id)
      picked.push(candidate)
      addedThisRound = true
      if (picked.length >= limit) break
    }

    if (!addedThisRound) break
  }

  return picked.length >= RELATED_MINIMUM ? picked : []
}

/**
 * Die Reihe unter der Produktseite.
 *
 * Sie lädt den Katalog selbst und erst im Browser: die Auswahl über 103
 * Produkte als Prop mitzuschicken hätte die Seite um ein Vielfaches ihrer
 * eigentlichen Nutzlast aufgebläht. Fällt der Katalog aus, entfällt die Reihe
 * still — sie ist ein Angebot, kein Versprechen.
 */
function RelatedProducts({ product }: { product: ShopProduct }) {
  const { products, status } = useShopProducts()

  const related = React.useMemo(
    () => (status === 'ready' ? selectRelatedProducts(product, products) : []),
    [product, products, status]
  )

  if (related.length === 0) return null

  return (
    <Box
      component="section"
      aria-labelledby="passt-dazu"
      data-testid="related-products"
      sx={{ mt: { xs: 5, md: 8 } }}
    >
      <Typography
        id="passt-dazu"
        variant="h3"
        component="h2"
        sx={{ mb: { xs: 2, md: 2.5 } }}
      >
        Passt dazu
      </Typography>
      <ProductGrid products={related} testId="related-product-grid" />
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Allergene                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Die Pflichtangabe zum Gebäck — eigener Kasten, eigene Überschrift.
 *
 * Sie steht bewusst **nicht** im Fließtext „Gut zu wissen": das ist Werbetext
 * und wird pro Produkt in `hq` frei geschrieben. Hier steht ausschließlich,
 * was die Daten hergeben.
 *
 * Beide Fälle sehen gleich aus, und das ist Absicht. Ein Produkt ohne geprüfte
 * Angabe bekommt keinen Fehlerkasten und keine Entschuldigung, sondern eine
 * gerade Auskunft samt Telefonnummer — § 4 LMIDV lässt für unverpackte Ware
 * genau das zu.
 */
function FoodInformation({ product }: { product: ShopProduct }) {
  // Explizit gebaut statt das Produkt durchzureichen: `ShopProduct` ist ein
  // Interface und damit nicht auf `Record<string, unknown>` zuweisbar.
  const declaration = readAllergenDeclaration({
    allergens: product.allergens,
    allergensSource: product.allergensSource,
    allergenRecipe: product.allergenRecipe,
  })

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="allergene"
      data-testid="product-allergens"
      sx={{
        mt: 4,
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        bgcolor: 'grey.50',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: { xs: 1, md: 1.5 },
        }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
        <Typography id="allergene" variant="h4" component="h2">
          Allergene
        </Typography>
      </Box>

      {declaration ? (
        <>
          {/* Nur positive Aussagen. Es gibt in dieser Datei keinen Zweig, der
              Abwesenheit behauptet — ein falsches „enthält nicht" bringt
              jemanden ins Krankenhaus. */}
          <Typography variant="body1" data-testid="product-allergen-list">
            Enthält{' '}
            <Box component="strong" sx={{ fontWeight: 700 }}>
              {formatAllergens(declaration.allergens)}
            </Box>
            .
          </Typography>

          {declaration.recipe ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              Aus unserem Rezept „{declaration.recipe}“.
            </Typography>
          ) : null}

          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {ALLERGEN_SOURCE_NOTES[declaration.source]}
          </Typography>
        </>
      ) : (
        <Typography variant="body1" data-testid="product-allergens-unknown">
          {NO_DECLARATION_NOTE}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {CROSS_CONTAMINATION_NOTE}
      </Typography>
    </Paper>
  )
}

/* -------------------------------------------------------------------------- */
/* Rahmen                                                                      */
/* -------------------------------------------------------------------------- */

function DetailBreadcrumbs({
  name,
  category,
}: {
  name?: string
  category?: ShopCategory
}) {
  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="Pfad"
      sx={{ mb: 2 }}
    >
      <Link component={NextLink} href="/" color="inherit">
        Startseite
      </Link>
      <Link component={NextLink} href="/products" color="inherit">
        Alle Produkte
      </Link>
      {category ? (
        <Link
          component={NextLink}
          href={`/products?category=${category}`}
          color="inherit"
        >
          {shopCategoryLabel(category)}
        </Link>
      ) : null}
      {name ? (
        <Typography component="span" sx={{ color: 'text.secondary' }}>
          {name}
        </Typography>
      ) : null}
    </Breadcrumbs>
  )
}

function DetailSkeleton() {
  return (
    <Box sx={detailLayoutSx}>
      <Skeleton
        variant="rounded"
        sx={{ width: '100%', aspectRatio: '1 / 1' }}
      />
      <Box>
        <Skeleton width="30%" height={22} />
        <Skeleton width="70%" height={48} />
        <Skeleton width="90%" height={24} />
        <Skeleton width="35%" height={40} sx={{ mt: 3 }} />
        <Skeleton variant="rounded" height={52} sx={{ mt: 3 }} />
        <Skeleton width="100%" height={20} sx={{ mt: 4 }} />
        <Skeleton width="95%" height={20} />
        <Skeleton width="60%" height={20} />
      </Box>
    </Box>
  )
}

/** Der ehrliche Leerzustand für eine URL, hinter der kein Produkt liegt. */
function ProductNotFound() {
  return (
    <EmptyState
      testId="product-not-found"
      headline="Das haben wir nicht mehr"
      hint="Dieses Produkt gibt es bei uns nicht (mehr). In der Theke liegt bestimmt etwas anderes für Sie."
      action={
        <Button component={NextLink} href="/products" variant="contained">
          Weiter stöbern
        </Button>
      }
    />
  )
}

export interface ProductDetailPageProps {
  /** Slug (`kornbrot-500g`) oder numerische Id (`1`) aus der URL. */
  pid: string
  /**
   * Was der Server über dieses Produkt herausgefunden hat.
   *
   * | Wert        | Bedeutung                        | Anzeige                     |
   * | ----------- | -------------------------------- | --------------------------- |
   * | `ShopProduct` | gefunden                       | sofort, ohne Ladezustand    |
   * | `null`      | nachgesehen, gibt es nicht       | sofort der Leerzustand      |
   * | `undefined` | konnte nicht nachsehen (API weg) | im Browser laden, mit Retry |
   *
   * Die untere Zeile ist der Grund für diese Dreiteilung: ein Ausfall der API
   * darf nicht aussehen wie ein gelöschtes Produkt.
   */
  initialProduct?: ShopProduct | null
}

/**
 * Die Produktseite.
 *
 * Kommt `initialProduct` mit, rendert sie ohne eigenen Ladevorgang — dann
 * steht der Inhalt schon im ausgelieferten HTML. Sonst lädt sie im Browser
 * nach.
 */
export function ProductDetailPage({
  pid,
  initialProduct,
}: ProductDetailPageProps) {
  if (initialProduct !== undefined) {
    return (
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <DetailBreadcrumbs
          name={initialProduct?.name}
          category={initialProduct?.category}
        />
        {initialProduct ? (
          <ProductDetail product={initialProduct} />
        ) : (
          <ProductNotFound />
        )}
      </Container>
    )
  }

  return <BrowserLoadedDetail pid={pid} />
}

/** Der Weg für den Fall, dass der Server das Produkt nicht laden konnte. */
function BrowserLoadedDetail({ pid }: { pid: string }) {
  const { product, status, notFound, error, reload } = useShopProduct(pid)

  return (
    <Container sx={{ py: { xs: 3, md: 5 } }}>
      <DetailBreadcrumbs name={product?.name} category={product?.category} />

      {status === 'loading' && <DetailSkeleton />}

      {status === 'error' && (
        <LoadErrorState
          title="Produkt nicht erreichbar"
          message={error ?? 'Produkt konnte nicht geladen werden.'}
          onRetry={reload}
        />
      )}

      {status === 'ready' && notFound && <ProductNotFound />}

      {status === 'ready' && product && <ProductDetail product={product} />}
    </Container>
  )
}

/* -------------------------------------------------------------------------- */
/* Die Seite selbst                                                            */
/* -------------------------------------------------------------------------- */

function ProductDetail({ product }: { product: ShopProduct }) {
  const { addToCart } = useCart()
  const [quantityText, setQuantityText] = React.useState('1')
  const [addedQuantity, setAddedQuantity] = React.useState(0)

  const quantity = React.useMemo(() => {
    const parsed = Number.parseInt(quantityText, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return 1
    return Math.min(parsed, MAX_QUANTITY)
  }, [quantityText])

  const setQuantity = (next: number) => {
    setQuantityText(String(Math.min(Math.max(next, 1), MAX_QUANTITY)))
  }

  const handleAdd = () => {
    if (!product.available) return
    addToCart(toCartProduct(product), quantity)
    setAddedQuantity(quantity)
  }

  const hasOwnBody =
    product.description.length > 0 &&
    product.description !== product.shortDescription

  /** § 4 PAngV: bei Ware nach Gewicht gehört der Preis je Kilogramm daneben. */
  const grundpreis = unitPriceLabel({
    name: product.name,
    price: product.price,
  })

  /** Ganze Torten brauchen zwei Tage, ganze Kuchen einen. */
  const leadTime = leadTimeRuleFor({
    id: product.id,
    category: product.category,
  })

  return (
    <Box data-testid="product-detail">
      <Box sx={detailLayoutSx}>
        <Paper
          variant="outlined"
          sx={{
            overflow: 'hidden',
            borderRadius: 2,
            position: { md: 'sticky' },
            top: { md: 24 },
          }}
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            ratio="1 / 1"
            placeholderSize={96}
          />
        </Paper>

        <Box>
          <Chip
            component={NextLink}
            href={`/products?category=${product.category}`}
            clickable
            size="small"
            variant="outlined"
            label={shopCategoryLabel(product.category)}
            sx={{ mb: 1.5 }}
          />

          <Typography
            data-testid="product-detail-name"
            variant="h1"
            component="h1"
            sx={{ mb: 1 }}
          >
            {product.name}
          </Typography>

          {product.shortDescription && (
            <Typography
              variant="subtitle1"
              component="p"
              sx={{ color: 'text.secondary', fontWeight: 400, mb: 2.5 }}
            >
              {product.shortDescription}
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <ShopPrice
              value={product.price}
              size="xl"
              testId="product-detail-price"
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              pro {productUnit(product)} · inkl. MwSt.
            </Typography>
          </Box>

          {grundpreis ? (
            <Typography
              data-testid="product-unit-price"
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.25 }}
            >
              Grundpreis: {grundpreis}
            </Typography>
          ) : null}

          <Box sx={{ mt: 2 }}>
            <Chip
              size="small"
              color={product.available ? 'success' : 'default'}
              variant="outlined"
              label={
                product.available
                  ? 'Frisch im Angebot'
                  : 'Zur Zeit nicht verfügbar'
              }
            />
          </Box>

          {/* Vor dem Knopf, nicht dahinter: wer eine Torte in den Warenkorb
              legt, soll die Frist vorher kennen. */}
          {leadTime.hours > 0 ? (
            <Alert
              severity="info"
              icon={<EventAvailableIcon fontSize="inherit" />}
              data-testid="product-lead-time"
              sx={{ mt: 2 }}
            >
              <AlertTitle sx={{ mb: 0.25 }}>Bitte vorbestellen</AlertTitle>
              {leadTime.reason}
            </Alert>
          ) : null}

          <Divider sx={{ my: 3 }} />

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                data-testid="quantity-decrease"
                aria-label="Menge verringern"
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>

              <TextField
                value={quantityText}
                size="small"
                onChange={(event) =>
                  setQuantityText(event.target.value.replace(/[^0-9]/g, ''))
                }
                onBlur={() => setQuantityText(String(quantity))}
                sx={{ width: 84 }}
                inputProps={{
                  'data-testid': 'quantity-input',
                  'aria-label': 'Menge',
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  style: { textAlign: 'center' },
                }}
              />

              <IconButton
                data-testid="quantity-increase"
                aria-label="Menge erhöhen"
                disabled={quantity >= MAX_QUANTITY}
                onClick={() => setQuantity(quantity + 1)}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>

            <Button
              data-testid="detail-add-to-cart"
              variant="contained"
              size="large"
              disabled={!product.available}
              onClick={handleAdd}
              startIcon={<AddShoppingCartIcon />}
              sx={{ flexGrow: { xs: 1, sm: 0 } }}
            >
              In den Warenkorb
            </Button>
          </Box>

          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              color: 'text.secondary',
              mt: 1.5,
            }}
          >
            <StorefrontOutlinedIcon fontSize="small" aria-hidden="true" />
            Bezahlt wird im Laden, bei der Abholung.
          </Typography>

          {addedQuantity > 0 && (
            <Alert
              severity="success"
              sx={{ mt: 2 }}
              action={
                <Button
                  component={NextLink}
                  href="/cart"
                  color="inherit"
                  size="small"
                >
                  Zum Warenkorb
                </Button>
              }
            >
              {addedQuantity} × {product.name} im Warenkorb.
            </Alert>
          )}

          {!product.available && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Das backen wir gerade nicht. Fragen Sie im Laden nach, wann es
              wieder in die Theke kommt.
            </Alert>
          )}
        </Box>
      </Box>

      {/* Lesestoff und Pflichtangabe stehen unter dem Kaufkasten, in
          Lesebreite — nicht in der schmalen rechten Spalte. */}
      <Box sx={{ maxWidth: READING_WIDTH, mt: { xs: 5, md: 7 } }}>
        {hasOwnBody && (
          <Box component="section" aria-labelledby="gut-zu-wissen">
            <Typography
              id="gut-zu-wissen"
              variant="h4"
              component="h2"
              sx={{ mb: 1.5 }}
            >
              Gut zu wissen
            </Typography>
            <ProductDescription text={product.description} />
          </Box>
        )}

        <FoodInformation product={product} />

        <Box
          sx={{
            mt: 3,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Artikelnummer {product.numericId}
          </Typography>
          <Button
            component={NextLink}
            href="/products"
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
          >
            Weiter stöbern
          </Button>
        </Box>
      </Box>

      <RelatedProducts product={product} />
    </Box>
  )
}

export default ProductDetailPage
