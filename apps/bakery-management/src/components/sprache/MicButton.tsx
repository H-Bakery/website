'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Mic, Stop } from '@mui/icons-material'
import { ApiError } from '@bakery/shared/data-access'
import type { RestDay, RestDraft } from '../../lib/restApi'
import {
  fetchVoiceStatus,
  understandVoice,
  type VoiceResult,
  type VoiceStatus,
} from '../../lib/spracheApi'
import VoiceSheet, { type VoiceEntry } from './VoiceSheet'
import { useRecorder } from './useRecorder'

const NO_BOX_CONNECTION =
  'Keine Verbindung zur Bäckerei-Box – bitte WLAN prüfen oder tippen.'
const NO_BUDGET = 'Spracheingabe für diesen Monat aufgebraucht – bitte tippen.'

function noticeSeen(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export default function MicButton({
  day,
  draft,
  userId,
  saveBar,
  onApply,
}: {
  day: RestDay
  draft: RestDraft
  userId: number | string
  saveBar: boolean
  onApply: (rows: VoiceEntry[]) => void
}) {
  const [status, setStatus] = useState<VoiceStatus>()
  const [connectionError, setConnectionError] = useState(false)
  const [online, setOnline] = useState(true)
  const [mode, setMode] = useState<'secure' | 'insecure' | 'unsupported'>()
  const [notice, setNotice] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [failure, setFailure] = useState<{
    message: string
    retryable: boolean
  } | null>(null)
  const [results, setResults] = useState<VoiceResult[]>([])
  const recorder = useRecorder()
  const cancelRecording = recorder.cancel
  const request = useRef<AbortController | null>(null)
  const statusRequest = useRef(0)
  const acceptedNotice = useRef(false)
  const noticeKey = `bakery-voice-notice:${userId}`
  const invalidateStatus = useCallback(() => {
    statusRequest.current++
  }, [])
  const refresh = useCallback(() => {
    const id = ++statusRequest.current
    void fetchVoiceStatus().then(
      (value) => {
        if (statusRequest.current !== id) return
        setStatus(value)
        setConnectionError(false)
      },
      () => {
        if (statusRequest.current === id) setConnectionError(true)
      }
    )
  }, [])

  useEffect(() => {
    setMode(
      !window.isSecureContext || window.location.protocol !== 'https:'
        ? 'insecure'
        : typeof navigator.mediaDevices?.getUserMedia === 'function'
        ? 'secure'
        : 'unsupported'
    )
    const update = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) refresh()
    }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      invalidateStatus()
      request.current?.abort()
      request.current = null
    }
  }, [refresh, invalidateStatus])

  const local = status?.sttProvider === 'local'
  const budgetEmpty = !local && status?.budget.remainingEuro === 0
  const available = !!status?.enabled && status.screens.includes('rest')
  const listening = recorder.phase === 'recording'
  const busy = processing || recorder.phase !== 'idle'
  const blocked = !available || !online || connectionError || budgetEmpty
  const message =
    !online || connectionError
      ? NO_BOX_CONNECTION
      : !available
      ? null
      : mode === 'insecure'
      ? 'Spracheingabe braucht HTTPS – bitte tippen.'
      : mode === 'unsupported'
      ? 'Das Mikrofon ist auf diesem Gerät nicht verfügbar – bitte tippen.'
      : budgetEmpty
      ? NO_BUDGET
      : status?.budget.warning
      ? 'Monatsbudget der Spracheingabe zu mindestens 80 % verbraucht.'
      : null

  function send(clip: Blob) {
    if (!navigator.onLine) {
      setFailure({ message: NO_BOX_CONNECTION, retryable: true })
      return
    }
    const controller = new AbortController()
    request.current = controller
    setProcessing(true)
    void understandVoice(day.date, clip, controller.signal)
      .then(
        (result) => {
          if (request.current !== controller) return
          setResults((previous) => [...previous, result])
        },
        (error: unknown) => {
          if (request.current !== controller) return
          const apiError = error instanceof ApiError && error.code
          setFailure({
            message: apiError ? error.message : NO_BOX_CONNECTION,
            retryable: !apiError || error.code === 'voice_unavailable',
          })
        }
      )
      .finally(() => {
        if (request.current !== controller) return
        request.current = null
        setProcessing(false)
        refresh()
      })
  }

  function start() {
    if (blocked || mode !== 'secure' || busy) return
    if (!acceptedNotice.current && !noticeSeen(noticeKey)) {
      setNotice(true)
      return
    }
    setFailure(null)
    void recorder.start(send)
  }

  const cancel = useCallback(() => {
    cancelRecording()
    request.current?.abort()
    request.current = null
    setProcessing(false)
  }, [cancelRecording])

  useEffect(() => {
    if (!online) cancel()
  }, [online, cancel])

  function dismiss() {
    setFailure(null)
    setResults([])
  }

  const showFab = available && mode === 'secure'
  const statusText = processing
    ? 'Verstehe …'
    : listening
    ? recorder.noSound
      ? 'Ich höre nichts – Mikrofon erlaubt?'
      : `Ich höre zu … ${recorder.seconds} s`
    : recorder.phase === 'requesting'
    ? 'Warte auf Mikrofonzugriff …'
    : null
  const feedback = failure?.message || recorder.error || message
  const sheetOpen = results.length > 0 && !busy && !notice
  const checkConnection = connectionError && online ? refresh : undefined
  const retryUnavailable = failure?.retryable

  return (
    <>
      {showFab && <Box aria-hidden sx={{ height: 112 }} />}
      <Stack
        alignItems="flex-end"
        spacing={1}
        sx={
          showFab
            ? {
                position: 'fixed',
                right: { xs: 12, sm: 24 },
                bottom: `calc(${
                  saveBar ? 92 : 16
                }px + env(safe-area-inset-bottom))`,
                maxWidth: 'calc(100vw - 24px)',
                zIndex: (theme) => theme.zIndex.appBar - 1,
              }
            : undefined
        }
      >
        {(statusText || (feedback && !sheetOpen)) && (
          <Paper elevation={showFab ? 6 : 0} sx={{ p: 1 }}>
            {statusText && (
              <Typography variant="body2" role="status" aria-live="polite">
                {statusText}
              </Typography>
            )}
            {feedback && !sheetOpen && (
              <Alert severity="info">{feedback}</Alert>
            )}
            {busy && <Button onClick={cancel}>Abbrechen</Button>}
            {!busy && checkConnection && (
              <Button onClick={checkConnection}>Verbindung prüfen</Button>
            )}
            {!busy && retryUnavailable && !blocked && (
              <Button onClick={start}>Erneut sprechen</Button>
            )}
          </Paper>
        )}
        {showFab && (
          <Fab
            color="primary"
            aria-label={listening ? 'Aufnahme stoppen' : 'Sprechen'}
            aria-pressed={listening}
            title={listening ? 'Aufnahme stoppen' : 'Sprechen'}
            disabled={!listening && (blocked || busy || retryUnavailable)}
            onClick={() => (listening ? recorder.stop() : start())}
            sx={{
              width: 72,
              height: 72,
              display: 'flex',
              flexDirection: 'column',
              fontSize: '0.65rem',
              lineHeight: 1.1,
              color: 'primary.contrastText',
              ...(listening
                ? {
                    boxShadow: `0 0 0 ${
                      4 + Math.round(Math.min(1, recorder.level * 8) * 12)
                    }px currentColor`,
                    '@media (prefers-reduced-motion: no-preference)': {
                      transition: 'box-shadow 100ms',
                    },
                  }
                : {}),
            }}
          >
            {listening ? <Stop /> : <Mic />}
            {listening ? 'Stopp' : 'Sprechen'}
          </Fab>
        )}
      </Stack>

      <Dialog
        open={notice}
        onClose={() => setNotice(false)}
        aria-labelledby="voice-notice"
      >
        <DialogTitle id="voice-notice">Freiwillige Spracheingabe</DialogTitle>
        <DialogContent>
          <Typography>
            Du kannst jederzeit tippen.{' '}
            {local
              ? 'Die Aufnahme wird auf der Bäckerei-Box erkannt und verlässt sie dafür nicht.'
              : 'Die Aufnahme geht zur Erkennung an den eingestellten Sprachanbieter.'}{' '}
            Ist Claude eingerichtet, erhält Anthropic bei Bedarf den gehörten
            Text und die Produktliste. Die Bäckerei-App speichert weder die
            Aufnahme noch den gehörten Text. Bitte sprich nur Produktnamen und
            Mengen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotice(false)}>Weiter tippen</Button>
          <Button
            onClick={() => {
              acceptedNotice.current = true
              try {
                localStorage.setItem(noticeKey, '1')
              } catch {
                /* nur in dieser Sitzung */
              }
              setNotice(false)
              start()
            }}
          >
            Aufnahme starten
          </Button>
        </DialogActions>
      </Dialog>

      {results.length > 0 && (
        <VoiceSheet
          open={sheetOpen}
          feedback={feedback}
          onCheckConnection={checkConnection}
          day={day}
          draft={draft}
          results={results}
          canRepeat={!blocked}
          onRepeat={start}
          onDiscard={dismiss}
          onApply={(rows) => {
            onApply(rows)
            dismiss()
          }}
        />
      )}
    </>
  )
}
