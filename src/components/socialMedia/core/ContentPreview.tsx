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
import { 
  getTemplateConfig, 
  shouldShowDescription, 
  shouldShowPrice, 
  formatAdditionalInfo, 
  getPlaceholderText 
} from '../config/templateConfig'
import { mapContentToTemplate, getTemplateForType } from '../utils/contentMapper'
import { getSimpleSquareTextStyles } from '../utils/textSizing'

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
  const [messageVariant, setMessageVariant] = useState<'primary' | 'white'>('primary')

  // Get template using utility function
  const template = getTemplateForType(templateType, socialMediaTemplates, messageVariant)
  
  // Get template configuration
  const templateConfig = getTemplateConfig(templateType)

  // Handle message variant change
  useEffect(() => {
    if (content.additionalInfo === 'white') {
      setMessageVariant('white')
    } else {
      setMessageVariant('primary')
    }
  }, [content.additionalInfo])

  // Map content to template structure using utility function
  const getTextContent = (template: Template) => {
    const mapped = mapContentToTemplate(content, template, templateType)
    
    // Add message variant for message templates
    if (templateType === 'message' && template.textElements.some((el) => el.id === 'variant')) {
      mapped.variant = messageVariant
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
                width: template.width || 1080,
                height: template.height || 1080,
                background: template.backgroundStyle || template.colors.background,
                transformOrigin: '0 0',
                transform: `scale(${Math.min(280 / (template.width || 1080), 280 / (template.height || 1080))})`,
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
                  padding: templateConfig.textPanel.padding,
                  backgroundColor:
                    template.textPanelStyle?.background ||
                    `${template.colors.primary}E0`,
                  color: template.textPanelStyle?.textColor || '#FFFFFF',
                  minHeight: templateConfig.textPanel.minHeight,
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
                      fontSize: templateConfig.typography.title.fontSize,
                      textAlign: 'center',
                      width: '100%',
                      fontFamily: templateConfig.typography.title.fontFamily,
                      letterSpacing: 0.5,
                      lineHeight: 1.3,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100%',
                    }}
                  >
                    {content.title || getPlaceholderText(templateType, 'title')}
                  </Typography>
                ) : templateType === 'simple-square' ? (
                  /* Simple Square template - dynamically sized centered text */
                  <Typography
                    style={getSimpleSquareTextStyles(content.title || getPlaceholderText(templateType, 'title'))}
                    sx={{
                      color: template.textPanelStyle?.textColor || template.colors.primary,
                      fontWeight: 'bold',
                      fontFamily: templateConfig.typography.title.fontFamily,
                      letterSpacing: 0.5,
                    }}
                  >
                    {content.title || getPlaceholderText(templateType, 'title')}
                  </Typography>
                ) : (
                  <>
                    {/* Main title */}
                    <Typography
                      sx={{
                        color: template.textPanelStyle?.textColor || 'white',
                        fontWeight: 'bold',
                        fontSize: templateConfig.typography.title.fontSize,
                        mb: 2,
                        fontFamily: templateConfig.typography.title.fontFamily,
                        letterSpacing: 0.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {content.title || getPlaceholderText(templateType, 'title')}
                    </Typography>

                    {/* Description */}
                    {shouldShowDescription(templateType, !!content.description) && (
                      <Typography
                        sx={{
                          color: template.textPanelStyle?.textColor || 'white',
                          fontWeight: 'normal',
                          fontSize: templateConfig.typography.description.fontSize,
                          mb: 2,
                          fontFamily: templateConfig.typography.description.fontFamily,
                          letterSpacing: 0.2,
                          lineHeight: 1.4,
                        }}
                      >
                        {content.description || getPlaceholderText(templateType, 'description')}
                      </Typography>
                    )}

                    {/* Price if available */}
                    {(content.price || shouldShowPrice(templateType)) && (
                      <Typography
                        sx={{
                          color: template.textPanelStyle?.textColor || 'white',
                          fontWeight: 'bold',
                          fontSize: templateConfig.typography.price.fontSize,
                          mb: 1,
                          fontFamily: templateConfig.typography.price.fontFamily,
                        }}
                      >
                        {content.price ? `${content.price} €` : getPlaceholderText(templateType, 'price')}
                      </Typography>
                    )}

                    {/* Additional info if available */}
                    {content.additionalInfo && (
                      <Typography
                        sx={{
                          color: template.textPanelStyle?.textColor || 'white',
                          fontSize: templateConfig.typography.additionalInfo.fontSize,
                          fontFamily: templateConfig.typography.additionalInfo.fontFamily,
                          opacity: 0.9,
                          mt: 1,
                        }}
                      >
                        {formatAdditionalInfo(content.additionalInfo, templateType)}
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