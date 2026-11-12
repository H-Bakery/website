'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  TextField,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import {
  NEW_RECIPE_HREF,
  RECIPES_HREF,
  fetchRecipes,
  ingredientCountText,
  recipeHref,
  yieldText,
  type RecipeList,
  type RecipeSummary,
} from '../../../lib/recipesApi'
import type {
  RecipeListFilters,
  RecipeListFlash,
} from '../../../lib/recipeQuery'
import { canWriteRecipes } from '../../../lib/roles'
import { useOptionalSession } from '../../../lib/session'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import { errorText } from '../partners/errorText'
import { RecipeStatusChips } from '../../../components/rezepte/RecipeStatusChips'

export const RECIPES_TITLE = 'Rezepte'

/** Filter-Chips sind Knöpfe: am Tablet mindestens 44 px hoch (wie Produkte). */
const FILTER_CHIP_SX = {
  fontVariantNumeric: 'tabular-nums',
  [TOUCH_MEDIA]: { height: 44, borderRadius: 22, px: 0.5 },
} as const

/** Wartezeit nach dem letzten Tastendruck, bevor gesucht wird. */
const SEARCH_DELAY_MS = 250

function listHref(filters: RecipeListFilters): string {
  const params = new URLSearchParams()
  if (filters.category) params.set('kategorie', filters.category)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  const query = params.toString()
  return query ? `${RECIPES_HREF}?${query}` : RECIPES_HREF
}

function RecipeRow({
  recipe,
  showReadOnly,
}: {
  recipe: RecipeSummary
  showReadOnly: boolean
}) {
  const deleted = recipe.pending === 'deleted'
  return (
    <ListItemButton
      component={Link}
      href={recipeHref(recipe)}
      data-testid={`recipe-row-${recipe.id}`}
      divider
      sx={{
        minHeight: 64,
        px: { xs: 2, md: 3 },
        py: 1.25,
        gap: 1.5,
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 2,
          rowGap: 0.75,
        }}
      >
        <Box sx={{ flex: '1 1 14rem', minWidth: 0 }}>
          <Typography
            component="span"
            data-testid="recipe-title"
            sx={{
              display: 'block',
              fontWeight: 600,
              fontSize: '1.0625rem',
              overflowWrap: 'anywhere',
              color: deleted ? 'text.secondary' : 'text.primary',
              textDecoration: deleted ? 'line-through' : 'none',
            }}
          >
            {recipe.title}
          </Typography>
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', overflowWrap: 'anywhere' }}
          >
            {`${yieldText(recipe.yield)} · ${ingredientCountText(
              recipe.ingredientCount
            )}`}
          </Typography>
        </Box>
        <RecipeStatusChips recipe={recipe} showReadOnly={showReadOnly} />
      </Box>
      <ChevronRightIcon
        aria-hidden="true"
        sx={{ color: 'text.secondary', flexShrink: 0 }}
      />
    </ListItemButton>
  )
}

interface Props {
  initialFilters?: RecipeListFilters
  /** Hinweis nach dem Löschen (aus der Adresse). */
  flash?: RecipeListFlash | null
}

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; list: RecipeList }
  | { phase: 'error'; message: string }

/**
 * `/admin/rezepte`: alle Rezepte aus hq nach Kategorie, mit Suche (Name,
 * Zutat) und Kategorie-Filter. Lesen dürfen Inhaber, Backstubenleitung und
 * Backstube; „Neues Rezept“ sehen nur Inhaber und Backstubenleitung (die API
 * setzt es durch).
 */
export default function RecipeListClient({
  initialFilters = { category: null, q: '' },
  flash,
}: Props) {
  const role = useOptionalSession()?.user?.role
  // Ohne Sitzung (Specs) bleibt alles sichtbar; durchgesetzt wird in der API.
  const canWrite = !role || canWriteRecipes(role)
  const [state, setState] = React.useState<State>({ phase: 'loading' })
  const [category, setCategory] = React.useState<string | null>(
    initialFilters.category
  )
  const [search, setSearch] = React.useState(initialFilters.q)
  /** Der Suchtext, mit dem die gezeigte Liste geladen wurde. */
  const [query, setQuery] = React.useState(initialFilters.q.trim())
  const [searching, setSearching] = React.useState(false)
  const [notice, setNotice] = React.useState<RecipeListFlash | null>(
    flash ?? null
  )
  const requestRef = React.useRef(0)

  const load = React.useCallback(async (q: string, quiet: boolean) => {
    const request = ++requestRef.current
    if (quiet) setSearching(true)
    else setState({ phase: 'loading' })
    try {
      const list = await fetchRecipes({ q })
      if (request !== requestRef.current) return
      setState({ phase: 'ok', list })
      setQuery(q)
    } catch (err) {
      if (request !== requestRef.current) return
      setState({
        phase: 'error',
        message: errorText(err, 'Die Rezepte konnten nicht geladen werden.'),
      })
    } finally {
      if (request === requestRef.current) setSearching(false)
    }
  }, [])

  // Erstes Laden; danach sucht der Server (auch in Zutaten), sobald das
  // Tippen kurz ruht.
  const first = React.useRef(true)
  React.useEffect(() => {
    const q = search.trim()
    if (first.current) {
      first.current = false
      load(q, false)
      return undefined
    }
    if (q === query) {
      // Zurück beim Text der gezeigten Liste (z. B. Suchfeld wieder
      // geleert): eine Suche, die noch unterwegs ist, gilt nicht mehr -
      // sonst filterte ihre späte Antwort die Liste nach einem Text, der
      // nicht mehr im Feld steht.
      requestRef.current += 1
      setSearching(false)
      return undefined
    }
    const timer = window.setTimeout(() => load(q, true), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
    // `query` ändert sich nur durch `load` selbst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, load])

  // Filter in der Adresse halten: „Zurück“ aus einem Rezept landet wieder
  // in derselben Auswahl. Der Hinweis nach dem Löschen fällt dabei weg.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const href = listHref({ category, q: query })
    const current = window.location.pathname + window.location.search
    if (current !== href && window.location.pathname === RECIPES_HREF) {
      window.history.replaceState(window.history.state, '', href)
    }
  }, [category, query])

  if (state.phase === 'loading') {
    return (
      <PageLayout title={RECIPES_TITLE}>
        <LoadingState label="Rezepte werden geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title={RECIPES_TITLE}>
        <ErrorState
          message={state.message}
          onRetry={() => load(search.trim(), false)}
        />
      </PageLayout>
    )
  }

  const list = state.list
  const noData = list.status === 'no-data'
  const total = list.categories.reduce((sum, c) => sum + c.count, 0)
  const matches = list.recipes
  const visible = category
    ? matches.filter((recipe) => recipe.category === category)
    : matches
  const filtered = query !== '' || category !== null
  const pendingCount = matches.filter((r) => r.pendingApproval).length
  // Kategorien mit Rezepten (die gewählte bleibt stehen, auch wenn leer).
  const categories = list.categories.filter(
    (c) => c.count > 0 || c.id === category
  )
  const matchCount = (id: string) =>
    matches.filter((recipe) => recipe.category === id).length
  const groups = list.categories
    .map((c) => ({
      category: c,
      recipes: visible.filter((recipe) => recipe.category === c.id),
    }))
    .filter((group) => group.recipes.length > 0)
  const canCreate =
    canWrite && !noData && list.categories.some((c) => c.writable)

  return (
    <PageLayout
      title={RECIPES_TITLE}
      subtitle={
        canWrite
          ? 'Rezepte der Backstube - nachschlagen, anlegen und ändern'
          : 'Rezepte der Backstube zum Nachschlagen'
      }
      actions={
        canCreate ? (
          <Button
            component={Link}
            href={
              category &&
              list.categories.some((c) => c.id === category && c.writable)
                ? `${NEW_RECIPE_HREF}?kategorie=${encodeURIComponent(category)}`
                : NEW_RECIPE_HREF
            }
            variant="contained"
            startIcon={<AddIcon />}
          >
            Neues Rezept
          </Button>
        ) : undefined
      }
    >
      {notice && (
        <Alert severity="success" role="status" onClose={() => setNotice(null)}>
          {`„${notice.deleted}“ wurde gelöscht.`}
          {notice.pending
            ? ' Das Löschen wartet auf die Freigabe in hq - bis dahin steht das Rezept noch in der Liste.'
            : ''}
        </Alert>
      )}
      {canWrite && !noData && list.writeIssue && (
        <Alert severity="warning">
          {`Speichern ist gerade nicht möglich: ${list.writeIssue.message}`}
        </Alert>
      )}

      {noData ? (
        <EmptyState
          title="Keine Rezepte vorhanden."
          description={
            list.message ||
            'Die Rezepte kommen aus hq (data/recipes). Das Verzeichnis ist auf diesem Server nicht eingerichtet.'
          }
          data-testid="recipes-no-data"
        />
      ) : (
        <PageSection
          title={`Alle Rezepte (${
            filtered ? `${visible.length} von ${total}` : total
          })`}
          description={
            pendingCount > 0
              ? `${
                  pendingCount === 1
                    ? '1 Änderung wartet'
                    : `${pendingCount} Änderungen warten`
                } auf Freigabe in hq.`
              : undefined
          }
          disablePadding
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              px: { xs: 2, md: 3 },
              pb: 2,
            }}
          >
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rezept oder Zutat suchen"
              inputProps={{
                'aria-label': 'Rezept oder Zutat suchen',
                enterKeyHint: 'search',
                autoComplete: 'off',
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 480 }}
              fullWidth
            />
            <Box
              role="group"
              aria-label="Nach Kategorie filtern"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
            >
              <Chip
                clickable
                aria-pressed={category === null}
                color={category === null ? 'primary' : 'default'}
                variant={category === null ? 'filled' : 'outlined'}
                onClick={() => setCategory(null)}
                label={`Alle ${matches.length}`}
                sx={FILTER_CHIP_SX}
              />
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  clickable
                  aria-pressed={category === c.id}
                  color={category === c.id ? 'primary' : 'default'}
                  variant={category === c.id ? 'filled' : 'outlined'}
                  onClick={() => setCategory(category === c.id ? null : c.id)}
                  label={`${c.label} ${matchCount(c.id)}`}
                  data-testid={`recipe-filter-${c.id}`}
                  sx={FILTER_CHIP_SX}
                />
              ))}
            </Box>
          </Box>
          <Box sx={{ height: 4 }} aria-hidden={!searching}>
            {searching && <LinearProgress aria-label="Suche läuft" />}
          </Box>

          {visible.length === 0 ? (
            <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
              <EmptyState
                title={
                  total === 0
                    ? 'Noch keine Rezepte.'
                    : 'Kein Rezept passt zu Suche und Kategorie.'
                }
                description={
                  total === 0
                    ? canCreate
                      ? 'Mit „Neues Rezept“ das erste anlegen.'
                      : undefined
                    : 'Gesucht wird in Namen, Zutaten und Gruppen.'
                }
              />
            </Box>
          ) : (
            groups.map((group) => (
              <Box
                key={group.category.id}
                component="section"
                aria-label={group.category.label}
                data-testid={`recipe-group-${group.category.id}`}
              >
                <Typography
                  component="h3"
                  variant="subtitle2"
                  sx={{
                    px: { xs: 2, md: 3 },
                    py: 1,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  {`${group.category.label} (${group.recipes.length})`}
                </Typography>
                <List disablePadding aria-label={group.category.label}>
                  {group.recipes.map((recipe) => (
                    <li key={recipe.id}>
                      <RecipeRow recipe={recipe} showReadOnly={canWrite} />
                    </li>
                  ))}
                </List>
              </Box>
            ))
          )}
        </PageSection>
      )}
    </PageLayout>
  )
}
