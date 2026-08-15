'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
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
  const [error, setError] = useState<string | null>(null)
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
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Bitte melden Sie sich an, um den Team-Chat zu nutzen.'
            : 'Chat-Nachrichten konnten nicht geladen werden.'
        )
      }

      const data = await response.json()
      setMessages(Array.isArray(data) ? data : data?.data ?? [])
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith('Bitte')
          ? err.message
          : 'Der Chat-Server ist derzeit nicht erreichbar.'
      )
    } finally {
      setLoading(false)
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
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nachricht konnte nicht gesendet werden.'
      )
    } finally {
      setSending(false)
    }
  }

  // Initial load and polling setup
  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

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

  const canSend = Boolean(chatUser || getToken())

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

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        {!error && !canSend && (
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
                    {error
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
