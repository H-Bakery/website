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
  width = 1080,
  height = 1080
): string => {
  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
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
    ctx.fillRect(0, 0, width, height)
  } else {
    // Standard gradient background for other templates
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
    bgGradient.addColorStop(0, '#FFFFFF')
    bgGradient.addColorStop(1, '#F6F8FC')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, width, height)
  }

  // Draw text panel background for non-message templates or keep full background for message template
  if (!isMessageTemplate) {
    const panelGradient = ctx.createLinearGradient(0, height * 0.3, 0, height)
    panelGradient.addColorStop(0, '#D038BA')
    panelGradient.addColorStop(1, '#C030AA')
    ctx.fillStyle = panelGradient
    ctx.fillRect(0, height * 0.33, width, height * 0.67)
  }

  // Set text styles - use appropriate color based on template
  if (isMessageTemplate && isWhiteMessageVariant) {
    ctx.fillStyle = '#D038BA' // Primary color for white background
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

  // Draw title
  // Draw title - find the title from different possible fields
  const title =
    content.textElements?.message ||
    content.textElements?.title ||
    content.textElements?.breadName ||
    content.textElements?.newsTitle ||
    'Bäckerei Heusser'

  // Position text differently for message template vs others
  if (isMessageTemplate) {
    wrapText(ctx, title, width/2, height * 0.5, width * 0.8, 80)
  } else {
    wrapText(ctx, title, 80, height * 0.45, width * 0.85, 70)
  }

  // Draw description if available and not a message template
  if (!isMessageTemplate) {
    const description =
      content.textElements?.description ||
      content.textElements?.breadDescription ||
      content.textElements?.newsContent ||
      ''

    if (description) {
      ctx.font = '32px Ubuntu, sans-serif'
      wrapText(ctx, description, 80, height * 0.58, width * 0.85, 40)
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
    ctx.fillRect(60, height * 0.77, 220, 70)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(price, 80, height * 0.83)
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
  ctx.fillText('Bäckerei Heusser', 60, 80)
  
  // Add separator line
  ctx.beginPath()
  ctx.moveTo(60, 100)
  ctx.lineTo(400, 100)
  // For message templates with primary background, use white for separator
  if (isMessageTemplate && !isWhiteMessageVariant) {
    ctx.strokeStyle = '#FFFFFF'
  } else {
    ctx.strokeStyle = '#D038BA'
  }
  ctx.lineWidth = 3
  ctx.stroke()
  
  // Add logo placeholder in bottom right
  ctx.save()
  ctx.beginPath()
  ctx.arc(width - 80, height - 80, 60, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fill()
  
  // Add simple "H" text as logo placeholder
  ctx.font = 'bold 70px Averia Serif Libre, serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText('H', width - 80, height - 55)
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
