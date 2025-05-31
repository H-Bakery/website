import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Snackbar,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { TemplateType } from '../../types/socialMedia'
import { socialMediaTemplates } from '../../data/socialMediaTemplates'
import { createBasicImage } from './core/fallbacks'
import TemplateSelector from './core/TemplateSelector'
import SimpleContentForm from './core/SimpleContentForm'
import ContentPreview from './core/ContentPreview'
import DownloadButton from './core/DownloadButton'

const SocialMediaContentCreator: React.FC = () => {
  const [templateType, setTemplateType] = useState<TemplateType>('daily-special')
  const [content, setContent] = useState({
    title: '',
    description: '',
    price: '',
    additionalInfo: '',
  })
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  
  const previewRef = useRef<HTMLDivElement>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [textOnly, setTextOnly] = useState(true) // Default to text-only for simplicity
  
  // Keep track of whether the component is mounted
  const isMountedRef = useRef(true)
  
  // Handle component unmounting
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleTemplateTypeChange = (type: TemplateType) => {
    setTemplateType(type)
    // Reset some fields when changing template type
    setContent(prev => ({
      ...prev,
      title: '',
      price: (type === 'bakery-news' || type === 'message') ? '' : prev.price,
      // Clear description for message type since it's not used
      description: type === 'message' ? '' : prev.description,
    }))
    setIsComplete(false)
  }
  
  const handleContentChange = (field: string, value: string) => {
    setContent(prev => ({
      ...prev,
      [field]: value
    }))
    if (isComplete) setIsComplete(false)
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  const handleDownload = useCallback(async () => {
    setLoading(true)
    try {
      // Find the matching template
      const template = socialMediaTemplates.find(t => t.type === templateType) || socialMediaTemplates[0]
      
      // Map our content fields to social media content format
      const mappedContent = {
        textElements: {
          title: content.title,
          description: content.description,
          price: content.price ? `${content.price} €` : '',
          callToAction: content.additionalInfo || '',
          // For bread of day template
          breadName: content.title,
          breadDescription: content.description,
          ingredients: content.additionalInfo || '',
          // For news template
          newsTitle: content.title,
          newsContent: content.description,
          date: content.additionalInfo || '',
          // Add special label for bread template
          specialLabel: templateType === 'bread-of-day' ? 'HANDGEMACHT' : '',
          // For seasonal offers
          season: templateType === 'offer' ? 'SONDERANGEBOT' : '',
          subtitle: templateType === 'offer' ? content.additionalInfo || 'Für kurze Zeit' : '',
          // News category
          category: templateType === 'bakery-news' ? 'INFORMATION' : '',
        }
      }
      
      // Create basic image using our fallback method
      const dataUrl = createBasicImage(mappedContent, template)
      
      // Create download link
      const title = content.title.replace(/\s+/g, '-').toLowerCase() || 'bakery-content'
      const date = new Date().toISOString().split('T')[0]
      const filename = `baeckerei-heusser-${title}-${date}.png`
      
      // Force image download using a direct link
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setSnackbar({
        open: true,
        message: 'Bild erfolgreich heruntergeladen!',
        severity: 'success'
      })
      setIsComplete(true)
    } catch (error) {
      console.error('Error generating image:', error)
      setSnackbar({
        open: true,
        message: 'Fehler beim Erstellen des Bildes. Alternative Download-Optionen sind verfügbar.',
        severity: 'error'
      })
      // Don't set isComplete if there was an error
    } finally {
      setLoading(false)
    }
  }, [content, templateType])

  // Check if any required fields are missing
  const isDownloadDisabled = !content.title.trim() || 
    (templateType !== 'message' && !content.description.trim()) || 
    (templateType !== 'bakery-news' && templateType !== 'message' && !content.price.trim())

  // Provide helpful error message
  const errorMessage = isDownloadDisabled ? 
    'Bitte füllen Sie die Pflichtfelder aus (' + 
    'Titel' + 
    (templateType !== 'message' ? ', Beschreibung' : '') + 
    (templateType !== 'bakery-news' && templateType !== 'message' ? ' und Preis' : '') + 
    ')' : ''

  return (
    <Container maxWidth="xl" sx={{ py: 4, position: 'relative' }}>
      {/* Template Type Selector */}
      <Box sx={{ mb: 4 }}>
        <TemplateSelector 
          value={templateType} 
          onChange={handleTemplateTypeChange} 
        />
      </Box>

      {/* Main Content Area */}
      <Grid container spacing={4}>
        {/* Left Column - Input Form */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 2,
              bgcolor: 'background.paper',
              height: '100%',
            }}
          >
            <Box sx={{ 
              mb: 3, 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center' 
            }}>
              <Typography variant="h5" color="primary.main" fontWeight={500}>
                {templateType === 'daily-special' && 'Tagesangebot erstellen'}
                {templateType === 'bread-of-day' && 'Brot des Tages erstellen'}
                {templateType === 'offer' && 'Angebot erstellen'}
                {templateType === 'bakery-news' && 'Bäckerei-News erstellen'}
                {templateType === 'message' && 'Einfache Nachricht erstellen'}
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={textOnly}
                    onChange={(e) => setTextOnly(e.target.checked)}
                    color="primary"
                  />
                }
                label="Text-optimiert"
                sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
              />
            </Box>
            
            <Divider sx={{ mb: 3 }} />

            {/* Simple Content Form */}
            <SimpleContentForm
              templateType={templateType}
              values={content}
              onChange={handleContentChange}
            />

            {/* Download Button */}
            <DownloadButton
              onClick={handleDownload}
              loading={loading}
              disabled={isDownloadDisabled}
              errorMessage={errorMessage}
              previewId="social-media-content-preview"
            />

            {isComplete && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="success.main" fontWeight={500}>
                  Bild erfolgreich erstellt!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Sie können jetzt ein weiteres Bild erstellen oder das aktuelle bearbeiten.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Preview */}
        <Grid item xs={12} md={6}>
          <ContentPreview 
            templateType={templateType}
            content={content}
            loading={loading}
            previewRef={previewRef}
          />
        </Grid>
      </Grid>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default SocialMediaContentCreator