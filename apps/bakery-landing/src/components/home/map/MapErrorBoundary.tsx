'use client'
import React from 'react'
import { Box, Typography, Button, Alert } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import MapIcon from '@mui/icons-material/Map'
import { mapManager } from './MapManager'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  retryCount: number
}

export class MapErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): State {
    // Log to MapManager for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('MapErrorBoundary caught error:', error.message)
      console.log('MapManager status:', mapManager.getStatus())
    }

    return { hasError: true, error, retryCount: 0 }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Map Error Boundary caught an error:', error, errorInfo)

    // Clean up any stuck map instances
    try {
      mapManager.cleanupAll()
    } catch (cleanupError) {
      console.debug('Cleanup error during error boundary:', cleanupError)
    }
  }

  handleRetry = () => {
    // Clean up before retry
    mapManager.cleanupAll()

    this.setState((prevState) => ({
      hasError: false,
      error: undefined,
      retryCount: prevState.retryCount + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      const isInitError =
        this.state.error?.message?.includes('initialized') ||
        this.state.error?.message?.includes('container')
      const isNetworkError =
        this.state.error?.message?.includes('network') ||
        this.state.error?.message?.includes('fetch')

      return (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            backgroundColor: 'grey.50',
            border: '1px dashed',
            borderColor: 'grey.300',
            borderRadius: 1,
          }}
        >
          <Alert
            severity={isInitError ? 'info' : 'warning'}
            sx={{ maxWidth: 400 }}
            icon={<MapIcon />}
          >
            <Typography variant="h6" gutterBottom>
              {isInitError
                ? 'Karte wird vorbereitet'
                : 'Karte konnte nicht geladen werden'}
            </Typography>

            <Typography variant="body2" sx={{ mb: 2 }}>
              {isInitError
                ? 'Die Karte wird initialisiert. Dies sollte sich automatisch lösen.'
                : isNetworkError
                ? 'Kartendaten konnten nicht geladen werden. Prüfen Sie Ihre Internetverbindung.'
                : 'Bitte laden Sie die Seite neu oder nutzen Sie die Adresse unten.'}
            </Typography>

            {!isInitError && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= 3}
              >
                {this.state.retryCount >= 3
                  ? 'Maximale Versuche erreicht'
                  : 'Erneut versuchen'}
              </Button>
            )}

            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  Error: {this.state.error?.message}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}
                >
                  Retry count: {this.state.retryCount}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}
                >
                  Maps: {JSON.stringify(mapManager.getStatus())}
                </Typography>
              </Box>
            )}
          </Alert>
        </Box>
      )
    }

    return this.props.children
  }
}
