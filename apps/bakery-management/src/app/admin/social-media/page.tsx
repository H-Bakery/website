'use client'
import React, { useState, useRef } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { HeusserLogo } from '@bakery/shared/ui'
import { PageLayout, PageSection } from '../../../components/layout'
import { formatSocialPrice } from './socialPrice'

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

interface PostContent {
  title: string
  description: string
  price: string
  additionalInfo: string
}

const EMPTY_CONTENT: PostContent = {
  title: '',
  description: '',
  price: '',
  additionalInfo: '',
}

// Image generation function
const createBakeryImage = (
  content: PostContent,
  templateType: TemplateType,
  templateContent: ReturnType<typeof getTemplateContentByType>,
  width = 1080,
  height = 1080
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

  // Titel, Text und Preis untereinander: ein Titel über zwei Zeilen schiebt
  // den Rest nach unten (vorher lagen die Zeilen übereinander).
  let nextY = panelY + 280 * scale

  // Title
  if (content.title) {
    ctx.font = `bold ${64 * scale}px Georgia, serif`
    const lastY = wrapText(
      ctx,
      content.title,
      width / 2,
      nextY,
      width - 160 * scale,
      70 * scale
    )
    nextY = lastY + 100 * scale
  } else {
    nextY = panelY + 380 * scale
  }

  // Description
  if (content.description) {
    ctx.font = `${32 * scale}px Arial, sans-serif`
    ctx.fillStyle = BRAND_COLORS.textMedium
    const lastY = wrapText(
      ctx,
      content.description,
      width / 2,
      nextY,
      width - 160 * scale,
      40 * scale
    )
    nextY = lastY + 100 * scale
  } else {
    nextY = Math.max(nextY, panelY + 480 * scale)
  }

  // Price (if applicable)
  const price = formatSocialPrice(content.price ?? '')
  if (templateContent.showPrice && price) {
    ctx.save()
    ctx.font = `bold ${56 * scale}px Arial, sans-serif`
    // Kasten so breit wie der Text - „Sparen Sie 30%“ lief vorher über den
    // festen 200-px-Kasten hinaus.
    const boxWidth = Math.min(
      width - 2 * panelMargin - 40 * scale,
      Math.max(200 * scale, ctx.measureText(price).width + 60 * scale)
    )
    // Price background with success green for freshness
    ctx.fillStyle = BRAND_COLORS.success
    const priceY = nextY
    ctx.fillRect(
      width / 2 - boxWidth / 2,
      priceY - 40 * scale,
      boxWidth,
      80 * scale
    )

    // Price text
    ctx.fillStyle = BRAND_COLORS.bgPaper
    ctx.fillText(price, width / 2, priceY + 15 * scale)
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
): number {
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
  return currentY
}

export default function SocialMediaPage() {
  const [templateType, setTemplateType] =
    useState<TemplateType>('daily-special')
  const [content, setContent] = useState<PostContent>(EMPTY_CONTENT)
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
    (field: keyof PostContent) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setContent((prev) => ({
        ...prev,
        [field]: event.target.value,
      }))
    }

  const templateContent = getTemplateContentByType(templateType)
  const priceText = formatSocialPrice(content.price)
  const format = SOCIAL_DIMENSIONS[socialPlatform]
  const hasContent = Object.values(content).some((value) => value.trim())

  // Ein Knopf für das gewählte Format - vorher gab es zusätzlich
  // „Standard (1080x1080)“, das bei Quadrat dasselbe Bild lieferte.
  const handleDownload = async () => {
    setLoading(true)
    try {
      const dataUrl = createBakeryImage(
        content,
        templateType,
        templateContent,
        format.width,
        format.height
      )
      const link = document.createElement('a')
      link.download = `baeckerei-heusser-${socialPlatform}-${templateType}-${
        new Date().toISOString().split('T')[0]
      }.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSnackbar({
        open: true,
        message: `Bild für ${format.label} heruntergeladen.`,
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
    <PageLayout
      title="Social Media"
      subtitle="Bild für Instagram oder Facebook aus einer Vorlage erstellen"
    >
      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={6}>
          <PageSection title="Inhalt">
            <Stack spacing={2}>
              <TextField
                select
                fullWidth
                label="Vorlage"
                value={templateType}
                onChange={(e) =>
                  setTemplateType(e.target.value as TemplateType)
                }
                SelectProps={{
                  renderValue: (value) =>
                    templates.find((t) => t.id === value)?.name ?? '',
                }}
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
              </TextField>

              <TextField
                fullWidth
                label="Titel"
                value={content.title}
                onChange={handleContentChange('title')}
                placeholder={templateContent.placeholder.title}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beschreibung"
                value={content.description}
                onChange={handleContentChange('description')}
                placeholder={templateContent.placeholder.description}
              />

              {templateContent.showPrice && (
                <TextField
                  fullWidth
                  label="Preis"
                  value={content.price}
                  onChange={handleContentChange('price')}
                  placeholder={templateContent.placeholder.price}
                  helperText="Betrag ohne €-Zeichen oder freier Text, z. B. „3 für 2“"
                />
              )}

              <TextField
                fullWidth
                label="Zusätzliche Information"
                value={content.additionalInfo}
                onChange={handleContentChange('additionalInfo')}
                placeholder={templateContent.placeholder.additionalInfo}
              />

              <TextField
                select
                fullWidth
                label="Format"
                value={socialPlatform}
                onChange={(e) =>
                  setSocialPlatform(e.target.value as SocialPlatform)
                }
                SelectProps={{
                  renderValue: (value) =>
                    SOCIAL_DIMENSIONS[value as SocialPlatform]?.label ?? '',
                }}
              >
                {Object.entries(SOCIAL_DIMENSIONS).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    <Box>
                      <Typography variant="body1">{value.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {value.width} × {value.height} Pixel
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  justifyContent: 'flex-end',
                }}
              >
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={() => setContent(EMPTY_CONTENT)}
                  disabled={!hasContent || loading}
                >
                  Leeren
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <DownloadIcon />
                    )
                  }
                  onClick={handleDownload}
                  disabled={loading || !content.title.trim()}
                  sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
                >
                  {loading ? 'Wird erstellt …' : 'Bild herunterladen'}
                </Button>
              </Box>
              {!content.title.trim() && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: 'right', mt: '4px !important' }}
                >
                  Zum Herunterladen zuerst einen Titel eingeben.
                </Typography>
              )}
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <PageSection
            title="Vorschau"
            description={`Quadratische Vorschau · heruntergeladen wird ${format.label}, ${format.width} × ${format.height} Pixel.`}
          >
            <Box
              ref={previewRef}
              sx={{
                width: '100%',
                aspectRatio: '1',
                // Bezugsgröße 540 px: alle Maße innen in cqw (1cqw = 1 %
                // der Vorschaubreite), damit die Karte am Handy mitschrumpft,
                // statt dass Fußzeile und Texte übereinanderliegen.
                containerType: 'inline-size',
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
                  top: '3.7cqw',
                  left: '3.7cqw',
                  width: '18.5cqw',
                  height: '18.5cqw',
                  borderRadius: '50%',
                  bgcolor: BRAND_COLORS.primary,
                  opacity: 0.05,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '7.4cqw',
                  right: '7.4cqw',
                  width: '14.8cqw',
                  height: '14.8cqw',
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
                    p: '3cqw',
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
                    style={{ width: '22cqw', height: '5.5cqw' }}
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
                    fontSize: '3.7cqw',
                    mt: '3cqw',
                    mb: '1.5cqw',
                  }}
                >
                  {templateContent.heading}
                </Typography>

                {/* Content */}
                <Box sx={{ p: '4.4cqw', textAlign: 'center' }}>
                  {/* Platzhalter dort, wo später Titel und Text stehen -
                      nicht absolut über der Karte, sonst liegt er am Handy
                      auf der Überschrift. Die Karte ist immer weiß, also
                      Markenfarbe statt text.secondary (im Dark Mode wäre
                      das hellgrau auf weiß). */}
                  {!content.title && !content.description && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: BRAND_COLORS.textMedium,
                        fontStyle: 'italic',
                        fontFamily: "'Lora', serif",
                        fontSize: '3cqw',
                      }}
                    >
                      Füllen Sie das Formular aus, um eine Vorschau zu sehen
                    </Typography>
                  )}

                  {content.title && (
                    <Typography
                      variant="h4"
                      sx={{
                        mb: '3cqw',
                        fontWeight: 'bold',
                        color: BRAND_COLORS.textDark,
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '6.3cqw',
                      }}
                    >
                      {content.title}
                    </Typography>
                  )}

                  {content.description && (
                    <Typography
                      variant="body1"
                      sx={{
                        mb: '3cqw',
                        color: BRAND_COLORS.textMedium,
                        fontFamily: "'Lora', serif",
                        fontSize: '3cqw',
                      }}
                    >
                      {content.description}
                    </Typography>
                  )}

                  {templateContent.showPrice && priceText && (
                    <Box
                      sx={{
                        display: 'inline-block',
                        bgcolor: BRAND_COLORS.success,
                        color: BRAND_COLORS.bgPaper,
                        px: '4.4cqw',
                        py: '1.5cqw',
                        borderRadius: '1.5cqw',
                        mb: '3cqw',
                        boxShadow: '0 2px 8px rgba(26, 218, 103, 0.3)',
                      }}
                    >
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 'bold', fontSize: '8.9cqw' }}
                      >
                        {priceText}
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
                        fontSize: '2.6cqw',
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
                  height: '18.5cqw',
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
                    fontSize: '2.6cqw',
                  }}
                >
                  Traditionelle Handwerkskunst seit 1952
                </Typography>
              </Box>

              {/* Logo mark in corner */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '20.4cqw',
                  right: '5.5cqw',
                  width: '11cqw',
                  height: '11cqw',
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '6.7cqw',
                    fontWeight: 'bold',
                    color: BRAND_COLORS.bgPaper,
                  }}
                >
                  H
                </Typography>
              </Box>
            </Box>
          </PageSection>
        </Grid>
      </Grid>

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
    </PageLayout>
  )
}
