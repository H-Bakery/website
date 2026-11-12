'use client'
import React from 'react'
import { Alert } from '@mui/material'
import { useRouter } from 'next/navigation'
import {
  RECIPES_HREF,
  createRecipe,
  fetchRecipes,
  recipeHref,
  type RecipeList,
} from '../../../../lib/recipesApi'
import {
  emptyRecipeForm,
  formProblems,
  fullInput,
  hasContent,
  type FormProblems,
  type RecipeFormValues,
} from '../../../../lib/recipeForm'
import { recipeSavedFlash } from '../../../../lib/recipeQuery'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
} from '../../../../components/layout'
import RecipeForm, {
  type RecipeFormFeedback,
} from '../../../../components/rezepte/RecipeForm'
import { errorText } from '../../partners/errorText'
import { useConfirmLeave } from '../../partners/partnerUi'
import { focusFirstProblem, problemsMessage } from '../recipeFormUi'

const TITLE = 'Neues Rezept'
const BACK = { href: RECIPES_HREF, label: 'Alle Rezepte' }

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; list: RecipeList }
  | { phase: 'error'; message: string }

/**
 * `/admin/rezepte/neu`: legt ein Rezept in hq an (`POST /api/recipes`, Datei
 * `<kategorie>/<kennung>.md`). Kategorien und Einheiten kommen aus der Liste
 * der API - hier steht keine eigene Auswahl.
 */
export default function NewRecipeClient({
  initialCategory = null,
}: {
  initialCategory?: string | null
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
    try {
      const list = await fetchRecipes()
      const writable = list.categories.filter((c) => c.writable)
      const start =
        writable.find((c) => c.id === initialCategory) ?? writable[0] ?? null
      setValues(
        (current) => current ?? (start ? emptyRecipeForm(start.id) : null)
      )
      setState({ phase: 'ok', list })
    } catch (err) {
      setState({
        phase: 'error',
        message: errorText(err, 'Die Kategorien konnten nicht geladen werden.'),
      })
    }
  }, [initialCategory])

  React.useEffect(() => {
    load()
  }, [load])

  useConfirmLeave(
    !done && values !== null && hasContent(values),
    'Das Rezept ist noch nicht gespeichert. Seite trotzdem verlassen?'
  )

  if (state.phase === 'loading') {
    return (
      <PageLayout title={TITLE} back={BACK} width="default">
        <LoadingState label="Formular wird geladen …" />
      </PageLayout>
    )
  }
  if (state.phase === 'error') {
    return (
      <PageLayout title={TITLE} back={BACK} width="default">
        <ErrorState message={state.message} onRetry={load} />
      </PageLayout>
    )
  }
  const list = state.list
  const categories = list.categories.filter((c) => c.writable)
  if (list.status === 'no-data' || !values || categories.length === 0) {
    return (
      <PageLayout title={TITLE} back={BACK} width="narrow">
        <EmptyState
          title="Rezepte lassen sich hier gerade nicht anlegen."
          description={
            list.message ||
            'Die Rezepte kommen aus hq (data/recipes). Das Verzeichnis ist auf diesem Server nicht eingerichtet.'
          }
        />
      </PageLayout>
    )
  }

  const handleSubmit = async () => {
    const found = formProblems(values)
    if (found.count > 0) {
      setProblems(found)
      setFeedback({ severity: 'error', message: problemsMessage(found) })
      focusFirstProblem()
      return
    }
    setProblems(null)
    setSaving(true)
    setFeedback(null)
    try {
      const result = await createRecipe(fullInput(values))
      setDone(true)
      router.push(
        `${recipeHref(result.recipe)}?gespeichert=${recipeSavedFlash(
          'angelegt',
          result.pending
        )}`
      )
    } catch (err) {
      setFeedback({
        severity: 'error',
        message: errorText(err, 'Das Rezept konnte nicht angelegt werden.'),
      })
      setSaving(false)
    }
  }

  return (
    <PageLayout
      title={TITLE}
      subtitle="Den Dateinamen vergibt die App aus dem Namen."
      back={BACK}
      width="default"
    >
      {list.writeIssue && (
        <Alert severity="warning">
          {`Speichern ist gerade nicht möglich: ${list.writeIssue.message}`}
        </Alert>
      )}
      <RecipeForm
        values={values}
        onChange={(next) => {
          setValues(next)
          if (problems) setProblems(formProblems(next))
          if (feedback?.severity === 'error') setFeedback(null)
        }}
        categories={categories}
        units={list.units}
        problems={problems}
        feedback={feedback}
        onDismissFeedback={() => setFeedback(null)}
        submitLabel="Rezept anlegen"
        busyLabel="Wird angelegt …"
        busy={saving}
        onSubmit={handleSubmit}
        cancelHref={RECIPES_HREF}
      />
    </PageLayout>
  )
}
