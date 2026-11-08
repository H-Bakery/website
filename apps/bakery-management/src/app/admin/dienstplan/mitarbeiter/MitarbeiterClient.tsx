'use client'
import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  ChevronRight as ChevronRightIcon,
  Badge as StaffIcon,
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
 * Sitzung): nach Bereich gruppiert (Verkauf zuerst), Filter aktiv /
 * ausgeschieden / alle, „Neuer Mitarbeiter“. Ein Klick öffnet das Profil mit
 * Urlaubskonto. Mitarbeiter werden nie gelöscht, nur ausgeschieden.
 */
export default function MitarbeiterClient() {
  const [employees, setEmployees] = React.useState<Employee[] | null>(null)
  const [filter, setFilter] = React.useState<EmployeeFilter>('aktiv')
  const [error, setError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<Employee | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const reload = React.useCallback(async () => {
    setError(null)
    try {
      setEmployees(await fetchEmployees())
    } catch (err) {
      setError(messageOf(err, 'Die Mitarbeiter konnten nicht geladen werden.'))
      setEmployees((prev) => prev ?? [])
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const shown = employees ? filterEmployees(employees, filter) : []
  const groups = groupByArea(shown)

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            <StaffIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Mitarbeiter
          </Typography>
          <Typography color="text.secondary">
            Profile, Urlaubsanspruch und Abwesenheiten
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            component={Link}
            href="/admin/dienstplan"
            variant="outlined"
            startIcon={<CalendarIcon />}
          >
            Kalender
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Neuer Mitarbeiter
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {created && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
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

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, value: EmployeeFilter | null) =>
          value && setFilter(value)
        }
        aria-label="Filter"
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        {(Object.keys(FILTER_LABELS) as EmployeeFilter[]).map((key) => (
          <ToggleButton key={key} value={key}>
            {FILTER_LABELS[key]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {employees === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Mitarbeiter werden geladen" />
        </Box>
      ) : groups.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">
            {employees.length === 0
              ? 'Noch keine Mitarbeiter. Mit „Neuer Mitarbeiter“ anlegen.'
              : filter === 'ausgeschieden'
              ? 'Niemand ist ausgeschieden.'
              : 'Keine Mitarbeiter in dieser Auswahl.'}
          </Typography>
        </Paper>
      ) : (
        groups.map((group) => (
          <Box
            key={group.area}
            component="section"
            aria-labelledby={`area-${group.area}`}
            sx={{ mb: 3 }}
          >
            <Typography
              variant="h6"
              component="h2"
              id={`area-${group.area}`}
              sx={{ mb: 1 }}
            >
              {group.label}{' '}
              <Typography
                component="span"
                color="text.secondary"
                variant="body2"
              >
                ({group.employees.length})
              </Typography>
            </Typography>
            <Paper variant="outlined">
              <List disablePadding>
                {group.employees.map((employee, index) => (
                  <ListItemButton
                    key={employee.id}
                    component={Link}
                    href={profileHref(employee.id)}
                    divider={index < group.employees.length - 1}
                    data-testid={`employee-${employee.id}`}
                    sx={{ gap: 1.5, minHeight: 56 }}
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
            </Paper>
          </Box>
        ))
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
    </Box>
  )
}
