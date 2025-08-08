'use client'
import React, { useState, useRef } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Switch,
  Snackbar,
} from '@mui/material'
import {
  PhotoCamera as PhotoCameraIcon,
  TextSnippet as TextSnippetIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  BakeryDining as BakeryIcon,
} from '@mui/icons-material'

// Template types
type TemplateType =
  | 'daily-special'
  | 'announcement'
  | 'opening-hours'
  | 'seasonal'
  | 'promotion'

const templates = [
  {
    id: 'daily-special',
    name: 'Tagesangebot',
    description: 'Für tägliche Spezialitäten',
  },
  {
    id: 'announcement',
    name: 'Ankündigung',
    description: 'Wichtige Mitteilungen',
  },
  {
    id: 'opening-hours',
    name: 'Öffnungszeiten',
    description: 'Geänderte Öffnungszeiten',
  },
  { id: 'seasonal', name: 'Saisonal', description: 'Saisonale Angebote' },
  { id: 'promotion', name: 'Aktion', description: 'Spezielle Aktionen' },
]

// Bakery brand colors
const BRAND_COLORS = {
  primary: '#7B341E', // Warm brown from logo
  secondary: '#8B4513', // Saddle brown
  accent: '#D2691E', // Chocolate
  light: '#DEB887', // Burlywood
  cream: '#F5DEB3', // Wheat
  white: '#FFFFFF',
  dark: '#3E1F0F',
}

// Get template content based on template type
const getTemplateContentByType = (templateType: TemplateType) => {
  switch (templateType) {
    case 'daily-special':
      return {
        heading: 'TAGESANGEBOT',
        showPrice: true,
        placeholder: {
          title: 'z.B. Vollkornbrot',
          description: 'z.B. Frisch gebacken mit Sauerteig',
          price: '3,50',
          additionalInfo: 'z.B. Nur heute!',
        },
      }
    case 'announcement':
      return {
        heading: 'WICHTIGE MITTEILUNG',
        showPrice: false,
        placeholder: {
          title: 'z.B. Urlaubsschließung',
          description: 'z.B. Vom 1.-15. August sind wir im Urlaub',
          price: '',
          additionalInfo: 'z.B. Ab 16. August wieder für Sie da!',
        },
      }
    case 'opening-hours':
      return {
        heading: 'ÖFFNUNGSZEITEN',
        showPrice: false,
        placeholder: {
          title: 'z.B. Neue Öffnungszeiten',
          description: 'z.B. Mo-Fr: 6:00-18:00, Sa: 6:00-14:00',
          price: '',
          additionalInfo: 'z.B. Ab sofort!',
        },
      }
    case 'seasonal':
      return {
        heading: 'SAISONALES ANGEBOT',
        showPrice: true,
        placeholder: {
          title: 'z.B. Weihnachtsstollen',
          description: 'z.B. Mit Marzipan und Rosinen',
          price: '12,90',
          additionalInfo: 'z.B. Nur im Dezember!',
        },
      }
    default:
      return {
        heading: 'AKTION',
        showPrice: true,
        placeholder: {
          title: 'z.B. 3 für 2',
          description: 'z.B. Alle Brötchen im Angebot',
          price: 'Sparen Sie 30%',
          additionalInfo: 'z.B. Diese Woche!',
        },
      }
  }
}

// Image generation function
const createBakeryImage = (
  content: any,
  templateType: TemplateType,
  templateContent: ReturnType<typeof getTemplateContentByType>,
  width: number = 1080,
  height: number = 1080
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Draw background gradient with bakery colors
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, BRAND_COLORS.cream)
  bgGradient.addColorStop(1, BRAND_COLORS.light)
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Draw decorative wheat pattern in background
  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.fillStyle = BRAND_COLORS.accent
  ctx.font = '200px serif'
  ctx.fillText('🌾', -50, 200)
  ctx.fillText('🌾', width - 150, height - 100)
  ctx.restore()

  // Draw main content panel
  const panelMargin = 60
  const panelY = height * 0.2
  const panelHeight = height * 0.6

  // Panel background with shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 10
  ctx.fillStyle = BRAND_COLORS.white
  ctx.fillRect(panelMargin, panelY, width - 2 * panelMargin, panelHeight)
  ctx.restore()

  // Draw header section
  ctx.fillStyle = BRAND_COLORS.primary
  ctx.fillRect(panelMargin, panelY, width - 2 * panelMargin, 120)

  // Bakery name in header
  ctx.save()
  ctx.fillStyle = BRAND_COLORS.white
  ctx.font = 'bold 48px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('Bäckerei Heusser', width / 2, panelY + 75)
  ctx.restore()

  // Template heading
  ctx.fillStyle = BRAND_COLORS.secondary
  ctx.font = 'bold 36px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(templateContent.heading, width / 2, panelY + 180)

  // Main content
  ctx.fillStyle = BRAND_COLORS.dark
  ctx.textAlign = 'center'

  // Title
  if (content.title) {
    ctx.font = 'bold 64px Georgia, serif'
    wrapText(ctx, content.title, width / 2, panelY + 280, width - 160, 70)
  }

  // Description
  if (content.description) {
    ctx.font = '32px Arial, sans-serif'
    ctx.fillStyle = BRAND_COLORS.secondary
    wrapText(ctx, content.description, width / 2, panelY + 380, width - 160, 40)
  }

  // Price (if applicable)
  if (templateContent.showPrice && content.price) {
    ctx.save()
    // Price background
    ctx.fillStyle = BRAND_COLORS.accent
    const priceY = panelY + 480
    ctx.fillRect(width / 2 - 100, priceY - 40, 200, 80)

    // Price text
    ctx.fillStyle = BRAND_COLORS.white
    ctx.font = 'bold 56px Arial, sans-serif'
    ctx.fillText(content.price + '€', width / 2, priceY + 15)
    ctx.restore()
  }

  // Additional info
  if (content.additionalInfo) {
    ctx.font = 'italic 28px Georgia, serif'
    ctx.fillStyle = BRAND_COLORS.primary
    ctx.fillText(content.additionalInfo, width / 2, panelY + panelHeight - 40)
  }

  // Footer with decorative elements
  ctx.fillStyle = BRAND_COLORS.primary
  ctx.fillRect(0, height - 100, width, 100)

  // Footer text
  ctx.fillStyle = BRAND_COLORS.white
  ctx.font = '24px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Traditionelle Handwerkskunst seit 1952', width / 2, height - 40)

  // Add bread icon as logo
  ctx.font = '60px serif'
  ctx.fillText('🥖', width - 100, height - 120)

  return canvas.toDataURL('image/png')
}

// Helper function to wrap text
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY)
      line = words[n] + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, currentY)
}

export default function SocialMediaPage() {
  const [templateType, setTemplateType] =
    useState<TemplateType>('daily-special')
  const [content, setContent] = useState({
    title: '',
    description: '',
    price: '',
    additionalInfo: '',
  })
  const [textOnly, setTextOnly] = useState(true)
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })
  const previewRef = useRef<HTMLDivElement>(null)

  const handleContentChange =
    (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setContent((prev) => ({
        ...prev,
        [field]: event.target.value,
      }))
    }

  const templateContent = getTemplateContentByType(templateType)

  const handleDownload = async () => {
    setLoading(true)
    try {
      // Generate the image
      const dataUrl = createBakeryImage(content, templateType, templateContent)

      // Create download link
      const link = document.createElement('a')
      const filename = `baeckerei-heusser-${templateType}-${
        new Date().toISOString().split('T')[0]
      }.png`
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSnackbar({
        open: true,
        message: 'Bild erfolgreich heruntergeladen!',
        severity: 'success',
      })
    } catch (error) {
      console.error('Download error:', error)
      setSnackbar({
        open: true,
        message: 'Fehler beim Herunterladen. Bitte versuchen Sie es erneut.',
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ color: BRAND_COLORS.primary }}
        >
          <BakeryIcon
            sx={{ mr: 2, verticalAlign: 'middle', color: BRAND_COLORS.accent }}
          />
          Social Media Content Creator
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Erstellen Sie professionelle Inhalte für Ihre Social Media Präsenz mit
          Bäckerei-Branding
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Chip
            icon={<TextSnippetIcon />}
            label="Optimiert für Social Media"
            size="small"
            sx={{
              borderColor: BRAND_COLORS.secondary,
              color: BRAND_COLORS.secondary,
              '& .MuiChip-icon': { color: BRAND_COLORS.secondary },
            }}
            variant="outlined"
          />
          <Chip
            icon={<BakeryIcon />}
            label="Mit Bäckerei-Branding"
            size="small"
            sx={{
              borderColor: BRAND_COLORS.primary,
              color: BRAND_COLORS.primary,
              '& .MuiChip-icon': { color: BRAND_COLORS.primary },
            }}
            variant="outlined"
          />
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Form Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Inhalt erstellen
            </Typography>

            {/* Template Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Template auswählen</InputLabel>
              <Select
                value={templateType}
                onChange={(e) =>
                  setTemplateType(e.target.value as TemplateType)
                }
                label="Template auswählen"
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    <Box>
                      <Typography variant="body1">{template.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {template.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Content Form */}
            <TextField
              fullWidth
              label="Titel"
              value={content.title}
              onChange={handleContentChange('title')}
              placeholder={templateContent.placeholder.title}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Beschreibung"
              value={content.description}
              onChange={handleContentChange('description')}
              placeholder={templateContent.placeholder.description}
              sx={{ mb: 2 }}
            />

            {templateContent.showPrice && (
              <TextField
                fullWidth
                label="Preis"
                value={content.price}
                onChange={handleContentChange('price')}
                placeholder={templateContent.placeholder.price}
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              fullWidth
              label="Zusätzliche Information"
              value={content.additionalInfo}
              onChange={handleContentChange('additionalInfo')}
              placeholder={templateContent.placeholder.additionalInfo}
              sx={{ mb: 3 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={textOnly}
                  onChange={(e) => setTextOnly(e.target.checked)}
                />
              }
              label="Nur Text (ohne Bilder)"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                disabled={loading || !content.title}
                fullWidth
                sx={{
                  backgroundColor: BRAND_COLORS.primary,
                  '&:hover': {
                    backgroundColor: BRAND_COLORS.secondary,
                  },
                }}
              >
                {loading ? 'Wird erstellt...' : 'Als Bild herunterladen'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() =>
                  setContent({
                    title: '',
                    description: '',
                    price: '',
                    additionalInfo: '',
                  })
                }
                sx={{
                  borderColor: BRAND_COLORS.secondary,
                  color: BRAND_COLORS.secondary,
                  '&:hover': {
                    borderColor: BRAND_COLORS.primary,
                    backgroundColor: 'rgba(123, 52, 30, 0.08)',
                  },
                }}
              >
                Zurücksetzen
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Vorschau
            </Typography>

            <Box
              ref={previewRef}
              sx={{
                width: '100%',
                aspectRatio: '1',
                background: `linear-gradient(180deg, ${BRAND_COLORS.cream} 0%, ${BRAND_COLORS.light} 100%)`,
                border: '2px solid',
                borderColor: BRAND_COLORS.light,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative wheat elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  left: -50,
                  fontSize: '200px',
                  opacity: 0.1,
                  color: BRAND_COLORS.accent,
                }}
              >
                🌾
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -50,
                  right: -50,
                  fontSize: '200px',
                  opacity: 0.1,
                  color: BRAND_COLORS.accent,
                }}
              >
                🌾
              </Box>

              {/* Main content panel */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '20%',
                  left: '5.5%',
                  right: '5.5%',
                  height: '60%',
                  bgcolor: BRAND_COLORS.white,
                  boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <Box
                  sx={{
                    bgcolor: BRAND_COLORS.primary,
                    p: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{ color: BRAND_COLORS.white, fontWeight: 'bold' }}
                  >
                    Bäckerei Heusser
                  </Typography>
                </Box>

                {/* Template heading */}
                <Typography
                  variant="h6"
                  sx={{
                    textAlign: 'center',
                    color: BRAND_COLORS.secondary,
                    fontWeight: 'bold',
                    mt: 2,
                    mb: 1,
                  }}
                >
                  {templateContent.heading}
                </Typography>

                {/* Content */}
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  {content.title && (
                    <Typography
                      variant="h4"
                      sx={{
                        mb: 2,
                        fontWeight: 'bold',
                        color: BRAND_COLORS.dark,
                      }}
                    >
                      {content.title}
                    </Typography>
                  )}

                  {content.description && (
                    <Typography
                      variant="body1"
                      sx={{ mb: 2, color: BRAND_COLORS.secondary }}
                    >
                      {content.description}
                    </Typography>
                  )}

                  {templateContent.showPrice && content.price && (
                    <Box
                      sx={{
                        display: 'inline-block',
                        bgcolor: BRAND_COLORS.accent,
                        color: BRAND_COLORS.white,
                        px: 3,
                        py: 1,
                        borderRadius: 1,
                        mb: 2,
                      }}
                    >
                      <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                        {content.price}€
                      </Typography>
                    </Box>
                  )}

                  {content.additionalInfo && (
                    <Typography
                      variant="body2"
                      sx={{ fontStyle: 'italic', color: BRAND_COLORS.primary }}
                    >
                      {content.additionalInfo}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Footer */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 100,
                  bgcolor: BRAND_COLORS.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: BRAND_COLORS.white, textAlign: 'center' }}
                >
                  Traditionelle Handwerkskunst seit 1952
                </Typography>
              </Box>

              {/* Bread icon */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 120,
                  right: 40,
                  fontSize: '60px',
                }}
              >
                🥖
              </Box>

              {!content.title && !content.description && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    Füllen Sie das Formular aus, um eine Vorschau zu sehen
                  </Typography>
                </Box>
              )}
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Die Vorschau zeigt, wie Ihr Social Media Post aussehen wird. Das
              fertige Bild kann heruntergeladen und auf allen Plattformen
              geteilt werden.
            </Alert>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
