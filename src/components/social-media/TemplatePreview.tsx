'use client'
import React from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Template, SocialMediaContent } from '../../types/socialMedia'
import Baeckerei from '../../components/icons/brand/Baeckerei'
import Heusser from '../../components/icons/brand/Heusser'
import Wappen from '../../components/icons/brand/Wappen'
import { lightTheme } from '../../theme'

interface TemplatePreviewProps {
  template: Template
  content: Partial<SocialMediaContent>
  scale: number
}

const TemplatePreview = React.forwardRef<HTMLDivElement, TemplatePreviewProps>(
  ({ template, content, scale }, ref) => {
    // Always use light theme for consistency in social media images, regardless of admin UI mode
    const theme = lightTheme
    const uiTheme = useTheme()

    // Find background image if one exists
    const backgroundImage = template.imageElements.find((el) => el.isBackground)
    const backgroundImageSrc = backgroundImage
      ? content.imageElements?.[backgroundImage.id]
      : null

    // Check if there are any content images
    const hasContentImages = template.imageElements
      .filter((element) => !element.isBackground)
      .some((element) => content.imageElements?.[element.id])

    return (
      <Box
        ref={ref}
        sx={{
          width: template.width,
          height: template.height,
          background: backgroundImageSrc
            ? 'none'
            : template.backgroundStyle || template.colors.background,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundImage: backgroundImageSrc
            ? `url(${backgroundImageSrc})`
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Color overlay for background if image is used */}
        {backgroundImageSrc && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0,0,0,0.2)',
              zIndex: 1,
            }}
          />
        )}

        {/* Logo - always at the top with proper brand components */}
        <Box
          sx={{
            position: 'absolute',
            top: 30,
            left: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            color: template.colors.primary,
            zIndex: 5,
            filter: 'drop-shadow(0px 2px 3px rgba(208,56,186,0.2))',
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontFamily: "'Averia Serif Libre', serif",
              fontWeight: 700,
              color: template.colors.primary,
              letterSpacing: '0.5px',
            }}
          >
            Bäckerei Heusser
          </Typography>
        </Box>

        {/* Wappen in the bottom right */}
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

        {/* Content Images (non-background) - only if images are present */}
        {template.imageElements
          .filter((element) => !element.isBackground)
          .map((element) => {
            const imageSrc = content.imageElements?.[element.id]
            const aspectRatio = element.aspectRatio || '1:1'
            let [width, height] = aspectRatio.split(':').map(Number)
            let imageBoxStyle = {}

            if (width && height) {
              const ratio = width / height
              if (ratio >= 1) {
                imageBoxStyle = {
                  width: '50%',
                  height: `${50 / ratio}%`,
                  maxHeight: '30%',
                }
              } else {
                imageBoxStyle = {
                  height: '30%',
                  width: `${30 * ratio}%`,
                  maxWidth: '50%',
                }
              }
            }

            if (!imageSrc && element.required) {
              return (
                <Box
                  key={element.id}
                  sx={{
                    position: 'absolute',
                    top: '35%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    ...imageBoxStyle,
                    backgroundColor: lightTheme.palette.grey[200],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: lightTheme.palette.grey[600],
                    border: `2px dashed ${lightTheme.palette.grey[400]}`,
                    borderRadius: 2,
                    zIndex: 2,
                    fontFamily: 'sans-serif',
                  }}
                >
                  Bild erforderlich
                </Box>
              )
            } else if (imageSrc) {
              return (
                <Box
                  key={element.id}
                  sx={{
                    position: 'absolute',
                    top: '35%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '50%',
                    maxHeight: '30%',
                    zIndex: 2,
                    borderRadius: 2,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Using img because Next/Image would not be exported with html-to-image */}
                  <img
                    src={imageSrc}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>
              )
            }
            return null
          })}

        {/* Text panel - expanded to be more prominent */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            padding: hasContentImages ? 5 : '10%',
            paddingRight: hasContentImages ? 5 : '15%', // Extra space for Wappen
            background:
              template.textPanelStyle?.background ||
              `${template.colors.primary}CC`,
            color: template.textPanelStyle?.textColor || 'white',
            zIndex: 3,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
            minHeight: hasContentImages ? 'auto' : '60%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: hasContentImages ? 'flex-start' : 'center',
          }}
        >
          {template.textElements.map((element) => {
            const text =
              content.textElements?.[element.id] || element.placeholder
            return (
              <Typography
                key={element.id}
                variant={
                  element.id === 'title' || element.fontWeight === 'bold'
                    ? 'h4'
                    : 'body1'
                }
                sx={{
                  color: 'white',
                  fontWeight: element.fontWeight,
                  fontSize:
                    !hasContentImages &&
                    (element.id === 'title' || element.fontWeight === 'bold')
                      ? `${(element.fontSize || 0) * 1.2}px` // Larger text when no images
                      : element.fontSize
                      ? `${element.fontSize}px`
                      : undefined,
                  mb:
                    element.id === 'title' || element.fontWeight === 'bold'
                      ? 3
                      : 2,
                  textShadow: element.highlight
                    ? 'none'
                    : '1px 1px 3px rgba(0,0,0,0.15)',
                  fontFamily: "'Averia Serif Libre', serif",
                  letterSpacing: element.fontWeight === 'bold' ? 0.5 : 0.2,
                  lineHeight: 1.4,
                  display: 'block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {text}
              </Typography>
            )
          })}
        </Box>
      </Box>
    )
  }
)

TemplatePreview.displayName = 'TemplatePreview'
export default TemplatePreview
