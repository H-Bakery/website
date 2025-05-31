import React, { useState } from 'react'
import {
  Button,
  Box,
  CircularProgress,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Stack,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close'

interface DownloadButtonProps {
  onClick: () => Promise<void>
  loading: boolean
  disabled?: boolean
  errorMessage?: string
  previewId?: string
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  onClick,
  loading,
  disabled = false,
  errorMessage,
  previewId = 'social-media-content-preview'
}) => {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  // Handle safe download with error catching
  const handleSafeDownload = async () => {
    try {
      setErrorDetails(null)
      await onClick()
    } catch (error) {
      console.error('Download error:', error)
      setErrorDetails(error instanceof Error ? error.message : 'Unbekannter Fehler')
      setErrorDialogOpen(true)
    }
  }

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Button
        variant="contained"
        color="primary"
        size="large"
        endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
        onClick={handleSafeDownload}
        fullWidth
        disabled={loading || disabled}
        sx={{ 
          py: 2,
          borderRadius: 2,
          boxShadow: 2,
          fontSize: '1.1rem',
          fontFamily: "'Averia Serif Libre', serif"
        }}
      >
        {loading ? 'Bild wird erstellt...' : 'Bild herunterladen & speichern'}
      </Button>
      
      {errorMessage && (
        <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>
          {errorMessage}
        </FormHelperText>
      )}
      
      {/* Help text with link to manual screenshot */}
      <FormHelperText sx={{ textAlign: 'center', mt: 2, cursor: 'pointer' }} onClick={() => setHelpDialogOpen(true)}>
        Sehen Sie ein leeres Bild? <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>Klicken Sie hier für Hilfe</span>
      </FormHelperText>
      
      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Bild speichern - Hilfe</Typography>
            <IconButton onClick={() => setHelpDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Wir verwenden einen neuen, zuverlässigeren Weg, um Ihr Social Media Bild zu erstellen. Sollte das Bild leer erscheinen:
          </Typography>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Der Download sollte jetzt zuverlässig funktionieren. Wenn Sie dennoch ein leeres Bild sehen:
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              1. Aktualisieren Sie die Seite und versuchen Sie es erneut
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              2. Verwenden Sie Google Chrome statt Safari oder Firefox
            </Typography>
            <Typography variant="body2">
              3. Als letzte Option: Erstellen Sie einen Screenshot der Vorschau (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>
      
      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" color="error">Fehler beim Erstellen</Typography>
            <IconButton onClick={() => setErrorDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Es ist ein Fehler beim Erstellen des Bildes aufgetreten. Keine Sorge, Ihr Bild wurde trotzdem generiert:
          </Typography>
          <Typography variant="body2" paragraph>
            • Verwenden Sie die alternativen Download-Optionen
          </Typography>
          <Typography variant="body2" paragraph>
            • Verwenden Sie einen anderen Browser (Chrome empfohlen)
          </Typography>
          <Typography variant="body2">
            Technische Details (für Support):
          </Typography>
          <Box 
            sx={{ 
              bgcolor: 'grey.100', 
              p: 1, 
              borderRadius: 1, 
              fontSize: '0.8rem',
              overflow: 'auto',
              maxHeight: '100px'
            }}
          >
            {errorDetails || 'Keine Details verfügbar'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(true)}>Alternativen zeigen</Button>
          <Button onClick={() => setErrorDialogOpen(false)} color="primary">Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DownloadButton