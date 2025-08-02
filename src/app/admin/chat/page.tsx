'use client'
import React, { useState, useEffect, useRef } from 'react'
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
import { useAuth } from '../../../context/AuthContext'
import ChatMessageList from '../../../components/admin/chat/ChatMessageList'
import ChatMessageInput from '../../../components/admin/chat/ChatMessageInput'

// Types for chat messages
interface ChatMessage {
  id: number
  message: string
  timestamp: string
  User: {
    username: string
  }
}

const ChatPage: React.FC = () => {
  const { user, token } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch messages from API
  const fetchMessages = async () => {
    if (!token) return

    try {
      const response = await fetch('http://localhost:5000/chat', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(data)
      setError(null)
    } catch (error: any) {
      setError(error.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  // Send new message
  const sendMessage = async (messageText: string) => {
    if (!token || !messageText.trim()) return

    setSending(true)
    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Refresh messages after sending
      await fetchMessages()
      setError(null)
    } catch (error: any) {
      setError(error.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Initial load and polling setup
  useEffect(() => {
    fetchMessages()

    // Set up polling for real-time updates
    const interval = setInterval(fetchMessages, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Team Chat
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Interne Kommunikation für das Bäckerei-Team
      </Typography>

      <Card sx={{ height: '600px', display: 'flex', flexDirection: 'column', mt: 2 }}>
        <CardHeader
          title="Chat Messages"
          subheader={`${messages.length} Nachrichten`}
        />
        <Divider />
        
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <CardContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              bgcolor: 'background.default'
            }}
          >
            {/* Messages Area */}
            <Box 
              sx={{ 
                flex: 1, 
                overflow: 'auto', 
                p: 2,
                maxHeight: '400px'
              }}
            >
              {messages.length === 0 ? (
                <Box 
                  display="flex" 
                  justifyContent="center" 
                  alignItems="center" 
                  height="100%"
                >
                  <Typography color="text.secondary">
                    Noch keine Nachrichten. Seien Sie der Erste, der eine Nachricht sendet!
                  </Typography>
                </Box>
              ) : (
                <>
                  <ChatMessageList messages={messages} currentUser={user} />
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
                disabled={!user || sending}
              />
            </Box>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ChatPage