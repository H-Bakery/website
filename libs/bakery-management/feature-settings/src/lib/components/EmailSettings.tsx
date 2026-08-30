import React, { useState, useEffect } from 'react'
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Chip,
} from '@mui/material'
import {
  Send as SendIcon,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
} from '@mui/icons-material'
import { bakeryAPI } from '@bakery/shared/data-access'

interface EmailConfig {
  configured: boolean
  connected: boolean
  provider: string
  from: string
}

interface EmailTestResult {
  success: boolean
  error?: string
  messageId?: string
}

export const EmailSettings: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<EmailTestResult | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Form state for configuration (future enhancement)
  const [provider, setProvider] = useState('smtp')
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: '587',
    secure: false,
    user: '',
    password: '',
    from: '',
    fromName: '',
  })

  useEffect(() => {
    loadEmailConfig()
  }, [])

  const loadEmailConfig = async () => {
    try {
      const response = await bakeryAPI.getEmailConfig()
      setConfig(response)
    } catch (error) {
      console.error('Failed to load email configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail) return

    setSending(true)
    setTestResult(null)

    try {
      const response = await bakeryAPI.sendTestEmail(testEmail)
      setTestResult(response)
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Failed to send test email',
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Email Notification Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure email settings for sending notification emails to users.
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Current Configuration Status */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Current Status
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Chip
            icon={config?.configured ? <CheckCircle /> : <Error />}
            label={config?.configured ? 'Configured' : 'Not Configured'}
            color={config?.configured ? 'success' : 'error'}
            variant="outlined"
          />
          <Chip
            icon={config?.connected ? <CheckCircle /> : <Error />}
            label={config?.connected ? 'Connected' : 'Not Connected'}
            color={config?.connected ? 'success' : 'error'}
            variant="outlined"
          />
          {config?.provider && (
            <Chip
              label={`Provider: ${config.provider.toUpperCase()}`}
              variant="outlined"
            />
          )}
          {config?.from && (
            <Chip label={`From: ${config.from}`} variant="outlined" />
          )}
        </Box>
      </Box>

      {/* Test Email */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          Test Email Configuration
        </Typography>
        <Box display="flex" gap={2} alignItems="flex-start">
          <TextField
            fullWidth
            label="Test Email Address"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            disabled={!config?.configured || sending}
          />
          <Button
            variant="contained"
            startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={sendTestEmail}
            disabled={!config?.configured || !testEmail || sending}
          >
            {sending ? 'Sending...' : 'Send Test'}
          </Button>
        </Box>

        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            sx={{ mt: 2 }}
            onClose={() => setTestResult(null)}
          >
            {testResult.success
              ? `Test email sent successfully! Message ID: ${testResult.messageId}`
              : `Failed to send test email: ${testResult.error}`}
          </Alert>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Configuration Instructions */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Configuration Instructions
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Email configuration is managed through environment variables. To
          enable email notifications:
        </Alert>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          1. Copy the following to your .env file:
        </Typography>
        <Paper
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }}
        >
          # Email Configuration
          <br />
          EMAIL_PROVIDER=gmail
          <br />
          EMAIL_USER=your-email@gmail.com
          <br />
          EMAIL_PASSWORD=your-app-password
          <br />
          EMAIL_FROM=noreply@bakery.com
          <br />
          EMAIL_FROM_NAME=Bakery Notifications
        </Paper>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          2. For Gmail users:
        </Typography>
        <Typography variant="body2" component="ul" sx={{ mt: 1 }}>
          <li>Enable 2-factor authentication on your Google account</li>
          <li>
            Generate an app-specific password at:{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://myaccount.google.com/apppasswords
            </a>
          </li>
          <li>Use the generated password in EMAIL_PASSWORD</li>
        </Typography>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          3. Other providers:
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          For SendGrid, AWS SES, or custom SMTP, see the .env.example file for
          configuration options.
        </Typography>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          4. Restart the backend server after updating environment variables.
        </Typography>
      </Box>
    </Paper>
  )
}

export default EmailSettings
