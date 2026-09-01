'use client'

/**
 * @fileoverview Startseite des Shops – die Theke, nicht die Broschüre.
 *
 * Markengeschichte, Aktuelles, Kontakt und Karte gehören der Landingpage
 * (apps/bakery-landing). Was hier steht, hat genau einen Zweck: den Weg zur
 * Bestellung kurz machen. Die Reihenfolge der Bänder folgt dem:
 *
 *   Hero (Foto + Abholauskunft) → Zusagen → fertige Tüten (1 Klick zur
 *   Bestellung) → Kategorien → Auslage → Themenreihen → Belege → Abholweg
 *
 * Jedes werbliche Element ist an echte Daten gebunden. Erfundene Knappheit
 * („nur noch 2 übrig“), Countdown-Timer oder ausgedachte Bewertungen kommen
 * hier nicht hinein: es gibt keine Bestandsdaten, und in Deutschland ist das
 * unlauter (§ 5 UWG).
 *
 * ## Typografie
 *
 * Zwei Schriften, klar getrennte Aufgaben. Die Display-Serife (Cinzel) hat
 * keine echten Kleinbuchstaben – sie setzt Kapitälchen – und wird deshalb
 * **nur** dort eingesetzt, wo sie groß genug dafür ist:
 *
 * | Rolle                                   | Variante     | Schrift      |
 * | --------------------------------------- | ------------ | ------------ |
 * | Hero-Zeile                              | `h1`         | Cinzel       |
 * | Überschrift eines Bandes                | `h2`         | Cinzel       |
 * | Kennzahl (Bewertungsschnitt)            | `h3`         | Cinzel       |
 * | Titel einer Karte (Tüte)                | `h4`         | Cinzel       |
 * | Beschriftung (Zusage, Schritt, Kachel)  | `subtitle1`  | Merriweather |
 * | Name, Nebenzeile                        | `subtitle2`  | Merriweather |
 *
 * Vorher trugen Zusagen, Schritte und Kacheln `h6` – also Kapitälchen bei
 * 1 rem, die Zeile für Zeile schlechter zu erfassen sind als Fließschrift –
 * und `h4` bezeichnete gleichzeitig Kartentitel *und* Preise.
 *
 * ## Rhythmus
 *
 * Alle senkrechten Abstände und der einzige Eckradius stehen in
 * `storefront-rhythm.ts`. Die Sektionen liegen in einem Raster mit festem
 * `rowGap` statt jeweils eigenem `mb`: so kann keine Sektion aus dem Takt
 * fallen, und unter der letzten klebt kein toter Abstand mehr.
 */

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import BakeryDiningOutlinedIcon from '@mui/icons-material/BakeryDiningOutlined'
import CheckIcon from '@mui/icons-material/Check'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'

import { useCart } from '@bakery/shared/contexts'
import { BRAND_FACTS } from '@bakery/shared/utils'
import {
  SHOP_CATEGORIES,
  type ShopCategory,
  type ShopProduct,
} from '@bakery/shared/data-access'

import { BakeryPhoto, BAKERY_PHOTO_MEDIA_CLASS } from './bakery-photo'
import { BundleOffers } from './bundle-offers'
import { ProductGrid, ProductGridSkeleton } from './product-grid'
import { SocialProof } from './social-proof'
import { LoadErrorState } from './states'
import { StorefrontHero } from './storefront-hero'
import {
  BAND_Y,
  GRID_GAP,
  HEADING_GAP,
  SECTION_GAP,
  STRIP_Y,
  SURFACE_RADIUS,
} from './storefront-rhythm'
import { useShopProducts } from './use-shop-products'

/** So viele Waren zeigt die große Reihe auf der Startseite. */
const RAIL_SIZE = 8

/** So viele je Themenreihe – kurz genug, um nicht mit der großen zu konkurrieren. */
const THEME_RAIL_SIZE = 4

/** Wie lange die Warenkorb-Bestätigung stehen bleibt. */
const TOAST_MS = 4500

/** Was wir zusagen. Drei Sätze, alle nachprüfbar. */
const PROMISES: ReadonlyArray<{
  icon: React.ReactNode
  title: string
  text: string
}> = [
  {
    icon: <BakeryDiningOutlinedIcon />,
    title: 'Morgens gebacken',
    text: 'Was Sie bestellen, kommt am Abholtag frisch aus unserem Ofen.',
  },
  {
    icon: <AccessTimeOutlinedIcon />,
    title: 'Ohne Anstehen',
    text: 'Sie nennen uns die Uhrzeit, wir legen alles rechtzeitig zurück.',
  },
  {
    icon: <PaymentsOutlinedIcon />,
    title: 'Zahlung im Laden',
    text: 'Online wird nichts abgebucht. Bezahlt wird erst bei der Abholung.',
  },
]

/** Der Weg vom Warenkorb zur Tüte, in drei Sätzen. */
const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  { title: 'Aussuchen', text: 'Legen Sie in den Warenkorb, was Sie brauchen.' },
  {
    title: 'Abholzeit wählen',
    text: 'Tag und Uhrzeit angeben, Bestellung abschicken.',
  },
  {
    title: 'Abholen',
    text: `${BRAND_FACTS.street} in ${BRAND_FACTS.city}. Bezahlt wird vor Ort.`,
  },
]

/**
 * Kategorien, für die ein echtes Foto vorliegt. Die drei bekommen die großen
 * Kacheln; der Rest bleibt kompakt. Ein Foto neben einer Strichzeichnung sähe
 * zusammengewürfelt aus, deshalb hier Foto oder gar nichts.
 */
const CATEGORY_PHOTOS: Partial<
  Record<ShopCategory, { name: string; alt: string }>
> = {
  broetchen: {
    name: 'traditional-pretzels',
    alt: 'Korb mit frischen Brötchen auf der Theke der Bäckerei Heusser',
  },
  teilchen: {
    name: 'artisan-croissants',
    alt: 'Teilchen und Plundergebäck in der Theke, dahinter die Brotregale',
  },
  // Das Motiv zeigt eine Sahnetorte – es gehört zu „Torten“, nicht zu
  // „Kuchen“. Ein Bild unter die falsche Kategorie zu hängen, weil die
  // größer ist, wäre eine kleine Lüge mit großer Wirkung.
  torten: {
    name: 'homemade-cakes',
    alt: 'Sahnetorte mit Kirschen und Schokoraspeln',
  },
}

/**
 * Mischt zwei Kategorien abwechselnd, damit eine Themenreihe nicht aus vier
 * Brötchen und null Teilchen besteht. Deterministisch – die Reihenfolge kommt
 * aus der API, nichts wird gewürfelt (das bräche die Hydration).
 */
function interleave(
  first: ShopProduct[],
  second: ShopProduct[],
  limit: number
): ShopProduct[] {
  const mixed: ShopProduct[] = []
  for (let index = 0; mixed.length < limit; index += 1) {
    const a = first[index]
    const b = second[index]
    if (!a && !b) break
    if (a) mixed.push(a)
    if (b && mixed.length < limit) mixed.push(b)
  }
  return mixed
}

/**
 * Ein Querschnitt durch die Theke: reihum ein Produkt je Kategorie.
 *
 * Die API liefert nach `numeric_id` sortiert, und die ersten 25 Produkte sind
 * allesamt Brot – ein schlichtes `slice(0, 8)` zeigte also acht braune Laibe
 * und behauptete dabei, das Sortiment zu zeigen.
 */
function crossSection(products: ShopProduct[], limit: number): ShopProduct[] {
  const buckets = SHOP_CATEGORIES.map((category) =>
    products.filter((product) => product.category === category.key)
  )
  const picked: ShopProduct[] = []

  for (let round = 0; picked.length < limit; round += 1) {
    let addedInRound = false
    for (const bucket of buckets) {
      const product = bucket[round]
      if (!product) continue
      picked.push(product)
      addedInRound = true
      if (picked.length >= limit) break
    }
    if (!addedInRound) break
  }
  return picked
}

export function StorefrontHome() {
  const { products, status, error, reload } = useShopProducts()
  const cartMessage = useCartAdditions()

  const available = React.useMemo(
    () => products.filter((product) => product.available),
    [products]
  )

  const byCategory = React.useCallback(
    (category: ShopCategory) =>
      available.filter((product) => product.category === category),
    [available]
  )

  /** Saisonales zuerst, dann ein Querschnitt über alle Kategorien. */
  const rail = React.useMemo<ShopProduct[]>(() => {
    const seasonal = available
      .filter((product) => product.seasonal)
      .slice(0, RAIL_SIZE)
    const taken = new Set(seasonal.map((product) => product.id))
    const rest = crossSection(
      available.filter((product) => !taken.has(product.id)),
      RAIL_SIZE - seasonal.length
    )
    return [...seasonal, ...rest]
  }, [available])

  const breakfast = React.useMemo(
    () =>
      interleave(
        byCategory('broetchen'),
        byCategory('teilchen'),
        THEME_RAIL_SIZE
      ),
    [byCategory]
  )

  const coffee = React.useMemo(
    () =>
      interleave(byCategory('kuchen'), byCategory('torten'), THEME_RAIL_SIZE),
    [byCategory]
  )

  const hasSeasonal = rail.some((product) => product.seasonal)

  const countByCategory = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
    }
    return counts
  }, [products])

  return (
    <Box>
      <StorefrontHero productCount={products.length} />

      {/* Drei Zusagen – beantwortet die Fragen, die vor dem ersten Klick kommen. */}
      <Box
        component="section"
        aria-label="Wie der Vorbestell-Service funktioniert"
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container sx={{ py: STRIP_Y }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 4 },
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {PROMISES.map((promise) => (
              <Box
                key={promise.title}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    display: 'flex',
                    color: 'primary.main',
                    mt: 0.25,
                    '& svg': { fontSize: 26 },
                  }}
                >
                  {promise.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" component="h2">
                    {promise.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mt: 0.25 }}
                  >
                    {promise.text}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Ein Raster statt sechs einzelner `mb`: der Takt zwischen den
          Sektionen steht an genau einer Stelle. */}
      <Container
        sx={{
          py: BAND_Y,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          rowGap: SECTION_GAP,
        }}
      >
        {/* Fertige Tüten stehen bewusst ganz oben: kürzester Weg zur Bestellung. */}
        <Box component="section">
          <SectionHeading
            title="Keine Lust zu stöbern?"
            subtitle="Drei fertige Zusammenstellungen aus unserer Backstube – ein Klick, und alles liegt im Warenkorb."
          />
          {status === 'ready' && <BundleOffers products={products} />}
          {status === 'loading' && <BundleSkeleton />}
        </Box>

        {/* Kategorien in der Reihenfolge der Theke: Brot zuerst, Torten zuletzt. */}
        <Box component="section">
          <SectionHeading
            title="Was darf's sein?"
            subtitle={
              products.length > 0
                ? `Sieben Kategorien, ${products.length} Sorten – suchen Sie sich etwas aus.`
                : 'Sieben Kategorien aus unserer Backstube.'
            }
          />

          {/* Zwei Reihen statt einer: Foto- und Textkacheln in *derselben*
              Grid-Reihe wären unterschiedlich hoch, und über den Textkacheln
              klaffte die Lücke der fehlenden Bildfläche. */}
          <Box
            data-testid="category-tiles"
            sx={{ display: 'grid', rowGap: GRID_GAP }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: GRID_GAP,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {SHOP_CATEGORIES.filter(
                (category) => CATEGORY_PHOTOS[category.key]
              ).map((category) => {
                const photo = CATEGORY_PHOTOS[category.key]
                if (!photo) return null
                return (
                  <CategoryTile
                    key={category.key}
                    categoryKey={category.key}
                    label={category.label}
                    count={countByCategory.get(category.key) ?? 0}
                    photo={photo}
                  />
                )
              })}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: GRID_GAP,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {SHOP_CATEGORIES.filter(
                (category) => !CATEGORY_PHOTOS[category.key]
              ).map((category) => (
                <CategoryTile
                  key={category.key}
                  categoryKey={category.key}
                  label={category.label}
                  count={countByCategory.get(category.key) ?? 0}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Die große Reihe. Genau ein `product-grid` auf dieser Seite. */}
        <Box component="section">
          <SectionHeading
            title={
              hasSeasonal ? 'Gerade in der Saison' : 'Frisch aus der Backstube'
            }
            subtitle="Ein Querschnitt durch die Theke – der Rest steht im Katalog."
            action={
              <Button
                component={NextLink}
                href="/products"
                size="small"
                endIcon={<ArrowForwardIcon fontSize="small" />}
              >
                {products.length > 0
                  ? `Alle ${products.length} Sorten`
                  : 'Alle Sorten'}
              </Button>
            }
          />

          {status === 'loading' && <ProductGridSkeleton count={RAIL_SIZE} />}

          {status === 'error' && (
            <LoadErrorState
              message={error ?? 'Produkte konnten nicht geladen werden.'}
              onRetry={reload}
            />
          )}

          {status === 'ready' && rail.length > 0 && (
            <ProductGrid products={rail} testId="product-grid" />
          )}

          {status === 'ready' && rail.length === 0 && (
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Heute liegt nichts in der Theke. Schauen Sie später noch einmal
              vorbei.
            </Typography>
          )}
        </Box>

        {breakfast.length > 0 && (
          <Box component="section">
            <SectionHeading
              title="Zum Frühstück"
              subtitle="Brötchen und Teilchen – morgen früh liegt beides für Sie bereit."
              action={
                <Button
                  component={NextLink}
                  href="/products?category=broetchen"
                  size="small"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                >
                  Alle Brötchen
                </Button>
              }
            />
            <ProductGrid products={breakfast} testId="home-rail-breakfast" />
          </Box>
        )}

        {coffee.length > 0 && (
          <Box component="section">
            <SectionHeading
              title="Zum Kaffee"
              subtitle="Kuchen und Torten, stückweise oder ganz. Für Feiern gern früher bestellen."
              action={
                <Button
                  component={NextLink}
                  href="/products?category=kuchen"
                  size="small"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                >
                  Alle Kuchen
                </Button>
              }
            />
            <ProductGrid products={coffee} testId="home-rail-coffee" />
          </Box>
        )}
      </Container>

      {/* Belege statt Behauptungen. */}
      <Box
        component="section"
        sx={{
          bgcolor: 'grey.100',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container sx={{ py: BAND_Y }}>
          <SectionHeading
            title="Warum bei uns"
            subtitle="Was Nachbarinnen und Nachbarn öffentlich über uns schreiben – ungekürzt, mit der Note, die sie vergeben haben."
          />
          <SocialProof />
        </Container>
      </Box>

      {/* Abholung: der einzige Teil des Kaufs, der offline passiert. */}
      <Container sx={{ py: BAND_Y }}>
        <Box component="section">
          <SectionHeading
            title="So kommen Sie an Ihre Tüte"
            subtitle="Kein Versand, keine Vorkasse – Sie holen ab, wann es Ihnen passt."
          />

          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2.5, md: 4 },
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(0, 3fr) minmax(0, 2fr)',
              },
              alignItems: 'center',
            }}
          >
            {/* Nummeriert, weil es wirklich eine Reihenfolge ist: ohne
                Warenkorb keine Abholzeit, ohne Bestellung keine Tüte. */}
            <Box
              component="ol"
              sx={{
                display: 'grid',
                gap: GRID_GAP,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
                listStyle: 'none',
                m: 0,
                p: 0,
              }}
            >
              {STEPS.map((step, index) => (
                <Paper
                  key={step.title}
                  component="li"
                  variant="outlined"
                  sx={{ p: 3 }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      mb: 1.5,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="subtitle1" component="h3">
                    {step.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mt: 0.25 }}
                  >
                    {step.text}
                  </Typography>
                </Paper>
              ))}
            </Box>

            <Box
              component="img"
              src="/assets/images/bakery/theke.jpg"
              alt={`Die Verkaufstheke der Bäckerei Heusser in der ${BRAND_FACTS.street}`}
              loading="lazy"
              decoding="async"
              sx={{
                width: '100%',
                // 3:2 statt 4:3 – daneben stehen drei flache Schrittkarten,
                // und ein hochformatigeres Foto riss über und unter ihnen ein
                // Loch von 150 px auf.
                aspectRatio: '3 / 2',
                objectFit: 'cover',
                borderRadius: SURFACE_RADIUS,
                display: 'block',
              }}
            />
          </Box>
        </Box>
      </Container>

      <CartToast message={cartMessage} />
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Warenkorb-Bestätigung                                                       */
/* -------------------------------------------------------------------------- */

/** Ein Posten, der beim letzten Klick dazugekommen ist. */
interface CartAddition {
  name: string
  delta: number
}

/**
 * Der Satz, der nach dem Klick erscheint – und vorgelesen wird.
 *
 * Bis zu zwei Posten werden benannt (eine Tüte legt mehrere auf einmal ein);
 * darüber wäre die Aufzählung länger als die Bestätigung nützlich, dann zählt
 * sie nur noch. Das Verb richtet sich nach der Menge, nicht nach der Zahl der
 * Posten: „Sternweck liegt“, aber „6× Sternweck liegen“.
 */
export function cartAdditionText(
  additions: ReadonlyArray<CartAddition>,
  total: number
): string {
  if (additions.length === 0) return ''
  if (additions.length > 2) return `${total} Stück liegen im Warenkorb.`

  const subject = additions
    .map((entry) =>
      entry.delta > 1 ? `${entry.delta}× ${entry.name}` : entry.name
    )
    .join(' und ')

  return total === 1
    ? `${subject} liegt im Warenkorb.`
    : `${subject} liegen im Warenkorb.`
}

/**
 * Meldet, was gerade in den Warenkorb gewandert ist.
 *
 * Beobachtet wird der Warenkorb selbst, nicht der einzelne Knopf: dadurch
 * bestätigt dieselbe Meldung die Produktkarte, den Mengenregler *und* die
 * fertige Tüte, ohne dass jede Stelle ihre eigene Rückmeldung erfindet.
 *
 * Zwei Fallen sind hier bewusst umgangen:
 *
 * - **Der wiederhergestellte Warenkorb ist keine Zutat.** Beim ersten Lauf
 *   nach `isLoading` wird nur der Ausgangsstand gemerkt; sonst meldete die
 *   Seite bei jedem Neuladen „liegt im Warenkorb“.
 * - **Nur Zuwachs zählt.** Entfernen oder Herunterzählen löst nichts aus.
 */
function useCartAdditions(): string | null {
  const { items, isLoading } = useCart()
  const seen = React.useRef<Map<number, number> | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  React.useEffect(() => {
    if (isLoading) return

    const current = new Map<number, number>()
    for (const item of items) current.set(item.id, item.quantity)

    const before = seen.current
    seen.current = current
    if (!before) return

    const additions: CartAddition[] = []
    let total = 0
    for (const item of items) {
      const delta = item.quantity - (before.get(item.id) ?? 0)
      if (delta > 0) {
        total += delta
        additions.push({ name: item.name, delta })
      }
    }
    if (total === 0) return

    setMessage(cartAdditionText(additions, total))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(null), TOAST_MS)
  }, [items, isLoading])

  return message
}

/**
 * Die Bestätigung unten links – zurückhaltend, und die einzige Stelle der
 * Startseite, die das **Hinzufügen** meldet. (Die Produktkarte führt daneben
 * ihre eigene stille Statuszeile, die den *Stand* nennt – „2 × Kornbrot im
 * Warenkorb“ –, nicht das Ereignis.)
 *
 * Die Region steht immer im DOM, auch wenn sie leer ist: eine `aria-live`-Zone,
 * die zusammen mit ihrem Inhalt eingehängt wird, sagen manche Screenreader gar
 * nicht an. Der Rahmen fängt außerdem keine Klicks ab (`pointerEvents: none`);
 * nur der Knopf darin ist bedienbar, sonst läge ein unsichtbares Feld über der
 * Theke.
 */
function CartToast({ message }: { message: string | null }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        zIndex: (theme) => theme.zIndex.snackbar,
        bottom: { xs: 16, md: 24 },
        left: { xs: 16, md: 24 },
        right: { xs: 16, md: 'auto' },
        pointerEvents: 'none',
      }}
    >
      {message ? (
        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            maxWidth: 440,
            pl: 1.5,
            pr: 1,
            py: 1.25,
            boxShadow: 12,
            animation: 'cartToastIn 220ms ease-out',
            '@keyframes cartToastIn': {
              from: { opacity: 0, transform: 'translateY(10px)' },
              to: { opacity: 1, transform: 'none' },
            },
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: 'success.contrastText',
            }}
          >
            <CheckIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography
            variant="body2"
            sx={{ color: 'text.primary', minWidth: 0 }}
          >
            {message}
          </Typography>
          <Button
            component={NextLink}
            href="/cart"
            size="small"
            sx={{ ml: 'auto', flexShrink: 0, pointerEvents: 'auto' }}
          >
            Zum Warenkorb
          </Button>
        </Paper>
      ) : null}
    </Box>
  )
}

/* -------------------------------------------------------------------------- */
/* Bausteine der Seite                                                         */
/* -------------------------------------------------------------------------- */

/** Eine Kategoriekachel – mit Foto, wenn eines vorliegt, sonst kompakt. */
function CategoryTile({
  categoryKey,
  label,
  count,
  photo,
}: {
  categoryKey: ShopCategory
  label: string
  count: number
  photo?: { name: string; alt: string }
}) {
  return (
    <ButtonBase
      component={NextLink}
      href={`/products?category=${categoryKey}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        height: '100%',
        textAlign: 'left',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: SURFACE_RADIUS,
        bgcolor: 'background.paper',
        transition:
          'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        // Der Zoom sitzt hier, nicht im Bildmodul: die Kachel kennt den Hover.
        [`&:hover .${BAKERY_PHOTO_MEDIA_CLASS}`]: { transform: 'scale(1.05)' },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
          [`&:hover .${BAKERY_PHOTO_MEDIA_CLASS}`]: { transform: 'none' },
        },
      }}
    >
      {photo ? (
        <BakeryPhoto
          name={photo.name}
          alt={photo.alt}
          ratio="16 / 10"
          sizes="(max-width: 600px) 100vw, 33vw"
        />
      ) : null}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.75,
          width: '100%',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* Fließschrift statt Kapitälchen: die Kachel ist eine
              Beschriftung, keine Überschrift. */}
          <Typography
            variant="subtitle1"
            component="span"
            sx={{ display: 'block', color: 'text.primary' }}
          >
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {count > 0 ? `${count} Sorten` : 'Ansehen'}
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'primary.light', flexShrink: 0 }} />
      </Box>
    </ButtonBase>
  )
}

/** Platzhalter für die Tüten, damit die Sektion beim Laden nicht springt. */
function BundleSkeleton() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: 'grid',
        gap: GRID_GAP,
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'repeat(3, minmax(0, 1fr))',
        },
      }}
    >
      {[0, 1, 2].map((index) => (
        <Paper key={index} variant="outlined" sx={{ height: 320 }} />
      ))}
    </Box>
  )
}

/** Überschrift einer Startseiten-Sektion, optional mit Link nach rechts. */
function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: 2,
        rowGap: 1,
        mb: HEADING_GAP,
      }}
    >
      <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
        <Typography variant="h2" component="h2">
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.75,
              // Zeilenmaß statt Pixelbreite: bleibt bei jeder Schriftgröße
              // lesbar lang.
              maxWidth: '62ch',
            }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Box>
  )
}

export default StorefrontHome
