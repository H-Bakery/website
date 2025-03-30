'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material'
import { useRouter } from 'next/navigation'

import Hero from '../../components/Hero'
import Base from '../../layouts/Base'
import Button from '../../components/button/Index'
import Input from '../../components/Input'

// Chat message interface
interface Message {
  id: number
  user_id: number
  message: string
  timestamp: string
}

const Dashboard: React.FC = () => {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(true)
  const [cashAmount, setCashAmount] = useState<string>('')
  const [chatMessage, setChatMessage] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [username, setUsername] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    // Fetch initial data
    fetchChatMessages()

    // Extract username from token (if you want to display it)
    try {
      // This is a simple example - in a real app, you might want to decode the JWT
      // or make an API call to get user info
      setUsername('Logged In User')
    } catch (e) {
      console.error('Error getting username', e)
    }

    setLoading(false)
  }, [router])

  // Fetch chat messages from the API
  const fetchChatMessages = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/chat', {
        headers: {
          Authorization: token || '',
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          // Token expired or invalid
          logout()
          return
        }
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(data)
    } catch (error: any) {
      setError('Failed to load messages: ' + error.message)
    }
  }

  // Submit cash entry
  const submitCashEntry = async () => {
    if (!cashAmount || isNaN(Number(cashAmount))) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/cash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token || '',
        },
        body: JSON.stringify({ amount: Number(cashAmount) }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          // Token expired or invalid
          logout()
          return
        }
        throw new Error('Failed to save cash entry')
      }

      setCashAmount('')
      alert('Cash entry saved successfully!')
    } catch (error: any) {
      setError('Failed to save cash entry: ' + error.message)
    }
  }

  // Submit chat message
  const submitChatMessage = async () => {
    if (!chatMessage.trim()) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token || '',
        },
        body: JSON.stringify({ message: chatMessage }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          // Token expired or invalid
          logout()
          return
        }
        throw new Error('Failed to send message')
      }

      setChatMessage('')
      // Refresh messages
      fetchChatMessages()
    } catch (error: any) {
      setError('Failed to send message: ' + error.message)
    }
  }

  // Logout function
  const logout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  if (loading) {
    return (
      <Base>
        <Container
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '60vh',
          }}
        >
          <CircularProgress />
        </Container>
      </Base>
    )
  }

  return (
    <Base>
      <Hero title={`Dashboard - Welcome ${username}`} />
      <Container>
        {error && (
          <Box
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              p: 2,
              mb: 2,
              borderRadius: 1,
            }}
          >
            {error}
            <Button
              onClick={() => setError('')}
              style={{
                marginLeft: '10px',
                background: 'white',
                color: 'red',
                padding: '0 10px',
              }}
            >
              Clear
            </Button>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* Cash Entry Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Daily Cash Entry
                </Typography>
                <Input
                  name="cashAmount"
                  placeholder="Enter amount"
                  label="Cash Amount"
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
                <Button onClick={submitCashEntry}>Save Cash Entry</Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Chat Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team Chat
                </Typography>
                <Box
                  sx={{
                    height: '200px',
                    overflowY: 'auto',
                    border: '1px solid #eee',
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    bgcolor: '#f9f9f9',
                  }}
                >
                  {messages.length === 0 ? (
                    <Typography color="textSecondary" align="center">
                      No messages yet
                    </Typography>
                  ) : (
                    messages.map((msg) => (
                      <Box
                        key={msg.id}
                        sx={{ mb: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          User #{msg.user_id}
                        </Typography>
                        <Typography variant="body1">{msg.message}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(msg.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Box>
                <Input
                  name="chatMessage"
                  placeholder="Type a message"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                />
                <Button onClick={submitChatMessage}>Send Message</Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Logout Button */}
          <Grid
            item
            xs={12}
            sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}
          >
            <Button onClick={logout} style={{ backgroundColor: '#f44336' }}>
              Logout
            </Button>
          </Grid>
        </Grid>
      </Container>
    </Base>
  )
}

export default Dashboard
