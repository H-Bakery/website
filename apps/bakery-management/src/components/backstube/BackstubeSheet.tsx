'use client'

import React from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import {
  deltaTotalsByKey,
  isDoughDaySheet,
  type BackzettelConfigData,
  type BackzettelDay,
  type BackzettelDeltaEntry,
  type BackzettelLine,
  type BackzettelSection,
} from '../../lib/backzettelApi'
import {
  bruchGroupText,
  deltaAfterDone,
  doughsTodayText,
  formatTimestamp,
} from '../../lib/backzettelFormat'
import {
  HEFETEIG_ANCHOR,
  bakeDayHeading,
  sectionAnchor,
  sectionsByBakeDay,
  sheetProgress,
} from '../../lib/backstubeProgress'
import { BackstubeLine } from './BackstubeLine'
import { BackstubeHefeteig } from './BackstubeHefeteig'
import { BackstubeDeltas } from './BackstubeDeltas'
import { BackstubeOverview } from './BackstubeOverview'
import { BackstubeLayout, BS_ANCHOR_SX } from './BackstubeLayout'
import { BackstubeGroupHeading } from './BackstubeStates'
import { BS_SECTION_TITLE_SX } from './backstubeType'
import { useBackstubeColors } from './backstubeColors'
import { BackzettelWarnings } from '../backzettel/BackzettelWarnings'
import { DayKindNotice } from '../backzettel/DayKindNotice'
import { DeltaDoughNote } from '../backzettel/DeltaDoughNote'
import { MachineStrip } from '../backzettel/MachineStrip'

export interface BackstubeSheetProps {
  day: BackzettelDay
  config: BackzettelConfigData | null
  /** Abhaken/quittieren erlaubt (Rolle). */
  canWork: boolean
  /** Zeilen-IDs, deren Haken gerade gespeichert wird. */
  pendingIds: ReadonlySet<number>
  onToggle: (line: BackzettelLine) => void
  ackingKey: string | null
  onAck: (group: BackzettelDeltaEntry[], key: string) => void
  /** Nachträge werden im Hintergrund noch übernommen (`deltasPending`). */
  deltasPending: boolean
  /** Über der Hauptspalte (z. B. „Neu laden fehlgeschlagen“). */
  notice?: React.ReactNode
}

/**
 * Reiter „Zettel“: der Backzettel eines Tages. Links (Tablet hochkant: oben)
 * der Überblick - wie weit, Sprung zu jedem Abschnitt -, die Nachträge mit
 * „Gesehen“ und die Hinweise; rechts das, was zu tun ist: Teige, am Samstag
 * zuerst Hefeteig & Füllungen, dann die Zeilen je Abschnitt (Teigtag-Zettel:
 * je Backtag). Alle Zahlen vom Server.
 */
export function BackstubeSheet({
  day,
  config,
  canWork,
  pendingIds,
  onToggle,
  ackingKey,
  onAck,
  deltasPending,
  notice,
}: BackstubeSheetProps) {
  const colors = useBackstubeColors()
  const draft = day.status === 'draft'
  const isSaturday = day.weekday === 6
  const v2 = isDoughDaySheet(day)
  const progress = sheetProgress(day)

  const renderSection = (
    section: BackzettelSection,
    id: string,
    stripBakeDate: boolean
  ) =>
    section.lines.length === 0 ? null : (
      <Box
        component="section"
        key={id}
        id={sectionAnchor(id)}
        data-testid={`bs-section-${id}`}
        aria-labelledby={`bs-section-title-${id}`}
        sx={BS_ANCHOR_SX}
      >
        <Typography
          id={`bs-section-title-${id}`}
          variant={stripBakeDate ? 'h3' : 'h2'}
          component={stripBakeDate ? 'h3' : 'h2'}
          tabIndex={-1}
          sx={{ ...BS_SECTION_TITLE_SX, mt: 1, mb: 1, outline: 'none' }}
        >
          {section.label}
        </Typography>
        <Stack spacing={1}>
          {section.lines.map((line) => (
            <BackstubeLine
              key={line.key}
              // Unter der Backtag-Überschrift kein „· für …“ am Namen.
              line={stripBakeDate ? { ...line, bakeDate: undefined } : line}
              afterDone={draft ? null : deltaAfterDone(line, day.deltas)}
              config={config}
              draft={draft}
              canTick={canWork}
              pending={line.id !== null && pendingIds.has(line.id)}
              onToggle={onToggle}
            />
          ))}
        </Stack>
      </Box>
    )

  // Die Karte zeigt sich nur mit Teig, Füllung oder Nachtrags-Zusatz
  // (`sheetProgress` führt sie dann im Überblick).
  const hefeteig = progress.entries.some(
    (e) => e.anchor === HEFETEIG_ANCHOR
  ) ? (
    <Box id={HEFETEIG_ANCHOR} sx={BS_ANCHOR_SX}>
      <BackstubeHefeteig
        hefeteig={day.hefeteig}
        fillings={day.fillings}
        draft={draft}
        deltaExtras={day.deltaExtras}
      />
    </Box>
  ) : null

  const aside = (
    <>
      {/* Neues zuerst: offene Nachträge verlangen ein „Gesehen“ und
          verschwinden danach - erst dann rückt der Überblick nach oben. */}
      {deltasPending && (
        <Alert
          severity="warning"
          data-testid="bs-deltas-pending"
          sx={{ fontSize: '1.05rem' }}
        >
          Vorbestellungen haben sich geändert. Die Nachträge werden gerade
          übernommen und erscheinen gleich.
        </Alert>
      )}
      <BackstubeDeltas
        sheetDate={day.date}
        deltas={day.deltas}
        bakeByKey={Object.fromEntries(
          Object.entries(deltaTotalsByKey(day)).map(([key, d]) => [
            key,
            d?.bakeOpen,
          ])
        )}
        config={config}
        canAck={canWork && !draft}
        ackingKey={ackingKey}
        onAck={onAck}
      />
      {!draft && <DeltaDoughNote day={day} large />}

      <BackstubeOverview
        progress={draft ? null : { ...progress, verb: 'erledigt' }}
        progressTestId="bs-progress"
        status={
          draft ? null : (
            <>
              Freigegeben
              {day.confirmedBy ? ` von ${day.confirmedBy.displayName}` : ''}
              {day.confirmedAt ? ` am ${formatTimestamp(day.confirmedAt)}` : ''}
            </>
          )
        }
        banner={
          draft ? (
            <Box
              role="status"
              data-testid="bs-draft-banner"
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2,
                bgcolor: colors.draftBg,
                color: colors.draftFg,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '1.5rem', sm: '1.8rem' },
                  fontWeight: 800,
                  lineHeight: 1.15,
                }}
              >
                Noch nicht freigegeben
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', mt: 0.5 }}>
                Die Mengen sind ein Entwurf und können sich noch ändern. Abhaken
                geht erst nach der Freigabe.
              </Typography>
            </Box>
          ) : null
        }
        entries={progress.entries}
        countOnly={draft}
      />

      {!draft && day.configStatus === 'no-config' && (
        <Alert
          severity="warning"
          data-testid="bs-confirmed-no-config"
          sx={{ fontSize: '1.05rem' }}
        >
          Die Backzettel-Stammdaten fehlen gerade. Spätere Änderungen an
          Vorbestellungen können deshalb nicht als Nachtrag erscheinen. Bitte
          dem Inhaber Bescheid geben.
        </Alert>
      )}
      {day.configChangedSinceConfirm && (
        <Alert severity="info" sx={{ fontSize: '1.05rem' }}>
          Die Stammdaten haben sich seit der Freigabe geändert. Es gilt der
          freigegebene Zettel.
        </Alert>
      )}

      {/* UI-Runde 1: Hinweise oben und gelb wie auf der Planungsseite -
          unten als blaue Info übersah man z. B. Vorbestellungen, die zu
          keinem Posten gehören. U9: Tagestyp aus dem Kalender. */}
      <DayKindNotice dayKind={day.dayKind} large />
      <BackzettelWarnings
        warnings={day.warnings}
        large
        data-testid="bs-warnings"
      />
    </>
  )

  return (
    <BackstubeLayout aside={aside}>
      {notice}
      {v2 && (
        <Box
          component="section"
          aria-labelledby="bs-doughs-today"
          sx={{ display: 'grid', gap: 1.5 }}
        >
          <Typography
            id="bs-doughs-today"
            data-testid="bs-doughs-today"
            sx={{
              fontSize: { xs: '1.2rem', sm: '1.45rem' },
              fontWeight: 800,
              lineHeight: 1.25,
            }}
          >
            {/* Kein Teigtag - Posten mit lead 0 werden trotzdem heute
                gemacht (Maschinen-Kästen vom Server), wie in der Übersicht
                (`doughForText`). */}
            {day.isDoughDay === false && (day.machine ?? []).length === 0
              ? 'Heute kein Teig – was gebacken wird, steht unter „Backen“.'
              : doughsTodayText(day)}
          </Typography>
          <MachineStrip
            machine={day.machine ?? []}
            doughs={day.doughs}
            large
            muted={draft}
          />
        </Box>
      )}

      {isSaturday && hefeteig}

      {v2
        ? sectionsByBakeDay(day).map((group) => {
            const rolls = (day.rolls ?? []).find(
              (r) => r.bakeDate === group.bakeDate
            )
            return (
              <Box
                key={group.bakeDate}
                data-testid={`bs-bakeday-${group.bakeDate}`}
                sx={{ display: 'grid', gap: 1 }}
              >
                <BackstubeGroupHeading>
                  {bakeDayHeading(group.bakeDate, day.date)}
                </BackstubeGroupHeading>
                {rolls && rolls.groups.length > 0 && (
                  <Box
                    component="ul"
                    data-testid={`bs-bruch-${group.bakeDate}`}
                    sx={{
                      m: 0,
                      mt: 0.5,
                      p: { xs: 1.5, sm: 2 },
                      pl: { xs: 4, sm: 5 },
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      fontSize: { xs: '1.1rem', sm: '1.3rem' },
                      fontWeight: 700,
                      '& li + li': { mt: 0.5 },
                    }}
                  >
                    {rolls.groups.map((g) => (
                      <li key={g.key}>
                        {g.name}: {bruchGroupText(g)}
                      </li>
                    ))}
                  </Box>
                )}
                {group.sections.map((section) =>
                  renderSection(
                    section,
                    `${group.bakeDate}-${section.id}`,
                    true
                  )
                )}
              </Box>
            )
          })
        : day.sections.map((section) =>
            renderSection(section, section.id, false)
          )}

      {progress.total === 0 && (
        <Typography sx={{ fontSize: '1.4rem', py: 4 }}>
          Auf diesem Zettel steht nichts.
        </Typography>
      )}

      {!isSaturday && hefeteig}
    </BackstubeLayout>
  )
}

export default BackstubeSheet
