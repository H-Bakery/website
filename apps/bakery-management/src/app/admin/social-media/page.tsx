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
  Breadcrumbs,
  Link,
} from '@mui/material'
import {
  PhotoCamera as PhotoCameraIcon,
  TextSnippet as TextSnippetIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Smartphone as SmartphoneIcon,
} from '@mui/icons-material'
import { HeusserLogo } from '@bakery/shared/ui'

// Template types
type TemplateType =
  | 'daily-special'
  | 'announcement'
  | 'opening-hours'
  | 'seasonal'
  | 'promotion'

// Social media platform types
type SocialPlatform =
  | 'instagram-square'
  | 'instagram-portrait'
  | 'instagram-story'
  | 'facebook-feed'

// Platform dimensions configuration
const SOCIAL_DIMENSIONS: Record<
  SocialPlatform,
  { width: number; height: number; label: string }
> = {
  'instagram-square': {
    width: 1080,
    height: 1080,
    label: 'Instagram Quadrat (1:1)',
  },
  'instagram-portrait': {
    width: 1080,
    height: 1350,
    label: 'Instagram Portrait (4:5)',
  },
  'instagram-story': {
    width: 1080,
    height: 1920,
    label: 'Instagram Story (9:16)',
  },
  'facebook-feed': {
    width: 1200,
    height: 630,
    label: 'Facebook Feed (1.91:1)',
  },
}

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

// Official Bakery brand colors from brand-identity.md
const BRAND_COLORS = {
  primary: '#D038BA', // Brand Magenta
  primaryDark: '#A02E94', // Dark variant for enhanced contrast
  primaryLight: '#E666D3', // Light variant for backgrounds
  success: '#1ADA67', // Success Green - freshness
  textDark: '#131F37', // Primary text
  textMedium: '#485776', // Secondary text
  textLight: '#909FBE', // Disabled/placeholder
  bgLight: '#F6F8FC', // Page backgrounds
  bgPaper: '#FFFFFF', // Content areas
  border: '#E8EEFB', // Borders and dividers
  // Legacy warm colors for accents
  warmBrown: '#7B341E',
  cream: '#F5DEB3',
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

  // Draw background gradient with brand colors
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
  bgGradient.addColorStop(0, BRAND_COLORS.bgPaper)
  bgGradient.addColorStop(1, BRAND_COLORS.bgLight)
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)

  // Draw decorative pattern in background using brand primary color
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.fillStyle = BRAND_COLORS.primary
  // Draw circular patterns instead of wheat
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(width * 0.1, height * (0.2 + i * 0.3), 100, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(width * 0.9, height * (0.3 + i * 0.3), 80, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Calculate responsive sizes based on canvas dimensions
  const scale = Math.min(width, height) / 1080 // Base scale on 1080px reference
  const aspectRatio = width / height

  // Adjust panel dimensions based on aspect ratio
  const panelMargin = 60 * scale
  const panelY = height * (aspectRatio > 1 ? 0.15 : 0.2) // Higher for landscape
  const panelHeight = height * (aspectRatio > 1 ? 0.7 : 0.6) // Taller for landscape

  // Panel background with shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)'
  ctx.shadowBlur = 25
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 10
  ctx.fillStyle = BRAND_COLORS.bgPaper
  ctx.fillRect(panelMargin, panelY, width - 2 * panelMargin, panelHeight)
  ctx.restore()

  // Draw header section with primary brand color
  const headerHeight = 120 * scale
  ctx.fillStyle = BRAND_COLORS.primary
  ctx.fillRect(panelMargin, panelY, width - 2 * panelMargin, headerHeight)

  // Bakery name in header
  ctx.save()
  ctx.fillStyle = BRAND_COLORS.bgPaper
  ctx.font = `bold ${48 * scale}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.fillText('Bäckerei Heusser', width / 2, panelY + 75 * scale)
  ctx.restore()

  // Template heading
  ctx.fillStyle = BRAND_COLORS.primaryDark
  ctx.font = `bold ${36 * scale}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(templateContent.heading, width / 2, panelY + 180 * scale)

  // Main content
  ctx.fillStyle = BRAND_COLORS.textDark
  ctx.textAlign = 'center'

  // Title
  if (content.title) {
    ctx.font = `bold ${64 * scale}px Georgia, serif`
    wrapText(
      ctx,
      content.title,
      width / 2,
      panelY + 280 * scale,
      width - 160 * scale,
      70 * scale
    )
  }

  // Description
  if (content.description) {
    ctx.font = `${32 * scale}px Arial, sans-serif`
    ctx.fillStyle = BRAND_COLORS.textMedium
    wrapText(
      ctx,
      content.description,
      width / 2,
      panelY + 380 * scale,
      width - 160 * scale,
      40 * scale
    )
  }

  // Price (if applicable)
  if (templateContent.showPrice && content.price) {
    ctx.save()
    // Price background with success green for freshness
    ctx.fillStyle = BRAND_COLORS.success
    const priceY = panelY + 480 * scale
    ctx.fillRect(
      width / 2 - 100 * scale,
      priceY - 40 * scale,
      200 * scale,
      80 * scale
    )

    // Price text
    ctx.fillStyle = BRAND_COLORS.bgPaper
    ctx.font = `bold ${56 * scale}px Arial, sans-serif`
    ctx.fillText(content.price + '€', width / 2, priceY + 15 * scale)
    ctx.restore()
  }

  // Additional info
  if (content.additionalInfo) {
    ctx.font = `italic ${28 * scale}px Georgia, serif`
    ctx.fillStyle = BRAND_COLORS.primary
    ctx.fillText(
      content.additionalInfo,
      width / 2,
      panelY + panelHeight - 40 * scale
    )
  }

  // Footer with decorative elements
  const footerHeight = 100 * scale
  ctx.fillStyle = BRAND_COLORS.primary
  ctx.fillRect(0, height - footerHeight, width, footerHeight)

  // Footer text
  ctx.fillStyle = BRAND_COLORS.bgPaper
  ctx.font = `${24 * scale}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(
    'Traditionelle Handwerkskunst seit 1952',
    width / 2,
    height - 40 * scale
  )

  // Add stylized H logo instead of bread emoji
  ctx.save()
  ctx.fillStyle = BRAND_COLORS.bgPaper
  ctx.font = `bold ${72 * scale}px Georgia, serif`
  ctx.textAlign = 'center'
  // Draw a circle background for the logo
  ctx.beginPath()
  ctx.arc(width - 80 * scale, height - 150 * scale, 45 * scale, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fill()
  // Draw the H
  ctx.fillStyle = BRAND_COLORS.bgPaper
  ctx.fillText('H', width - 80 * scale, height - 130 * scale)
  ctx.restore()

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
  const [socialPlatform, setSocialPlatform] =
    useState<SocialPlatform>('instagram-square')
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

  const handleSocialMediaDownload = async () => {
    setLoading(true)
    try {
      // Get platform dimensions
      const dimensions = SOCIAL_DIMENSIONS[socialPlatform]

      // Generate the image with platform-specific dimensions
      const dataUrl = createBakeryImage(
        content,
        templateType,
        templateContent,
        dimensions.width,
        dimensions.height
      )

      // Create download link
      const link = document.createElement('a')
      const filename = `baeckerei-heusser-${socialPlatform}-${templateType}-${
        new Date().toISOString().split('T')[0]
      }.png`
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSnackbar({
        open: true,
        message: `Bild für ${dimensions.label} erfolgreich heruntergeladen!`,
        severity: 'success',
      })
    } catch (error) {
      console.error('Social media download error:', error)
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
    <>
      {/* Page Header with Brand Style */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          mb: 4,
          py: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '4px',
            bgcolor: BRAND_COLORS.primary,
          },
        }}
      >
        <Container>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link
              href="/admin"
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
                textDecoration: 'none',
                '&:hover': { color: BRAND_COLORS.primary },
              }}
            >
              <HomeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Admin
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              <PhotoCameraIcon
                fontSize="small"
                sx={{ mr: 0.5, color: BRAND_COLORS.primary }}
              />
              Social Media
            </Typography>
          </Breadcrumbs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <HeusserLogo width={100} height={32} color={BRAND_COLORS.primary} />
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 600,
                  fontFamily: "'Playfair Display', serif",
                  color: BRAND_COLORS.textDark,
                }}
              >
                Social Media Content Creator
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ color: BRAND_COLORS.textMedium }}
              >
                Erstellen Sie professionelle Inhalte mit authentischem
                Bäckerei-Branding
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <Chip
              icon={<TextSnippetIcon />}
              label="Text-fokussierte Designs"
              size="small"
              sx={{
                borderColor: BRAND_COLORS.primary,
                color: BRAND_COLORS.primary,
                '& .MuiChip-icon': { color: BRAND_COLORS.primary },
              }}
              variant="outlined"
            />
            <Chip
              icon={<PhotoCameraIcon />}
              label="Mit Firmen-Logo"
              size="small"
              sx={{
                borderColor: BRAND_COLORS.success,
                color: BRAND_COLORS.success,
                '& .MuiChip-icon': { color: BRAND_COLORS.success },
              }}
              variant="outlined"
            />
          </Box>
        </Container>
      </Box>

      <Container>
        <Grid container spacing={3}>
          {/* Form Section */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: BRAND_COLORS.border,
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: BRAND_COLORS.textDark,
                  fontWeight: 500,
                  fontFamily: "'Lora', serif",
                }}
              >
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

              {/* Social Media Platform Selector */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Social Media Format</InputLabel>
                <Select
                  value={socialPlatform}
                  onChange={(e) =>
                    setSocialPlatform(e.target.value as SocialPlatform)
                  }
                  label="Social Media Format"
                >
                  {Object.entries(SOCIAL_DIMENSIONS).map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      <Box>
                        <Typography variant="body1">{value.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {value.width} x {value.height} Pixel
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                {/* Primary download buttons row */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    disabled={loading || !content.title}
                    fullWidth
                    sx={{
                      backgroundColor: BRAND_COLORS.primary,
                      color: BRAND_COLORS.bgPaper,
                      '&:hover': {
                        backgroundColor: BRAND_COLORS.primaryDark,
                      },
                      '&:disabled': {
                        backgroundColor: BRAND_COLORS.textLight,
                      },
                    }}
                  >
                    {loading ? 'Wird erstellt...' : 'Standard (1080x1080)'}
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
                      borderColor: BRAND_COLORS.primary,
                      color: BRAND_COLORS.primary,
                      '&:hover': {
                        borderColor: BRAND_COLORS.primaryDark,
                        backgroundColor: BRAND_COLORS.primaryLight + '20',
                      },
                    }}
                  >
                    Zurücksetzen
                  </Button>
                </Box>

                {/* Social media optimized download button */}
                <Button
                  variant="contained"
                  startIcon={<SmartphoneIcon />}
                  onClick={handleSocialMediaDownload}
                  disabled={loading || !content.title}
                  fullWidth
                  sx={{
                    backgroundColor: BRAND_COLORS.success,
                    color: BRAND_COLORS.bgPaper,
                    '&:hover': {
                      backgroundColor: '#15C55C', // Darker green on hover
                    },
                    '&:disabled': {
                      backgroundColor: BRAND_COLORS.textLight,
                    },
                  }}
                >
                  {loading
                    ? 'Wird erstellt...'
                    : `Für ${SOCIAL_DIMENSIONS[socialPlatform].label} optimiert`}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Preview Section */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: BRAND_COLORS.border,
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: BRAND_COLORS.textDark,
                  fontWeight: 500,
                  fontFamily: "'Lora', serif",
                }}
              >
                Vorschau
              </Typography>

              <Box
                ref={previewRef}
                sx={{
                  width: '100%',
                  aspectRatio: '1',
                  background: `linear-gradient(180deg, ${BRAND_COLORS.bgPaper} 0%, ${BRAND_COLORS.bgLight} 100%)`,
                  border: '2px solid',
                  borderColor: BRAND_COLORS.border,
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }}
              >
                {/* Decorative pattern elements */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: BRAND_COLORS.primary,
                    opacity: 0.05,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 40,
                    right: 40,
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: BRAND_COLORS.primary,
                    opacity: 0.05,
                  }}
                />

                {/* Main content panel */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '20%',
                    left: '5.5%',
                    right: '5.5%',
                    height: '60%',
                    bgcolor: BRAND_COLORS.bgPaper,
                    boxShadow: '0 10px 25px rgba(208, 56, 186, 0.15)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <Box
                    sx={{
                      bgcolor: BRAND_COLORS.primary,
                      p: 2,
                      textAlign: 'center',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <HeusserLogo
                      width={120}
                      height={30}
                      color={BRAND_COLORS.bgPaper}
                    />
                  </Box>

                  {/* Template heading */}
                  <Typography
                    variant="h6"
                    sx={{
                      textAlign: 'center',
                      color: BRAND_COLORS.primaryDark,
                      fontWeight: 'bold',
                      fontFamily: "'Playfair Display', serif",
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
                          color: BRAND_COLORS.textDark,
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {content.title}
                      </Typography>
                    )}

                    {content.description && (
                      <Typography
                        variant="body1"
                        sx={{
                          mb: 2,
                          color: BRAND_COLORS.textMedium,
                          fontFamily: "'Lora', serif",
                        }}
                      >
                        {content.description}
                      </Typography>
                    )}

                    {templateContent.showPrice && content.price && (
                      <Box
                        sx={{
                          display: 'inline-block',
                          bgcolor: BRAND_COLORS.success,
                          color: BRAND_COLORS.bgPaper,
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                          mb: 2,
                          boxShadow: '0 2px 8px rgba(26, 218, 103, 0.3)',
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
                        sx={{
                          fontStyle: 'italic',
                          color: BRAND_COLORS.primary,
                          fontFamily: "'Lora', serif",
                        }}
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
                    sx={{
                      color: BRAND_COLORS.bgPaper,
                      textAlign: 'center',
                      fontFamily: "'Lora', serif",
                    }}
                  >
                    Traditionelle Handwerkskunst seit 1952
                  </Typography>
                </Box>

                {/* Logo mark in corner */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 110,
                    right: 30,
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '36px',
                      fontWeight: 'bold',
                      color: BRAND_COLORS.bgPaper,
                    }}
                  >
                    H
                  </Typography>
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

              <Alert
                severity="info"
                sx={{
                  mt: 2,
                  bgcolor: BRAND_COLORS.primaryLight + '10',
                  color: BRAND_COLORS.textDark,
                  '& .MuiAlert-icon': {
                    color: BRAND_COLORS.primary,
                  },
                }}
              >
                Die Vorschau zeigt, wie Ihr Social Media Post aussehen wird. Das
                fertige Bild kann heruntergeladen und auf allen Plattformen
                geteilt werden.
              </Alert>
            </Paper>
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
    </>
  )
}
