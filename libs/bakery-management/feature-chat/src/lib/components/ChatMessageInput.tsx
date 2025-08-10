'use client'
import React, { useState, KeyboardEvent } from 'react'
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  InputAdornment,
  CircularProgress,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'

interface ChatMessageInputProps {
  onSendMessage: (message: string) => void
  sending?: boolean
  disabled?: boolean
}

const ChatMessageInput: React.FC<ChatMessageInputProps> = ({
  onSendMessage,
  sending = false,
  disabled = false,
}) => {
  const [message, setMessage] = useState<string>('')

  const handleSend = () => {
    const trimmedMessage = message.trim()
    if (trimmedMessage && !sending) {
      onSendMessage(trimmedMessage)
      setMessage('')
    }
  }

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const canSend = message.trim().length > 0 && !sending && !disabled

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Nachricht eingeben... (Enter zum Senden, Shift+Enter für neue Zeile)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        variant="outlined"
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Tooltip title="Emojis (coming soon)">
                <span>
                  <IconButton 
                    size="small" 
                    disabled={true} // TODO: Implement emoji picker
                    sx={{ ml: -0.5 }}
                  >
                    <EmojiEmotionsIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
          },
        }}
      />
      
      <Tooltip title="Nachricht senden">
        <span>
          <IconButton
            onClick={handleSend}
            disabled={!canSend}
            color="primary"
            size="large"
            sx={{
              bgcolor: canSend ? 'primary.main' : 'action.disabled',
              color: canSend ? 'primary.contrastText' : 'action.disabled',
              '&:hover': {
                bgcolor: canSend ? 'primary.dark' : 'action.disabled',
              },
              '&:disabled': {
                bgcolor: 'action.disabled',
                color: 'action.disabled',
              },
              mb: 0.5,
            }}
          >
            {sending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SendIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  )
}

export default ChatMessageInput