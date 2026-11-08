'use client'
import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import {
  EMPLOYMENT_TYPE_LABELS,
  fetchEmployees,
  filterEmployees,
  formatDateDe,
  formatDays,
  groupByArea,
  type Employee,
  type EmployeeFilter,
} from '../../../../lib/dienstplanApi'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import EmployeeDialog, { ColorDot, messageOf } from './EmployeeDialog'

const FILTER_LABELS: Record<EmployeeFilter, string> = {
  aktiv: 'Aktiv',
  ausgeschieden: 'Ausgeschieden',
  alle: 'Alle',
}

export function profileHref(id: number): string {
  return `/admin/dienstplan/mitarbeiter/${id}`
}

/** Zweite Zeile eines Eintrags: Beschäftigung, Stunden, Ein-/Austritt. */
function details(employee: Employee): string {
  const parts: string[] = []
  if (employee.employmentType) {
    parts.push(EMPLOYMENT_TYPE_LABELS[employee.employmentType])
  }
  if (employee.weeklyHours !== null) {
    parts.push(`${formatDays(employee.weeklyHours)} Std./Woche`)
  }
  if (employee.entryDate) parts.push(`seit ${formatDateDe(employee.entryDate)}`)
  if (employee.exitDate) parts.push(`bis ${formatDateDe(employee.exitDate)}`)
  return parts.join(' · ')
}

/**
 * Mitarbeiterliste des Dienstplans (TASK-042, nur Inhaber mit persönlicher
 * Sitzung): nach Bereich gruppiert (Verkauf zuerst, je Bereich ein
 * Abschnitt), Filter aktiv / ausgeschieden / alle, „Neuer Mitarbeiter“ als
 * Hauptaktion. Ein Tipp auf eine Zeile öffnet das Profil mit Urlaubskonto.
 * Mitarbeiter werden nie gelöscht, nur ausgeschieden.
 */
export default function MitarbeiterClient() {
  const [employees, setEmployees] = React.useState<Employee[] | null>(null)
  const [filter, setFilter] = React.useState<EmployeeFilter>('aktiv')
  // Ohne geladene Liste steht nur der Fehler da - nie „Noch keine
  // Mitarbeiter“, als gäbe es keine (Muster wie Benutzer).
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<Employee | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const reload = React.useCallback(async () => {
    setLoadError(null)
    try {
      setEmployees(await fetchEmployees())
    } catch (err) {
      setLoadError(
        messageOf(err, 'Die Mitarbeiter konnten nicht geladen werden.')
      )
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const shown = employees ? filterEmployees(employees, filter) : []
  const groups = groupByArea(shown)

  return (
    <PageLayout
      title="Mitarbeiter"
      subtitle="Profile, Urlaubsanspruch und Abwesenheiten"
      back={{ href: '/admin/dienstplan', label: 'Dienstplan' }}
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Neuer Mitarbeiter
        </Button>
      }
    >
      {loadError && (
        <ErrorState
          data-testid="employees-load-error"
          message={loadError}
          onRetry={() => void reload()}
        />
      )}
      {created && (
        <Alert
          severity="success"
          onClose={() => setCreated(null)}
          action={
            <Button
              component={Link}
              href={profileHref(created.id)}
              color="inherit"
              size="small"
            >
              Profil öffnen
            </Button>
          }
        >
          {created.displayName} angelegt. Im Profil den Urlaubsanspruch
          eintragen.
        </Alert>
      )}

      {employees === null ? (
        loadError ? null : (
          <LoadingState label="Mitarbeiter werden geladen …" />
        )
      ) : (
        <>
          <PageSection variant="plain" printHidden>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={(_, value: EmployeeFilter | null) =>
                value && setFilter(value)
              }
              aria-label="Filter"
            >
              {(Object.keys(FILTER_LABELS) as EmployeeFilter[]).map((key) => (
                <ToggleButton key={key} value={key}>
                  {FILTER_LABELS[key]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PageSection>

          {groups.length === 0 ? (
            <EmptyState
              title={
                employees.length === 0
                  ? 'Noch keine Mitarbeiter.'
                  : filter === 'ausgeschieden'
                  ? 'Niemand ist ausgeschieden.'
                  : 'Keine Mitarbeiter in dieser Auswahl.'
              }
              description={
                employees.length === 0
                  ? 'Mit „Neuer Mitarbeiter“ anlegen.'
                  : undefined
              }
            />
          ) : (
            groups.map((group) => (
              <PageSection
                key={group.area}
                id={`area-${group.area}`}
                title={`${group.label} (${group.employees.length})`}
                disablePadding
              >
                <List disablePadding aria-label={group.label}>
                  {group.employees.map((employee, index) => (
                    <ListItemButton
                      key={employee.id}
                      component={Link}
                      href={profileHref(employee.id)}
                      divider={index < group.employees.length - 1}
                      data-testid={`employee-${employee.id}`}
                      sx={{ gap: 1.5, minHeight: 56, px: { xs: 2, md: 3 } }}
                    >
                      <ColorDot color={employee.color} size={14} />
                      <ListItemText
                        primary={employee.displayName}
                        secondary={details(employee) || undefined}
                        primaryTypographyProps={{ fontWeight: 600 }}
                      />
                      {!employee.active && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label="ausgeschieden"
                        />
                      )}
                      <ChevronRightIcon color="action" />
                    </ListItemButton>
                  ))}
                </List>
              </PageSection>
            ))
          )}
        </>
      )}

      {dialogOpen && (
        <EmployeeDialog
          onClose={() => setDialogOpen(false)}
          onDone={(employee) => {
            setDialogOpen(false)
            setCreated(employee)
            void reload()
          }}
        />
      )}
    </PageLayout>
  )
}
