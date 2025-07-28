'use client'
import React from 'react'
import {
  Box,
  Typography,
  Avatar,
  Paper,
  Stack,
} from '@mui/material'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

interface ChatMessage {
  id: number
  message: string
  timestamp: string
  User: {
    username: string
  }
}

interface User {
  id: string
  username: string
}

interface ChatMessageListProps {
  messages: ChatMessage[]
  currentUser: User | null
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, currentUser }) => {
  // Format timestamp for display
  const formatMessageTime = (timestamp: string) => {
    const date = parseISO(timestamp)
    
    if (isToday(date)) {
      return `Heute, ${format(date, 'HH:mm', { locale: de })}`
    } else if (isYesterday(date)) {
      return `Gestern, ${format(date, 'HH:mm', { locale: de })}`
    } else {
      return format(date, 'dd.MM.yyyy, HH:mm', { locale: de })
    }
  }

  // Check if message is from current user
  const isOwnMessage = (message: ChatMessage) => {
    return currentUser?.username === message.User.username
  }

  // Get user initials for avatar
  const getUserInitials = (username: string) => {
    return username
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: ChatMessage[] }, message) => {
    const date = format(parseISO(message.timestamp), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  return (
    <Stack spacing={2}>
      {Object.entries(groupedMessages).map(([date, dayMessages]) => (
        <Box key={date}>
          {/* Date Separator */}
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mb: 2, 
              mt: 2 
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                bgcolor: 'divider', 
                px: 2, 
                py: 0.5, 
                borderRadius: 1,
                color: 'text.secondary'
              }}
            >
              {format(parseISO(date), 'EEEE, dd. MMMM yyyy', { locale: de })}
            </Typography>
          </Box>

          {/* Messages for this date */}
          <Stack spacing={1}>
            {dayMessages.map((message) => {
              const isOwn = isOwnMessage(message)
              
              return (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  {!isOwn && (
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.75rem',
                        bgcolor: 'primary.main',
                      }}
                    >
                      {getUserInitials(message.User.username)}
                    </Avatar>
                  )}

                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      maxWidth: '70%',
                      bgcolor: isOwn ? 'primary.main' : 'background.paper',
                      color: isOwn ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 2,
                      ...(isOwn && {
                        borderBottomRightRadius: 4,
                      }),
                      ...(!isOwn && {
                        borderBottomLeftRadius: 4,
                      }),
                    }}
                  >
                    {!isOwn && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontWeight: 600,
                          display: 'block',
                          mb: 0.5,
                          color: 'primary.main'
                        }}
                      >
                        {message.User.username}
                      </Typography>
                    )}
                    
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        mb: 0.5
                      }}
                    >
                      {message.message}
                    </Typography>
                    
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        opacity: 0.7,
                        fontSize: '0.65rem',
                        display: 'block',
                        textAlign: isOwn ? 'right' : 'left'
                      }}
                    >
                      {formatMessageTime(message.timestamp)}
                    </Typography>
                  </Paper>

                  {isOwn && (
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.75rem',
                        bgcolor: 'secondary.main',
                      }}
                    >
                      {getUserInitials(message.User.username)}
                    </Avatar>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}

export default ChatMessageList