'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material'
import {
  DeleteOutline as DeleteIcon,
  Edit as EditIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApiError } from '@bakery/shared/data-access'
import {
  OPEN_LABEL,
  RECIPES_HREF,
  backzettelUseText,
  deleteRecipe,
  fetchRecipe,
  ingredientAmountText,
  ingredientNoteText,
  pendingHint,
  recipeEditHref,
  yieldText,
  type Recipe,
  type RecipePart,
  type RecipeStepGroup,
} from '../../../../../lib/recipesApi'
import {
  RECIPE_SAVED_TEXT,
  type RecipeSavedFlash,
} from '../../../../../lib/recipeQuery'
import { canWriteRecipes } from '../../../../../lib/roles'
import { useOptionalSession } from '../../../../../lib/session'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import RecipeText from '../../../../../components/rezepte/RecipeText'
import { RecipeStatusChips } from '../../../../../components/rezepte/RecipeStatusChips'
import { errorText } from '../../../partners/errorText'

const BACK = { href: RECIPES_HREF, label: 'Alle Rezepte' }

/**
 * Schrift der Rezeptansicht: in der Backstube liest man das Tablet aus
 * Armlänge, mit Teig an den Händen - Zutaten und Schritte stehen deshalb
 * größer als der übliche Fließtext. Im Druck normal groß (ein Blatt).
 */
const READING_SX = {
  fontSize: { xs: '1.0625rem', md: '1.1875rem' },
  lineHeight: 1.5,
  '@media print': { fontSize: '11pt', lineHeight: 1.35 },
} as const

const PRINT_HIDDEN = { '@media print': { display: 'none' } } as const

function IngredientsTable({
  part,
  index,
}: {
  part: RecipePart
  index: number
}) {
  const label = part.title ?? (index === 0 ? 'Zutaten' : `Zutaten ${index + 1}`)
  return (
    <Box
      data-testid="recipe-part"
      sx={{
        breakInside: 'avoid',
        '& + &': { mt: 3, '@media print': { mt: 1.5 } },
      }}
    >
      {part.title && (
        <Typography
          component="h3"
          variant="subtitle1"
          sx={{ fontWeight: 700, mb: 0.5 }}
        >
          {part.title}
        </Typography>
      )}
      {part.ingredients.length === 0 ? (
        <Typography color="text.secondary">
          Keine Zutaten eingetragen.
        </Typography>
      ) : (
        <Box
          component="table"
          aria-label={label}
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            ...READING_SX,
            '& td, & th': {
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
              verticalAlign: 'baseline',
              '@media print': { py: 0.25 },
            },
            '& th': { textAlign: 'left', fontWeight: 400 },
            '& tr:last-of-type td, & tr:last-of-type th': { borderBottom: 0 },
            '& tfoot td, & tfoot th': {
              borderTop: 2,
              borderColor: 'text.secondary',
              fontWeight: 700,
            },
          }}
        >
          <Box component="thead" sx={visuallyHiddenSx}>
            <tr>
              <th scope="col">Menge</th>
              <th scope="col">Zutat</th>
            </tr>
          </Box>
          <tbody>
            {part.ingredients.map((ingredient, i) => {
              const open = ingredient.amount === null && !ingredient.note
              const note = ingredientNoteText(ingredient)
              return (
                <tr key={i} data-testid="recipe-ingredient">
                  <Box
                    component="td"
                    data-testid="ingredient-amount"
                    sx={{
                      // Feste Spalte: die Zahlen stehen untereinander, der
                      // Name direkt daneben (wie auf dem Rezeptblatt).
                      width: { xs: '6.5rem', md: '8rem' },
                      pr: 2,
                      '@media print': { width: '5rem', pr: 1.5 },
                      textAlign: 'right',
                      fontWeight: open ? 400 : 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: open ? 'text.secondary' : 'text.primary',
                      // Ein Hinweis statt einer Zahl („3–6 g (nach
                      // Geschmack)“) darf umbrechen, eine Menge nicht.
                      whiteSpace:
                        ingredient.amount === null ? 'normal' : 'nowrap',
                    }}
                  >
                    {ingredientAmountText(ingredient)}
                  </Box>
                  <Box
                    component="th"
                    scope="row"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {ingredient.name}
                    {note && (
                      <Typography
                        component="span"
                        color="text.secondary"
                        sx={{ fontSize: '0.875em' }}
                      >
                        {` (${note})`}
                      </Typography>
                    )}
                  </Box>
                </tr>
              )
            })}
          </tbody>
          {part.total && (
            <tfoot>
              <tr data-testid="recipe-total">
                <Box
                  component="td"
                  sx={{
                    pr: 2,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {part.total.text}
                </Box>
                <th scope="row">{part.total.label}</th>
              </tr>
            </tfoot>
          )}
        </Box>
      )}
    </Box>
  )
}

const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

function StepGroup({ group }: { group: RecipeStepGroup }) {
  const ListTag = group.ordered ? 'ol' : 'ul'
  return (
    <Box
      data-testid="recipe-steps"
      sx={{ '& + &': { mt: 3, '@media print': { mt: 1.5 } } }}
    >
      {group.title && (
        <Typography
          component="h3"
          variant="subtitle1"
          sx={{ fontWeight: 700, mb: 0.5, breakAfter: 'avoid' }}
        >
          {group.title}
        </Typography>
      )}
      <Box
        component={ListTag}
        sx={{
          m: 0,
          pl: group.ordered ? 3.5 : 3,
          ...READING_SX,
          '& > li': {
            py: 0.5,
            pl: 0.5,
            breakInside: 'avoid',
            '@media print': { py: 0.125 },
          },
          '& > li::marker': { fontWeight: 700 },
        }}
      >
        {group.items.map((item, index) => (
          <li key={index}>
            <RecipeText text={item} />
          </li>
        ))}
      </Box>
    </Box>
  )
}

interface Props {
  category: string
  slug: string
  flash?: RecipeSavedFlash | null
}

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; recipe: Recipe | null }
  | { phase: 'error'; message: string }

/**
 * `/admin/rezepte/<kategorie>/<kennung>`: ein Rezept zum Lesen und Drucken.
 * Inhaber und Backstubenleitung sehen dazu „Bearbeiten“ und „Löschen“; die
 * Backstube liest nur (die API setzt es durch).
 */
export default function RecipeDetailClient({ category, slug, flash }: Props) {
  const router = useRouter()
  const role = useOptionalSession()?.user?.role
  // Ohne Sitzung (Specs) bleibt alles sichtbar; durchgesetzt wird in der API.
  const canWrite = !role || canWriteRecipes(role)
  const [state, setState] = React.useState<State>({ phase: 'loading' })
  const [notice, setNotice] = React.useState<RecipeSavedFlash | null>(
    flash ?? null
  )
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      setState({ phase: 'ok', recipe: await fetchRecipe(category, slug) })
    } catch (err) {
      setState({
        phase: 'error',
        message: errorText(err, 'Das Rezept konnte nicht geladen werden.'),
      })
    }
  }, [category, slug])

  React.useEffect(() => {
    load()
  }, [load])

  // Der Hinweis „Gespeichert“ gehört zu diesem Aufruf - nach dem Neuladen
  // oder über „Zurück“ soll er nicht noch einmal erscheinen.
  React.useEffect(() => {
    if (!flash || typeof window === 'undefined') return
    if (window.location.search) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname
      )
    }
  }, [flash])

  if (state.phase === 'loading') {
    return (
      <PageLayout title="Rezept" back={BACK}>
        <LoadingState label="Rezept wird geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title="Rezept" back={BACK}>
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
    )
  }
  const recipe = state.recipe
  if (!recipe) {
    return (
      <PageLayout title="Rezept nicht gefunden" back={BACK} width="narrow">
        <EmptyState
          title="Dieses Rezept gibt es nicht (mehr)."
          description="Vielleicht wurde es verschoben oder gelöscht - in der Rezeptliste suchen."
          data-testid="recipe-missing"
        />
      </PageLayout>
    )
  }

  const used = recipe.usedByBackzettel.length > 0
  const deleted = recipe.pending === 'deleted'
  const hasSteps = recipe.steps.some((group) => group.items.length > 0)
  const hasIngredients = recipe.parts.length > 0

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteRecipe(recipe, recipe.version)
      const params = new URLSearchParams({ geloescht: recipe.title })
      if (result.pending) params.set('wartet', '1')
      router.push(`${RECIPES_HREF}?${params.toString()}`)
    } catch (err) {
      setDeleteError(
        err instanceof ApiError && err.code === 'stale_recipe'
          ? 'Das Rezept wurde inzwischen geändert. Bitte die Seite neu laden und noch einmal prüfen.'
          : errorText(err, 'Das Rezept konnte nicht gelöscht werden.')
      )
      setDeleting(false)
    }
  }

  // Höchstens drei Hinweise, der erste (nach dem Speichern) schließbar:
  // Freigabe-Stand, dann für Schreibende entweder „nur zum Ansehen“ oder
  // „der Backzettel verwendet es“.
  const alerts: React.ReactNode[] = []
  if (notice) {
    alerts.push(
      <Alert
        key="notice"
        severity="success"
        role="status"
        onClose={() => setNotice(null)}
      >
        {RECIPE_SAVED_TEXT[notice]}
      </Alert>
    )
  }
  if (recipe.pending && !notice?.endsWith('-wartet')) {
    alerts.push(
      <Alert
        key="pending"
        severity={deleted ? 'warning' : 'info'}
        data-testid="recipe-pending-hint"
      >
        {pendingHint(recipe.pending)}
      </Alert>
    )
  }
  if (canWrite && !deleted && !recipe.editable) {
    alerts.push(
      <Alert key="readonly" severity="info" data-testid="recipe-readonly-hint">
        {`Nur zum Ansehen: ${
          recipe.readOnlyReason ?? 'Dieses Rezept lässt sich hier nicht ändern.'
        }`}
      </Alert>
    )
  } else if (canWrite && !deleted && used) {
    alerts.push(
      <Alert
        key="backzettel"
        severity="info"
        data-testid="recipe-backzettel-hint"
      >
        {`Der Backzettel verwendet dieses Rezept (${backzettelUseText(
          recipe.usedByBackzettel
        )}). Es lässt sich ändern, aber nicht löschen - und der Backzettel rechnet erst nach der Freigabe mit dem neuen Stand.`}
      </Alert>
    )
  }

  return (
    <PageLayout
      title={recipe.title}
      subtitle={`${recipe.categoryLabel} · ${yieldText(recipe.yield)}`}
      back={BACK}
      status={<RecipeStatusChips recipe={recipe} showReadOnly={canWrite} />}
      actions={
        <>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
          >
            Drucken
          </Button>
          {canWrite && recipe.deletable && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                setDeleteError(null)
                setConfirmDelete(true)
              }}
            >
              Löschen
            </Button>
          )}
          {canWrite && recipe.editable && (
            <Button
              component={Link}
              href={recipeEditHref(recipe)}
              variant="contained"
              startIcon={<EditIcon />}
            >
              Bearbeiten
            </Button>
          )}
        </>
      }
    >
      {alerts.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            ...PRINT_HIDDEN,
          }}
        >
          {alerts}
        </Box>
      )}

      {recipe.description && (
        <RecipeText
          text={recipe.description}
          sx={{ color: 'text.secondary', maxWidth: '70ch' }}
          data-testid="recipe-description"
        />
      )}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md:
              hasIngredients && hasSteps
                ? 'minmax(0, 5fr) minmax(0, 7fr)'
                : 'minmax(0, 1fr)',
          },
          // Druck: Zutaten links, Zubereitung rechts - ein Rezept soll
          // möglichst auf ein Blatt passen.
          '@media print': {
            gap: 2,
            gridTemplateColumns:
              hasIngredients && hasSteps
                ? 'minmax(0, 5fr) minmax(0, 7fr)'
                : 'minmax(0, 1fr)',
          },
        }}
      >
        <PageSection title="Zutaten" data-testid="recipe-ingredients">
          {hasIngredients ? (
            recipe.parts.map((part, index) => (
              <IngredientsTable key={index} part={part} index={index} />
            ))
          ) : (
            <Typography color="text.secondary">
              Noch keine Zutaten eingetragen.
            </Typography>
          )}
        </PageSection>
        {hasSteps && (
          <PageSection title="Zubereitung" data-testid="recipe-preparation">
            {recipe.steps.map((group, index) => (
              <StepGroup key={index} group={group} />
            ))}
          </PageSection>
        )}
      </Box>

      {recipe.notes && (
        <PageSection title="Notizen" data-testid="recipe-notes">
          <RecipeText text={recipe.notes} sx={READING_SX} />
        </PageSection>
      )}

      {recipe.meta.length > 0 && (
        <PageSection title="Angaben" data-testid="recipe-meta">
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              columnGap: 3,
              rowGap: 1.5,
              '@media print': {
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                rowGap: 0.75,
              },
            }}
          >
            {recipe.meta.map((entry) => (
              <Box key={entry.key} sx={{ minWidth: 0, breakInside: 'avoid' }}>
                <Typography
                  component="dt"
                  variant="body2"
                  color="text.secondary"
                >
                  {entry.label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{
                    m: 0,
                    overflowWrap: 'anywhere',
                    color: entry.value === null ? 'text.secondary' : undefined,
                  }}
                >
                  {entry.value ?? OPEN_LABEL}
                </Typography>
              </Box>
            ))}
          </Box>
        </PageSection>
      )}

      {recipe.sections.map((section, index) => (
        <PageSection
          key={index}
          title={section.title}
          data-testid="recipe-section"
        >
          <RecipeText text={section.text} />
        </PageSection>
      ))}

      {canWrite && (
        <PageSection
          title="Datei in hq"
          printHidden
          data-testid="recipe-file"
          description={recipe.path}
        >
          <Typography variant="body2" color="text.secondary">
            {recipe.deletable
              ? 'Änderungen werden nach hq gespeichert und dort freigegeben.'
              : recipe.deleteBlockedReason ??
                'Löschen ist für dieses Rezept nicht möglich.'}
          </Typography>
        </PageSection>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => (deleting ? undefined : setConfirmDelete(false))}
        aria-labelledby="recipe-delete-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="recipe-delete-title">Rezept löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`„${recipe.title}“ (${recipe.categoryLabel}) wird gelöscht. Das lässt sich nur in hq rückgängig machen.`}
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {deleting ? 'Wird gelöscht …' : 'Rezept löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  )
}
