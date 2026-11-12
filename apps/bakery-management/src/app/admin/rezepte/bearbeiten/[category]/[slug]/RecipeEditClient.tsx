'use client'
import React from 'react'
import { Alert, Button, Typography } from '@mui/material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApiError } from '@bakery/shared/data-access'
import {
  RECIPES_HREF,
  backzettelUseText,
  fetchRecipe,
  fetchRecipes,
  pendingHint,
  recipeHref,
  updateRecipe,
  type Recipe,
  type RecipeList,
} from '../../../../../../lib/recipesApi'
import {
  changedInput,
  formFromRecipe,
  formProblems,
  isChanged,
  type FormProblems,
  type RecipeFormValues,
} from '../../../../../../lib/recipeForm'
import { recipeSavedFlash } from '../../../../../../lib/recipeQuery'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../../components/layout'
import RecipeForm, {
  type RecipeFormFeedback,
} from '../../../../../../components/rezepte/RecipeForm'
import { RecipeStatusChips } from '../../../../../../components/rezepte/RecipeStatusChips'
import { errorText } from '../../../../partners/errorText'
import { useConfirmLeave } from '../../../../partners/partnerUi'
import { focusFirstProblem, problemsMessage } from '../../../recipeFormUi'

const LIST_BACK = { href: RECIPES_HREF, label: 'Alle Rezepte' }

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; recipe: Recipe | null; list: RecipeList }
  | { phase: 'error'; message: string }

/**
 * `/admin/rezepte/bearbeiten/<kategorie>/<kennung>`: ändert ein Rezept in hq
 * (`PUT /api/recipes/…` mit `expectedVersion`). Geschickt wird nur, was sich
 * geändert hat (`changedInput`) - ein Speichern ohne Änderung schreibt
 * nichts. Hat inzwischen jemand anderes gespeichert, meldet die API das
 * (409 `stale_recipe`) und nichts wird überschrieben.
 */
export default function RecipeEditClient({
  category,
  slug,
}: {
  category: string
  slug: string
}) {
  const router = useRouter()
  const [state, setState] = React.useState<State>({ phase: 'loading' })
  const [values, setValues] = React.useState<RecipeFormValues | null>(null)
  const [problems, setProblems] = React.useState<FormProblems | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [feedback, setFeedback] = React.useState<RecipeFormFeedback | null>(
    null
  )

  const load = React.useCallback(async () => {
    setState({ phase: 'loading' })
    setFeedback(null)
    setProblems(null)
    try {
      const [recipe, list] = await Promise.all([
        fetchRecipe(category, slug),
        fetchRecipes({ category }),
      ])
      setValues(recipe ? formFromRecipe(recipe) : null)
      setState({ phase: 'ok', recipe, list })
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

  const loaded = state.phase === 'ok' ? state.recipe : null
  const dirty =
    !done && loaded !== null && values !== null && isChanged(values, loaded)
  useConfirmLeave(
    dirty,
    'Die Änderungen sind noch nicht gespeichert. Seite trotzdem verlassen?'
  )

  if (state.phase === 'loading') {
    return (
      <PageLayout title="Rezept bearbeiten" back={LIST_BACK}>
        <LoadingState label="Rezept wird geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title="Rezept bearbeiten" back={LIST_BACK}>
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
    )
  }
  const { recipe, list } = state
  if (!recipe || !values) {
    return (
      <PageLayout title="Rezept nicht gefunden" back={LIST_BACK} width="narrow">
        <EmptyState
          title="Dieses Rezept gibt es nicht (mehr)."
          description="Vielleicht wurde es verschoben oder gelöscht - in der Rezeptliste suchen."
          data-testid="recipe-missing"
        />
      </PageLayout>
    )
  }

  const back = { href: recipeHref(recipe), label: 'Zurück zum Rezept' }

  if (!recipe.editable) {
    return (
      <PageLayout title={recipe.title} back={back} width="narrow">
        <EmptyState
          title="Dieses Rezept lässt sich hier nicht ändern."
          description={recipe.readOnlyReason ?? undefined}
          action={
            <Button component={Link} href={back.href} variant="outlined">
              Rezept ansehen
            </Button>
          }
          data-testid="recipe-edit-readonly"
        />
      </PageLayout>
    )
  }

  const used = recipe.usedByBackzettel.length > 0
  const writable = list.categories.filter((c) => c.writable)
  const categories = writable.some((c) => c.id === recipe.category)
    ? writable
    : list.categories.filter((c) => c.writable || c.id === recipe.category)
  const categoryLocked = used
    ? 'Der Backzettel verwendet dieses Rezept - die Kategorie bleibt.'
    : !list.canDelete
    ? 'Verschieben in eine andere Kategorie ist noch nicht freigeschaltet.'
    : null

  const handleSubmit = async () => {
    const found = formProblems(values)
    if (found.count > 0) {
      setProblems(found)
      setFeedback({ severity: 'error', message: problemsMessage(found) })
      focusFirstProblem()
      return
    }
    setProblems(null)
    const input = changedInput(values, recipe)
    if (Object.keys(input).length === 0) {
      setFeedback({
        severity: 'info',
        message: 'Nichts geändert - es gibt nichts zu speichern.',
      })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateRecipe(recipe, recipe.version, input)
      setDone(true)
      const target = recipeHref(result.recipe)
      router.push(
        result.changed
          ? `${target}?gespeichert=${recipeSavedFlash(
              'gespeichert',
              result.pending
            )}`
          : target
      )
    } catch (err) {
      const stale = err instanceof ApiError && err.code === 'stale_recipe'
      setFeedback({
        severity: 'error',
        message: errorText(err, 'Das Rezept konnte nicht gespeichert werden.'),
        action: stale
          ? { label: 'Aktuellen Stand laden', onClick: load }
          : undefined,
      })
      setSaving(false)
    }
  }

  return (
    <PageLayout
      title={`${recipe.title} bearbeiten`}
      subtitle={`${recipe.categoryLabel} · ${recipe.path}`}
      back={back}
      status={<RecipeStatusChips recipe={recipe} />}
      width="default"
    >
      {list.writeIssue && (
        <Alert severity="warning">
          {`Speichern ist gerade nicht möglich: ${list.writeIssue.message}`}
        </Alert>
      )}
      {recipe.pending && (
        <Alert severity="info" data-testid="recipe-pending-hint">
          {`${pendingHint(
            recipe.pending
          )} Weitere Änderungen kommen zur selben Freigabe dazu.`}
        </Alert>
      )}
      {used && (
        <Alert severity="info" data-testid="recipe-backzettel-hint">
          {`Der Backzettel verwendet dieses Rezept (${backzettelUseText(
            recipe.usedByBackzettel
          )}). Er rechnet erst nach der Freigabe mit dem neuen Stand.`}
        </Alert>
      )}
      <RecipeForm
        values={values}
        onChange={(next) => {
          setValues(next)
          if (problems) setProblems(formProblems(next))
          if (feedback && !feedback.action) setFeedback(null)
        }}
        categories={categories}
        units={list.units}
        categoryLocked={categoryLocked}
        lockedPartTitles={recipe.usedByBackzettel
          .map((use) => use.section)
          .filter((section): section is string => Boolean(section))}
        showNote={recipe.format === 'table'}
        problems={problems}
        feedback={feedback}
        onDismissFeedback={() => setFeedback(null)}
        submitLabel="Speichern"
        busyLabel="Speichern …"
        busy={saving}
        onSubmit={handleSubmit}
        cancelHref={back.href}
      >
        {(recipe.meta.length > 0 || recipe.sections.length > 0) && (
          <PageSection
            title="Bleibt unverändert"
            description="Diese Teile der Datei zeigt die Rezeptansicht; geändert werden sie vorerst nur in hq."
            data-testid="recipe-untouched"
          >
            <Typography variant="body2" color="text.secondary">
              {[
                recipe.meta.length > 0
                  ? `Angaben: ${recipe.meta.map((m) => m.label).join(', ')}`
                  : null,
                recipe.sections.length > 0
                  ? `Abschnitte: ${recipe.sections
                      .map((s) => s.title)
                      .join(', ')}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </PageSection>
        )}
      </RecipeForm>
    </PageLayout>
  )
}
