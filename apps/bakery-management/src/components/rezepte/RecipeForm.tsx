'use client'
import React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Add as AddIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  DeleteOutline as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { PageSection } from '../layout'
import type { RecipeCategory } from '../../lib/recipesApi'
import {
  isEmptyRow,
  moveItem,
  newIngredientRow,
  newPart,
  newStepGroup,
  nextKey,
  type FormProblems,
  type IngredientRow,
  type PartForm,
  type RecipeFormValues,
  type RowProblem,
  type StepForm,
  type StepGroupForm,
} from '../../lib/recipeForm'

export interface RecipeFormFeedback {
  message: string
  severity: 'success' | 'error' | 'info'
  /** Zusätzlicher Knopf in der Meldung (z. B. „Aktuellen Stand laden“). */
  action?: { label: string; onClick: () => void }
}

export interface RecipeFormProps {
  values: RecipeFormValues
  onChange: (values: RecipeFormValues) => void
  /** Kategorien zur Auswahl (nur beschreibbare, dazu die aktuelle). */
  categories: readonly RecipeCategory[]
  /** Einheiten, die die API annimmt. */
  units: readonly string[]
  /** Gesetzt: die Kategorie lässt sich nicht ändern - mit Begründung. */
  categoryLocked?: string | null
  /** Rezeptteile, die der Backzettel liest: Name und Gruppe bleiben. */
  lockedPartTitles?: readonly string[]
  /**
   * Feld „Hinweis“ je Zutat zeigen. Nur Tabellen-Rezepte führen ihn
   * getrennt; sonst gehört er in den Namen („Ei (zum Abglänzen)“).
   */
  showNote?: boolean
  /** Probleme der Eingabe - erst nach dem ersten Speicherversuch gesetzt. */
  problems?: FormProblems | null
  feedback?: RecipeFormFeedback | null
  onDismissFeedback?: () => void
  submitLabel: string
  busyLabel: string
  busy: boolean
  onSubmit: () => void
  cancelHref: string
  /** Zusätzlicher Abschnitt über der Speichern-Leiste (z. B. „bleibt unverändert“). */
  children?: React.ReactNode
}

const NO_UNIT_LABEL = '–'

/** Spalten der Zutatenzeile ab `sm`; darunter stehen die Felder gestapelt. */
const ROW_COLUMNS = '6.5rem 7.5rem minmax(0, 1fr) auto'
/**
 * Mit „Hinweis“ als eigener Spalte - erst ab `lg`: am Tablet bliebe für den
 * Namen der Zutat sonst zu wenig Platz, dort steht der Hinweis darunter.
 */
const ROW_COLUMNS_NOTE = '6.5rem 7.5rem minmax(0, 3fr) minmax(0, 2fr) auto'

function rowColumns(showNote: boolean) {
  return showNote
    ? {
        xs: 'minmax(0, 1fr) minmax(0, 1fr)',
        sm: ROW_COLUMNS,
        lg: ROW_COLUMNS_NOTE,
      }
    : { xs: 'minmax(0, 1fr) minmax(0, 1fr)', sm: ROW_COLUMNS }
}

function RowButtons({
  what,
  index,
  count,
  onMove,
  onRemove,
}: {
  /** „Zutat 3“, „Schritt 2“ - für die Beschriftung der Knöpfe. */
  what: string
  index: number
  count: number
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <IconButton
        aria-label={`${what} nach oben`}
        onClick={() => onMove(-1)}
        disabled={index === 0}
      >
        <UpIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={`${what} nach unten`}
        onClick={() => onMove(1)}
        disabled={index === count - 1}
      >
        <DownIcon fontSize="small" />
      </IconButton>
      <IconButton aria-label={`${what} entfernen`} onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

interface IngredientRowFieldsProps {
  row: IngredientRow
  partKey: string
  index: number
  count: number
  problem: RowProblem | null
  compact: boolean
  noteColumn: boolean
  units: readonly string[]
  onChange: (
    partKey: string,
    rowKey: string,
    patch: Partial<IngredientRow>
  ) => void
  onMove: (partKey: string, rowKey: string, delta: number) => void
  onRemove: (partKey: string, rowKey: string) => void
  onAdd: (partKey: string) => void
}

/**
 * Eine Zutatenzeile. `React.memo` mit stabilen Änderungs-Funktionen: beim
 * Tippen rendert nur diese Zeile neu, nicht das ganze Formular - auf einem
 * schwachen Tablet waren es sonst über 100 ms je Tastendruck.
 */
const IngredientRowFields = React.memo(function IngredientRowFields({
  row,
  partKey,
  index,
  count,
  problem,
  compact,
  noteColumn,
  units,
  onChange,
  onMove,
  onRemove,
  onAdd,
}: IngredientRowFieldsProps) {
  const what = `Zutat ${index + 1}`
  const unitOptions =
    row.unit && !units.includes(row.unit) ? [...units, row.unit] : units
  return (
    <Box
      component="li"
      key={row.key}
      data-testid="ingredient-row"
      data-focus-key={row.key}
      aria-label={what}
      sx={{
        pb: { xs: 1.5, sm: 0 },
        borderBottom: { xs: 1, sm: 0 },
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0, pb: 0 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          columnGap: 1,
          rowGap: 1,
          alignItems: 'start',
          gridTemplateColumns: rowColumns(noteColumn),
        }}
      >
        <TextField
          value={row.amount}
          onChange={(event) =>
            onChange(partKey, row.key, {
              amount: event.target.value,
            })
          }
          label={compact ? 'Menge' : undefined}
          placeholder={compact ? undefined : 'offen'}
          size="small"
          error={problem?.field === 'amount'}
          inputProps={{
            'aria-label': compact ? undefined : 'Menge',
            'aria-invalid': problem?.field === 'amount' ? true : undefined,
            inputMode: 'decimal',
            autoComplete: 'off',
            style: { textAlign: 'right' },
          }}
        />
        <TextField
          select
          value={row.unit}
          onChange={(event) =>
            onChange(partKey, row.key, {
              unit: event.target.value,
            })
          }
          label={compact ? 'Einheit' : undefined}
          size="small"
          error={problem?.field === 'unit'}
          SelectProps={{
            displayEmpty: true,
            // Der Name gehört an das sichtbare Auswahlfeld
            // (role=combobox), nicht an das versteckte input.
            SelectDisplayProps: compact
              ? undefined
              : ({
                  'aria-label': 'Einheit',
                } as React.HTMLAttributes<HTMLDivElement>),
          }}
          InputLabelProps={compact ? { shrink: true } : undefined}
        >
          <MenuItem value="">{NO_UNIT_LABEL}</MenuItem>
          {unitOptions.map((unit) => (
            <MenuItem key={unit} value={unit}>
              {unit}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          value={row.name}
          onChange={(event) =>
            onChange(partKey, row.key, {
              name: event.target.value,
            })
          }
          onKeyDown={(event) => {
            // Enter in der letzten Zeile: gleich die nächste.
            if (
              event.key === 'Enter' &&
              index === count - 1 &&
              row.name.trim() !== ''
            ) {
              event.preventDefault()
              onAdd(partKey)
            }
          }}
          label={compact ? 'Zutat' : undefined}
          size="small"
          error={problem?.field === 'name'}
          inputProps={{
            'aria-label': compact ? undefined : 'Zutat',
            'aria-invalid': problem?.field === 'name' ? true : undefined,
            maxLength: 200,
            autoComplete: 'off',
          }}
          sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          fullWidth
        />
        {noteColumn && (
          <TextField
            value={row.note}
            onChange={(event) =>
              onChange(partKey, row.key, {
                note: event.target.value,
              })
            }
            label={compact ? 'Hinweis' : undefined}
            placeholder={compact ? undefined : 'Hinweis'}
            size="small"
            inputProps={{
              'aria-label': compact ? undefined : 'Hinweis',
              maxLength: 200,
              autoComplete: 'off',
            }}
            sx={{
              // Unter `lg` unter dem Namen, hinter den
              // Knöpfen der Zeile (Reihenfolge im DOM bleibt).
              gridColumn: {
                xs: '1 / -1',
                sm: '3',
                lg: 'auto',
              },
              gridRow: { sm: '2', lg: 'auto' },
            }}
            fullWidth
          />
        )}
        <Box
          sx={{
            gridColumn: { xs: '1 / -1', sm: 'auto' },
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <RowButtons
            what={what}
            index={index}
            count={count}
            onMove={(delta) => onMove(partKey, row.key, delta)}
            onRemove={() => onRemove(partKey, row.key)}
          />
        </Box>
      </Box>
      {problem && (
        <Typography
          variant="caption"
          color="error"
          role="alert"
          sx={{ display: 'block', mt: 0.5 }}
        >
          {problem.message}
        </Typography>
      )}
    </Box>
  )
})

interface StepRowFieldsProps {
  item: StepForm
  groupKey: string
  index: number
  count: number
  ordered: boolean
  onChange: (groupKey: string, itemKey: string, text: string) => void
  onMove: (groupKey: string, itemKey: string, delta: number) => void
  onRemove: (groupKey: string, itemKey: string) => void
}

/** Ein Arbeitsschritt - wie die Zutatenzeile `React.memo`. */
const StepRowFields = React.memo(function StepRowFields({
  item,
  groupKey,
  index,
  count,
  ordered,
  onChange,
  onMove,
  onRemove,
}: StepRowFieldsProps) {
  const what = `Schritt ${index + 1}`
  return (
    <Box
      component="li"
      key={item.key}
      data-testid="step-row"
      data-focus-key={item.key}
      sx={{
        display: 'flex',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <Typography
        aria-hidden="true"
        sx={{
          width: '1.75rem',
          pt: 1.25,
          textAlign: 'right',
          fontWeight: 700,
          color: 'text.secondary',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {ordered ? `${index + 1}.` : '•'}
      </Typography>
      <TextField
        value={item.text}
        onChange={(event) => onChange(groupKey, item.key, event.target.value)}
        multiline
        minRows={1}
        maxRows={10}
        size="small"
        inputProps={{ 'aria-label': what, maxLength: 2000 }}
        sx={{ flex: '1 1 12rem', minWidth: 0 }}
        fullWidth
      />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          flex: { xs: '1 1 100%', sm: '0 0 auto' },
        }}
      >
        <RowButtons
          what={what}
          index={index}
          count={count}
          onMove={(delta) => onMove(groupKey, item.key, delta)}
          onRemove={() => onRemove(groupKey, item.key)}
        />
      </Box>
    </Box>
  )
})

/**
 * Formular eines Rezepts: Name, Kategorie, „Ergibt“, Zutaten in Gruppen
 * (Zeilen hinzufügen, entfernen, umsortieren), Arbeitsschritte, Notizen.
 * Gemeinsam für „Neues Rezept“ und „Bearbeiten“; gespeichert wird von der
 * Seite (`onSubmit`). Leere Felder heißen „offen“ - das Formular trägt nie
 * von sich aus eine 0 oder einen Beispielwert ein.
 */
export default function RecipeForm({
  values,
  onChange,
  categories,
  units,
  categoryLocked = null,
  lockedPartTitles = [],
  showNote = false,
  problems = null,
  feedback,
  onDismissFeedback,
  submitLabel,
  busyLabel,
  busy,
  onSubmit,
  cancelHref,
  children,
}: RecipeFormProps) {
  const theme = useTheme()
  // Unter `sm` gibt es keine Kopfzeile über den Zutaten - dann tragen die
  // Felder ihre Beschriftung selbst.
  const compact = useMediaQuery(theme.breakpoints.down('sm'))
  const wide = useMediaQuery(theme.breakpoints.up('lg'))
  const formRef = React.useRef<HTMLDivElement | null>(null)
  const [focusKey, setFocusKey] = React.useState<string | null>(null)
  const [removePart, setRemovePart] = React.useState<PartForm | null>(null)
  const noteColumn =
    showNote ||
    values.parts.some((part) => part.rows.some((row) => row.note !== ''))

  // Neue Zeile: der Cursor steht gleich im ersten Feld.
  React.useEffect(() => {
    if (!focusKey) return
    const field = formRef.current?.querySelector<HTMLElement>(
      `[data-focus-key="${focusKey}"] input, [data-focus-key="${focusKey}"] textarea`
    )
    field?.focus()
    setFocusKey(null)
  }, [focusKey])

  const set = <K extends keyof RecipeFormValues>(
    key: K,
    value: RecipeFormValues[K]
  ) => onChange({ ...values, [key]: value })

  // Stabile Änderungs-Funktionen für die Zeilen (`React.memo`): sie lesen den
  // neuesten Stand aus einer Ref, statt bei jedem Rendern neu zu entstehen.
  const latest = React.useRef({ values, onChange })
  latest.current = { values, onChange }
  const update = React.useCallback(
    (change: (current: RecipeFormValues) => RecipeFormValues) =>
      latest.current.onChange(change(latest.current.values)),
    []
  )
  const setPart = React.useCallback(
    (key: string, change: (part: PartForm) => PartForm) =>
      update((current) => ({
        ...current,
        parts: current.parts.map((part) =>
          part.key === key ? change(part) : part
        ),
      })),
    [update]
  )
  const changeRow = React.useCallback(
    (partKey: string, rowKey: string, patch: Partial<IngredientRow>) =>
      setPart(partKey, (part) => ({
        ...part,
        rows: part.rows.map((row) =>
          row.key === rowKey ? { ...row, ...patch } : row
        ),
      })),
    [setPart]
  )
  const moveRow = React.useCallback(
    (partKey: string, rowKey: string, delta: number) =>
      setPart(partKey, (part) => ({
        ...part,
        rows: moveItem(
          part.rows,
          part.rows.findIndex((row) => row.key === rowKey),
          delta
        ),
      })),
    [setPart]
  )
  const removeRow = React.useCallback(
    (partKey: string, rowKey: string) =>
      setPart(partKey, (part) => ({
        ...part,
        rows: part.rows.filter((row) => row.key !== rowKey),
      })),
    [setPart]
  )
  const addRow = React.useCallback(
    (partKey: string) => {
      const row = newIngredientRow()
      setPart(partKey, (part) => ({ ...part, rows: [...part.rows, row] }))
      setFocusKey(row.key)
    },
    [setPart]
  )

  const setGroup = React.useCallback(
    (key: string, change: (group: StepGroupForm) => StepGroupForm) =>
      update((current) => ({
        ...current,
        steps: current.steps.map((group) =>
          group.key === key ? change(group) : group
        ),
      })),
    [update]
  )
  const changeStep = React.useCallback(
    (groupKey: string, itemKey: string, text: string) =>
      setGroup(groupKey, (group) => ({
        ...group,
        items: group.items.map((item) =>
          item.key === itemKey ? { ...item, text } : item
        ),
      })),
    [setGroup]
  )
  const moveStep = React.useCallback(
    (groupKey: string, itemKey: string, delta: number) =>
      setGroup(groupKey, (group) => ({
        ...group,
        items: moveItem(
          group.items,
          group.items.findIndex((item) => item.key === itemKey),
          delta
        ),
      })),
    [setGroup]
  )
  const removeStep = React.useCallback(
    (groupKey: string, itemKey: string) =>
      setGroup(groupKey, (group) => ({
        ...group,
        items: group.items.filter((item) => item.key !== itemKey),
      })),
    [setGroup]
  )
  const addStep = (groupKey: string) => {
    const item = { key: nextKey('s'), text: '' }
    setGroup(groupKey, (group) => ({
      ...group,
      items: [...group.items, item],
    }))
    setFocusKey(item.key)
  }

  const isLocked = (part: PartForm) =>
    part.existing && lockedPartTitles.includes(part.title)

  return (
    // Bewusst kein <form>: Enter in einem Mengenfeld soll am Tablet nicht
    // das ganze Rezept speichern.
    <Box
      ref={formRef}
      role="form"
      aria-label="Rezept"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, md: 3 },
        minWidth: 0,
      }}
    >
      <PageSection title="Rezept">
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'minmax(0, 2fr) minmax(0, 1fr)',
            },
          }}
        >
          <TextField
            label="Name"
            required
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            error={Boolean(problems?.title)}
            helperText={problems?.title ?? undefined}
            inputProps={{
              maxLength: 120,
              'aria-invalid': problems?.title ? true : undefined,
            }}
            fullWidth
          />
          <TextField
            select
            label="Kategorie"
            value={values.category}
            onChange={(event) => set('category', event.target.value)}
            disabled={Boolean(categoryLocked)}
            helperText={categoryLocked ?? undefined}
            fullWidth
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Ergibt"
            value={values.yield}
            onChange={(event) => set('yield', event.target.value)}
            placeholder="z. B. 3 Laibe à 700 g"
            helperText="Leer lassen heißt „offen“."
            inputProps={{ maxLength: 200 }}
            sx={{ gridColumn: '1 / -1' }}
            fullWidth
          />
          <TextField
            label="Beschreibung"
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            multiline
            minRows={2}
            maxRows={8}
            sx={{ gridColumn: '1 / -1' }}
            fullWidth
          />
        </Box>
      </PageSection>

      <PageSection
        title="Zutaten"
        description="Menge leer lassen heißt „offen“ - nie 0 eintragen."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {values.parts.map((part, partIndex) => {
            const locked = isLocked(part)
            const groupName = part.title.trim() || `Gruppe ${partIndex + 1}`
            return (
              <Box
                key={part.key}
                role="group"
                aria-label={`Zutatengruppe ${groupName}`}
                data-testid="part-form"
                data-focus-key={part.key}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <TextField
                    label="Gruppe"
                    value={part.title}
                    onChange={(event) =>
                      setPart(part.key, (current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="z. B. Vorteig, Hauptteig, Füllung"
                    disabled={locked}
                    helperText={
                      locked
                        ? 'Der Backzettel liest diese Gruppe - der Name bleibt.'
                        : partIndex === 0 && values.parts.length === 1
                        ? 'Freiwillig - nur bei mehreren Gruppen nötig.'
                        : undefined
                    }
                    size="small"
                    inputProps={{ maxLength: 120 }}
                    sx={{ flex: '1 1 auto', maxWidth: 420 }}
                  />
                  {locked && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label="Backzettel"
                      sx={{ mt: 1 }}
                    />
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  {values.parts.length > 1 && !locked && (
                    <IconButton
                      aria-label={`Gruppe ${groupName} entfernen`}
                      onClick={() => {
                        if (part.rows.every(isEmptyRow)) {
                          set(
                            'parts',
                            values.parts.filter((p) => p.key !== part.key)
                          )
                        } else {
                          setRemovePart(part)
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                {!compact && part.rows.length > 0 && (
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: rowColumns(noteColumn),
                      columnGap: 1,
                      mb: 0.5,
                      color: 'text.secondary',
                      typography: 'caption',
                    }}
                  >
                    <span>Menge</span>
                    <span>Einheit</span>
                    <span>
                      {noteColumn && !wide ? 'Zutat / Hinweis' : 'Zutat'}
                    </span>
                    {noteColumn && wide && <span>Hinweis</span>}
                    <span />
                  </Box>
                )}

                <Box
                  component="ol"
                  aria-label={`Zutaten ${groupName}`}
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: { xs: 1.5, sm: 1 },
                  }}
                >
                  {part.rows.map((row, rowIndex) => (
                    <IngredientRowFields
                      key={row.key}
                      row={row}
                      partKey={part.key}
                      index={rowIndex}
                      count={part.rows.length}
                      problem={problems?.rows[row.key] ?? null}
                      compact={compact}
                      noteColumn={noteColumn}
                      units={units}
                      onChange={changeRow}
                      onMove={moveRow}
                      onRemove={removeRow}
                      onAdd={addRow}
                    />
                  ))}
                </Box>

                {part.total && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1.5 }}
                    data-testid="part-total-note"
                  >
                    {`Summenzeile der Datei: ${part.total.label} ${part.total.text} - sie wird nicht neu berechnet.`}
                  </Typography>
                )}

                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addRow(part.key)}
                  sx={{ mt: 1.5 }}
                >
                  Zutat hinzufügen
                </Button>
              </Box>
            )
          })}
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            const part = newPart()
            set('parts', [...values.parts, part])
            setFocusKey(part.key)
          }}
          sx={{ mt: 2 }}
        >
          Gruppe hinzufügen
        </Button>
      </PageSection>

      <PageSection
        title="Zubereitung"
        description="Ein Feld je Arbeitsschritt. Unterpunkte in neuen Zeilen mit „- “ beginnen."
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {values.steps.map((group, groupIndex) => {
            const groupName =
              group.title.trim() || `Abschnitt ${groupIndex + 1}`
            return (
              <Box
                key={group.key}
                role="group"
                aria-label={`Arbeitsschritte ${groupName}`}
                data-testid="step-group-form"
                data-focus-key={group.key}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <TextField
                    label="Abschnitt"
                    value={group.title}
                    onChange={(event) =>
                      setGroup(group.key, (current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="z. B. Teig, Formen, Backen"
                    size="small"
                    inputProps={{ maxLength: 120 }}
                    sx={{ flex: '1 1 14rem', maxWidth: 420 }}
                  />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={group.ordered ? 'ordered' : 'bullets'}
                    onChange={(_, value: 'ordered' | 'bullets' | null) => {
                      if (!value) return
                      setGroup(group.key, (current) => ({
                        ...current,
                        ordered: value === 'ordered',
                      }))
                    }}
                    aria-label={`Darstellung ${groupName}`}
                  >
                    <ToggleButton value="ordered">Nummeriert</ToggleButton>
                    <ToggleButton value="bullets">Stichpunkte</ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ flexGrow: 1 }} />
                  {values.steps.length > 1 && (
                    <IconButton
                      aria-label={`Abschnitt ${groupName} entfernen`}
                      onClick={() =>
                        set(
                          'steps',
                          values.steps.filter((g) => g.key !== group.key)
                        )
                      }
                      disabled={group.items.some(
                        (item) => item.text.trim() !== ''
                      )}
                      title={
                        group.items.some((item) => item.text.trim() !== '')
                          ? 'Erst die Schritte entfernen'
                          : undefined
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Box
                  component="ol"
                  aria-label={`Schritte ${groupName}`}
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  {group.items.map((item, itemIndex) => (
                    <StepRowFields
                      key={item.key}
                      item={item}
                      groupKey={group.key}
                      index={itemIndex}
                      count={group.items.length}
                      ordered={group.ordered}
                      onChange={changeStep}
                      onMove={moveStep}
                      onRemove={removeStep}
                    />
                  ))}
                </Box>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addStep(group.key)}
                  sx={{ mt: 1.5 }}
                >
                  Schritt hinzufügen
                </Button>
              </Box>
            )
          })}
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            const group = newStepGroup()
            set('steps', [...values.steps, group])
            setFocusKey(group.key)
          }}
          sx={{ mt: 2 }}
        >
          Abschnitt hinzufügen
        </Button>
      </PageSection>

      <PageSection
        title="Notizen"
        description="Haltbarkeit, Lagerung, Tipps. Stichpunkte mit „- “ beginnen."
      >
        <TextField
          value={values.notes}
          onChange={(event) => set('notes', event.target.value)}
          multiline
          minRows={3}
          maxRows={14}
          inputProps={{ 'aria-label': 'Notizen' }}
          fullWidth
        />
      </PageSection>

      {children}

      {/* Speichern - klebt unten, am Tablet immer in Reichweite */}
      <Paper
        elevation={3}
        data-testid="recipe-save-bar"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '@media print': { display: 'none' },
        }}
      >
        {feedback && (
          <Alert
            severity={feedback.severity}
            onClose={onDismissFeedback}
            role={feedback.severity === 'error' ? 'alert' : 'status'}
            action={
              feedback.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={feedback.action.onClick}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {feedback.action.label}
                </Button>
              ) : undefined
            }
          >
            {feedback.message}
          </Alert>
        )}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button
            component={Link}
            href={cancelHref}
            disabled={busy}
            sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
          >
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            size="large"
            disabled={busy}
            startIcon={
              busy ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
          >
            {busy ? busyLabel : submitLabel}
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={removePart !== null}
        onClose={() => setRemovePart(null)}
        aria-labelledby="remove-part-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="remove-part-title">Gruppe entfernen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removePart
              ? `„${removePart.title.trim() || 'Gruppe ohne Namen'}“ mit ${
                  removePart.rows.filter((row) => !isEmptyRow(row)).length
                } Zutaten wird aus dem Rezept entfernt.`
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemovePart(null)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (removePart) {
                set(
                  'parts',
                  values.parts.filter((p) => p.key !== removePart.key)
                )
              }
              setRemovePart(null)
            }}
          >
            Gruppe entfernen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
