'use client'
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
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
import { stepErrors, validateOrder, type OrderField } from '../lib/validation'
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
  const hydrated = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Statischer Export: "heute" erst im Browser bestimmen, nicht beim Build.
  useEffect(() => {
    if (todayProp) setToday(todayProp)
    else setToday(todayInBerlin(new Date()))
  }, [todayProp])

  // Entwurf erst nach dem Mounten laden (sonst Hydration-Mismatch).
  useEffect(() => {
    if (persistDraft) {
      const draft = loadDraft(config)
      if (draft) dispatch({ type: 'hydrate', state: draft })
    }
    hydrated.current = true
  }, [config, persistDraft])

  useEffect(() => {
    if (persistDraft && hydrated.current) saveDraft(state)
  }, [state, persistDraft])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
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
        else errorRef.current?.focus()
        return
      }
    }
    setStep(target)
  }

  const showError = (field: OrderField) =>
    Boolean(touched[field] || attempted[2])

  const reset = () => {
    dispatch({ type: 'reset' })
    clearDraft()
    setAttempted([false, false, false, false])
    setTouched({})
    setMapping('A')
    setStep(0)
  }

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
            />
          )}
        </Box>

        <Box sx={{ mt: 4 }}>
          <SettingsPanel
            config={config}
            mode={state.toppingMode}
            onModeChange={(mode) => dispatch({ type: 'setMode', mode })}
            onReset={reset}
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
          <Box
            sx={{ flex: '1 1 140px' }}
            aria-live="polite"
            data-testid="running-price"
          >
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
            <Button variant="contained" color="secondary" onClick={reset}>
              Neu beginnen
            </Button>
          )}
        </Container>
      </Paper>
    </Box>
  )
}
