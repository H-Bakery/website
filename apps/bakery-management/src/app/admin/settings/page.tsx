'use client'
import React from 'react'
import { Button, ToggleButton, ToggleButtonGroup } from '@mui/material'
import Link from 'next/link'
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  BrightnessAuto as BrightnessAutoIcon,
} from '@mui/icons-material'
import { useNotifications, useTheme, ThemeMode } from '@bakery/shared/contexts'
import { NotificationPreferences } from '@bakery/management/feature-settings'
import { isPilotMode } from '../../../lib/pilotMode'
import { isPathAllowedForRole } from '../../../lib/roles'
import { useOptionalSession } from '../../../lib/session'
import { PageLayout, PageSection } from '../../../components/layout'

const MODE_OPTIONS: {
  value: ThemeMode
  label: string
  icon: React.ReactNode
}[] = [
  { value: 'light', label: 'Hell', icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark', label: 'Dunkel', icon: <DarkModeIcon fontSize="small" /> },
  {
    value: 'system',
    label: 'System',
    icon: <BrightnessAutoIcon fontSize="small" />,
  },
]

/**
 * Einstellungen - Referenzseite des Layout-Kits (src/components/layout):
 * schmale Seite, ein Abschnitt je Thema, keine toten Bedienelemente.
 *
 * Darstellung ist EIN Schalter mit drei Stellungen. Vorher standen zwei
 * Schalter („Dunkles Design“, „Systemeinstellung folgen“) nebeneinander, die
 * sich gegenseitig umlegten: wer „System“ ausschaltete, landete immer in Hell,
 * auch wenn er vorher Dunkel hatte.
 */
export default function SettingsPage() {
  const { mode, setMode, colorScheme } = useTheme()
  const session = useOptionalSession()
  // Im Pilotbetrieb (F4) gibt es weder /api/notifications noch E-Mail-Versand
  // auf der echten API - die Karten würden ewig laden bzw. nur vertrösten.
  const pilot = isPilotMode()
  // Auch ohne Pilotbetrieb kann die API die echte sein (W4): antwortet sie auf
  // /api/notifications mit 404, verschwindet der Abschnitt still.
  const notificationsAvailable = useNotifications().available
  const role = session?.user?.role
  const mayManageUsers =
    !!role && isPathAllowedForRole('/admin/users', role, session?.sessionKind)

  return (
    <PageLayout
      width="narrow"
      title="Einstellungen"
      subtitle="Die Darstellung gilt nur für dieses Gerät."
    >
      <PageSection
        title="Darstellung"
        description={
          mode === 'system'
            ? `Folgt der Einstellung des Geräts - derzeit ${
                colorScheme === 'dark' ? 'dunkel' : 'hell'
              }.`
            : undefined
        }
      >
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_event, next: ThemeMode | null) => {
            // Ein Tipp auf die schon gewählte Stellung liefert null - bleibt.
            if (next) setMode(next)
          }}
          aria-label="Farbschema"
          fullWidth
          sx={{ maxWidth: 480 }}
        >
          {MODE_OPTIONS.map((option) => (
            <ToggleButton
              key={option.value}
              value={option.value}
              sx={{ gap: 1, textTransform: 'none' }}
            >
              {option.icon}
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </PageSection>

      {!pilot && notificationsAvailable !== false && (
        <PageSection title="Benachrichtigungen">
          <NotificationPreferences />
        </PageSection>
      )}

      {!pilot && (
        <PageSection
          title="E-Mail-Versand"
          description="Die Konfiguration des E-Mail-Versands (SMTP) ist noch nicht an die API angebunden."
        />
      )}

      <PageSection
        title="Passwort und PIN"
        description={
          mayManageUsers
            ? 'Passwörter, PINs und Stationen verwalten Sie unter „Benutzer“.'
            : 'Passwort oder PIN vergessen? Der Inhaber setzt sie unter „Benutzer“ neu.'
        }
        actions={
          mayManageUsers ? (
            <Button
              component={Link}
              href="/admin/users"
              variant="outlined"
              sx={{ whiteSpace: 'nowrap' }}
            >
              Benutzer
            </Button>
          ) : undefined
        }
      />
    </PageLayout>
  )
}
