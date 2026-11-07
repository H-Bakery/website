'use client'
import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import type { ManagementProduct } from '../../../lib/products'
import { PENDING_APPROVAL_LABEL } from '../../../lib/products'
import { useOptionalSession } from '../../../lib/session'
import { formatCurrency } from '../../../lib/partnerTypes'
import {
  EmptyState,
  PageLayout,
  PageSection,
  ResponsiveList,
  type ResponsiveColumn,
} from '../../../components/layout'

/** Titel der Seite - auch für Laden/Fehler in `ProductsPageClient`. */
export const PRODUCTS_TITLE = 'Produkte'

/**
 * Filter der Liste. „Verfügbar“ zählt wie die Dashboard-Kachel die
 * Saisonware mit (beides steht im Shop) - vorher zeigte das Dashboard
 * „Verfügbar 56“ und diese Seite „Verfügbar 55“ mit derselben Bezeichnung.
 */
type StatusFilter = 'all' | 'available' | 'seasonal' | 'unavailable'

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Alle',
  available: 'Verfügbar',
  seasonal: 'Saisonal',
  unavailable: 'Nicht verfügbar',
}

function matchesFilter(product: ManagementProduct, filter: StatusFilter) {
  switch (filter) {
    case 'available':
      return product.status !== 'unavailable'
    case 'seasonal':
      return product.status === 'seasonal'
    case 'unavailable':
      return product.status === 'unavailable'
    default:
      return true
  }
}

/**
 * Status als Text, nicht als 56 gleiche farbige Chips: nur die Ausnahmen
 * (saisonal, nicht verfügbar) bekommen einen umrandeten Chip. Die gefüllten
 * Chips (dunkle Schrift auf getönter Fläche) lagen im Dunkelmodus unter
 * 4,5:1.
 */
function StatusCell({ product }: { product: ManagementProduct }) {
  if (product.status === 'active') {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        Verfügbar
      </Typography>
    )
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      color={product.status === 'seasonal' ? 'info' : 'error'}
      label={product.status === 'seasonal' ? 'Saisonal' : 'Nicht verfügbar'}
    />
  )
}

interface ProductListClientProps {
  products: ManagementProduct[]
}

export default function ProductListClient({
  products,
}: ProductListClientProps) {
  const router = useRouter()
  // F1/F4: Produkte schreibt nur der Inhaber (B5: PUT/POST `inhaber`).
  // Verkauf sieht die Liste lesend - ohne „Neues Produkt“ und Bearbeiten.
  // Ohne Sitzung (Specs) bleibt alles sichtbar; durchgesetzt wird in der API.
  const role = useOptionalSession()?.user?.role
  const canEdit = !role || role === 'inhaber'
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const result = {} as Record<StatusFilter, number>
    for (const key of Object.keys(FILTER_LABELS) as StatusFilter[]) {
      result[key] = products.filter((p) => matchesFilter(p, key)).length
    }
    return result
  }, [products])

  const pendingProducts = products.filter((p) => p.pendingApproval).length
  const needle = search.trim().toLocaleLowerCase('de')
  const visible = products.filter(
    (p) =>
      matchesFilter(p, filter) &&
      (!needle ||
        p.name.toLocaleLowerCase('de').includes(needle) ||
        p.category.toLocaleLowerCase('de').includes(needle))
  )
  const filtered = filter !== 'all' || needle !== ''

  const columns: ResponsiveColumn<ManagementProduct>[] = [
    {
      key: 'name',
      header: 'Produkt',
      primary: true,
      cell: (product) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            data-testid="product-name"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {product.name}
          </Typography>
          {product.pendingApproval && (
            <Chip
              label={PENDING_APPROVAL_LABEL}
              size="small"
              color="info"
              variant="outlined"
              title={
                product.approved
                  ? 'Geändert - im Shop gilt noch der freigegebene Stand'
                  : 'Neu angelegt - im Shop erst nach der Freigabe'
              }
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>
      ),
    },
    {
      key: 'category',
      header: 'Kategorie',
      inline: true,
      cell: (product) => (
        <Typography variant="body2" component="span" color="text.secondary">
          {product.category}
        </Typography>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      inline: true,
      cell: (product) => <StatusCell product={product} />,
    },
    {
      key: 'price',
      header: 'Preis',
      align: 'right',
      inline: true,
      cell: (product) => (
        <Typography
          variant="body2"
          component="span"
          fontWeight={600}
          noWrap
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrency(product.price)}
        </Typography>
      ),
    },
  ]

  return (
    <PageLayout
      title={PRODUCTS_TITLE}
      subtitle={
        canEdit
          ? 'Sortiment aus hq - bearbeiten und neu anlegen'
          : 'Freigegebener Produktkatalog zum Nachschlagen'
      }
      width="default"
      actions={
        canEdit ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/admin/products/new')}
          >
            Neues Produkt
          </Button>
        ) : undefined
      }
    >
      <PageSection
        title={`Produktliste (${
          filtered
            ? `${visible.length} von ${products.length}`
            : products.length
        })`}
        description={
          pendingProducts > 0
            ? `${
                pendingProducts === 1
                  ? '1 Änderung wartet auf Freigabe'
                  : `${pendingProducts} Änderungen warten auf Freigabe`
              } - im Shop gilt bis dahin der freigegebene Stand.`
            : undefined
        }
        disablePadding
      >
        {products.length === 0 ? (
          <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
            <EmptyState
              title="Keine Produkte gefunden."
              description="Die Produkte kommen aus dem hq-Produktverzeichnis. Ist es auf dem Server nicht eingerichtet (HQ_PRODUCTS_DIR), bleibt die Liste leer."
            />
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1.5,
                px: { xs: 2, md: 3 },
                pb: 2,
              }}
            >
              <TextField
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Produkt suchen"
                inputProps={{ 'aria-label': 'Produkt suchen' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: { xs: '1 1 100%', sm: '0 1 260px' } }}
              />
              <Box
                role="group"
                aria-label="Nach Status filtern"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => (
                  <Chip
                    key={key}
                    clickable
                    aria-pressed={filter === key}
                    color={filter === key ? 'primary' : 'default'}
                    variant={filter === key ? 'filled' : 'outlined'}
                    onClick={() => setFilter(key)}
                    label={`${FILTER_LABELS[key]} ${counts[key]}`}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                ))}
              </Box>
            </Box>
            <ResponsiveList
              aria-label="Produkte"
              rows={visible}
              columns={columns}
              rowKey={(product) => product.id}
              rowTestId={(product) => `product-row-${product.id}`}
              empty="Kein Produkt passt zu Suche und Filter."
              actionsHeader="Bearbeiten"
              actions={
                canEdit
                  ? (product) => (
                      <IconButton
                        color="primary"
                        // Touch-Ziel am Handy/Tablet mindestens 44 px.
                        sx={{ minWidth: 44, minHeight: 44 }}
                        aria-label={`${product.name} bearbeiten`}
                        onClick={() =>
                          router.push(`/admin/products/${product.id}`)
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )
                  : undefined
              }
            />
          </>
        )}
      </PageSection>
    </PageLayout>
  )
}
