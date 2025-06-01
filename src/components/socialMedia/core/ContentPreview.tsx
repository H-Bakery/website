import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  useTheme,
  alpha,
  Switch,
  FormControlLabel,
} from '@mui/material'
import { Template, TemplateType } from '../../../types/socialMedia'
import { socialMediaTemplates } from '../../../data/socialMediaTemplates'
import Wappen from '../../icons/brand/Wappen'

interface ContentPreviewProps {
  templateType: TemplateType
  content: {
    title: string
    description: string
    price?: string
    additionalInfo?: string
  }
  loading?: boolean
  previewRef: React.RefObject<HTMLDivElement>
}

const ContentPreview: React.FC<ContentPreviewProps> = ({
  templateType,
  content,
  loading = false,
  previewRef,
}) => {
  const theme = useTheme()

  // For message type, we need to track if we want white or primary background
  const [messageVariant, setMessageVariant] = useState<'primary' | 'white'>(
    'primary'
  )

  // Get first template of the selected type or the variant for message type
  const template =
    templateType === 'message'
      ? socialMediaTemplates.find(
          (t) =>
            t.type === templateType &&
            (messageVariant === 'white'
              ? t.id === 'simple-message-white'
              : t.id === 'simple-message')
        ) ||
        socialMediaTemplates.find((t) => t.type === templateType) ||
        socialMediaTemplates[0]
      : socialMediaTemplates.find((t) => t.type === templateType) ||
        socialMediaTemplates[0]

  // Handle message variant change
  useEffect(() => {
    if (content.additionalInfo === 'white') {
      setMessageVariant('white')
    } else {
      setMessageVariant('primary')
    }
  }, [content.additionalInfo])

  // Map content to the template structure
  const getTextContent = (template: Template) => {
    const mapped: Record<string, string> = {}

    // Map content based on template type
    switch (templateType) {
      case 'message':
        if (template.textElements.some((el) => el.id === 'message'))
          mapped.message = content.title || ''
        if (template.textElements.some((el) => el.id === 'variant'))
          mapped.variant = messageVariant
        break
      case 'daily-special':
        // Get relevant text fields from the template
        const dailySpecialFields = template.textElements.map((el) => el.id)

        if (dailySpecialFields.includes('title'))
          mapped.title = content.title || 'Tagesangebot'
        if (dailySpecialFields.includes('description'))
          mapped.description = content.description
        if (dailySpecialFields.includes('price'))
          mapped.price = content.price ? `${content.price} €` : ''
        if (dailySpecialFields.includes('callToAction'))
          mapped.callToAction = content.additionalInfo || ''
        if (dailySpecialFields.includes('subtitle'))
          mapped.subtitle = 'Unser Angebot heute'
        break

      case 'bread-of-day':
        if (template.textElements.some((el) => el.id === 'breadName'))
          mapped.breadName = content.title || 'Brot des Tages'
        if (template.textElements.some((el) => el.id === 'breadDescription'))
          mapped.breadDescription = content.description
        if (template.textElements.some((el) => el.id === 'price'))
          mapped.price = content.price ? `${content.price} €` : ''
        if (template.textElements.some((el) => el.id === 'ingredients'))
          mapped.ingredients = content.additionalInfo || ''
        break

      case 'offer':
        if (template.textElements.some((el) => el.id === 'title'))
          mapped.title = content.title || 'Sonderangebot'
        if (template.textElements.some((el) => el.id === 'description'))
          mapped.description = content.description
        if (template.textElements.some((el) => el.id === 'priceInfo'))
          mapped.priceInfo = content.price ? `${content.price} €` : ''
        if (template.textElements.some((el) => el.id === 'callToAction'))
          mapped.callToAction = 'Jetzt zugreifen!'
        if (template.textElements.some((el) => el.id === 'subtitle'))
          mapped.subtitle = content.additionalInfo || ''
        break

      case 'bakery-news':
        if (template.textElements.some((el) => el.id === 'newsTitle'))
          mapped.newsTitle = content.title || 'Neuigkeiten'
        if (template.textElements.some((el) => el.id === 'newsContent'))
          mapped.newsContent = content.description
        if (template.textElements.some((el) => el.id === 'date'))
          mapped.date = content.additionalInfo || ''
        if (template.textElements.some((el) => el.id === 'category'))
          mapped.category = 'INFORMATION'
        break
    }

    return mapped
  }

  return (
    <Paper
      sx={{
        p: 4,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: theme.shadows[1],
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography
        variant="h6"
        fontWeight={600}
        gutterBottom
        color="primary.main"
      >
        Vorschau
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        So wird Ihr Inhalt in sozialen Medien aussehen
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          position: 'relative',
          my: 4,
        }}
      >
        {loading ? (
          <CircularProgress size={60} />
        ) : (
          <Box
            sx={{
              width: 280,
              height: 280,
              position: 'relative',
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
            }}
          >
            {/* Actual preview */}
            <Box
              id="social-media-content-preview"
              ref={previewRef}
              sx={{
                width: 1080,
                height: 1080,
                background:
                  template.backgroundStyle || template.colors.background,
                transformOrigin: '0 0',
                transform: 'scale(0.25)',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                overflow: 'hidden',
              }}
            >
              {/* Brand header */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 30,
                  left: 40,
                  zIndex: 5,
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: "'Averia Serif Libre', serif",
                    fontWeight: 700,
                    color: template.colors.primary,
                    letterSpacing: '0.5px',
                    fontSize: '48px',
                  }}
                >
                  Bäckerei Heusser
                </Typography>
              </Box>

              {/* Wappen logo */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  zIndex: 4,
                  opacity: 0.85,
                  transform: 'scale(0.2)',
                  transformOrigin: 'bottom right',
                  filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.25))',
                }}
              >
                <Wappen />
              </Box>

              {/* Text panel */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  padding: '7% 15% 7% 8%', // Extra space for Wappen
                  backgroundColor:
                    template.textPanelStyle?.background ||
                    `${template.colors.primary}E0`,
                  color: template.textPanelStyle?.textColor || '#FFFFFF',
                  minHeight: '67%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                {templateType === 'message' ? (
                  /* Message template - large centered text */
                  <Typography
                    sx={{
                      color:
                        messageVariant === 'primary'
                          ? 'white'
                          : template.colors.primary,
                      fontWeight: 'bold',
                      fontSize: '72px',
                      textAlign: 'center',
                      width: '100%',
                      fontFamily: "'Averia Serif Libre', serif",
                      letterSpacing: 0.5,
                      lineHeight: 1.3,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100%',
                    }}
                  >
                    {content.title || 'Ihre Nachricht hier eingeben...'}
                  </Typography>
                ) : (
                  <>
                    {/* Main title */}
                    <Typography
                      sx={{
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '56px',
                        mb: 3,
                        fontFamily: "'Averia Serif Libre', serif",
                        letterSpacing: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      {content.title || 'Titel eingeben...'}
                    </Typography>

                    {/* Description */}
                    <Typography
                      sx={{
                        color: 'white',
                        fontWeight: 'normal',
                        fontSize: '28px',
                        mb: 3,
                        fontFamily: "'Averia Serif Libre', serif",
                        letterSpacing: 0.2,
                        lineHeight: 1.4,
                      }}
                    >
                      {content.description || 'Beschreibung eingeben...'}
                    </Typography>

                    {/* Price if available */}
                    {content.price && (
                      <Typography
                        sx={{
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '42px',
                          mb: 2,
                          fontFamily: "'Averia Serif Libre', serif",
                        }}
                      >
                        {content.price} €
                      </Typography>
                    )}

                    {/* Additional info if available */}
                    {content.additionalInfo &&
                      (templateType === 'daily-special' ||
                        templateType === 'bread-of-day' ||
                        templateType === 'offer' ||
                        templateType === 'bakery-news') && (
                        <Typography
                          sx={{
                            color: 'white',
                            fontSize: '24px',
                            fontFamily: "'Averia Serif Libre', serif",
                            opacity: 0.9,
                          }}
                        >
                          {content.additionalInfo}
                        </Typography>
                      )}
                  </>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {templateType === 'message' && (
        <FormControlLabel
          control={
            <Switch
              checked={messageVariant === 'white'}
              onChange={(e) => {
                const newVariant = e.target.checked ? 'white' : 'primary'
                setMessageVariant(newVariant)
              }}
              color="primary"
              size="small"
            />
          }
          label="Weißer Hintergrund"
          sx={{
            mt: 1,
            mb: 1,
            justifyContent: 'center',
            width: '100%',
            '& .MuiTypography-root': { fontSize: '0.875rem' },
          }}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          textAlign: 'center',
          color: 'text.secondary',
          mt: 2,
          mb: 2,
          display: 'block',
        }}
      >
        Mit Wappen-Logo in der rechten unteren Ecke
      </Typography>
    </Paper>
  )
}

export default ContentPreview
