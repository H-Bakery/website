'use client'
import React, { useRef } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Template, SocialMediaContent } from '../../types/socialMedia'

interface TemplatePreviewProps {
  template: Template
  content: Partial<SocialMediaContent>
  scale: number
}

const TemplatePreview = React.forwardRef<HTMLDivElement, TemplatePreviewProps>(({ template, content, scale }, ref) => {
  const theme = useTheme()

  return (
    <Box
      ref={ref}
      sx={{
        width: template.width * scale,
        height: template.height * scale,
        backgroundColor: template.colors.background,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: theme.shadows[3],
        transform: `scale(${scale})`, // Apply scale for display
        transformOrigin: 'top left', // Ensure scaling is from the top-left
        // The parent component will handle the margin for the scaled preview if needed
        // For capturing, the transform will be temporarily set to scale(1)
      }}
    >
      {/* Background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: template.colors.background,
          backgroundImage: template.backgroundImage ? `url(${template.backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.8,
        }}
      />

      {/* Logo - always at the top */}
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          left: 20,
          width: 120,
          height: 60,
          backgroundColor: template.colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          zIndex: 2,
        }}
      >
        BAKERY LOGO
      </Box>

      {/* Images */}
      {template.imageElements.map((element) => {
        const imageSrc = content.imageElements?.[element.id]
        if (!imageSrc && element.required) {
          return (
            <Box
              key={element.id}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '50%',
                height: '40%',
                backgroundColor: theme.palette.grey[300],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.palette.grey[600],
                border: `2px dashed ${theme.palette.grey[400]}`,
                zIndex: 1,
              }}
            >
              Bild erforderlich
            </Box>
          )
        } else if (imageSrc) {
          return (
            <Box
              key={element.id}
              component="img"
              src={imageSrc}
              alt=""
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '70%',
                maxHeight: '60%',
                objectFit: 'contain',
                zIndex: 1,
              }}
            />
          )
        }
        return null
      })}

      {/* Text elements */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          padding: 4,
          backgroundColor: `${template.colors.primary}CC`, // Semi-transparent
          color: 'white',
          zIndex: 2,
        }}
      >
        {template.textElements.map((element) => {
          const text = content.textElements?.[element.id] || element.placeholder
          return (
            <Typography
              key={element.id}
              variant={element.id === 'title' || element.fontWeight === 'bold' ? 'h4' : 'body1'}
              sx={{
                color: 'white',
                fontWeight: element.fontWeight,
                // Font size in the template is the final size, no need to scale again here
                fontSize: element.fontSize ? `${element.fontSize}px` : undefined,
                mb: 1,
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {text}
            </Typography>
          )
        })}
      </Box>
    </Box>
  )
})

export default TemplatePreview
