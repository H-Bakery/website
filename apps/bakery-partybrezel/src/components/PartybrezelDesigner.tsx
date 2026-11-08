'use client'
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import {
  partybrezelConfig,
  type PartybrezelConfig,
} from '../config/partybrezel.config'
import { pickupDates, todayInBerlin } from '../lib/dates'
import { clearDraft, loadDraft, saveDraft } from '../lib/draftStorage'
import { formatEuro } from '../lib/format'
import { createOrderReducer, initialOrderState } from '../lib/orderState'
import type { PayloadMapping } from '../lib/payload'
import { priceBreakdown } from '../lib/pricing'
import {
  firstInvalidStep,
  resumeStep,
  stepErrors,
  validateOrder,
  type OrderField,
} from '../lib/validation'
import PrototypeBanner from './PrototypeBanner'
import SettingsPanel from './SettingsPanel'
import PickupStep from './steps/PickupStep'
import SizeStep from './steps/SizeStep'
import SummaryStep from './steps/SummaryStep'
import ToppingStep from './steps/ToppingStep'

export const STEP_TITLES = [
  'Größe & Anzahl',
  'Belag',
  'Abholung & Kontakt',
  'Übersicht',
] as const

export interface PartybrezelDesignerProps {
  config?: PartybrezelConfig
  /** "Heute" als YYYY-MM-DD; ohne Angabe im Browser aus Europe/Berlin bestimmt. */
  today?: string
  /** Entwurf im localStorage merken (Vorgabe: ja). */
  persistDraft?: boolean
}

export default function PartybrezelDesigner({
  config = partybrezelConfig,
  today: todayProp,
  persistDraft = true,
}: PartybrezelDesignerProps) {
  const reducer = useMemo(() => createOrderReducer(config), [config])
  const [state, dispatch] = useReducer(reducer, config, initialOrderState)
  const [step, setStep] = useState(0)
  const [mapping, setMapping] = useState<PayloadMapping>('A')
  const [attempted, setAttempted] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ])
  const [touched, setTouched] = useState<Partial<Record<OrderField, boolean>>>(
    {}
  )
  const [today, setToday] = useState<string | null>(todayProp ?? null)
  // Gespeichert wird erst, wenn der Entwurf geladen UND angewandt ist - sonst
  // überschriebe der leere Anfangszustand ihn (StrictMode ruft Effekte in
  // `next dev` zweimal auf; der zweite Lauf läse dann den leeren Entwurf).
  const [draftReady, setDraftReady] = useState(!persistDraft)
  const draftLoaded = useRef(false)
  const [errorFocusToken, setErrorFocusToken] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)
  // Ein beim Laden wiederhergestellter Schritt zieht den Fokus nicht an sich.
  const skipHeadingFocus = useRef<number | null>(null)

  // Statischer Export: "heute" erst im Browser bestimmen, nicht beim Build.
  useEffect(() => {
    if (todayProp) setToday(todayProp)
    else setToday(todayInBerlin(new Date()))
  }, [todayProp])

  // Entwurf erst nach dem Mounten laden (sonst Hydration-Mismatch), und nur
  // einmal je Komponente.
  useEffect(() => {
    if (!persistDraft) return
    if (!draftLoaded.current) {
      draftLoaded.current = true
      const draft = loadDraft(config)
      if (draft) {
        dispatch({ type: 'hydrate', state: draft.state })
        // Weiter auf dem gemerkten Schritt - aber nie hinter einem Schritt,
        // der inzwischen offen ist (z. B. Abholtag abgelaufen).
        const day = todayProp ?? todayInBerlin(new Date())
        const allowed = pickupDates(day, {
          leadTimeDays: config.leadTimeDays,
          availableWeekdays: config.availableWeekdays,
          count: config.pickupDaysShown,
        }).map((d) => d.date)
        const target = resumeStep(
          validateOrder(draft.state, config, allowed).errors,
          draft.step
        )
        if (target > 0) {
          skipHeadingFocus.current = target
          setStep(target)
        }
      }
    }
    setDraftReady(true)
    // geladen wird nur einmal (draftLoaded) - die Abhängigkeiten ändern daran nichts
  }, [config, persistDraft, todayProp])

  // `draftReady` wird erst im Render NACH dem `hydrate` wahr - der leere
  // Anfangszustand wird nie gespeichert.
  useEffect(() => {
    if (persistDraft && draftReady) saveDraft(state, step)
  }, [state, step, persistDraft, draftReady])

  // Fehler erst fokussieren, wenn die Meldung gerendert ist (beim ersten
  // Fehlversuch gibt es sie vorher noch nicht).
  useEffect(() => {
    if (errorFocusToken === 0) return
    const el = errorRef.current
    if (!el) return
    el.focus()
    el.scrollIntoView?.({ block: 'center' })
  }, [errorFocusToken])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (skipHeadingFocus.current === step) {
      skipHeadingFocus.current = null
      return
    }
    headingRef.current?.focus()
  }, [step])

  const dates = useMemo(
    () =>
      today
        ? pickupDates(today, {
            leadTimeDays: config.leadTimeDays,
            availableWeekdays: config.availableWeekdays,
            count: config.pickupDaysShown,
          })
        : null,
    [today, config]
  )
  const validation = useMemo(
    () =>
      validateOrder(
        state,
        config,
        (dates ?? []).map((d) => d.date)
      ),
    [state, config, dates]
  )
  const price = useMemo(
    () => priceBreakdown(state.pretzels, config),
    [state.pretzels, config]
  )

  const stepValid = (i: number) => stepErrors(validation.errors, i).length === 0
  const canReach = (target: number) => {
    for (let i = 0; i < target; i += 1) if (!stepValid(i)) return false
    return true
  }

  const goTo = (target: number) => {
    if (target <= step) {
      setStep(target)
      return
    }
    for (let i = step; i < target; i += 1) {
      if (!stepValid(i)) {
        setAttempted((a) => a.map((v, j) => (j === i ? true : v)))
        if (i !== step) setStep(i)
        else setErrorFocusToken((n) => n + 1)
        return
      }
    }
    setStep(target)
  }

  const showError = (field: OrderField) =>
    Boolean(touched[field] || attempted[2])

  const reset = () => {
    setConfirmReset(false)
    dispatch({ type: 'reset' })
    clearDraft()
    setAttempted([false, false, false, false])
    setTouched({})
    setMapping('A')
    setStep(0)
  }

  // Auf der Übersicht, aber ein früherer Schritt ist (wieder) offen - etwa
  // nach dem Umschalten des Belag-Modus in den Prototyp-Einstellungen.
  const blockingStep =
    step === STEP_TITLES.length - 1
      ? firstInvalidStep(validation.errors, step)
      : -1
  const blockingMessages =
    blockingStep >= 0
      ? STEP_TITLES.slice(0, step).flatMap((_, i) =>
          stepErrors(validation.errors, i)
        )
      : []

  const currentErrors = attempted[step]
    ? stepErrors(validation.errors, step)
    : []

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <PrototypeBanner questions={config.openQuestions} />
      <Container component="main" maxWidth="md" sx={{ px: 2, py: 3, pb: 14 }}>
        <Typography component="h1" variant="h1" sx={{ mb: 1 }}>
          Partybrezel selbst zusammenstellen
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          In vier Schritten zu Ihrer Partybrezel: Größe, Belag, Abholung und
          Übersicht.
        </Typography>

        <Stepper
          nonLinear
          activeStep={step}
          alternativeLabel
          aria-label="Schritte"
          sx={{
            mb: 3,
            '& .MuiStepLabel-label': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
            '& .MuiStepLabel-label.MuiStepLabel-alternativeLabel': { mt: 0.5 },
          }}
        >
          {STEP_TITLES.map((title, i) => (
            <Step key={title} completed={i < step && stepValid(i)}>
              <StepButton
                onClick={() => goTo(i)}
                disabled={i > step && !canReach(i) && i !== step + 1}
                aria-current={i === step ? 'step' : undefined}
              >
                {title}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        <Box component="section" aria-labelledby="step-heading">
          <Typography
            id="step-heading"
            ref={headingRef}
            tabIndex={-1}
            component="h2"
            variant="h2"
            sx={{ mb: 2, outline: 'none' }}
          >
            {`Schritt ${step + 1} von ${STEP_TITLES.length}: ${
              STEP_TITLES[step]
            }`}
          </Typography>

          {currentErrors.length > 0 && (
            <Alert
              severity="error"
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              sx={{ mb: 2 }}
              data-testid="step-errors"
            >
              {currentErrors.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </Alert>
          )}

          {blockingStep >= 0 && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              data-testid="summary-incomplete"
            >
              <AlertTitle>
                Die Zusammenstellung ist nicht vollständig
              </AlertTitle>
              {blockingMessages.map((m) => (
                <div key={m}>{m}</div>
              ))}
              <Box sx={{ mt: 1 }}>
                Die Übersicht und die Vorschau unten gelten erst, wenn das
                erledigt ist.
              </Box>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => goTo(blockingStep)}
                sx={{ mt: 1 }}
              >
                {`Zu Schritt ${blockingStep + 1}: ${STEP_TITLES[blockingStep]}`}
              </Button>
            </Alert>
          )}

          {step === 0 && (
            <SizeStep
              config={config}
              pretzels={state.pretzels}
              onCountChange={(size, count) =>
                dispatch({ type: 'setCount', size, count })
              }
            />
          )}
          {step === 1 && (
            <ToppingStep
              config={config}
              pretzels={state.pretzels}
              mode={state.toppingMode}
              onPartTopping={(pretzelId, part, toppingId) =>
                dispatch({ type: 'setPartTopping', pretzelId, part, toppingId })
              }
              onPretzelTopping={(pretzelId, toppingId) =>
                dispatch({ type: 'setPretzelTopping', pretzelId, toppingId })
              }
              onCopyToAll={(pretzelId) =>
                dispatch({ type: 'copyToAll', pretzelId })
              }
            />
          )}
          {step === 2 && (
            <PickupStep
              config={config}
              draft={state}
              dates={dates}
              errors={validation.errors}
              showError={showError}
              onBlur={(field) => setTouched((t) => ({ ...t, [field]: true }))}
              onDate={(date) => dispatch({ type: 'setPickupDate', date })}
              onField={(field, value) =>
                dispatch({ type: 'setField', field, value })
              }
            />
          )}
          {step === 3 && (
            <SummaryStep
              config={config}
              draft={state}
              mapping={mapping}
              onMappingChange={setMapping}
              incomplete={blockingStep >= 0}
            />
          )}
        </Box>

        <Box sx={{ mt: 4 }}>
          <SettingsPanel
            config={config}
            mode={state.toppingMode}
            onModeChange={(mode) => dispatch({ type: 'setMode', mode })}
            onReset={() => setConfirmReset(true)}
          />
        </Box>
      </Container>

      <Paper
        component="nav"
        aria-label="Schritt wechseln"
        elevation={8}
        square
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* bewusst ohne aria-live: sonst kündigte jeder Tipp auf +/− oder
              einen Belag die Summe erneut an */}
          <Box sx={{ flex: '1 1 140px' }} data-testid="running-price">
            <Typography variant="body2" color="text.secondary" component="span">
              Summe (Platzhalter){' '}
            </Typography>
            <Typography component="strong" sx={{ fontWeight: 700 }}>
              {formatEuro(price.totalCents)}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
          >
            Zurück
          </Button>
          {step < STEP_TITLES.length - 1 ? (
            <Button variant="contained" onClick={() => goTo(step + 1)}>
              Weiter
            </Button>
          ) : (
            <Button variant="outlined" onClick={() => setConfirmReset(true)}>
              Neu beginnen
            </Button>
          )}
        </Container>
      </Paper>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        aria-labelledby="confirm-reset-title"
        aria-describedby="confirm-reset-text"
      >
        <DialogTitle id="confirm-reset-title">
          Zusammenstellung verwerfen?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-reset-text">
            Zusammenstellung wirklich verwerfen? Ihre Eingaben gehen verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)} autoFocus>
            Abbrechen
          </Button>
          <Button onClick={reset} color="error" variant="contained">
            Verwerfen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
