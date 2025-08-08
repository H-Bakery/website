// fallbacks.ts - Alternative methods for image generation when html-to-image fails
import { SocialMediaContent, Template } from '../../../types/socialMedia'

/**
 * Attempts to render the social media content to a canvas element
 * This is a fallback for when html-to-image fails
 */
export const renderToCanvas = async (
  element: HTMLElement | null,
  width: number,
  height: number
): Promise<string | null> => {
  if (!element) return null

  try {
    // Create a canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    // Fill background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Draw the element using html2canvas
    const svg = new XMLSerializer().serializeToString(element)
    const img = new Image()

    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        URL.revokeObjectURL(url)
        resolve(dataUrl)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }

      img.src = url
    })
  } catch (error) {
    console.error('Fallback render failed:', error)
    return null
  }
}

/**
 * Creates a simple styled version of the content when all else fails
 * Returns a data URL of the generated image
 */
export const createBasicImage = (
  content: Partial<SocialMediaContent>,
  template: Template,
  width?: number,
  height?: number
): string => {
  // Use template dimensions if not provided
  const canvasWidth = width || template.width || 1080
  const canvasHeight = height || template.height || 1080

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Draw background - use appropriate color based on template
  const isMessageTemplate = template.type === 'message'
  const isWhiteMessageVariant = content.textElements?.variant === 'white'

  if (isMessageTemplate) {
    // Message template background - either primary or white
    if (isWhiteMessageVariant) {
      ctx.fillStyle = '#FFFFFF'
    } else {
      ctx.fillStyle = '#D038BA' // Primary color
    }
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  } else {
    // Different backgrounds for different template types
    if (template.platform === 'facebook') {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
      bgGradient.addColorStop(0, '#FFFFFF')
      bgGradient.addColorStop(1, '#E3F2FD')
      ctx.fillStyle = bgGradient
    } else if (template.platform === 'instagram') {
      const bgGradient = ctx.createLinearGradient(
        0,
        0,
        canvasWidth,
        canvasHeight
      )
      bgGradient.addColorStop(0, '#E91E63')
      bgGradient.addColorStop(0.5, '#9C27B0')
      bgGradient.addColorStop(1, '#D038BA')
      ctx.fillStyle = bgGradient
    } else if (template.platform === 'website') {
      ctx.fillStyle = '#FFFFFF'
    } else {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
      bgGradient.addColorStop(0, '#FFFFFF')
      bgGradient.addColorStop(1, '#F6F8FC')
      ctx.fillStyle = bgGradient
    }
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }

  // Draw text panel background for non-message templates
  if (!isMessageTemplate) {
    if (template.platform === 'facebook') {
      // Facebook style panel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillRect(
        40,
        canvasHeight * 0.4,
        canvasWidth - 80,
        canvasHeight * 0.55
      )

      // Add border
      ctx.strokeStyle = '#D038BA'
      ctx.lineWidth = 3
      ctx.strokeRect(
        40,
        canvasHeight * 0.4,
        canvasWidth - 80,
        canvasHeight * 0.55
      )
    } else if (template.platform === 'instagram') {
      // Instagram story style panel
      const panelGradient = ctx.createLinearGradient(
        0,
        canvasHeight * 0.3,
        0,
        canvasHeight
      )
      panelGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      panelGradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)')
      ctx.fillStyle = panelGradient
      ctx.fillRect(0, canvasHeight * 0.5, canvasWidth, canvasHeight * 0.5)
    } else if (template.platform === 'website') {
      // Website banner style - minimal overlay
      ctx.fillStyle = 'rgba(208, 56, 186, 0.1)'
      ctx.fillRect(0, canvasHeight * 0.6, canvasWidth, canvasHeight * 0.4)
    } else {
      // Default panel
      const panelGradient = ctx.createLinearGradient(
        0,
        canvasHeight * 0.3,
        0,
        canvasHeight
      )
      panelGradient.addColorStop(0, '#D038BA')
      panelGradient.addColorStop(1, '#C030AA')
      ctx.fillStyle = panelGradient
      ctx.fillRect(0, canvasHeight * 0.33, canvasWidth, canvasHeight * 0.67)
    }
  }

  // Set text styles - use appropriate color based on template and platform
  if (isMessageTemplate && isWhiteMessageVariant) {
    ctx.fillStyle = '#D038BA' // Primary color for white background
  } else if (template.platform === 'facebook') {
    ctx.fillStyle = '#D038BA' // Brand color for Facebook
  } else if (template.platform === 'website') {
    ctx.fillStyle = '#131F37' // Dark text for website
  } else {
    ctx.fillStyle = '#FFFFFF' // White text for colored backgrounds
  }

  // For message templates, use center alignment and larger font
  if (isMessageTemplate) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 72px Averia Serif Libre, serif'
  } else {
    ctx.textAlign = 'left'
    ctx.font = 'bold 60px Averia Serif Libre, serif'
  }

  // Draw title - find the title from different possible fields
  const title =
    content.textElements?.message ||
    content.textElements?.title ||
    content.textElements?.breadName ||
    content.textElements?.newsTitle ||
    'Bäckerei Heusser'

  // Position text differently for message template vs others and platform
  if (isMessageTemplate) {
    wrapText(
      ctx,
      title,
      canvasWidth / 2,
      canvasHeight * 0.5,
      canvasWidth * 0.8,
      80
    )
  } else if (template.platform === 'facebook') {
    wrapText(ctx, title, 80, canvasHeight * 0.5, canvasWidth * 0.85, 60)
  } else if (
    template.platform === 'instagram' &&
    template.type === 'instagram-story'
  ) {
    wrapText(ctx, title, 80, canvasHeight * 0.6, canvasWidth * 0.85, 80)
  } else if (template.platform === 'website') {
    wrapText(ctx, title, 80, canvasHeight * 0.7, canvasWidth * 0.85, 70)
  } else {
    wrapText(ctx, title, 80, canvasHeight * 0.45, canvasWidth * 0.85, 70)
  }

  // Draw description if available and not a message template
  if (!isMessageTemplate) {
    const description =
      content.textElements?.description ||
      content.textElements?.breadDescription ||
      content.textElements?.newsContent ||
      ''

    if (description) {
      if (template.platform === 'facebook') {
        ctx.font = '28px Ubuntu, sans-serif'
        wrapText(
          ctx,
          description,
          80,
          canvasHeight * 0.6,
          canvasWidth * 0.85,
          35
        )
      } else if (
        template.platform === 'instagram' &&
        template.type === 'instagram-story'
      ) {
        ctx.font = '36px Ubuntu, sans-serif'
        wrapText(
          ctx,
          description,
          80,
          canvasHeight * 0.7,
          canvasWidth * 0.85,
          45
        )
      } else if (template.platform === 'website') {
        ctx.font = '24px Ubuntu, sans-serif'
        wrapText(
          ctx,
          description,
          80,
          canvasHeight * 0.8,
          canvasWidth * 0.85,
          30
        )
      } else {
        ctx.font = '32px Ubuntu, sans-serif'
        wrapText(
          ctx,
          description,
          80,
          canvasHeight * 0.58,
          canvasWidth * 0.85,
          40
        )
      }
    }
  }

  // Draw price if available
  const price = content.textElements?.price || ''
  if (price) {
    ctx.font = 'bold 58px Averia Serif Libre, serif'
    ctx.fillStyle = '#FFFFFF'
    // Add price highlight
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(60, canvasHeight * 0.77, 220, 70)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(price, 80, canvasHeight * 0.83)
    ctx.restore()
  }

  // Add branding and decorative elements
  // Draw header with brand name
  ctx.font = 'bold 48px Averia Serif Libre, serif'
  ctx.textAlign = 'left'
  // For message templates with primary background, use white for the header
  if (isMessageTemplate && !isWhiteMessageVariant) {
    ctx.fillStyle = '#FFFFFF'
  } else {
    ctx.fillStyle = '#D038BA' // Primary brand color
  }

  // Platform-specific header positioning
  if (
    template.platform === 'instagram' &&
    template.type === 'instagram-story'
  ) {
    ctx.fillText('Bäckerei Heusser', 60, 120)
  } else {
    ctx.fillText('Bäckerei Heusser', 60, 80)
  }

  // Add separator line - adjust for different platforms
  ctx.beginPath()
  const separatorY =
    template.platform === 'instagram' && template.type === 'instagram-story'
      ? 140
      : 100
  ctx.moveTo(60, separatorY)
  ctx.lineTo(400, separatorY)
  // For message templates with primary background, use white for separator
  if (isMessageTemplate && !isWhiteMessageVariant) {
    ctx.strokeStyle = '#FFFFFF'
  } else {
    ctx.strokeStyle = '#D038BA'
  }
  ctx.lineWidth = 3
  ctx.stroke()

  // Add logo placeholder in bottom right - adjust for different platforms
  ctx.save()
  ctx.beginPath()
  const logoSize = template.platform === 'website' ? 40 : 60
  const logoMargin = template.platform === 'website' ? 60 : 80
  ctx.arc(
    canvasWidth - logoMargin,
    canvasHeight - logoMargin,
    logoSize,
    0,
    Math.PI * 2
  )

  if (template.platform === 'website') {
    ctx.fillStyle = 'rgba(208, 56, 186, 0.3)'
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  }
  ctx.fill()

  // Add simple "H" text as logo placeholder
  const logoFontSize = template.platform === 'website' ? 50 : 70
  ctx.font = `bold ${logoFontSize}px Averia Serif Libre, serif`

  if (template.platform === 'website') {
    ctx.fillStyle = '#D038BA'
  } else {
    ctx.fillStyle = '#FFFFFF'
  }

  ctx.textAlign = 'center'
  const logoYOffset = template.platform === 'website' ? 35 : 55
  ctx.fillText('H', canvasWidth - logoMargin, canvasHeight - logoYOffset)
  ctx.restore()

  // Return the data URL
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
  // Save context state to restore later
  ctx.save()

  const words = text.split(' ')
  let line = ''
  let testLine = ''
  let lineCount = 0

  for (let n = 0; n < words.length; n++) {
    testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && n > 0) {
      // Add shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1

      ctx.fillText(line, x, y)
      line = words[n] + ' '
      y += lineHeight
      lineCount++

      if (lineCount > 4) {
        ctx.fillText(line + '...', x, y)
        break
      }
    } else {
      line = testLine
    }
  }

  // Add shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 1
  ctx.fillText(line, x, y)

  // Restore context to original state
  ctx.restore()
}
