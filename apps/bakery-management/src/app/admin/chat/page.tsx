'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material'
import { useAuth } from '@bakery/shared/contexts'
import {
  ChatMessageList,
  ChatMessageInput,
} from '@bakery/management/feature-chat'

// Types for chat messages
interface ChatMessage {
  id: number
  message: string
  timestamp: string
  User: {
    username: string
  }
}

interface ChatUser {
  id: string
  username: string
}

const TOKEN_KEY = 'bakery-auth-token'
const CHAT_ENDPOINT = '/api/chat'
const POLL_INTERVAL_MS = 5000

/**
 * Erreichbarkeit des Chat-Endpunkts. Gepollt wird nur bei `online`: Der
 * Mock-Server kennt `/api/chat` nicht, und ein Endpunkt, der einmal 404
 * geliefert hat, wird nicht alle fünf Sekunden erneut gefragt - sonst füllt
 * sich die Konsole mit Fehlern, und der Server bekommt Dauerlast für nichts.
 * Ein erneuter Versuch geht nur über den Button.
 */
type ChatAvailability =
  | 'unknown'
  | 'online'
  | 'missing'
  | 'unauthorized'
  | 'offline'

const AVAILABILITY_HINTS: Record<
  Exclude<ChatAvailability, 'unknown' | 'online'>,
  { severity: 'info' | 'warning'; text: string }
> = {
  missing: {
    severity: 'info',
    text: 'Der Team-Chat ist auf diesem Server noch nicht eingerichtet. Neue Nachrichten werden nicht abgefragt.',
  },
  unauthorized: {
    severity: 'info',
    text: 'Bitte melden Sie sich an, um den Team-Chat zu nutzen.',
  },
  offline: {
    severity: 'warning',
    text: 'Der Chat-Server ist derzeit nicht erreichbar. Neue Nachrichten werden erst nach einem erneuten Versuch abgefragt.',
  },
}

const availabilityFromStatus = (status: number): ChatAvailability => {
  if (status === 404) return 'missing'
  if (status === 401 || status === 403) return 'unauthorized'
  return 'offline'
}

/**
 * `useAuth` throws when no AuthProvider is mounted (this page used to crash
 * with a 500 because of that). Degrade gracefully to a read-only chat instead.
 * The hook order stays stable because `useAuth` is always called exactly once.
 */
const useOptionalAuthUser = (): ChatUser | null => {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- called unconditionally; try/catch only guards the missing-provider throw
    const { user } = useAuth()
    return user ? { id: String(user.id), username: user.email } : null
  } catch {
    return null
  }
}

const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

const authHeaders = (): HeadersInit => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const ChatPage: React.FC = () => {
  const chatUser = useOptionalAuthUser()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [availability, setAvailability] = useState<ChatAvailability>('unknown')
  const [retrying, setRetrying] = useState<boolean>(false)
  const [attempt, setAttempt] = useState<number>(0)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(CHAT_ENDPOINT, { headers: authHeaders() })

      if (!response.ok) {
        setAvailability(availabilityFromStatus(response.status))
        return
      }

      const data = await response.json()
      setMessages(Array.isArray(data) ? data : data?.data ?? [])
      setAvailability('online')
    } catch {
      setAvailability('offline')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [])

  // Send new message
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return

    setSending(true)
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: messageText }),
      })

      if (!response.ok) {
        throw new Error('Nachricht konnte nicht gesendet werden.')
      }

      await fetchMessages()
      setSendError(null)
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : 'Nachricht konnte nicht gesendet werden.'
      )
    } finally {
      setSending(false)
    }
  }

  // Erster Abruf - und jeder weitere Versuch per Button.
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages, attempt])

  // Polling nur, solange der Endpunkt antwortet. Schlägt ein Abruf fehl,
  // wechselt `availability`, der Effekt räumt auf, und das Intervall ist weg.
  useEffect(() => {
    if (availability !== 'online') return
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [availability, fetchMessages])

  const retry = () => {
    setRetrying(true)
    setAttempt((n) => n + 1)
  }

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress aria-label="Lade Chat" />
      </Box>
    )
  }

  const hint =
    availability === 'unknown' || availability === 'online'
      ? null
      : AVAILABILITY_HINTS[availability]
  const canSend = availability === 'online' && Boolean(chatUser || getToken())

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Team-Chat
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Interne Kommunikation für das Bäckerei-Team
      </Typography>

      <Card
        sx={{
          height: { xs: '400px', sm: '500px', md: '600px' },
          display: 'flex',
          flexDirection: 'column',
          mt: 2,
        }}
      >
        <CardHeader
          title="Nachrichten"
          subheader={`${messages.length} ${
            messages.length === 1 ? 'Nachricht' : 'Nachrichten'
          }`}
        />
        <Divider />

        {hint && (
          <Alert
            severity={hint.severity}
            sx={{ m: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={retry}
                disabled={retrying}
              >
                Erneut versuchen
              </Button>
            }
          >
            {hint.text}
          </Alert>
        )}
        {sendError && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            onClose={() => setSendError(null)}
          >
            {sendError}
          </Alert>
        )}
        {!hint && !canSend && (
          <Alert severity="info" sx={{ m: 2 }}>
            Sie sind nicht angemeldet – Nachrichten können nur gelesen werden.
          </Alert>
        )}

        <CardContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
          <Paper
            elevation={0}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
            }}
          >
            {/* Messages Area */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                maxHeight: { xs: '250px', sm: '320px', md: '400px' },
              }}
            >
              {messages.length === 0 ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="100%"
                >
                  <Typography color="text.secondary" align="center">
                    {hint
                      ? 'Keine Nachrichten verfügbar.'
                      : 'Noch keine Nachrichten. Seien Sie der Erste, der eine Nachricht sendet!'}
                  </Typography>
                </Box>
              ) : (
                <>
                  <ChatMessageList messages={messages} currentUser={chatUser} />
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>

            <Divider />

            {/* Message Input Area */}
            <Box sx={{ p: 2 }}>
              <ChatMessageInput
                onSendMessage={sendMessage}
                sending={sending}
                disabled={!canSend || sending}
              />
            </Box>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ChatPage
